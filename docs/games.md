# Games

Games are plain web code, usually three.js, that run in the same sandboxed
frame as other outside content ([content-host.md](content-host.md)). Oncyber
gives them a small lifecycle, a page bridge for identity, rooms and saved
data, and a browser check that must pass before a release is published. It
ships no engine. Why: [plans/agent-built-worlds.md](plans/agent-built-worlds.md).

Games are hidden at launch. Nothing of a game answers outside development
unless `GAMES_PREVIEW=1` is set: not its page (`/games/<id>`), not the files
of its build (`/game-builds/<id>/...`, `check.json` and `release.json` included,
stopped in `frontend/middleware.ts`), not its hosted releases
(`/api/games/releases/`), its saved data, its results or publishing. One
function decides for all of them: `gamesPreviewEnabled` in
`frontend/features/games/gamesPreview.ts`. The variable is the server's, so
in a browser only the development server reads as on: a preview deployment
serves a game to someone who has its address, and the lobby lists games on
the development server alone.

## Addresses

A game lives at `/games/<id>`: the site's page (`pages/games/[game].tsx`),
which frames the game. Its committed build is served from somewhere else,
`/game-builds/<id>/` (`frontend/public/game-builds/<id>/`), and that is
deliberate. A host answers a folder's address with the index file inside
it, ahead of any page: while builds were kept in `public/games/<id>/`, a
deployment answered `/games/<id>` with the build's own `index.html`, the
raw game with no page around it. Nothing may be put under `public/games/`
again; `gamesPreview.test.ts` fails if the folder comes back.

The build's address is one constant on each side that needs it
(`GAME_BUILDS_PATH` in `features/games/publish/gameRelease.ts` for the frame,
`networkPolicy.js` for the files' headers, `gamesPreview.ts` for the
middleware) and the tests hold them together. `game-builds` is reserved, so
no space can take it as its link (`utils/reservedLinks.js`).

### A game at `/<slug>`

A game is at `/games/<id>` until it has a slug, and then also at `/<slug>`;
a space is at `/spaces/<id>` until its owner sets a link, and then also at
`/<link>`. Both answer with the same page (`features/games/GameRoute.tsx`,
its props from `gameRouteServer.ts`), behind the same gates: with games
hidden, `/<slug>` is the site's ordinary "nothing here" page.

**The canonical address is `/<slug>` when a slug is set, else
`/games/<id>`.** Both addresses carry it as `<link rel="canonical">`, and
`gamePath(game)` (`features/games/gameSlug.ts`) is the one place that
decides. `/games/<id>` never redirects: it is the permanent address, what
the lobby's cards, party links and rooms are made from, and it keeps
working when the slug changes or is given up. A slug typed with capitals
redirects to the lowercase one.

Spaces, profiles, the site's own pages and games share one set of names,
and nothing is claimed twice:

| Whose name               | Where it is kept                                                               | Who refuses a second claim                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The site's pages         | `utils/reservedLinks.js`                                                       | Space links (`isReservedLink`), game slugs (`gameSlugProblem`, and `pnpm games:catalog` for a catalogued game)                                                                           |
| A catalogued game's slug | `page.slug` in `game.json`, generated into `features/games/catalog.slugs.json` | `pnpm games:catalog` fails on a slug that is a reserved link or another game's; `reservedLinks.js` reads the file, so a space or a published game asking for the name is refused         |
| A published game's slug  | `slug` on its `publishedGames` record, and the claim `gameLinks/<slug>`        | `gamePublish.link`, in one transaction that reads the claim and the spaces; `exhibit/updateCustomLink` reads the claim in its own transaction, the older `api/customLink` before writing |
| A space's link           | `info.customLink` on its `exhibits` record                                     | `exhibit/updateCustomLink` among spaces, as before; `gamePublish.link` refuses a slug a space holds                                                                                      |
| A profile                | `/@name`: the `@` keeps it apart from every other name                         |                                                                                                                                                                                          |

