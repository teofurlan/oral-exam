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
- S9. Live preview: "Quiero ir viendo a medida que haces los cambios, podrías hacer algo así? como un live server". Done with the Vite dev server in the browser pane (port 5180).

## Tasks

- T1 [S1] Visualizer set: Lines default, Letters, Letters on a grid; remove the shader orb and its palette gallery where nothing else needs them; stored `orb` falls back to Lines. Route: inline. Status: pending.
- T2 [S7] Exam typed answer: server accepts `{"type":"answer_text","text":"..."}` while listening and resolves the pending answer with it; web composer in exam mode. Route: inline. Status: pending.
- T3 [S2-S6, S8] New identity: direction round, tokens, header and menu, selects, folder field, code side panel with the visualizer sliding left, question type scale, always-visible composer. Route: inline. Status: pending.
- T4 [S2] Finish review and DESIGN.md. Route: delegated (Impeccable finish reviewer and documenter). Status: pending.

## Log

- L1 (2026-10-21) User request, verbatim: "Antes de que crees el shortcut, quiero que hagamos lo siguiente: * La orbe de EleveLabs no la vamos a usar, vamos a usar la que selecioné yo con las líneas como default, y tener también la opción de las letras y con el grid * Quiero que uses /impeccable  para mejorar el diseño actual, vamos a darle una identidad nueva ahora que cambiamos la orbe que es lo principal. Algunas de las correcciones que quiero que hagamos: * El select se ve re mal * Importar la carpeta podés mejorarla también * El engranaje de settings probablemente se podría poner mejor, o como 3 puntos en lugar de ese ícono. * Cuando se muestra código, quiero que la orbe se desplace suavemente a la izquiera y se abra un menú a la derecha mostrando el código * siempre tiene que estar la opción de tipear manualmente también * las preguntas que hace el agente se están viendo en texto demasiado grande, mejora eso"
- L2 (2026-10-21) User: "Quiero ir viendo a medida que haces los cambios, podrías hacer algo así? como un live server". Vite dev server started in the browser pane on 5180; it connects to the running Socra server on 8766.
- L3 (2026-10-21) Answers: grid = "Letras en grilla" (third look); PRODUCT.md summary confirmed; typed input "Sí, en ambos modos".
