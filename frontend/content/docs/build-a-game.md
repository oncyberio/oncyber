---
title: Build a game
description: Start here to make a game for Oncyber - what a game must do, what is optional (lobby arrival, avatars, animations, walking, parties, voice, results, saved data, menus) and the SDK helper for each.
order: 5.5
---

# Building a game for Oncyber

> For a coding agent asked to make a game. A game is free web code (any
> renderer, plain three.js in the examples) that runs in a sandboxed frame
> inside Oncyber. This page says what a game must do, what is optional, and
> which helper does each thing, so the game fits Oncyber: visitors arrive
> from the lobby as themselves, with their friends, still talking.

Paths are from the repository root. Read this page, then
`docs/games/good-game.md` (the rules and the checks). Open the page for an
area only when you use that area.

## How a game fits

-   **The game** draws its world and runs its rules. It lives in
    `games/<id>/` and builds to static files.
-   **The page** around it is Oncyber's. It owns the visitor's identity and
    avatar, their party, chat, voice, sound volume, the menu, saved data and
    the way back to the lobby. A game never rebuilds any of these; it asks
    the page through the SDK.
-   **The frame** is sandboxed (`allow-scripts allow-pointer-lock`, opaque
    origin): no cookies, no storage, no forms, no popups, no microphone, and
    only the network hosts the game declares in `game.json` → `network`.
-   **The SDK** is `games/runtime/src/` (imported as
    `@oncyber/game-runtime/<module>`) plus three optional kits in
    `games/kits/`: `avatar`, `locomotion`, `ui`.

## Start

There are two places to build a game, with the same SDK, kits and checks.

### Outside the repository: the `oncyber` command

For a game on your own machine, published to Oncyber by its link
(`docs/games/publishing.md`). The command is the package in `games/cli/`.
It is not on npm; `games/cli/README.md` says how to install it from a
tarball.

```sh
oncyber new <id> --name "Game Name"   # a working starter game in ./<id>
cd <id> && npm install
oncyber docs                          # this page; `oncyber docs party` prints docs/games/party.md
oncyber dev                           # the game alone, on its own port
oncyber check                         # done is this exiting 0
oncyber login                         # once: opens the browser, saves a token
oncyber publish                       # build, check, upload; prints the game's link
```

Know before you start:

-   The starter is a small, complete contract game (Lantern Tag, renamed)
    that passes `oncyber check` as created. Rewrite its `BRIEF.md` for your
    game first, then change the world, the rules and the party's match where
    the source says `STARTER:`.
-   The game is the current folder. Where this page says `games/<id>/`, read
    your game's folder; the build is `dist/`, the check's report is
    `.oncyber/check.json` and its screenshots are in `.check/`.
-   Where this page says `pnpm games:check <id>`, run `oncyber check`; for
    `pnpm games:publish <id>`, `oncyber publish`.
-   The game's `vite.config.js` is `oncyberGame()` from `oncyber/vite`, which
    maps the SDK and the kits.
-   A published game is unlisted: it runs at its link with the visitor's
    avatar, party, chat and voice, and is not shown in the lobby.

### In the repository

```sh
pnpm games:new <id> --name "Game Name"   # creates games/<id>/ and lists it
# fill in games/<id>/BRIEF.md             # the check fails while a section says TODO
npm --prefix games/<id> install
npm --prefix games/<id> run dev          # the game alone, on its own port
pnpm games:build <id>                    # build only, to try it in the site's page
pnpm games:check <id>                    # done is this exiting 0
pnpm games:publish <id>                  # build, check, write frontend/public/game-builds/<id>/
```

Know before you start:

-   Alias the SDK and the kits in the game's `vite.config.js`, as
    `games/lantern-tag/vite.config.js` does.
-   `games:new` copies Lantern Tag (`games/lantern-tag/`), renamed: the
    same small contract game `oncyber new` starts from (host, game, party
    match, sound, every kit). Rewrite its `BRIEF.md` first, then change the
    world, the rules and the party's match (`src/world.js`, `src/round.js`,
    `src/match.js`). `games/ace/` is the full worked example. Bloom Garden
    (`games/garden/`) predates the contract and still speaks a prefix of its
    own: do not copy from it.
-   A build (`pnpm games:build <id>`, or `npm run build` in the game)
    clears its `check.json` and `release.json`; finish with
    `pnpm games:publish <id>`.
