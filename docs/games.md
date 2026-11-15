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
| `games/kits/avatar/`              | Optional avatar kit for three.js games: [games/avatar-kit.md](games/avatar-kit.md). |
| `games/kits/locomotion/`          | Optional kit to walk like the lobby: [games/locomotion.md](games/locomotion.md).    |
| `frontend/public/games/<id>/`     | The published build, plus `release.json` and `check.json`. Committed.               |
| `frontend/features/games/`        | The page side: catalog, the page bridge (`GamePage`), the shared room, saved data.  |
| `frontend/pages/games/[game].tsx` | `/games/<id>`.                                                                      |
| `frontend/pages/dev/games.tsx`    | `/dev/games`: each game's release and last check.                                   |
| `scripts/games/games.mjs`         | `pnpm games:check` and `pnpm games:publish`.                                        |
| `docs/games/party.md`             | Parties: roster, host, seats, formats, the match channel, and the rule for games.   |
| `games/kits/ui/`                  | Optional UI kit so menus look like Oncyber. See [games/ui-kit.md](games/ui-kit.md). |
| `docs/games/listing.md`           | What a game's listing must contain, and what the lobby shows from it.               |

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

Input comes only from declared actions: a game adds no key listeners and
binds no key the page reserves. The rule and its check:
[games/keys-focus.md](games/keys-focus.md).

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
| game        | `storage`                  | `{ key, value }`: save one value (`save` or `settings`, strings up to 256 KiB).                                                                                                    |
| game        | `pose`                     | The player's pose for the shared room.                                                                                                                                             |
| page        | `peers`                    | Everyone else in the room, ten times a second.                                                                                                                                     |
| page / game | `self`, `net`              | With `relay`: the room id, and game packets to and from the room.                                                                                                                  |
| page        | `entered` / `dispose`      | The visitor arrived from the lobby / is leaving.                                                                                                                                   |
| page        | `enter`                    | `{ arrival, trip }`: the page's part of `enter()`'s data. With `identity` on a direct visit, just before the reveal on a lobby trip.                                               |
| page        | `party`                    | `{ party }`: the trip, `{ id, room, size, members, self, arrived }`, or `null` when alone. Sent when the members are known and when someone arrives in the party's room or leaves. |
| game        | `arrival-ready`            | The game has framed the visitor as the lobby left them (the page waits 1.5 s at most, and not at all for a game that declared `arrival.walkable: false`).                          |
| page        | `arrival`                  | Old builds only: `{ view }`, the lobby's third-person camera. Contract games get it in `enter`.                                                                                    |
| game / page | `key`, `input`, `muted`    | Keys and focus: the page owns Escape, Enter and M, and pauses the game's input while the visitor types or a page menu is open. See [games/keys-focus.md](games/keys-focus.md).     |
| page        | `safe-area`                | `{ insets, width, height }`: how far in the page's controls and chat reach, in CSS pixels, on `hello`, `ready` and every change ([games/safe-area.md](games/safe-area.md)).        |
| game        | `result`                   | A match ended: `{ result }`, exactly one per finished match. The page answers `result-status`. See [games/results.md](games/results.md).                                           |

Chat and voice are the page's: a game never builds its own. It may send
`voice` (poses for spatial voice) and it receives `talking`. See
[games/voice-chat.md](games/voice-chat.md).

Leaving has its own four messages (`exit`, `departure`, `departure-staging`,
`departure-ready`) and one rule: exit always returns to the lobby, from the
walkable arrival state, never from a dead end. See
[games/departure.md](games/departure.md).

