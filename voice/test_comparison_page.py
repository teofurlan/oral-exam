"""Check the local listening page and its linked, playable PCM WAV files."""
from html.parser import HTMLParser
from pathlib import Path
import json
import unittest
import wave

ROOT = Path(__file__).resolve().parent / "comparison"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.players = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "audio":
            self.players.append(attrs)
        if tag == "a":
            self.links.append(attrs.get("href", ""))


class ListeningPageTests(unittest.TestCase):
    def test_all_samples_have_manual_players_and_downloads(self):
        page = (ROOT / "index.html").read_text(encoding="utf-8")
        report = json.loads((ROOT / "results.json").read_text(encoding="utf-8"))
        parser = PageParser()
        parser.feed(page)
        self.assertEqual(len(parser.players), 13)
        self.assertEqual(len(parser.players), len(report["samples"]))
        self.assertIn("comparison.m3u", parser.links)
        for player, sample in zip(parser.players, report["samples"]):
            with self.subTest(sample=sample["id"]):
                self.assertIn("controls", player)
                self.assertNotIn("autoplay", player)
                self.assertTrue(player.get("aria-label"))
                self.assertEqual(player["src"], sample["file"])
                self.assertIn(sample["file"], parser.links)
                with wave.open(str(ROOT / sample["file"]), "rb") as audio:
                    self.assertEqual(audio.getsampwidth(), 2)
                    self.assertEqual(audio.getnchannels(), 1)
                    self.assertEqual(audio.getframerate(), sample["sample_rate"])
                    self.assertGreater(audio.getnframes(), 0)
                    self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), sample["duration_seconds"], places=2)
        playlist = (ROOT / "comparison.m3u").read_text(encoding="utf-8")
        for sample in report["samples"]:
            self.assertIn(sample["file"], playlist.splitlines())
        self.assertNotIn("https://", page)
        self.assertNotIn("http://", page)

    def test_alex_dora_followups_preserve_text_and_request_english_readme(self):
        report = json.loads((ROOT / "results.json").read_text(encoding="utf-8"))
        samples = [s for s in report["samples"] if s.get("group") == "alex_dora_english"]
        self.assertEqual(len(samples), 3)
        self.assertEqual(len({s["text"] for s in samples}), 1)
        for sample, dora_weight in zip(samples, (0.15, 0.20, 0.25)):
            with self.subTest(sample=sample["id"]):
                self.assertAlmostEqual(sample["voice_weights"]["ef_dora"], dora_weight)
                self.assertAlmostEqual(sample["voice_weights"]["em_alex"], 1 - dora_weight)
                self.assertIn("README", sample["text"])
                segments = sample["speech_segments"]
                self.assertEqual("".join(s["text"] for s in segments), sample["text"])
                self.assertEqual([s["language"] for s in segments if s["text"] == "README"], ["en-us"])
                self.assertTrue(sample["readme_english_phonemes"])
                self.assertNotEqual(sample["readme_english_phonemes"], sample["readme_spanish_phonemes"])
        page = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="alex-dora-english"', page)


if __name__ == "__main__":
    unittest.main()
