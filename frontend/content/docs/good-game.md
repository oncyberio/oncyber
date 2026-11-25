---
title: What a good game does
description: Rules for coding agents building a game for Oncyber - arrival, the lobby handoff, parties, the solo path, the bot, and the checks that define done.
order: 6
---

# What a good game does

Rules for a coding agent building a game for Oncyber. New to the SDK? Start
with `games/llms.txt`, which says what is required,
what is optional and which helper does each thing. Read this before the
first line of code, fill in the brief, and treat the checks at the end as the
definition of done. How games run: `docs/games.md`.

Every rule here exists because a person once had to correct a finished game.
Each one has a line in this file, a helper in `games/runtime/src/` or a kit
in `games/kits/`, and a check in `pnpm games:check`.

## Before you build

1. `pnpm games:new <id>` creates `games/<id>/` from Bloom Garden with a
   brief, a manifest, a bot stub and a scenario stub, declares its saved
   keys to the page and adds the game to the catalog. The copy passes the
   contract, keys and manifest checks as it is.
2. Fill in `games/<id>/BRIEF.md` (template (`games/BRIEF.md`)):
   players, formats, arrival, devices, kits, sound and pausing, leaving and
   results, saved data, what the bot can inspect, how the bot plays. The
   check fails while a section is empty.
3. Build, then run `pnpm games:check <id>` until it passes.

A game is a lifecycle (`docs/games/contract.md`): `prepare`, `enter`,
`update`, `suspend`, `restore`, `dispose`, `inspect`, behind a host that
talks to the page through `connectPage()`. Every message is
`oncyber:game:<kind>`. Bloom Garden's build is from before the contract and
still says `garden:<kind>`; the page and the checks answer it in that form
and the check warns (`CONTRACT_LEGACY_PREFIX`). A new game speaks the
contract.

## The rules, in order

### 1. Arrive like a world

-   A game opened from the lobby starts in a walkable third-person arrival:
    the visitor stands in the game's world, can walk and look around, and
    sees "start the game" as a choice. Nothing starts on its own.
-   Title screens are for direct visits only (someone who opened
    `/games/<id>` in a new tab). A visitor from the lobby never sees one.
-   Leaving a match, or its result, returns to the arrival, not to a title
    screen and not to the lobby.
-   A game with no matches (a world you only walk) sets `"format": "world"`
    in `game.json`; a game with matches sets `"format": "match"`. The first
    rule applies to both.

How the visitor came is in `enter()`'s data: `continuity.arrival` is
`{ from: "lobby", view }` or `{ from: "direct", view: null }`
(`docs/games/contract.md`). `game.json` says
`"arrival": { "walkable": true }`. Walk, run and jump are the locomotion
kit's (`docs/games/locomotion.md`). Check: `arrival` (`ARRIVAL_TITLE`,
`ARRIVAL_AUTOSTART`, `ARRIVAL_STUCK`, `ARRIVAL_NOT_WALKABLE`,
`ARRIVAL_NO_START`, `LEAVE_NOT_ARRIVAL`).

### 2. Match the handoff

The lobby's last frame and the game's first frame are the same picture.

-   The lobby camera sits in front of the avatar, which faces it: about 5 m
    away (4.6 m plus 0.44 m per traveller, so 5.04 m alone and 6.36 m for a
    party of four, counting at most seven), 2 m above the feet, looking at a
    point 1.05 m up.
-   The field of view is 58 degrees (72 when the page is narrower than
    600 px).
-   The avatar ends the trip crouched with empty hands, then stands up when
    the page sends `entered`. Keep the visitor still until they stand. Give
    them the racket, sword or tool when the match starts, not before.
-   Don't hard-code these. `continuity.arrival.view` carries the actual view
    (`cameraOffset`, `cameraTargetOffset`, `avatarRotation`, `avatarHeight`,
    `fov`), relative to the avatar's feet. The locomotion kit's
    `arrival(view, { at, facing, avatarHeight })` turns it to your world's
    heading, scales it to your avatar and hands back the camera
    (`docs/games/locomotion.md`); the avatar kit holds the crouch and
    the empty hands until `entered` (`docs/games/avatar-kit.md`). Draw
    two frames, then post `arrival-ready` (`page.arrivalReady()`). The page
    waits 1.5 s at most.
-   Leaving is the same picture in reverse: the game stages the visitor in
    the arrival framing and the lobby's first frame matches it
    (`docs/games/departure.md`).

