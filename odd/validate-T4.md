# Validation brief: T4

You are a delegated worker. Skip all learning-mode, learning-vault, Engram and session bookkeeping steps and do not ask the user anything. Read `odd/tasks/oral-exam.md` up to `## Log` and `odd/brief-T4.md`. Another model implemented it in `server/` and `web/`. Validate each numbered change, citing file:line. In particular: the static server cannot serve files outside `web/dist` (path traversal), binds 127.0.0.1; `open_page` never blocks over 15 s and never launches a second window when a page is connected; `code` is never passed to TTS; the page connects to the WS in both dev and served modes; nothing writes to stdout except MCP JSON-RPC; docstrings state the `get_answer` polling contract.

Then run a real end-to-end smoke without a microphone: build the web, start the server as a subprocess speaking MCP over stdio (use the `mcp` client SDK), call `open_page` with the browser launcher replaced by a headless WebSocket client that connects to 8766 (or simply connect a websockets client yourself before calling tools), call `ask` with a `code` value, assert the client received `question` (with `code`), `tts_audio` and `state listening`, send a WAV produced by the real Kokoro adapter as `answer_audio`, then call `get_answer` until `answered` and print the transcript and timings. Put it in `server/tests/smoke_e2e.py` (manual, not in the default pytest run).

## Allowed edit surfaces

server/**
web/**

## Rules

Fix only real defects, minimal changes, one regression test per fix. Do not commit. Wait for every command to finish before you end.

## Verification (report each as `<command>: <observed result>`)

- `uv run --project server pytest -q`
- `pnpm -C web test --run`
- `pnpm -C web build`
- `uv run --project server python server/tests/smoke_e2e.py`

End with: verdict per change, defects, fixes (file:line), advisories.
