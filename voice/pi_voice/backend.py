"""Persistent Kokoro TTS service communicating via JSONL stdio."""
import argparse
from pathlib import Path
import json
import os
import queue
import sys
import threading
import time

from speech import PROFILE, Synthesizer

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
DEFAULT_RUNTIME_DIR = ROOT / "runtime"


class WindowsSoundPlayer:
    audible = True

    def __init__(self):
        self._current_path = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None

    def start(self, path: Path | str):
        self.stop()
        with self._lock:
            self._current_path = str(path)
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._play_sync, args=(self._current_path,), daemon=True)
            self._thread.start()

    def _play_sync(self, path: str):
        try:
            import winsound
            winsound.PlaySound(path, winsound.SND_FILENAME | winsound.SND_SYNC)
        except Exception:
            pass

    def stop(self):
        with self._lock:
            self._stop_event.set()
            try:
                import winsound
                winsound.PlaySound(None, winsound.SND_PURGE)
            except Exception:
                pass
            if self._thread and self._thread.is_alive():
                self._thread.join(timeout=0.2)
            self._thread = None
            self._current_path = None


class NullPlayer:
    audible = False

    def __init__(self):
        self.played = []
        self.stops = 0

    def start(self, path: Path | str):
        self.played.append(str(path))

    def stop(self):
        self.stops += 1


class SpeechService:
    def __init__(self, synth, player, emit_event, runtime_dir: Path):
        self.synth = synth
        self.player = player
        self.emit_event = emit_event
        self.runtime_dir = Path(runtime_dir)
        self.runtime_dir.mkdir(parents=True, exist_ok=True)

        self._lock = threading.RLock()
        self._work_queue = queue.Queue()
        self._generation = 0
        self._active_id = None
        self._active_wav = None
        self._running = False
        self._idle_event = threading.Event()
        self._idle_event.set()
        self._worker_thread = None

    def start(self):
        with self._lock:
            if self._running:
                return
            self._running = True
            self.emit_event({"event": "ready", "profile": PROFILE})
            self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker_thread.start()

    def _worker_loop(self):
        while self._running:
            try:
                item = self._work_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            req_id, text, gen = item
            with self._lock:
                if gen != self._generation or not self._running:
                    self._cleanup_active_audio()
                    self._check_and_set_idle()
                    continue
                self._active_id = req_id

            try:
                wav_bytes, duration = self.synth.synthesize(text)
            except Exception as exc:
                with self._lock:
                    self.emit_event({"event": "error", "id": req_id, "message": f"Synthesis failed: {type(exc).__name__}"})
                    self._active_id = None
                    self._check_and_set_idle()
                continue

            with self._lock:
                if gen != self._generation or not self._running:
                    self._cleanup_active_audio()
                    self._check_and_set_idle()
                    continue

                wav_path = self.runtime_dir / f"{req_id}_{gen}.wav"
                try:
                    wav_path.write_bytes(wav_bytes)
                    self._active_wav = wav_path
                except Exception as exc:
                    self.emit_event({"event": "error", "id": req_id, "message": f"File write failed: {type(exc).__name__}"})
                    self._active_id = None
                    self._check_and_set_idle()
                    continue

                self.emit_event({"event": "speaking", "id": req_id})
                self.player.start(wav_path)

            # Wait for audio to finish playing or until stopped/superseded
            play_start = time.perf_counter()
            while self._running:
                with self._lock:
                    if gen != self._generation:
                        break
                if time.perf_counter() - play_start >= duration:
                    break
                time.sleep(0.05)

            with self._lock:
                if gen == self._generation and self._running:
                    self.emit_event({"event": "idle", "id": req_id, "duration_seconds": round(duration, 3)})
                self._cleanup_active_audio()
                self._active_id = None
                self._check_and_set_idle()

    def _cleanup_active_audio(self):
        if self._active_wav:
            try:
                if self._active_wav.exists():
                    self._active_wav.unlink()
            except Exception:
                pass
            self._active_wav = None

    def _check_and_set_idle(self):
        if self._work_queue.empty() and self._active_id is None:
            self._idle_event.set()

    def handle_line(self, line: str) -> bool:
        """Process one incoming JSONL string. Returns False if shutting down."""
        with self._lock:
            if not self._running:
                return False

        line_str = line.strip()
        if not line_str:
            return True

        try:
            req = json.loads(line_str)
        except Exception:
            self.emit_event({"event": "error", "message": "Malformed JSON input"})
            return True

        if not isinstance(req, dict):
            self.emit_event({"event": "error", "message": "Command must be a JSON object"})
            return True

        op = req.get("op")
        if not isinstance(op, str):
            self.emit_event({"event": "error", "message": "Missing op field"})
            return True

        if op == "ping":
            self.emit_event({"event": "pong"})
            return True

        if op == "stop":
            self.stop()
            return True

        if op == "shutdown":
            self.close()
            return False

        if op == "speak":
            req_id = req.get("id")
            text = req.get("text")
            if not isinstance(req_id, (str, int)) or not str(req_id).strip():
                self.emit_event({"event": "error", "message": "speak command requires a non-empty string id"})
                return True
            req_id_str = str(req_id)

            if not isinstance(text, str):
                self.emit_event({"event": "error", "id": req_id_str, "message": "text must be a string"})
                return True

            if len(text) > 20000:
                self.emit_event({"event": "error", "id": req_id_str, "message": "text length exceeds 20000 character limit"})
                return True

            if not text.strip():
                self.emit_event({"event": "error", "id": req_id_str, "message": "text cannot be empty"})
                return True

            self._enqueue_speak(req_id_str, text)
            return True

        self.emit_event({"event": "error", "message": f"Unknown op: {op}"})
        return True

    def _enqueue_speak(self, req_id: str, text: str):
        with self._lock:
            self._generation += 1
            gen = self._generation
            self.player.stop()
            self._cleanup_active_audio()
            # Drain older queued items
            while not self._work_queue.empty():
                try:
                    self._work_queue.get_nowait()
                except queue.Empty:
                    break
            self._idle_event.clear()
            self.emit_event({"event": "accepted", "id": req_id})
            self._work_queue.put((req_id, text, gen))

    def stop(self):
        with self._lock:
            self._generation += 1
            self.player.stop()
            self._cleanup_active_audio()
            while not self._work_queue.empty():
                try:
                    self._work_queue.get_nowait()
                except queue.Empty:
                    break
            self._active_id = None
            self._idle_event.set()
            self.emit_event({"event": "stopped"})

    def wait_idle(self, timeout: float = 2.0) -> bool:
        return self._idle_event.wait(timeout)

    def close(self):
        with self._lock:
            self._running = False
            self._generation += 1
            self.player.stop()
            self._cleanup_active_audio()
            while not self._work_queue.empty():
                try:
                    self._work_queue.get_nowait()
                except queue.Empty:
                    break
            self._active_id = None
            self._idle_event.set()

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=0.5)


