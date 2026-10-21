"""Readiness and connection replacement regressions."""
import asyncio
import json
import threading

import pytest

from oral_exam_server.app import ModelLoader, PageChannel


@pytest.mark.asyncio
async def test_readiness_is_awaited_and_loading_runs_off_loop(monkeypatch):
    loader = ModelLoader()
    loop = asyncio.get_running_loop()
    started = asyncio.Event()
    release = threading.Event()
    threads = []

    def load_tts():
        threads.append(threading.get_ident())
        loop.call_soon_threadsafe(started.set)
        assert release.wait(3)

    def load_stt():
        threads.append(threading.get_ident())

    monkeypatch.setattr(loader.tts, "load", load_tts)
    monkeypatch.setattr(loader.stt, "load", load_stt)
    loader.attach_loop(loop)
    loader.start()
    ready = asyncio.create_task(loader.ready())
    try:
        await asyncio.wait_for(started.wait(), 1)
        assert not ready.done()
    finally:
        release.set()
    await asyncio.wait_for(ready, 1)
    assert len(threads) == 2
    assert all(thread != threading.get_ident() for thread in threads)


@pytest.mark.asyncio
async def test_failure_sending_to_old_page_does_not_disconnect_replacement():
    entered = asyncio.Event()
    release = asyncio.Event()

    class OldPage:
        async def send(self, data):
            entered.set()
            await release.wait()
            raise ConnectionError("old page closed")

    messages = []

    class NewPage:
        async def send(self, data):
            messages.append(json.loads(data))

    channel = PageChannel()
    loop = asyncio.get_running_loop()
    channel.set_connection(OldPage(), loop)
    pending = asyncio.create_task(channel.send({"type": "state", "state": "speaking"}))
    await entered.wait()
    channel.set_connection(NewPage(), loop)
    release.set()
    await pending
    assert channel.is_connected
    await channel.send({"type": "state", "state": "listening"})
    assert messages == [{"type": "state", "state": "listening"}]
