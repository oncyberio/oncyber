# Safe area: keep the HUD clear of the page

The Oncyber page floats its own interface over a game's frame: the social
controls (people, microphone, Lobby), the party chat the lobby keeps on
screen, and on phones the notch and home bar. A game can't see any of it.
The page measures those overlays and tells the game how far in from each
edge they reach.

## The rule

**Keep every HUD element and menu inside the insets.** The 3D view and
full-screen backdrops fill the frame; anything a player reads or presses
(score, buttons, prompts, menu cards, touch controls) stays inside. Add your
own margin on top: the insets end exactly where the overlays do.
The runtime's on-screen stick and buttons ([devices.md](devices.md)) keep to
the insets on their own and report themselves as HUD.

Don't hard-code where the page's controls are, and don't assume the insets
are fixed: they change when the window resizes, a phone turns, or an overlay
appears (the controls only show once the game is ready).

## In a game

```js
import { watchSafeArea } from "@oncyber/game-runtime/safe-area";

const safeArea = watchSafeArea();
```

Call it once, as early as the game's script runs, before it says `hello`:
the page answers `hello` with the insets. It listens for the page's
`oncyber:game:safe-area` ([contract.md](contract.md)) and sets four CSS variables on the document's root element, `0px`
until the page speaks and when the game runs on its own:

```css
.scoreboard {
    top: calc(var(--oncyber-safe-top, 0px) + 8px);
    left: calc(var(--oncyber-safe-left, 0px) + 8px);
}
.prompt {
    right: calc(var(--oncyber-safe-right, 0px) + 12px);
    bottom: calc(var(--oncyber-safe-bottom, 0px) + 12px);
}
/* Centred menus: pad the full-screen container, and cap what's inside. */
.screen {
    padding: var(--oncyber-safe-top, 0px) var(--oncyber-safe-right, 0px) var(
            --oncyber-safe-bottom,
            0px
        ) var(--oncyber-safe-left, 0px);
}
.card {
    max-height: 100%;
    overflow-y: auto;
}
```

The page already folds the device's own insets (`env(safe-area-inset-*)`)
into what it sends. A game that also runs standalone takes the larger of the
two: `max(env(safe-area-inset-top, 0px), var(--oncyber-safe-top, 0px))`.

For a HUD drawn on the canvas, read `safeArea.insets` (`{ top, right,
bottom, left }`, CSS pixels) or pass `onChange(insets)`.

A game built before the contract passes its id,
`watchSafeArea({ game: "garden" })`, and hears `garden:safe-area` as well.

A HUD in its own UI frame (Bloom Garden): the host passes
`relay: [uiFrame]`, and the UI page calls `watchSafeArea()` with no id. It
gets the same variables.

## Report the HUD

The check has to know where the HUD is. Mark each HUD element and menu with
`data-hud="<name>"` and return their boxes from `inspect()`:

```js
import { answerHudRequests, hudRects } from "@oncyber/game-runtime/safe-area";

inspect() {
    return { /* ... */ hud: hudRects() }; // [{ id, x, y, width, height }]
}
// Once, next to watchSafeArea:
answerHudRequests(() => game.inspect(), { insets: () => safeArea.insets });
```

`hudRects()` lists the marked elements that are laid out at that moment.
Report every screen, not only the one showing: Ace adds a `hud-measure`
class to the body for the one reading, which lays its hidden screens out
(`games/ace/src/hud.js`, and the `hud-measure` rules in its `style.css`).
Mark what is read or pressed, not full-screen backdrops, and not things
anchored to the 3D world (a gauge over a player's head).

A game module with no DOM of its own (the HUD lives in a UI frame) answers
from the host instead: `answerHudRequests(async () => ({ hud: await
requestHud(uiFrame) }))`, with the UI page answering from `hudRects()`.

## The check

`pnpm games:check <id>` runs a safe-area stage
(`scripts/games/safe-area.mjs`). It opens the game under stand-ins for the
page's overlays, at 1280x720, a 390x844 phone and the same phone on its
side. At each size it sends the insets the real page would (in the form
the game greeted in), asks the game
for `inspect().hud`, and fails on:

| Finding             | Meaning                                       |
| ------------------- | --------------------------------------------- |
| `SAFE_AREA_OVERLAP` | A HUD box shares pixels with a page overlay.  |
| `SAFE_AREA_IGNORED` | The game didn't take the insets it was sent.  |
| `SAFE_AREA_EMPTY`   | The game answered with no HUD boxes.          |
| `SAFE_AREA_BOOT`    | The game didn't get ready under the overlays. |

`check.json` gets a `safeArea` block: per viewport, the overlays, the
insets, the HUD boxes, the overlaps, and `outside` (boxes that cross an
inset without touching an overlay: allowed, but worth a look). Screenshots
land in `games/<id>/.check/safe-area-<viewport>.png`. A game that doesn't
answer is listed as `unreported` and passes for now.

## How the page works it out

`frontend/features/games/safeArea.ts`. Anything marked `data-game-overlay`
in the game page, and in the lobby's document when the page runs inside the
lobby, is an overlay. Each one reserves a band along the edge it is closest
to (as a share of the frame); `data-game-overlay-edge="left"` pins the edge.
An overlay that would take more than 40% of the frame is a panel the
visitor opened over the game, not something to lay out around. The page
sends `safe-area` `{ insets, width, height }` when the game says `hello`
and `ready`, and whenever the answer changes. It goes out through the
page's one way to the game, so each game hears it in the form it speaks.
The page's own chat (`GameChat`) is marked too; it sits in the corner the
party chat takes when the page runs inside the lobby.

Adding something that floats over games? Mark it `data-game-overlay`, and
add the same box to the stand-in page in `scripts/games/safe-area.mjs` so
the check keeps testing what the page really shows.
