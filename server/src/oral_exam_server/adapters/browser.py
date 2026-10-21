"""Launch a visible exam app window without shell commands or stdout output."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import webbrowser

from oral_exam_server.entrypoints.http_server import PAGE_URL


def launch_page() -> None:
    """Prefer Edge, then Chrome on Windows; otherwise use the default browser."""
    if sys.platform == "win32":
        roots = [
            Path(os.environ.get("ProgramFiles", "C:/Program Files")),
            Path(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)")),
            Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local"))),
        ]
        for relative in ("Microsoft/Edge/Application/msedge.exe", "Google/Chrome/Application/chrome.exe"):
            for root in roots:
                executable = root / relative
                if executable.is_file():
                    try:
                        subprocess.Popen(
                            [str(executable), f"--app={PAGE_URL}"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        )
                        return
                    except OSError:
                        continue
    webbrowser.open(PAGE_URL)
