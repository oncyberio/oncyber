# Agent-built worlds: engine or no engine

Decision record, 14 November 2026. Written so an agent working only from this
repository can act on it: everything it depends on is either in this file or
in this repository.

## The decision

Stay engine-less. Worlds and games made with agents are free web code in a
sandboxed frame. Oncyber gives them a small SDK and never ships an engine,
scene format or scripting language for them.

- **Keep.** Free web code, a sandboxed frame, a small SDK that never imports or
  types against a renderer.
- **Add.** A feedback loop for the agent: screenshots, logs, played input and
  checks. Agent-built games fail at knowing whether they work, not at writing
  code (evidence below).
- **Standardise.** One optional lifecycle (seven functions, below). It makes
  live editing, seamless travel and measured performance possible.
- **Don't build.** An engine, a scene format, or hot-swap levels declared per
  module.

Live editing works on that lifecycle: in the prototype in
[`live-swap-prototype/`](live-swap-prototype/README.md) an edit reaches a
running world in 0.2 to 0.3 s with no dropped frame, keeps state, and bad code
never reaches the player.

Confidence: high on engine-less; medium on edit timings (measured on a
software GPU only). The weakest point is avatars looking consistent across
worlds.

Scope: custom worlds and games made with agents. Gallery spaces keep the
native engine in `frontend/components/_3DExhibit-v2/`; nothing here changes
them.

## Background an agent needs

### What exists in this repository

- **Content host.** Outside experiences run in an opaque sandboxed iframe
  (`sandbox="allow-scripts allow-pointer-lock"`, credentialless, no referrer)
  and talk to the page through a versioned postMessage bridge. Read
  [`docs/content-host.md`](../content-host.md),
  `frontend/features/content-host/` (`protocol.ts`, `runtime.ts`,
  `security.ts`, `contentBridgeMessages.ts`) and the in-frame helper
  `frontend/public/oncyber-content.js` (`ready()`, `openMenu()`,
  `requestWalletAddress()`, `onResume()`). WebGPU works inside the
  cross-origin frame.
- **three.js r187** vendored at `vendor/three/three-0.187.0-dev.d90ae4b.tgz`.
- **Performance checks design**: a separate doc (not in the repo) proposing
  publish-time checks: a static scan plus a headless browser run, three
  profiles (desktop, phone, Quest) that label rather than block, and a JSON
  report an agent can act on. The parts that matter here are summarised under
  "What Oncyber owns".

### What lives outside this repository

The world SDK and the earlier engine live in a separate private repository.
A cloud agent cannot read it. What matters from it is summarised here, and
the one interface that matters is copied in full below.

- **The world SDK** is a browser global a world calls into. Its surface:
  `ready()`, `progress()`, `me`, `room` (peers, join/leave/event/state
  events, `setPose`, `setFlags`, `send`, shared state with
  get/set/claim/release/keys), `connection`, `capabilities`, `network`,
  `voice` (listener and peer poses), `storage` (per user and per world,
  compare-and-set), `leaderboard`, `ai` (generate text or objects), `ui`
  (buttons and actions), `mocap`, `portal(worldId, payload?)`, `dispose()`.
  Its rule: it never imports or types against a renderer. Its acceptance
  test: making an existing single-player three.js game multiplayer costs at
  most 50 lines of diff (two test ports took 38 and 41 lines).
- **Three overlapping world contracts exist there today:** (a) a plain SDK
  world, `index.html` plus the SDK global and a manifest; (b) a
  `build(scene, camera, ctx) → { tick(dt), dispose() }` split used by a
  studio; (c) an optional "portable" profile with a host-driven lifecycle and
  a travel coordinator. This doc recommends (c) as the only lifecycle.
- **The earlier engine** (January 2026) was a component engine on three.js
  and Rapier: 753 source files and about 166,000 lines, with a 351-line guide
  the agent had to read first. It was abandoned because it was a new language
  no model speaks.

### The lifecycle (copied from the private repository)

