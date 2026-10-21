# oral-exam-server

Local voice exam server. One process, one asyncio loop:

- MCP tools over stdio for Claude Code.
- WebSocket on `ws://localhost:8766/ws` (port 8766).
- Built exam page on `http://localhost:8767/` (port 8767), with static assets and
  an `index.html` fallback for page routes.

Both network listeners bind only to `127.0.0.1`. The page uses the same WebSocket
URL in development (Vite on 5180) and when served by the Python server on 8767.

---

## Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) installed
- The voice stack checked out at `voice/` in this
  repo (or set `VOICE_STACK_DIR` to the absolute path), with its Kokoro model
  files under `models/` and Whisper model cache under `models/whisper/`.
- Run `uv sync --project server` to install server and speech dependencies.

---

## Build and register with Claude Code

From the repository root, build the page once (and again after web changes):

```bash
pnpm -C web build
```

Register the MCP server for your user, replacing `<abs path>` with the absolute
path to this repository. Quote the path if it contains spaces:

```bash
claude mcp add --scope user oral-exam -- uv run --project "<abs path>/server" oral-exam-server
```

An exam session calls `open_page()` first. If no page is connected, it opens a
visible Edge app window, then tries Chrome, then the default browser. It waits
at most 15 seconds for a connection. All `no_client` responses point to
`http://localhost:8767/`; if the page has not been built, they also include
`"hint":"run pnpm -C web build"`.

## Run

```bash
# From the repo root (oral-exam/); Claude Code normally starts this via MCP.
uv run --project server oral-exam-server
```

Or from inside `server/`:

```bash
uv run oral-exam-server
```

The MCP handshake is instant; the Kokoro and Whisper models load lazily in a
background thread so the first `say`/`ask` call may take a few
seconds (or longer on a cold model cache). Whisper retries inference on CPU
if CUDA initializes but its runtime libraries are unavailable. Transcription
failures are logged, not returned as fabricated empty answers.

Only MCP JSON-RPC uses stdout. Python prints, library warnings and native
speech-library stdout are redirected to stderr before model loading.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `VOICE_STACK_DIR` | `voice/` (relative to repo root) | Absolute path to the kokoro-audio-test directory |

---

## Tests

```bash
uv run --project server pytest -q server/tests
```

No real models are loaded during tests — all adapters use in-process fakes.

### Manual real-model smokes

```bash
# Strict MCP + WebSocket round trip; requires free ports 8766 and 8767.
pnpm -C web build
uv run --project server python server/tests/smoke_e2e.py

# Adapter-only round trip.
uv run --project server python server/tests/smoke_roundtrip.py
```

The strict smoke starts its own server, reuses a headless WebSocket client
without opening a browser or microphone, checks display-only question code,
and polls a real Kokoro-generated answer through Whisper and MCP. It prints
its transcript and timings and fails on protocol contamination or missing tools.

This standalone script is excluded from default pytest collection. It loads the
real adapters, synthesizes the Spanish process/thread sentence, transcribes the
WAV without a cleaner, and prints the transcript, WAV duration and timings.
An empty transcript fails the smoke. Initial model loading may access the
Whisper cache or download missing model files.

---

## `.mcp.json` snippet for Claude Code

Add this to your project's `.mcp.json` (or `~/.claude/mcp.json`), replacing
`<abs-path>` with the absolute path to this repo's root:

```json
{
  "mcpServers": {
    "oral-exam": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "<abs-path>/server",
        "oral-exam-server"
      ]
    }
  }
}
```

Example (Windows):

```json
{
  "mcpServers": {
    "oral-exam": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "<absolute path to>/oral-exam/server",
        "oral-exam-server"
      ]
    }
  }
}
```

---

## Architecture

```
oral_exam_server/
├── domain/
│   └── session.py          # Pure ExamSession state — no I/O
├── adapters/
│   ├── kokoro_tts.py       # Wraps pi_voice.speech.Synthesizer (lazy load)
│   └── whisper_stt.py      # Wraps dictation.WhisperTranscriber (lazy load)
├── entrypoints/
│   ├── mcp_tools.py        # open_page, say, ask, get_answer, finish
│   ├── http_server.py      # Built page on 127.0.0.1:8767
│   └── ws_server.py        # WebSocket server on 127.0.0.1:8766/ws
├── app.py                  # ExamApp: ties session + ports + PageChannel
├── ports.py                # SpeechSynthesizer / SpeechRecognizer protocols
└── __main__.py             # One asyncio loop for MCP, WebSocket and HTTP
```

### MCP exam flow

1. `open_page()` returns `connected` or `no_client` (with the URL/build hint).
2. `say(text)` speaks instructions or feedback; it does not begin listening.
3. `ask(question, index, total, glossary=None, code=None)` shows the numbered
   question, speaks only `question`, and begins listening. Put code snippets in
   `code`, not in the spoken text. `glossary` supplies optional STT term hints.
4. Call `get_answer(wait_s=20)` **repeatedly while it returns `listening`**.
   Each call waits 1–25 seconds. `answered` includes `index` and `text`: the
   verbatim transcript, never cleaned or rewritten. Preserve it as received.
5. `finish(summary=None)` optionally speaks a summary, then sends idle and
   finished. The page replaces the question panel with **Exam finished**.

Speech tools return after synthesis/delivery, not after browser audio playback.

### WebSocket protocol

**Server → page**

| Message | Fields |
|---|---|
| `state` | `state`: `"idle"` \| `"speaking"` \| `"listening"` \| `"thinking"` |
| `question` | `index`, `total`, `text`, optional display-only `code` |
| `tts_audio` | `format: "wav"`, `data: <base64>` |
| `transcript` | `text`, `final: true` |
| `finished` | No fields; sent after `state: idle` |

**Page → server**

| Message | Fields |
|---|---|
| `answer_audio` | `format: "wav"`, `data: <base64>` |
| `reanswer` | _(none)_ |
| `mode` | `mode`: `"auto"` \| `"push-to-talk"` |
