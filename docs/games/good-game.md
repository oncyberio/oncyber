# What a good game does

Rules for a coding agent building a game for Oncyber. Read this before the
first line of code, fill in the brief, and treat the checks at the end as the
definition of done. How games run: [../games.md](../games.md).

Every rule here exists because a person once had to correct a finished game.
Each one has a line in this file, a helper in `games/runtime/src/` and a
check in `pnpm games:check`.

## Before you build

1. `pnpm games:new <id>` creates `games/<id>/` from Bloom Garden with a
   brief, a manifest and a bot stub, and adds the game to the catalog.
2. Fill in `games/<id>/BRIEF.md` ([template](../../games/BRIEF.md)):
   players, formats, arrival, devices, what `inspect()` exposes, how the bot
   plays. The check fails while a section is empty.
3. Build, then run `pnpm games:check <id>` until it passes.

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
    in `game.json`; the first rule still applies.

The page tells the game it came from the lobby with the `arrival` message.
Check: `arrival` (`ARRIVAL_TITLE`, `ARRIVAL_AUTOSTART`, `ARRIVAL_STUCK`,
`ARRIVAL_NOT_WALKABLE`, `ARRIVAL_NO_START`, `LEAVE_NOT_ARRIVAL`).

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
-   Don't hard-code these. The `arrival` message carries the actual view
    (`cameraOffset`, `cameraTargetOffset`, `avatarRotation`, `avatarHeight`,
    `fov`), relative to the avatar's feet. Rotate it to your world's heading
    and scale it to your avatar with `mapArrivalView`, draw two frames, then
    post `arrival-ready`. The page waits 1.5 s at most.

The numbers come from the travel camera in
`frontend/features/lobby/createLobbyScene.tsx` (distance, height, lens) and
`frontend/features/lobby/travelAnimationSequence.ts` (the crouch). Helper:
`games/runtime/src/arrival.ts` (`LOBBY_HANDOFF`, `mapArrivalView`,
`describeArrival`). Check: `handoff` (`HANDOFF_DISTANCE`, `HANDOFF_HEIGHT`,
`HANDOFF_FOV`, `HANDOFF_FACING`, `HANDOFF_CROUCH`, `HANDOFF_HANDS`,
`HANDOFF_FACTS`), within 15% on distance, 0.2 avatar heights on height and
2 degrees on the lens.

### 3. Respect the party

People travel in groups of one to eight. Say what you offer each size, in
`game.json`:

```json
"party": {
    "1": "A match against the CPU.",
    "2": "1 v 1.",
    "3": "A round robin, one match at a time.",
    "4": "2 v 2, or a tournament.",
    "5-8": "A knockout bracket."
}
```

Nobody in a party is left with nothing to do: an odd player gets a turn, a
seat to watch from, or the solo path. The page sends the party (`party`
message) and puts it in a room of its own. Helper:
`games/runtime/src/brief.ts` (`partyFindings`). Check: `party`
(`PARTY_UNDECLARED`).

### 4. Keep a solo path

One visitor alone always has something to play, whatever the party size and
whether or not anyone else shows up. `"party"."1"` says what. Check: `solo`
(`SOLO_PATH`).

### 5. Ship a bot

Every game ships `games/<id>/bot.json`: a scenario that plays the game
through the input the game declared in `game.json`, the way a visitor's
keyboard would. It walks the arrival, chooses to start, plays one match to
its result and leaves.

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

Steps: `press` and `hold` (a declared action with a keyboard binding),
`wait` (ms), `expect` and `until` (keys of `inspect()`), `repeat ... until`.
The bot reads the game through `exposeInspect(inspect)`, which every game
calls once. Three facts are standard:

| Key        | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| `screen`   | `"title"`, `"arrival"`, `"menu"`, `"match"` or `"results"`         |
| `position` | the visitor's avatar on the ground, `[x, z]` in metres             |
| `arrival`  | while arriving: `describeArrival(...)` from what is actually drawn |

