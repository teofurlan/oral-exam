"""Page preferences kept in one JSON file shared by every socra-server process.

The page used to keep them only in localStorage, which is per origin; a server
on fallback ports serves the page from a new origin each session (#27).
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import time
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Windows denies access to a file while another process replaces it; such
# errors pass within milliseconds, so each file operation retries briefly.
RETRY_DELAYS_S: tuple[float, ...] = (0.05, 0.2)


def _retrying(action: Callable[[], T]) -> T:
    for delay in (*RETRY_DELAYS_S, None):
        try:
            return action()
        except FileNotFoundError:
            raise
        except OSError:
            if delay is None:
                raise
            time.sleep(delay)
    raise AssertionError("unreachable")


def default_preferences_path() -> Path:
    override = os.environ.get("SOCRA_PREFERENCES_FILE")
    if override:
        return Path(override)
    return Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".cache") / "Socra" / "preferences.json"


class PreferencesFile:
    """Read and merge string preferences kept in one JSON file.

    Writes replace the file atomically. Two processes writing at the same
    moment can lose one change (last write wins), which is fine for UI choices.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path = default_preferences_path() if path is None else path
        self._lock = threading.Lock()

    def read(self) -> dict[str, str]:
        """The stored preferences. A missing or corrupt file reads as empty; a file
        that exists but stays unreadable raises OSError, so nobody mistakes it for
        an empty one and overwrites it."""
        try:
            text = _retrying(lambda: self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        try:
            data = json.loads(text)
        except (ValueError, RecursionError) as exc:
            logger.warning("Ignoring corrupt preferences file %s: %s", self.path, exc)
            return {}
        if not isinstance(data, dict):
            return {}
        return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)}

    def update(self, changes: Mapping[str, str | None]) -> dict[str, str]:
        """Apply ``changes`` (None deletes a key) and return the stored preferences.

        Raises OSError, writing nothing, when the file cannot be read or replaced.
        """
        with self._lock:
            prefs = self.read()
            for key, value in changes.items():
                if value is None:
                    prefs.pop(key, None)
                else:
                    prefs[key] = value
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".preferences-", suffix=".json")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(prefs, fh, indent=2, sort_keys=True)
                _retrying(lambda: os.replace(tmp, self.path))
            except BaseException:
                Path(tmp).unlink(missing_ok=True)
                raise
            return prefs
