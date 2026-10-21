"""WebSocket protocol tests — real server bound to an ephemeral port, real WS client."""
from __future__ import annotations

import asyncio
import base64
import json
import pytest
import pytest_asyncio

from websockets.asyncio.server import serve, ServerConnection
from websockets.asyncio.client import connect

from socra_server.app import ExamApp, PageChannel
from socra_server.entrypoints import ws_server as ws_mod
from tests.conftest import FakeLoader, make_wav_bytes


# ---------------------------------------------------------------------------
# Fixture: spin up a real WS server on an ephemeral port for each test
# ---------------------------------------------------------------------------

class _AppBundle:
    def __init__(self, url: str, app: ExamApp, task: asyncio.Task):
        self.url = url
        self.app = app
        self._task = task

    async def aclose(self):
        self._task.cancel()
        try:
            await self._task
        except (asyncio.CancelledError, Exception):
            pass


@pytest_asyncio.fixture
async def ws_bundle():
    """Start a real WebSocket server on an ephemeral port; yield bundle; tear down."""
    channel = PageChannel()
    loader = FakeLoader()
    app = ExamApp(channel=channel, loader=loader)
    ws_mod.wire_app(app)

    started = asyncio.Event()
    url_holder: list[str] = []

    async def _serve():
        async with serve(
            ws_mod._handle,
            "127.0.0.1",
            0,  # ephemeral port
            process_request=ws_mod._check_path,
        ) as server:
            host, port = server.sockets[0].getsockname()[:2]
            url_holder.append(f"ws://{host}:{port}/ws")
            started.set()
            await asyncio.Future()

    task = asyncio.create_task(_serve())
    await started.wait()
    bundle = _AppBundle(url_holder[0], app, task)
    yield bundle
    await bundle.aclose()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _collect(ws, n: int, timeout: float = 3.0) -> list[dict]:
    """Collect n messages from the WS connection with a timeout."""
    msgs = []
    async with asyncio.timeout(timeout):
        while len(msgs) < n:
            raw = await ws.recv()
            msgs.append(json.loads(raw))
    return msgs


# ---------------------------------------------------------------------------
# Connection: idle state on connect
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_sends_idle_on_connect(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert msg == {"type": "state", "state": "idle"}


# ---------------------------------------------------------------------------
# say() — server sends state:speaking and tts_audio
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_say_delivers_speaking_and_tts_audio(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        await ws.recv()  # idle
        await ws_bundle.app.say("hello")
        msgs = await _collect(ws, 2)
        types = {m["type"] for m in msgs}
        assert "state" in types
        assert "tts_audio" in types
        state_m = next(m for m in msgs if m["type"] == "state")
        assert state_m["state"] == "speaking"
        tts_m = next(m for m in msgs if m["type"] == "tts_audio")
        assert tts_m["format"] == "wav"
        base64.b64decode(tts_m["data"])  # must be valid b64


# ---------------------------------------------------------------------------
# ask() — server sends question, state:speaking, tts_audio, state:listening
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_ask_delivers_question_and_listening(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        await ws.recv()  # idle
        await ws_bundle.app.ask("What is a thread?", index=1, total=3)
        msgs = await _collect(ws, 4)
        types = [m["type"] for m in msgs]
        assert "question" in types
        assert "tts_audio" in types
        states = [m["state"] for m in msgs if m["type"] == "state"]
        assert "speaking" in states
        assert "listening" in states
        assert states.index("speaking") < states.index("listening")
        q = next(m for m in msgs if m["type"] == "question")
        assert q["index"] == 1
        assert q["total"] == 3
        assert q["text"] == "What is a thread?"


# ---------------------------------------------------------------------------
# answer_audio -> transcript
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_answer_audio_sends_transcript(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        await ws.recv()  # idle
        await ws_bundle.app.ask("Q?", 1, 2)
        await _collect(ws, 4)  # question + state*2 + tts

        wav = make_wav_bytes()
        b64 = base64.b64encode(wav).decode()
        await ws.send(json.dumps({"type": "answer_audio", "format": "wav", "data": b64}))

        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        assert msg["type"] == "transcript"
        assert msg["final"] is True
        assert msg["text"] == "fake transcript"


# ---------------------------------------------------------------------------
# reanswer -> state:listening
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_reanswer_sends_listening(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        await ws.recv()  # idle
        await ws_bundle.app.ask("Q?", 1, 2)
        await _collect(ws, 4)

        # Plant an answer so reanswer has something to clear
        ws_bundle.app.session.store_answer("old")
        ws_bundle.app._answer_event.set()

        await ws.send(json.dumps({"type": "reanswer"}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert msg["type"] == "state"
        assert msg["state"] == "listening"
        assert ws_bundle.app.session.pending_answer is None


# ---------------------------------------------------------------------------
# mode message is stored
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_mode_message_stored(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        await ws.recv()  # idle
        await ws.send(json.dumps({"type": "mode", "mode": "push-to-talk"}))
        await asyncio.sleep(0.1)
        assert ws_bundle.app.session.mode == "push-to-talk"


# ---------------------------------------------------------------------------
# Malformed JSON is ignored — server does NOT close the connection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_malformed_json_ignored(ws_bundle):
    async with connect(ws_bundle.url) as ws:
        await ws.recv()  # idle

        # Send invalid JSON
        await ws.send("{not: valid json}")
        await asyncio.sleep(0.1)

        # Connection must still be alive — send a valid mode message
        await ws.send(json.dumps({"type": "mode", "mode": "auto"}))
        await asyncio.sleep(0.1)
        assert ws_bundle.app.session.mode == "auto"


# ---------------------------------------------------------------------------
# New connection replaces old one
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ws_new_connection_replaces_old(ws_bundle):
    async with connect(ws_bundle.url) as ws1:
        await ws1.recv()  # idle
        first_ws = ws_bundle.app.channel._ws
        assert first_ws is not None

    # ws1 closed; now open ws2
    await asyncio.sleep(0.05)

    async with connect(ws_bundle.url) as ws2:
        await ws2.recv()  # idle
        second_ws = ws_bundle.app.channel._ws
        assert second_ws is not None
        assert second_ws is not first_ws
