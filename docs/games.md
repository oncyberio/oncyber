# Games

Games are plain web code, usually three.js, that run in the same sandboxed
frame as other outside content ([content-host.md](content-host.md)). Oncyber
gives them a small lifecycle, a page bridge for identity, rooms and saved
data, and a browser check that must pass before a release is published. It
ships no engine. Why: [plans/agent-built-worlds.md](plans/agent-built-worlds.md).

Games are hidden at launch: `/games/<id>` answers only in development or
where `GAMES_PREVIEW=1` is set.

## Where things are

| Path                              | What it is                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `games/runtime/`                  | The lifecycle runtime (TypeScript source, no dependencies). Games bundle it.        |
| `docs/games/`                     | One page of rules per area of the contract, written for coding agents.              |
| `games/<id>/`                     | A game's source, its `game.json` manifest and `scenario.json`. Its own npm project. |
| `frontend/public/games/<id>/`     | The published build, plus `release.json` and `check.json`. Committed.               |
| `frontend/features/games/`        | The page side: catalog, the page bridge (`GamePage`), the shared room, saved data.  |
| `frontend/pages/games/[game].tsx` | `/games/<id>`.                                                                      |
| `frontend/pages/dev/games.tsx`    | `/dev/games`: each game's release and last check.                                   |
| `scripts/games/games.mjs`         | `pnpm games:check` and `pnpm games:publish`.                                        |

## The lifecycle

A game module's default export is a factory: it gets a context and returns
seven functions. The host owns the clock.

```ts
type GameFactory = (context: GameContext) => {
    prepare(): Promise<void>; // load and build, before anyone sees it
    enter(continuity): void; // the visitor arrives (avatar, camera, party)
    update(seconds: number): void; // one frame
    suspend(): Json; // pause; return state as plain data
    restore(state: Json): void; // resume from that state
    dispose(): void;
    inspect(): Record<string, Json>; // facts the checks can assert on
};
```

`context` carries the canvas (`graphics`), named input actions (`input`,
`deltas`, `pressed`, declared in `game.json`), a bounded JSON channel to a
separate UI frame (`ui.publish`), and `services`: `identity`, the release's
declared `asset()` files, `avatar()` bytes for avatars the page vouches for,
and `call(capability, operation, value)` for anything else the game declared
(storage, audio, network, travel). Undeclared capabilities, assets and input
actions are refused. Full types: `games/runtime/src/index.ts`.

The lifecycle is the one contract: a game listed in the catalog must use
it, `enter()` carries how the visitor arrived (`continuity.arrival`) and who
came along (`continuity.trip`), and `game.json` declares `arrival` and
`party`. The rules, written for coding agents: [games/contract.md](games/contract.md).

## The page bridge

`GamePage` mounts `public/games/<id>/index.html` with
`sandbox="allow-scripts allow-pointer-lock"`. The game has an opaque origin:
no cookies, storage or account access. Messages are `oncyber:game:<kind>`
for every game; a build from before the contract says `<id>:<kind>` and is
still answered in that form ([games/contract.md](games/contract.md)):

| From        | Kind                       | Meaning                                                                                                                                                                            |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| game        | `hello`                    | Repeat until `identity` arrives.                                                                                                                                                   |
| page        | `identity`                 | `{ name, pfp, avatarUrl, storage }`: public fields and the game's saved values.                                                                                                    |
| game        | `ready` / `error` / `exit` | First frame drawn / failed to load / back to the lobby.                                                                                                                            |
| game        | `storage`                  | `{ key, value }`: save one value (`save`, `settings` or `muted`, strings up to 256 KiB).                                                                                           |
| game        | `pose`                     | The player's pose for the shared room.                                                                                                                                             |
| page        | `peers`                    | Everyone else in the room, ten times a second.                                                                                                                                     |
| page / game | `self`, `net`              | With `relay`: the room id, and game packets to and from the room.                                                                                                                  |
| page        | `entered` / `dispose`      | The visitor arrived from the lobby / is leaving.                                                                                                                                   |
| page        | `enter`                    | `{ arrival, trip }`: the page's part of `enter()`'s data. With `identity` on a direct visit, just before the reveal on a lobby trip.                                               |
| page        | `party`                    | `{ party }`: the trip, `{ id, room, size, members, self, arrived }`, or `null` when alone. Sent when the members are known and when someone arrives in the party's room or leaves. |
| game        | `arrival-ready`            | The game has framed the visitor as the lobby left them (the page waits 1.5 s at most, and not at all for a game that declared `arrival.walkable: false`).                          |
| page        | `arrival`                  | Old builds only: `{ view }`, the lobby's third-person camera. Contract games get it in `enter`.                                                                                    |

