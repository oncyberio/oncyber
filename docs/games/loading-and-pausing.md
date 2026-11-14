# Games: loading and pausing

Rules for a coding agent building or changing a game. The helpers are in
`games/runtime/src/loading.ts` and `pausing.ts` (no dependencies; plain
games import them too, see `games/ace/vite.config.js`). The page's side is
`frontend/features/games/gameLoading.ts`, `GameLoadingCover.tsx`,
`gamePause.ts` and `gamePrepare.ts`. `pnpm games:check <id>` enforces all
of it (`scripts/games/loading-check.mjs`).

## The rules

1. **Report progress while you prepare.** Call `progress(value, label)`
   with 0..1 at each step of loading. The page shows it until your first
   frame. Never leave the visitor on a bar that does not move.
2. **Send `first-frame` once a real frame is on the canvas, then `ready`.**
   The page shows the game only after it. Draw the frame first, send
   second: not when loading ends, not from a timer.
3. **A resize redraws immediately.** Resizing a canvas clears it. Resize
   the renderer and render in the resize handler itself, then call
   `redrawn(size)`. Do not wait for the next animation frame: a hidden or
   paused game does not get one, and the visitor sees black (this is what
   showed on the handoff from the lobby).
4. **A solo game pauses. A multiplayer match does not.** When the tab is
   hidden or the page opens a menu over the game:

    - solo (alone, or against the computer): stop the clock and hold the
      state (`suspend()`), then continue from the same state (`restore()`).
      Nothing may advance in between.
    - multiplayer (other people are in the match): never stop. Under a
      menu keep playing. In a hidden tab the browser stops animation
      frames, so keep simulating from the timer `pausing` runs (about once
      a second) and catch up on the rest when the tab returns. Past ten
      seconds of missed time, take the state from the other players
      instead of replaying it.

    Pick the mode per moment, not per game: Bloom Garden is solo until a
    match starts.

## A game on the lifecycle

```js
import { createLoading, redrawOnResize } from "@oncyber/game-runtime/loading";
import { bindPausing, sessionPausing } from "@oncyber/game-runtime/pausing";

const loading = createLoading({ post: (kind, data) => page.post(kind, data) });
const host = await createBrowserSession(createGame, {
    ...options,
    onProgress: (value, label) => loading.progress(value, label),
    visibility: false, // sessionPausing suspends it, nothing else
});
await host.session.prepare(); // the game calls ctx.loading.progress(0.4, "Filling the pond…")
await host.session.enter(continuity);
await twoAnimationFrames();
loading.firstFrame({ width: innerWidth, height: innerHeight });
page.ready();
redrawOnResize(
    loading,
    () => {
        /* set graphics size */ host.session.tick(0);
    },
    window
);
const pausing = sessionPausing(host.session, {
    mode: () => (inMatch() ? "multiplayer" : "solo"),
    onChange: () => host.hold(false), // restart the frame clock
});
bindPausing(pausing, { prefix: "garden:", document, window });
```

`games/garden/src/host/browser.js` is the worked example.

## A plain game

```js
const loading = createLoading({
    post: (kind, data) => post({ type: `ace:${kind}`, ...data }),
});
loading.progress(0.25, "Painting the lines…");
// in the resize handler: renderer.setSize(...); renderer.render(scene, camera);
loading.redrawn({ width: innerWidth, height: innerHeight });
// after the first rendered frames:
loading.firstFrame({ width: innerWidth, height: innerHeight });
const pausing = createPausing({
    mode: "solo",
    pause() {
        held = true;
    }, // the frame loop returns early while held
    resume() {
        held = false;
        clock.getDelta();
    },
    fingerprint: () => ({ ball, score }), // facts that stand still while paused
});
bindPausing(pausing, { prefix: "ace:", document, window });
```

`games/ace/src/main.js` and `host.js` are the worked example. Give
`fingerprint` a few plain facts that move during play and nothing else; the
check compares them across a pause. With `?check` the game must be in play
without input (Ace plays itself), or the check cannot tell a pause from an
idle screen.

## Messages

All are `<id>:<kind>`, like the rest of the page bridge (`docs/games.md`).

