"""Tests for turning an agent's Markdown reply into text worth speaking."""
from __future__ import annotations

from socra_server.domain.speakable import speakable_text


def test_fenced_code_blocks_are_not_spoken():
    reply = "Run this:\n```python\nprint('hi')\n```\nThen check the output."

    assert speakable_text(reply) == "Run this: Then check the output."


def test_inline_code_keeps_its_text_without_backticks():
    assert speakable_text("Call `load()` first.") == "Call load() first."


def test_links_keep_only_their_label():
    assert speakable_text("See [the docs](https://example.com/x).") == "See the docs."


def test_headings_bullets_and_emphasis_markers_are_dropped():
    reply = "## Summary\n- **First** point\n* _second_ point\n1. third"

    assert speakable_text(reply) == "Summary First point second point third"


def test_reply_with_only_code_has_nothing_to_speak():
    assert speakable_text("```\nls -la\n```") == ""


def test_plain_text_is_unchanged_apart_from_whitespace():
    assert speakable_text("  Hello,\n\nworld.  ") == "Hello, world."
