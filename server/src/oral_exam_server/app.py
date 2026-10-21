"""Application service: ties ExamSession + ports + PageChannel together.

This module is the coordination layer between the MCP tools and the WebSocket
page.  It holds no I/O of its own — the WebSocket server registers the page
connection here, and the MCP tools call the public methods.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import TYPE_CHECKING

from oral_exam_server.domain.session import ExamSession
from oral_exam_server.adapters.kokoro_tts import KokoroTTS
from oral_exam_server.adapters.whisper_stt import WhisperSTT

if TYPE_CHECKING:
    import websockets

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# PageChannel
# ---------------------------------------------------------------------------

class PageChannel:
    """One-at-a-time WebSocket channel to the exam page.

    A new connection replaces the old one (brief calls only).
    Thread-safe: ``set_connection`` may be called from the websocket handler
    (asyncio) while MCP tools await ``send``.
    """

    def __init__(self) -> None:
        self._ws: "websockets.ServerConnection | None" = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_connection(
        self,
        ws: "websockets.ServerConnection | None",
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        self._ws = ws
        self._loop = loop

    @property
    def is_connected(self) -> bool:
        return self._ws is not None

    async def send(self, message: dict) -> None:
        """Send a JSON message to the page.  No-op if no page is connected."""
        ws = self._ws
        if ws is None:
            return
        try:
            await ws.send(json.dumps(message))
        except Exception as exc:
            logger.error("PageChannel.send failed: %s", exc)
            if self._ws is ws:
                self._ws = None


# ---------------------------------------------------------------------------
# Model loader
# ---------------------------------------------------------------------------

class ModelLoader:
    """Loads Kokoro + Whisper models in a background thread.

    MCP tools call ``await ready()`` to block until loading is done.
    """

    def __init__(self) -> None:
        self.tts = KokoroTTS()
        self.stt = WhisperSTT()
        self._event = asyncio.Event()
        self._loaded = False
        self._task: asyncio.Task | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._error: Exception | None = None

    def start(self) -> None:
        """Start loading without blocking the MCP transport."""
        self._task = asyncio.create_task(asyncio.to_thread(self._load), name="model-loader")

    def _load(self) -> None:
        try:
            logger.debug("Loading Kokoro TTS…")
            self.tts.load()
            self.stt.set_base_terms(self.tts.glossary_terms)
            logger.debug("Loading Whisper STT…")
            self.stt.load()
            self._loaded = True
        except Exception as exc:
            self._error = exc
            logger.error("Model loading failed: %s", exc)
        finally:
            # Signal from the background thread: schedule set() on the event loop
            loop = self._loop
            if loop is not None and not loop.is_closed():
                loop.call_soon_threadsafe(self._event.set)

    async def ready(self) -> None:
        """Await until models are loaded (or failed)."""
        await self._event.wait()
        if self._error is not None:
            raise RuntimeError(f"Model loading failed: {self._error}") from self._error

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop


# ---------------------------------------------------------------------------
# Application service
# ---------------------------------------------------------------------------

class ExamApp:
    """Central application service used by both entrypoints."""

    def __init__(
        self,
        channel: PageChannel,
        loader: ModelLoader,
    ) -> None:
        self.channel = channel
        self.loader = loader
        self.session = ExamSession()
        # Event set when a final answer arrives; cleared at ask() / reanswer
        self._answer_event: asyncio.Event = asyncio.Event()
        self._answer_generation = 0
        self._glossary: list[str] | None = None
        self._stt_lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    async def _send_state(self, state: str) -> None:
        self.session.set_turn_state(state)  # type: ignore[arg-type]
        await self.channel.send({"type": "state", "state": state})

    async def _send_tts(self, text: str) -> None:
        """Synthesize text and push tts_audio to the page."""
        wav = await asyncio.to_thread(self.loader.tts.synthesize, text)
        b64 = base64.b64encode(wav).decode()
        await self.channel.send({"type": "tts_audio", "format": "wav", "data": b64})

    # ------------------------------------------------------------------ #
    # MCP tool implementations                                            #
    # ------------------------------------------------------------------ #

    async def say(self, text: str) -> dict:
        """Say text: send state speaking + tts_audio."""
        if not self.channel.is_connected:
            return {"status": "no_client", "url": "http://localhost:5180/"}
        await self.loader.ready()
        await self._send_state("speaking")
        await self._send_tts(text)
        return {"status": "ok"}

    async def ask(
        self,
        question: str,
        index: int,
        total: int,
        glossary: list[str] | None = None,
    ) -> dict:
        """Store question, send question + state speaking + tts_audio + state listening."""
        if not self.channel.is_connected:
            return {"status": "no_client", "url": "http://localhost:5180/"}
        await self.loader.ready()

        self.session.set_question(index, total, question)
        self._answer_generation += 1
        self._glossary = list(glossary) if glossary else None
        self._answer_event.clear()

        await self.channel.send(
            {"type": "question", "index": index, "total": total, "text": question}
        )
        await self._send_state("speaking")
        await self._send_tts(question)
        await self._send_state("listening")
        return {"status": "asked"}

    async def get_answer(self, wait_s: float = 20) -> dict:
        """Wait up to wait_s seconds for a final answer."""
        if not self.channel.is_connected:
            return {"status": "no_client", "url": "http://localhost:5180/"}

        # Clamp to [1, 25]
        wait_s = max(1.0, min(25.0, float(wait_s)))

        # Fast path: answer already present
        idx = self.session.question_index
        if self.session.has_answer_for(idx):
            text = self.session.pending_answer
            await self._send_state("thinking")
            return {"status": "answered", "index": idx, "text": text}

        # Wait for the event
        try:
            await asyncio.wait_for(self._answer_event.wait(), timeout=wait_s)
        except asyncio.TimeoutError:
            return {"status": "listening"}

        if self.session.has_answer_for(idx):
            text = self.session.pending_answer
            await self._send_state("thinking")
            return {"status": "answered", "index": idx, "text": text}

        return {"status": "listening"}

    # ------------------------------------------------------------------ #
    # Page → server message handlers                                       #
    # ------------------------------------------------------------------ #

    async def handle_answer_audio(self, b64_data: str, glossary: list[str] | None = None) -> None:
        """Transcribe incoming WAV, store as pending answer, push transcript to page."""
        generation = self._answer_generation
        page = self.channel._ws
        glossary = self._glossary if glossary is None else glossary
        wav_bytes = base64.b64decode(b64_data, validate=True)
        await self.loader.ready()
        async with self._stt_lock:
            if generation != self._answer_generation or page is not self.channel._ws:
                return
            text = await asyncio.to_thread(
                self.loader.stt.transcribe_with_glossary, wav_bytes, glossary
            )
        if generation != self._answer_generation or page is not self.channel._ws:
            return
        self.session.store_answer(text)
        await self.channel.send({"type": "transcript", "text": text, "final": True})
        self._answer_event.set()

    async def handle_reanswer(self) -> None:
        """Discard pending answer and move back to listening."""
        self._answer_generation += 1
        self.session.clear_answer()
        self._answer_event.clear()
        await self._send_state("listening")

    async def handle_mode(self, mode: str) -> None:
        """Store mode (informational)."""
        if mode in ("auto", "push-to-talk"):
            self.session.set_mode(mode)  # type: ignore[arg-type]
