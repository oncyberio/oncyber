# Bloom Garden

A virtual pet garden for Oncyber: hatch a **bloomling**, feed it, pet it,
give it little animals and watch it grow up, then race and bump it against
other players' bloomlings. Everyone at `/games/garden` shares one island.

It's an original game in the spirit of the classic pet gardens: the
creatures, names, art, sound and music are all our own and all procedural
(no meshes, textures or samples). The HUD uses the system's rounded font.

Open `/games/garden` on the local frontend (`pnpm dev:frontend`). Like every
game it is hidden until launch: development only, or `GAMES_PREVIEW=1`. How
games plug in, check and publish: [docs/games.md](../../docs/games.md).

## How it plays

- **Move** WASD / arrows (Shift walks), **Space** jumps, drag to look, wheel to
  zoom. Touch: left-side stick, drag on the right to look, buttons for the
  rest.
- **E** picks up bloomlings, eggs, fruit and critters, shakes fruit trees, and
  opens the mini games at their gates. Holding food or a critter, **E** gives
  it to the bloomling in front of you (yours or another player's).
- **F** (hold) pets. **Q** / right click throws. **R** whistles your
  bloomlings over. **Tab** opens the details panel, **H** the controls.

### Bloomlings

- Eggs hatch after 45 s, three times faster in your arms or while petted.
- Needs: tummy, energy (they nap at night), happiness. Hungry bloomlings run to
  fruit on the ground and cry when there's none.
- The **mood orb** over each head shows how it feels: ball, heart, `?`, `!`,
  swirl (upset) and zzz.
- **Stats:** Swim, Fly, Run, Power, Stamina (Lv 0–99). They train on their own
  (paddling in the pond, flapping, running laps, push-ups), and jump when you
  give critters: Hopper (Run, ears), Tweet (Fly, wings), Fishlet (Swim, fins),
  Digger (Power, paws), Shellby (Stamina, shell). Each gift also blends in a
  little of the critter's colour.
- **Fruit:** Puffberry (filling, Stamina), Sun Peach (sweet, nudges Sunny),
  Moon Plum (tangy, nudges Shade), rare Prism Fruit (everything).
- **Growing up:** after ~15 minutes of garden life a child cocoons and comes out
  an adult: **Sunny** (petal ring; raised with petting and peaches), **Shade**
  (little horns; plums and lots of throwing) or **Breeze** (balanced), shaped
  by its best stat.

### Mini games

- **Bloom Dash** (arch on the east beach): a loop on its own islet with a
  run, a pool, a climbing wall and a glide off the top. Speed per section comes
  from Run / Swim / Power / Fly; Stamina decides who flags. Distracted or tired
  racers stop: cheer (**C**/Space/the button) for a burst.
- **Bump Dojo** (cave in the cliff): bump the rival out of the ring or knock it
  out. Cheer when the needle is in the gold for a super bump.
- Up to four racers or two fighters; empty spots get CPU rivals from the cup or
  rival you picked. Results train every stat.

## Multiplayer

The game page (`frontend/features/games/GamePage.tsx`) owns identity, one
native `cyber` Colyseus room (`oncyber-bloom-garden-v1`) and voice. Poses go
out as `move` at 10 Hz. Everything else rides
the room's `chat-channel` relay as one packet per player every 300 ms (the room
allows 15 messages per 3 s per sender):

| Field | What |
| --- | --- |
| `g` | Your bloomlings: id, position, heading, action, mood orb, speed |
| `L` | Their looks (colour, parts, stage, alignment), every 5 s and when someone joins |
| `h` | What you're holding |
| `ev` | Events: pets, feeds, gifts, hatches, and kindness aimed at someone else's bloomling (`pet-other`, `gift-other`, applied by its owner) |
| `m` | Match snapshots while you host one |

Each player owns their bloomlings: their brain runs on the owner's client and
everyone else draws the snapshots 0.5 s behind, interpolated. Mini games are
hosted by whoever opens them (`m-open` → `m-join` → `m-start` with a seed and
the entrants → snapshots → `m-end`); joiners send `m-cheer`. No server changes.

**Persistence** goes through the host's `storage` service. The game runs in
an opaque-origin frame with no storage, so the web host hands saves to the
page (`garden:storage`), which keeps them in its own `localStorage`
(`oncyber:game:garden:save`); standalone, the host uses `localStorage`. Server
persistence would replace the host's `storage` service (`src/host/browser.js`) with the same
sanitized records keyed by the signed-in user (an API route on `server/`, or
per-user attributes in the room).

## The lifecycle

Bloom Garden implements the Oncyber game lifecycle (`games/runtime`), so the
same game module can also run in native WebGPU hosts:

