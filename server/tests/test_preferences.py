"""Page preferences shared by every socra-server process (#27)."""
from __future__ import annotations

import asyncio
import json

import pytest

from socra_server.adapters.preferences_file import PreferencesFile, default_preferences_path
from socra_server.entrypoints.http_server import serve_page


def test_store_reads_empty_when_missing_or_corrupt(tmp_path):
    store = PreferencesFile(tmp_path / "prefs.json")
    assert store.read() == {}
    (tmp_path / "prefs.json").write_text("{not json")
    assert store.read() == {}


def test_store_merges_updates_and_null_deletes(tmp_path):
    path = tmp_path / "nested" / "prefs.json"
    store = PreferencesFile(path)
    assert store.update({"socra_voice": "alex", "oral_exam_turn_mode": "push-to-talk"}) == {
        "socra_voice": "alex", "oral_exam_turn_mode": "push-to-talk",
    }
    assert store.update({"socra_voice": "dora", "oral_exam_turn_mode": None}) == {"socra_voice": "dora"}
    # Another process reading the same file sees the change.
    assert PreferencesFile(path).read() == {"socra_voice": "dora"}


def test_default_path_follows_override(monkeypatch, tmp_path):
    monkeypatch.setenv("SOCRA_PREFERENCES_FILE", str(tmp_path / "p.json"))
    assert default_preferences_path() == tmp_path / "p.json"


async def _request(port, method, path, body=b"", headers=None):
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    try:
        fields = {"Host": f"localhost:{port}", "Content-Length": str(len(body)), **(headers or {})}
        lines = [f"{method} {path} HTTP/1.1"] + [f"{k}: {v}" for k, v in fields.items()]
        writer.write(("\r\n".join(lines) + "\r\n\r\n").encode() + body)
        await writer.drain()
        response = await reader.read()
        head, payload = response.split(b"\r\n\r\n", 1)
        return head.decode(), payload
    finally:
        writer.close()
        await writer.wait_closed()


@pytest.fixture
def dist(tmp_path):
    (tmp_path / "dist").mkdir()
    (tmp_path / "dist" / "index.html").write_text("page")
    return tmp_path / "dist"


@pytest.mark.asyncio
async def test_two_servers_share_preferences(dist, tmp_path):
    prefs = PreferencesFile(tmp_path / "prefs.json")
    async with serve_page(dist=dist, port=0, preferences=prefs) as first, \
            serve_page(dist=dist, port=0, preferences=PreferencesFile(tmp_path / "prefs.json")) as second:
        first_port = first.sockets[0].getsockname()[1]
        second_port = second.sockets[0].getsockname()[1]

        body = json.dumps({"socra_voice": "santa"}).encode()
        head, payload = await _request(first_port, "PUT", "/api/preferences", body, {
            "Content-Type": "application/json", "Origin": f"http://localhost:{first_port}",
        })
        assert head.startswith("HTTP/1.1 200"), head
        assert json.loads(payload) == {"socra_voice": "santa"}

        head, payload = await _request(second_port, "GET", "/api/preferences")
        assert head.startswith("HTTP/1.1 200")
        assert "application/json" in head
        assert "Cache-Control: no-store" in head
        assert json.loads(payload) == {"socra_voice": "santa"}


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", ["http://evil.example", "http://localhost:1"])
async def test_cross_origin_put_is_rejected(dist, tmp_path, origin):
    prefs = PreferencesFile(tmp_path / "prefs.json")
    async with serve_page(dist=dist, port=0, preferences=prefs) as server:
        port = server.sockets[0].getsockname()[1]
        head, _ = await _request(port, "PUT", "/api/preferences", b'{"socra_voice":"x"}', {
            "Content-Type": "application/json", "Origin": origin,
        })
        assert head.startswith("HTTP/1.1 403"), head
        assert prefs.read() == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [
    b"[1, 2]",
    b'{"socra_voice": 3}',
    b'{"Bad Key": "x"}',
    json.dumps({"socra_voice": "x" * 3000}).encode(),
    b"not json",
])
async def test_invalid_put_bodies_are_rejected(dist, tmp_path, body):
    prefs = PreferencesFile(tmp_path / "prefs.json")
    async with serve_page(dist=dist, port=0, preferences=prefs) as server:
        port = server.sockets[0].getsockname()[1]
        head, _ = await _request(port, "PUT", "/api/preferences", body, {
            "Content-Type": "application/json", "Origin": f"http://localhost:{port}",
        })
        assert head.startswith("HTTP/1.1 400"), head
        assert prefs.read() == {}


