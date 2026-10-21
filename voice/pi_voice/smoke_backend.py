"""Real-synthesis smoke test for backend using --no-playback (no audible sound)."""
from pathlib import Path
import json
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
PYTHON = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"


def main():
    cmd = [
        str(PYTHON),
        "-B",
        "-u",
        "-X",
        "utf8",
        str(ROOT / "backend.py"),
        "--no-playback",
        "--runtime-dir",
        str(ROOT / "runtime" / "smoke"),
    ]

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        cwd=str(PROJECT_ROOT),
    )

    def read_line():
        line = proc.stdout.readline()
        if not line:
            err = proc.stderr.read()
            raise RuntimeError(f"Unexpected EOF from backend. Stderr: {err}")
        return json.loads(line.strip())

    try:
        # 1. Ready event
        ready = read_line()
        assert ready.get("event") == "ready", f"Expected ready, got {ready}"
        assert ready.get("profile", {}).get("language") == "es"

        # 2. Ping / Pong
        proc.stdin.write('{"op":"ping"}\n')
        proc.stdin.flush()
        pong = read_line()
        assert pong.get("event") == "pong", f"Expected pong, got {pong}"

        # 3. Real speech synthesis (without sound)
        proc.stdin.write(json.dumps({
            "op": "speak",
            "id": "smoke-test-1",
            "text": "Prueba de síntesis real con README y endpoint en inglés.",
        }) + "\n")
        proc.stdin.flush()

        accepted = read_line()
        assert accepted.get("event") == "accepted" and accepted.get("id") == "smoke-test-1"

        speaking = read_line()
        assert speaking.get("event") == "speaking" and speaking.get("id") == "smoke-test-1"

        idle = read_line()
        assert idle.get("event") == "idle" and idle.get("id") == "smoke-test-1"
        assert idle.get("duration_seconds", 0) > 0

        # 4. Stop command
        proc.stdin.write('{"op":"stop"}\n')
        proc.stdin.flush()
        stopped = read_line()
        assert stopped.get("event") == "stopped"

        # 5. Shutdown command
        proc.stdin.write('{"op":"shutdown"}\n')
        proc.stdin.flush()

        proc.wait(timeout=5)
        assert proc.returncode == 0, f"Expected 0 exit, got {proc.returncode}"
        print("PASS: backend smoke completed exit 0 with real synthesis and no audible playback.")
    finally:
        if proc.poll() is None:
            proc.kill()


if __name__ == "__main__":
    main()
