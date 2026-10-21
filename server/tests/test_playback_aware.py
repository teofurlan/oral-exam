"""Tests for playback-aware speaking (T5 Change 2)."""
from __future__ import annotations

import asyncio
import time
import pytest

from socra_server.app import ExamApp, PageChannel, get_wav_duration
from tests.conftest import FakeLoader, make_wav_bytes


class _FakePage:
    def __init__(self):
        self.messages = []

    async def send(self, data: str):
        import json
        self.messages.append(json.loads(data))


def _connect(channel: PageChannel, page: _FakePage) -> None:
    loop = asyncio.get_running_loop()
    channel.set_connection(page, loop)  # type: ignore[arg-type]


def test_get_wav_duration():
    # 16000 samples at 16000 Hz = 1.0 second
    wav = make_wav_bytes(num_samples=16000, sample_rate=16000)
    assert abs(get_wav_duration(wav) - 1.0) < 0.05

    # 160 samples at 16000 Hz = 0.01 seconds
    wav_short = make_wav_bytes(num_samples=160, sample_rate=16000)
    assert abs(get_wav_duration(wav_short) - 0.01) < 0.005


@pytest.mark.asyncio
async def test_say_waits_for_playback_done():
    channel = PageChannel()
    loader = FakeLoader()
    app = ExamApp(channel=channel, loader=loader)
    page = _FakePage()
    _connect(channel, page)

    task = asyncio.create_task(app.say("Hello"))
    await asyncio.sleep(0.05)

    # Task should still be running because playback_done has not been sent
    assert not task.done()
    assert any(m.get("type") == "state" and m.get("state") == "speaking" for m in page.messages)
    assert any(m.get("type") == "tts_audio" for m in page.messages)

    # Send playback_done
    app.handle_playback_done()
    await asyncio.sleep(0.01)

    assert task.done()
    res = await task
    assert res == {"status": "ok"}


@pytest.mark.asyncio
async def test_say_times_out_at_duration_plus_2s(monkeypatch):
    channel = PageChannel()
    loader = FakeLoader()
    app = ExamApp(channel=channel, loader=loader)
    page = _FakePage()
    _connect(channel, page)

    # Duration 0.01s, timeout should be ~2.01s
    t0 = time.monotonic()
    res = await app.say("Hello timeout")
    elapsed = time.monotonic() - t0

    assert res == {"status": "ok"}
    # Elapsed should be at least ~2.0 seconds
    assert elapsed >= 1.95


@pytest.mark.asyncio
async def test_ask_does_not_send_listening_before_playback_done():
    channel = PageChannel()
    loader = FakeLoader()
    app = ExamApp(channel=channel, loader=loader)
    page = _FakePage()
    _connect(channel, page)

    task = asyncio.create_task(app.ask("What is process?", 1, 1))
    await asyncio.sleep(0.05)

    assert not task.done()
    # speaking sent, question sent, but NOT listening
    assert any(m.get("type") == "question" for m in page.messages)
    assert any(m.get("type") == "state" and m.get("state") == "speaking" for m in page.messages)
    assert not any(m.get("type") == "state" and m.get("state") == "listening" for m in page.messages)

    # Now signal playback_done
    app.handle_playback_done()
    await asyncio.sleep(0.01)

    assert task.done()
    res = await task
    assert res == {"status": "asked"}

    # Now listening must be sent
    listening_msgs = [m for m in page.messages if m.get("type") == "state" and m.get("state") == "listening"]
    assert len(listening_msgs) == 1
