Objective: local voice oral exam app; a Claude Code session running the `project-exam` skill drives it over MCP, and a localhost web page shows an ElevenLabs-style orb.
Branch: feat/orb-front (first slice) · Delivery: ask-on-risk · Test runner: Vitest (web), pytest (server, later).

## Specs

- S1. Exam-first scope: "Vamos a implementar la app para que me tomes exámenes directamente primero y después si quiero usarla para sesiones normales, la modifico para uso general."
- S2. Orb: "La orbe podemos utilizar directamente la de ElevenLabs entonces." Use the open-source Orb from ElevenLabs UI (github.com/elevenlabs/ui), React + Three.js.
- S3. Turn-taking modes: "que se pueda configurar ahí en el front el modo y que tenga los dos (por default el que detecta solo)". Modes: `auto` (voice activity detection ends the answer, default) and `push-to-talk`.
- S4. Raw answers: exam answers are stored and shown verbatim as transcribed; never passed through the Ollama cleaner. The page shows the transcript and lets the user re-answer.
- S5. Server: a local MCP server (Python) exposes short tools `say(text)`, `ask(question)`, `get_answer(wait_s)`; `get_answer` returns the transcript or a "still listening" status (no long blocking calls).
- S6. Reuse the existing local voice stack in `../../kokoro-audio-test` (Kokoro TTS, faster-whisper STT, `pi_voice/terms.json` glossary as Whisper `initial_prompt`).
- S7. Front runs in a normal visible browser tab (or Chrome/Edge `--app` window) on localhost, not a headless browser.

## WebSocket protocol (draft, server -> page unless noted)

- `{"type":"state","state":"idle"|"speaking"|"listening"|"thinking"}`
- `{"type":"question","index":n,"total":m,"text":"..."}`
- `{"type":"tts_audio","format":"wav","data":"<base64>"}` (page plays it; orb reacts to output volume)
- `{"type":"transcript","text":"...","final":true|false}`
- page -> server: `{"type":"answer_audio","format":"wav","data":"<base64>"}`, `{"type":"reanswer"}`, `{"type":"mode","mode":"auto"|"push-to-talk"}`

## Tasks

- T1 [S2,S3,S4,S7] Web front with mocked WebSocket state: orb, mode toggle, question + transcript panel, re-answer button. Route: delegated (Gemini 3.8 Flash via Pi, user request to save Claude quota). Status: in progress.
- T2 [S5,S6] Python MCP + WebSocket server wired to Kokoro and faster-whisper. Route: TBD. Status: pending.
- T3 [S3] Browser mic capture with VAD (auto) and push-to-talk. Route: TBD. Status: pending.
- T4 [S1] Hook `project-exam` skill to the MCP tools. Route: TBD. Status: pending.

## Log

- L1 (2026-10-20) User request, verbatim: "La orbe podemos utilizar directamente la de ElevenLabs entonces. / Dale, me alegra que sirve ese stack directamente, habría que hacerle un front a eso entonces no más. Puede ser un browser headless o algo así? / Lo que mencionas en el punto 4 me hace sentido. Vamos a implementar la app para que me tomes exámenes directamente primero y después si quiero usarla para sesiones normales, la modifico para uso general. / Sobre la decisión abierta, prefiero que el sistema detecte, pero entiendo la dificultad con eso. Lo que podemos hacer ya de entrada es que se pueda configurar ahí en el front el modo y que tenga los dos (por default el que detecta solo)"
- L2 (2026-10-20) User: "Fijate que no tengo mucho margen de la quota de claude. Empeza por tareas chicas que puedas delegar a gemini 3.8 flash en gentle-pi, puede ser?"
