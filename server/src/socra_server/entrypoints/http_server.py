"""Serve the built exam page on loopback in the application's asyncio loop."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import logging
import mimetypes
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

logger = logging.getLogger(__name__)

HTTP_HOST = "127.0.0.1"
HTTP_PORT = int(os.environ.get("SOCRA_HTTP_PORT", "8767"))
PAGE_URL = f"http://localhost:{HTTP_PORT}/"
AGENT_PAGE_URL = f"{PAGE_URL}?mode=agent"
WEB_DIST = Path(__file__).resolve().parents[4] / "web" / "dist"


async def _respond(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, dist: Path) -> None:
    """Handle one bounded GET/HEAD request, always closing the connection."""
    try:
        async with asyncio.timeout(5):
            try:
                header = await reader.readuntil(b"\r\n\r\n")
                method, target, version = header.split(b"\r\n", 1)[0].decode("ascii").split()
                if version not in ("HTTP/1.0", "HTTP/1.1"):
                    raise ValueError("Unsupported HTTP version")
                path = unquote(urlsplit(target).path, errors="strict")
                if not path.startswith("/") or "\x00" in path or "\\" in path or ":" in path:
                    raise ValueError("Invalid path")
            except (ValueError, UnicodeError, asyncio.IncompleteReadError, asyncio.LimitOverrunError):
                status, body, content_type = "400 Bad Request", b"Bad request\n", "text/plain"
                method = "GET"
            else:
                root = dist.resolve()
                candidate = (root / path.lstrip("/")).resolve()
                if method not in ("GET", "HEAD"):
                    status, body, content_type = "405 Method Not Allowed", b"Method not allowed\n", "text/plain"
                elif not candidate.is_relative_to(root):
                    status, body, content_type = "403 Forbidden", b"Forbidden\n", "text/plain"
                else:
                    if not candidate.is_file():
                        candidate = (root / "index.html").resolve()
                    if not candidate.is_relative_to(root):
                        status, body, content_type = "403 Forbidden", b"Forbidden\n", "text/plain"
                    else:
                        try:
                            body = await asyncio.to_thread(candidate.read_bytes)
                        except OSError:
                            status, body, content_type = (
                                "404 Not Found", b"Build the page: run pnpm -C web build\n", "text/plain",
                            )
                        else:
                            status = "200 OK"
                            content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
            response = (
                f"HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\n"
                f"Content-Length: {len(body)}\r\nConnection: close\r\n"
                "X-Content-Type-Options: nosniff\r\n\r\n"
            ).encode("ascii")
            writer.write(response + (b"" if method == "HEAD" else body))
            await writer.drain()
    except (OSError, TimeoutError):
        logger.debug("HTTP client disconnected or timed out")
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except OSError:
            pass


@asynccontextmanager
async def serve_page(*, dist: Path = WEB_DIST, port: int = HTTP_PORT):
    """Bind only 127.0.0.1; port=0 allows isolated public HTTP tests."""
    async with await asyncio.start_server(
        lambda reader, writer: _respond(reader, writer, dist), HTTP_HOST, port, limit=16384,
    ) as server:
        yield server


async def serve_forever() -> None:
    """Serve web/dist until cancelled alongside MCP and WebSocket tasks."""
    async with serve_page() as server:
        logger.debug("Exam page ready on %s", PAGE_URL)
        await server.serve_forever()
