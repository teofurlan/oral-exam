"""Serve the built exam page on loopback in the application's asyncio loop."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import json
import logging
import mimetypes
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

from socra_server.adapters.preferences_file import PreferencesFile

logger = logging.getLogger(__name__)

HTTP_HOST = "127.0.0.1"
HTTP_PORT = int(os.environ.get("SOCRA_HTTP_PORT", "8767"))
PAGE_URL = f"http://localhost:{HTTP_PORT}/"


def page_url(http_port: int, ws_port: int | None = None) -> str:
    """The page address; ``?ws=`` tells the page a WebSocket port other than the default."""
    url = f"http://localhost:{http_port}/"
    return url if ws_port is None else f"{url}?ws={ws_port}"


AGENT_PAGE_URL = f"{PAGE_URL}?mode=agent"
WEB_DIST = Path(__file__).resolve().parents[4] / "web" / "dist"

PREFERENCES_PATH = "/api/preferences"
MAX_PREFERENCES_BODY = 16384
MAX_PREFERENCE_VALUE = 1024
_PREFERENCE_KEY = re.compile(r"[a-z][a-z0-9_]{0,63}")
_PREFERENCES_UNAVAILABLE = ("503 Service Unavailable", b'{"error":"preferences unavailable"}')


def _parse_preferences(body: bytes) -> dict[str, str | None]:
    """A JSON object of short snake_case keys to short strings, or null to delete."""
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("Preferences must be a JSON object")
    for key, value in data.items():
        if not _PREFERENCE_KEY.fullmatch(key):
            raise ValueError("Invalid preference key")
        if value is not None and (not isinstance(value, str) or len(value) > MAX_PREFERENCE_VALUE):
            raise ValueError("Invalid preference value")
    return data


async def _preferences(
    method: str,
    headers: dict[str, str],
    reader: asyncio.StreamReader,
    own_port: int,
    store: PreferencesFile,
) -> tuple[str, bytes]:
    """GET reads, PUT merges. Only the page's own origin may write (#27)."""
    if method in ("GET", "HEAD"):
        try:
            return "200 OK", json.dumps(await asyncio.to_thread(store.read)).encode()
        except OSError:
            logger.warning("Could not read the preferences file", exc_info=True)
            return _PREFERENCES_UNAVAILABLE
    if method != "PUT":
        return "405 Method Not Allowed", b'{"error":"method not allowed"}'
    origin = headers.get("origin")
    if origin is not None and origin not in (f"http://localhost:{own_port}", f"http://127.0.0.1:{own_port}"):
        return "403 Forbidden", b'{"error":"cross-origin write"}'
    try:
        length = int(headers.get("content-length", "0"))
    except ValueError:
        return "400 Bad Request", b'{"error":"invalid content-length"}'
    if not 0 <= length <= MAX_PREFERENCES_BODY:
        return "413 Content Too Large", b'{"error":"body too large"}'
    try:
        changes = _parse_preferences(await reader.readexactly(length))
    except (ValueError, UnicodeError, RecursionError):
        return "400 Bad Request", b'{"error":"invalid preferences"}'
    try:
        return "200 OK", json.dumps(await asyncio.to_thread(store.update, changes)).encode()
    except OSError:
        logger.warning("Could not save the preferences file", exc_info=True)
        return _PREFERENCES_UNAVAILABLE


async def _static(method: str, path: str, dist: Path) -> tuple[str, bytes, str]:
    """A file from the build, or index.html for any other path (the SPA fallback)."""
    root = dist.resolve()
    candidate = (root / path.lstrip("/")).resolve()
    if method not in ("GET", "HEAD"):
        return "405 Method Not Allowed", b"Method not allowed\n", "text/plain"
    if not candidate.is_relative_to(root):
        return "403 Forbidden", b"Forbidden\n", "text/plain"
    if not candidate.is_file():
        candidate = (root / "index.html").resolve()
    if not candidate.is_relative_to(root):
        return "403 Forbidden", b"Forbidden\n", "text/plain"
    try:
        body = await asyncio.to_thread(candidate.read_bytes)
    except OSError:
        return "404 Not Found", b"Build the page: run pnpm -C web build\n", "text/plain"
    return "200 OK", body, mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"


async def _respond(
    reader: asyncio.StreamReader, writer: asyncio.StreamWriter, dist: Path, preferences: PreferencesFile,
) -> None:
    """Handle one bounded request, always closing the connection."""
    try:
        async with asyncio.timeout(5):
            extra_headers = ""
            try:
                header = await reader.readuntil(b"\r\n\r\n")
                request_line, *field_lines = header.decode("ascii").split("\r\n")
                method, target, version = request_line.split()
                if version not in ("HTTP/1.0", "HTTP/1.1"):
                    raise ValueError("Unsupported HTTP version")
                path = unquote(urlsplit(target).path, errors="strict")
                if not path.startswith("/") or "\x00" in path or "\\" in path or ":" in path:
                    raise ValueError("Invalid path")
                headers = {
                    name.strip().lower(): value.strip()
                    for name, _, value in (line.partition(":") for line in field_lines if line)
                }
            except (ValueError, UnicodeError, asyncio.IncompleteReadError, asyncio.LimitOverrunError):
                status, body, content_type = "400 Bad Request", b"Bad request\n", "text/plain"
                method = "GET"
            else:
                if path == PREFERENCES_PATH:
                    own_port = writer.get_extra_info("sockname")[1]
                    status, body = await _preferences(method, headers, reader, own_port, preferences)
                    content_type = "application/json"
                    extra_headers = "Cache-Control: no-store\r\n"
                else:
                    status, body, content_type = await _static(method, path, dist)
            response = (
                f"HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\n"
                f"Content-Length: {len(body)}\r\nConnection: close\r\n"
                f"X-Content-Type-Options: nosniff\r\n{extra_headers}\r\n"
            ).encode("ascii")
            writer.write(response + (b"" if method == "HEAD" else body))
            await writer.drain()
    except (OSError, TimeoutError, asyncio.IncompleteReadError):
        logger.debug("HTTP client disconnected or timed out")
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except OSError:
            pass


@asynccontextmanager
async def serve_page(
    *, dist: Path = WEB_DIST, port: int = HTTP_PORT, preferences: PreferencesFile | None = None,
):
    """Bind only 127.0.0.1; port=0 allows isolated public HTTP tests."""
    store = PreferencesFile() if preferences is None else preferences
    async with await asyncio.start_server(
        lambda reader, writer: _respond(reader, writer, dist, store), HTTP_HOST, port, limit=16384,
    ) as server:
        yield server
