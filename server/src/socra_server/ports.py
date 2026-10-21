"""Port protocols — pure interfaces; no implementation details."""
from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class SpeechSynthesizer(Protocol):
    """Synthesize text to WAV bytes."""

    def synthesize(self, text: str) -> bytes:
        """Return raw WAV bytes for the given text."""
        ...


@runtime_checkable
class SpeechRecognizer(Protocol):
    """Transcribe WAV bytes to text."""

    def transcribe(self, wav_bytes: bytes, prompt: str = "") -> str:
        """Return verbatim transcript.  Empty string when audio is silent."""
        ...
