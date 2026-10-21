"""MCP tool entrypoint — exposes say, ask, get_answer via FastMCP over stdio.

stdout is reserved for JSON-RPC; all logging goes to stderr.
"""
from __future__ import annotations

import logging
import sys
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from mcp import types as mcp_types

# All logging to stderr only — stdout belongs to the JSON-RPC transport
logging.basicConfig(stream=sys.stderr, level=logging.DEBUG, format="%(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# The global ExamApp instance is injected by __main__ before the server starts
_app = None  # type: ignore[assignment]


def get_app():
    """Return the shared ExamApp; raises if not yet wired."""
    if _app is None:
        raise RuntimeError("ExamApp not wired — call wire_app() first")
    return _app


def wire_app(app) -> None:
    """Wire the shared ExamApp into this entrypoint."""
    global _app
    _app = app


def create_mcp() -> FastMCP:
    """Build and return the FastMCP instance with all tools registered."""
    mcp = FastMCP(
        "oral-exam-server",
        instructions=(
            "Local oral exam tools. "
            "Call say() to speak text, ask() to pose a question and begin listening, "
            "get_answer() to retrieve the user's spoken answer."
        ),
    )

    @mcp.tool()
    async def say(text: str) -> dict:
        """Speak text aloud through the page's TTS audio channel.

        Sends state:speaking + tts_audio to the page and returns immediately.
        Returns {"status": "ok"} or {"status": "no_client", "url": ...}.
        """
        return await get_app().say(text)

    @mcp.tool()
    async def ask(
        question: str,
        index: int,
        total: int,
        glossary: list[str] | None = None,
    ) -> dict:
        """Pose a question to the user.

        Sends the question card, speaks it aloud, then moves to listening state.
        ``glossary`` is an optional list of domain-specific terms used as Whisper
        initial_prompt hints for this question's expected answer.

        Returns {"status": "asked"} or {"status": "no_client", "url": ...}.
        """
        return await get_app().ask(question, index, total, glossary)

    @mcp.tool()
    async def get_answer(wait_s: float = 20) -> dict:
        """Wait up to ``wait_s`` seconds (clamped 1–25) for the user's spoken answer.

        Returns:
          {"status": "answered", "index": n, "text": "<verbatim transcript>"}
          {"status": "listening"}   — timed out, no answer yet
          {"status": "no_client", "url": ...}
        """
        return await get_app().get_answer(wait_s)

    return mcp