-   The site's page for a game is `/games/<id>`. The build is served from
    `/game-builds/<id>/`, never from under `/games/`: a build's folder there
    would be served in the page's place. Use relative URLs in the game
    (`base: "./"`), so the build runs from any address.
-   A build is committed, so it can fall behind its source. Every build
    writes `games/<id>/build.json` (what it was built from), and
    `pnpm games:test` fails when the runtime, a kit the game uses or the
    game's own files changed after it (`scripts/games/build-record.mjs`).
    After changing any of them, run `pnpm games:publish <id>` again.
-   Commit `games/<id>/` (with its `build.json`) and
    `frontend/public/game-builds/<id>/`. Format with Prettier (four spaces, 80
    columns).

In both places the checks run a real browser. On a machine with no GPU set
`GAMES_CHECK_TIMEOUT_S=600`.

## Required of every game

| What                 | How                                                                                                                                                                                                                     | Page                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| The lifecycle        | The game module's default export returns `prepare`, `enter`, `update`, `suspend`, `restore`, `dispose`, `inspect`. The host owns the clock: no `requestAnimationFrame` or timers for gameplay; count `update(seconds)`. | `docs/games/contract.md`            |
| One message contract | Talk to the page only through `connectPage()` (`@oncyber/game-runtime/page`). Every message is `oncyber:game:<kind>`.                                                                                                   | `docs/games/contract.md`            |
| Declared input       | Every action is in `game.json` → `runtime.input` with its keyboard, touch and gamepad binding. Read `context.input`, `context.pressed`, `context.deltas`. No raw key, touch or gamepad listeners.                       | `docs/games/keys-focus.md`          |
| The page's keys      | Escape, Enter and NumpadEnter belong to the page; M is yours (the page takes it only with Cmd or Ctrl). Typing in chat must not move the player.                                                                        | `docs/games/keys-focus.md`          |
| Devices              | `game.json` → `devices` lists what works: `desktop`, `phone`, `gamepad`. The site offers the game only on those. Claim a device only when it passes.                                                                    | `docs/games/devices.md`             |
| Loading and pausing  | Report progress, signal the first frame before `ready`, redraw on resize. One pause path: a solo game suspends, a match between people never does.                                                                      | `docs/games/loading-and-pausing.md` |
| Sound                | All sound goes through the SDK's one output (`connectGameAudio`). The page owns volume, mute and the first gesture. No private mute.                                                                                    | `docs/games/sound.md`               |
| Screen space         | Keep the HUD inside the page's safe areas (`--oncyber-safe-*`).                                                                                                                                                         | `docs/games/safe-area.md`           |
| Chat and voice       | Never build your own. No `getUserMedia`, no `RTCPeerConnection`, no chat box.                                                                                                                                           | `docs/games/voice-chat.md`          |
| A party statement    | `game.json` → `party` says what a party of 1 to 8 is offered and what late, dropped and extra players get. A solo option at every size. A solo-only game states that; it still needs the statement.                     | `docs/games/party.md`               |
| A bot                | `scenario.json` and `bot.json` play the game with nobody at the keyboard, reading `inspect()`.                                                                                                                          | `docs/games/good-game.md` rule 5    |
| Credits              | Every bundled file that is not yours has an author and a licence; original and procedural assets need nothing.                                                                                                          | `docs/games/credits.md`             |

Every message kind, who sends it and the file on each side that handles it
is one list: `games/runtime/messages.json`. A game never posts a kind that
is not in it; the SDK's helpers send them for you.

### The host, in order

The host is the small file that connects the lifecycle to the page. The
order matters and the checks depend on it:

1. `createPartyLink()` first, if the game uses parties, then
   `const page = connectPage()`.
2. `page.hello()`, `await page.identity()`.
3. `session.prepare()`, draw one frame, then `page.ready()`.
4. `session.enter({ ...poses, ...(await page.enterData()) })`.
5. Draw two frames of the arrival, then `page.arrivalReady()`. Hold the
   visitor still until the page says `revealed`.
6. Pass later changes on: `page.on("party", (trip) => session.party(trip))`.