def serve(input_stream, output_stream, synth, player, runtime_dir: Path) -> int:
    def emit_event(ev: dict):
        output_stream.write(json.dumps(ev, ensure_ascii=False) + "\n")
        output_stream.flush()

    service = SpeechService(synth, player, emit_event, runtime_dir)
    service.start()
    try:
        for line in input_stream:
            if not service.handle_line(line):
                break
    except KeyboardInterrupt:
        pass
    finally:
        service.close()
    return 0


def main():
    parser = argparse.ArgumentParser(description="Kokoro persistent local TTS backend")
    parser.add_argument("--no-playback", action="store_true", help="Diagnostic mode: synthesize without playing audio")
    parser.add_argument("--runtime-dir", type=str, default=str(DEFAULT_RUNTIME_DIR), help="Runtime audio directory")
    parser.add_argument("--glossary", type=str, default=None, help="Custom glossary JSON file")
    args = parser.parse_args()

    runtime_dir = Path(args.runtime_dir)
    runtime_dir.mkdir(parents=True, exist_ok=True)

    from speech import Synthesizer, load_glossary
    glossary = load_glossary(args.glossary)
    synth = Synthesizer(PROJECT_ROOT, glossary=glossary)
    no_playback = args.no_playback or os.getenv("VOICE_NO_PLAYBACK") == "1"
    player = NullPlayer() if no_playback else WindowsSoundPlayer()

    exit_code = serve(sys.stdin, sys.stdout, synth, player, runtime_dir)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
