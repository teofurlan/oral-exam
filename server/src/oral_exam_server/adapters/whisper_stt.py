"""Whisper STT adapter — wraps dictation.transcriber.WhisperTranscriber from the voice stack."""
from __future__ import annotations

import io
import logging
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf


def _voice_stack_dir() -> Path:
    env = os.environ.get("VOICE_STACK_DIR")
    if env:
        return Path(env).resolve()
    here = Path(__file__).resolve()
    repo_root = here.parents[4]
    return (repo_root / "voice").resolve()


def _wav_bytes_to_array(wav_bytes: bytes) -> "np.ndarray":
    """Decode WAV bytes to a 16 kHz float32 numpy array (mono)."""
    buf = io.BytesIO(wav_bytes)
    data, sr = sf.read(buf)
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != 16000:
        duration = len(data) / sr
        target_len = int(duration * 16000)
        if target_len > 0:
            data = np.interp(
                np.linspace(0, len(data), target_len, endpoint=False),
                np.arange(len(data)),
                data,
            )
    return data.astype(np.float32)


class WhisperSTT:
    """Lazy-loading faster-whisper adapter.

    Call ``load()`` in a background thread; ``transcribe()`` is then safe to
    call from ``asyncio.to_thread``.

    ``initial_prompt`` is built from ``glossary_terms`` (the keys from
    pi_voice/terms.json) merged with any per-call ``glossary`` list.
    """

    def __init__(self, glossary_terms: list[str] | None = None) -> None:
        self._transcriber = None
        # Base glossary terms from the voice stack (set by the loader)
        self._base_terms: list[str] = glossary_terms or []

    def set_base_terms(self, terms: list[str]) -> None:
        self._base_terms = terms

    def load(self) -> None:
        """Load the Whisper model.  Must be called from a background thread."""
        stack_dir = _voice_stack_dir()
        if str(stack_dir) not in sys.path:
            sys.path.insert(0, str(stack_dir))

        from dictation.transcriber import WhisperTranscriber  # type: ignore[import]

        self._transcriber = WhisperTranscriber()

    def _build_prompt(self, extra_glossary: list[str] | None) -> str:
        """Combine base terms and any per-call extra terms into an initial_prompt string."""
        combined = list(self._base_terms)
        if extra_glossary:
            for term in extra_glossary:
                if term not in combined:
                    combined.append(term)
        return ", ".join(combined)

    def transcribe(self, wav_bytes: bytes, prompt: str = "") -> str:
        """Transcribe WAV bytes to text.

        ``prompt`` is used as the Whisper initial_prompt when provided;
        otherwise the glossary-derived prompt is used.  Raises RuntimeError if
        not yet loaded.
        """
        if self._transcriber is None:
            raise RuntimeError("WhisperSTT not loaded — call load() first")

        audio_array = _wav_bytes_to_array(wav_bytes)
        if audio_array.size == 0:
            return ""

        # Use the underlying faster-whisper model directly so we can pass
        # initial_prompt, language, and vad_filter (S4: never call Ollama cleaner).
        initial_prompt = prompt if prompt else self._build_prompt(None)

        try:
            segments, _info = self._transcriber.model.transcribe(
                audio_array,
                language="es",
                vad_filter=True,
                initial_prompt=initial_prompt or None,
            )
            parts = [seg.text.strip() for seg in segments if seg.text.strip()]
            return " ".join(parts).strip()
        except Exception:
            # CUDA can initialize successfully yet fail on the first inference
            # when runtime DLLs are missing. Preserve the stack's CPU fallback
            # without losing initial_prompt or fabricating an empty answer.
            if getattr(self._transcriber, "device", "cpu") == "cpu":
                raise
            logging.getLogger(__name__).warning("Whisper inference failed; falling back to CPU", exc_info=True)
            self._transcriber = type(self._transcriber)(
                device="cpu",
                compute_type="int8",
                download_root=self._transcriber.download_root,
            )
            return self.transcribe(wav_bytes, prompt=initial_prompt)

    def transcribe_with_glossary(
        self, wav_bytes: bytes, extra_glossary: list[str] | None = None
    ) -> str:
        """Transcribe with base terms + optional extra glossary as initial_prompt."""
        prompt = self._build_prompt(extra_glossary)
        return self.transcribe(wav_bytes, prompt=prompt)
