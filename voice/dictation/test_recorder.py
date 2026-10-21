"""Unit tests for the microphone audio recorder."""
import unittest
from unittest.mock import MagicMock, patch
import numpy as np

from recorder import AudioRecorder


class RecorderUnitTests(unittest.TestCase):
    def test_initial_state_is_not_recording(self):
        recorder = AudioRecorder()
        self.assertFalse(recorder.is_recording)

    @patch("sounddevice.InputStream")
    def test_start_and_stop_lifecycle(self, mock_stream_cls):
        mock_stream = MagicMock()
        mock_stream_cls.return_value = mock_stream

        recorder = AudioRecorder(sample_rate=16000)
        recorder.start()
        self.assertTrue(recorder.is_recording)
        mock_stream.start.assert_called_once()

        # Simulate incoming audio chunk
        chunk = np.ones((1600, 1), dtype=np.float32) * 0.1
        recorder._audio_callback(chunk, 1600, None, None)

        audio = recorder.stop()
        self.assertFalse(recorder.is_recording)
        mock_stream.stop.assert_called_once()
        mock_stream.close.assert_called_once()

        self.assertIsInstance(audio, np.ndarray)
        self.assertEqual(len(audio), 1600)
        self.assertAlmostEqual(float(audio[0]), 0.1, places=5)

    def test_stop_when_not_recording_returns_empty_array(self):
        recorder = AudioRecorder()
        audio = recorder.stop()
        self.assertIsInstance(audio, np.ndarray)
        self.assertEqual(audio.size, 0)


if __name__ == "__main__":
    unittest.main()
