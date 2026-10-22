# Brief: voices T2 — web voice plumbing (types, storage, socket hooks)

You are working in a git worktree of the Socra project. The web app is React + Vite + TypeScript in `web/` (pnpm). Run everything below from `web/`. Code, comments and docs in English. Commit nothing, push nothing. No UI in this unit.

## Goal (GitHub issue #6, quoted verbatim)

- "Alex 75% + Dora 25% at speed 1.00 is the default on first run."
- "Changing the voice applies to the next spoken message without restarting the server."
- "Persist the selection."

## Server protocol (already implemented, on both `/ws` and `/ws/agent`)

- Page -> server: `{"type":"voice","voice":"<id>"}`; the `voice` field is optional. A known id becomes the server's current voice.
- Server -> page, in reply to every `voice` message: `{"type":"voices","voices":[{"id":"alex-dora","label":"Alex 75% + Dora 25%"}, ...],"current":"<id>"}`.
- The server sends nothing about voices on connect; the page asks by sending a `voice` message right after it connects.

## Allowed edit surfaces

web/src/types/voice.ts (new)
web/src/types/exam.ts
web/src/types/agent.ts
web/src/lib/storage.ts
web/src/lib/storage.test.ts
web/src/hooks/useExamSocket.ts
web/src/hooks/useExamSocket.test.ts
web/src/hooks/useAgentSocket.ts
web/src/hooks/useAgentSocket.test.ts

Do not edit any other file (another session is editing visualizer and settings files in parallel).

## What to build

1. `web/src/types/voice.ts`: `VoiceOption { id: string; label: string }`, `VoiceCatalog { voices: VoiceOption[]; current: string | null }`, `EMPTY_VOICE_CATALOG: VoiceCatalog = { voices: [], current: null }`, `VoicesMessage = { type: 'voices'; voices: VoiceOption[]; current: string }`, `VoiceMessage = { type: 'voice'; voice?: string }`. Add `VoicesMessage` to `ServerMessage` (exam.ts) and `AgentServerMessage` (agent.ts); add `VoiceMessage` to `ClientMessage` and `AgentClientMessage`.
2. `web/src/lib/storage.ts`: append (do not reorder existing code) `STORAGE_KEY_VOICE = 'socra_voice'`, `getStoredVoice(): string | null` (null when unset or empty, or on a storage error) and `setStoredVoice(id: string): void`, with the same try/catch + `console.warn` style as the functions above. There is deliberately no web-side default id: when nothing is stored, the server's default (Alex 75% + Dora 25%) applies.
3. Both hooks (`useExamSocket`, `useAgentSocket`):
   - Keep a `useState<VoiceCatalog>(EMPTY_VOICE_CATALOG)`. When a `voices` message arrives, set it to `{ voices, current }` and do NOT pass that message to the reducer (`dispatch`).
   - Right after the socket opens (after the existing `mode` / `agent_hello` message), send `{ type: 'voice', voice: <stored id> }` if `getStoredVoice()` returns an id, else `{ type: 'voice' }`.
   - Return `voices` (the `VoiceCatalog`) and `setVoice(id: string)`. `setVoice` calls `setStoredVoice(id)`, updates `current` locally right away (optimistic), and sends `{ type: 'voice', voice: id }` when the socket is open. In the exam hook's mock mode (no socket) `setVoice` only stores and updates local state.
   - Do not change any other behaviour of the hooks.

## Test first

Add the tests FIRST, run them and see them fail (RED), then implement (GREEN):
- `storage.test.ts`: `getStoredVoice()` is null when unset; set then get round-trips; a throwing `localStorage` returns null without throwing.
- `useAgentSocket.test.ts` and `useExamSocket.test.ts` (use the existing `FakeWebSocket` helpers in `src/test/fakeSocket.ts`, follow the existing tests' style): on open with nothing stored the hook sends `{ type: 'voice' }`; with `socra_voice` stored as `dora` it sends `{ type: 'voice', voice: 'dora' }`; a received `voices` message shows up in `result.current.voices`; `setVoice('santa')` stores `santa` in `localStorage`, sends `{ type: 'voice', voice: 'santa' }` and sets `voices.current` to `santa`.
- Existing tests that assert the EXACT list of messages sent on open (for example `expect(ws.sent()).toEqual([{ type: 'agent_hello' }])` in `useAgentSocket.test.ts`, and any `ws.sent().slice(1)` that now shifts) must be updated only to account for the one new `{ type: 'voice' }` message; do not weaken them in any other way. Clear `localStorage` in `beforeEach` where needed.

## Verification (run each, report as `<command>: <observed result>`)

- `pnpm vitest run src/lib/storage.test.ts src/hooks` (RED first, then GREEN)
- `pnpm vitest run` (whole suite must pass)
- `pnpm exec tsc -b` (must be clean)

At the end, list the files you changed and the RED/GREEN evidence. Commit nothing, push nothing.
