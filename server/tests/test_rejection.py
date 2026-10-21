"""Tests for rejecting non-answers (T5 Change 1)."""
from __future__ import annotations

import asyncio
import base64
import pytest

from socra_server.adapters.whisper_stt import (
    SILENCE_HALLUCINATIONS,
    WhisperSTT,
    is_valid_answer,
)
from socra_server.app import ExamApp, PageChannel
from tests.conftest import FakeLoader, FakeTTS, FakeSTT, make_wav_bytes


class _FakePage:
    def __init__(self, app: ExamApp | None = None):
        self.messages = []
        self._app = app

    async def send(self, data: str):
        import json
        msg = json.loads(data)
        self.messages.append(msg)
        if self._app is not None and msg.get("type") == "tts_audio":
            self._app.handle_playback_done()


def _connect(channel: PageChannel, page: _FakePage) -> None:
    if hasattr(channel, "app") and page._app is None:
        page._app = getattr(channel, "app")
    loop = asyncio.get_running_loop()
    channel.set_connection(page, loop)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Unit tests for is_valid_answer
# ---------------------------------------------------------------------------

def test_is_valid_answer_empty():
    assert not is_valid_answer("")
    assert not is_valid_answer("   \n\t  ")


def test_is_valid_answer_punctuation_only():
    assert not is_valid_answer(". . . .")
    assert not is_valid_answer("...")
    assert not is_valid_answer("¿? ¡! - - ,,,")


def test_is_valid_answer_repetitive():
    # 4 tokens, 1 token repeated 4 times (100% >= 60%)
    assert not is_valid_answer("yo yo yo yo")
    # 4 tokens, 1 token repeated 3 times (75% >= 60%)
    assert not is_valid_answer("bla bla bla si")
    # 5 tokens, 1 token repeated 3 times (60% >= 60%)
    assert not is_valid_answer("bla bla bla otra cosa")
    # 4 tokens, max repetition 2 (50% < 60%) -> valid
    assert is_valid_answer("uno dos uno tres")
    # < 4 tokens -> not rejected by repetition rule
    assert is_valid_answer("si si si")


def test_is_valid_answer_silence_hallucinations():
    assert "subtítulos realizados por" in SILENCE_HALLUCINATIONS
    assert "amara.org" in SILENCE_HALLUCINATIONS
    assert "gracias por ver" in SILENCE_HALLUCINATIONS
    assert "suscríbete" in SILENCE_HALLUCINATIONS

    assert not is_valid_answer("Subtítulos realizados por la comunidad de Amara.org")
    assert not is_valid_answer("Muchas gracias por ver el video")
    assert not is_valid_answer("suscríbete a mi canal para más contenido")


def test_is_valid_answer_valid():
    assert is_valid_answer("El río más largo de Sudamérica es el Amazonas.")
    assert is_valid_answer("No recuerdo bien, pero creo que fue en 1492.")


# ---------------------------------------------------------------------------
# WhisperSTT segment filtering
# ---------------------------------------------------------------------------

class _Segment:
    def __init__(self, text: str, no_speech_prob: float = 0.0, avg_logprob: float = -0.5):
        self.text = text
        self.no_speech_prob = no_speech_prob
        self.avg_logprob = avg_logprob


class _FakeWhisperModelWithSegments:
    def __init__(self, segments: list[_Segment]):
        self._segments = segments

    def transcribe(self, audio, **kw):
        return iter(self._segments), None


class _FakeTranscriberWithSegments:
    def __init__(self, segments: list[_Segment]):
        self.model = _FakeWhisperModelWithSegments(segments)


def test_whisper_drops_low_confidence_segments():
    stt = WhisperSTT()
    # Segment with no_speech_prob > 0.6 and avg_logprob < -1.0 should be dropped
    stt._transcriber = _FakeTranscriberWithSegments([
        _Segment("ruido de fondo", no_speech_prob=0.8, avg_logprob=-1.2),
        _Segment("respuesta válida", no_speech_prob=0.1, avg_logprob=-0.3),
    ])
    stt.set_base_terms([])
    res = stt.transcribe(make_wav_bytes())
    assert res == "respuesta válida"


def test_whisper_all_low_confidence_returns_empty():
    stt = WhisperSTT()
    stt._transcriber = _FakeTranscriberWithSegments([
        _Segment("silencio", no_speech_prob=0.9, avg_logprob=-1.5),
    ])
    stt.set_base_terms([])
    res = stt.transcribe(make_wav_bytes())
    assert res == ""


# ---------------------------------------------------------------------------
# ExamApp rejection rules
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "bad_transcript",
    [
        "",
        ". . . .",
        "yo yo yo yo",
        "Subtítulos realizados por la comunidad de Amara.org",
    ],
)
@pytest.mark.asyncio
async def test_rejection_rules_keep_listening_and_send_notice(bad_transcript: str):
    channel = PageChannel()
    loader = FakeLoader(stt_reply=bad_transcript)
    app = ExamApp(channel=channel, loader=loader)
    page = _FakePage()
    _connect(channel, page)

    await app.ask("¿Cuál es la capital?", 1, 1)
    page.messages.clear()

    wav = make_wav_bytes()
    b64 = base64.b64encode(wav).decode()
    await app.handle_answer_audio(b64)

    # 1. Answer was not stored
    assert app.session.pending_answer is None
    assert not app.session.has_answer_for(1)

    # 2. Page received notice
    notices = [m for m in page.messages if m.get("type") == "notice"]
    assert len(notices) == 1
    assert notices[0]["text"] == "Didn't catch that. Please answer again."

    # 3. Page received state listening
    states = [m for m in page.messages if m.get("type") == "state"]
    assert any(s.get("state") == "listening" for s in states)

    # 4. No transcript message was sent
    transcripts = [m for m in page.messages if m.get("type") == "transcript"]
    assert len(transcripts) == 0

    # 5. get_answer still returns listening
    ans = await app.get_answer(wait_s=1.0)
    assert ans == {"status": "listening"}


@pytest.mark.asyncio
async def test_valid_answer_passes_and_is_stored():
    channel = PageChannel()
    loader = FakeLoader(stt_reply="El río Amazonas es el más largo.")
    app = ExamApp(channel=channel, loader=loader)
    page = _FakePage()
    _connect(channel, page)

    await app.ask("¿Cuál es el río más largo?", 1, 1)
    page.messages.clear()

    wav = make_wav_bytes()
    b64 = base64.b64encode(wav).decode()
    await app.handle_answer_audio(b64)

    assert app.session.pending_answer == "El río Amazonas es el más largo."
    assert app.session.has_answer_for(1)

    transcripts = [m for m in page.messages if m.get("type") == "transcript"]
    assert len(transcripts) == 1
    assert transcripts[0]["text"] == "El río Amazonas es el más largo."

    ans = await app.get_answer(wait_s=1.0)
    assert ans["status"] == "answered"
    assert ans["text"] == "El río Amazonas es el más largo."
