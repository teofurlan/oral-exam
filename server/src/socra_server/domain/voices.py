"""Voice domain model and catalogue."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Voice:
    id: str
    label: str
    model: str  # Piper model path in the Hugging Face repo, without extension
    length_scale: float  # Piper pace: above 1 is slower


VOICES: tuple[Voice, ...] = (
    Voice(
        id="daniela",
        label="Daniela (Argentina)",
        model="es/es_AR/daniela/high/es_AR-daniela-high",
        length_scale=1.2,
    ),
)

DEFAULT_VOICE_ID = "daniela"

_VOICES_BY_ID: dict[str, Voice] = {v.id: v for v in VOICES}


def get_voice(voice_id: object) -> Voice | None:
    """Return the Voice matching voice_id, or None if unknown or not a string."""
    if not isinstance(voice_id, str):
        return None
    return _VOICES_BY_ID.get(voice_id)
