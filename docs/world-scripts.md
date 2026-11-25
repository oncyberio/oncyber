# World scripts

A world script is a small JavaScript program that runs on top of a native
space: a mini game, characters, effects, a quiz at each artwork. Creators
describe what they want and an AI model writes it; they change it the same
way while they're in the world, and the change lands without a reload.

It is off unless `NEXT_PUBLIC_WORLD_SCRIPTS=1`. With it on, a space's saved
script runs for every visitor; writing one with the AI is in early access.

## Early access

The AI sidebar is offered only to accounts on the early-access list
(`WORLD_SCRIPTS_AI_ALLOWLIST`: account ids or wallets; `*` opens it to every
editor). An account that is not on it sees no AI button, in the dock or in
the studio, and the server refuses its requests whatever the page shows:
asking the model, and putting a script or a style on a space. An admin who
is not on the list can still take a space's scripts away. Being on the list
does not make someone an editor: both are checked.

## Asking for a change

A space's admins (its owner, its editors and site admins) who are in early
access get an AI button in the space's dock (and in
the studio toolbar). It opens a sidebar beside the world: say what to make
("a coin hunt with a 60 second timer", then "add three characters who chase
me") and watch each step as it happens:

1. The model writes the whole script.
2. The new version is tried out of sight, beside the running one.
3. If it does not run, the model gets the error and fixes it, up to three
   tries. The world keeps the old version meanwhile. Only a failure of the
   script's own goes back to the model: when the world could not try it
   (still loading, not answering, replaced by something newer) the sidebar
   says so and stops, without spending another request.
4. What runs is swapped into the world and saved.

The sidebar is a conversation and a composer. Typing `undo`, `restart` or
`stop` does that without a model call.

Every change that runs is saved to the space (`exhibits/{id}.worldScripts`),
so visitors get it the next time they load the space. Visitors already in
the room keep the version they loaded; live updates for everyone are next.

A save says which saved version it builds on. If the space's script was
changed somewhere else since (another editor, another tab), the request is
refused before the model is asked, and a save is refused rather than
written over the other change; the sidebar says to reload.

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
The trial's states and what ends it are in `trial.ts`
([state machines](state-machines.md)). A trial that is replaced (a newer
edit, a stop) ends at once; a script's own `world.restart()` waits for a
version already on its way instead of replacing it.

When a swap lands, objects the new version does not make are removed and
HUD lines it does not show are hidden, whichever way it landed. An id made
again as another shape is built anew (and counted against the limits like
any new object). A script that stops for good (it kept failing, it hung)
takes what it made with it: its objects, HUD lines, colliders and openings
go, and artworks and doors return to where the space has them.

The trial is counted in the world's frames, not in seconds: a slow device
draws them slowly and a tab in the background draws none, and neither is
the script's fault. What ends a trial early is silence while an answer is
owed, 4 seconds of it (`silence.ts`). A space's saved script starts the
same way for every visitor, so this is also what decides whether a
visitor on a slow phone gets the script at all.
Undo goes back to the previous version (as a rewind) and the style it ran
in; if that version does not run, it is still there to go back to.

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
more neon" changes it, and everything already in the world is redrawn. A
style the model writes comes with a script: the script is tried in it, and
the world is redrawn and the style saved only if that script lands.

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

The frame's relay passes on only what was asked for: one answer to the
start, one to each frame sent, one to each request for `keep()` values. A
worker that posts without being asked does not reach the page and does not
count as answering; one that keeps at it is stopped at once. The script
cannot start a worker of its own (`Worker` is taken away inside the
sandbox, with `fetch` and the rest), so nothing can keep answering for it
while it loops.

The script can only ask for things through checked messages
(`features/world-scripts/protocol.ts`): add, move and restyle its own shapes
and text (with a look or a shader graph), move or hide artworks while it runs (never saved), show HUD lines,
toasts and a banner, play built-in sounds, and respawn the player (at most
twice a second). Every value is clamped; ids, colours, sounds and corners
come from fixed sets; at most 300 objects and 600 requests a frame, counted
by the frame however many messages carry them, and a script that sends more
than 120 messages between two frames is stopped. A limit a script runs
into is said once in the sidebar. The host
sends it the player and camera every frame, and keys and clicks.

What the script can use is in `features/world-scripts/sdk.ts`; the model's
brief, with an example game, is `features/world-scripts/brief.ts`.

## In a framed world

Where worlds are framed ([plans/framed-worlds.md](plans/framed-worlds.md)),
world scripts are split along the same line as everything else: what needs
the account is the page's, what needs the world is the world's.

| Where                          | What                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| The page (`PageWorldScripts`)  | who may edit, the AI button and sidebar, the calls to the model, the save, undo (`controller.ts`)       |
| The world (`WorldScriptLayer`) | the sandbox, the engine it draws through, the HUD, and starting the space's saved script (`runtime.ts`) |

The page's controller drives the world's runtime through messages
(`runtimeRelay.ts`): run this source (in this style), give up on that run,
restart, stop, draw in this style, what are your colours and artworks; the
world answers whether a run worked, and whose fault it was if not, and
reports its status. The page waits for a run's answer by silence, as the
world waits for a script: 45 seconds of nothing while the page is on show.
A page in the background has a world that draws no frames, and is waited
out. A run the page gives up on is called off in the world, so it cannot
land later unseen. The world never makes an account call and never
sees the session. Each message names its space, so a world that has walked
through a portal into another space is not driven by the page it left.

The page takes the world's word only for what a world can know: whether a
script ran and why not (shown in the sidebar, sent to the model to fix),
and its colours and artwork names, cut to the sizes the model call accepts.

## The model and its cost

`pages/api/_v2/worldScripts` (`access`, `generate`, `save`). The server calls
OpenRouter with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (default
`anthropic/claude-sonnet-4.5`). Because one key pays for everything, only
accounts in early access (`WORLD_SCRIPTS_AI_ALLOWLIST`) may ask, up to
`WORLD_SCRIPTS_AI_DAILY_LIMIT` requests a day.

A request is counted in `aiUsageDaily/{account}_{day}` before the model is
called, in a transaction, so requests made at once cannot all pass under
the limit; it stays counted when the call fails or times out. Every model
call then writes a row to `aiUsage` (account, space, model, tokens, the
cost OpenRouter reports, whether it worked) and adds its cost to the day.
When credits come, `reserveAiRequest` holds the price before the call and
`recordAiUsage` charges the reported cost after it
(`utils/worldScripts/server.ts`); nothing else changes.

`save` is the only way a space's scripts and style are written: the
space's other updates refuse those fields
(`utils/firestore/exhibitWrites.ts`).

## Not yet

-   Live updates for everyone in the room (the change reaches others on their
    next load).
-   Shared state between visitors (multiplayer scores).
-   Models or images from outside: scripts use shapes, surfaces and text
    made from code and built-in sounds, so they never make the page fetch
    anything.

## Checks

```sh
pnpm -C frontend test features/world-scripts utils/worldScripts pages/api/_v2/worldScripts
```

The host and the SDK are tested without a browser: `scriptSandbox.jest.ts`
runs the real SDK and a script in a context of their own, and
`sdk.test.ts` fails when the model's brief names something the SDK does
not have.