```ts
type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
type Vec3 = [number, number, number];

interface Continuity {
    avatar: { id: string; asset?: string; position: Vec3; rotation: [number, number, number, number] };
    camera: { position: Vec3; target: Vec3; fov: number; mode: string };
    party: Array<{ id: string; position: Vec3; rotation: [number, number, number, number] }>;
}
type Phase = "created" | "preparing" | "ready" | "entered" | "suspended" | "failed" | "disposed";

interface GraphicsSurface {
    canvas: unknown; // browser canvas or a tested native canvas adapter
    context?: unknown;
    device?: unknown;
    width: number;
    height: number;
    pixelRatio: number;
    decodeImage?(bytes: ArrayBuffer, mimeType: string): Promise<unknown>;
    openVideo?(asset: string): Promise<{ width: number; height: number; frame(): unknown | null;
        setVolume?(volume: number): void; play(): void; pause(): void; close(): void }>;
}
interface HostServices {
    identity: { id: string; name: string; avatar?: string };
    asset(path: string, signal: AbortSignal): Promise<ArrayBuffer>; // only this release's declared files
    call(capability: string, operation: string, value: Json, signal: AbortSignal): Promise<Json>; // permission-checked
}
interface GameContext {
    graphics: GraphicsSurface;
    services: HostServices;
    signal: AbortSignal;
    input: Readonly<Record<string, number>>;     // declared actions
    deltas: Readonly<Record<string, number>>;    // relative input since last update, consumed once
    pressed: Readonly<Record<string, boolean>>;  // rising edges, cleared after update
    ui: { publish(value: Json): void };          // bounded JSON to a separate UI frame
}
interface PortableGame {
    prepare(): Promise<void>;
    enter(continuity: Continuity): Promise<void> | void;
    update(seconds: number): void;
    suspend(): Promise<Json> | Json;
    restore(snapshot: Json): Promise<void> | void;
    dispose(): Promise<void> | void;
    inspect(): Record<string, Json>;             // game-specific assertions for checks
}
type GameFactory = (context: GameContext) => PortableGame; // the module's default export
```

Travel between two worlds already uses it: prepare the next world, suspend
the previous one, enter the next with `Continuity`, dispose the previous; a
failure restores the previous world.

**Additions this doc proposes for live editing:**

- `export const stateVersion = n` on the module. Raise it when the state's
  shape breaks; the host then starts the new version with fresh state.
- `snapshot(): Json`, like `suspend()` but with no side effects, for rewind.
- `ctx.keep(key, inputs, build, dispose?)`: the host returns the same object
  to the next version when `key` and `inputs` are unchanged.
- `ctx.params`: data the world reads every frame. Changing it needs no swap.

## How other platforms decided

