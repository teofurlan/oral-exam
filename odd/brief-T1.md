# Brief: T1 — orb web front with mocked state

Read `odd/tasks/oral-exam.md` up to `## Log` first. You implement T1 only (S2, S3, S4, S7). All code, comments and UI copy in English.

## Allowed edit surfaces

web/**

## What to build

A Vite + React + TypeScript app in `web/`, using pnpm.

1. Install the ElevenLabs UI Orb component (shadcn-based registry; docs: https://ui.elevenlabs.io, repo github.com/elevenlabs/ui). Set up Tailwind + shadcn in `web/` as that component requires, then add it with `pnpm dlx shadcn@latest add https://ui.elevenlabs.io/r/orb.json` (if that URL fails, try `pnpm dlx @elevenlabs/agents-cli@latest components add orb`). Do NOT hand-write a replacement orb. If both installs fail, stop and report the exact errors.
2. Single full-screen dark page: orb centered; below it the current question ("Question 3/10" + text) and the live transcript of the user's answer; a "Re-answer" button; a settings control to pick the turn mode `auto` (default) or `push-to-talk`, persisted in localStorage (wrap access in try/catch). In push-to-talk mode show a hold-to-talk button and support holding the Space key.
3. Orb state: map protocol states (`idle`, `speaking`, `listening`, `thinking`) to the Orb's agent state props. Read the Orb's real props from the installed source file; do not guess.
4. Connection: a `useExamSocket` hook connecting to `ws://localhost:8765/ws` implementing the protocol section of the spec doc. When the socket is not available, fall back to a mock driver (enabled with `?mock=1` or automatically after a failed connect) that cycles: thinking -> question -> speaking (3s) -> listening with a fake partial transcript -> final transcript -> next question.
5. Keep presentational components (Orb wrapper, QuestionPanel, ModeToggle) separate from the hook/state logic.

## Tests

Vitest + Testing Library: (a) mode defaults to `auto` and persists the change; (b) the reducer that applies protocol messages updates state/question/transcript correctly; (c) Re-answer sends `{"type":"reanswer"}`.

## Verification (run and report each as `<command>: <observed result>`)

- `pnpm -C web install`
- `pnpm -C web test --run`
- `pnpm -C web build`

Do not commit. Do not touch files outside `web/`. At the end, list the files you created and which S# you covered.
