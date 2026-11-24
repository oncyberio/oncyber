# World scripts

A world script is a small JavaScript program that runs on top of a native
space: a mini game, characters, effects, a quiz at each artwork. Creators
describe what they want and an AI model writes it; they change it the same
way while they're in the world, and the change lands without a reload.

It is off unless `NEXT_PUBLIC_WORLD_SCRIPTS=1`.

## Asking for a change

-   In a space's chat: `/ai a coin hunt around the room with a 60 second timer`,
    then `/ai add three NPCs that chase me`. Owners and editors only. Lines from
    "Game" say what is happening and what changed; `/ai` lines are never posted
    to the room.
-   In the studio: the Scripts button (`</>`) opens the same request box, the
    script itself (editable), and Run, Restart, Undo, Stop and Save.

Every change that runs is saved to the space (`exhibits/{id}.worldScripts`),
so visitors get it the next time they load the space. Visitors already in
the room keep the version they loaded; live updates for everyone are next.

## How a change lands

The model labels each change:

| Label     | For                                          | What happens                                                                                                    |
| --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `content` | More NPCs, colours, a new prop, text, sounds | The game keeps going: objects with the same id stay where they are, `keep()` values (score, timer) carry over.  |
| `logic`   | New rules, scoring, win or lose, a new game  | The world rewinds: artworks go back, objects glide to their start, the player returns to where the round began. |

Either way the new version starts beside the running one and runs a short
trial (30 frames) without showing anything. Only if it started cleanly does
the swap happen, between two frames. A version that fails to parse, throws
while starting, or stops answering is refused and the old one keeps running.
Undo goes back to the previous version (as a rewind).

## The sandbox

Each version runs in a frame sandboxed with `allow-scripts` only, so its
origin is opaque: no cookies, storage, account, wallet or page access. The
frame's policy blocks every network request (`default-src 'none'`). Inside,
the script runs in a Blob worker, on its own thread, so a stuck loop never
freezes the world; a worker that hasn't answered for 2.5 s is stopped.
The host talks to it over one transferred `MessagePort`.

The script can only ask for things through checked messages
(`features/world-scripts/protocol.ts`): add, move and restyle its own shapes
and text, move or hide artworks while it runs (never saved), show HUD lines,
toasts and a banner, play built-in sounds, and respawn the player (at most
twice a second). Every value is clamped; ids, colours, sounds and corners
come from fixed sets; at most 300 objects and 600 requests a frame. The host
sends it the player and camera every frame, and keys and clicks.

What the script can use is in `features/world-scripts/sdk.ts`; the model's
brief, with an example game, is `features/world-scripts/brief.ts`.

## The model and its cost

`pages/api/_v2/worldScripts` (`access`, `generate`, `save`). The server calls
OpenRouter with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (default
`anthropic/claude-sonnet-4.5`). Because one key pays for everything, only
accounts in `WORLD_SCRIPTS_AI_ALLOWLIST` may ask, up to
`WORLD_SCRIPTS_AI_DAILY_LIMIT` requests a day.

Every model call writes a row to `aiUsage` (account, space, model, tokens,
the cost OpenRouter reports) and bumps `aiUsageDaily/{account}_{day}`. When
credits come, `checkAiAccess` checks the balance before the call and
`recordAiUsage` charges the reported cost after it
(`utils/worldScripts/server.ts`); nothing else changes.

## Not yet

-   Live updates for everyone in the room (the change reaches others on their
    next load).
-   Shared state between visitors (multiplayer scores).
-   Models or images from outside: scripts use shapes, text and built-in
    sounds, so they never make the page fetch anything.

## Checks

```sh
pnpm -C frontend exec jest --watchman=false features/world-scripts utils/worldScripts
```
