"""Native folder picker for agent mode.

The browser cannot hand over an absolute path (showDirectoryPicker only gives
a handle), but the server runs on the user's machine, so it opens the OS
dialog itself.  Call it from a worker thread: Tk lives and dies in that thread.
"""
from __future__ import annotations

from pathlib import Path


def pick_folder() -> str | None:
    """Return the chosen folder as a native path, or None when cancelled."""
    import tkinter
    import tkinter.filedialog

    root = tkinter.Tk()
    root.withdraw()
    # Without this the dialog can open behind the browser window.
    root.attributes("-topmost", True)
    try:
        chosen = tkinter.filedialog.askdirectory(
            parent=root, title="Choose the agent's working folder", mustexist=True
        )
    finally:
        root.destroy()
    # Tk returns "" or an empty tuple on cancel, and forward slashes on Windows.
    return str(Path(chosen)) if isinstance(chosen, str) and chosen else None