Files under `/games/<id>/` are served with `Access-Control-Allow-Origin: *`
because the opaque frame loads them in CORS mode.

## Parties

A lobby group that travels together shares one trip id. The page reads it
(`features/games/gameParty.ts`) and puts the party in a room of its own,
`oncyber-<game>-party-<trip id>`, with the relay on. The game gets the trip
in `enter()` (`continuity.trip`) and again through `party(trip)` when it
changes: the members the lobby named, the room's name, the visitor's room id
and who has arrived (ids every member sees the same way), plus `net` packets
between them.

What a game does with it is the game's choice. Ace offers formats by party
size (`games/ace/src/party.js`): 1 v 1 for two, 2 v 2 or a tournament for
four, a round robin for three, a knockout for five to eight, and always a
solo match against the CPU. The draw is seeded by the party id and sorted by
room id, so it is the same on every member's screen. Playing each other is
not built yet: it needs a real-time match channel (the relay carries about
five packets a second per player, enough for turn state, not for a rally).

On the development server, `/games/<id>?party=4` stands in for arriving
with a party of four; open it in several windows to share the room.

## The games today

| Game                       | Page                                                                                 | Lifecycle | Check                       |
| -------------------------- | ------------------------------------------------------------------------------------ | --------- | --------------------------- |
| Bloom Garden (`garden`)    | shared `GamePage`, sandboxed, shared room and relay                                  | yes       | scenario, lifecycle, frames |
| ACE! Tennis (`ace`)        | shared `GamePage`, sandboxed, no room (CPU match)                                    | yes       | scenario, lifecycle, frames |
| Glasshouse Padel (`padel`) | its own page (`pages/games/padel.tsx`) with the club social layer, same-origin frame | not yet   | fails: no lifecycle         |

A listed game without the lifecycle or a scenario fails the check
(`CONTRACT_NO_LIFECYCLE`, `CONTRACT_NO_SCENARIO`), so Padel can't be
published again until it moves onto the lifecycle (and into the sandbox).
A game that isn't in the catalog gets a boot-only check: it must load, say
`ready` and throw no page errors for five seconds. Garden's published build
still greets with `garden:hello`; it keeps working and the check warns.

## Make a game

1. Copy `games/garden` as a template, or start a Vite project in
   `games/<id>/` that builds into `frontend/public/games/<id>/` and aliases
   `@oncyber/game-runtime` to `games/runtime/src` (see the garden's
   `vite.config.js`).
2. Write `game.json` (`arrival`, `party`, `runtime.capabilities`, `assets`,
   `input`) and a `scenario.json` that proves the game works: actions,
   waits and assertions on `inspect()` keys
   ([games/contract.md](games/contract.md)).
3. Add the game to `frontend/features/games/catalog.ts`.
4. Open `/games/<id>` on the dev server.

## Check and publish

```sh
pnpm games:check garden      # run the check on the current build
pnpm games:publish garden    # build, check, and write release.json if it passed
```

The check first reads `game.json` and `scenario.json` against the contract
(`scripts/games/contract-check.mjs`). It then serves the build on a loopback
port, opens it in the same sandbox with `?check`, stages the visit the
scenario asks for (a lobby arrival, a party), and the game (through
`runCheck` in
`games/runtime/src/check.ts`) plays its scenario, suspends, restores, then
measures 180 frames. The script adds the bundle's size and declared files,
console errors and a screenshot (`games/<id>/.check/screenshot.png`), and
writes `check.json`. Boot, scenario, lifecycle and frames must pass, and
the bundle must stay under 30 MiB with every declared file present. Console
errors are listed but don't block, since games load avatars from the network.

A release is the set of files whose hashes make up its `release` id. Commit
`frontend/public/games/<id>` to ship it.

It needs Playwright and Chromium. `PW_CHANNEL=chrome` uses the installed
Chrome and its GPU; `--headed` shows the window. Headless frame times follow
the headless browser's frame rate, not the game's. Without a GPU a WebGL
game renders slowly; `GAMES_CHECK_TIMEOUT_S=600` waits longer for the report.

## Not built yet

-   Live editing (the swap in `plans/live-swap-prototype/`) inside this host.
-   Hosted releases: publishing is a commit today, not an upload.
-   Phone and headset profiles for the check.
-   Games in the lobby's Explore panel outside the development server.
