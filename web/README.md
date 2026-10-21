# React + TypeScript + Vite

## Responsive exam interface

The exam uses a single column from 360px upward, with vertically scrollable content
in short windows (including browser `--app` windows). The orb stays square and is
limited by its container width, 34% of viewport height, and 20rem. Dynamic viewport
units have a `vh` fallback.

Long question/transcript text wraps; code preserves whitespace and scrolls inside
its own focusable “Question code” region. Exam controls have minimum 44px hit areas.
Settings scroll independently when the window is short; their range input keeps a
slim visual track inside a 44px hit area. Scoped rules in `src/App.css` leave the orb
gallery and shared component logic unchanged.

Run `pnpm vitest run`, `pnpm lint`, and `pnpm build` from this directory.
Component tests cover code contents, scroll-container classes, keyboard focus, and
existing re-answer/push-to-talk behavior. jsdom does not measure layout: verify
360px portrait, short landscape, tablet, and desktop sizes in a browser with long
code, unbroken question/transcript text, notices, and settings open. Confirm no
horizontal page/main scroll, internal code scrolling, reachable controls, and
44px targets. Physical touch devices and a native `--app` window still need manual
validation; headless viewport checks cannot establish those platform behaviors.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