Loading and pausing add `progress`, `first-frame`, `frame`, `pause` and
`resume`, with four rules every game follows (progress while preparing, a
first-frame signal, redraw on resize, solo games pause and multiplayer
matches don't) and one pause for a hidden tab, a page menu and the page's
input pause: [games/loading-and-pausing.md](games/loading-and-pausing.md).

Sound has its own messages (`audio`, `audio-state`) and one rule: route all
sound through the SDK's output; never keep a private mute. See
[games/sound.md](games/sound.md).

Saved data has its own messages (`saved`, `saved-result`) and rule:
declare every key in `game.json`; saved values are plain JSON with a
version. See [games/saved-data.md](games/saved-data.md). The fixed
`storage` keys above remain for games that have not moved yet; Ace and
Garden have.

Files under `/games/<id>/` are served with `Access-Control-Allow-Origin: *`
because the opaque frame loads them in CORS mode.

## What a good game does

The rules a game is held to, the brief to fill in before building and the
definition of done are one page: [games/good-game.md](games/good-game.md)
(served in the app at `/docs/good-game`). In short: arrive like a world,
match the handoff, respect the party, keep a solo path, ship a bot; done
is `pnpm games:check <id>` passing.

## Arriving from the lobby

What the lobby hands over, measured on 14 November 2026 by recording the
trip frame by frame:

-   **The view** (`arrival`, a `LobbyTravelView` from
    `frontend/features/lobby/lobbyJourneyProtocol.ts`): `cameraOffset` and
    `cameraTargetOffset` relative to the avatar's feet, `avatarRotation`,
    `avatarHeight` (1.8) and `fov`. The page sends it just before the reveal
    and waits up to 1.5 s for `arrival-ready`.
-   **Where the camera is.** In front of the avatar, not behind: about 5 m
    away (4.6 m plus 0.44 m per party member), 2 m up, looking at a point
    1.05 m above the feet, with a 58° field of view. The camera sits at
    angle `avatarRotation + π` around the avatar, and from there you see the
    avatar's face.
-   **How the avatar ends the trip.** Crouched (hips at about half height),
    facing the camera, nothing in its hands, on a black background.
-   **The sequence.** `ready` (game prepared, hidden) → the lobby plays its
    departure → `arrival` → the game frames the visitor and answers
    `arrival-ready` → the lobby hides and the game shows → `entered`.

What a game does with it (Ace's `goArrive` in `games/ace/src/game.js` is the
reference):

1. Scale the offsets by its own avatar height over `avatarHeight`.
2. Turn the whole formation (camera and target together) so the camera
   looks where the game wants; the framing on screen doesn't change with
   that turn. Ace turns it by `π − avatarRotation` so the camera looks down
   the court at the net.
3. Stand the avatar at its arrival spot **facing the camera**, crouched,
   with no held items, and keep the lobby's field of view.
4. Render two frames, then answer `arrival-ready`.
5. On `entered`, stand the avatar up (Ace takes 0.7 s) and only then accept
   movement. Walking is relative to the camera; dragging looks around.
6. Keep the arrival spot and the camera behind it inside the walls: a
   camera 5 m behind the visitor must not end up outside the place.
7. Redraw at once after a resize. Resizing clears the canvas, and waiting
   for the next animation frame shows an empty one.

## Screen space

The page floats its controls and chat over the frame. Keep the HUD and menus
inside the safe-area insets it sends, and report where they are so the check
can prove it: [games/safe-area.md](games/safe-area.md).

## Parties

A lobby group that travels together shares one trip id. The page reads it
(`features/games/gameParty.ts`) and puts the party in a room of its own,
`oncyber-<game>-party-<trip id>`, with the relay on. The game gets the trip
in `enter()` (`continuity.trip`) and again through `party(trip)` when it
changes: the members the lobby named, the room's name, the visitor's room id
and who has arrived (ids every member sees the same way), plus `net` packets
between them. Someone who opens `/games/<id>?join=<party id>` after the party
(the "Your party is here" card in Explore) joins the same room and gets the
same trip, with no members named by the lobby: the roster names them
([games/listing.md](games/listing.md)).

When one member starts the trip back to the lobby, the others are offered
to follow ([games/departure.md](games/departure.md)).

A party's room also has a **roster** (members in arrival order, the host,
seats, who dropped and may come back), which rides in the same trip as
`trip.roster`, and a **real-time match channel** (`match`: about thirty
small packets a second per member, limits enforced by the server), which
the relay's five packets a second can't be. The runtime has the game's side of both, plus the shared formats
and seeded draws (`games/runtime/src/partyLink.ts`, `roster.ts`, `match.ts`,
`party.ts`).