| Platform | Model | What it shows |
|---|---|---|
| [Roblox](https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic) | Engine | April 2026: a planning mode, a playtesting agent and a built-in MCP server for outside agents. 44% of its top 1,000 creators use AI tools. |
| Meta Horizon ([UploadVR](https://www.uploadvr.com/meta-horizon-studio-upgrade-ai-assistant-horizon-worlds/), [RuntimeWire](https://runtimewire.com/article/meta-horizon-create-studio-ai-game-tools)) | Engine | Replacing its Unity runtime with its own engine; its assistant generates worlds, assets and TypeScript. Prompt-to-game waitlist opened September 2026. |
| [YouTube Playables](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability) | Engine-less | No engine named. Limits instead: 30 MiB first bundle, 512 MB heap. |
| [Discord Activities](https://docs.discord.com/developers/activities/how-activities-work.md) | Engine-less | A web app in an iframe; the SDK talks to Discord over postMessage. |
| [CrazyGames](https://docs.crazygames.com/requirements/technical/) | Engine-less | Limits on size and on time to gameplay (20 s). |
| [Rosebud](https://lab.rosebud.ai/blog/how-does-vibe-coding-work-for-games) | AI game maker | Plain JavaScript and three.js in the browser. |
| [Vibe Jam 2026](https://vibejam.com/2026/press) | Open jam | 945 web games, each at least 90% AI-written. Any engine allowed; three.js recommended. A judge called quality ["much higher level than last year"](https://levels.io/vibe-jam-2026-winners-quality). |

1. Engine platforms keep the engine for the platform's needs (safety, shared
   avatars, one look, every device), not the agent's.
2. What Roblox gives its agents is sight: logs, a queryable world, a test
   player. That needs no engine.
3. Engine-less portals already run at scale on a sandbox, a small SDK and
   measured limits.

## What agents can build alone today

| Benchmark | Setup | Best result |
|---|---|---|
| [GameXpert-Bench](https://arxiv.org/html/2608.21833v1), Aug 2026 | 97 browser games, agent picks its own stack | 79.7/100, completeness 94.4 |
| [GameCraft-Bench](https://huggingface.co/papers/2606.17861), Jun 2026 | 140 games in Godot | 41.5% |
| [CEGame-Bench](https://arxiv.org/abs/2610.26098), Oct 2026 | Full games in five engines | Game reaches its ending in 16% of runs |
| [UnityBench-Mini3D](https://arxiv.org/html/2610.35980v1), Oct 2026 | 77 Unity editor tasks | 72.5% |
| [GameDevBench](https://huggingface.co/papers/2602.11103), Feb 2026 | 132 tutorial tasks | 54.5% |

Scoring differs, so this is not a controlled comparison, but free web code is
text the model reads in full, while engines add editor state and wiring (16 to
29% of failed Unity checks). Where agents fail everywhere:

- **They don't look.** Some setups never capture a frame; image and video
  feedback lifted one model from 33.3% to 47.7%; a playtest-and-repair skill
  added 14 to 24 points.
- **Built but broken.** 5.3% of coded features failed at runtime, over half
  at load or crash.
- **3D and layout.** 3D scored 5.8 points below 2D; UI misaligned in 15% of
  runs.

Agents can bootstrap large systems: 16 agents wrote a 100,000-line C compiler
that builds Linux ([Anthropic](https://anthropic.com/engineering/building-c-compiler));
Cursor's agents wrote a browser of over a million lines
([Cursor](https://cursor.com/blog/scaling-agents)). Both credit the test
harness: the verifier must be "nearly perfect, otherwise Claude will solve the
wrong problem". So the SDK should grow eyes and a referee, not more APIs.

## What Oncyber owns

The world owns everything inside the frame. Oncyber owns the frame, the clock
when the world uses the lifecycle, and the checks.

| Engine platforms get it from the engine | Engine-less gets it from | State |
|---|---|---|
| Code that can't hurt visitors | The sandboxed frame and its network rules | Built |
| Identity, friends, rooms, voice, chat | The SDK and the page around the frame | Built (private repo) |
| Performance on every device | Measured limits per device at publish, shown as labels | Designed |
| Keyboard, touch and VR controls | Input actions the world declares, mapped by the host | In the lifecycle |
| Seamless travel, pause, live edits | The lifecycle | Travel built; live edits prototyped |
| Thumbnails and moderation | Screenshots the host takes | Not built |
| Avatars that travel with you | Avatar data from the SDK plus an optional three.js kit | Weakest point |
| Remixing a world | Fork its source files | Not built |
| Worlds that keep working | A static bundle that pins its own three.js | True today |

The gallery engine needs `three/compat.js` to keep r153 lighting on r187; a
game engine would owe that to every world on every release. A self-contained
bundle owes it to nobody.

The host can measure performance exactly for lifecycle worlds, because it
calls `update()` and so owns the clock.

## Live editing: how an update is applied

An update is a trip from version N of a world to version N+1, the same steps
as travel between two worlds:

1. The new code loads and runs `prepare()` in the background; N keeps playing.
2. Between two frames, N's `suspend()` returns its state as plain data.
3. N+1 gets `enter()` and `restore(state)` and plays the next frame.
4. N stays suspended for a short trial (20 frames), then is disposed.
5. Anything that throws before or during the trial puts N back with its state.

The host decides reload, rewind or keep playing on every update by trying the
cheapest safe option and checking the result. The agent declares nothing.

| What changed | Host does | Player sees |
|---|---|---|
| Only `params` data | Passes the new values | The change next frame |
| Code, same state shape | Swaps and carries state | Play continues |
| Code, new `stateVersion` or `restore()` throws | Swaps with fresh state | Restart in place |
| Rules, replay asked for | Restores a snapshot, replays recorded input through new code | The last seconds again |
| Syntax error, or a throw in `prepare`, `enter` or the trial | Rejects or rolls back | Nothing; the agent gets the error |
| No lifecycle | Reloads the frame | A reload |

Every update returns a structured result (outcome, failing stage, error,
timings, what was rebuilt) an agent can act on unattended. Half-written code
is rejected in milliseconds, and a burst of edits collapses to the latest
text.

Drafts need no bundler and no server: the frame receives source text, turns
it into blob modules itself (blob URLs are bound to the origin that makes
them) and resolves `three` through an import map. A bundler runs only at
publish.

## Prototype results

Code and raw results: [`live-swap-prototype/`](live-swap-prototype/README.md).
Headless Chromium 153, software GPU, three.js r187, a world with 24 shader
materials, 300 props, 3,000 instanced trees, a player and coins, in an opaque
sandboxed frame (no storage, no access to the page).

| Test | Result |
|---|---|
| Visual edit, logic edit | Live in 0.18 to 0.33 s; old version held 60 fps; longest frame gap 16.8 ms |
| The swap step alone | 0.1 to 0.7 ms |
| Syntax error | Rejected in 7 ms; world kept playing |
| Throw in `prepare`, `enter`, or 5th frame after swap | Rolled back each time, state intact |
| New state field meets old snapshot | Adopted |
| `stateVersion` raised | Restart in place |
| Data-only change | Speed 6 → 18 units/s, no swap |
| 8 edits back to back | One swap; latest live in about 0.4 s |
| Rewind 150 frames, replay same code | Same end state |
| Change jump, replay 150 frames through new code | Jump peak 1.17 → 2.93, same position and clock |
| Rules using `Math.random` | Host detected the replay diverged |
| Full reload, for comparison | 0.5 to 1.1 s, state lost |

On a bigger world (96 materials, 600 props), what the world keeps decides edit
time and memory:

| Kept between versions | Prepare time | Heap after 30 edits, from 14 MB |
|---|---|---|
| Nothing | ~640 ms | not measured |
| Geometry and materials | 550 to 680 ms | 52 MB |
| The whole static scene | 7 ms (logic), 34 ms (colour) | 19 MB |

three.js rebuilds shader graphs per new scene and light set, and holds old
ones, so keeping GPU objects alone saves nothing. GPU object counts stayed
flat in every run.

Limits: software rendering, one world, one browser. Software WebGPU loses its
device when presenting to a canvas, so WebGPU runs drew off screen; only the
first pixel readback resolves there. Real-GPU timings are still unmeasured.

## Where the earlier proposal can be better

1. **Swap levels declared per module** (visual, logic, rewind, reload): drop
   them. A wrong label fails silently and state doesn't live at module
   boundaries. One whole-version swap checked by the host covers all four.
2. **Bundling in the browser**: not needed for drafts. WebContainers also
   needs a [commercial licence](https://webcontainers.io/enterprise) in
   production.
3. **A new runtime contract**: one exists (the lifecycle above). Add only
   `stateVersion`, `snapshot()`, `ctx.keep` and `ctx.params`.
4. **Rewind for every world**: needs honest snapshots, and replay needs
   deterministic rules. Offer both, detect when they don't hold.

Prior art agrees: state survives when it is plain data outside the replaced
code, and the tool must fall back loudly. [Vite HMR](https://vite.dev/guide/api-hmr)
works because frameworks write the accept code;
[React Fast Refresh](https://reactnative.dev/docs/fast-refresh) keeps state
"only if it's safe to do so";
[Flutter](https://docs.flutter.dev/tools/hot-reload) doesn't rerun `main()`;
[PlayCanvas](https://developer.playcanvas.com/user-manual/scripting/hot-reloading)
makes every script write `swap(old)` by hand;
[Bevy 0.17](https://bevy.org/news/bevy-0-17/) skips systems whose parameters
change.

## Risks

- **Avatars.** Each world draws visitors itself. Ship an optional avatar kit,
  a check and a label; measure adoption.
- **Phones and Quest.** Expect many "may run slowly" labels at first.
- **Edit times on real GPUs.** Unmeasured; the worst case is a longer wait,
  not a stutter (prepare runs in the background).
- **Memory in long edit sessions.** Reload the frame past a heap limit.
- **Dishonest snapshots.** The trial catches crashes, not drift.
- **Moderation.** The host sees pixels, not content.
- **Two sandbox designs.** This repo uses an opaque frame; the private SDK
  uses a subdomain per world. Pick one before building the draft host.
- **Multiplayer during a live edit.** Each client swaps locally; shared room
  state stays on the server. Untested.

## Build order

1. **One lifecycle.** Publish the lifecycle above as the single contract with
   the four additions. Templates and agent docs produce it by default; worlds
   without it still run.
2. **Draft host.** Turn `live-swap-prototype/rt/live.js` into a product
   inside the content frame: apply, trial, rollback, snapshots, structured
   result. A good first deliverable is a dev page (for example under
   `frontend/pages/dev/`) where a person edits a world on their own GPU.
3. **Local loop.** A CLI `dev` command watches a folder and live-swaps it into
   the browser, so Claude Code, Codex or Cursor get live editing with no new
   interface.
4. **Eyes for the agent.** Screenshot, logs, `inspect()`, play input for N
   frames, step and rewind, in the CLI and as MCP tools; reuse them in checks.
5. **Publish checks and fixed versions.** Drafts change freely; a release
   never changes.
6. **Vibecoding on the site.** Chat, editor and preview on the same draft
   host, with the person's own model key.
7. **Live rooms.** Ship a new release to visitors in a room with the same
   swap.
8. **Kits by demand.** Avatars, controls, touch and VR input as optional
   libraries.

## Rules for work in this repository

- The product is Oncyber. Don't add other product or SDK names to code, docs
  or the interface (see `AGENTS.md`).
- Before opening a pull request, share a test link (Vercel preview or local
  steps) and wait for it to be tried.