`pages/[slug].tsx` asks in this order: a profile (`@name`), a catalogued
game's slug (a reserved name, so no space can hold it; asked from memory,
it costs other names nothing), a space's link exactly as before, and last,
only when no space has the name, a published game's claim. With games
hidden the two game steps are skipped.

What a person must still do, and what is not there:

-   **Before a catalogued game is given a slug**, look for a space that
    already holds the name (`exhibits` where `info.customLink == <slug>`,
    in the production project). A catalogued game's slug is a reserved
    link from then on, so where games are on such a space would lose
    `/<link>` to the game. No game in this repository has a slug yet:
    choosing one is the owner's.
-   Slugs are lowercase. Space links are compared as written, so an older
    space link with capitals is a different name from a game's slug; a new
    space link that differs from a game's slug only in capitals is refused.
-   `api/customLink` (the older route) checks and writes without a
    transaction, as it always has, so two requests at the same instant can
    still race there. `exhibit/updateCustomLink` reads spaces outside its
    transaction, as before, and the game's claim inside it.
-   An unpublished game keeps its slug, as it keeps its id: `/<slug>`
    answers "nothing here" and nobody else can take the name until the
    owner gives it up (`oncyber link <id> --clear`).
-   Nothing needs a data migration or a new index: a claim is read by its
    document id, and the space lookup is the one-field equality query the
    slug page already runs.

## Where things are

| Path                                | What it is                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `games/runtime/`                    | The lifecycle runtime (TypeScript source, no dependencies). Games bundle it.        |
| `docs/games/`                       | One page of rules per area of the contract, written for coding agents.              |
| `games/<id>/`                       | A game's source, its `game.json` manifest and `scenario.json`. Its own npm project. |
| `games/kits/avatar/`                | Optional avatar kit for three.js games: [games/avatar-kit.md](games/avatar-kit.md). |
| `games/kits/locomotion/`            | Optional kit to walk like the lobby: [games/locomotion.md](games/locomotion.md).    |
| `frontend/public/game-builds/<id>/` | The published build, plus `release.json` and `check.json`. Committed.               |
| `frontend/features/games/`          | The page side, in folders by area: the table below.                                 |
| `frontend/features/frame/`          | What a page does for any frame it hosts, a game or a framed world: the table below. |
| `frontend/pages/games/[game].tsx`   | `/games/<id>`.                                                                      |
| `frontend/pages/dev/games.tsx`      | `/dev/games`: each game's release and last check.                                   |
| `scripts/games/games.mjs`           | `pnpm games:check` and `pnpm games:publish`.                                        |
| `docs/games/party.md`               | Parties: roster, host, seats, formats, the match channel, and the rule for games.   |
| `games/kits/ui/`                    | Optional UI kit so menus look like Oncyber. See [games/ui-kit.md](games/ui-kit.md). |
| `docs/games/listing.md`             | What a game's listing must contain, and what the lobby shows from it.               |
| `scripts/games/releases/`           | Hosted releases and rollback: [games/releases.md](games/releases.md).               |
| `games/runtime/messages.json`       | Every message kind, who sends it, and the file on each side that handles it.        |
| `games/<id>/build.json`             | What the committed build was made from (`scripts/games/build-record.mjs`).          |

The page side, `frontend/features/games/`:

| Folder       | What it holds                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (the folder) | The catalog and its slugs, the switch that hides games (`gamesPreview.ts`), a game's addresses (`gameSlug.ts`) and the page itself (`GamePage.tsx`, `GameRoute.tsx`). |
| `contract/`  | What the page and a game say to each other: the contract, keys and focus, safe areas, pausing, sound, and the tests that hold both halves together.                   |
| `loading/`   | Loading: the state machine, the cover, and preparing a game from the lobby.                                                                                           |
| `room/`      | The game's room and the party: roster, match channel, joining, presence, leaving together.                                                                            |
| `social/`    | Chat and voice on a game page, and the handoff from the lobby.                                                                                                        |
| `health/`    | Field health and the kill switch.                                                                                                                                     |
| `saved/`     | Saved data: the shared rules, the page's bridge, the server's half.                                                                                                   |
| `results/`   | Match results and how far they are trusted.                                                                                                                           |
| `publish/`   | Releases and where a frame loads from, the network policy, and games published from outside the repository.                                                           |
| `interface/` | The page's controls over a game, built on the design system: the shared controls, credits, sound, the device gate, the lobby's cards, the avatar picker.              |

