# Particles Until Speech

Objective: keep the agent-mode particle field loose before the first agent session, then restore the existing gathered voice-state visualization once the session begins. Exam mode must remain unchanged.

Branch: `feat/particles-until-speech`
Runner: Vitest (`pnpm exec vitest run --maxWorkers=2`)

## Scope

- In agent mode, keep particles scattered and drifting while there is no acknowledged agent session.
- Gather particles into the selected shape once an agent session exists and the UI enters its listening or speaking flow.
- Preserve the current reduced-motion behavior.
- Do not add pointer interaction; `BackgroundPattern` already owns subtle pointer response.
- Do not change exam mode.

## Acceptance Criteria

- [x] Before a session starts, the particles are scattered, not in the sphere or wave shape.
- [x] They gather when speech starts in a session (listening or speaking).
- [x] No particle pointer reaction is added, avoiding competition with the prompt, controls, and `BackgroundPattern`.
- [x] The behavior respects `prefers-reduced-motion`.
- [x] Exam mode behaves exactly as before.

## Decisions

- **Conversation start:** use `state.session !== null`, the server-acknowledged agent session in the existing state model. Agent mode synthesizes a listening-ready input state before a session exists, so the visualizer must receive idle until the server acknowledges the session; after that, it receives the existing input protocol state. This keeps setup loose while preserving listening, thinking, and speaking visuals once the conversation is real.
- **Pointer response:** omit it. The existing mouse-reactive `BackgroundPattern` already provides ambient pointer feedback, and another interaction would duplicate or fight it.
- **Reduced motion:** keep using the particle field's existing `prefers-reduced-motion` path rather than adding a second animation policy.

## Tasks

- [x] T1 — Add an agent-mode regression test and observe RED.
- [x] T2 — Gate the visualizer state on the acknowledged session and reach GREEN.
- [x] T3 — Run the focused and required verification commands.
- [x] T4 — Commit the complete work unit with a Conventional Commit message. The writer's sandbox denied writes to the worktree Git metadata, so the parent verified and committed outside the sandbox.

## Verification Evidence

- RED: `src/AgentApp.test.tsx` failed because the pre-session visualizer exposed `data-protocol-state="listening"` instead of `"idle"` (1 failed, 21 passed).
- GREEN: focused `src/AgentApp.test.tsx` passed (22 passed). The sandbox blocks Vite's Windows child-process probes and Vitest fork workers, so the focused RED/GREEN runs used an inline child-process probe shim and Vitest's thread pool; no project files were added for the workaround.
- Full Vitest suite: the exact required command was attempted but could not load Vite configuration because the sandbox denies Vite's Windows child-process probe (`spawn EPERM`). A no-file fallback that disabled only that probe and selected Vitest's thread pool passed all 32 files and 336 tests; JSDOM canvas messages were expected noise.
- TypeScript build: `pnpm exec tsc -b` passed with no output.
- Lint: `pnpm run lint` passed with six pre-existing warnings and no new warning in the changed lines.
- Production build: the exact required command reached `tsc -b` and then hit the same Vite `spawn EPERM` restriction. Running the Vite build with the no-file child-process probe shim passed (1,983 modules transformed); only the accepted large-chunk warning remained.
- Browser visual check: not run. Automated coverage verifies the visualizer receives idle before the acknowledged session and listening/speaking after it, while the particle physics suite verifies idle scattering and reduced-motion handling.
- Parent verification outside the sandbox (2026-10-23): `pnpm exec vitest run --maxWorkers=2` 32 files / 336 tests passed; `pnpm exec tsc -b` passed; `pnpm run lint` exit 0 with only pre-existing warnings; `pnpm run build` built.
