---
version: 1
slug: "web-src-agentapp-tsx"
primary_target: "web/src/AgentApp.tsx"
related_targets: ["web/src/App.tsx"]
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