A visit opened with `?check=<stage>` is the check driving the game. Play
`scenario.json` (`runCheck`) on the plain check visit only; skip it for the
`avatars`, `party`, `results`, `locomotion`, `saved` and `process` visits.
See `games/lantern-tag/src/host.js`.

## Optional: fitting in with Oncyber

Each of these is opt-in or has a stated way to opt out. Use the ones the
game's idea calls for.

### Arrive from the lobby and leave back to it

A visitor from the lobby should land standing in the game's world, able to
walk, with "start" as a choice. `enter(continuity)` carries how they came:
`continuity.arrival` is `{ from: "lobby", view }` or
`{ from: "direct", view: null }`. `view` is the lobby's last camera relative
to the avatar's feet; open on the same picture.

-   Declare `"arrival": { "walkable": true }`.
-   Never hard-code the camera. The locomotion kit's
    `arrival(view, { at, facing, avatarHeight })` returns it in your space.
-   A title screen is for direct visits only.
-   Leaving is the mirror: declare `"departure": "matched"` and send every
    exit through `createDeparture(...).leave()`
    (`@oncyber/game-runtime/departure`). The last frame is the avatar alone
    on black. `games/ace/src/departure.js` shows the fade.

Pages: `docs/games/good-game.md` rules 1 and 2, `docs/games/departure.md`.
A game with no body to stand (a board seen from above) opts out with
`"avatars": { "arrival": "none", "arrivalWhy": "<one sentence>" }`.

### Avatars

Draw the visitor and other players as the avatars they arrived with.

```js
import { createAvatarKit } from "@oncyber/avatar-kit";

const kit = createAvatarKit({ services, motion, height: 1.75 });
scene.add(kit.self.root, kit.group); // the visitor, and everyone else
await kit.loadSelf();
page.on("peers", (players) => kit.setPeers(players));
kit.arrival.stage(continuity.arrival.view); // crouched, hands empty
page.on("revealed", () => kit.arrival.enter()); // stand up
kit.update(seconds, camera); // every frame
```

-   Avatars load only through `services.avatar()`, so only ones the page
    vouches for. Declare the avatar host in `network`
    (`cyber.mypinata.cloud`).
-   A visitor with no avatar still appears. The kit's stand-in body is too
    dark for the departure check; draw your own simple figure for that case.
-   Name tags and talking indicators over other players come with the kit.
-   To opt out: `"avatars": { "others": "other", "why": "<one sentence>" }`.

Changing avatar: never draw your own picker and never save an avatar. Ask
the page for its picker and wear what the visitor chose.

```js
import { connectAvatar } from "@oncyber/game-runtime/avatar";

const avatars = connectAvatar();
button.hidden = !avatars.available; // no page, no picker
button.onclick = () => avatars.ask(); // the page shows its picker
avatars.on((avatar) => kit.wear(avatar.url)); // swapped in place
```

-   Let `services.avatar()` serve `avatar.url` before you wear it (the host
    vouches for it, as for the visitor's first avatar).
-   Say so in `game.json`: `"avatars": { "change": true }`. The check then
    hands the game another avatar and fails if it is not worn
    (`AVATAR_CHANGE`).
-   Worked example: the Avatar button in `games/lantern-tag/src/host.js`.

Page: `docs/games/avatar-kit.md`.

### Animations

-   The kit plays the lobby's idle, walk, run, jump and wave, and lobby
    emotes with `kit.emote("<name>")`, from clip files under
    `games/kits/avatar/motion/`.
-   **Those clip files have no recorded licence yet.** Bundling them needs
    an exception in `games/licenses.json`, which is a person's decision, not
    yours. Until one is granted for your game, generate the clips in code
    (`games/lantern-tag/src/motion.js`) or ask.
-   The kit cannot play a game's own clip files on its rig. For a game
    motion (a swing, a throw) pose the bones yourself with
    `kit.self.manual = true`, as Ace does.
-   Clips must write every bone every frame, or the arrival crouch leaves
    the avatar sunk in the floor.

### Walking like the lobby

If the visitor walks, use the locomotion kit so it feels like the lobby
(W A S D, Shift to run, Space to jump, drag to look). Declare
`"locomotion": "lobby"`.

```js
import { arrival, bindControls, createWalker } from "@oncyber/kit-locomotion";

const arrived = arrival(view, { at: spawn, facing: 0, avatarHeight: 1.75 });
const walker = createWalker(
    { ...spawn, rotation: arrived.avatarRotation },
    { scale: arrived.scale, constrain: keepInsideWalls }
);
const pose = walker.advance(seconds, controls.read(seconds)); // each frame
```

-   Don't write a walk controller or copy the speeds.
-   Stop the walker when input is paused (`walker.place({})`), or typing in
    chat slides the visitor.
-   A game about another way of moving (skating, driving, a fixed court)
    leaves `locomotion` out.

Page: `docs/games/locomotion.md`.

### Multiplayer and parties

People travel in groups of one to eight. The page puts a party in a room of
its own and tells the game who is there in one message, the trip:
`continuity.trip` in `enter()`, then `party(trip)` when it changes.

```js
import { createPartyLink } from "@oncyber/game-runtime/partyLink";

const link = createPartyLink();
link.on("arrived", ({ member, late }) => {});
link.on("dropped", ({ member }) => {}); // their seat is held 20 seconds
link.on("host", ({ self }) => {}); // one member simulates; it can change
```

-   `link.roster` lists members with a stable `id`; key scores and seats by
    it. Members play each other over the match channel through the link.
-   Don't open your own sockets or WebRTC. The slower `net` relay (about
    five packets a second) is for turn state only.
