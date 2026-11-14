# The game contract

One contract for every game: the lifecycle. A game listed in the catalog
runs through it, is told how the visitor arrived and with whom in `enter()`,
talks to the page in one message prefix, and declares in `game.json` how it
takes arrivals and parties. `pnpm games:check <id>` enforces all of it.
Overview of games: [../games.md](../games.md).

## Rules for a coding agent

1. **Implement the lifecycle.** The game module's default export is a
   factory returning `prepare`, `enter`, `update`, `suspend`, `restore`,
   `dispose` and `inspect` (`games/runtime/src/index.ts`). Don't run your own
   `requestAnimationFrame` loop or timers for gameplay: the host owns the
   clock, so count time in `update(seconds)`.
2. **Read input from `context.input`, `context.pressed` and
   `context.deltas` only**, and declare every action in
   `game.json` → `runtime.input`. The host binds keys from the manifest and
   other devices with `session.action(name, value)`.
3. **Take the visit from `enter(continuity)`**, never from a message of
   your own:
    - `continuity.arrival` is `{ from: "lobby" | "direct", view }`. On
      `"lobby"`, `view` is the lobby's last third-person camera relative to
      the avatar's feet (or null): stand the visitor in that framing.
    - `continuity.trip` is null alone, else
      `{ id, room, size, members, self, arrived }`. `members` are the others
      the lobby named; `arrived` are the others now in the party's room.
      `tripPlayers(trip, me)` gives one list with ids every member agrees on.
      Seed anything shared with `trip.id`.
    - Implement the optional `party(trip)` to hear when someone arrives or
      leaves after `enter()`.
4. **Talk to the page through `connectPage()`**
   (`@oncyber/game-runtime/page`), which speaks `oncyber:game:<kind>`. Don't
   post `<id>:<kind>` messages or add a kind for one game. In the host:
   `page.hello()`, `await page.identity()`, `session.prepare()`,
   `page.ready()`, `session.enter({ ...poses, ...(await page.enterData()) })`,
   then `page.arrivalReady()` once the arrival frame is drawn.
5. **Declare `arrival` and `party` in `game.json`:**

    ```json
    "arrival": { "walkable": true },
    "party": {
        "sizes": [1, 8],
        "formats": [
            { "id": "singles", "label": "1 v 1", "sizes": [2] },
            { "id": "cpu", "label": "Solo vs CPU", "sizes": [1, 2, 3, 4, 5, 6, 7, 8] }
        ]
    }
    ```

    `walkable: true` means a visitor from the lobby is revealed standing in
    the world and can walk before anything starts; the page waits up to 1.5 s
    for `arrivalReady()`. `false` means the game opens on its own screen and
    is revealed at once. `party.sizes` is `[min, max]` within 1 to 8, and
    every size in it needs at least one format. Offer exactly the declared
    formats for a party's size (test it, as `games/ace/test/party.test.js`
    does).

6. **Write `scenario.json`** with at least one assertion, using declared
   actions only. Its optional `enter` stages the visit the check sends:
   `{ "arrival": "lobby" | "direct", "party": 4 }`. Without it the check
   sends a lobby arrival when `arrival.walkable`, else a direct visit, alone.
   Assert what your game did with it through `inspect()`.
7. **Put new shared types in their own file** under `games/runtime/src/`
   and re-export it from `index.ts` with one line. `contract.ts` holds the
   enter data and message prefix, `manifest.ts` holds `game.json`.

## What the check does with it

`pnpm games:check <id>` (stage in `scripts/games/contract-check.mjs`):

| Finding                                          | Meaning                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `CONTRACT_NO_LIFECYCLE`                          | A listed game has no `runtime` block in `game.json`.                        |
| `CONTRACT_NO_SCENARIO`                           | A listed game has no `scenario.json`.                                       |
| `MANIFEST_INVALID`                               | `game.json` breaks a rule above (`arrival`, `party`, `runtime.input`).      |
| `SCENARIO_INVALID`, `SCENARIO_ACTION_UNDECLARED` | The scenario asserts nothing, or presses an action the game didn't declare. |
| `SCENARIO_ENTER_INVALID`                         | `scenario.enter` asks for a party the game doesn't take.                    |
| `CONTRACT_ENTER_ARRIVAL`, `CONTRACT_ENTER_PARTY` | The page sent a visit and `enter()` didn't receive it.                      |
| `CONTRACT_LEGACY_PREFIX` (warning)               | The source or the build still says `<id>:<kind>`.                           |

A game is listed when `frontend/features/games/catalog.ts` has its id. A
game that isn't listed still gets the boot-only check. The last two
`CONTRACT_ENTER_*` findings come from `inspect()`: the runtime adds
`hostArrival`, `hostParty` and `hostPartyArrived`, what `enter()` was handed,
so a scenario can assert on them too.

## Messages

All are `oncyber:game:<kind>`. The page answers a build that greets with
`<id>:hello` in that old form, with `arrival` and `party` as before and no
`enter`, so published builds keep working until they are rebuilt.

| From | Kind                       | Meaning                                                                                                 |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| game | `hello`                    | `{ contract, arrival, party }` from `game.json`. Repeated until `identity` arrives.                     |
| page | `identity`                 | `{ name, pfp, avatarUrl, storage }`.                                                                    |
| game | `ready`                    | Prepared: the game can be entered.                                                                      |
| page | `enter`                    | `{ arrival, trip }` for `enter()`. With `identity` on a direct visit; just before the reveal on a trip. |
| game | `arrival-ready`            | The arrival frame is drawn.                                                                             |
| page | `entered`                  | The game is revealed. Hold the clock from `arrival-ready` until this on a lobby trip.                   |
| page | `party`                    | `{ party: trip }`: the trip changed (members named, someone arrived or left).                           |
| page | `self`, `peers`, `net`     | The room: the visitor's room id, everyone else, relayed packets.                                        |
| game | `pose`, `net`, `storage`   | The visitor's pose, a packet for the room, a value to save.                                             |
| both | `exit`, `error`, `dispose` | Back to the lobby, failed to load, the visit is over.                                                   |

## Where it lives

| File                                      | What                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `games/runtime/src/contract.ts`           | Enter data (`Arrival`, `Trip`), the prefix, bounded readers, `tripPlayers` |
| `games/runtime/src/manifest.ts`           | `game.json` types and `validateGameJson`                                   |
| `games/runtime/src/page.ts`               | `connectPage()`, the game's side of the bridge                             |
| `frontend/features/games/gameContract.ts` | The page's side: prefix, `enter` message, the trip from the party's room   |
| `scripts/games/contract-check.mjs`        | The check stage                                                            |
| `games/ace/`                              | The reference: `src/host.js` (host), `src/game.js` (game), `scenario.json` |