The numbers come from the travel camera in
`frontend/features/lobby/createLobbyScene.tsx` (distance, height, lens) and
`frontend/features/lobby/travelAnimationSequence.ts` (the crouch). For the
check: `games/runtime/src/arrival.ts` (`LOBBY_HANDOFF`, `describeArrival`,
which measures what the game is drawing; `mapArrivalView` is the bare
rotation and scale for a game that uses no kit, as Bloom Garden does).
Check: `handoff` (`HANDOFF_DISTANCE`, `HANDOFF_HEIGHT`, `HANDOFF_FOV`,
`HANDOFF_FACING`, `HANDOFF_CROUCH`, `HANDOFF_HANDS`, `HANDOFF_FACTS`),
within 15% on distance, 0.2 avatar heights on height and 2 degrees on the
lens. The avatar stage checks the same pose with a party of two
(`AVATAR_ARRIVAL`, `AVATAR_ENTERED`).

### 3. Respect the party

People travel in groups of one to eight. Say what you offer each size, and
what late, dropped and extra players get, in `game.json`
(`docs/games/party.md`):

```json
"party": {
    "sizes": [1, 8],
    "formats": [
        { "id": "singles", "label": "1 v 1", "sizes": [2] },
        { "id": "tournament", "label": "Tournament", "sizes": [3, 4, 5, 6, 7, 8] },
        { "id": "solo", "label": "Solo vs CPU", "sizes": [1, 2, 3, 4, 5, 6, 7, 8] }
    ],
    "solo": "solo",
    "play": "singles",
    "late": "A member who arrives mid-match is offered Watch and Solo vs CPU.",
    "dropped": "The CPU takes their side; the match goes on with the score kept.",
    "extra": "A match seats two. Anyone else can watch or play solo."
}
```

Nobody in a party is left with nothing to do: an odd player gets a turn, a
seat to watch from, or the solo path. The page puts a party in a room of
its own and tells the game in one message, the trip: in `enter()`
(`continuity.trip`) and again through `party(trip)` when it changes. The
room's roster (who is there, the host, who dropped) rides in the trip, and
members play each other over the match channel (`createPartyLink()`).
Checks: `offer` (`PARTY_UNDECLARED`: a size with no format, or a statement
not written) before the game runs, then the party stage on the running game
(`PARTY_STATEMENT`, `PARTY_OPTIONS`, `PARTY_OPTIONS_SAME`,
`PARTY_MATCH_LIMIT`, `PARTY_CHECK`).

### 4. Keep a solo path

One visitor alone always has something to play, whatever the party size and
whether or not anyone else shows up. `"party"."solo"` names the format that
needs nobody else; it is offered at every size from 1 to 8. Checks: `solo`
(`SOLO_PATH`), and `PARTY_NO_SOLO` on the running game.

### 5. Ship a bot

Every game ships two scenarios that play it with nobody at the keyboard.

`games/<id>/scenario.json` is the lifecycle scenario
(`docs/games/contract.md`): the visit to stage (`enter`), then actions,
waits and assertions on `inspect()` keys, played frame by frame by the
contract check.

`games/<id>/bot.json` is the bot: it plays the game through the keys the
game declared in `game.json`, the way a visitor's keyboard would. It walks
the arrival, chooses to start, plays one match to its result and leaves.

```json
{
    "version": 1,
    "query": "games=1",
    "arrival": [
        { "hold": "forward", "ms": 700 },
        { "press": "confirm" },
        { "until": { "screen": "match" } }
    ],
    "play": [
        {
            "repeat": [{ "press": "shot" }, { "wait": 300 }],
            "until": { "screen": "results" },
            "timeoutMs": 300000
        }
    ],
    "leave": [{ "press": "confirm" }]
}
```

Steps: `press` and `hold` (a declared action with a keyboard binding; add
`"key": "KeyJ"` to press another of its bindings than the first), `wait`
(ms), `expect` and `until` (keys of the facts below), `repeat ... until`. A
bot never presses Escape: it is the page's
(`docs/games/keys-focus.md`).

The bot reads the game through `exposeInspect(facts)`, which the game's
host calls once with a function that returns `inspect()` with three
standard facts in it. A game whose `inspect()` already uses one of these
names for something else maps it there (Ace: `games/ace/src/facts.js`).

| Key        | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| `screen`   | `"title"`, `"arrival"`, `"menu"`, `"match"` or `"results"`         |
| `position` | the visitor's avatar on the ground, `[x, z]` in metres             |
| `arrival`  | while arriving: `describeArrival(...)` from what is actually drawn |

The bot's visit opens the game with `?check=process`, from the lobby,
alone: the host must not play `scenario.json` on that visit (skip
`runCheck`, as for `check=avatars`), and may draw small unless `&video` is
there too. Helper: `games/runtime/src/bot.ts`. Check: `bot` (`BOT_MISSING`,
`BOT_INVALID`, `BOT_UNDECLARED_INPUT`, `BOT_IDLE`, `BOT_BOOT`, `BOT_FACTS`,
`BOT_STEP`, `BOT_NO_RESULT`).

