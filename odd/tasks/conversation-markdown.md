# Conversation Markdown

Objective: Render the safe Markdown subset from issue #20 in agent conversation messages without changing fenced-code routing or exam mode.
Branch: `feat/conversation-markdown`. Delivery: one web work-unit commit; add a separate server commit only if speech cleanup needs code changes. Runners: Vitest and TypeScript/oxlint/Vite for web, pytest for server when changed.

## Specs

- S1: Reply and user-message Markdown renders bold, italic, inline code, lists, headings, links, and block quotes without exposing formatting markers.
- S2: Fenced code continues to render as the existing `CodePointer` and opens through the existing code-panel flow.
- S3: Raw HTML is never executed or interpreted as markup; rendering must use React elements without `dangerouslySetInnerHTML`.
- S4: Links open in a new tab with `rel="noopener noreferrer"`; only `http:`, `https:`, and `mailto:` targets become anchors, while other targets remain plain text.
- S5: Text-to-speech does not read Markdown markers aloud; extend `speakable.py` only if current behavior leaves markers behind.
- S6: Exam mode behaves exactly as before.

## Tasks

- [x] T1 (S1, S3, S4): Add RED renderer tests, implement the dependency-free React Markdown renderer, and reach GREEN. Route: inline. Commit: blocked by sandbox Git-directory permissions.
- [x] T2 (S1, S2, S6): Add RED timeline integration tests, use the renderer for agent and user prose while preserving code pointers, and reach GREEN. Route: inline. Commit: blocked by sandbox Git-directory permissions.
- [x] T3 (S5): Add a RED case for composed line markers, remove every leading Markdown block marker from speech, and reach GREEN. Route: inline. Commit: blocked by sandbox Git-directory permissions.
- [x] T4 (S1-S6): Run all required verification commands and record observed results. Route: inline. Commit: conversation Markdown work unit.

## Decisions

- `web/package.json` contains no Markdown renderer, and network access is unavailable. Implement the requested narrow subset with React elements instead of adding a dependency.
- Reuse `codeSegments` before Markdown rendering so fenced code retains the existing `CodePointer` behavior.
- Keep raw HTML as escaped text by relying exclusively on React text nodes.
- Support the issue's `**bold**` syntax but leave double-underscore names such as `__init__` literal, matching the speech-cleanup convention and avoiding false formatting of identifiers.
- Baseline speech cleanup handles individual markers, but composed block markup such as `> - item` leaves the list marker behind; extend only that demonstrated leak.
- Forecast: under 400 authored changed lines. No chained delivery is expected.
- Engram mirroring is pending because Engram tools are unavailable in this session.
- Learning-mode lookup could not classify this Git worktree because the helper reported it was not inside a repository.

## Verification Evidence

- Baseline inspection: `speakable_text` already removes fenced code, inline-code backticks, link destinations, heading/list/quote markers, and bold/italic markers. Existing tests cover all except block-quote speech explicitly.
- RED: `pnpm exec vitest run src/components/AgentConversation.test.tsx --maxWorkers=1 --pool=threads --config %TEMP%/socra-vitest.config.mjs` ran 12 tests with 1 expected failure: no `<strong>` was rendered for the user message. The temporary config bypassed sandbox-incompatible Vite plugins only; the first exact-config attempt failed before collection because child-process spawning is denied.
- GREEN: `pnpm exec vitest run src/components/AgentConversation.test.tsx src/components/MarkdownText.test.tsx --maxWorkers=2 --pool=threads --config %TEMP%/socra-vitest.config.mjs` passed 18/18 tests.
- Server RED: `server/.venv/Scripts/python.exe -m pytest -q server/tests/test_speakable_text.py --noconftest -p no:cacheprovider` ran 10 tests with 1 expected failure; `> -` and `> 1.` leaked the inner marker.
- Server GREEN: the same focused command passed 10/10 tests after line-marker removal was made repeatable.
- Full web fallback: a temporary Vitest config that omitted sandbox-incompatible Vite plugins ran 33 files and passed 344/344 tests; known JSDOM canvas messages were emitted.
- `pnpm exec vitest run --maxWorkers=2`: failed before collection while loading `vite.config.ts`; the sandbox denied Vite's child-process spawn and Rolldown could not load the Tailwind native binary.
- `pnpm exec tsc -b`: passed with exit code 0.
- `pnpm run lint`: passed with exit code 0 and six warnings in untouched files.
- `pnpm run build`: TypeScript passed, then Vite failed for the same config-loading and sandbox errors as the exact Vitest command.
- `uv run --no-sync --project server pytest -q server/tests`: failed before collection because the sandbox denied access to uv's default cache. A second attempt with a writable cache collected the suite but every test errored in the autouse fixture because pytest's sandbox-created base temporary directory became inaccessible. The focused speech suite passed with repository conftest disabled because those unit tests require no fixtures.
- Commit attempt: `git add`/`git commit` could not create `.git/worktrees/conversation-markdown/index.lock`; the sandbox applied a deny-write ACL to the worktree Git directory despite the requested writable Git root.
- Not verified: visual rendering in a real browser and audio through a real TTS engine.

## Log

- L1 (2026-10-22): Implement issue #20: render a safe Markdown subset in reply and user timeline messages, preserve fenced-code pointers, prevent raw HTML execution, restrict links, keep TTS free of Markdown markers, and leave exam mode unchanged.
- Parent verification outside the writer's sandbox (2026-10-23): `pnpm exec vitest run --maxWorkers=2` 33 files / 344 tests passed; `pnpm exec tsc -b` passed; `pnpm run lint` exit 0 with six pre-existing warnings; `pnpm run build` built; `uv run --no-sync --project server pytest -q server/tests` 265 passed. The writer's sandbox denied Git metadata writes, so the parent committed.
