"""Unit tests for the DictationApp orchestration daemon."""
import unittest
from unittest.mock import MagicMock
import numpy as np

from app import DictationApp


class DictationAppUnitTests(unittest.TestCase):
    def setUp(self):
        self.mock_recorder = MagicMock()
        self.mock_recorder.is_recording = False
        self.mock_transcriber = MagicMock()
        self.mock_cleaner = MagicMock()
        self.mock_injector = MagicMock()
        self.config = {
            "version": 1,
            "hotkey": "<ctrl>+<alt>+<space>",
            "mode": "toggle",
            "clean_with_llm": True,
            "simulate_paste": True,
            "sound_feedback": False,
            "language": "es",
        }
        self.app = DictationApp(
            recorder=self.mock_recorder,
            transcriber=self.mock_transcriber,
            cleaner=self.mock_cleaner,
            injector=self.mock_injector,
            config=self.config,
        )

    def test_first_toggle_starts_recording(self):
        self.app.toggle_recording()
        self.mock_recorder.start.assert_called_once()
        self.mock_transcriber.transcribe.assert_not_called()
        self.mock_cleaner.assert_not_called()
        self.mock_injector.inject.assert_not_called()

    def test_second_toggle_stops_transcribes_cleans_and_injects(self):
        # 1. Start recording
        self.app.toggle_recording()

        # Simulate recording in progress
        self.mock_recorder.is_recording = True
        dummy_audio = np.ones(16000, dtype=np.float32)
        self.mock_recorder.stop.return_value = dummy_audio
        self.mock_transcriber.transcribe.return_value = "eh revisa auth.ts pero no toques nada todavia"
        self.mock_cleaner.return_value = "Revisa auth.ts. No toques nada todavía."
        self.mock_injector.inject.return_value = True

        # 2. Stop recording
        self.app.toggle_recording()

        self.mock_recorder.stop.assert_called_once()
        self.mock_transcriber.transcribe.assert_called_once_with(dummy_audio, language="es")
        self.mock_cleaner.assert_called_once_with(
            "eh revisa auth.ts pero no toques nada todavia",
            model="phi4-mini",
            host="http://localhost:11434",
        )
        self.mock_injector.inject.assert_called_once_with("Revisa auth.ts. No toques nada todavía.", simulate_paste=True)

    def test_empty_audio_or_transcript_skips_cleaner_and_injector(self):
        self.app.toggle_recording()
        self.mock_recorder.is_recording = True
        self.mock_recorder.stop.return_value = np.array([], dtype=np.float32)
        self.mock_transcriber.transcribe.return_value = ""

        self.app.toggle_recording()

        self.mock_cleaner.assert_not_called()
        self.mock_injector.inject.assert_not_called()

    def test_disabled_llm_cleaning_passes_raw_transcript_to_injector(self):
        self.config["clean_with_llm"] = False
        self.app.toggle_recording()
        self.mock_recorder.is_recording = True
        dummy_audio = np.ones(16000, dtype=np.float32)
        self.mock_recorder.stop.return_value = dummy_audio
        self.mock_transcriber.transcribe.return_value = "texto tal cual se dijo"

        self.app.toggle_recording()

        self.mock_cleaner.assert_not_called()
        self.mock_injector.inject.assert_called_once_with("texto tal cual se dijo", simulate_paste=True)


if __name__ == "__main__":
    unittest.main()
