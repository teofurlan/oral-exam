"""Speech preparation and synthesis with English technical pronunciation."""
from pathlib import Path
import json
import re
import string
import wave
import io

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
DEFAULT_GLOSSARY_PATH = ROOT / "terms.json"

PROFILE = {
    "voice": "Alex 75% + Dora 25%",
    "speed": 1.0,
    "language": "es",
    "english_glossary": True,
}

DEFAULT_TERMS = {
    "README": "read me",
    "README.md": "read me dot em dee",
    "pull request": "pull request",
    "pull requests": "pull requests",
    "API": "A P I",
    "APIs": "A P Is",
    "PR": "P R",
    "PRs": "P Rs",
    "backend": "backend",
    "frontend": "frontend",
    "endpoint": "endpoint",
    "endpoints": "endpoints",
    "commit": "commit",
    "commits": "commits",
    "branch": "branch",
    "merge": "merge",
    "issue": "issue",
    "issues": "issues",
    "bugfix": "bugfix",
    "debug": "debug",
    "timeout": "timeout",
    "log": "log",
    "logs": "logs",
    "git": "git",
    "github": "github",
    "node": "node",
    "nodejs": "node J S",
    "python": "python",
    "npm": "N P M",
    "docker": "docker",
    "container": "container",
    "runtime": "runtime",
    "framework": "framework",
    "script": "script",
    "scripts": "scripts",
    "code": "code",
    "repo": "repo",
    "repository": "repository",
    "token": "token",
    "tokens": "tokens",
    "prompt": "prompt",
    "prompts": "prompts",
    "pipeline": "pipeline",
    "webhook": "webhook",
    "webhooks": "webhooks",
    "full stack": "full stack",
    "stack": "stack",
    "test": "test",
    "tests": "tests",
    "lint": "lint",
    "build": "build",
    "deploy": "deploy",
    "setup": "setup",
    "release": "release",
    "package": "package",
    "packages": "packages",
    "terminal": "terminal",
    "shell": "shell",
    "bash": "bash",
    "powershell": "powershell",
    "cli": "C L I",
    "ui": "U I",
    "tui": "T U I",
    "claude": "clod",
    "claude code": "clod coud",
    "pi": "pai",
    "kokoro": "kokoro",
    "whisper": "whisper",
    "livekit": "livekit",
    "pipecat": "pipecat",
    "ollama": "ollama",
    "c++": "C plus plus",
    "c#": "C sharp",
}


def load_glossary(path: Path | str | None = None) -> dict[str, str]:
    target = Path(path) if path else DEFAULT_GLOSSARY_PATH
    if not target.exists():
        return dict(DEFAULT_TERMS)
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"Failed to read glossary from {target}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("Glossary file must contain a JSON object")
    if data.get("version") != 1 or "terms" not in data or not isinstance(data["terms"], dict):
        raise ValueError("Glossary must have version: 1 and a 'terms' dictionary")
    terms = {}
    for term, spoken in data["terms"].items():
        if not isinstance(term, str) or not term.strip():
            raise ValueError("Glossary term must be a non-empty string")
        if not isinstance(spoken, str) or not spoken.strip():
            raise ValueError(f"Spoken text for term '{term}' must be a non-empty string")
        terms[term] = spoken
    return terms


