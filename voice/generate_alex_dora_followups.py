"""Append three comparable Alex/Dora samples with English phonemes for README."""
from pathlib import Path
import hashlib
import json
import time

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "comparison"
SEGMENTS = [
    {"text": "He revisado el ", "language": "es"},
    {"text": "README", "language": "en-us"},
    {"text": " de tu proyecto y las pruebas terminaron correctamente. Antes de cambiar el código, quiero explicarte los resultados. Primero revisaremos las opciones; después elegiremos la que resulte más clara y natural. No realizaré cambios sin autorización.", "language": "es"},
]
TEXT = "".join(segment["text"] for segment in SEGMENTS)


def main():
    manifest = OUTPUT / "results.json"
    report = json.loads(manifest.read_text(encoding="utf-8"))
    original = [s for s in report["samples"] if s.get("group") != "alex_dora_english"]
    previous_hashes = {s["file"]: hashlib.sha256((OUTPUT / s["file"]).read_bytes()).hexdigest() for s in original}
    engine = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
    phoneme_parts = [engine.tokenizer.phonemize(s["text"], lang=s["language"]) for s in SEGMENTS]
    english = phoneme_parts[1]
    spanish = engine.tokenizer.phonemize("README", lang="es")
    if not english or english == spanish:
        raise ValueError("English README phonemization must be non-empty and distinct from Spanish")
    mixed_phonemes = " ".join(phoneme_parts)
    print(json.dumps({"README_en_us": english, "README_es": spanish}, ensure_ascii=True), flush=True)
    additions = []
    for number, dora_weight in enumerate((0.15, 0.20, 0.25), 11):
        alex_weight = 1.0 - dora_weight
        slug = f"{number:02d}_alex_{round(alex_weight * 100)}_dora_{round(dora_weight * 100)}_readme_english"
        style = engine.get_voice_style("em_alex") * alex_weight + engine.get_voice_style("ef_dora") * dora_weight
        started = time.perf_counter()
        audio, rate = engine.create(mixed_phonemes, voice=style, speed=1.0, lang="es", is_phonemes=True)
        elapsed = time.perf_counter() - started
        audio = np.asarray(audio)
        if audio.ndim != 1 or audio.size == 0 or not np.isfinite(audio).all():
            raise ValueError(f"Invalid audio: {slug}")
        rms = float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))
        if rms <= 1e-5 or float(np.max(np.abs(audio))) > 1.0:
            raise ValueError(f"Silent or clipped audio: {slug}")
        relative = f"audio/{slug}.wav"
        sf.write(OUTPUT / relative, audio, rate, subtype="PCM_16")
        saved, saved_rate = sf.read(OUTPUT / relative)
        if saved_rate != rate or len(saved) != len(audio):
            raise ValueError(f"WAV round-trip failed: {slug}")
        duration = len(audio) / rate
        entry = {
            "id": slug,
            "label": f"Alex {round(alex_weight * 100)}% + Dora {round(dora_weight * 100)}% / README in English",
            "group": "alex_dora_english",
            "file": relative,
            "voice_weights": {"em_alex": alex_weight, "ef_dora": dora_weight},
            "speed": 1.0,
            "text": TEXT,
            "speech_segments": SEGMENTS,
            "readme_english_phonemes": english,
            "readme_spanish_phonemes": spanish,
            "synthesized_phonemes": mixed_phonemes,
            "duration_seconds": round(duration, 3),
            "generation_seconds": round(elapsed, 3),
            "real_time_factor": round(elapsed / duration, 3),
            "sample_rate": rate,
            "rms": round(rms, 6),
        }
        additions.append(entry)
        print(json.dumps(entry, ensure_ascii=True), flush=True)
    for relative, expected in previous_hashes.items():
        if hashlib.sha256((OUTPUT / relative).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Existing sample was changed: {relative}")
    report["samples"] = original + additions
    report["alex_dora_followup_note"] = (
        "Samples 11-13 preserve README in the visible text and use en-us phonemization only for that token. "
        "Other text uses Spanish phonemization. This requests English pronunciation but requires human listening to assess its accent and quality. "
        "All three samples use identical text and speed; only the Alex/Dora ratio changes."
    )
    manifest.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    playlist = ["#EXTM3U"]
    for sample in report["samples"]:
        playlist.extend([f"#EXTINF:{round(sample['duration_seconds'])},{sample['label']}", sample["file"]])
    (OUTPUT / "comparison.m3u").write_text("\n".join(playlist) + "\n", encoding="utf-8")
    print("PASS: three follow-up samples validated; previous WAV hashes unchanged.", flush=True)


if __name__ == "__main__":
    main()