The rule for every game: state in `game.json` what a party of 1, 2, 3, 4
and 5 to 8 is offered, always with a solo option, and what late, dropped
and extra players get; `games:check` holds the game to it and drops a
member mid-match. All of it, with the API: [games/party.md](games/party.md).

Ace plays 1 v 1 between two party members this way (`games/ace/src/duel.js`):
the CPU takes over a dropped player's side, and a third member can watch.
Its doubles and tournaments show the seeded draw and are not played yet.

On the development server, `/games/<id>?party=4` stands in for arriving
with a party of four; open it in several windows to share the room.

## The games today

| Game                       | Page                                                                                 | Lifecycle | Check                                                     |
| -------------------------- | ------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------- |
| Bloom Garden (`garden`)    | shared `GamePage`, sandboxed, shared room and relay                                  | yes       | every stage but departure and locomotion; phone unclaimed |
| ACE! Tennis (`ace`)        | shared `GamePage`, sandboxed, no room alone; 1 v 1 in a party's room                 | yes       | every stage                                               |
| Glasshouse Padel (`padel`) | its own page (`pages/games/padel.tsx`) with the club social layer, same-origin frame | not yet   | fails: no lifecycle, no brief, no bot                     |

A listed game without the lifecycle or a scenario fails the check
(`CONTRACT_NO_LIFECYCLE`, `CONTRACT_NO_SCENARIO`), so Padel can't be
published again until it moves onto the lifecycle (and into the sandbox).
A game that isn't in the catalog gets a boot-only check: it must load, say
`ready` and throw no page errors for five seconds. Garden's published build
still greets with `garden:hello`; it keeps working and the check warns.

## Make a game

Read [games/good-game.md](games/good-game.md) first: the rules a game is
held to, the brief to fill in before building, and the definition of done.
`pnpm games:new <id>` does steps 1 to 3 below, adds the brief, a bot stub
and a scenario stub, and declares the game's saved keys to the page;
`pnpm games:score` reports which checks each game passes.

1. Copy `games/garden` as a template, or start a Vite project in
   `games/<id>/` that builds into `frontend/public/games/<id>/` and aliases
   `@oncyber/game-runtime` to `games/runtime/src` (see the garden's
   `vite.config.js`).
2. Write `game.json` (`format`, `arrival`, `party`, `devices`, `avatars`,
   `saved`, `runtime.capabilities`, `assets`, `input`), a `scenario.json`
   that proves the game works (actions, waits and assertions on
   `inspect()` keys, [games/contract.md](games/contract.md)) and a
   `bot.json` that plays it through the keyboard
   ([games/good-game.md](games/good-game.md)).
3. Write the `listing` in `game.json` and run `pnpm games:catalog`, which
   adds the game to the site's catalog ([games/listing.md](games/listing.md)).
4. Open `/games/<id>` on the dev server.

## Devices

Declare `devices` (`desktop`, `phone`, `gamepad`) and each action's
`keyboard`, `touch` and `gamepad` bindings in `game.json`; the runtime
draws the touch stick and buttons and maps the gamepad. Never read touch or
gamepad events in game code. The check plays each device and fails when a
claimed phone doesn't pass. Rules: [games/devices.md](games/devices.md).

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
writes `check.json`. A `social` stage then sends two visitors from a lobby
into the game and checks their chat and voice came with them
([games/voice-chat.md](games/voice-chat.md)). A safe-area stage reopens the
game under the page's overlays at desktop and phone sizes and fails if the
HUD sits under one ([games/safe-area.md](games/safe-area.md)).
Boot, scenario, lifecycle, frames, social and safe area must pass, and
the bundle must stay under 30 MiB with every declared file present. Console
errors are listed but don't block, since games load avatars from the network.
The keys stage (`scripts/games/keysCheck.mjs`) then scans the source for raw
key listeners and types in the page's chat during play; it must pass too.

