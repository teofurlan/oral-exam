Objective: local voice oral exam app; a Claude Code session running the `project-exam` skill drives it over MCP, and a localhost web page shows an ElevenLabs-style orb.
Branch: feat/orb-front (first slice) · Delivery: ask-on-risk · Test runner: Vitest (web), pytest (server, later).

## Specs

- S1. Exam-first scope: "Vamos a implementar la app para que me tomes exámenes directamente primero y después si quiero usarla para sesiones normales, la modifico para uso general."
- S2. Orb: "La orbe podemos utilizar directamente la de ElevenLabs entonces." Use the open-source Orb from ElevenLabs UI (github.com/elevenlabs/ui), React + Three.js.
- S3. Turn-taking modes: "que se pueda configurar ahí en el front el modo y que tenga los dos (por default el que detecta solo)". Modes: `auto` (voice activity detection ends the answer, default) and `push-to-talk`.
- S4. Raw answers: exam answers are stored and shown verbatim as transcribed; never passed through the Ollama cleaner. The page shows the transcript and lets the user re-answer.
- S5. Server: a local MCP server (Python) exposes short tools `say(text)`, `ask(question)`, `get_answer(wait_s)`; `get_answer` returns the transcript or a "still listening" status (no long blocking calls).
- S6. Reuse the local voice stack, now in `voice/` (moved from the former kokoro-audio-test folder) (Kokoro TTS, faster-whisper STT, `pi_voice/terms.json` glossary as Whisper `initial_prompt`).
- S7. Front runs in a normal visible browser tab (or Chrome/Edge `--app` window) on localhost, not a headless browser.

## WebSocket protocol (draft, server -> page unless noted)

- `{"type":"state","state":"idle"|"speaking"|"listening"|"thinking"}`
- `{"type":"question","index":n,"total":m,"text":"...","code":"..."}` (`code` optional, display-only; only `text` is spoken)
- `{"type":"tts_audio","format":"wav","data":"<base64>"}` (page plays it; orb reacts to output volume)
- `{"type":"transcript","text":"...","final":true|false}`
- `{"type":"finished"}` (question-less end screen, sent after `state idle`; optional summary is spoken first)
- page -> server: `{"type":"answer_audio","format":"wav","data":"<base64>"}`, `{"type":"reanswer"}`, `{"type":"mode","mode":"auto"|"push-to-talk"}`

## Tasks

- T1 [S2,S3,S4,S7] Web front with mocked WebSocket state: orb, mode toggle, question + transcript panel, re-answer button. Route: delegated (Gemini 3.8 Flash via Pi, user request to save Claude quota). Validated by GPT 6.1 Sol (4 defects fixed: remote Perlin texture, TTS playback, socket lifecycle, Space hold). 38 tests pass, build OK, mock driver visually checked. Status: done.
- T2 [S4,S5,S6] Python MCP + WebSocket server wired to Kokoro and faster-whisper. Route: delegated (Sonnet 4.6 via Antigravity in Pi builds, GPT 6.1 Sol validates; needs more judgment than Flash: asyncio + MCP stdio + audio). Brief: odd/brief-T2.md. GPT added regressions for: glossary to recognizer, malformed messages, page replacement, in-flight audio after reanswer, answer during wait, MCP handshake not blocked by noisy model load, Whisper CUDA->CPU fallback, readiness awaited off-loop (its final report was cut off; fixes inferred from its tests). 49 tests pass; real Kokoro->Whisper roundtrip OK (load 17s once, synth 3.1s, STT 2.3s; "thread" heard as "triad": not in terms.json). Status: done.
- T3 [S3,S4] Browser mic capture with VAD (auto) and push-to-talk. Route: delegated (Sonnet 4.6 via Pi builds, GPT 6.1 Sol validates). Briefs: odd/brief-T3.md, odd/validate-T3.md. Sonnet run exited 1 but left the implementation; GPT fixed capture during speaking, stale init, leaks, finalization latch, listening->listening re-answer, VAD asset paths, then a bounded fix so the silence counts from the last speech frame. 104 tests pass, build OK, VAD assets local, permission-denied banner checked in browser. Advisory: push-to-talk rejects silence by RMS, not speech (Whisper vad_filter covers it). Real mic untested. Status: done.
- T4 [S1,S5,S7] Hook `project-exam` skill to the MCP tools. Route: server+web delegated (Sonnet 4.6 builds, GPT validates; briefs odd/brief-T4.md, odd/validate-T4.md); skill edit and MCP registration inline by Claude. Sonnet and Gemini Pro hit Antigravity quota (no changes); GPT 6.1 Sol implemented it instead. Added HTTP page on 8767 (path-confined), open_page, ask code field, finish. 59 server + 107 web tests pass; real MCP stdio + WS + Kokoro + Whisper smoke (server/tests/smoke_e2e.py) passes, rerun by Claude. project-exam skill got an Oral Mode section; MCP registered at user scope as oral-exam. Not exercised: real browser launch and mic. Status: done.

## Log

- L1 (2026-10-20) User request, verbatim: "La orbe podemos utilizar directamente la de ElevenLabs entonces. / Dale, me alegra que sirve ese stack directamente, habría que hacerle un front a eso entonces no más. Puede ser un browser headless o algo así? / Lo que mencionas en el punto 4 me hace sentido. Vamos a implementar la app para que me tomes exámenes directamente primero y después si quiero usarla para sesiones normales, la modifico para uso general. / Sobre la decisión abierta, prefiero que el sistema detecte, pero entiendo la dificultad con eso. Lo que podemos hacer ya de entrada es que se pueda configurar ahí en el front el modo y que tenga los dos (por default el que detecta solo)"
- L2 (2026-10-20) User: "Fijate que no tengo mucho margen de la quota de claude. Empeza por tareas chicas que puedas delegar a gemini 3.8 flash en gentle-pi, puede ser?"
- L3 (2026-10-20) WebSocket port moved 8765 -> 8766 (8765 is used by the pricor-demo launch config).
- L4 (2026-10-21) Smoke roundtrip: Spanish TTS mispronounces English terms missing from terms.json; add them to the glossary or pass a per-exam glossary.
- L5 (2026-10-21) User: "unifica los proyectos en este, y también asigna todas las notas de obsidian que correspondan a este proyecto. Una vez hecho eso, borramos el proyecto anterior". Voice stack moved to voice/ (models, venv, caches gitignored), vault folder renamed to Projects/Oral-Exam and registered for this repo, old Code-root registry entry removed, old kokoro-audio-test folder deleted.
- L6 (2026-10-21) User: "socra me gusta como nombre, renombra el repo local y remoto". GitHub repo renamed to teofurlan/socra; local folder copied to ideaslab/socra (the old folder stays until the session holding it as cwd closes); MCP, Pi extension, launch config, learning registry, vault index and project-exam skill repointed. MCP server name, Python package and vault folder keep their old names for now.
