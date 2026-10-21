# Validation brief: T2

Read `odd/tasks/oral-exam.md` up to `## Log` and `odd/brief-T2.md`. Another model implemented T2 in `server/`. Validate against S4, S5, S6 and the brief. Cite file:line.

Check:
1. Protocol matches the page exactly: compare every message shape with `web/src/types/exam.ts` and `web/src/hooks/useExamSocket.ts` (field names, base64 WAV, `final`, state values). The page is the contract; fix the server, not `web/`.
2. Nothing writes to stdout except MCP JSON-RPC (print, logging config, library warnings, model loading output from the kokoro/whisper stack). Kokoro/phonemizer/espeak may print: verify and redirect if needed.
3. Concurrency: `get_answer` waiting vs `answer_audio` arriving, `reanswer` during a wait, a new page connection replacing the old one, model readiness awaited (not polled in a busy loop), blocking work only in `asyncio.to_thread`. WS bound to 127.0.0.1.
4. MCP startup: handshake must not wait for model loading.
5. `pyproject.toml`: replace deprecated `tool.uv.dev-dependencies` with `[dependency-groups] dev`.
6. Real smoke (do not add to the default pytest run; put it in `server/tests/smoke_roundtrip.py` runnable manually): load the real adapters from `../../kokoro-audio-test`, synthesize "Un proceso tiene su propia memoria; un thread comparte la memoria del proceso.", transcribe that WAV with the Whisper adapter, print the transcript and timings. Report the transcript and timings.

## Allowed edit surfaces

server/**

## Rules

Fix only real defects, minimal changes, one regression test per fix. Do not restyle or refactor. Do not commit.

## Verification (report each as `<command>: <observed result>`)

- `uv sync --project server`
- `uv run --project server pytest -q`
- `uv run --project server python server/tests/smoke_roundtrip.py`

End with: verdict per S#, defects found, fixes (file:line), advisories.