@pytest.mark.asyncio
async def test_oversized_put_is_rejected(dist, tmp_path):
    prefs = PreferencesFile(tmp_path / "prefs.json")
    async with serve_page(dist=dist, port=0, preferences=prefs) as server:
        port = server.sockets[0].getsockname()[1]
        head, _ = await _request(port, "PUT", "/api/preferences", b"{}", {
            "Content-Type": "application/json", "Origin": f"http://localhost:{port}",
            "Content-Length": "999999",
        })
        assert head.startswith("HTTP/1.1 413"), head


@pytest.mark.asyncio
async def test_put_to_static_paths_is_still_not_allowed(dist, tmp_path):
    async with serve_page(dist=dist, port=0, preferences=PreferencesFile(tmp_path / "p.json")) as server:
        port = server.sockets[0].getsockname()[1]
        head, _ = await _request(port, "PUT", "/index.html", b"{}", {"Origin": f"http://localhost:{port}"})
        assert head.startswith("HTTP/1.1 405"), head


# --- review follow-ups -------------------------------------------------------

def test_transient_read_failure_is_retried_and_keeps_other_keys(tmp_path, monkeypatch):
    path = tmp_path / "prefs.json"
    store = PreferencesFile(path)
    store.update({"socra_voice": "alex", "socra_theme": "dark"})
    real_read_text = type(path).read_text
    failures = iter([PermissionError("locked by another process")])

    def flaky_read_text(self, *args, **kwargs):
        error = next(failures, None)
        if error is not None:
            raise error
        return real_read_text(self, *args, **kwargs)

    monkeypatch.setattr(type(path), "read_text", flaky_read_text)
    assert store.update({"socra_voice": "dora"}) == {"socra_voice": "dora", "socra_theme": "dark"}


def test_update_refuses_to_write_when_the_file_stays_unreadable(tmp_path, monkeypatch):
    path = tmp_path / "prefs.json"
    store = PreferencesFile(path)
    store.update({"socra_voice": "alex", "socra_theme": "dark"})
    before = path.read_bytes()

    def locked(self, *args, **kwargs):
        raise PermissionError("locked by another process")

    monkeypatch.setattr(type(path), "read_text", locked)
    with pytest.raises(OSError):
        store.update({"socra_voice": "dora"})
    with pytest.raises(OSError):
        store.read()
    monkeypatch.undo()
    assert path.read_bytes() == before


def test_transient_replace_failure_is_retried(tmp_path, monkeypatch):
    import socra_server.adapters.preferences_file as module

    store = PreferencesFile(tmp_path / "prefs.json")
    real_replace = module.os.replace
    failures = iter([PermissionError("target open in another process")])

    def flaky_replace(src, dst):
        error = next(failures, None)
        if error is not None:
            raise error
        real_replace(src, dst)

    monkeypatch.setattr(module.os, "replace", flaky_replace)
    assert store.update({"socra_voice": "dora"}) == {"socra_voice": "dora"}
    assert PreferencesFile(tmp_path / "prefs.json").read() == {"socra_voice": "dora"}
    assert list(tmp_path.glob(".preferences-*")) == []


class BrokenStore:
    def read(self):
        raise PermissionError("locked")

    def update(self, changes):
        raise PermissionError("locked")


@pytest.mark.asyncio
async def test_store_failure_answers_503_and_logs_a_warning(dist, caplog):
    async with serve_page(dist=dist, port=0, preferences=BrokenStore()) as server:
        port = server.sockets[0].getsockname()[1]
        with caplog.at_level("WARNING", logger="socra_server.entrypoints.http_server"):
            head, payload = await _request(port, "GET", "/api/preferences")
            assert head.startswith("HTTP/1.1 503"), head
            head, payload = await _request(port, "PUT", "/api/preferences", b'{"socra_voice":"x"}', {
                "Content-Type": "application/json", "Origin": f"http://localhost:{port}",
            })
            assert head.startswith("HTTP/1.1 503"), head
            assert json.loads(payload) == {"error": "preferences unavailable"}
        assert sum("preferences" in r.getMessage().lower() for r in caplog.records) == 2


@pytest.mark.asyncio
async def test_deeply_nested_body_gets_400(dist, tmp_path):
    prefs = PreferencesFile(tmp_path / "prefs.json")
    body = b"[" * 8000 + b"]" * 8000
    async with serve_page(dist=dist, port=0, preferences=prefs) as server:
        port = server.sockets[0].getsockname()[1]
        head, _ = await _request(port, "PUT", "/api/preferences", body, {
            "Content-Type": "application/json", "Origin": f"http://localhost:{port}",
        })
        assert head.startswith("HTTP/1.1 400"), head
