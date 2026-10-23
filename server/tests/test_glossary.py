"""Tests for the pronunciation glossary: loading and segmentation."""
from __future__ import annotations

import json

import pytest

from socra_server.domain.glossary import DEFAULT_TERMS, load_glossary, speech_segments

TERMS = {"API": "A P I", "pull request": "pull request", "pull": "pool", "README.md": "read me dot em dee"}


def test_plain_spanish_stays_one_segment():
    assert speech_segments("hola mundo", TERMS) == [{"text": "hola mundo", "language": "es"}]


def test_empty_text_and_empty_terms():
    assert speech_segments("", TERMS) == []
    assert speech_segments("hola", {}) == [{"text": "hola", "language": "es"}]


def test_longest_match_wins():
    segments = speech_segments("abrí el pull request ya", TERMS)
    assert segments == [
        {"text": "abrí el ", "language": "es"},
        {"text": "pull request", "spoken": "pull request", "language": "en-us"},
        {"text": " ya", "language": "es"},
    ]


def test_matching_is_case_insensitive_and_keeps_written_text():
    segments = speech_segments("la api falla", TERMS)
    assert segments[1] == {"text": "api", "spoken": "A P I", "language": "en-us"}


def test_word_boundaries_prevent_inner_matches():
    assert speech_segments("es muy rapid", TERMS) == [{"text": "es muy rapid", "language": "es"}]
    assert speech_segments("APIs", TERMS) == [{"text": "APIs", "language": "es"}]


def test_terms_with_punctuation():
    segments = speech_segments("leé README.md hoy", TERMS)
    assert segments[1]["spoken"] == "read me dot em dee"


def test_load_glossary_reads_terms(tmp_path):
    path = tmp_path / "terms.json"
    path.write_text(json.dumps({"version": 1, "terms": {"hook": "hook"}}), encoding="utf-8")
    assert load_glossary(path) == {"hook": "hook"}


def test_missing_file_falls_back_to_defaults(tmp_path):
    assert load_glossary(tmp_path / "absent.json") == DEFAULT_TERMS
    assert load_glossary(None) == DEFAULT_TERMS


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        "[]",
        json.dumps({"version": 2, "terms": {"a": "b"}}),
        json.dumps({"version": 1}),
        json.dumps({"version": 1, "terms": {"": "b"}}),
        json.dumps({"version": 1, "terms": {"a": ""}}),
    ],
)
def test_invalid_file_is_rejected(tmp_path, content):
    path = tmp_path / "terms.json"
    path.write_text(content, encoding="utf-8")
    with pytest.raises(ValueError):
        load_glossary(path)
