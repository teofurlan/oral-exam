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
from collections.abc import Mapping
from pathlib import Path

logger = logging.getLogger(__name__)


def default_preferences_path() -> Path:
    override = os.environ.get("SOCRA_PREFERENCES_FILE")
    if override:
        return Path(override)
    return Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".cache") / "Socra" / "preferences.json"


class PreferencesFile:
    """Read and merge string preferences; a missing or unreadable file reads as empty.

    Writes replace the file atomically. Two processes writing at the same
    moment can lose one change (last write wins), which is fine for UI choices.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path = default_preferences_path() if path is None else path
        self._lock = threading.Lock()

    def read(self) -> dict[str, str]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        except (OSError, ValueError) as exc:
            logger.warning("Ignoring unreadable preferences file %s: %s", self.path, exc)
            return {}
        if not isinstance(data, dict):
            return {}
        return {k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)}

    def update(self, changes: Mapping[str, str | None]) -> dict[str, str]:
        """Apply ``changes`` (None deletes a key) and return the stored preferences."""
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
                os.replace(tmp, self.path)
            except BaseException:
                Path(tmp).unlink(missing_ok=True)
                raise
            return prefs