-   Decide and write down what a late, dropped and extra player gets.
-   A game that is one shared place for everyone declares `"shared"` with a
    sentence saying why.
-   There is no helper yet for handing a running match to a new host or for
    late joins; `games/lantern-tag/src/match.js` is a worked example.

Page: `docs/games/party.md`.

### Voice and chat

They already work: the visitor's lobby chat and microphone carry on in the
game with no code. Optionally place voices in space and show who is talking:

```js
import { connectVoice } from "@oncyber/game-runtime/voice";
import { GAME_MESSAGE_PREFIX } from "@oncyber/game-runtime/contract";

const voice = connectVoice(GAME_MESSAGE_PREFIX.slice(0, -1));
voice.setPoses(listener, players); // where voices come from
voice.onTalking((ids, self) => {}); // who is talking
```

Page: `docs/games/voice-chat.md`.

### Results and the leaderboard

A game with matches (`"format": "match"`) reports exactly one result per
finished match and none for a match left early.

```js
import { createResults } from "@oncyber/game-runtime/results";

const results = createResults((result) => page.post("result", { result }));
results.begin(); // a match starts
results.report({ format: "solo", teams, winner: 0 }); // once, when it ends
results.abandon(); // left unfinished
```

A result needs at least two sides. A solo score game reports the visitor
against a named CPU side. Only results a whole party agrees on count for the
leaderboard. Page: `docs/games/results.md`.

### Saved data

The frame has no storage. Declare each key in `game.json` → `saved` with a
scope, a `stateVersion` and a size limit, then use `connectSavedData`
(`@oncyber/game-runtime/saved`). Never save sound settings or results.
Page: `docs/games/saved-data.md`.

### Menus that look like Oncyber

The world keeps its own look; menus, settings and result screens use the UI
kit, which carries Oncyber's design tokens into the frame.

```js
import "@oncyber/game-ui/fonts.css";
import "@oncyber/game-ui/oncyber-ui.css";
```

Use the `oui-` classes and `--oui-*` variables; never copy a colour, radius
or duration out of the kit. One white button per screen for the main action.
Drive menus from declared actions, not the kit's own key listeners.
Page: `docs/games/ui-kit.md`.

## Make it good, not only correct

The checks prove a game works. They do not look at it. Before calling a game
done:

-   Give the world a look of its own: lighting, colour, something to see on
    arrival. Flat primitives on a plain floor pass every check and impress
    nobody.
-   Give a round a reason to be played twice: rising pace, a risk, a score
    worth beating.
-   Look at the check's screenshots in `games/<id>/.check/` and fix what
    looks wrong. A stage can pass with the avatar drawn wrongly.
-   Say in your report what no person has looked at or played.

## Done

In the repository: `pnpm games:check <id>` exits 0, `pnpm games:publish <id>`
has written the build, and both folders are committed. `pnpm games:score <id>`
prints each stage. Outside it: `oncyber check` exits 0 and `oncyber publish`
has printed the game's link. Where every rule and finding code is explained:
`docs/games/good-game.md`.