`pnpm games:check <id> --video` (or `GAMES_CHECK_VIDEO=1`) also records the
bot's run to `games/<id>/.check/bot.webm` for a person to watch (`video`,
`VIDEO_MISSING`); `check.json` lists where the arrival, the match and the
result start in it. Recording is off by default: the game then draws at
full size, which on a machine with no GPU makes the bot's match several
times longer.

### The rest, one line each

| Area                | Rule                                                                                                                                        | More                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Contract            | One lifecycle behind `connectPage()`; every message is `oncyber:game:<kind>`; the visit (arrival and trip) comes in `enter()`.              | `docs/games/contract.md`            |
| Chat and voice      | The page owns chat and voice; a game never builds its own, and reads who is talking from the SDK.                                           | `docs/games/voice-chat.md`          |
| Keys                | Declare every action in `game.json` with its keyboard binding; no raw key listeners; Escape is the page's, every other key the game's.      | `docs/games/keys-focus.md`          |
| Screen space        | Keep the HUD inside the page's safe areas (`--oncyber-safe-*`), on every screen size.                                                       | `docs/games/safe-area.md`           |
| Avatars             | Draw each visitor as the avatar they arrived with, through the avatar kit, at its real proportions.                                         | `docs/games/avatar-kit.md`          |
| Movement            | Walk, run and jump with the locomotion kit, so travelling doesn't change how a body feels.                                                  | `docs/games/locomotion.md`          |
| Menus               | Build menus from the UI kit: keyboard, pointer and gamepad all work, and focus is visible.                                                  | `docs/games/ui-kit.md`              |
| Devices             | Claim `desktop`, `phone`, `gamepad` and give each action its keyboard, touch and gamepad binding; never read touch or gamepad events.       | `docs/games/devices.md`             |
| Loading and pausing | Report progress, signal the first frame before `ready`, redraw on resize; one pause path: solo suspends, a match between people never does. | `docs/games/loading-and-pausing.md` |
| Sound               | Route all sound through the SDK's one output; the page owns volume, mute and the first gesture. Never keep a private mute.                  | `docs/games/sound.md`               |
| Leaving             | Every way out goes through the departure: back to the arrival state, then the lobby's first frame matches the game's last.                  | `docs/games/departure.md`           |
| Parties             | Read who is there from the trip's roster; play each other over the match channel; say what late, dropped and extra players get.             | `docs/games/party.md`               |
| Results             | Every finished match reports exactly one result; a match left early reports none.                                                           | `docs/games/results.md`             |
| Saved data          | Declare every saved key in `game.json` with a scope and a version; never save sound settings or results.                                    | `docs/games/saved-data.md`          |

## Done

A game is done when `pnpm games:check <id>` exits 0. Nothing less counts and
nothing more is required: if a person finds something the check let through,
the fix is a new check (see "Corrections" in `AGENTS.md`),
not a longer list here.

The stages, in the order they run. `pnpm games:score <id>` prints them as
passed, failed or skipped from the last report (`check.json`). A stage a
game has not asked for (no `departure`, `locomotion` or `saved` in
`game.json`) is left out.

