# Brief: T4 — make the app usable from a Claude Code exam session

You are a delegated worker. Skip all learning-mode, learning-vault, Engram and session bookkeeping steps and do not ask the user anything. Read `odd/tasks/oral-exam.md` up to `## Log` first. You implement the server and web parts of T4 (S1, S5, S7). All code, comments and UI copy in English. Keep every existing test green.

## Allowed edit surfaces

server/**
web/**
odd/tasks/oral-exam.md

## Why

A Claude Code session running the `project-exam` skill will call the MCP tools. Today the page only exists through the Vite dev server, and the exam's "code reading" questions contain code snippets that must be shown, not read aloud by TTS.

## Changes

1. **Serve the built page from the server.** The server also serves `web/dist` over HTTP on `http://127.0.0.1:8767/` (static files, `index.html` fallback, bind 127.0.0.1 only), in the same asyncio loop. The page must connect its WebSocket to `ws://localhost:8766/ws` both in dev (Vite on 5180) and when served from 8767. All `no_client` payloads return `"url":"http://localhost:8767/"`. If `web/dist` is missing, `no_client` also returns `"hint":"run pnpm -C web build"`.
2. **New MCP tool `open_page()`.** If a page is already connected, return `{"status":"connected"}`. Otherwise launch the page as a chromeless window: try Microsoft Edge then Chrome with `--app=http://localhost:8767/` (locate executables on Windows via their standard install paths), fall back to Python `webbrowser.open`. Then wait up to 15 s for the page to connect and return `{"status":"connected"}` or `{"status":"no_client","url":...}`. Never block longer than 15 s.
3. **Code in questions.** `ask(question, index, total, glossary=None, code=None)`: `question` is the spoken text only; `code` (optional string) is shown on the page, never synthesized. Protocol: the `question` message gains an optional `code` field. Update `web/src/types/exam.ts`, the reducer and `QuestionPanel` to render `code` in a monospace, horizontally scrollable `<pre>` block under the question text. Update the protocol section of `odd/tasks/oral-exam.md` accordingly (one line).
4. **New MCP tool `finish(summary=None)`**: optionally speaks `summary`, then sends `state idle` and a `question`-less end screen message `{"type":"finished"}`; the page shows "Exam finished" instead of the question panel. Add the message to the protocol section of the spec.
5. Write clear MCP tool docstrings (they are what the calling model reads): when to use each tool, the polling contract of `get_answer` (call repeatedly while it returns `listening`), and that answers are verbatim transcripts.
6. Update `server/README.md`: registration command `claude mcp add --scope user oral-exam -- uv run --project <abs path>/server oral-exam-server`, build step `pnpm -C web build`, ports 8766 (WS) and 8767 (page).

## Tests (one per rule, through public interfaces)

Server: static file served and index fallback; `no_client` url/hint; `open_page` returns `connected` when a page is connected and does not launch a browser (inject the launcher); `open_page` times out to `no_client` with a fake launcher; `ask` with `code` sends it in the message and synthesizes only `question`; `finish` messages. Web: code block rendered when present and absent otherwise; finished screen.

## Verification (report each as `<command>: <observed result>`; wait for every command to finish, never end with a result pending)

- `uv run --project server pytest -q`
- `pnpm -C web test --run`
- `pnpm -C web build`

Do not commit. End with changed files and S# covered.