def clean_markdown_for_speech(text: str) -> str:
    """Strip markdown presentation syntax without deleting code or content."""
    # Remove code block fences, keeping the code content inside
    cleaned = re.sub(r"```[a-zA-Z0-9_-]*\n?(.*?)\n?```", r"\1", text, flags=re.DOTALL)
    # Remove inline code backticks
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    # Remove header markers (#, ##, etc.) at line start
    cleaned = re.sub(r"^[ \t]*#{1,6}[ \t]+", "", cleaned, flags=re.MULTILINE)
    # Remove bold/italic markers
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"__([^_]+)__", r"\1", cleaned)
    cleaned = re.sub(r"_([^_]+)_", r"\1", cleaned)
    # Remove link syntax: [text](url) -> text
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    # Remove blockquote markers
    cleaned = re.sub(r"^[ \t]*>[ \t]?", "", cleaned, flags=re.MULTILINE)
    # Remove horizontal rules
    cleaned = re.sub(r"^[ \t]*[-*_]{3,}[ \t]*$", "", cleaned, flags=re.MULTILINE)
    # Normalize bullet list markers at line start
    cleaned = re.sub(r"^[ \t]*[-*+][ \t]+", "", cleaned, flags=re.MULTILINE)
    # Clean excessive blank lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def speech_segments(text: str, terms: dict[str, str]) -> list[dict[str, str]]:
    """Segment text into Spanish base and en-us technical terms (longest match first)."""
    if not text:
        return []
    if not terms:
        return [{"text": text, "language": "es"}]

    # Sort terms by length descending for longest-match
    sorted_terms = sorted(terms.keys(), key=len, reverse=True)

    # Build regex with boundary-sensitive matching
    # Support terms that contain non-word chars like C++, C#, README.md
    escaped_patterns = []
    for term in sorted_terms:
        esc = re.escape(term)
        # Use word boundaries when start/end are word characters
        prefix = r"(?<!\w)" if term[0].isalnum() or term[0] == "_" else ""
        suffix = r"(?!\w)" if term[-1].isalnum() or term[-1] == "_" else ""
        escaped_patterns.append(f"({prefix}{esc}{suffix})")

    pattern = re.compile("|".join(escaped_patterns), flags=re.IGNORECASE)

    segments = []
    last_end = 0

    for match in pattern.finditer(text):
        start, end = match.span()
        if start > last_end:
            segments.append({"text": text[last_end:start], "language": "es"})
        matched_str = match.group(0)
        # Find original term casing in terms dictionary
        spoken_val = None
        for k in sorted_terms:
            if k.lower() == matched_str.lower():
                spoken_val = terms[k]
                break
        segments.append({
            "text": matched_str,
            "spoken": spoken_val or matched_str,
            "language": "en-us",
        })
        last_end = end

    if last_end < len(text):
        segments.append({"text": text[last_end:], "language": "es"})

    return segments


class Synthesizer:
    def __init__(self, root: Path | str, engine=None, glossary: dict[str, str] | None = None):
        self.root = Path(root)
        self.glossary = glossary if glossary is not None else load_glossary()
        if engine is not None:
            self.engine = engine
        else:
            onnx_path = str(self.root / "models" / "kokoro-v1.0.onnx")
            voices_path = str(self.root / "models" / "voices-v1.0.bin")
            self.engine = Kokoro(onnx_path, voices_path)

        # Style combination: 75% Alex + 25% Dora
        alex = self.engine.get_voice_style("em_alex")
        dora = self.engine.get_voice_style("ef_dora")
        self.style = alex * 0.75 + dora * 0.25

    def synthesize(self, text: str) -> tuple[bytes, float]:
        """Synthesize text into PCM16 WAV bytes and duration."""
        cleaned = clean_markdown_for_speech(text)
        if not cleaned:
            return b"", 0.0

        segments = speech_segments(cleaned, self.glossary)
        phoneme_parts = []
        for seg in segments:
            val = seg.get("spoken", seg["text"])
            if not val.strip():
                continue
            lang = seg["language"]
            ph = self.engine.tokenizer.phonemize(val, lang=lang)
            if ph:
                phoneme_parts.append(ph)

        if not phoneme_parts:
            return b"", 0.0

        mixed_phonemes = " ".join(phoneme_parts)
        audio, rate = self.engine.create(
            mixed_phonemes,
            voice=self.style,
            speed=1.0,
            lang="es",
            is_phonemes=True,
        )
        audio = np.asarray(audio)
        if audio.ndim != 1 or audio.size == 0 or not np.isfinite(audio).all():
            raise ValueError("Synthesizer produced empty or invalid audio array")

        duration = len(audio) / rate

        # Encode to WAV PCM_16 bytes in memory
        buffer = io.BytesIO()
        sf.write(buffer, audio, rate, format="WAV", subtype="PCM_16")
        wav_data = buffer.getvalue()
        return wav_data, duration