| From | Kind               | Data                    | Meaning                                                                      |
| ---- | ------------------ | ----------------------- | ---------------------------------------------------------------------------- |
| game | `progress`         | `{ value, label }`      | 0..1 while preparing; never decreases; ten a second at most                  |
| game | `first-frame`      | `{ ms, width, height }` | Once. A frame is drawn at this size; `ms` since the frame's document started |
| game | `frame`            | `{ width, height }`     | Redrawn at a new size after a resize                                         |
| page | `pause` / `resume` | `{ reason: "menu" }`    | The page opened or closed something over the game                            |

The tab's visibility is not a message: the game's own document gets
`visibilitychange`.

## What the page does

-   `GameLoadingCover` covers the frame with the game's name, a bar and the
    label until `first-frame` (`data-machine="game-loading"`,
    `data-state="loading|drawn|failed"`). A game that never sends
    `first-frame` is shown at `ready`. On a trip from the lobby there is no
    cover: progress goes to the lobby, which stays on screen until `ready`.
-   Anything the page opens over a game holds a pause while it is open:
    `useEffect(() => (open ? holdGamePause() : undefined), [open])`
    (`gamePause.ts`).
-   When a game is chosen in the lobby, `prepareGameDestination` loads its
    frame hidden (same sandbox, a guest identity, 320 x 180, no audio) and
    removes it at its first frame. The trip's own frame then revalidates
    the scripts and styles from the browser's cache instead of downloading
    them. A frame cannot move between documents, so the trip still boots
    its own; what carries over is the cache.

## What the check does

After the game's own check, on the live game, at 1280 x 720:

| Finding                                                            | The rule it enforces                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `FIRST_FRAME_MISSING`, `READY_BEFORE_FIRST_FRAME`                  | Rule 2                                                                                                 |
| `FIRST_FRAME_SLOW`                                                 | First frame within the budget: 5000 ms, or `loading.firstFrameBudgetMs` in `game.json`                 |
| `PROGRESS_MISSING`, `PROGRESS_WENT_DOWN`                           | Rule 1                                                                                                 |
| `RESIZE_BLANK_FRAME`, `RESIZE_NOT_REDRAWN`, `RESIZE_NOT_ANNOUNCED` | Rule 3, at 900 x 620, 520 x 700 and back: the canvas is read in the resize event and on the next frame |
| `PAUSE_IGNORED`, `PAUSE_STATE_MOVED`, `RESUME_STUCK`               | Rule 4, solo: a page menu, then a hidden tab, each held for a second                                   |
| `MATCH_PAUSED`, `MATCH_STOPPED`, `MATCH_NO_CATCH_UP`               | Rule 4, multiplayer                                                                                    |
| `PAUSING_MISSING`, `PAUSE_NOT_PLAYING`                             | The game has no pausing, or sits idle under `?check`                                                   |

The times and results are written to `check.json` under `loading`. Games on
the lifecycle must pass; a plain game that uses none of the helpers is
skipped with a note. Where the machine cannot read the canvas back (some
headless WebGPU setups), the resize part is noted and not judged.

## Measured

Headless Chromium, software rendering, loopback, 1280 x 720 (a real GPU is
several times faster; these compare, they don't predict):

| What                                                            | Time                        |
| --------------------------------------------------------------- | --------------------------- |
| Ace, frame start to `first-frame` (`pnpm games:check ace`)      | 2.4 to 2.9 s (budget 5 s)   |
| Ace on a trip, cold: game frame mounted to `first-frame`        | 3.65 to 3.71 s (three runs) |
| The same after the hidden prepare frame (ready in 0.6 to 0.7 s) | 3.23 to 3.33 s (three runs) |

Bloom Garden passes the same stage. On this machine its WebGPU device is
lost at start, so its canvas cannot be read and the resize part is noted,
not judged; run with its WebGL 2 backend (`?check&webgl`) the resize and
pause parts pass and only the first frame is slow (software WebGL draws
about one frame a second).

After a prepare, the trip's script and stylesheet answered 304 from the
shared cache; only `index.html` was fetched again.

## Not built yet

-   The lobby's own panels (Explore, people, chat) opened over a game do
    not hold a pause: they live in the lobby's document, one frame up from
    `GamePage`. Nothing on the game page itself opens a menu today, so
    `holdGamePause` has no caller yet.
-   A paused game is not dimmed or labelled by the page.
-   The prepare frame does not use the visitor's avatar, so a game that
    loads one still downloads it on the trip.
