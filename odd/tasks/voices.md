Objective: offer at least three voices in Socra, defaulting to the Kokoro blend Alex 75% + Dora 25% (issue teofurlan/socra#6).
Branch: `claude/voices-4eaa72` (based on `feat/web-identity`) · Delivery: ask-on-risk · Test runners: pytest (server), Vitest (web) · Writer: Pi (gentle-pi) on the Antigravity provider, supervised by Claude.

## Specs

Quoted from issue #6:

- S1. "At least three selectable voices."
- S2. "Alex 75% + Dora 25% at speed 1.00 is the default on first run." Default voice: "Kokoro blend **Alex 75% + Dora 25%** (`em_alex` + `ef_dora`), speed 1.00, as defined in `voice/pi_voice/speech.py`".
- S3. "Changing the voice applies to the next spoken message without restarting the server."
- S4. "English technical terms keep using English phonemes (existing `terms.json` behavior)."
- S5. Proposal: "Voice selector in the settings popover with at least three options (the default plus two others, e.g. other Kokoro voices or blends)." "Optional preview of each voice." "Persist the selection."

Design (supervisor decision): catalogue `alex-dora` (default), `alex`, `santa`, `dora`, all speed 1.0. Protocol on both `/ws` and `/ws/agent`: page sends `{"type":"voice","voice":"<id>"}` (voice optional); server applies a known id and always replies `{"type":"voices","voices":[{"id","label"}],"current":"<id>"}`. The page sends its stored voice right after connecting, so it learns the list without an unsolicited message on connect. One voice per server process, shared by exam and agent mode.

## Tasks

- T1 [S1-S4] Server: voice catalogue, `KokoroTTS.set_voice`, `voice` message on both routes. Route: Pi (antigravity, gemini-3.8-flash), first pass accepted, no correction. RED: `tests/test_voices.py` collection error (no `domain.voices`) -> GREEN 4 passed; suite 167 -> 171 passed (supervisor rerun). Real Kokoro smoke: all four voices synthesize. Status: done.
- T2 [S2, S3, S5] Web plumbing: protocol types, stored voice (`socra_voice`), both socket hooks send it on connect and on change. Route: Pi (antigravity, gemini-3.8-flash, run in parallel with T1, disjoint files), first pass accepted, no correction. RED: storage and hook tests failing (`setVoice is not a function`, voices undefined) -> GREEN; web 268 passed, tsc clean (supervisor rerun). Three exact-sent assertions extended by the new `voice` message, not weakened. Status: done.
- T3 [S1, S5] Web selector: `VoicePicker.tsx` and one section in `SettingsMenu.tsx`. Route: Pi (antigravity). Status: pending.

## Log

- L1. Task from the parent session (2026-10-22): implement issue #6 with Pi writing the code and Claude supervising; units T1 server, T2 web plumbing, T3 web selector; do not touch `particleField.ts`, `ParticleVisualizer.tsx`, `OrbVisualizer.tsx` or the visualizer settings.
