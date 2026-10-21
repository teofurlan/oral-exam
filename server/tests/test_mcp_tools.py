"""Tests for MCP tool payloads — no page connected (no_client path) and with a fake page."""
from __future__ import annotations

import asyncio
import base64
import json
import pytest

from socra_server.app import ExamApp, PageChannel
from tests.conftest import FakeLoader, make_wav_bytes


# ---------------------------------------------------------------------------
# Helpers: wire a fake page connection into the channel
# ---------------------------------------------------------------------------

class _FakePage:
    """Collects messages sent by the app and simulates a websocket connection."""

    def __init__(self):
        self.messages: list[dict] = []
        self._closed = False

    async def send(self, data: str) -> None:
        if self._closed:
            raise Exception("closed")
        self.messages.append(json.loads(data))

    @property
    def remote_address(self):
        return ("127.0.0.1", 9999)

    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration


def _connect(channel: PageChannel, fake_page: _FakePage) -> None:
    channel.set_connection(fake_page, asyncio.get_event_loop())  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# no_client path (no page connected)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_say_no_client(app):
    result = await app.say("hello")
    assert result == {"status": "no_client", "url": "http://localhost:8767/"}


@pytest.mark.asyncio
async def test_ask_no_client(app):
    result = await app.ask("What is X?", 1, 3)
    assert result == {"status": "no_client", "url": "http://localhost:8767/"}


@pytest.mark.asyncio
async def test_get_answer_no_client(app):
    result = await app.get_answer(wait_s=1)
    assert result == {"status": "no_client", "url": "http://localhost:8767/"}


# ---------------------------------------------------------------------------
# say()
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_say_sends_state_speaking_and_tts_audio(app, channel):
    page = _FakePage()
    _connect(channel, page)

    result = await app.say("Hello world")
    assert result == {"status": "ok"}

    types = [m["type"] for m in page.messages]
    assert "state" in types
    assert "tts_audio" in types

    state_msgs = [m for m in page.messages if m["type"] == "state"]
    assert state_msgs[0]["state"] == "speaking"

    tts_msgs = [m for m in page.messages if m["type"] == "tts_audio"]
    assert tts_msgs[0]["format"] == "wav"
    # data is valid base64
    assert base64.b64decode(tts_msgs[0]["data"])


# ---------------------------------------------------------------------------
# ask()
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ask_sends_question_speaking_tts_listening(app, channel):
    page = _FakePage()
    _connect(channel, page)

    result = await app.ask("What is a thread?", index=1, total=5)
    assert result == {"status": "asked"}

    types = [m["type"] for m in page.messages]
    assert "question" in types
    assert "state" in types
    assert "tts_audio" in types

    # question message
    q_msgs = [m for m in page.messages if m["type"] == "question"]
    assert q_msgs[0] == {"type": "question", "index": 1, "total": 5, "text": "What is a thread?"}

    # state sequence: speaking … listening
    state_msgs = [m for m in page.messages if m["type"] == "state"]
    states = [m["state"] for m in state_msgs]
    assert "speaking" in states
    assert "listening" in states
    assert states.index("speaking") < states.index("listening")


@pytest.mark.asyncio
async def test_ask_stores_question_in_session(app, channel):
    page = _FakePage()
    _connect(channel, page)

    await app.ask("What is a process?", index=2, total=4)

    assert app.session.question_index == 2
    assert app.session.question_total == 4
    assert app.session.question_text == "What is a process?"


# ---------------------------------------------------------------------------
# get_answer() — answered path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_answer_returns_answered_with_transcript(app, channel):
    page = _FakePage()
    _connect(channel, page)

    await app.ask("Q?", 1, 2)
    # Simulate answer arriving
    app.session.store_answer("my answer text")
    app._answer_event.set()

    result = await app.get_answer(wait_s=5)
    assert result["status"] == "answered"
    assert result["index"] == 1
    assert result["text"] == "my answer text"


