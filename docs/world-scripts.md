# World scripts

A world script is a small JavaScript program that runs on top of a native
space: a mini game, characters, effects, a quiz at each artwork. Creators
describe what they want and an AI model writes it; they change it the same
way while they're in the world, and the change lands without a reload.

It is off unless `NEXT_PUBLIC_WORLD_SCRIPTS=1`.

## Asking for a change

A space's owner and editors get an AI button in the space's dock (and in
the studio toolbar). It opens a sidebar beside the world: say what to make
("a coin hunt with a 60 second timer", then "add three characters who chase
me") and watch each step as it happens:

1. The model writes the whole script.
2. The new version is tried out of sight, beside the running one.
3. If it does not run, the model gets the error and fixes it, up to three
   tries. The world keeps the old version meanwhile.
4. What runs is swapped into the world and saved.

The sidebar is a conversation and a composer. Typing `undo`, `restart` or
`stop` does that without a model call.

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

## The world's style

Each world has one creative direction, so what scripts make looks like it
belongs there: in a Starry Night world, "add coins" gives painted, swaying
gold coins, not yellow rings. The style is a short description, a palette,
a default surface ("painted", "toon", "glossy", "matte", "metal", "glow",
"flat"), and how much brushwork, sway and outline things get
(`features/world-scripts/style.ts`).

A world has no style until one is needed. The model writes it the first
time a request makes things people see (not for a change of rules, scores
or text), from the world's title, sky and fog colours and artwork names. It
is saved on the space (`exhibits/{id}.worldStyle`), sent with every later
request, and given to the script as `world.style`. Asking "make the style
more neon" changes it, and everything already in the world is redrawn.

Nothing is downloaded. Objects are made from code:

-   Shapes: box, sphere, cylinder, cone, torus, plane, ring, capsule, star,
    `lathe` (a profile spun around an axis: a coin, a vase, a mushroom) and
    `extrude` (an outline given depth: a heart, a key). `thing.add(part)`
    builds a character or prop from several.
-   Surfaces: TSL node materials (`features/world-scripts/looks.ts`), the
    same on WebGPU and WebGL2, with patterns (noise, stripes, swirl, dots,
    gradient). Objects with the same look share one material.
-   Custom shaders: a script can describe its own surface (colour, glow,
    opacity, movement along the normal) as a tree of building blocks:
    `["mix", "palette0", "palette1", ["fbm", ["mul", "position", 3]]]`.
    The host checks the tree against a fixed list of blocks and inputs and
    builds the material itself (`features/world-scripts/shaderGraph.ts`).

Scripts cannot send shader source. Code on the GPU cannot be stopped the way
a stuck worker can: one heavy loop in a fragment shader freezes the tab or
the whole machine, and shader compilers are a larger surface than the checked
messages. A tree of at most 96 known blocks with no loops has a bounded
cost, and still covers water, fire, flowing paint, holograms and dissolves.

## The sandbox

Each version runs in a frame sandboxed with `allow-scripts` only, so its
origin is opaque: no cookies, storage, account, wallet or page access. The
frame's policy blocks every network request (`default-src 'none'`). Inside,
the script runs in a Blob worker, on its own thread, so a stuck loop never
freezes the world; a worker that hasn't answered for 2.5 s is stopped.
The host talks to it over one transferred `MessagePort`.

The script can only ask for things through checked messages
(`features/world-scripts/protocol.ts`): add, move and restyle its own shapes
and text (with a look or a shader graph), move or hide artworks while it runs (never saved), show HUD lines,
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
-   Models or images from outside: scripts use shapes, surfaces and text
    made from code and built-in sounds, so they never make the page fetch
    anything.

## Checks

```sh
pnpm -C frontend exec jest --watchman=false features/world-scripts utils/worldScripts
```
