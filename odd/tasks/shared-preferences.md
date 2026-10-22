Objective: page preferences survive a change of page origin, so a socra-server on fallback ports (#26, 02a1720) keeps the user's choices (teofurlan/socra#27).
Branch: `feat/web-identity` (the #26 fix is still local; this ships with it) · Delivery: ask-on-risk · TDD: on (project convention RED -> GREEN), runners: pytest (server, `uv run --project server pytest`), Vitest (web, `pnpm -C web test --run`).

## Problem

Every page preference lives in `localStorage`, which is per origin. A fallback server serves the page from `http://localhost:<random port>`, so a fallback session starts with defaults and loses what the user picks there once the process exits. The issue names voice and turn mode; the same class covers theme, silence timeout, visualizer, shape, orb palette, agent selection and agent folder.

## Decision

The server keeps the preferences in one file shared by every socra-server process (`%LOCALAPPDATA%/Socra/preferences.json`, override `SOCRA_PREFERENCES_FILE`), served on the page's own origin at `/api/preferences` (GET reads, PUT merges). The page hydrates `localStorage` from it before the first render and sends each change back, so the synchronous `getStored*` API stays as it is. Server values win; keys only the browser has are sent up once (migration from the 8767 origin). The microphone stays per origin: browsers scope `deviceId` per origin, so a shared id would not match.

Rejected: redirecting fallback pages to the 8767 origin (that origin belongs to another session's process and disappears with it).

## Tasks

- T1 Server preferences store and `/api/preferences` (GET, PUT with same-origin check, JSON object of short keys to short strings, null deletes, body capped). Route: inline (two coupled files plus tests; the prior features in this repo ran inline). RED: collection error, `preferences_file` missing -> GREEN 13 passed; server suite 227 passed. Status: done.
- T2 Web hydration before render, setters send changes; `useTheme` applies the hydrated theme on mount. Route: inline. RED: `./preferences` missing -> GREEN; web 311 passed, `tsc -b` and oxlint clean, `pnpm build` ok. Status: done.

## Acceptance

- A preference chosen on one origin is read on another origin served by any socra-server.
- The page renders with local values when the API is missing (Vite dev server) or slow (timeout).
- A cross-origin PUT is rejected.

## Verification

- Smoke on the real build: two `serve_page` instances on free ports, one file; PUT on one origin, GET on the other returned it; a PUT with `Origin: http://evil.example` returned 403; `/?ws=` still serves index.html.
- Not checked in a real browser session: the hydration order is covered by unit tests only.
- Known limit: on a fallback origin's first load the inline theme script in `index.html` runs before hydration, so the page can show the system theme for one frame before `useTheme` applies the stored one.
