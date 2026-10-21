"""Unit tests for the Whisper-based local speech transcriber."""
import unittest
from unittest.mock import MagicMock, patch
import numpy as np

from transcriber import WhisperTranscriber, get_default_device_and_compute_type


class TranscriberUnitTests(unittest.TestCase):
    @patch("ctranslate2.get_cuda_device_count")
    def test_device_selection_chooses_cuda_when_available(self, mock_cuda_count):
        mock_cuda_count.return_value = 1
        device, compute_type = get_default_device_and_compute_type()
        self.assertEqual(device, "cuda")
        self.assertEqual(compute_type, "float16")

    @patch("ctranslate2.get_cuda_device_count")
    def test_device_selection_chooses_cpu_when_no_cuda(self, mock_cuda_count):
        mock_cuda_count.return_value = 0
        device, compute_type = get_default_device_and_compute_type()
        self.assertEqual(device, "cpu")
        self.assertEqual(compute_type, "int8")

    def test_transcribe_empty_or_zero_length_audio_returns_empty_string(self):
        transcriber = WhisperTranscriber(model=MagicMock())
        self.assertEqual(transcriber.transcribe(np.array([], dtype=np.float32)), "")
        self.assertEqual(transcriber.transcribe(None), "")

    def test_transcribe_joins_segments_cleanly(self):
        mock_model = MagicMock()
        segment1 = MagicMock(text="Revisa el archivo auth.ts")
        segment2 = MagicMock(text="y no cambies nada.")
        info = MagicMock(language="es")
        mock_model.transcribe.return_value = ([segment1, segment2], info)

        transcriber = WhisperTranscriber(model=mock_model)
        dummy_audio = np.ones(16000, dtype=np.float32) * 0.05
        result = transcriber.transcribe(dummy_audio, language="es")

        self.assertEqual(result, "Revisa el archivo auth.ts y no cambies nada.")
        mock_model.transcribe.assert_called_once()


if __name__ == "__main__":
    unittest.main()
