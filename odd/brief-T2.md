# Brief: T2 — Python MCP + WebSocket server

Read `odd/tasks/oral-exam.md` up to `## Log` first. You implement T2 only (S4, S5, S6). All code, comments and docs in English. The web front in `web/` already implements the page side of the protocol (see `web/src/hooks/useExamSocket.ts` and `web/src/types/exam.ts`); match it exactly, do not edit `web/`.

## Allowed edit surfaces

server/**

## Architecture (hexagonal, keep it small)

A uv project in `server/` (Python 3.12, package `oral_exam_server`, console script `oral-exam-server`). One process, one asyncio loop, two entrypoints:

1. **MCP over stdio** using the official `mcp` Python SDK (`FastMCP`). Claude Code launches this process. stdout is reserved for JSON-RPC: all logging goes to stderr.
2. **WebSocket server** on `ws://localhost:8766/ws` (`websockets` library), started inside the same loop when the MCP server starts. Bind to 127.0.0.1 only. One page client at a time; a new connection replaces the old one.

Layers:
- `domain/session.py`: pure `ExamSession` state (current question index/total/text, turn state, mode, pending answer). No I/O.
- `ports.py`: `SpeechSynthesizer.synthesize(text) -> bytes` (WAV) and `SpeechRecognizer.transcribe(wav_bytes, prompt) -> str` protocols.
- `adapters/kokoro_tts.py`, `adapters/whisper_stt.py`: wrap the existing stack in `../../kokoro-audio-test` (path configurable with env `VOICE_STACK_DIR`, default resolved relative to this repo). Insert that dir into `sys.path` only inside these adapters and import `pi_voice.speech.Synthesizer` and `dictation.transcriber.WhisperTranscriber`. Read both files first; do not copy them. For Whisper, call the underlying faster-whisper model so you can pass `initial_prompt` (built from the keys of `pi_voice/terms.json` plus an optional per-call glossary), language `es`, `vad_filter=True`. Never call the Ollama cleaner (S4).
- `app.py`: the application service tying session + ports + a `PageChannel` (send JSON to the connected page).
- `entrypoints/mcp_tools.py`, `entrypoints/ws_server.py`, `__main__.py`.

Models are heavy: load them lazily in a background thread after startup so the MCP handshake is instant; tools await readiness. Run synthesis and transcription with `asyncio.to_thread`.

## MCP tools (S5: short calls, never block long)

- `say(text)`: send `state speaking` + `tts_audio`, return `{"status":"ok"}` once sent.
- `ask(question, index, total, glossary?)`: store question, send `question`, `state speaking`, `tts_audio`, then `state listening`; return `{"status":"asked"}` immediately.
- `get_answer(wait_s=20)`: clamp `wait_s` to 1..25. Return `{"status":"answered","index":n,"text":"<verbatim transcript>"}` as soon as a final transcript exists, else `{"status":"listening"}` on timeout. After returning an answer, send `state thinking`.
- Any tool when no page is connected: return `{"status":"no_client","url":"http://localhost:5180/"}` without raising.

## Page -> server

- `answer_audio` (base64 WAV): transcribe, send `{"type":"transcript","text":..., "final":true}`, store as the pending answer for the current question.
- `reanswer`: discard the pending answer, send `state listening`.
- `mode`: store it (informational for now).
- Malformed messages: log to stderr and ignore; never crash the loop.

## Tests (pytest, through public interfaces, fakes for the ports)

One test per rule: tool payloads and protocol messages for `say`, `ask`, `get_answer` (answered and timeout, clamp), `no_client`, `answer_audio` -> transcript, `reanswer` clears the answer, malformed message ignored, Whisper adapter passes `initial_prompt` with glossary terms (fake model). Use a real WebSocket client against the server bound to an ephemeral port for the protocol tests. No test loads the real models.

Also add `server/README.md` with how to run it and the `.mcp.json` snippet for Claude Code (`uv run --project <abs path>/server oral-exam-server`).

## Verification (report each as `<command>: <observed result>`)

- `uv sync --project server`
- `uv run --project server pytest -q`
- `uv run --project server python -c "import oral_exam_server"`

Do not commit. Do not touch files outside `server/`. At the end, list created files and which S# you covered.
