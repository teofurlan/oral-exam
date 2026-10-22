Objective: give Socra's web UI (exam `/` and agent `?mode=agent`) a new visual identity built around the particle visualizer, retire the ElevenLabs orb, and fix the listed UI problems.
Branch: `feat/web-identity` (stacked on `feat/agent-mode-5-launcher`) · Delivery: ask-on-risk · Test runners: Vitest (web), pytest (server) · Design workflow: Impeccable (PRODUCT.md, direction round, finish review, DESIGN.md).

## Specs

- S1. Visualizer: "La orbe de EleveLabs no la vamos a usar, vamos a usar la que selecioné yo con las líneas como default, y tener también la opción de las letras y con el grid". Clarified: the looks are Lines (default), Letters, and Letters on a grid (the study's "Grid snap"). The shader orb is removed from the app.
- S2. Identity: "Quiero que uses /impeccable para mejorar el diseño actual, vamos a darle una identidad nueva ahora que cambiamos la orbe que es lo principal."
- S3. "El select se ve re mal"
- S4. "Importar la carpeta podés mejorarla también"
- S5. "El engranaje de settings probablemente se podría poner mejor, o como 3 puntos en lugar de ese ícono."
- S6. "Cuando se muestra código, quiero que la orbe se desplace suavemente a la izquiera y se abra un menú a la derecha mostrando el código"
- S7. "siempre tiene que estar la opción de tipear manualmente también". Clarified: in both modes. In exam mode a typed answer is sent as the final answer (new additive `answer_text` message).
- S8. "las preguntas que hace el agente se están viendo en texto demasiado grande, mejora eso"
- S10. Browser look: "me gustaría que la consola oscura de desarrollo sea la que usemos para el navegador en sí (la app) y que la versión de terminar la usemos como tui". The browser app uses the dark developer console; the terminal-multiplexer look is reserved for a future TUI (separate session, out of this feature).
- S11. Theme: "Quiero que se pueda cambiar entre modo claro y oscuro también". System/Light/Dark in settings, stored in `socra_theme`, applied before first paint.
- S9. Live preview: "Quiero ir viendo a medida que haces los cambios, podrías hacer algo así? como un live server". Done with the Vite dev server in the browser pane (port 5180).

## Tasks

- T1 [S1] Visualizer set: Lines default, Letters, Letters on a grid; remove the shader orb and its palette gallery where nothing else needs them; stored `orb` falls back to Lines. Route: inline. RED 9 failed -> GREEN, web 227 passed, tsc clean. Three.js deps removed (Risk item 5). Commit 76293a5. Status: done.
- T2 [S7] Exam typed answer: server accepts `{"type":"answer_text","text":"..."}` (trimmed, ignored when blank, non-text or after finish) and resolves the pending answer with it, echoing a final transcript; web prompt line in exam mode sends it (mock driver handles it too). Route: inline. Server RED 1 -> GREEN, 167 passed (commit c94e436); web part in 4e8ae2f. Status: done.
- T3 [S2-S6, S8] New identity: direction round (user chose the terminal multiplexer, seed 0714a6c4), tokens, panes, tmux status bar with the mode switch, `…` settings menu opening upward, ChoiceList replacing native selects (model and microphone), folder field with emphasised folder name, code pane opening with an animated column split (stacked on mobile), question at 1rem reading size, prompt line always visible in both modes. Route: inline. RED 7 failing (+ missing codeBlocks module) -> GREEN, web 234 passed, tsc and lint clean for new files, detector []. Commit 4e8ae2f. Status: done, finish review pending.
- T3b [S10, S11] Dark console reskin and theme switch: shell renamed to `components/shell` (Panel with header bar, TopBar with Exam/Agent tabs and chips, console composer), Geist for UI and JetBrains Mono for code, light tokens under `:root[data-theme="light"]`, `useTheme` (system/light/dark, follows system changes), particles paint with source-over and deeper state colours on light. Route: inline. RED 4 (theme module, blend, settings choice, app switch) -> GREEN, web 241 passed, tsc and lint clean, detector []. Commit f6d6b7a. Status: done, finish review running.
- T4 [S2] Finish review and DESIGN.md. Route: delegated (Impeccable finish reviewer and documenter). Status: pending.

## Log

- L1 (2026-10-21) User request, verbatim: "Antes de que crees el shortcut, quiero que hagamos lo siguiente: * La orbe de EleveLabs no la vamos a usar, vamos a usar la que selecioné yo con las líneas como default, y tener también la opción de las letras y con el grid * Quiero que uses /impeccable  para mejorar el diseño actual, vamos a darle una identidad nueva ahora que cambiamos la orbe que es lo principal. Algunas de las correcciones que quiero que hagamos: * El select se ve re mal * Importar la carpeta podés mejorarla también * El engranaje de settings probablemente se podría poner mejor, o como 3 puntos en lugar de ese ícono. * Cuando se muestra código, quiero que la orbe se desplace suavemente a la izquiera y se abra un menú a la derecha mostrando el código * siempre tiene que estar la opción de tipear manualmente también * las preguntas que hace el agente se están viendo en texto demasiado grande, mejora eso"
- L2 (2026-10-21) User: "Quiero ir viendo a medida que haces los cambios, podrías hacer algo así? como un live server". Vite dev server started in the browser pane on 5180; it connects to the running Socra server on 8766.
- L3 (2026-10-21) Answers: grid = "Letras en grilla" (third look); PRODUCT.md summary confirmed; typed input "Sí, en ambos modos".
- L4 (2026-10-21) User: "Necesito ejemplos mockeados como el de la consola oscura para tomar la decisión (o fotos por lo menos, con eso ya estoy)". Built four HTML mocks in `web/public/studies/directions/` (untracked) and PNGs in `.impeccable/mocks/decision/`; the decision page did not render local comps, so they were shown as a gallery and sent as images.
- L5 (2026-10-21) User: "Quiero la dirección 2, Multiplexor de terminal."
- L6 (2026-10-21) Found while verifying: unlayered component CSS beat Tailwind utilities (moved to `@layer components`); the particle canvas needed a stacking context (`.term` isolation); the implicit grid column of `.term` let the status bar widen the page on mobile (`minmax(0, 1fr)`); pre-existing: particles started piled at (0,0) because the field is built before the screen size is known (fixed with a test). Headless Chrome cannot capture below ~500 px wide, so mobile was captured from the in-app browser emulation.
- L7 (2026-10-21) Pre-existing bug, not fixed: when two agent pages are open, the server replaces the older one with code 1000 "Replaced by a new page", but the client reconnects anyway, so the two pages kick each other about every 1.3 s (observed in the preview). The exam hook has the same reconnect-on-close shape.
- L8 (2026-10-21) User: "Viéndolo bien, me gustaría que la consola oscura de desarrollo sea la que usemos para el navegador en sí (la app) y que la versión de terminar la usemos como tui, sería posible algo así?" then "Sí, pasá la web a la consola oscura ahora; la TUI después, en otra sesión." The terminal finish review was stopped; the surface brief was rewritten for the console (seed 0714a6c4, challenger).
- L9 (2026-10-21) User: "Quiero que se pueda cambiar entre modo claro y oscuro también".

