"""End-to-end smoke test of DictationApp with real Whisper and real Ollama."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dictation.app import DictationApp
from dictation.cleaner import clean_prompt
from dictation.transcriber import WhisperTranscriber
from dictation.injector import TextInjector


class MockRecorder:
    def __init__(self, wav_path: Path):
        import soundfile as sf
        self.data, _ = sf.read(str(wav_path))
        self._recording = False

    @property
    def is_recording(self):
        return self._recording

    def start(self):
        self._recording = True

    def stop(self):
        self._recording = False
        return self.data


class MockInjector:
    def __init__(self):
        self.injected_text = None

    def inject(self, text, simulate_paste=True):
        self.injected_text = text
        return True


def main():
    sample_wav = PROJECT_ROOT / "samples" / "em_alex.wav"
    if not sample_wav.exists():
        raise FileNotFoundError(f"Sample WAV not found at {sample_wav}")

    mock_rec = MockRecorder(sample_wav)
    mock_inj = MockInjector()
    transcriber = WhisperTranscriber(model_size="base")

    config = {
        "version": 1,
        "clean_with_llm": True,
        "simulate_paste": False,
        "sound_feedback": False,
        "language": "es",
        "ollama_model": "phi4-mini",
        "ollama_host": "http://localhost:11434",
    }

    app = DictationApp(
        recorder=mock_rec,
        transcriber=transcriber,
        cleaner=clean_prompt,
        injector=mock_inj,
        config=config,
    )

    # 1. First toggle starts recording
    app.toggle_recording()
    assert mock_rec.is_recording is True, "Recorder should be in recording state"

    # 2. Second toggle stops, transcribes, cleans with Ollama, and injects
    app.toggle_recording()
    assert mock_rec.is_recording is False, "Recorder should be stopped"
    assert mock_inj.injected_text, "Injector should have received non-empty cleaned text"

    print("\n--- SMOKE RESULT ---")
    print("Injected Prompt:", mock_inj.injected_text)
    print("PASS: DictationApp end-to-end smoke passed with real Whisper and real Ollama.")


if __name__ == "__main__":
    main()
