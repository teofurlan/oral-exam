"""Application service for agent mode: Socra drives an agent by voice.

In exam mode the MCP client drives Socra. Here it is the other way around:
the page sends dictated turns, this service forwards them to the selected
AgentBackend, streams the reply back to the page and speaks the final answer.
Tool calls the backend wants approved are shown on the page as Allow / Deny.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from socra_server.adapters.whisper_stt import is_valid_answer
from socra_server.agent_registry import BackendRegistry, UnknownSelection
from socra_server.app import get_wav_duration
from socra_server.domain.agent import (
    AgentError,
    AgentSelection,
    PermissionRequest,
    ReplyDone,
    TextDelta,
    ToolActivity,
)
from socra_server.domain.speakable import speakable_text
from socra_server.ports import AgentConversation

logger = logging.getLogger(__name__)

FolderPicker = Callable[[], str | None]
PLAYBACK_GRACE_S = 2.0


class AgentApp:
    def __init__(
        self,
        *,
        channel: Any,
        registry: BackendRegistry,
        loader: Any,
        folder_picker: FolderPicker,
    ) -> None:
        self.channel = channel
        self.registry = registry
        self.loader = loader
        self._folder_picker = folder_picker
        self._conversation: AgentConversation | None = None
        # What the page needs to resync after a reconnect; None without a conversation.
        self._session: dict[str, str] | None = None
        self._pending: dict[str, asyncio.Future[bool]] = {}
        self._start_task: asyncio.Task | None = None
        self._start_generation = 0
        self._queued_turn: str | None = None
        self._playback_done = asyncio.Event()
        self.turn_task: asyncio.Task | None = None
        self.acknowledged_clips = 0

    # ------------------------------------------------------------------ #
    # Page -> server                                                       #
    # ------------------------------------------------------------------ #

    async def handle_hello(self) -> None:
        infos = await self.registry.describe()
        default = self.registry.default_selection()
        await self.channel.send({
            "type": "agent_backends",
            "backends": [
                {
                    "id": info.id,
                    "label": info.label,
                    "models": [{"id": m.id, "label": m.label} for m in info.models],
                    "status": {"state": info.status.state, "message": info.status.message},
                }
                for info in infos
            ],
            "default": (
                {"backend": default.backend, "model": default.model} if default else None
            ),
            "session": self._session,
        })

    async def handle_pick_folder(self) -> None:
        path = await asyncio.to_thread(self._folder_picker)
        await self.channel.send({"type": "agent_folder", "path": path or None})

    async def handle_start(self, backend_id: str, model: str, cwd: str) -> None:
        folder = Path(cwd)
        if not folder.is_dir():
            await self._error(f"Folder not found: {cwd}")
            return
        try:
            backend = self.registry.resolve(AgentSelection(backend_id, model))
        except UnknownSelection as exc:
            await self._error(str(exc))
            return
        await self._cancel_turn()
        await self._cancel_start()
        await self._close_conversation()
        self._session = {"backend": backend_id, "model": model, "cwd": str(folder)}
        await self.channel.send({"type": "agent_started", **self._session})
        await self._state("idle")
        self._start_generation += 1
        generation = self._start_generation
        self._start_task = asyncio.create_task(
            self._open_start(backend, backend_id, model, folder, generation),
            name="agent-start",
        )
        # Let the owned task begin without waiting for backend.open to finish.
        await asyncio.sleep(0)

    async def handle_turn_text(self, text: str) -> None:
        if not text.strip():
            return
        if await self._can_take_turn():
            if self._conversation is None and self._startup_pending:
                self._queued_turn = text
                await self._state("thinking")
            elif self._conversation is None:
                await self._error("Choose a folder and start the agent first.")
            else:
                self._start_turn(text)

    async def handle_turn_audio(self, b64_data: str) -> None:
        if not await self._can_take_turn():
            return
        starting = self._conversation is None
        try:
            wav_bytes = base64.b64decode(b64_data, validate=True)
        except (binascii.Error, ValueError):
            await self._error("Could not read the recorded audio.")
            await self._state("listening")
            return
        try:
            await self.loader.ready()
            text = await asyncio.to_thread(
                self.loader.stt.transcribe_with_glossary, wav_bytes, None
            )
        except Exception as exc:
            logger.error("Agent turn transcription failed: %s", exc)
            await self._error("Could not transcribe the audio. Please try again.")
            await self._state("listening")
            return
        if not text or not is_valid_answer(text):
            await self.channel.send({"type": "notice", "text": "Didn't catch that. Please say it again."})
            await self._state("listening")
            return
        if self._turn_running or self._queued_turn is not None:
            await self.channel.send({
                "type": "notice", "text": "Wait for the current reply or interrupt it.",
            })
            return
        await self.channel.send({"type": "transcript", "text": text, "final": True})
        if self._conversation is None and starting and self._startup_pending:
            self._queued_turn = text
            await self._state("thinking")
        elif self._conversation is None:
            await self._error("The agent is not ready. Please start it again.")
        elif self._conversation is not None:
            self._start_turn(text)

    async def handle_permission_response(self, request_id: str, allow: Any) -> None:
        future = self._pending.get(request_id)
        if future is not None and not future.done():
            future.set_result(allow is True)

    async def handle_interrupt(self) -> None:
        if self._start_task is not None and not self._start_task.done():
            await self._cancel_start()
            await self._close_conversation()
            await self.handle_hello()
            await self._state("idle")
            return
        if self._conversation is not None and self._turn_running:
            await self._conversation.interrupt()

    def handle_playback_done(self) -> None:
        self.acknowledged_clips += 1
        self._playback_done.set()

    async def handle_disconnect(self) -> None:
        # Nobody is left to answer: every open request becomes a denial.
        for future in self._pending.values():
            if not future.done():
                future.set_result(False)

    async def shutdown(self) -> None:
        await self.handle_disconnect()
        await self._cancel_start()
        await self._cancel_turn()
        await self._close_conversation()

    # ------------------------------------------------------------------ #
    # Turns                                                                #
    # ------------------------------------------------------------------ #

    @property
    def _turn_running(self) -> bool:
        return self.turn_task is not None and not self.turn_task.done()

    @property
    def _startup_pending(self) -> bool:
        return self._start_task is not None and not self._start_task.done()

    async def _can_take_turn(self) -> bool:
        starting = self._startup_pending
        if self._conversation is None and not starting:
            await self._error("Choose a folder and start the agent first.")
            return False
        if self._turn_running or self._queued_turn is not None:
            await self.channel.send({
                "type": "notice", "text": "Wait for the current reply or interrupt it.",
            })
            return False
        return True

    async def _open_start(self, backend, backend_id: str, model: str, folder: Path, generation: int) -> None:
        try:
            conversation = await backend.open(model, folder, self._decide_permission)
        except asyncio.CancelledError:
            return
        except Exception as exc:
            if generation != self._start_generation:
                return
            logger.error("Could not start %s: %s", backend_id, exc)
            self._session = None
            self._queued_turn = None
            await self._error(f"Could not start {backend.label}: {exc}")
            await self.handle_hello()
            await self._state("idle")
            return
        if generation != self._start_generation:
            try:
                await conversation.close()
            except Exception as exc:
                logger.warning("Closing a stale agent conversation failed: %s", exc)
            return
        self._conversation = conversation
        queued_turn, self._queued_turn = self._queued_turn, None
        if queued_turn is not None:
            self._start_turn(queued_turn)
        else:
            await self._state("listening")

    async def _cancel_start(self) -> None:
        self._start_generation += 1
        self._queued_turn = None
        task, self._start_task = self._start_task, None
        if task is not None and not task.done():
            task.cancel()

    def _start_turn(self, text: str) -> None:
        self.turn_task = asyncio.create_task(self._run_turn(text), name="agent-turn")

    async def _cancel_turn(self) -> None:
        """Stop a running turn before its conversation goes away."""
        task = self.turn_task
        if task is None or task.done():
            return
        if self._conversation is not None:
            try:
                await self._conversation.interrupt()
            except Exception as exc:
                logger.warning("Interrupting the agent turn failed: %s", exc)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def _run_turn(self, text: str) -> None:
        conversation = self._conversation
        assert conversation is not None
        await self._state("thinking")
        try:
            async for event in conversation.send(text):
                if isinstance(event, TextDelta):
                    await self.channel.send({"type": "agent_text", "text": event.text})
                elif isinstance(event, ToolActivity):
                    await self.channel.send({
                        "type": "agent_tool", "tool": event.tool, "summary": event.summary,
                    })
                elif isinstance(event, ReplyDone):
                    await self.channel.send({"type": "agent_reply", "text": event.text})
                    spoken = speakable_text(event.text)
                    if spoken:
                        await self._state("speaking")
                        await self._speak(spoken)
                elif isinstance(event, AgentError):
                    await self._error(event.message)
        except Exception as exc:
            logger.exception("Agent turn failed")
            await self._error(f"The agent turn failed: {exc}")
        finally:
            await self._state("listening")

    async def _decide_permission(self, request: PermissionRequest) -> bool:
        if not self.channel.is_connected:
            return False
        future: asyncio.Future[bool] = asyncio.get_running_loop().create_future()
        self._pending[request.request_id] = future
        try:
            await self.channel.send({
                "type": "permission_request",
                "id": request.request_id,
                "tool": request.tool,
                "title": request.title,
                "detail": request.detail,
            })
            return await future
        except asyncio.CancelledError:
            # The turn was interrupted or restarted: take the prompt off the page.
            await self.channel.send({"type": "permission_closed", "id": request.request_id})
            raise
        finally:
            self._pending.pop(request.request_id, None)

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    async def _speak(self, text: str) -> None:
        await self.loader.ready()
        wav = await asyncio.to_thread(self.loader.tts.synthesize, text)
        self._playback_done.clear()
        await self.channel.send({
            "type": "tts_audio", "format": "wav", "data": base64.b64encode(wav).decode(),
        })
        try:
            await asyncio.wait_for(
                self._playback_done.wait(), timeout=get_wav_duration(wav) + PLAYBACK_GRACE_S
            )
        except TimeoutError:
            logger.warning("Agent reply playback wait timed out")

    async def _close_conversation(self) -> None:
        conversation, self._conversation = self._conversation, None
        self._session = None
        if conversation is not None:
            try:
                await conversation.close()
            except Exception as exc:
                logger.warning("Closing the agent conversation failed: %s", exc)

    async def _state(self, state: str) -> None:
        await self.channel.send({"type": "state", "state": state})

    async def _error(self, message: str) -> None:
        await self.channel.send({"type": "agent_error", "message": message})
