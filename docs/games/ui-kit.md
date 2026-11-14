# Games UI kit

A game's world keeps its own look. Its menus should look like Oncyber: the
start and pause menus, match setup, settings, party and format pickers,
results and leaderboards. The kit in `games/kits/ui/` gives those screens the
site's buttons, panels, type and motion, as plain CSS with no dependencies.
It is optional, and `pnpm games:check` warns about menu screens that don't
use it.

## Rules for a coding agent

1. **Menus use the kit; the world doesn't.** Anything drawn in the scene, the
   title art and the in-play HUD are the game's. A screen where the visitor
   picks, confirms or reads results uses `oui-` classes.
2. **Never copy a value out of the kit.** Use the classes, or the `--oui-*`
   variables for your own layout. Don't write the hex colours, radii or
   durations yourself, and don't edit `oncyber-ui.css`: it is generated.
3. **One white button per screen** (`oui-button--white`) for the main action;
   every other button is the plain `oui-button` outline. `oui-button--blue`
   is only for signing in or publishing, which a game rarely does.
4. **Sentence case, no fitted text.** "Match setup", not "MATCH SETUP". Let
   long names truncate (`oui-score__name` does); never squeeze or re-track.
5. **Show state with more than colour.** Set `aria-pressed`, `aria-checked`
   or `aria-current`; the kit draws the dot, the check or the switch from it.
6. **Keep the focus ring.** Real focus gets it. If the game moves its own
   focus (gamepad, arrow keys), set `data-oui-focus` on the focused control
   and remove it from the others.
7. **Don't bundle the brand fonts.** They are licensed. `fonts.css` ships the
   open ones the site falls back to; without it the kit uses the system sans.
8. **The frame is sandboxed.** It can't submit forms, so a dialog form
   (`method="dialog"`) does nothing: use `<button value>` and `openDialog`.
   Fonts and CSS must come from the game's own build (the kit's do).

## Use it

In the game's `vite.config.js`, then its entry module:

```js
resolve: { alias: { "@oncyber/game-ui": resolve("../kits/ui") } },
```

```js
import "@oncyber/game-ui/fonts.css"; // optional: open fonts
import "@oncyber/game-ui/oncyber-ui.css";
import { segmented, toggle, openDialog, toast } from "@oncyber/game-ui"; // optional
```

Import the kit before the game's own styles.

| Element          | Markup                                                                         | Notes                                                                |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Screen root      | `<div class="oui oui-panel">`                                                  | Glass over the world. `oui-panel--solid` for a flat surface.         |
| Title, copy      | `<h2 class="oui-title">`, `<p class="oui-text">`, `<span class="oui-label">`   | 16 px medium, 14 px, 10 px mono label. `oui-text--small` is 12 px.   |
| Button           | `<button class="oui-button">`                                                  | Add `--white`, `--blue`, `--pill` (corners only), `--block`.         |
| List             | `<div class="oui-list">` of `<button class="oui-list__item">`                  | `oui-list__body` and `oui-list__meta` inside; `aria-pressed` checks. |
| Toggle           | `<button class="oui-toggle" role="switch" aria-checked="false">Music</button>` | `toggle(button, onChange)` flips it.                                 |
| Segmented choice | `<div class="oui-segmented">` of `<button data-value aria-pressed>`            | `segmented(group, { onChange })` adds arrow keys and one tab stop.   |
| Dialog           | `<dialog class="oui-dialog">` with `<button class="oui-button" value="leave">` | `await openDialog(dialog)` gives the value, `""` on Escape.          |
| Toast            | `toast("Saved")`                                                               | One polite live region, 3 s by default.                              |
| Scoreboard row   | `<div class="oui-score">` with `__rank`, `__name`, `__value` spans             | `aria-current="true"` marks the visitor's row.                       |
| Layout           | `oui-stack`, `oui-stack--tight`, `oui-actions`                                 | 16 px and 8 px gaps; actions sit right. `--oui-space-1` … `-7`.      |

Buttons are 40 px high and every control is at least 44 px on touch screens.
Reduced motion sets the kit's durations to zero.

Ace's party and match setup screens are the worked example:
`games/ace/index.html` (`#party`, `#setup`) and `goParty` in
`games/ace/src/main.js`.

## Where the values come from

`games/kits/ui/scripts/generate.mjs` reads `frontend/styles/tokens/` (base,
action, lobby, landing) and writes `oncyber-ui.css`: the `--oui-*` variables,
then `src/elements.css`, which may only use those variables. After changing
a token or the template:

```sh
pnpm games:ui      # regenerate
pnpm games:test    # fails when the committed CSS differs from the tokens
```

A few brand-guide values have no token yet (the 4 px spacing steps, the
16 px panel title); they are listed in `guide` at the top of the generator.

## The check

`pnpm games:check <id>` looks at the game's page, and any UI frame inside
it, once it has booted. A menu screen is a top-level block with two or more
controls (buttons, inputs, links, switches); hidden screens count, and
`aria-hidden` blocks such as touch pads don't. Screens with no `oui-` class
anywhere inside are listed in one warning, `UI_KIT_UNUSED`, and in
`check.json` under `warnings` and `ui.screens`. It never fails the check. A
HUD with two or more buttons is listed too; leave it if it belongs to play.
