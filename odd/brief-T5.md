# Brief: T5 — fixes from the first real microphone test

You are a delegated worker. Skip all learning-mode, learning-vault, Engram and session bookkeeping steps and do not ask the user anything. Read `odd/tasks/oral-exam.md` up to `## Log` first (the project was renamed Socra: package `server/src/socra_server`, script `socra-server`, MCP name `socra`). All code, comments and UI copy in English. Keep every existing test green. Wait for every command you start to finish before you end.

## Allowed edit surfaces

server/**
web/**
odd/tasks/oral-exam.md
.gitignore

## Evidence from the test (2026-10-21, real mic, 5 questions)

- Whisper returned ". . . ." (silence hallucination) and the app accepted it as the answer.
- Spanish transcription quality was poor with model `base`: "río Amazonas" -> "riyama sonas", "recuerdo" -> "recordo".
- `say()` returns before the audio finishes; an `ask()` right after can overlap it. Also `ask()` sends `state listening` right after `tts_audio`, so the page may start capturing while the question is still playing.
- The page dropped mid-exam: `get_answer` returned `no_client` ~60 s after the question; `open_page` reconnected. The page never reconnects by itself, and there is no log of why the socket closed.

## Changes

1. **Reject non-answers.** In the Whisper adapter, drop segments with `no_speech_prob > 0.6` and `avg_logprob < -1.0`. After joining, treat as no answer: text empty once punctuation/whitespace is stripped; one token making >= 60% of >= 4 tokens; or a known silence hallucination (case-insensitive substring list in one constant: "subtítulos realizados por", "amara.org", "gracias por ver", "suscríbete"). On no answer: do not store it, keep `get_answer` returning `listening`, send `{"type":"notice","text":"Didn't catch that. Please answer again."}` then `state listening` so the page re-arms capture. The page shows the notice for a few seconds.
2. **Playback-aware speaking.** The page sends `{"type":"playback_done"}` when a `tts_audio` clip finishes (or fails to play). `say()` and `ask()` wait for it, with timeout = WAV duration + 2 s, before returning / before sending `state listening`. Capture must only start after `listening`.
3. **Survive disconnects.** Page: auto-reconnect with backoff (0.5 s doubling to 5 s) whenever the socket closes and the exam is not finished; show "Reconnecting…" meanwhile. Server: on a new page connection, resend the current `question` (with `code`) and current state (no audio replay). `get_answer`: if no page is connected, wait for one within the same `wait_s` window before returning `no_client`. Set WebSocket keepalive explicitly (`ping_interval=20`, `ping_timeout=60`). Log every page connect/disconnect with close code and reason to stderr and to `server/logs/socra.log` (rotating, gitignored).
4. **Better Whisper model.** Make the model configurable with env `SOCRA_WHISPER_MODEL` (and `SOCRA_WHISPER_DEVICE`, default auto: CUDA float16 if it works, else CPU int8; the voice stack's transcriber already has a CUDA->CPU fallback, reuse it). Benchmark on this machine (RTX 4060 8 GB) `base`, `small` and `large-v3-turbo`, downloading into `voice/models/whisper` (already gitignored): for each, report device actually used, load time, and transcription time + transcript for two Kokoro-synthesized Spanish answers ("El río más largo de Sudamérica es el Amazonas." and "No recuerdo bien, pero creo que fue en mil cuatrocientos noventa y dos."). Pick as default the most accurate model whose transcription of a ~5 s answer takes <= 3 s; record the table in `server/README.md`. Put the benchmark in `server/tests/bench_whisper.py` (manual, not in the default pytest run).
5. Update the protocol section in `odd/tasks/oral-exam.md` for `notice` and `playback_done`.

## Tests (one per rule, public interfaces)

Server: each rejection rule (empty, punctuation-only, repetitive, hallucination phrase, low-confidence segments) keeps `listening` and sends `notice`; a valid answer still passes; `say`/`ask` wait for `playback_done` and time out at duration + 2 s; `listening` is not sent before playback ends; reconnect resends question and state; `get_answer` waits for reconnection within `wait_s`; connect/disconnect logged with close code; env model selection. Web: sends `playback_done` on audio end and on play error; reconnects with backoff and stops after `finished`; notice rendered; no capture before `listening`.

## Verification (report each as `<command>: <observed result>`)

- `uv run --project server pytest -q server/tests`
- `pnpm -C web test --run`
- `pnpm -C web build`
- `uv run --project server python server/tests/bench_whisper.py`
- `uv run --project server python server/tests/smoke_e2e.py` (update it only if the protocol change requires it; keep it strict)

Do not commit. End with changed files, the benchmark table, the chosen default and why.
