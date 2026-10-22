"""Several MCP sessions each run socra-server: a busy port must not strand a session (#26)."""
from __future__ import annotations

import asyncio
import contextlib
import json
import re
import socket
from pathlib import Path
from unittest.mock import Mock
from urllib.parse import parse_qs, urlsplit

import pytest
from websockets.asyncio.client import connect

from socra_server import __main__ as main_mod
from socra_server.app import ExamApp, PageChannel
from socra_server.entrypoints import ws_server
from socra_server.entrypoints.http_server import page_url
from tests.conftest import FakeLoader, free_ports


@contextlib.contextmanager
def _held_port():
    """Hold a loopback port the way another socra-server process would."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen()
    try:
        yield sock.getsockname()[1]
    finally:
        sock.close()


def test_page_url_carries_the_ws_port_only_when_given():
    assert page_url(8767) == "http://localhost:8767/"
    assert page_url(51000, 51001) == "http://localhost:51000/?ws=51001"


@pytest.mark.asyncio
async def test_busy_ports_fall_back_and_the_page_reaches_this_process(tmp_path):
    (tmp_path / "index.html").write_text("<h1>Exam page</h1>")
    app = ExamApp(PageChannel(), FakeLoader(), web_dist=tmp_path, launcher=Mock())
    ws_server.wire_app(app)

    with _held_port() as busy_ws, _held_port() as busy_http:
        async with contextlib.AsyncExitStack() as stack:
            await main_mod.open_listeners(stack, app, ws_port=busy_ws, http_port=busy_http)

            url = urlsplit(app.page_url)
            http_port = url.port
            ws_port = int(parse_qs(url.query)["ws"][0])
            assert http_port != busy_http
            assert ws_port != busy_ws

            reader, writer = await asyncio.open_connection("127.0.0.1", http_port)
            writer.write(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
            await writer.drain()
            response = await reader.read()
            writer.close()
            assert b"200 OK" in response and b"Exam page" in response

            async with connect(f"ws://localhost:{ws_port}/ws") as page:
                json.loads(await page.recv())
                assert app.channel.is_connected
                assert await app.open_page() == {"status": "connected"}


@pytest.mark.asyncio
async def test_default_ws_port_is_left_out_of_the_page_url(tmp_path, monkeypatch):
    ws_port, http_port = free_ports(2)
    monkeypatch.setattr(ws_server, "PAGE_DEFAULT_WS_PORT", ws_port)
    app = ExamApp(PageChannel(), FakeLoader(), web_dist=tmp_path, launcher=Mock())

    async with contextlib.AsyncExitStack() as stack:
        await main_mod.open_listeners(stack, app, ws_port=ws_port, http_port=http_port)

        assert app.page_url == f"http://localhost:{http_port}/"


@pytest.mark.asyncio
async def test_open_page_launches_and_reports_this_process_page_url(tmp_path, monkeypatch):
    launcher = Mock()
    app = ExamApp(PageChannel(), FakeLoader(), web_dist=tmp_path, launcher=launcher)
    app.page_url = "http://localhost:51000/?ws=51001"
    monkeypatch.setattr("socra_server.app.OPEN_PAGE_TIMEOUT_S", 0.03)

    result = await app.open_page()

    assert result["status"] == "no_client"
    assert result["url"] == "http://localhost:51000/?ws=51001"
    launcher.assert_called_once_with("http://localhost:51000/?ws=51001")


@pytest.mark.asyncio
async def test_a_custom_ws_port_is_passed_to_the_page(tmp_path, monkeypatch):
    ws_port, http_port = free_ports(2)
    monkeypatch.setattr(ws_server, "WS_PORT", ws_port)
    app = ExamApp(PageChannel(), FakeLoader(), web_dist=tmp_path, launcher=Mock())

    async with contextlib.AsyncExitStack() as stack:
        await main_mod.open_listeners(stack, app)

        assert app.page_url.endswith(f"/?ws={ws_port}")


@pytest.mark.asyncio
async def test_a_listener_failure_leaves_the_mcp_tools_running(tmp_path, monkeypatch, caplog):
    def broken(**kwargs):
        raise RuntimeError("cannot serve")

    monkeypatch.setattr(ws_server, "serve_pages", broken)
    launcher = Mock()
    app = ExamApp(PageChannel(), FakeLoader(), web_dist=tmp_path, launcher=launcher)

    async with contextlib.AsyncExitStack() as stack:
        await main_mod.open_listeners(stack, app)

    assert "cannot serve" in caplog.text
    # Never the default URL: another Socra may serve it (#26).
    expected = {"status": "no_client", "error": "exam page servers failed to start; see the socra-server log"}
    assert await app.open_page() == expected
    assert await app.say("hello") == expected
    launcher.assert_not_called()


@pytest.mark.asyncio
async def test_the_default_launcher_opens_this_process_page_url(tmp_path, monkeypatch):
    from socra_server.adapters import browser

    opened: list[str] = []
    monkeypatch.setattr(browser.sys, "platform", "linux")
    monkeypatch.setattr(browser.webbrowser, "open", opened.append)
    app = ExamApp(PageChannel(), FakeLoader(), web_dist=tmp_path)
    app.page_url = "http://localhost:51000/?ws=51001"
    monkeypatch.setattr("socra_server.app.OPEN_PAGE_TIMEOUT_S", 0.03)

    await app.open_page()

    assert opened == ["http://localhost:51000/?ws=51001"]


def test_the_windows_launcher_opens_the_url_as_an_app_window(tmp_path, monkeypatch):
    from socra_server.adapters import browser

    edge = tmp_path / "Microsoft/Edge/Application/msedge.exe"
    edge.parent.mkdir(parents=True)
    edge.write_bytes(b"")
    launched: list[list[str]] = []
    monkeypatch.setattr(browser.sys, "platform", "win32")
    monkeypatch.setenv("ProgramFiles", str(tmp_path))
    monkeypatch.setattr(browser.subprocess, "Popen", lambda args, **kwargs: launched.append(args))

    browser.launch_page("http://localhost:51000/?ws=51001")

    assert launched == [[str(edge), "--app=http://localhost:51000/?ws=51001"]]


def test_server_and_page_agree_on_the_default_ws_port():
    source = (Path(__file__).resolve().parents[2] / "web/src/lib/socketUrl.ts").read_text(encoding="utf-8")
    match = re.search(r"export const DEFAULT_WS_PORT = (\d+)", source)
    assert match is not None
    assert int(match.group(1)) == ws_server.PAGE_DEFAULT_WS_PORT
