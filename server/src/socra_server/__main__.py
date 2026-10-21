"""Run MCP stdio, WebSocket, and loopback HTTP servers in one asyncio loop.

``socra-server --agent`` starts the same WebSocket and HTTP servers without
MCP stdio and opens the agent page; if Socra is already running (for example
as an exam MCP server), it only opens the page.
"""
from __future__ import annotations

import asyncio
from collections.abc import Callable
import logging
import os
import sys

import anyio
from mcp.server.stdio import stdio_server

from socra_server.adapters.browser import launch_page
from socra_server.adapters.claude_code_agent import ClaudeCodeBackend
from socra_server.adapters.folder_dialog import pick_folder
from socra_server.agent_app import AgentApp
from socra_server.agent_registry import BackendRegistry
from socra_server.app import ExamApp, ModelLoader, PageChannel
from socra_server.entrypoints import http_server, mcp_tools, ws_server

# All logging to stderr — stdout is the JSON-RPC transport
logging.basicConfig(
    stream=sys.stderr,
    level=logging.DEBUG,
    format="%(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


SERVER_PROBE_TIMEOUT_S = 0.5


def _build_apps(loop: asyncio.AbstractEventLoop) -> tuple[ExamApp, AgentApp, ModelLoader]:
    """Wire exam and agent mode to one model loader; each page has its own channel."""
    loader = ModelLoader()
    loader.attach_loop(loop)
    exam = ExamApp(channel=PageChannel(), loader=loader)
    agent = AgentApp(
        channel=PageChannel(),
        registry=BackendRegistry([ClaudeCodeBackend()]),
        loader=loader,
        folder_picker=pick_folder,
    )
    mcp_tools.wire_app(exam)
    ws_server.wire_app(exam)
    ws_server.wire_agent_app(agent)
    return exam, agent, loader


async def server_running(host: str, port: int) -> bool:
    """True when something already listens on the page port (another Socra)."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=SERVER_PROBE_TIMEOUT_S
        )
    except (OSError, TimeoutError):
        return False
    writer.close()
    try:
        await writer.wait_closed()
    except OSError:
        pass
    return True


async def _standalone(launch: Callable[[str], None] = launch_page) -> None:
    """Agent-mode start: reuse a running Socra, or run HTTP + WebSocket without MCP."""
    if await server_running(http_server.HTTP_HOST, http_server.HTTP_PORT):
        logger.info("Socra is already running; opening the agent page")
        await asyncio.to_thread(launch, http_server.AGENT_PAGE_URL)
        return
    _, agent, loader = _build_apps(asyncio.get_running_loop())
    loader.start()
    ws_task = asyncio.create_task(ws_server.serve_forever(), name="ws-server")
    try:
        async with http_server.serve_page() as server:
            await asyncio.to_thread(launch, http_server.AGENT_PAGE_URL)
            logger.info("Socra agent mode on %s", http_server.AGENT_PAGE_URL)
            await server.serve_forever()
    finally:
        ws_task.cancel()
        await asyncio.gather(ws_task, return_exceptions=True)
        await agent.shutdown()


async def _amain(protocol_stdout) -> None:
    loop = asyncio.get_running_loop()

    _, agent, loader = _build_apps(loop)

    # Build the MCP server
    mcp = mcp_tools.create_mcp()

    # Start model loading in background (non-blocking)
    loader.start()

    # Network listeners share the MCP loop; model loading never blocks them.
    network_tasks = [
        asyncio.create_task(ws_server.serve_forever(), name="ws-server"),
        asyncio.create_task(http_server.serve_forever(), name="http-server"),
    ]

    logger.debug("socra-server started; MCP handshake available immediately")

    # Run MCP over stdio (blocks until the client disconnects / process exits)
    try:
        # Keep the wire separate from fd 1: native speech libraries may print.
        async with stdio_server(stdout=anyio.wrap_file(protocol_stdout)) as (reader, writer):
            await mcp._mcp_server.run(
                reader, writer, mcp._mcp_server.create_initialization_options()
            )
    finally:
        for task in network_tasks:
            task.cancel()
        await asyncio.gather(*network_tasks, return_exceptions=True)
        await agent.shutdown()


def main() -> None:
    """Console script entry point."""
    if "--agent" in sys.argv[1:]:
        try:
            asyncio.run(_standalone())
        except KeyboardInterrupt:
            pass
        return
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
