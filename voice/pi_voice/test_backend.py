"""Deterministic public-protocol and pronunciation tests; no audible playback."""
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
import wave

import numpy as np

from backend import SpeechService, serve
from speech import PROFILE, Synthesizer, load_glossary, speech_segments

ROOT = Path(__file__).resolve().parent


def wav_bytes():
    data = io.BytesIO()
    with wave.open(data, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24000)
        audio.writeframes(b"\x01\x00" * 2400)
    return data.getvalue()


class FakeSynth:
    def __init__(self, gated=False):
        self.started = threading.Event()
        self.release = threading.Event()
        self.gated = gated
        self.calls = []

    def synthesize(self, text):
        self.calls.append(text)
        self.started.set()
        if self.gated and len(self.calls) == 1:
            if not self.release.wait(2):
                raise RuntimeError("test gate timed out")
        return wav_bytes(), 0.1


class FakePlayer:
    audible = False

    def __init__(self):
        self.played = []
        self.stops = 0

    def start(self, path):
        self.played.append(Path(path).read_bytes())

    def stop(self):
        self.stops += 1


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        runtime = ROOT / "runtime"
        runtime.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=runtime)
        self.events = []
        self.synth = FakeSynth()
        self.player = FakePlayer()
        self.service = SpeechService(self.synth, self.player, self.events.append, Path(self.temp.name))

    def tearDown(self):
        self.synth.release.set()
        self.service.close()
        self.temp.cleanup()

    def start(self):
        self.service.start()

    def test_startup_is_silent_and_ping_works(self):
        self.start()
        self.assertEqual(self.events, [{"event": "ready", "profile": PROFILE}])
        self.assertEqual(self.synth.calls, [])
        self.assertEqual(self.player.played, [])
        self.assertTrue(self.service.handle_line('{"op":"ping"}'))
        self.assertEqual(self.events[-1], {"event": "pong"})

    def test_valid_speech_emits_lifecycle_and_cleans_audio(self):
        self.start()
        self.service.handle_line(json.dumps({"op": "speak", "id": "one", "text": "Hola README"}))
        self.assertTrue(self.service.wait_idle(2))
        self.assertEqual([e["event"] for e in self.events], ["ready", "accepted", "speaking", "idle"])
        self.assertEqual(self.events[-1]["id"], "one")
        self.assertGreater(self.events[-1]["duration_seconds"], 0)
        self.assertEqual(len(self.player.played), 1)
        self.assertEqual(list(Path(self.temp.name).glob("*.wav")), [])

    def test_invalid_input_does_not_cancel_valid_synthesis(self):
        self.synth.gated = True
        self.start()
        self.service.handle_line('{"op":"speak","id":"good","text":"Hola"}')
        self.assertTrue(self.synth.started.wait(2))
        for invalid in ("not JSON SECRET", "[]", '{"op":"unknown"}',
                        json.dumps({"op": "speak", "id": "bad", "text": "x" * 20001}),
                        '{"op":"speak","id":"bad","text":" "}'):
            self.assertTrue(self.service.handle_line(invalid))
        self.synth.release.set()
        self.assertTrue(self.service.wait_idle(2))
        self.assertEqual(len([e for e in self.events if e["event"] == "error"]), 5)
        self.assertEqual([e["id"] for e in self.events if e["event"] == "idle"], ["good"])
        self.assertEqual(len(self.player.played), 1)
        self.assertNotIn("SECRET", json.dumps(self.events))
        self.assertNotIn("x" * 100, json.dumps(self.events))

    def test_stop_during_inference_never_plays_stale_audio(self):
        self.synth.gated = True
        self.start()
        self.service.handle_line('{"op":"speak","id":"old","text":"Hola"}')
        self.assertTrue(self.synth.started.wait(2))
        self.service.handle_line('{"op":"stop"}')
        self.assertEqual(self.events[-1], {"event": "stopped"})
        self.synth.release.set()
        self.assertTrue(self.service.wait_idle(2))
        self.assertEqual(self.player.played, [])
        self.assertFalse(any(e["event"] == "speaking" for e in self.events))

    def test_new_speech_supersedes_old_and_queued_speech(self):
        self.synth.gated = True
        self.start()
        self.service.handle_line('{"op":"speak","id":"old","text":"Anterior"}')
        self.assertTrue(self.synth.started.wait(2))
        self.service.handle_line('{"op":"speak","id":"middle","text":"Intermedia"}')
        self.service.handle_line('{"op":"speak","id":"latest","text":"Nueva"}')
        self.synth.release.set()
        self.assertTrue(self.service.wait_idle(2))
        self.assertEqual([e["id"] for e in self.events if e["event"] == "speaking"], ["latest"])
        self.assertEqual(self.synth.calls, ["Anterior", "Nueva"])
        self.assertEqual(len(self.player.played), 1)

    def test_shutdown_and_eof_stop_and_cleanup(self):
        self.start()
        self.assertFalse(self.service.handle_line('{"op":"shutdown"}'))
        self.service.close()
        self.assertEqual(self.player.played, [])
        self.assertFalse(self.service.handle_line('{"op":"ping"}'))
        output = io.StringIO()
        player = FakePlayer()
        result = serve(io.StringIO('{"op":"ping"}\nINVALID\n'), output,
                       FakeSynth(), player, Path(self.temp.name))
        self.assertEqual(result, 0)
        records = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual([r["event"] for r in records], ["ready", "pong", "error"])
        self.assertGreater(player.stops, 0)


