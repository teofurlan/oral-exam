"""Turn an agent's Markdown reply into plain text worth speaking aloud.

The page shows the full reply; speech skips code blocks and Markdown markers,
which sound like noise when read by a TTS voice.
"""
from __future__ import annotations

import re

_FENCED_CODE = re.compile(r"```.*?(?:```|\Z)", re.DOTALL)
_INLINE_CODE = re.compile(r"`([^`]*)`")
_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_LINE_MARKER = re.compile(r"^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)", re.MULTILINE)
_EMPHASIS = (
    re.compile(r"\*\*(.+?)\*\*"),
    re.compile(r"__(.+?)__"),
    # Single markers only at word edges, so snake_case and a*b survive.
    re.compile(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)"),
    re.compile(r"(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)"),
)


def speakable_text(markdown: str) -> str:
    text = _FENCED_CODE.sub(" ", markdown)
    text = _INLINE_CODE.sub(r"\1", text)
    text = _LINK.sub(r"\1", text)
    text = _LINE_MARKER.sub("", text)
    for pattern in _EMPHASIS:
        text = pattern.sub(r"\1", text)
    return " ".join(text.split())