| Part | Entry | Rules |
| --- | --- | --- |
| Game | `src/game/game.js` | Simulation + `three/webgpu` + `three/tsl` only (three pinned to 0.180.0). No DOM, browser services, `three/addons`, WASM or loaders. `createGame(ctx)` with prepare / enter / update / suspend / restore / dispose / inspect. |
| UI | `ui.html` (`src/ui/main.js`) | HUD in its own sandboxed page via `connectUI`; draws the JSON the game publishes and sends declared actions (keys, drag-to-look deltas, touch stick, buttons). Built into one self-contained file. |
| Web host | `index.html` (`src/host/browser.js`) | `createBrowserSession` (WebGPU). Older browsers get a WebGL 2 fallback, which is not a portable target. Implements the services below and the `/garden` page bridge. |
| Manifest | `game.json` `runtime` | Platforms web, ios, android; 38 named actions with keyboard/touch/gamepad bindings; capabilities; `public/motion.json` declared. |
| Check | `scenario.json` | Boot, walk to the egg, pick it up, throw it. `pnpm games:check garden` plays it in a browser. |

Avatar bytes come from `ctx.services.avatar(ref)` (capability `avatar`): the host
only resolves the visitor's avatar and players it announced, capped at 32 MiB.

Host services the game calls (`ctx.services.call`): `storage` (config, load,
save), `audio` (named cues + ambience parameters; the host synthesizes them),
`network` (`exchange`: pose and garden packet
out, peers and relayed packets in) and `travel` (`lobby`).

What makes the native port work:

- **Text and textures without a canvas:** signs and nameplates use a 5×7
  bitmap font blurred into rounded letters (`src/game/text.js`).
- **Bloom without addons:** a small TSL glow pass (`src/game/post.js`).
- **VRM avatars without GLTFLoader:** `src/game/glb.js` reads GLB (skinned
  meshes, PNG/JPEG via the host's `decodeImage`, VRM 0.x/1.0 humanoid) and
  `src/game/avatar.js` drives a normalized proxy rig with the lobby clips.
  Every catalogue avatar is uncompressed VRM 0.x; compressed extensions are
  refused and fall back to a toy body.
- **Lifecycle:** saving on suspend/dispose, device-loss reporting, avatar
  pipelines compiled off-scene before they join it.

Verified: Chrome (WebGPU), macOS Safari 26.5 (WebKit WebGPU), iOS 26.5
Simulator Safari (no WebGPU adapter in the simulator, so the WebGL 2
fallback). Not yet run in a native shell or on a physical device.

## Code map

| File | Owns |
| --- | --- |
| `src/game/sim.js` | Care rules: stats, needs, fruit, critters, alignment, evolution, save sanitizing |
| `src/game/games.js` | Race and bout simulations (deterministic, renderer-free) |
| `src/game/terrain.js` | Island shape: heights, water, landmarks |
| `src/game/world.js` | Terrain mesh, TSL water and waterfall, sky, day/night, trees, grass, props |
| `src/game/creature.js` | Bloomling model, posing and the mood orb |
| `src/game/critters.js` | The five critters |
| `src/game/garden.js` | Bloomling brains, items, player actions, snapshots, save |
| `src/game/avatar.js` | VRM players (toon shading and ink outlines, lobby motion clips) |
| `src/game/peers.js` | Other players and their bloomlings |
| `src/game/arenas.js`, `src/game/racecourse.js`, `src/game/camera.js` | Dojo ring, Bloom Dash course, camera direction |
| `src/game/minigames.js` | Match flow, hosting, HUD data |
| `src/game/fx.js` | GPU compute particles (hearts, sparkles, splashes, fireflies) |
| `src/host/audio.js` | Synthesized ambience, music and effects |
| `src/ui/main.js`, `ui.html`, `src/ui/style.css` | HUD and menus (UI page) |
| `src/host/host.js`, `src/host/browser.js` | `garden:*` bridge to the page; web host and its services |
| `src/game/game.js` | Portable entry: renderer, camera, player, actions, network, UI state, lifecycle |
| `src/game/glb.js`, `src/game/text.js`, `src/game/post.js`, `src/game/uimodel.js`, `src/game/sound.js` | VRM reader, canvas-free textures, TSL bloom, UI state, sound cues |

## Development

```bash
npm install
npm run dev      # http://127.0.0.1:14730, offline (no room)
npm test         # care rules and both mini game sims
npm run build    # host + single-file ui.html into ../../frontend/public/games/garden
```

QA URL flags: `?time=0.9` sets the time of day (0–1), `?grow=60` makes
children cocoon after 60 s, `?fast=10` speeds hatching and needs, `?webgl`
forces the WebGL 2 fallback, `?vrm=<url>` picks the standalone avatar, `?log` posts diagnostics to the dev server (`.device.log`) for device simulators.
On localhost (or with `?qa`) `window.__garden` and `window.__session` expose the garden, player and matches for scripted
playtests.
