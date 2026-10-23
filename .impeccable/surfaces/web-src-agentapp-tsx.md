---
version: 1
slug: "web-src-agentapp-tsx"
primary_target: "web/src/AgentApp.tsx"
related_targets: ["web/src/App.tsx","web/src/App.css"]
---

# Surface brief: Socra web app (exam `/` and agent `?mode=agent`)

Scope: both pages of the local web app. Visitor mode: Operate. One developer at a desk beside their editor, long voice sessions with Claude Code; the task is talking, reading what was said or shown, approving tool calls, and typing when voice is inconvenient.

Constraints: exam behavior unchanged except the typed answer; states idle / listening / thinking / speaking and connection always legible; Lines visualizer by default (Letters, Grid as options); the visualizer slides left when code appears and a code panel opens on the right; typing always available. The terminal-multiplexer look is reserved for a future TUI client; the browser uses the dark console.

## Direction contract

THESIS: Socra in the browser is a dark developer console: persistent graphite panels whose contents change while the layout stays put. It refuses the centred voice-assistant chat with bubbles and a pill composer, and it leaves the terminal costume to the TUI.

OWN-WORLD: graphite ground #16181b, panels #1b1e22 divided by 1px seams #2b2f35 and one step of elevation, no shadows on panels. Geist for UI text, JetBrains Mono only for code, paths and figures. Panel headers in small caps. One accent, blue #5aa9e6, for the primary action and selection; syntax-derived state colours: listening red #e06c75, speaking blue, thinking gold #e5c07b, connected green #98c379. Destructive actions are outlined and set apart.

STORY: the user sees at a glance who has the floor (state line plus the particle sphere's colour), reads the question or reply at reading size, says or types the next turn in the composer, and reads code in its own panel without losing the conversation.

FIRST VIEWPORT: a 44px top bar (wordmark, Exam/Agent tabs, context chips, connection chip, the menu) over full-bleed panels. The conversation panel holds the particle sphere in its upper part, one state line, the question or log at a 72-character measure, and the composer pinned to its bottom. When code arrives a second panel opens on the right (about 44% wide) behind a 1px seam and the conversation panel narrows, so the sphere glides left with it.

FORM: dark-first developer console (catalog challenger, rated competitive), chosen by the user after seeing the mocks; seed key 0714a6c4.

SIGNATURE INTERACTION: the split. Code arriving animates the panel grid's column template over 520 ms with an exponential ease-out along one axis only; the canvas follows the slot every frame, so the particles travel with the panel. Closing the code panel reverses it. Reduced motion swaps instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Agent chat-first extension (issues #24 and #25)

Scope: only the agent page; Operate. This is a precisely specified extension of the existing conversation surface, not a new identity or a new concept round. User confirmation: chat from entry, folder bottom-left, provider/model bottom-right; retain the provider menu with nested model options.

### Direction contract

THESIS: remove the setup barrier without replacing the console; context controls support the conversation instead of gating it.

OWN-WORLD: inherit the graphite/light console, existing accent/state tokens, Geist UI and mono paths, quiet outlined controls and existing particle field. No new colors, cards, chat bubbles, fonts or decorative imagery.

STORY: open into an empty conversation, verify or change folder and model near the prompt, send the first turn immediately; see that turn retained while the agent starts or reports a clear failure.

FIRST VIEWPORT: retain the fixed top bar and conversation/code panels. The conversation timeline is visible immediately. Keep the prompt dock at the bottom; its context row places one folder button labeled with the current folder basename at the left and provider/model trigger at the right. No separate visible path or breadcrumb; the full path is available only as the button tooltip. On phone widths keep the folder name visible (truncate long names) and maintain both controls in the dock without horizontal overflow. Provider/model choices open upward or in a portal above the dock, preserving nested keyboard/hover behavior.

FORM: direct user-specified extension of the existing Operate surface; no new concept seed. Inherit the approved console seed 0714a6c4 rather than rolling a new composition. Signature interaction: the first send appears in the conversation while the backend starts, without a setup screen or lost text.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