Helper: `games/runtime/src/bot.ts`. Check: `bot` (`BOT_MISSING`,
`BOT_INVALID`, `BOT_UNDECLARED_INPUT`, `BOT_IDLE`, `BOT_BOOT`, `BOT_FACTS`,
`BOT_STEP`, `BOT_NO_RESULT`). The check records the bot's run to
`games/<id>/.check/bot.webm` for a person to watch (`video`,
`VIDEO_MISSING`); `check.json` lists where the arrival, the match and the
result start in it.

### The rest, one line each

| Area           | Rule                                                                                   | More                               |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| Chat and voice | The page owns chat and voice; leave them reachable and never draw over them.           | [chat-voice.md](chat-voice.md)     |
| Keys           | Declare every action in `game.json` and don't take keys the page uses.                 | [keys.md](keys.md)                 |
| Screen space   | Keep your interface out of the areas the page's controls occupy, on every screen size. | [screen-space.md](screen-space.md) |
| Avatars        | Draw each visitor as the avatar they arrived with, at its real proportions.            | [avatars.md](avatars.md)           |
| Leaving        | Always show a way back to the lobby, and leave through the page (`exit`), not a link.  | [leaving.md](leaving.md)           |
| Results        | End every match on a result that names who won and offers what to do next.             | [results.md](results.md)           |
| Devices        | Play on keyboard, touch and gamepad; a phone is not a small desktop.                   | [devices.md](devices.md)           |
| Loading        | Say `ready` only after the first frame is drawn, and report progress while loading.    | [loading.md](loading.md)           |
| Movement       | Walk, run and jump like the lobby does, so travelling doesn't change how a body feels. | [movement.md](movement.md)         |
| Menus          | Menus work with keyboard, pointer and gamepad, and Escape always goes back one step.   | [menus.md](menus.md)               |
| Sound          | Stay silent until a gesture, honour the saved mute, and stop all sound when suspended. | [sound.md](sound.md)               |

## Done

A game is done when `pnpm games:check <id>` exits 0. Nothing less counts and
nothing more is required: if a person finds something the check let through,
the fix is a new check (see "Corrections" in [AGENTS.md](../../AGENTS.md)),
not a longer list here.

The process checks, in the order they run. `pnpm games:score <id>` prints
them, with every other stage of the check, as passed or failed:

| Check     | Passes when                                                                           | Fails with                                           |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `brief`   | `BRIEF.md` is filled in, and the game reports every `inspect()` key it lists          | `BRIEF_MISSING`, `BRIEF_INCOMPLETE`, `BRIEF_INSPECT` |
| `party`   | `game.json` says what the game offers 1, 2, 3, 4 and 5 to 8 players                   | `PARTY_UNDECLARED`                                   |
| `solo`    | the offer for one player is not empty                                                 | `SOLO_PATH`                                          |
| `bot`     | `bot.json` uses only declared input and plays to a result                             | `BOT_*`                                              |
| `arrival` | a lobby visitor lands in a walkable arrival, starts by choice and returns there after | `ARRIVAL_*`, `LEAVE_NOT_ARRIVAL`                     |
| `handoff` | the first frame matches the lobby's last: camera, lens, crouch, empty hands           | `HANDOFF_*`                                          |
| `video`   | the run was recorded for review                                                       | `VIDEO_MISSING`                                      |

The other stages of the check (bundle, boot, scenario, lifecycle, frames, and
those other areas add) are described in [../games.md](../games.md) and the
pages linked above.

## The project's measure

`games/briefs.json` holds twelve one-line game briefs, fixed so results can
be compared over time. To measure the SDK, an agent builds each one from
nothing but this page (`pnpm games:new <id>`, the brief, the build), then
`pnpm games:score --briefs` reports which checks each built game passes. The
score is the share of checks passed across the twelve; a brief that was not
built scores zero.
