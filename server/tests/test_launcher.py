"""Desktop launcher: the shortcut script and running without a console (pythonw)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from socra_server import __main__ as main_mod

SERVER_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SERVER_DIR / "install-shortcut.ps1"
windows_only = pytest.mark.skipif(sys.platform != "win32", reason="Windows shortcut")


def test_missing_console_streams_go_to_a_log_file(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "stdout", None)
    monkeypatch.setattr(sys, "stderr", None)

    main_mod._ensure_streams(tmp_path)
    print("hello from pythonw")
    sys.stderr.write("progress bar\n")
    sys.stdout.flush()

    log = (tmp_path / "socra-agent.log").read_text(encoding="utf-8")
    assert "hello from pythonw" in log and "progress bar" in log


def test_console_streams_are_left_alone(monkeypatch, tmp_path):
    stdout, stderr = sys.stdout, sys.stderr

    main_mod._ensure_streams(tmp_path)

    assert sys.stdout is stdout and sys.stderr is stderr
    assert not (tmp_path / "socra-agent.log").exists()


def _powershell(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCRIPT), *args],
        capture_output=True, text=True, timeout=60,
    )


def _read_shortcut(path: Path) -> dict[str, str]:
    script = (
        f"$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{path}'); "
        "Write-Output $s.TargetPath; Write-Output $s.Arguments; Write-Output $s.WorkingDirectory"
    )
    out = subprocess.run(
        ["powershell", "-NoProfile", "-Command", script], capture_output=True, text=True, timeout=60
    ).stdout.splitlines()
    return {"target": out[0], "arguments": out[1], "workdir": out[2]}


@windows_only
def test_shortcut_starts_agent_mode_without_a_console(tmp_path):
    result = _powershell("-Destination", str(tmp_path))

    assert result.returncode == 0, result.stderr
    shortcut = _read_shortcut(tmp_path / "Socra.lnk")
    assert Path(shortcut["target"]) == SERVER_DIR / ".venv" / "Scripts" / "pythonw.exe"
    assert shortcut["arguments"] == "-m socra_server --agent"
    assert Path(shortcut["workdir"]) == SERVER_DIR


@windows_only
def test_shortcut_can_be_removed(tmp_path):
    assert _powershell("-Destination", str(tmp_path)).returncode == 0

    result = _powershell("-Destination", str(tmp_path), "-Remove")

    assert result.returncode == 0, result.stderr
    assert not (tmp_path / "Socra.lnk").exists()