The check also runs an avatar stage with a party of two: other people are
drawn as their Oncyber avatars and the visitor arrives in the arrival pose,
unless `game.json` says why not. See [games/avatar-kit.md](games/avatar-kit.md).

A game that declares `"departure": "matched"` must also pass the departure
stage ([games/departure.md](games/departure.md)): right after the scenario,
the check plays the page's part of leaving and compares the last game frame
with the lobby's first.

Every game also gets the party stage ([games/party.md](games/party.md)): its
`party` statement in `game.json`, the options it offers by party size, and a
member dropped mid-match.

The loading stage ([games/loading-and-pausing.md](games/loading-and-pausing.md))
runs on the live game right after the scenario, before the departure
stage: time to the first frame, progress before it, no blank canvas on a
resize, and state held across a page menu and a hidden tab.

A game that says `"locomotion": "lobby"` gets the locomotion stage
([games/locomotion.md](games/locomotion.md)) on a visit of its own: forward
held for two seconds must cover the lobby's distance.

Every finished match reports exactly one result
([games/results.md](games/results.md)). The check records the results a
game posts and fails on an invalid or repeated one; a game whose
`game.json` has a `results` block also has to finish a match during the
check and send exactly one.

Menu screens that use none of the UI kit's classes are listed as a warning
(`UI_KIT_UNUSED`), which doesn't block either.

A `sound` stage follows ([games/sound.md](games/sound.md)): boot-only games
that use the SDK's sound output get it too.

A game that declares `saved` keys gets the saved-data stage
([games/saved-data.md](games/saved-data.md)) after the party stage: each key
is saved through the game, reloaded and read back, and the game is booted
with old, unreadable and future-version saves.

The process stage (`scripts/games/process.mjs`) runs last. It holds the
game to its brief, its party statement and its bot, then plays `bot.json`
through the keyboard on a visit of its own: a lobby arrival, a match to its
result, and back to the arrival. `--video` (or `GAMES_CHECK_VIDEO=1`) also
records that run to `games/<id>/.check/bot.webm` for a person to watch; it
is off by default because the game then draws at full size.
`node scripts/games/process.mjs <id>` runs the stage alone.

Every stage in order, with its finding codes, is the table under "Done" in
[games/good-game.md](games/good-game.md); `pnpm games:score <id>` prints
the last report against it.

A release is the set of files whose hashes make up its `release` id. Commit
`frontend/public/games/<id>` to ship it.

It needs Playwright and Chromium. `PW_CHANNEL=chrome` uses the installed
Chrome and its GPU; `--headed` shows the window. Headless frame times follow
the headless browser's frame rate, not the game's. Without a GPU a WebGL
game renders slowly; `GAMES_CHECK_TIMEOUT_S=600` waits longer for the report.

## SDK and checks still owed

What the first version of this list asked for is delivered: `enter()`
carries the lobby's view and the trip, the locomotion kit has the arrival
helper, the avatar kit the arrival pose, the page waits for a first-frame
signal, `game.json` declares `arrival` and `party`, and the check has the
arrival, handoff and party stages ([games/good-game.md](games/good-game.md)).
Still owed:

-   **Padel** is not on the lifecycle or in the sandbox, and has no brief
    and no bot; it fails the check until it is.
-   **Bloom Garden** still speaks `garden:<kind>` (it should move to
    `connectPage()` and read the visit from `enter()`), has no matched
    departure, does not claim the phone, and draws its avatars, arrival
    pose and menus with its own code instead of the kits.
-   **Ace** shows the draw for doubles and tournaments; playing them
    through is not built.
-   The process stage's bot plays alone. A bot for a match between two
    members is the party stage's own (`party.play`), not `bot.json`.

## Not built yet

-   Live editing (the swap in `plans/live-swap-prototype/`) inside this host.
-   Hosted releases: publishing is a commit today, not an upload.
-   A headset profile for the check (phone and gamepad: [games/devices.md](games/devices.md)).
-   Games in the lobby's Explore panel outside the development server.
