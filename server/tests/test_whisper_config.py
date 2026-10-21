"""Tests for Whisper model and device env configuration (T5 Change 4)."""
from __future__ import annotations

import pytest
from socra_server.adapters.whisper_stt import WhisperSTT, get_whisper_config


def test_get_whisper_config_defaults(monkeypatch):
    monkeypatch.delenv("SOCRA_WHISPER_MODEL", raising=False)
    monkeypatch.delenv("SOCRA_WHISPER_DEVICE", raising=False)

    model, device, compute = get_whisper_config()
    assert model in ("base", "small", "large-v3-turbo")
    assert device is None
    assert compute is None


def test_get_whisper_config_env_overrides(monkeypatch):
    monkeypatch.setenv("SOCRA_WHISPER_MODEL", "small")
    monkeypatch.setenv("SOCRA_WHISPER_DEVICE", "cpu")

    model, device, compute = get_whisper_config()
    assert model == "small"
    assert device == "cpu"
    assert compute == "int8"


def test_get_whisper_config_cuda(monkeypatch):
    monkeypatch.setenv("SOCRA_WHISPER_MODEL", "large-v3-turbo")
    monkeypatch.setenv("SOCRA_WHISPER_DEVICE", "cuda")

    model, device, compute = get_whisper_config()
    assert model == "large-v3-turbo"
    assert device == "cuda"
    assert compute == "float16"


def test_whisper_stt_load_passes_configured_model(monkeypatch):
    import types
    import sys

    monkeypatch.setenv("SOCRA_WHISPER_MODEL", "small")
    monkeypatch.setenv("SOCRA_WHISPER_DEVICE", "cpu")

    created_kwargs = {}

    class FakeTranscriber:
        def __init__(self, **kwargs):
            nonlocal created_kwargs
            created_kwargs = kwargs
            self.device = kwargs.get("device", "cpu")
            self.download_root = "/fake/root"
            self.model = None

    fake_module = types.ModuleType("dictation.transcriber")
    fake_module.WhisperTranscriber = FakeTranscriber
    fake_dictation = types.ModuleType("dictation")
    fake_dictation.transcriber = fake_module

    monkeypatch.setitem(sys.modules, "dictation", fake_dictation)
    monkeypatch.setitem(sys.modules, "dictation.transcriber", fake_module)

    stt = WhisperSTT()
    stt.load()

    assert created_kwargs.get("model_size") == "small"
    assert created_kwargs.get("device") == "cpu"
    assert created_kwargs.get("compute_type") == "int8"
