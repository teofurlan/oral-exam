"""Dictation daemon: captures audio on global hotkey, transcribes with Whisper, cleans with Ollama, and pastes into active window."""
import argparse
import json
from pathlib import Path
import sys
import threading
import time

ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = ROOT / "config.json"

DEFAULT_CONFIG = {
    "version": 1,
    "hotkey": "<ctrl>+<alt>+<space>",
    "mode": "toggle",
    "whisper_model": "base",
    "language": "es",
    "ollama_model": "phi4-mini",
    "ollama_host": "http://localhost:11434",
    "clean_with_llm": True,
    "simulate_paste": True,
    "sound_feedback": True,
}


def play_beep(kind: str = "start"):
    """Play subtle acoustic indicator without blocking."""
    try:
        import winsound
        if kind == "start":
            winsound.Beep(988, 60)  # B5 short beep
        else:
            winsound.Beep(659, 70)  # E5 short beep
    except Exception:
        pass


def load_config(path: Path | str | None = None) -> dict:
    target = Path(path) if path else DEFAULT_CONFIG_PATH
    if not target.exists():
        return dict(DEFAULT_CONFIG)
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        cfg = dict(DEFAULT_CONFIG)
        cfg.update(data)
        return cfg
    except Exception:
        return dict(DEFAULT_CONFIG)


class DictationApp:
    """Coordinates microphone recording, Whisper transcription, Ollama prompt cleaning, and paste injection."""

    def __init__(
        self,
        recorder=None,
        transcriber=None,
        cleaner=None,
        injector=None,
        config: dict | None = None,
    ):
        self.config = config or load_config()
        self._recorder = recorder
        self._transcriber = transcriber
        self._cleaner = cleaner
        self._injector = injector
        self._lock = threading.Lock()
        self._is_processing = False

    @property
    def recorder(self):
        if self._recorder is None:
            from recorder import AudioRecorder
            self._recorder = AudioRecorder(sample_rate=16000)
        return self._recorder

    @property
    def transcriber(self):
        if self._transcriber is None:
            from transcriber import WhisperTranscriber
            model_size = self.config.get("whisper_model", "base")
            self._transcriber = WhisperTranscriber(model_size=model_size)
        return self._transcriber

    @property
    def cleaner(self):
        if self._cleaner is None:
            from cleaner import clean_prompt
            self._cleaner = clean_prompt
        return self._cleaner

    @property
    def injector(self):
        if self._injector is None:
            from injector import TextInjector
            self._injector = TextInjector(simulate_paste=self.config.get("simulate_paste", True))
        return self._injector

    def toggle_recording(self):
        """Toggle recording on or off on hotkey press."""
        with self._lock:
            if self._is_processing:
                return

            if not self.recorder.is_recording:
                # 1. Start recording
                try:
                    self.recorder.start()
                    if self.config.get("sound_feedback", True):
                        threading.Thread(target=play_beep, args=("start",), daemon=True).start()
                    print("\n[Dictado]: Grabando micrófono... Presiona el atajo de nuevo para terminar.", flush=True)
                except Exception as exc:
                    print(f"\n[Error]: No se pudo iniciar el micrófono: {exc}", flush=True)
                return

            # 2. Stop recording and process
            self._is_processing = True

        try:
            audio = self.recorder.stop()
            if self.config.get("sound_feedback", True):
                threading.Thread(target=play_beep, args=("stop",), daemon=True).start()

            if audio.size == 0:
                print("[Dictado]: Audio vacío o sin datos.", flush=True)
                return

            print("[Dictado]: Transcribiendo con Whisper...", flush=True)
            t0 = time.perf_counter()
            lang = self.config.get("language", "es")
            raw_text = self.transcriber.transcribe(audio, language=lang)
            trans_elapsed = time.perf_counter() - t0

            if not raw_text or not raw_text.strip():
                print("[Dictado]: No se detectó voz.", flush=True)
                return

            print(f"[Transcripción]: \"{raw_text}\" ({trans_elapsed:.2f}s)", flush=True)

            # 3. Clean with Ollama
            if self.config.get("clean_with_llm", True):
                print(f"[Limpieza]: Estructurando prompt con Ollama ({self.config.get('ollama_model', 'phi4-mini')})...", flush=True)
                t1 = time.perf_counter()
                model_name = self.config.get("ollama_model", "phi4-mini")
                host_url = self.config.get("ollama_host", "http://localhost:11434")
                try:
                    cleaned_prompt = self.cleaner(raw_text, model=model_name, host=host_url)
                except TypeError:
                    cleaned_prompt = self.cleaner(raw_text)
                clean_elapsed = time.perf_counter() - t1
                print(f"[Prompt limpio]: \"{cleaned_prompt}\" ({clean_elapsed:.2f}s)", flush=True)
            else:
                cleaned_prompt = raw_text

            # 4. Inject into active window
            self.injector.inject(cleaned_prompt, simulate_paste=self.config.get("simulate_paste", True))
            print("[Listo]: Prompt pegado en la ventana activa (sin presionar Enter). Revisa y envía cuando quieras.\n", flush=True)
        finally:
            with self._lock:
                self._is_processing = False

    def run(self):
        """Start the global hotkey listener and keep running."""
        from pynput.keyboard import GlobalHotKeys

        hotkey_str = self.config.get("hotkey", "<ctrl>+<alt>+<space>")
        print("=" * 60)
        print("  ASISTENTE DE DICTADO LOCAL PARA PROGRAMACIÓN")
        print("=" * 60)
        print(f"  Atajo global     : {hotkey_str}")
        print(f"  Whisper local    : {self.config.get('whisper_model', 'base')}")
        print(f"  Limpieza Ollama  : {self.config.get('ollama_model', 'phi4-mini')} ({'activa' if self.config.get('clean_with_llm', True) else 'desactivada'})")
        print(f"  Pegado simulado  : {'activo (Ctrl+V)' if self.config.get('simulate_paste', True) else 'solo portapapeles'}")
        print("  Envío automático : DESACTIVADO (siempre revisas antes de enviar)")
        print("=" * 60)
        print("\nEl daemon está escuchando. Presiona el atajo en cualquier ventana para hablar.")
        print("Presiona Ctrl+C en esta terminal para detener el daemon.\n")

        # Pre-warm models so first use is instant
        print("Iniciando modelos locales en segundo plano...", end="", flush=True)
        _ = self.transcriber
        print(" Listo.\n")

        hotkeys = GlobalHotKeys({
            hotkey_str: self.toggle_recording
        })

        hotkeys.start()
        try:
            hotkeys.join()
        except KeyboardInterrupt:
            print("\nDeteniendo asistente de dictado...")
        finally:
            hotkeys.stop()


def main():
    parser = argparse.ArgumentParser(description="Dictation and prompt cleaning daemon")
    parser.add_argument("--config", type=str, default=None, help="Path to custom config.json")
    parser.add_argument("--no-clean", action="store_true", help="Disable Ollama cleanup pass")
    parser.add_argument("--no-paste", action="store_true", help="Only copy to clipboard, do not simulate paste")
    args = parser.parse_args()

    cfg = load_config(args.config)
    if args.no_clean:
        cfg["clean_with_llm"] = False
    if args.no_paste:
        cfg["simulate_paste"] = False

    app = DictationApp(config=cfg)
    app.run()


if __name__ == "__main__":
    main()
