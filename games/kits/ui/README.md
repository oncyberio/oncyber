# Games UI kit

CSS variables and a few dependency-free elements for a game's menus, generated
from the design tokens in `frontend/styles/tokens/`. How to use it, and the
rules: [docs/games/ui-kit.md](../../../docs/games/ui-kit.md).

-   `oncyber-ui.css`, `fonts.css`, `fonts/`: generated. Don't edit; run
    `pnpm games:ui`.
-   `src/elements.css`: the elements, written against the `--oui-*` variables.
-   `src/index.ts`: optional behaviour (`segmented`, `toggle`, `openDialog`,
    `toast`).
-   `scripts/generate.mjs`: tokens to CSS. `--check` exits 1 on drift.
