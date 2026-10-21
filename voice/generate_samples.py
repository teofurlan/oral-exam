"""Generate and validate two local Spanish TTS samples; never send text to an agent."""
from pathlib import Path
import json
import time

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent
TEXT = (
    "Esta es una prueba de voz local en español. "
    "Voy a leer las respuestas de Pi y de Claude Code. "
    "Primero revisaremos los archivos y ejecutaremos las pruebas. "
    "No modificaré el código sin autorización. "
    "Puedes detener la lectura cuando quieras."
)

started = time.perf_counter()
engine = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
load_seconds = time.perf_counter() - started
output = ROOT / "samples"
output.mkdir(exist_ok=True)
report = {
    "text": TEXT,
    "load_seconds": round(load_seconds, 3),
    "available_onnx_providers": ort.get_available_providers(),
    "samples": [],
}
for voice in ("ef_dora", "em_alex"):
    started = time.perf_counter()
    samples, rate = engine.create(TEXT, voice=voice, speed=1.0, lang="es")
    elapsed = time.perf_counter() - started
    samples = np.asarray(samples)
    assert rate > 0 and samples.size > 0, "Empty audio or invalid sample rate"
    assert np.isfinite(samples).all(), "Non-finite audio samples"
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
    assert rms > 0.00001, "Silent audio"
    path = output / f"{voice}.wav"
    sf.write(path, samples, rate, subtype="PCM_16")
    saved, saved_rate = sf.read(path)
    assert saved_rate == rate and len(saved) == len(samples), "WAV round-trip failed"
    duration = len(samples) / rate
    entry = {
        "voice": voice,
        "file": str(path),
        "sample_rate": rate,
        "duration_seconds": round(duration, 3),
        "generation_seconds": round(elapsed, 3),
        "real_time_factor": round(elapsed / duration, 3),
        "rms": round(rms, 6),
    }
    report["samples"].append(entry)
    print(json.dumps(entry), flush=True)

(ROOT / "results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
print("PASS: both WAV files are non-empty, non-silent, finite, and readable.", flush=True)
