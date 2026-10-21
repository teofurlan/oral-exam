"""WebSocket server entrypoint — serves ws://localhost:8766/ws.

Uses the modern websockets.asyncio API (websockets >= 14).
Binds to 127.0.0.1 only.  One page client at a time; a new connection
replaces the old one.  All logging goes to stderr.
"""
from __future__ import annotations

import asyncio
import json
import logging
import logging.handlers
import os
import sys
from pathlib import Path

from websockets.asyncio.server import serve, ServerConnection
from websockets.http11 import Request, Response

LOG_DIR = Path(__file__).resolve().parents[3] / "logs"
LOG_PATH = LOG_DIR / "socra.log"


def _setup_logger() -> logging.Logger:
    ws_logger = logging.getLogger("socra_server.entrypoints.ws_server")
    ws_logger.setLevel(logging.DEBUG)
    if not any(isinstance(h, logging.handlers.RotatingFileHandler) for h in ws_logger.handlers):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_PATH, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        ws_logger.addHandler(file_handler)
    if not any(
        isinstance(h, logging.StreamHandler)
        and not isinstance(h, logging.handlers.RotatingFileHandler)
        for h in ws_logger.handlers
    ):
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
        ws_logger.addHandler(stderr_handler)
    return ws_logger


logger = _setup_logger()

WS_HOST = "127.0.0.1"
WS_PORT = int(os.environ.get("SOCRA_WS_PORT", "8766"))
WS_PATH = "/ws"

# Injected by __main__
_app = None  # type: ignore[assignment]


def wire_app(app) -> None:
    global _app
    _app = app


def get_app():
    if _app is None:
        raise RuntimeError("ExamApp not wired — call wire_app() first")
    return _app


def _check_path(connection: ServerConnection, request: Request) -> Response | None:
    """Reject requests whose path is not /ws."""
    if request.path != WS_PATH:
        return connection.respond(404, "Not found\n")
    return None


async def _handle(ws: ServerConnection) -> None:
    """Handle a single page connection."""
    app = get_app()
    loop = asyncio.get_running_loop()

    # Publish the replacement before closing the old handler.
    old = app.channel._ws
    app.channel.set_connection(ws, loop)
    if old is not None and old is not ws and hasattr(old, "close"):
        try:
            await old.close(code=1000, reason="Replaced by a new page")
        except Exception:
            pass
    audio_tasks: set[asyncio.Task] = set()

    async def transcribe(data: str) -> None:
        try:
            await app.handle_answer_audio(data)
        except Exception as exc:
            logger.error("Error handling answer_audio: %s", exc)
    logger.info("Page connected: %s", ws.remote_address)

    # On a new page connection, resend the current question (with code) and current state (no audio replay).
    try:
        session = app.session
        if session.question_index > 0 and not app._finished:
            q_msg = {
                "type": "question",
                "index": session.question_index,
                "total": session.question_total,
                "text": session.question_text,
            }
            if session.question_code is not None:
                q_msg["code"] = session.question_code
            await ws.send(json.dumps(q_msg))
        await ws.send(json.dumps({"type": "state", "state": session.turn_state}))
    except Exception as exc:
        logger.error("Failed to send initial messages on connect: %s", exc)

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except Exception as exc:
                logger.error("Malformed WS message (ignored): %s — %r", exc, raw)
                continue

            if not isinstance(msg, dict):
                logger.warning("Malformed WS message (expected object): %r", msg)
                continue
            if app.channel._ws is not ws:
                break
            msg_type = msg.get("type")
            try:
                if msg_type == "answer_audio":
                    data = msg.get("data")
                    if msg.get("format") != "wav" or not isinstance(data, str) or not data:
                        logger.warning("Malformed answer_audio (expected base64 WAV)")
                        continue
                    task = asyncio.create_task(transcribe(data))
                    audio_tasks.add(task)
                    task.add_done_callback(audio_tasks.discard)
                    # Capture this turn before reading a following reanswer.
                    await asyncio.sleep(0)
                elif msg_type == "playback_done":
                    app.handle_playback_done()
                elif msg_type == "reanswer":
                    await app.handle_reanswer()
                elif msg_type == "mode":
                    await app.handle_mode(msg.get("mode", "auto"))
                else:
                    logger.warning("Unknown message type (ignored): %r", msg_type)
            except Exception as exc:
                logger.error("Error handling message %r: %s", msg_type, exc)
    except Exception:
        pass
    finally:
        # Clear the connection only if it's still this socket
        if app.channel._ws is ws:
            app.channel.set_connection(None, loop)
        if audio_tasks:
            await asyncio.gather(*audio_tasks)
        close_code = getattr(ws, "close_code", None)
        close_reason = getattr(ws, "close_reason", None) or ""
        logger.info(
            "Page disconnected: %s (code=%s, reason=%r)",
            ws.remote_address,
            close_code,
            close_reason,
        )


async def serve_forever(host: str = WS_HOST, port: int = WS_PORT) -> None:
    """Start the WebSocket server and run until cancelled."""
    logger.debug("WebSocket server starting on ws://%s:%d%s", host, port, WS_PATH)
    async with serve(
        _handle,
        host,
        port,
        process_request=_check_path,
        ping_interval=20,
        ping_timeout=60,
    ) as server:
        logger.debug("WebSocket server ready on ws://%s:%d%s", host, port, WS_PATH)
        await asyncio.Future()  # run forever


async def serve_on_port(
    host: str, port: int, started_event: asyncio.Event | None = None
) -> None:
    """Serve on an explicit host/port; optionally signal when ready (for tests)."""
    async with serve(_handle, host, port, process_request=_check_path) as server:
        if started_event is not None:
            started_event.set()
        await asyncio.Future()