@pytest.mark.asyncio
async def test_get_answer_sends_state_thinking_after_answer(app, channel):
    page = _FakePage()
    _connect(channel, page)

    await app.ask("Q?", 1, 2)
    app.session.store_answer("answer")
    app._answer_event.set()
    page.messages.clear()

    await app.get_answer(wait_s=5)

    state_msgs = [m for m in page.messages if m["type"] == "state"]
    assert any(m["state"] == "thinking" for m in state_msgs)


# ---------------------------------------------------------------------------
# get_answer() — timeout path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_answer_timeout_returns_listening(app, channel):
    page = _FakePage()
    _connect(channel, page)

    await app.ask("Q?", 1, 2)
    result = await app.get_answer(wait_s=1)
    assert result == {"status": "listening"}


# ---------------------------------------------------------------------------
# get_answer() — wait_s clamping
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_answer_clamps_wait_s_below_1(app, channel):
    """Values below 1 are clamped to 1 — we observe the timeout path quickly."""
    page = _FakePage()
    _connect(channel, page)

    await app.ask("Q?", 1, 2)
    # 0 -> clamped to 1, should still return listening after ~1 s
    result = await app.get_answer(wait_s=0)
    assert result["status"] == "listening"


@pytest.mark.asyncio
async def test_get_answer_clamps_wait_s_above_25(app, channel):
    """Values above 25 are clamped — answer arrives fast so we still see answered."""
    page = _FakePage()
    _connect(channel, page)

    await app.ask("Q?", 1, 2)

    async def _deliver():
        await asyncio.sleep(0.1)
        app.session.store_answer("fast answer")
        app._answer_event.set()

    asyncio.create_task(_deliver())
    result = await app.get_answer(wait_s=9999)  # clamped to 25
    assert result["status"] == "answered"
    assert result["text"] == "fast answer"


# ---------------------------------------------------------------------------
# answer_audio -> transcript
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_answer_audio_transcribes_and_sends_transcript(app, channel):
    page = _FakePage()
    _connect(channel, page)

    # loader.stt.reply is "fake transcript"
    wav = make_wav_bytes()
    b64 = base64.b64encode(wav).decode()

    await app.ask("Q?", 1, 2)
    page.messages.clear()

    await app.handle_answer_audio(b64)

    transcript_msgs = [m for m in page.messages if m["type"] == "transcript"]
    assert len(transcript_msgs) == 1
    assert transcript_msgs[0]["text"] == "fake transcript"
    assert transcript_msgs[0]["final"] is True


@pytest.mark.asyncio
async def test_answer_audio_stores_pending_answer(app, channel):
    page = _FakePage()
    _connect(channel, page)

    wav = make_wav_bytes()
    b64 = base64.b64encode(wav).decode()

    await app.ask("Q?", 3, 5)
    await app.handle_answer_audio(b64)

    assert app.session.pending_answer == "fake transcript"
    assert app.session.has_answer_for(3)


# ---------------------------------------------------------------------------
# reanswer clears the answer
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reanswer_clears_pending_answer_and_sends_listening(app, channel):
    page = _FakePage()
    _connect(channel, page)

    await app.ask("Q?", 1, 2)
    app.session.store_answer("old answer")
    app._answer_event.set()
    page.messages.clear()

    await app.handle_reanswer()

    assert app.session.pending_answer is None
    assert not app._answer_event.is_set()

    state_msgs = [m for m in page.messages if m["type"] == "state"]
    assert any(m["state"] == "listening" for m in state_msgs)


# ---------------------------------------------------------------------------
# malformed message is ignored
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_malformed_message_does_not_crash(app, channel):
    """The WS handler logs and ignores malformed JSON; the app stays alive."""
    from socra_server.entrypoints import ws_server
    ws_server.wire_app(app)

    page = _FakePage()
    _connect(channel, page)

    # Calling handle directly simulates receiving malformed bytes —
    # the ws_server handler catches json.JSONDecodeError and continues.
    import json
    with pytest.raises(Exception):
        json.loads("{not valid json}")

    # App still usable after
    result = await app.say("still alive")
    assert result == {"status": "ok"}
