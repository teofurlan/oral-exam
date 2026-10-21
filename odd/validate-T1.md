# Validation brief: T1

Read `odd/tasks/oral-exam.md` up to `## Log` and `odd/brief-T1.md`. Another model implemented T1 in `web/`. Validate it against S2, S3, S4, S7 and the brief.

Check, citing file:line:
1. `web/src/components/ui/orb.tsx` is the ElevenLabs UI Orb installed from the registry (not hand-written), and the `OrbVisualizer` mapping uses its real props.
2. Does the Orb load any remote asset (texture URL, CDN) at runtime? The app must work offline on localhost; report what it loads and from where.
3. `useExamSocket` follows the protocol section exactly (message shapes, URL), reconnect/fallback to mock is sane, no leaked timers or sockets on unmount, Re-answer sends `{"type":"reanswer"}`, mode changes send `{"type":"mode",...}`.
4. Mode defaults to `auto`, persists via localStorage with try/catch; push-to-talk Space hold does not fire while typing in an input and does not scroll the page.
5. Tests assert behavior through public interfaces, not implementation details.

## Allowed edit surfaces

web/src/**

## Rules

Fix only real defects (blockers) you find, minimal changes, add a regression test for each fix. Do not restyle or refactor. Do not commit.

## Verification (report each as `<command>: <observed result>`)

- `pnpm -C web test --run`
- `pnpm -C web build`

End with: verdict per S# (pass/fail), list of defects found, fixes made (file:line), and anything left as advisory.
