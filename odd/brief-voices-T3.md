# Brief: voices T3 — voice selector in the settings menu

You are working in a git worktree of the Socra project. The web app is React + Vite + TypeScript in `web/` (pnpm). Run everything below from `web/`. Code, comments and UI copy in English. Commit nothing, push nothing.

## Goal (GitHub issue #6, quoted verbatim)

- "At least three selectable voices."
- "Voice selector in the settings popover with at least three options (the default plus two others, e.g. other Kokoro voices or blends)."
- "Persist the selection."

## What already exists (do not change it)

- `web/src/types/voice.ts`: `VoiceOption { id; label }`, `VoiceCatalog { voices: VoiceOption[]; current: string | null }`.
- `useExamSocket()` and `useAgentSocket()` both return `voices: VoiceCatalog` and `setVoice(id: string)`; `setVoice` already persists the choice and tells the server. The list comes from the server and is empty until the server answers (or in the exam mock mode).
- `web/src/components/ChoiceList.tsx`: the terminal-style single-choice list used for the microphone setting. Reuse it; do not write a new list widget.

## Allowed edit surfaces

web/src/components/VoicePicker.tsx (new)
web/src/components/VoicePicker.test.tsx (new)
web/src/components/SettingsMenu.tsx
web/src/components/SettingsMenu.test.tsx
web/src/App.tsx
web/src/AgentApp.tsx

Another session is editing `SettingsMenu.tsx`, `App.tsx` and the visualizer files in parallel, so keep your edits to those files as SMALL as described below. Do not touch `particleField.ts`, `ParticleVisualizer.tsx`, `OrbVisualizer.tsx`, `visualizers.ts` or the visualizer/shape settings.

## What to build

1. `web/src/components/VoicePicker.tsx`: `export function VoicePicker({ voices, current, onChange }: { voices: VoiceOption[]; current: string | null; onChange: (id: string) => void })`. It renders `<ChoiceList label="Voice" value={current ?? ''} onChange={onChange} groups={[{ choices: voices.map(v => ({ value: v.id, label: v.label })) }]} empty="Voices load when the server connects." />`, wrapped in an element with `data-testid="voice-picker"`. No preview button.
2. `web/src/components/SettingsMenu.tsx` — exactly two additions, nothing else:
   - in `SettingsMenuProps`, one new optional prop: `/** Omit to hide the voice choice. */ voicePicker?: ReactNode`, and destructure it;
   - one new block placed right after the Microphone `<Section>`: `{voicePicker && <Section title="Voice" testId="voice-control">{voicePicker}</Section>}`.
3. `web/src/App.tsx`: also destructure `voices, setVoice` from `useExamSocket()` and pass `voicePicker={<VoicePicker voices={voices.voices} current={voices.current} onChange={setVoice} />}` to `SettingsMenu`. Nothing else.
4. `web/src/AgentApp.tsx`: the same, using `socket.voices` and `socket.setVoice` from `useAgentSocket()`. Nothing else.

## Test first

Write the tests FIRST, run them and see them fail (RED), then implement (GREEN):
- `VoicePicker.test.tsx` (Testing Library, same style as `SettingsMenu.test.tsx`): renders one option per voice (three voices given: `alex-dora` "Alex 75% + Dora 25%", `alex` "Alex", `santa` "Santa"); the `current` one is the checked option (inspect `ChoiceList` to see which ARIA role/attribute marks it); clicking "Santa" calls `onChange('santa')`; with an empty list it shows "Voices load when the server connects.".
- `SettingsMenu.test.tsx`: add two tests: with `voicePicker={<div data-testid="vp" />}` the panel shows a "Voice" section containing `vp`; without the prop there is no `voice-control` section.

## Verification (run each, report as `<command>: <observed result>`)

- `pnpm vitest run src/components/VoicePicker.test.tsx src/components/SettingsMenu.test.tsx` (RED first, then GREEN)
- `pnpm vitest run` (whole suite must pass)
- `pnpm exec tsc -b` (must be clean)

At the end, list the files you changed and the RED/GREEN evidence. Commit nothing, push nothing.
