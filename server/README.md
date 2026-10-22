# socra-server

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
claude mcp add --scope user socra -- uv run --project "<abs path>/server" socra-server
```

An exam session calls `open_page()` first. If no page is connected, it opens a
visible Edge app window, then tries Chrome, then the default browser. It waits
at most 15 seconds for a connection. All `no_client` responses point to
`http://localhost:8767/`; if the page has not been built, they also include
`"hint":"run pnpm -C web build"`.

## Run

```bash
# From the repo root (socra/); Claude Code normally starts this via MCP.
uv run --project server socra-server
```

Or from inside `server/`:

```bash
uv run socra-server
```

The MCP handshake is instant; the Kokoro and Whisper models load lazily in a
background thread so the first `say`/`ask` call may take a few
seconds (or longer on a cold model cache). Whisper retries inference on CPU
if CUDA initializes but its runtime libraries are unavailable. Transcription
failures are logged, not returned as fabricated empty answers.

Only MCP JSON-RPC uses stdout. Python prints, library warnings and native
speech-library stdout are redirected to stderr before model loading.

### Agent mode

Agent mode drives an agent by voice in a folder you choose. Two backends are
available: Claude Code (through the Claude Agent SDK) and Pi (`pi --mode rpc`,
with your gentle-pi extensions and your GPT, Gemini or other Pi providers).
Start it without an MCP client:

```bash
uv run --project server socra-server --agent
```

This runs the HTTP and WebSocket servers without MCP stdio and opens
`http://localhost:8767/?mode=agent`. If Socra is already running (for example
as the exam MCP server), it only opens the page. The page talks to
`ws://localhost:8766/ws/agent`; the exam keeps using `/ws`.

- The folder is chosen with the native OS dialog, which the server opens:
  browsers never hand a page an absolute path.
- Tool calls follow your Claude Code permission settings. Only calls those
  settings mark as "ask" show Allow / Deny on the page; with
  `defaultMode: bypassPermissions` nothing asks.
- Claude Code must be logged in (`claude auth login`); the page shows the
  backend as not configured otherwise.
- Pi is found on `PATH` or in `~/.pi/agent/bin`. Its model list shows the
  models of every provider Pi is logged in to (`/login` inside `pi`), in
  Pi's order; Pi's default provider is not preferred, and the session always
  starts with the provider and model you pick. The first list skips Pi's
  extensions (about 1 s); a background refresh with extensions (about 20 s)
  adds the providers they bring, such as Antigravity, and is saved in
  `%LOCALAPPDATA%\Socra\pi-models.json` (`~/.cache/Socra` elsewhere) so the
  next start shows them at once. Reload the page to see them the first time.
  Starting a Pi session loads your extensions and can take up to a minute.
- Pi does not ask before tool calls by itself; it follows its own settings
  (gentle-pi's Normal / Auto / YOLO mode). When an extension asks for a
  confirmation, such as gentle-pi before a recognized data-loss command, the
  page shows Allow / Deny. Pi questions that need a choice or free text are
  cancelled, since they cannot be answered by voice yet.

For a one-click desktop shortcut (Windows):

```powershell
powershell -ExecutionPolicy Bypass -File server\install-shortcut.ps1
# Remove it again:
powershell -ExecutionPolicy Bypass -File server\install-shortcut.ps1 -Remove
```

The shortcut runs `.venv\Scripts\pythonw.exe -m socra_server --agent` with no
console window; anything the server prints goes to `server/logs/socra-agent.log`.
Agent mode stops by itself once no agent page has been open for two minutes
(`SOCRA_AGENT_IDLE_S`), which frees ports 8766 and 8767. An exam MCP server
that started meanwhile keeps retrying those ports every few seconds and takes
them over, so exam mode works again without restarting Claude Code. Exam and
agent mode cannot run at the same time: they share the same two ports.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `VOICE_STACK_DIR` | `voice/` (relative to repo root) | Absolute path to the voice stack directory |
| `SOCRA_WHISPER_MODEL` | `large-v3-turbo` | Faster-whisper model (`base`, `small`, `large-v3-turbo`, etc.) |
| `SOCRA_WHISPER_DEVICE` | `auto` | Execution device: `auto` (CUDA float16 if available, else CPU int8), `cuda`, or `cpu` |

### Whisper Model Benchmark (RTX 4060 8 GB)

Benchmark of Spanish answer transcription using Kokoro-synthesized audio:
- **A1** (3.09s): *"El río más largo de Sudamérica es el Amazonas."*
- **A2** (4.24s): *"No recuerdo bien, pero creo que fue en mil cuatrocientos noventa y dos."*

| Model | Device | Load Time (cached) | A1 Time | A1 Transcript | A2 Time | A2 Transcript |
|---|---|---|---|---|---|---|
| `base` | cuda (float16) | 1.86 s | 0.60 s | "El río más largo de Sudamérica es el Amazonas." | 0.15 s | "No recuerdo bien, pero creo que fue en 1492." |
| `small` | cuda (float16) | 1.24 s | 0.30 s | "El río más largo de Sudamérica es el Amazonas." | 0.26 s | "No recuerdo bien, pero creo que fue en 1492." |
| `large-v3-turbo` | cuda (float16) | 4.35 s | 0.55 s | "El río más largo de Sudamérica es el Amazonas." | 0.43 s | "No recuerdo bien, pero creo que fue en 1492." |

**Chosen default: `large-v3-turbo`**.
All models comfortably beat the <= 3.0 s transcription budget on the RTX 4060 (taking <= 0.6 s for ~5 s of audio). `large-v3-turbo` provides the highest recognition accuracy and robustness against accents/slang, while executing in ~0.5 s.

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
    "socra": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "<abs-path>/server",
        "socra-server"
      ]
    }
  }
}
```

Example (Windows):

```json
{
  "mcpServers": {
    "socra": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "<absolute path to>/socra/server",
        "socra-server"
      ]
    }
  }
}
```

---

## Architecture

```
socra_server/
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

Speech tools `say()` and `ask()` wait for browser playback (`playback_done`) with timeout = WAV duration + 2 s before returning or transitioning to `listening`.

### WebSocket protocol

**Server → page**

| Message | Fields |
|---|---|
| `state` | `state`: `"idle"` \| `"speaking"` \| `"listening"` \| `"thinking"` |
| `question` | `index`, `total`, `text`, optional display-only `code` |
| `tts_audio` | `format: "wav"`, `data: <base64>` |
| `transcript` | `text`, `final: true` |
| `notice` | `text`: temporary notice (e.g. non-answer rejection) |
| `finished` | No fields; sent after `state: idle` |

**Page → server**

| Message | Fields |
|---|---|
| `answer_audio` | `format: "wav"`, `data: <base64>` |
| `playback_done` | Sent when `tts_audio` playback completes or fails |
| `reanswer` | _(none)_ |
| `mode` | `mode`: `"auto"` \| `"push-to-talk"` |
