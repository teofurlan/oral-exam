"""Voice domain model and catalogue."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Voice:
    id: str
    label: str
    blend: tuple[tuple[str, float], ...]


VOICES: tuple[Voice, ...] = (
    Voice(
        id="alex-dora",
        label="Alex 75% + Dora 25%",
        blend=(("em_alex", 0.75), ("ef_dora", 0.25)),
    ),
    Voice(
        id="alex",
        label="Alex",
        blend=(("em_alex", 1.0),),
    ),
    Voice(
        id="santa",
        label="Santa",
        blend=(("em_santa", 1.0),),
    ),
    Voice(
        id="dora",
        label="Dora",
        blend=(("ef_dora", 1.0),),
    ),
)

DEFAULT_VOICE_ID = "alex-dora"

_VOICES_BY_ID: dict[str, Voice] = {v.id: v for v in VOICES}


def get_voice(voice_id: object) -> Voice | None:
    """Return the Voice matching voice_id, or None if unknown or not a string."""
    if not isinstance(voice_id, str):
        return None
    return _VOICES_BY_ID.get(voice_id)
