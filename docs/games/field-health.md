# Games: field health and the kill switch

A game passes its check on one machine. This is how we learn that it breaks
on someone else's, and how we stop it while it's fixed.

## Rules for a game (coding agents: do these)

1. Call `reportHealth()` from `@oncyber/game-runtime/health` **once, as
   the first thing the game's frame does**, before it loads or builds
   anything. A game on the contract passes nothing and reports as
   `oncyber:game:health`; only a build that still speaks its own prefix
   passes its id (`reportHealth({ game: "garden" })`).
2. Run each lifecycle stage through it, so a stage that fails is named:

    ```js
    import { reportHealth } from "@oncyber/game-runtime/health";
    const health = reportHealth();

    await health.stage("prepare", () => session.prepare());
    await health.stage("enter", () => session.enter(continuity));
    // where the host catches a failed tick:
    onError: (error) => health.stageFailed("update", error);
    ```

    Ace does this at the top of `games/ace/src/host.js`, the garden in
    `games/garden/src/host/browser.js`.

3. Don't catch an error just to hide it. An uncaught error is how a broken
   game shows up; a swallowed one leaves a frozen game that looks healthy.
4. Don't put anything a visitor typed, made or saved in an error message.
   The message is sent as written (cut to 200 characters). `"save is
corrupt"` is fine; the save itself is not.
5. Don't measure and send your own timings. The frame has no network
   access for analytics, and the page already has the numbers below.
6. `pnpm games:check <id>` fails with `HEALTH_ERROR_NOT_RECORDED` when
   rule 1 is missing. A game with its own page that reports nothing says
   so in `game.json` (`"health": "none"`, Padel today).

Alias `@oncyber/game-runtime/health` to `games/runtime/src/health.ts` in
the game's Vite config, as Ace and the garden do.

## What is collected, and why

One PostHog event, `game health`, per fact. Every event carries the game
id, the release id (`release.json`), the device type (`phone`, `tablet`,
`headset` or `desktop`) and a `kind`:

| `kind`         | Fields                                            | Why                                                            |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| `first-frame`  | `ms`: the game's own `first-frame` loading signal | How long visitors wait, per release and device. One per visit. |
| `frames`       | `medianMs`, `p95Ms`, `frames` for 20 s of play    | Whether a release got slower, and on which devices.            |
| `error`        | `message`, `where` (`file.js:line`), `afterReady` | A game that throws for visitors but not in its check.          |
| `stage-failed` | `stage`, `message`, `where`                       | Which lifecycle stage broke: `prepare`, `enter`, `update`, ... |
| `load-failed`  | `reason`: `error` (the game said so) or `timeout` | Visitors who never saw the game (the page waits two minutes).  |

How it is collected:

-   The page cannot see into the sandboxed frame, so the frame measures
    (`games/runtime/src/health.ts`): `error` and `unhandledrejection`
    listeners, the stages above, and its own animation-frame clock,
    summarised every 20 s while the tab is visible. It posts `health`
    messages to the page (`oncyber:game:health`, or `<id>:health` from a
    build that still speaks its own prefix). It sends nothing over the
    network: the game's network declaration ([trust.md](trust.md)) needs no
    host for it, and the check's network stage would fail on one.
-   The page (`frontend/features/games/gameHealth.ts`, one hook in
    `GamePage`) treats those messages as outside input: known kinds only,
    numbers range-checked, strings cut to size, and nothing else in the
    message is forwarded. The time to the first frame is not measured a
    second time: it is the `ms` of the game's `first-frame` loading signal
    ([loading-and-pausing.md](loading-and-pausing.md)), read by the page's
    one reader of it (`readGameLoadingMessage`). A build that only says
    `ready` has no first-frame time. The page adds the release and device.
-   Limits per visit: ten failures (each distinct one once), thirty frame
    windows (ten minutes). Frame times are sent for one visit in five
    (`FRAME_SAMPLE_RATE`); failures and the first frame for every visit.
    Frame windows that began before the first frame are dropped.

What is never sent: account ids, names, wallet addresses, avatars, saved
values, chat, room or party ids, input, or URLs beyond a file name. The
events go through `amplitude_logAnalyticsEvent`, the same path as load
timings, so PostHog attaches what it attaches to every event of the app
(its own visitor id and screen size). With no `NEXT_PUBLIC_POSTHOG_KEY`
nothing leaves the browser.

## Reading it

`/dev/games` shows field health under each game, per release: visits by
device, first frame (median, p95), frame time, and the failures, most
frequent first.

-   With `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` in
    `frontend/.env.local` (optionally `POSTHOG_API_HOST`), it shows real
    visits from the last seven days. The key is a personal, read-only
    PostHog key; it stays on your machine and is never `NEXT_PUBLIC_`.
-   Without them it shows the visits made on your development server since
    it started, so you can see a game's reports while you work on it.

## The kill switch

`GAMES_DISABLED` is a server-side list, separated by commas or spaces:

```sh
GAMES_DISABLED="ace, garden@27010df3470c88a0"
```

-   `ace` pauses every release of Ace.
-   `garden@<release id>` pauses that release only. Publishing a fixed
    release brings the game back without touching the variable.

`/games/<id>` reads it on every request. A paused game's frame is never
mounted, so none of its files are requested; the visitor sees "This game
is paused" and a link back to the lobby, and a lobby trip to it ends with
that reason. The paused state is one of the page's overlays
(`data-game-overlay="paused"`). The lobby's hidden preparation of a game
([loading-and-pausing.md](loading-and-pausing.md)) asks the same question
first (`/api/games/paused?game=<id>`) and loads nothing for a paused game,
or when it can't get an answer. `/dev/games` shows what is paused.

The switch lives in `frontend/features/games/gameDisabled.ts`
(`gamePause.ts` is the page menu's pause of a running game, a different
thing).

To stop a game for certain, pause its id: a release-level pause needs the
page to read `release.json`, and if that fails the game plays. Changing
the variable on the hosting provider takes effect when the deployment
picks up new environment values (on Vercel, a redeploy).

## The check

`pnpm games:check <id>` runs a field-health stage
(`scripts/games/health-stage.mjs`) and writes its result to `check.json`
under `health`:

-   **A game that throws after ready is recorded.** The check asks the
    running game for an uncaught error (`health-probe`, honoured only
    on a page opened with `?check`, asked in the prefix the game greeted
    in) and waits for the report to reach the page. Missing: `HEALTH_ERROR_NOT_RECORDED`.
-   **A disabled game does not load.** The page's decision
    (`gameDisabled.ts`) is run for this game and this build's release id: it
    must pause by id and by release, and play when something else is
    listed. Wrong: `PAUSE_NOT_HONOURED`.

The page's side has Jest tests beside it (`gameHealth.test.ts`,
`gameDisabled.test.ts`, `GamePauseGate.test.tsx`); the frame's side has
`games/runtime/test/health.test.mjs` (`pnpm games:test`).
