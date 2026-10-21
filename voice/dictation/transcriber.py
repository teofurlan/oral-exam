"""Local speech-to-text transcription using faster-whisper with automatic fallback."""
from pathlib import Path
import ctranslate2
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
DEFAULT_DOWNLOAD_ROOT = PROJECT_ROOT / "models" / "whisper"
DEFAULT_MODEL_SIZE = "base"


def get_default_device_and_compute_type() -> tuple[str, str]:
    """Auto-detect CUDA capability or fall back to CPU."""
    try:
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def load_audio_array(audio: np.ndarray | str | Path | None) -> np.ndarray | None:
    """Normalize any audio input (array or file path) into a 16kHz float32 1D numpy array."""
    if audio is None:
        return None

    if isinstance(audio, (str, Path)):
        path = Path(audio)
        if not path.exists():
            return None
        data, sr = sf.read(str(path))
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr != 16000:
            duration = len(data) / sr
            target_len = int(duration * 16000)
            data = np.interp(
                np.linspace(0, len(data), target_len, endpoint=False),
                np.arange(len(data)),
                data,
            )
        return data.astype(np.float32)

    if isinstance(audio, np.ndarray):
        if audio.size == 0:
            return audio
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return audio.astype(np.float32)

    return None


class WhisperTranscriber:
    """Wrapper around faster-whisper WhisperModel with rock-solid fallback."""

    def __init__(
        self,
        model_size: str = DEFAULT_MODEL_SIZE,
        device: str | None = None,
        compute_type: str | None = None,
        download_root: Path | str | None = None,
        model=None,
    ):
        if model is not None:
            self.model = model
            return

        from faster_whisper import WhisperModel

        auto_device, auto_compute = get_default_device_and_compute_type()
        requested_device = device or auto_device
        requested_compute = compute_type or auto_compute
        self.download_root = str(download_root or DEFAULT_DOWNLOAD_ROOT)

        # Attempt requested device (e.g. CUDA); fall back to CPU if cublas DLLs are missing
        self.device = requested_device
        self.compute_type = requested_compute

        try:
            self.model = WhisperModel(
                model_size,
                device=self.device,
                compute_type=self.compute_type,
                download_root=self.download_root,
            )
        except Exception:
            # Fallback to CPU int8
            self.device = "cpu"
            self.compute_type = "int8"
            self.model = WhisperModel(
                model_size,
                device="cpu",
                compute_type="int8",
                download_root=self.download_root,
            )

    def transcribe(
        self,
        audio: np.ndarray | str | Path | None,
        language: str = "es",
        vad_filter: bool = True,
        beam_size: int = 5,
    ) -> str:
        """Transcribe an audio array, file path, or bytes.

        Returns joined text string, or empty string on empty input.
        """
        arr = load_audio_array(audio)
        if arr is None or arr.size == 0:
            return ""

        try:
            segments, _info = self.model.transcribe(
                arr,
                language=language,
                vad_filter=vad_filter,
                beam_size=beam_size,
            )
            text_parts = [segment.text.strip() for segment in segments if getattr(segment, "text", "").strip()]
            return " ".join(text_parts).strip()
        except Exception:
            # If transcription fails on CUDA due to missing DLLs at runtime, fall back to CPU model
            if self.device != "cpu":
                try:
                    from faster_whisper import WhisperModel
                    self.device = "cpu"
                    self.compute_type = "int8"
                    self.model = WhisperModel(
                        DEFAULT_MODEL_SIZE,
                        device="cpu",
                        compute_type="int8",
                        download_root=self.download_root,
                    )
                    segments, _info = self.model.transcribe(
                        arr,
                        language=language,
                        vad_filter=vad_filter,
                        beam_size=beam_size,
                    )
                    text_parts = [segment.text.strip() for segment in segments if getattr(segment, "text", "").strip()]
                    return " ".join(text_parts).strip()
                except Exception:
                    return ""
            return ""
