"""Entry point: starts the WebSocket server and the MCP stdio server in one asyncio loop."""
from __future__ import annotations

import asyncio
import logging
import os
import sys

import anyio
from mcp.server.stdio import stdio_server

from oral_exam_server.app import ExamApp, ModelLoader, PageChannel
from oral_exam_server.entrypoints import mcp_tools, ws_server

# All logging to stderr — stdout is the JSON-RPC transport
logging.basicConfig(
    stream=sys.stderr,
    level=logging.DEBUG,
    format="%(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


async def _amain(protocol_stdout) -> None:
    loop = asyncio.get_running_loop()

    channel = PageChannel()
    loader = ModelLoader()
    loader.attach_loop(loop)

    app = ExamApp(channel=channel, loader=loader)

    # Wire both entrypoints to the shared app
    mcp_tools.wire_app(app)
    ws_server.wire_app(app)

    # Build the MCP server
    mcp = mcp_tools.create_mcp()

    # Start model loading in background (non-blocking)
    loader.start()

    # Start WebSocket server as a background task
    ws_task = asyncio.create_task(ws_server.serve_forever(), name="ws-server")

    logger.debug("oral-exam-server started; MCP handshake available immediately")

    # Run MCP over stdio (blocks until the client disconnects / process exits)
    try:
        # Keep the wire separate from fd 1: native speech libraries may print.
        async with stdio_server(stdout=anyio.wrap_file(protocol_stdout)) as (reader, writer):
            await mcp._mcp_server.run(
                reader, writer, mcp._mcp_server.create_initialization_options()
            )
    finally:
        ws_task.cancel()
        try:
            await ws_task
        except asyncio.CancelledError:
            pass


def main() -> None:
    """Console script entry point."""
    sys.stdout.flush()
    with os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8") as protocol_stdout:
        # Redirect once for the process, not temporarily around worker threads:
        # a temporary redirect could divert concurrent JSON-RPC responses.
        os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
        if sys.platform == "win32":
            import ctypes
            import msvcrt

            ctypes.windll.kernel32.SetStdHandle(
                -11, ctypes.c_void_p(msvcrt.get_osfhandle(sys.stderr.fileno()))
            )
        asyncio.run(_amain(protocol_stdout))


if __name__ == "__main__":
    main()
