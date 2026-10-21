Objective: voice-driven agent mode (#8) with a model selector (#2), built on a backend-agnostic `AgentBackend` port whose first adapter is Claude Code.
Branches: one per slice, `feat/agent-mode-<n>-<slice>` · Delivery: ask-on-risk, chain strategy stacked-to-main (forecast ~1900 authored lines) · Test runner: pytest (server), Vitest (web).

## Specs

- S1. Extensible port, Claude Code first: "Yes, let's start #2 by designing the agent-backend port with Claude Code as the first adapter." and, on the backend decision, "quise decir que entendí que la decisión de utilizar claude code para #2, #3 y #8 era temporal, solamente para desarrollar y después lo ampliábamos, puede ser". The port and its events carry no Claude Code names; the user's choice is a backend + model pair.
- S2. First consumer: "Use agent mode (#8) as the first consumer, with the folder picker." From #8: "Agent mode: a voice-driven coding/assistant session in that folder. It is distinct from the exam mode (no questions, grading or exam flow)."
- S3. Permissions: "Approve in the UI: when Claude Code's rules say "ask", show the request on the page with Allow/Deny buttons."
- S4. Model selector, acceptance criteria of #2 verbatim: "The selected provider is used for the next turn." / "The selection survives a reload." / "Credentials are never sent to or stored in the browser beyond what the provider requires." / "Clear error state when a provider is not configured (missing key, unreachable local server)."
- S5. Launcher and mode, acceptance criteria of #8 verbatim: "One click on the icon opens Socra ready to use." / "The user can choose model and folder before starting." / "Exam mode remains available and unchanged."
- S6. Folder picker (design decision 10, accepted without objection): the server opens the native folder dialog (`tkinter.filedialog.askdirectory`), because the browser's `showDirectoryPicker()` never exposes an absolute path; the page shows the chosen path and remembers the last one.

## Tasks

- T1 [S1,S3] Domain types, `AgentBackend` / `AgentConversation` / `PermissionDecider` ports and a backend registry (describe backends with models and status, resolve a selection). Tested with an in-memory fake backend. Route: inline (no writer trigger). RED: `tests/test_agent_registry.py` failed on the missing module; GREEN: 8 passed, full server suite 91 passed. Files: `domain/agent.py`, `ports.py`, `agent_registry.py`. Status: done.
- T2 [S1,S3,S4] Claude Code adapter over `claude-agent-sdk` (`ClaudeSDKClient`): model list, `check()`, conversation events, `can_use_tool` mapped to the decider. Adds a dependency (Risk item 5). Route: inline. Status: pending.
- T3 [S2,S3,S5,S6] Agent application service, standalone server start (HTTP + WS without MCP stdio), WS protocol for agent mode, native folder dialog, spoken text without code blocks. Route: inline. Status: pending.
- T4 [S2,S3,S4,S5,S6] Web: start screen (backend/model selector persisted, folder picker, last folder), agent conversation view, permission prompt with Allow/Deny, stop button; exam mode unchanged. Route: inline. Status: pending.
- T5 [S5] Desktop launcher: one click starts the standalone server and opens the page. Route: inline. Status: pending.

## Slices (stacked to main, merged in order)

- PR1 `feat/agent-mode-1-port` <- main: T1 (port, domain types, registry). 346 lines.
- PR2 `feat/agent-mode-2-claude-code` <- PR1: T2 (Claude Code adapter, `claude-agent-sdk` dependency).
- PR3 `feat/agent-mode-3-server` <- PR2: T3 (agent service, standalone start, WS protocol, folder dialog).
- PR4 `feat/agent-mode-4-web` <- PR3: T4 (start screen, conversation view, permission prompt); split in two if it exceeds ~400 lines.
- PR5 `feat/agent-mode-5-launcher` <- PR4: T5 (desktop launcher).

Each slice lands without changing exam mode: PR1 and PR2 add code nothing calls yet.

## Log

- L1 (2026-10-21) User request, verbatim: "Yes, let's start #2 by designing the agent-backend port with Claude Code as the first adapter."
- L2 (2026-10-21) User: "quise decir que entendí que la decisión de utilizar claude code para #2, #3 y #8 era temporal, solamente para desarrollar y después lo ampliábamos, puede ser". Decision comments on #2, #3, #8 rewritten: Claude Code is the initial backend behind a port.
- L3 (2026-10-21) User: "Use agent mode (#8) as the first consumer, with the folder picker." Reason recorded: #2 alone has no consumer, since in exam mode the MCP client picks the model.
- L4 (2026-10-21) Evidence: `server/src/socra_server/__main__.py` only runs as an MCP stdio server and exits when the client disconnects, so agent mode needs a standalone start. `tkinter` 8.6 is available in the project Python. Claude Code 2.1.303 is installed; `claude-agent-sdk` is not yet a dependency. SDK docs: `can_use_tool` runs only when permission rules evaluate to "ask".
- L5 (2026-10-21) User: "Approve in the UI: when Claude Code's rules say "ask", show the request on the page with Allow/Deny buttons."
- L6 (2026-10-21) Design choice in T1: permission requests reach the application through a `PermissionDecider` callback passed to `open()`, not as events in the reply stream, because the SDK awaits the decision inside its own callback.
- L7 (2026-10-21) Engram mirror pending: `mem_save` failed with "host session already ended".
- L8 (2026-10-21) User: "Stacked to main: each slice is its own PR against main, merged in order."
