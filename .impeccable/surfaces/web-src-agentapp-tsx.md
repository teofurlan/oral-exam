---
version: 1
slug: "web-src-agentapp-tsx"
primary_target: "web/src/AgentApp.tsx"
related_targets: ["web/src/App.tsx"]
---

# Surface brief: Socra web app (exam `/` and agent `?mode=agent`)

Scope: both pages of the local web app. Visitor mode: Operate. One developer at a desk beside their editor, long voice sessions with Claude Code; the task is talking, reading what was said or shown, approving tool calls, and typing when voice is inconvenient.

Constraints: exam behavior unchanged except the typed answer; states idle / listening / thinking / speaking and connection always legible; Lines visualizer by default (Letters, Grid as options); the visualizer slides left when code appears and a code pane opens on the right; typing always available.

## Direction contract

THESIS: Socra is one more session in the user's terminal multiplexer. It refuses the category default of a centred voice-assistant chat with bubbles and a pill composer; the conversation lives in panes, a status bar and a prompt line.

OWN-WORLD: near-black ground #0d0f12 with panes outlined by 1px rules whose title sits in the top border; the active pane's rule turns blue #7aa2f7. Everything set in JetBrains Mono. A tmux status bar along the bottom: green session block, window list doubling as the mode switch, right-hand segments for state, folder, model and the menu. State colours: listening red #f7768e, speaking blue #7aa2f7, thinking amber #e0af68, connected green #9ece6a.

STORY: the user sees at a glance who has the floor (status segment plus the particle sphere's colour), reads the question or reply at reading size, says or types the next turn at the prompt line, and reads code in a split pane without losing the conversation.

FIRST VIEWPORT: one full-height pane holds the particle sphere centred in its upper part, a single state line under it, the conversation or question at a 72-character measure, and the prompt line pinned to the pane's bottom. The status bar runs the full width under the panes. When code arrives the grid opens a second pane on the right (about 44% wide) and the first pane narrows, so the sphere glides left with it.

FORM: terminal multiplexer (tmux / Zellij / LazyVim), position 1 on the ordered list; seed key 0714a6c4, chosen as the pick card.

SIGNATURE INTERACTION: the split. Code arriving animates the pane grid's column template over 520 ms with an exponential ease-out; the canvas follows the slot every frame, so the particles travel with the pane instead of jumping. Closing the code pane reverses it. Reduced motion swaps instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
