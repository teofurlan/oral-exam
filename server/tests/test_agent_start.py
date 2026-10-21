"""Standalone agent start and the native folder dialog, without real windows."""
from __future__ import annotations

import asyncio
import sys
import types

import pytest

from socra_server import __main__ as main_mod
from socra_server.adapters import folder_dialog
from socra_server.entrypoints.http_server import AGENT_PAGE_URL, PAGE_URL


async def test_server_running_detects_a_listening_port():
    server = await asyncio.start_server(lambda r, w: w.close(), "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    try:
        assert await main_mod.server_running("127.0.0.1", port)
    finally:
        server.close()
        await server.wait_closed()

    assert not await main_mod.server_running("127.0.0.1", port)


async def test_standalone_only_opens_the_agent_page_when_socra_already_runs(monkeypatch):
    opened: list[str] = []

    async def running(host, port):
        return True

    def fail_build(loop):
        raise AssertionError("must not start a second server")

    monkeypatch.setattr(main_mod, "server_running", running)
    monkeypatch.setattr(main_mod, "_build_apps", fail_build)

    await main_mod._standalone(launch=opened.append)

    assert opened == [AGENT_PAGE_URL]


def test_agent_page_url_selects_agent_mode():
    assert AGENT_PAGE_URL == f"{PAGE_URL}?mode=agent"


def _fake_tkinter(monkeypatch, chosen: str):
    calls: dict = {}

    class FakeTk:
        def withdraw(self):
            calls["withdrawn"] = True

        def attributes(self, *args):
            calls["attributes"] = args

        def destroy(self):
            calls["destroyed"] = True

    def askdirectory(**kwargs):
        calls["kwargs"] = kwargs
        return chosen

    tk = types.ModuleType("tkinter")
    tk.Tk = FakeTk
    dialog = types.ModuleType("tkinter.filedialog")
    dialog.askdirectory = askdirectory
    tk.filedialog = dialog
    monkeypatch.setitem(sys.modules, "tkinter", tk)
    monkeypatch.setitem(sys.modules, "tkinter.filedialog", dialog)
    return calls


def test_folder_dialog_returns_a_native_path_on_top_of_other_windows(monkeypatch, tmp_path):
    calls = _fake_tkinter(monkeypatch, tmp_path.as_posix())

    assert folder_dialog.pick_folder() == str(tmp_path)
    assert calls["attributes"] == ("-topmost", True)
    assert calls["kwargs"]["mustexist"] is True
    assert calls["destroyed"]


@pytest.mark.parametrize("chosen", ["", ()])
def test_folder_dialog_cancel_returns_none(monkeypatch, chosen):
    calls = _fake_tkinter(monkeypatch, chosen)

    assert folder_dialog.pick_folder() is None
    assert calls["destroyed"]
