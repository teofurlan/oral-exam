# Brief: voices T1 — server voice catalogue and `voice` message

You are working in a git worktree of the Socra project. The server is Python in `server/` (run everything below from `server/`). Code, comments and docs in English. Commit nothing, push nothing.

## Goal (GitHub issue #6, acceptance criteria verbatim)

- "At least three selectable voices."
- "Alex 75% + Dora 25% at speed 1.00 is the default on first run."
- "Changing the voice applies to the next spoken message without restarting the server."
- "English technical terms keep using English phonemes (existing `terms.json` behavior)."

## Allowed edit surfaces

server/src/socra_server/domain/voices.py (new)
server/src/socra_server/adapters/kokoro_tts.py
server/src/socra_server/entrypoints/ws_server.py
server/tests/conftest.py
server/tests/test_voices.py (new)

Do not edit any other file. In particular do not edit `voice/pi_voice/speech.py` or any existing test file other than `conftest.py`.

## What to build

1. `server/src/socra_server/domain/voices.py`: a frozen dataclass `Voice(id: str, label: str, blend: tuple[tuple[str, float], ...])` and a tuple `VOICES` with exactly these entries, in this order:
   - `alex-dora`, label `Alex 75% + Dora 25%`, blend `(("em_alex", 0.75), ("ef_dora", 0.25))`
   - `alex`, label `Alex`, blend `(("em_alex", 1.0),)`
   - `santa`, label `Santa`, blend `(("em_santa", 1.0),)`
   - `dora`, label `Dora`, blend `(("ef_dora", 1.0),)`
   Plus `DEFAULT_VOICE_ID = "alex-dora"` and `def get_voice(voice_id: object) -> Voice | None` (None for unknown ids or non-strings). Pure module: no imports of numpy or kokoro.
2. `server/src/socra_server/adapters/kokoro_tts.py` (class `KokoroTTS`):
   - `voice_id` property, starting at `DEFAULT_VOICE_ID`.
   - `set_voice(voice_id) -> bool`: returns False and changes nothing for an unknown id; otherwise stores it and returns True. Works before and after `load()`.
   - `synthesize()` speaks with the current voice: before calling `self._synthesizer.synthesize(text)`, set `self._synthesizer.style` to the blend of the current voice, computed as the sum of `self._synthesizer.engine.get_voice_style(name) * weight` over the blend. Cache the computed style per voice id. The `Synthesizer` already keeps speed 1.0, the `es` language and the `terms.json` English-phoneme segments; do not change that path, only the style.
3. `server/tests/conftest.py`: give `FakeTTS` the same `voice_id` property and `set_voice` method (use `get_voice` to validate), keeping its existing behaviour.
4. `server/src/socra_server/entrypoints/ws_server.py`: handle a new message `{"type": "voice", "voice": "<id>"}` in BOTH `_handle` (route `/ws`, use `app.loader.tts`) and `_handle_agent` (route `/ws/agent`, use `agent.loader.tts`). The `voice` field is optional. If it is present and known, call `tts.set_voice(...)`; if unknown, log a warning and keep the current voice. In every case reply on that same websocket with
   `{"type": "voices", "voices": [{"id": ..., "label": ...}, ...], "current": "<current voice id>"}` (all catalogue entries, in catalogue order). Put the reply-building in one small shared helper in `ws_server.py`. Do NOT send anything new on connect: existing tests count the messages sent on connect.

## Test first

Write `server/tests/test_voices.py` FIRST and run it to see it fail (RED), then implement until it passes (GREEN). Cover:
- the catalogue has at least three voices, unique ids, `DEFAULT_VOICE_ID == "alex-dora"` with blend em_alex 0.75 + ef_dora 0.25, `get_voice("nope") is None`;
- `KokoroTTS` with a fake synthesizer (an object with `engine.get_voice_style(name)` returning numpy arrays, a `style` attribute, and a `synthesize(text)` returning `(b"wav", 1.0)`), injected by setting `tts._synthesizer` directly, no model load: default style equals `alex*0.75 + dora*0.25`; after `set_voice("santa")` the next `synthesize` uses the santa style; `set_voice("nope")` returns False and keeps the voice;
- on `/ws` and on `/ws/agent` (copy the connection fixtures/pattern from `tests/test_ws_protocol.py` and `tests/test_agent_route.py`): sending `{"type":"voice","voice":"dora"}` gets a `voices` reply with `current == "dora"` and at least three voices, and the loader's tts now reports `voice_id == "dora"`; sending `{"type":"voice","voice":"nope"}` replies with the unchanged current voice; sending `{"type":"voice"}` replies with the current voice.

## Verification (run each, report as `<command>: <observed result>`)

- `uv run pytest -q tests/test_voices.py` (show the RED run first, then GREEN)
- `uv run pytest -q` (the whole suite must pass)

At the end, list the files you changed and the RED/GREEN evidence. Commit nothing, push nothing.