`frontend/features/frame/` holds what worlds use too and no game owns: which
document a frame is (`frameOrigin.ts`), whether it has stalled
(`frameStall.ts`), voice in a room (`roomVoice.ts`, `voiceLevels.ts`,
`gameTalking.ts`) and the visitor a frame may see (`gameIdentity.ts`,
`accountIdentity.ts`). It imports nothing from `features/games` or
`features/worlds`; both import it. A file that serves games and worlds
alike goes there, not into either feature.

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

`GamePage` mounts `public/game-builds/<id>/index.html` with
`sandbox="allow-scripts allow-pointer-lock"`. The game has an opaque origin:
no cookies, storage or account access. Messages are `oncyber:game:<kind>`
for every game; a build from before the contract says `<id>:<kind>` and is
still answered in that form ([games/contract.md](games/contract.md)). The
table is the outline; the one full list, with who sends each kind and the
file on each side that handles it, is `games/runtime/messages.json`, and
both sides' tests hold the code to it:

| From        | Kind                       | Meaning                                                                                                                                                                                                   |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| game        | `hello`                    | Repeat until `identity` arrives.                                                                                                                                                                          |
| page        | `identity`                 | `{ name, pfp, avatarUrl }`: public fields only; the name is cut to 24 characters.                                                                                                                         |
| game        | `ready` / `error` / `exit` | First frame drawn / failed to load / back to the lobby.                                                                                                                                                   |
| game        | `pose`                     | The player's pose for the shared room.                                                                                                                                                                    |
| page        | `peers`                    | Everyone else in the room, ten times a second.                                                                                                                                                            |
| page / game | `self`, `net`              | With `relay`: the room id, and game packets to and from the room.                                                                                                                                         |
| page        | `entered` / `dispose`      | The visitor arrived from the lobby / is leaving.                                                                                                                                                          |
| page        | `enter`                    | `{ arrival, trip }`: the page's part of `enter()`'s data. With `identity` on a direct visit, just before the reveal on a lobby trip.                                                                      |
| page        | `party`                    | `{ party }`: the trip, `{ id, room, size, members, self, arrived }`, or `null` when alone. Sent when the members are known and when someone arrives in the party's room or leaves.                        |
| game        | `arrival-ready`            | The game has framed the visitor as the lobby left them (the page waits 1.5 s at most, and not at all for a game that declared `arrival.walkable: false`).                                                 |
| page        | `arrival`                  | Old builds only: `{ view }`, the lobby's third-person camera. Contract games get it in `enter`.                                                                                                           |
| game / page | `key`, `input`, `muted`    | Keys and focus: the page owns Escape and Enter (and M only with Cmd or Ctrl), and pauses the game's input while the visitor types or a page menu is open. See [games/keys-focus.md](games/keys-focus.md). |
| page        | `safe-area`                | `{ insets, width, height }`: how far in the page's controls and chat reach, in CSS pixels, on `hello`, `ready` and every change ([games/safe-area.md](games/safe-area.md)).                               |
| game        | `result`                   | A match ended: `{ result }`, exactly one per finished match. The page answers `result-status`. See [games/results.md](games/results.md).                                                                  |

Chat and voice are the page's: a game never builds its own. It may send
`voice` (poses for spatial voice) and it receives `talking`. See
[games/voice-chat.md](games/voice-chat.md).

The avatar picker is the page's too, the same one a framed world gets
(`frontend/features/avatar-picker/`): a game asks for it (`avatar-picker`)
and is told what the visitor chose (`avatar`), which it wears in place with
the avatar kit's `kit.wear(url)`. A game never lists avatars, draws a
picker or saves one. See [games/avatar-kit.md](games/avatar-kit.md),
"Changing avatar".

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
version. See [games/saved-data.md](games/saved-data.md). The page's older
string storage (a `storage` message and values in `identity`) went with
contract 3; what a visitor saved through it still reads as a key's first
value.

