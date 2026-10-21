"""Kokoro TTS adapter — wraps pi_voice.speech.Synthesizer from the voice stack."""
from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path


def _voice_stack_dir() -> Path:
    env = os.environ.get("VOICE_STACK_DIR")
    if env:
        return Path(env).resolve()
    # Default: the voice stack inside this repo (voice/)
    here = Path(__file__).resolve()
    # server/src/socra_server/adapters/kokoro_tts.py -> repo root is 4 levels up
    repo_root = here.parents[4]
    return (repo_root / "voice").resolve()


class KokoroTTS:
    """Lazy-loading Kokoro TTS adapter.

    Call ``load()`` in a background thread before first use; ``synthesize()``
    blocks only on the actual synthesis, not model load.
    """

    def __init__(self) -> None:
        self._synthesizer = None
        self._glossary_terms: list[str] = []

    def load(self) -> None:
        """Load the Kokoro model.  Must be called from a background thread."""
        stack_dir = _voice_stack_dir()
        if str(stack_dir) not in sys.path:
            sys.path.insert(0, str(stack_dir))

        from pi_voice.speech import Synthesizer  # type: ignore[import]

        self._synthesizer = Synthesizer(root=stack_dir)

        # Read glossary term keys for use as Whisper initial_prompt
        terms_path = stack_dir / "pi_voice" / "terms.json"
        if terms_path.exists():
            try:
                data = json.loads(terms_path.read_text(encoding="utf-8"))
                self._glossary_terms = list(data.get("terms", {}).keys())
            except Exception:
                self._glossary_terms = []

    @property
    def glossary_terms(self) -> list[str]:
        """Term keys from the voice stack's terms.json (loaded after load())."""
        return list(self._glossary_terms)

    def synthesize(self, text: str) -> bytes:
        """Return WAV bytes.  Raises RuntimeError if not yet loaded."""
        if self._synthesizer is None:
            raise RuntimeError("KokoroTTS not loaded — call load() first")
        wav_bytes, _duration = self._synthesizer.synthesize(text)
        return wav_bytes
