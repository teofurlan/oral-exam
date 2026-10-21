# oral-exam-server

Local MCP + WebSocket server for the oral exam app.  One process, one asyncio
loop: MCP tools over stdio (for Claude Code) and a WebSocket server on
`ws://localhost:8766/ws` (for the web front).

---

## Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) installed
- The voice stack checked out at `../../kokoro-audio-test` relative to this
  repo (or set `VOICE_STACK_DIR` to the absolute path), with its Kokoro model
  files under `models/` and Whisper model cache under `models/whisper/`.
- Run `uv sync --project server` to install server and speech dependencies.

---

## Run

```bash
# From the repo root (oral-exam/)
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
| `VOICE_STACK_DIR` | `../../kokoro-audio-test` (relative to repo root) | Absolute path to the kokoro-audio-test directory |

---

## Tests

```bash
uv run --project server pytest -q
```

No real models are loaded during tests — all adapters use in-process fakes.

### Manual real-model smoke

```bash
uv run --project server python server/tests/smoke_roundtrip.py
```

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
        "C:/Users/teofu/Code/ideaslab/oral-exam/server",
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
│   ├── mcp_tools.py        # FastMCP tools: say, ask, get_answer
│   └── ws_server.py        # WebSocket server on :8766/ws
├── app.py                  # ExamApp: ties session + ports + PageChannel
├── ports.py                # SpeechSynthesizer / SpeechRecognizer protocols
└── __main__.py             # Entry point: asyncio loop running both servers
```

### WebSocket protocol

**Server → page**

| Message | Fields |
|---|---|
| `state` | `state`: `"idle"` \| `"speaking"` \| `"listening"` \| `"thinking"` |
| `question` | `index`, `total`, `text` |
| `tts_audio` | `format: "wav"`, `data: <base64>` |
| `transcript` | `text`, `final: true` |

**Page → server**

| Message | Fields |
|---|---|
| `answer_audio` | `format: "wav"`, `data: <base64>` |
| `reanswer` | _(none)_ |
| `mode` | `mode`: `"auto"` \| `"push-to-talk"` |
