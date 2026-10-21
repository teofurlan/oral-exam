"""Audio recording from the default or specified input device using sounddevice."""
import threading
import numpy as np
import sounddevice as sd

DEFAULT_SAMPLE_RATE = 16000


class AudioRecorder:
    """Thread-safe microphone recorder capturing 16kHz mono float32 audio."""

    def __init__(
        self,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        channels: int = 1,
        dtype: str = "float32",
        device: int | str | None = None,
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.dtype = dtype
        self.device = device

        self._lock = threading.Lock()
        self._recording = False
        self._stream = None
        self._frames: list[np.ndarray] = []

    @property
    def is_recording(self) -> bool:
        with self._lock:
            return self._recording

    def start(self):
        """Begin capturing audio frames into memory."""
        with self._lock:
            if self._recording:
                return

            self._frames = []
            try:
                self._stream = sd.InputStream(
                    samplerate=self.sample_rate,
                    channels=self.channels,
                    dtype=self.dtype,
                    device=self.device,
                    callback=self._audio_callback,
                )
                self._stream.start()
                self._recording = True
            except Exception as exc:
                self._recording = False
                self._stream = None
                raise RuntimeError(f"Failed to start audio input stream: {exc}") from exc

    def _audio_callback(self, indata, frames, time_info, status):
        """Callback invoked by sounddevice for each audio buffer chunk."""
        with self._lock:
            if self._recording:
                self._frames.append(indata.copy())

    def stop(self) -> np.ndarray:
        """Stop capturing and return the recorded audio as a 1D float32 numpy array."""
        with self._lock:
            if not self._recording:
                return np.array([], dtype=np.float32)

            self._recording = False
            stream = self._stream
            self._stream = None
            captured_frames = list(self._frames)
            self._frames = []

        if stream is not None:
            try:
                stream.stop()
                stream.close()
            except Exception:
                pass

        if not captured_frames:
            return np.array([], dtype=np.float32)

        try:
            return np.concatenate(captured_frames, axis=0).flatten().astype(np.float32)
        except Exception:
            return np.array([], dtype=np.float32)
