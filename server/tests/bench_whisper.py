"""Benchmark script for Whisper models (base, small, large-v3-turbo) on Spanish answers."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Ensure voice stack and socra_server are on path
server_dir = Path(__file__).resolve().parents[1]
repo_root = server_dir.parent
voice_dir = repo_root / "voice"

if str(server_dir / "src") not in sys.path:
    sys.path.insert(0, str(server_dir / "src"))
if str(voice_dir) not in sys.path:
    sys.path.insert(0, str(voice_dir))

from socra_server.adapters.kokoro_tts import KokoroTTS
from socra_server.adapters.whisper_stt import WhisperSTT, _ensure_cuda_dlls
from socra_server.app import get_wav_duration
from dictation.transcriber import WhisperTranscriber, DEFAULT_DOWNLOAD_ROOT

ANSWERS = [
    "El río más largo de Sudamérica es el Amazonas.",
    "No recuerdo bien, pero creo que fue en mil cuatrocientos noventa y dos.",
]

MODELS = ["base", "small", "large-v3-turbo"]


def main():
    _ensure_cuda_dlls()
    print("=" * 70, flush=True)
    print("SOCRA WHISPER MODEL BENCHMARK", flush=True)
    print("=" * 70, flush=True)

    # 1. Synthesize the two answers using Kokoro TTS
    print("\n[1/2] Synthesizing benchmark answers with Kokoro TTS...", flush=True)
    tts = KokoroTTS()
    tts_start = time.perf_counter()
    tts.load()
    tts_load_time = time.perf_counter() - tts_start
    print(f"Kokoro loaded in {tts_load_time:.2f} s", flush=True)

    wavs = []
    for i, ans in enumerate(ANSWERS, 1):
        t0 = time.perf_counter()
        wav = tts.synthesize(ans)
        dur = get_wav_duration(wav)
        synth_time = time.perf_counter() - t0
        wavs.append((ans, wav, dur))
        print(f"Answer {i} ({dur:.2f}s audio) synthesized in {synth_time:.2f}s: {ans!r}", flush=True)

    # 2. Benchmark each Whisper model
    print("\n[2/2] Benchmarking Whisper models...", flush=True)
    results = []

    for model_name in MODELS:
        print(f"\n--- Model: {model_name} ---", flush=True)
        t_load_start = time.perf_counter()
        transcriber = WhisperTranscriber(
            model_size=model_name,
            download_root=DEFAULT_DOWNLOAD_ROOT,
        )
        load_time = time.perf_counter() - t_load_start
        device = getattr(transcriber, "device", "unknown")
        compute = getattr(transcriber, "compute_type", "unknown")
        print(f"Loaded in {load_time:.2f} s (device: {device}, compute: {compute})", flush=True)

        stt = WhisperSTT()
        stt._transcriber = transcriber
        stt._model_size = model_name

        model_run = {
            "model": model_name,
            "device": f"{device} ({compute})",
            "load_time_s": load_time,
            "runs": [],
        }

        for i, (orig_text, wav, dur) in enumerate(wavs, 1):
            t_tx_start = time.perf_counter()
            transcript = stt.transcribe(wav)
            tx_time = time.perf_counter() - t_tx_start
            print(f"  A{i} ({dur:.2f}s audio) -> {tx_time:.2f}s: {transcript!r}", flush=True)
            model_run["runs"].append({
                "audio_duration_s": dur,
                "tx_time_s": tx_time,
                "transcript": transcript,
                "original": orig_text,
            })

        results.append(model_run)

    # 3. Print markdown table
    print("\n" + "=" * 70, flush=True)
    print("BENCHMARK SUMMARY TABLE", flush=True)
    print("=" * 70 + "\n", flush=True)

    print("| Model | Device | Load Time (s) | A1 Time (s) | A1 Transcript | A2 Time (s) | A2 Transcript |", flush=True)
    print("|---|---|---|---|---|---|---|", flush=True)
    for r in results:
        m = r["model"]
        dev = r["device"]
        lt = f"{r['load_time_s']:.2f}"
        a1 = r["runs"][0]
        a2 = r["runs"][1]
        print(
            f"| `{m}` | {dev} | {lt} | "
            f"{a1['tx_time_s']:.2f} | \"{a1['transcript']}\" | "
            f"{a2['tx_time_s']:.2f} | \"{a2['transcript']}\" |",
            flush=True
        )

    print("\nBenchmark complete.", flush=True)
    return results


if __name__ == "__main__":
    main()
