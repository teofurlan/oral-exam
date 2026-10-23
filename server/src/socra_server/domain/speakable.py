"""Turn an agent's Markdown reply into plain text worth speaking aloud.

The page shows the full reply; speech skips code blocks and Markdown markers,
which sound like noise when read by a TTS voice.
"""
from __future__ import annotations

import re

_FENCED_CODE = re.compile(r"(```|~~~).*?(?:\1|\Z)", re.DOTALL)
_INLINE_CODE = re.compile(r"`([^`]*)`")
_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
# Markers can compose (for example, a list inside a quote). Up to three digits
# keeps a year opening a line from being taken for a list number.
_LINE_MARKER = re.compile(r"^\s*(?:(?:#{1,6}|[-*+]|\d{1,3}[.)])\s+|>\s?)+", re.MULTILINE)
# Markers only at word edges, so snake_case, 2**10 and a*b survive. "__x__"
# is left alone: it reads the same as a dunder name such as __init__.
_EMPHASIS = tuple(
    re.compile(rf"(?<!\w){marker}(?![\s*_])(.+?)(?<![\s*_]){marker}(?!\w)")
    for marker in (r"\*\*", r"\*", "_")
)


def speakable_text(markdown: str) -> str:
    text = _FENCED_CODE.sub(" ", markdown)
    text = _INLINE_CODE.sub(r"\1", text)
    text = _LINK.sub(r"\1", text)
    text = _LINE_MARKER.sub("", text)
    for pattern in _EMPHASIS:
        text = pattern.sub(r"\1", text)
    return " ".join(text.split())
