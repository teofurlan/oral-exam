"""Create a bounded Spanish listening comparison without altering the original tests."""
from pathlib import Path
import json
import time

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "comparison"
COMMON_TEXT = (
    "Hola. He terminado de revisar tu proyecto y quiero explicarte lo que encontré. "
    "La idea funciona, pero conviene hacer una prueba pequeña antes de integrarla. "
    "No voy a cambiar ningún archivo todavía. "
    "Primero escucharemos las alternativas; después elegiremos la que resulte más clara y natural. "
    "Si algo no se entiende, podemos ajustar la pronunciación y volver a compararlo."
)
TECH_RAW = (
    "Revisé el README y ejecuté npm test. "
    "La API respondió correctamente, pero el endpoint devolvió un timeout. "
    "Antes de abrir el pull request, revisaremos el log de Claude Code y Pi."
)
TECH_SPOKEN = (
    "Revisé el archivo de instrucciones y ejecuté el comando ene pe eme, test. "
    "La interfaz de programación respondió correctamente, pero el punto de acceso agotó el tiempo de espera. "
    "Antes de abrir la solicitud de cambios, revisaremos el registro de Clod Coud y Pai."
)
VARIANTS = [
    ("01_alex_original", "Alex / original", {"em_alex": 1.0}, 1.0, "shared", COMMON_TEXT),
    ("02_santa_original", "Santa / original", {"em_santa": 1.0}, 1.0, "shared", COMMON_TEXT),
    ("03_alex_slower", "Alex / speed 0.94", {"em_alex": 1.0}, 0.94, "shared", COMMON_TEXT),
    ("04_alex_santa_75_25", "Alex 75% + Santa 25%", {"em_alex": 0.75, "em_santa": 0.25}, 1.0, "shared", COMMON_TEXT),
    ("05_alex_santa_50_50", "Alex 50% + Santa 50%", {"em_alex": 0.5, "em_santa": 0.5}, 1.0, "shared", COMMON_TEXT),
    ("06_alex_santa_25_75", "Alex 25% + Santa 75%", {"em_alex": 0.25, "em_santa": 0.75}, 1.0, "shared", COMMON_TEXT),
    ("07_alex_dora_85_15", "Alex 85% + Dora 15%", {"em_alex": 0.85, "ef_dora": 0.15}, 1.0, "shared", COMMON_TEXT),
    ("08_alex_santa_slower", "Alex 75% + Santa 25% / speed 0.94", {"em_alex": 0.75, "em_santa": 0.25}, 0.94, "shared", COMMON_TEXT),
    ("09_technical_raw", "Alex / technical text as written", {"em_alex": 1.0}, 1.0, "technical", TECH_RAW),
    ("10_technical_prepared", "Alex / text adapted for speech", {"em_alex": 1.0}, 1.0, "technical", TECH_SPOKEN),
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    OUTPUT.mkdir(exist_ok=True)
    audio_dir = OUTPUT / "audio"
    audio_dir.mkdir(exist_ok=True)
    started = time.perf_counter()
    engine = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
    report = {
        "model": "kokoro-v1.0.onnx",
        "language": "es",
        "sample_format": "PCM_16",
        "providers": engine.sess.get_providers(),
        "load_seconds": round(time.perf_counter() - started, 3),
        "shared_text": COMMON_TEXT,
        "notes": [
            "Samples 01-08 use identical text; only voice weights and speed change.",
            "Samples 09-10 compare literal technical wording with an explicitly rewritten spoken version; they are not a voice-only comparison.",
            "Spoken technical text is a manual demonstration, not an implemented text-cleaning system.",
            "No equalization, resampling, loudness matching, or automatic playback applied.",
        ],
        "samples": [],
    }
    for slug, label, weights, speed, group, text in VARIANTS:
        require(abs(sum(weights.values()) - 1.0) < 1e-6, f"Invalid blend: {slug}")
        require(all(name in engine.get_voices() for name in weights), f"Unknown voice: {slug}")
        style = sum(engine.get_voice_style(name) * weight for name, weight in weights.items())
        require(np.isfinite(style).all(), f"Non-finite style: {slug}")
        started = time.perf_counter()
        audio, rate = engine.create(text, voice=style, speed=speed, lang="es")
        elapsed = time.perf_counter() - started
        audio = np.asarray(audio)
        require(audio.ndim == 1 and audio.size > 0 and rate > 0, f"Invalid audio: {slug}")
        require(np.isfinite(audio).all(), f"Non-finite audio: {slug}")
        rms = float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))
        require(rms > 1e-5, f"Silent audio: {slug}")
        require(float(np.max(np.abs(audio))) <= 1.0, f"Audio would clip: {slug}")
        relative = f"audio/{slug}.wav"
        destination = OUTPUT / relative
        sf.write(destination, audio, rate, subtype="PCM_16")
        saved, saved_rate = sf.read(destination)
        require(saved_rate == rate and len(saved) == len(audio), f"WAV round-trip failed: {slug}")
        duration = len(audio) / rate
        entry = {
            "id": slug,
            "label": label,
            "group": group,
            "file": relative,
            "voice_weights": weights,
            "speed": speed,
            "text": text,
            "duration_seconds": round(duration, 3),
            "generation_seconds": round(elapsed, 3),
            "real_time_factor": round(elapsed / duration, 3),
            "sample_rate": rate,
            "rms": round(rms, 6),
        }
        report["samples"].append(entry)
        print(json.dumps(entry, ensure_ascii=True), flush=True)
    (OUTPUT / "results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    playlist = ["#EXTM3U"]
    for sample in report["samples"]:
        playlist.extend([f"#EXTINF:{round(sample['duration_seconds'])},{sample['label']}", sample["file"]])
    (OUTPUT / "comparison.m3u").write_text("\n".join(playlist) + "\n", encoding="utf-8")
    print(f"PASS: generated and validated {len(report['samples'])} samples.", flush=True)


if __name__ == "__main__":
    main()
