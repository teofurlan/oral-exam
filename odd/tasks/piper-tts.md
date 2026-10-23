# Piper TTS (es_AR daniela)

Objective: replace Kokoro with Piper `es_AR-daniela-high` as the server's text-to-speech, spoken slightly slower, with English technical terms read with English phonemes.
Branch: `feat/piper-tts` (from `origin/main` fd2aeb9) · Delivery: ask-on-risk · TDD: on (project convention RED -> GREEN), runner: pytest (`uv run --project server pytest -q server/tests`) · Engram mirror `odd/piper-tts/tasks`: pending (Engram MCP disconnected this session).

## Problem

The user dislikes the Kokoro voices. In a blind listening test (2026-10-22, lab in `../socra-voice-lab`, outside the repo) Kokoro scored 1/5 and "no"; Piper `es_AR-daniela-high` scored 4/5, Rioplatense, English terms fine. Qwen3-TTS voice cloning scored slightly higher but needs a GPU; Piper runs on CPU (RTF ~0.2, ~0.34 GB RAM), which fits the goal of running on any decent PC.

## Decisions

- D1. Piper replaces Kokoro in the server; the Kokoro server adapter and the `kokoro-onnx` server dependency go away. The `voice/` stack (Pi extension) keeps Kokoro and is not touched.
- D2. Speed: Piper `length_scale` (> 1 is slower). Default 1.2, set per voice in the catalogue and overridable with `SOCRA_TTS_LENGTH_SCALE`. The user heard 1.1 and still wants it slower.
- D3. Glossary: reuse `voice/pi_voice/terms.json` (same file Kokoro used; its keys also feed Whisper's prompt). Terms are matched longest-first on word boundaries, phonemized with espeak `en-us` and inlined as Piper raw phonemes `[[ ... ]]`. The user compared plain vs English phonemes by ear and preferred English. daniela's phoneme map contains every English IPA symbol espeak emits.
- D4. The glossary logic moves into the server domain (`domain/glossary.py`), because `voice/pi_voice/speech.py` imports `kokoro_onnx` at module level.
- D5. Model files come from Hugging Face `rhasspy/piper-voices` through `huggingface_hub` (cached, already a faster-whisper dependency).
- D6. Licensing: `piper-tts` is GPL-3.0-or-later (Socra is MIT); this matches the existing GPL dependencies through Kokoro (`phonemizer`, espeak-ng). The daniela voice is trained on OpenSLR 61 (CC BY-SA 4.0). Both are recorded in `THIRD_PARTY_NOTICES.md`; packaging implications go to #31.

## Tasks

- [x] T1 Glossary in the server domain: load `terms.json`, segment text into Spanish and English parts. Route: delegated writer (writer trigger: several non-trivial files across T1-T2). RED: collection error, no `socra_server.domain.glossary` -> GREEN `test_glossary.py` 15 passed.
- [x] T2 `PiperTTS` adapter, Piper voice catalogue, loader wiring, Kokoro adapter removal, dependency swap, tests and smoke scripts updated. Route: same delegated writer. RED: collection error, no `socra_server.adapters.piper_tts` -> GREEN `test_piper_tts.py` 12 passed; server suite 258 passed.
- [x] T3 Docs (`server/README.md`, `PRODUCT.md`, `THIRD_PARTY_NOTICES.md`), glossary terms, real smoke with the Piper model, listening samples at 1.2 and 1.3. Route: inline. Added 13 terms to `voice/pi_voice/terms.json` (hook, refactor, feature, diff, bug, loop, WebSocket, socket, push, piper and plurals); voice stack unittest 9 OK.

## Acceptance criteria

- The server speaks with Piper daniela at length_scale 1.2 by default; `SOCRA_TTS_LENGTH_SCALE` overrides it.
- Glossary terms are spoken with English phonemes; Whisper still receives the glossary terms.
- The voice protocol (`voice` / `voices` messages) keeps working with the Piper catalogue.
- Server suite green; web suite unaffected.

## Log

- L1 (2026-10-22): feature document created after the blind test and the plain-vs-English glossary listening check.
- L2 (2026-10-22): the writer could not run `uv sync --project server` because a running `socra-server.exe` (started by the user, not an orphan) locks `server/.venv/Scripts/socra-server.exe`. Verification ran in a separate environment (`UV_PROJECT_ENVIRONMENT` in the session scratchpad): server suite 258 passed. `server/.venv` gets `piper-tts` on the next `uv sync` / `uv run` after that server stops.
- L3 (2026-10-22): real smoke through `PiperTTS`: model download and load 8.0 s (first run), the four test sentences in 0.9-1.2 s each at length_scale 1.2; "build" was inlined as `[[ bˈɪld ]]`. Not verified: hearing the result inside the live page, because the running server still holds the old code.
- L4 (2026-10-22): glossary caveat kept from Kokoro: `terminal` is in `terms.json` and is also a Spanish word, so "la terminal" gets English phonemes. Left unchanged; the user can judge by ear.