Files under `/game-builds/<id>/` are served with `Access-Control-Allow-Origin: *`
because the opaque frame loads them in CORS mode.

A game reaches only its own files and the hosts in its `game.json`
`network` list, and a result counts for a leaderboard only when the whole
party reported the same one. Both rules: [games/trust.md](games/trust.md).

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
(`features/games/room/gameParty.ts`) and puts the party in a room of its own,
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

| Game                        | Page                                                                     | Lifecycle | Check                                                     |
| --------------------------- | ------------------------------------------------------------------------ | --------- | --------------------------------------------------------- |
| Bloom Garden (`garden`)     | shared `GamePage`, sandboxed, shared room and relay                      | yes       | every stage but departure and locomotion; phone unclaimed |
| ACE! Tennis (`ace`)         | shared `GamePage`, sandboxed, no room alone; 1 v 1 in a party's room     | yes       | every stage                                               |
| Glasshouse Padel (`padel`)  | shared `GamePage`, sandboxed, a shared club room (no relay)              | yes       | every stage; phone unclaimed                              |
| Lantern Tag (`lantern-tag`) | shared `GamePage`, sandboxed, no room alone; one round in a party's room | yes       | every stage                                               |

A listed game without the lifecycle or a scenario fails the check
(`CONTRACT_NO_LIFECYCLE`, `CONTRACT_NO_SCENARIO`). Padel was the third game
moved onto the lifecycle and the shared page; what its own page did that
the shared page does not is listed under "SDK and checks still owed".
A game that isn't in the catalog gets a boot-only check: it must load, say
`ready` and throw no page errors for five seconds. Garden's published build
still greets with `garden:hello`; it keeps working and the check warns.

## Make a game

Read [games/good-game.md](games/good-game.md) first: the rules a game is
held to, the brief to fill in before building, and the definition of done.
`pnpm games:new <id>` does steps 1 to 3 below from Lantern Tag
(`games/lantern-tag`, the small worked example of the current contract and
the same starter `oncyber new` uses), adds the brief, a bot stub and a
scenario stub, and declares the game's saved keys to the page;
`pnpm games:score` reports which checks each game passes.

1. Copy `games/lantern-tag` as a template, or start a Vite project in
   `games/<id>/` that builds into `frontend/public/game-builds/<id>/` and aliases
   `@oncyber/game-runtime` to `games/runtime/src` (see Lantern Tag's
   `vite.config.js`). Its `npm run build` must end by writing the build's
   record, as every game's does (`scripts/games/build-record.mjs`). Do not
   start from Bloom Garden: it predates the contract.
2. Write `game.json` (`format`, `arrival`, `party`, `devices`, `avatars`,
   `saved`, `runtime.capabilities`, `assets`, `input`, and `credits`: no
   file ships without a declared source and licence, see
   [games/credits.md](games/credits.md)), a `scenario.json`
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
pnpm games:build garden      # build only, to try a change (it clears the last check)
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

Every shipped file must also be credited under an allowed licence
([games/credits.md](games/credits.md)).

A release is the set of files whose hashes make up its `release` id. Commit
`frontend/public/game-builds/<id>` to ship it, with `games/<id>/build.json`.

A committed build can fall behind what it was built from: the runtime
changes, the build does not, and the site serves the old one. Every build
therefore ends by writing `games/<id>/build.json`: the hash of each file it
was made from (the game's folder, `games/runtime/src` and each kit the game
names) and of each file it wrote. `pnpm games:test` fails when an input
changed since, or when the committed files are not that build
(`scripts/games/test/builds.test.mjs`); CI runs it on every pull request.
The fix is always `pnpm games:publish <id>` again. `node
scripts/games/build-record.mjs --check` says the same thing on its own.

