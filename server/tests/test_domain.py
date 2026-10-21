"""Tests for ExamSession domain model."""
from __future__ import annotations

import pytest
from oral_exam_server.domain.session import ExamSession


def test_initial_state():
    s = ExamSession()
    assert s.question_index == 0
    assert s.question_total == 0
    assert s.question_text == ""
    assert s.turn_state == "idle"
    assert s.mode == "auto"
    assert s.pending_answer is None


def test_set_question_clears_answer():
    s = ExamSession()
    s.set_question(1, 3, "What is X?")
    s.store_answer("some answer")
    assert s.has_answer_for(1)

    s.set_question(2, 3, "What is Y?")
    assert s.pending_answer is None
    assert not s.has_answer_for(1)
    assert not s.has_answer_for(2)


def test_store_and_clear_answer():
    s = ExamSession()
    s.set_question(1, 2, "Q?")
    s.store_answer("my answer")
    assert s.has_answer_for(1)
    assert s.pending_answer == "my answer"

    s.clear_answer()
    assert s.pending_answer is None
    assert not s.has_answer_for(1)


def test_has_answer_for_wrong_index():
    s = ExamSession()
    s.set_question(2, 5, "Q2?")
    s.store_answer("ans")
    assert not s.has_answer_for(1)
    assert s.has_answer_for(2)


def test_set_turn_state():
    s = ExamSession()
    s.set_turn_state("speaking")
    assert s.turn_state == "speaking"


def test_set_mode():
    s = ExamSession()
    s.set_mode("push-to-talk")
    assert s.mode == "push-to-talk"
