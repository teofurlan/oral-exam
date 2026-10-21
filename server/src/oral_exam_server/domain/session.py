"""Pure domain model for an exam session — no I/O."""
from __future__ import annotations

import dataclasses
from typing import Literal

TurnMode = Literal["auto", "push-to-talk"]
TurnState = Literal["idle", "speaking", "listening", "thinking"]


@dataclasses.dataclass
class ExamSession:
    """Mutable state for one exam session.  No threading, no I/O here."""

    # Current question
    question_index: int = 0
    question_total: int = 0
    question_text: str = ""

    # Protocol state shown on the page
    turn_state: TurnState = "idle"

    # Turn-taking mode chosen by the page
    mode: TurnMode = "auto"

    # Verbatim transcript from the last answer_audio chunk
    pending_answer: str | None = None

    # Index of the question that owns the pending answer
    pending_answer_index: int = -1

    # ------------------------------------------------------------------ #
    # Mutators                                                             #
    # ------------------------------------------------------------------ #

    def set_question(self, index: int, total: int, text: str) -> None:
        self.question_index = index
        self.question_total = total
        self.question_text = text
        self.pending_answer = None
        self.pending_answer_index = -1

    def set_turn_state(self, state: TurnState) -> None:
        self.turn_state = state

    def set_mode(self, mode: TurnMode) -> None:
        self.mode = mode

    def store_answer(self, text: str) -> None:
        """Store a verbatim transcript as the pending answer for the current question."""
        self.pending_answer = text
        self.pending_answer_index = self.question_index

    def clear_answer(self) -> None:
        """Discard the pending answer (reanswer flow)."""
        self.pending_answer = None
        self.pending_answer_index = -1

    def has_answer_for(self, index: int) -> bool:
        return (
            self.pending_answer is not None
            and self.pending_answer_index == index
        )