Publishing also stores the release outside the repository. The page keeps
loading the committed build until a person points the game at a stored
release (`pnpm games:release point <id>`); from then on the page loads from
the pointer, and a publish moves it. Rollback, drafts, backends, what a
release host must send and the `hosted` check stage:
[games/releases.md](games/releases.md).

It needs Playwright and Chromium. `PW_CHANNEL=chrome` uses the installed
Chrome and its GPU; `--headed` shows the window. Headless frame times follow
the headless browser's frame rate, not the game's. Without a GPU a WebGL
game renders slowly; `GAMES_CHECK_TIMEOUT_S=600` waits longer for the report.

Playwright is not a dependency of this repository: the check uses the one
installed on the machine (`npm i -g playwright`, `NODE_PATH` set to
`npm root -g`, `npx playwright install chromium`). `pnpm games:test` runs
twelve of its tests in that browser too (the network policy, keys and
pointer lock, sound, a hosted release). Without Playwright they are
reported as skipped, with the reason, on a person's machine; in CI the run
fails instead, and the workflow installs it
(`.github/workflows/games.yml`, `scripts/games/test/browser.mjs`).

## SDK and checks still owed

What the first version of this list asked for is delivered: `enter()`
carries the lobby's view and the trip, the locomotion kit has the arrival
helper, the avatar kit the arrival pose, the page waits for a first-frame
signal, `game.json` declares `arrival` and `party`, and the check has the
arrival, handoff and party stages ([games/good-game.md](games/good-game.md)).
Still owed:

-   **Padel** plays NPC doubles only (no match between people), does not
    claim the phone, and keeps its own bodies on court: the avatar kit
    cannot play a game's own motion capture on its rig.
-   **What Padel's own page did that the shared page does not**: the
    lobby's emote
    panel and its 1 to 9 shortcuts (a game gets the kit's four emotes on
    keys it declares itself); a way for the page to ask the game to open
    something (its Play and Settings buttons) and for the game to tell the
    page it is in a match so the page gets out of the way; the lobby's
    world reveal and dissolve around an arriving or leaving avatar; a
    Reconnect button when the room drops; and click-to-walk, which needs a
    pointer position no declared action can carry.
-   **Bloom Garden** still speaks `garden:<kind>` (it should move to
    `connectPage()` and read the visit from `enter()`), has no matched
    departure, does not claim the phone, and draws its avatars, arrival
    pose and menus with its own code instead of the kits. It is the one
    build the page still answers in the old form; nothing new starts from
    it (`pnpm games:new` copies Lantern Tag).
-   **The page's own interface** (the bar of controls, chat, credits, the
    results card, the gates) takes its colours, fonts and durations from
    the design tokens, and everything a visitor can press, type in or
    follow is a shared primitive (`features/games/interface/gameControls.tsx`: the
    lobby's glass and control material over the game, the app's
    `ActionButton` in cards, dialogs and notices), with hover, pressed,
    disabled and focus states. Nobody has yet looked at it over a running
    game on a phone, where the bar of controls is now the lobby's height.
-   **Ace** shows the draw for doubles and tournaments; playing them
    through is not built.
-   The process stage's bot plays alone. A bot for a match between two
    members is the party stage's own (`party.play`), not `bot.json`.

## Field health and the kill switch

Every game calls `reportHealth()` first thing, so uncaught errors, failed
lifecycle stages and frame times from real visits reach `/dev/games`; and
`GAMES_DISABLED` pauses a game or one release. Rules, what is collected and
why: [games/field-health.md](games/field-health.md).

## Not built yet

-   Live editing (the swap in `plans/live-swap-prototype/`) inside this host.
-   Hosted releases in production: built and checked with the local
    backend, and no game is switched to one; the decisions left are in
    [games/releases.md](games/releases.md).
-   A headset profile for the check (phone and gamepad: [games/devices.md](games/devices.md)).
-   Games in the lobby's Explore panel outside the development server.
-   A slug for one of the catalogued games: the route is built ("A game
    at `/<slug>`" above) and no game has been given a name. Lobby cards and
    party links use `/games/<id>` whether or not a game has one.