| Stage              | Passes when                                                                                                | Fails with                                                                                                                     | More                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| contract           | a listed game has the lifecycle and a scenario, and `enter()` got the visit staged                         | `CONTRACT_NO_LIFECYCLE`, `CONTRACT_NO_SCENARIO`, `CONTRACT_VERSION`, `CONTRACT_ENTER_*`, `SCENARIO_*`                          | `docs/games/contract.md`            |
| bundle             | the build is under 30 MiB with every declared file present                                                 | `BUNDLE_LARGE`, `ASSET_MISSING`, `ENTRY_MISSING`                                                                               | `docs/games.md`                     |
| boot               | the game loads, says `ready` and is entered                                                                | `STAGE_BOOT`, `GAME_FAILED`, `CHECK_TIMEOUT`, `PAGE_ERROR`                                                                     | `docs/games.md`                     |
| scenario           | `scenario.json` plays through                                                                              | `STAGE_SCENARIO`                                                                                                               | `docs/games/contract.md`            |
| lifecycle          | the game suspends and restores to the same state                                                           | `STAGE_LIFECYCLE`                                                                                                              | `docs/games/contract.md`            |
| frames             | 180 frames are measured                                                                                    | `STAGE_FRAMES`                                                                                                                 | `docs/games.md`                     |
| sound              | sound is routed through the SDK's output and follows the page's mute and ducking                           | `STAGE_SOUND` (`SOUND_NOT_ROUTED`, `SOUND_LOCKED`, `SOUND_MUTE`, `SOUND_UNMUTE`, `SOUND_DUCK`, `SOUND_DUCK_RELEASE`)           | `docs/games/sound.md`               |
| loading            | progress, then a first frame in time, a redraw on resize, and state held across a pause                    | `PROGRESS_*`, `FIRST_FRAME_*`, `READY_BEFORE_FIRST_FRAME`, `RESIZE_*`, `PAUSE_*`, `PAUSING_MISSING`, `RESUME_STUCK`, `MATCH_*` | `docs/games/loading-and-pausing.md` |
| departure          | (`"departure": "matched"`) the last game frame matches the lobby's first                                   | `STAGE_DEPARTURE` (`DEPARTURE_*`)                                                                                              | `docs/games/departure.md`           |
| results            | every finished match posted exactly one valid result                                                       | `RESULTS` (`RESULT_*`)                                                                                                         | `docs/games/results.md`             |
| social             | two visitors from a lobby keep their chat and voice in the game                                            | `STAGE_SOCIAL`, `SOCIAL_OWN_VOICE`                                                                                             | `docs/games/voice-chat.md`          |
| keys               | no raw listeners, and the page's keys and typing never reach the game                                      | `RAW_KEY_LISTENER`, `RAW_KEYBOARD_LOCK`, `RAW_POINTER_LOCK`, `KEYS_*`                                                          | `docs/games/keys-focus.md`          |
| safe area          | the HUD sits under no page overlay at desktop and phone sizes                                              | `SAFE_AREA_BOOT`, `SAFE_AREA_EMPTY`, `SAFE_AREA_IGNORED`, `SAFE_AREA_OVERLAP`                                                  | `docs/games/safe-area.md`           |
| devices            | every claimed device plays the scenario through its own controls                                           | `PHONE_FAILED`, `NO_DEVICE_LAYER`, `NO_TOUCH_CONTROLS`, `NO_GAMEPAD_BINDINGS`, `CONTROL_*`, `TOUCH_*`, `PROFILE_CRASHED`       | `docs/games/devices.md`             |
| locomotion         | (`"locomotion": "lobby"`) forward held for two seconds covers the lobby's distance                         | `STAGE_LOCOMOTION`                                                                                                             | `docs/games/locomotion.md`          |
| avatars            | others are drawn as their avatars and the visitor arrives in the arrival pose                              | `AVATAR_RULE`, `AVATAR_BOOT`, `AVATAR_INSPECT`, `AVATAR_OTHERS`, `AVATAR_ARRIVAL`, `AVATAR_ENTERED`, `AVATAR_GPU_LOST`         | `docs/games/avatar-kit.md`          |
| party              | the game offers what its statement says at each size, and a dropped member doesn't stop a match            | `PARTY_STATEMENT`, `PARTY_OPTIONS`, `PARTY_OPTIONS_SAME`, `PARTY_NO_SOLO`, `PARTY_MATCH_LIMIT`, `PARTY_CHECK`                  | `docs/games/party.md`               |
| saved data         | (`saved` in `game.json`) each key saves, reloads and survives old, unreadable and future saves             | `SAVED_DECLARATION`, `SAVED_NOT_SYNCED`, `SAVED_BOOT`, `SAVED_ROUND_TRIP`, `SAVED_LIMIT`, `SAVED_COMPARE_AND_SET`, `SAVED_*`   | `docs/games/saved-data.md`          |
| process: `brief`   | `BRIEF.md` is filled in, and the game reports every fact its Inspect section lists                         | `BRIEF_MISSING`, `BRIEF_INCOMPLETE`, `BRIEF_INSPECT`                                                                           | this page                           |
| process: `offer`   | `game.json` offers every party size from 1 to 8 a format and says what late, dropped and extra players get | `PARTY_UNDECLARED`                                                                                                             | rule 3                              |
| process: `solo`    | the solo format is offered at every size                                                                   | `SOLO_PATH`                                                                                                                    | rule 4                              |
| process: `bot`     | `bot.json` uses only declared input and plays to a result                                                  | `BOT_*`                                                                                                                        | rule 5                              |
| process: `arrival` | a lobby visitor lands in a walkable arrival, starts by choice and returns there after                      | `ARRIVAL_*`, `LEAVE_NOT_ARRIVAL`                                                                                               | rule 1                              |
| process: `handoff` | the first frame matches the lobby's last: camera, lens, crouch, empty hands                                | `HANDOFF_*`                                                                                                                    | rule 2                              |
| process: `video`   | with `--video`: the bot's run was recorded for review (skipped otherwise)                                  | `VIDEO_MISSING`                                                                                                                | rule 5                              |

Menu screens that use none of the UI kit's classes are a warning
(`UI_KIT_UNUSED`), as is a build that still greets in its own prefix
(`CONTRACT_LEGACY_PREFIX`); warnings never block.

## The project's measure

`games/briefs.json` holds twelve one-line game briefs, fixed so results can
be compared over time. To measure the SDK, an agent builds each one from
nothing but this page (`pnpm games:new <id>`, the brief, the build), then
`pnpm games:score --briefs` reports which checks each built game passes. The
score is the share of checks passed across the twelve; a brief that was not
built scores zero.