class FakeTokenizer:
    def __init__(self):
        self.calls = []

    def phonemize(self, text, lang):
        self.calls.append((text, lang))
        return "english" if lang == "en-us" else "spanish"


class FakeEngine:
    def __init__(self):
        self.tokenizer = FakeTokenizer()
        self.last = None

    def get_voice_style(self, name):
        return np.ones((4, 1, 2), dtype=np.float32) * (1 if name == "em_alex" else 3)

    def create(self, text, **kwargs):
        self.last = (text, kwargs)
        return np.ones(2400, dtype=np.float32) * 0.02, 24000


class PronunciationTests(unittest.TestCase):
    def test_english_terms_use_longest_whole_match_and_preserve_text(self):
        terms = {"README": "read me", "README.md": "read me dot em dee", "pull request": "pull request", "API": "A P I", "C++": "C plus plus"}
        text = "Revisa README.md, pull request, API y C++; unREADME permanece."
        spans = speech_segments(text, terms)
        self.assertEqual("".join(s["text"] for s in spans), text)
        self.assertEqual([s["text"] for s in spans if s["language"] == "en-us"], ["README.md", "pull request", "API", "C++"])
        self.assertIn("unREADME permanece.", spans[-1]["text"])
        self.assertEqual(spans[-1]["language"], "es")

    def test_invalid_glossary_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "terms.json"
            for value in ({"version": 1, "terms": {"": "bad"}},
                          {"version": 1, "terms": {"foo": 3}},
                          {"version": 2, "terms": {"foo": "foo"}}):
                path.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(ValueError):
                    load_glossary(path)

    def test_profile_english_phonemes_and_source_are_preserved(self):
        engine = FakeEngine()
        synth = Synthesizer(ROOT.parent, engine=engine)
        source = "# Revisa `README`, backend y API.\n```python\nvalue = 1\n```\nNo cambies nada."
        data, duration = synth.synthesize(source)
        self.assertEqual(source, "# Revisa `README`, backend y API.\n```python\nvalue = 1\n```\nNo cambies nada.")
        self.assertGreater(len(data), 44)
        self.assertAlmostEqual(duration, 0.1)
        phonemes, options = engine.last
        self.assertTrue(options["is_phonemes"])
        self.assertEqual(options["speed"], 1.0)
        np.testing.assert_allclose(options["voice"], 1.5)
        english = [t for t, lang in engine.tokenizer.calls if lang == "en-us"]
        spanish = " ".join(t for t, lang in engine.tokenizer.calls if lang == "es")
        self.assertIn("read me", english)
        self.assertIn("backend", english)
        self.assertIn("A P I", english)
        self.assertIn("value = 1", spanish)
        self.assertIn("No cambies nada.", spanish)


if __name__ == "__main__":
    unittest.main()
