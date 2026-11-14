# Agent-built worlds: engine or no engine

Decision record, 14 November 2026.

**Who this is for.** An agent or person who has this repository and nothing
else: no access to anyone's laptop, to private repositories, or to private
documents. Everything the decision depends on is either written in this file
or is a file in this repository. Where something lives elsewhere, the section
[Where everything is](#where-everything-is) says so, says what you can't
read, and gives the part of it you need.

If `docs/plans/live-swap-prototype/` is missing from your checkout, you are on
a branch from before it was added. Fetch the branch that holds this file.

## The decision

Stay engine-less. Worlds and games made with agents are free web code in a
sandboxed frame. Oncyber gives them a small SDK and never ships an engine, a
scene format or a scripting language for them.

-   **Keep.** Worlds are free web code in a sandboxed frame. The SDK stays
    small and never imports or types against a renderer.
-   **Add.** A feedback loop for the agent: screenshots, logs, played input
    and checks. In every benchmark below, agent-built games fail at knowing
    whether they work, not at writing code.
-   **Standardise.** One optional lifecycle of seven functions
    ([copied in full below](#the-lifecycle)). It makes live editing, seamless
    travel and measured performance possible.
-   **Don't build.** An engine, a scene format, or hot-swap levels declared
    per module.

Live editing works on that lifecycle. In the prototype in
[`live-swap-prototype/`](live-swap-prototype/README.md) an edit reaches a
running world in 0.2 to 0.3 s with no dropped frame. State is kept, and bad
code never reaches the player.

How sure this is:

-   **High** on engine-less. It rests on five benchmarks, the platforms
    below, and two builds Oncyber made itself (an engine in January 2026, and
    a small SDK after it).
-   **Medium** on edit timings. They were measured on a software GPU only.
-   **Weakest point:** avatars that look consistent across worlds.

Scope: custom worlds and games made with agents. Gallery spaces keep the
native engine in `frontend/components/_3DExhibit-v2/`. Nothing here changes
them.

## Words used here

| Word                 | Meaning                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| World                | A custom 3D experience or game: a folder of web files (HTML, JavaScript, assets) that runs in a browser.                               |
| Host                 | The Oncyber page around a world. It owns the header, chat, menus, wallet and account.                                                  |
| Frame                | The sandboxed iframe the host runs a world in.                                                                                         |
| SDK                  | The small script a world loads to talk to the host: identity, rooms, voice, storage.                                                   |
| Lifecycle            | Seven functions a world may export so the host can drive it: `prepare`, `enter`, `update`, `suspend`, `restore`, `dispose`, `inspect`. |
| Portable profile     | The private SDK repository's name for a world that follows the lifecycle. Same thing.                                                  |
| Draft                | A world being edited. It changes freely.                                                                                               |
| Release              | A published world. It never changes; a change is a new release.                                                                        |
| Draft host           | Code inside the frame that takes new source text for a draft and swaps it into the running world.                                      |
| Swap                 | Replacing version N of a running world with version N+1 between two frames.                                                            |
| Trial                | The first frames after a swap, while the old version is kept so the host can go back to it.                                            |
| Private SDK repo     | A separate private repository with the world SDK, its CLI and templates. Not readable from here.                                       |
| The January engine   | A component engine Oncyber built in January 2026 and abandoned. Also in a private repository.                                          |
| The earlier proposal | A chat draft of this plan. It is in no repository. Its four differing points are listed below; nothing else from it is needed.         |

## Where everything is

| Thing                                         | Where                                                                                                        | Readable from this repository?                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| This decision                                 | `docs/plans/agent-built-worlds.md`                                                                           | Yes                                                                                                                      |
| Live swap prototype and its raw results       | `docs/plans/live-swap-prototype/`                                                                            | Yes. It runs in a cloud container (steps below).                                                                         |
| Content host (the sandboxed frame)            | `docs/content-host.md`, `frontend/features/content-host/`, `frontend/public/oncyber-content.js`              | Yes                                                                                                                      |
| three.js r187                                 | `vendor/three/three-0.187.0-dev.d90ae4b.tgz`                                                                 | Yes                                                                                                                      |
| Gallery engine                                | `frontend/components/_3DExhibit-v2/`                                                                         | Yes. Out of scope here.                                                                                                  |
| Terminal tool for gallery spaces              | `scripts/world-cli.mjs` (`login`, `pull`, `push`, `snapshot`)                                                | Yes. It edits gallery spaces, not agent-built worlds.                                                                    |
| In-app docs and `llms.txt`                    | `frontend/content/docs/`, served at `/docs` and `/llms.txt`                                                  | Yes                                                                                                                      |
| World SDK, its CLI, templates, agent guide    | Private SDK repo                                                                                             | No. Summarised under [What lives outside this repository](#what-lives-outside-this-repository).                          |
| The lifecycle's source and travel coordinator | Private SDK repo                                                                                             | No. The interface is [copied in full](#the-lifecycle).                                                                   |
| The January engine                            | A private repository                                                                                         | No. Only its size matters, and that is given below.                                                                      |
| Publish-time performance checks design        | A private document                                                                                           | No. The parts needed are under [Performance checks](#performance-checks-design-summary).                                 |
| Contributor mode                              | Branch `claude/project-thread-ax5gx3`, `frontend/features/contribute/`. Not on `main` when this was written. | Yes, on that branch. It lets a signed-in person edit the site with an AI model on their own key and open a pull request. |
| Contributor sandboxes plan                    | A private document                                                                                           | No. One fact matters: it needs a server per person. Drafting a world does not.                                           |
| Benchmarks, platform pages, tool docs         | Public web pages, linked under [Sources](#sources)                                                           | Yes, if your network policy allows those hosts. Every figure used is already in this file.                               |

## What is being decided

The choice is who owns the game loop and the scene: Oncyber or the world.

| Option                       | Who owns rendering, physics and rules | What Oncyber ships                                                  | Examples                                                                      |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Engine platform              | Oncyber                               | An engine, a scene format and a scripting API                       | Roblox, Horizon Worlds, Hyperfy, the January engine                           |
| Engine-less, SDK only        | The world                             | A sandboxed frame and an SDK for identity, rooms, voice and storage | YouTube Playables, Discord Activities, CrazyGames, the private SDK repo today |
| Engine-less plus a lifecycle | The world                             | The same, plus a few functions the host may call                    | The private SDK repo's optional portable profile                              |

This record chooses the third option. It is not a small engine. It is seven
functions, and it says nothing about renderer, physics or code structure.

Oncyber has tried both ends:

-   **The January engine** was a component engine on three.js and Rapier. It
    reached 753 source files and about 166,000 lines, with a 351-line guide an
    agent had to read first. It was abandoned because it was a new language no
    model already speaks.
-   **The SDK** went the other way. Its acceptance test is that making an
    existing single-player three.js game multiplayer costs at most 50 lines of
    changes. Two test ports took 38 and 41 lines.

## What exists in this repository

-   **Content host.** An outside experience runs in an opaque sandboxed
    iframe and talks to the page through a versioned `postMessage` bridge.
    -   Sandbox attributes: `allow-scripts allow-pointer-lock`
        (`CONTENT_SANDBOX` in `frontend/features/content-host/security.ts`),
        plus a Permissions Policy that denies camera, microphone, fullscreen,
        payment and clipboard, `credentialless`, and no referrer.
    -   Opaque means the frame has origin `null`: no cookies, no storage, no
        access to the page. Files it fetches must be served with
        `Access-Control-Allow-Origin: *`.
    -   Bridge messages are declared in `contentBridgeMessages.ts`. The host
        side validates the sender window, the origin, a per-load session
        nonce, message size and rate (`ContentMessageGate` in `protocol.ts`).
    -   The in-frame helper is `frontend/public/oncyber-content.js`. It
        exposes `window.oncyberContent` with `ready()`, `openMenu()`,
        `requestWalletAddress()` and `onResume(listener)`. That is the whole
        bridge today.
    -   A world is attached to a space by URL with
        `POST /api/content/register`. There is no publishing flow, no draft
        storage and no world hosting in this repository yet.
    -   WebGPU works inside the cross-origin frame.
    -   Full detail: [`docs/content-host.md`](../content-host.md).
-   **three.js r187**, vendored. The gallery engine keeps old spaces lit
    correctly across three.js versions through `three/compat.js`.
-   **The prototype** described in
    [Prototype](#prototype-what-was-built-and-what-it-showed).

## What lives outside this repository

The world SDK and the January engine are in private repositories. A cloud
agent can't read them. What matters from them is here.

**The world SDK** is a browser global a world calls into. Its surface:

-   `ready()`, `progress()`, `dispose()`
-   `me`: the visitor's identity
-   `room`: peers; join, leave, event and state events; `setPose`,
    `setFlags`, `send`; shared state with get, set, claim, release and keys
-   `connection`, `capabilities`, `network`
-   `voice`: listener and peer poses
-   `storage`: per user and per world, with compare-and-set
-   `leaderboard`
-   `ai`: generate text or objects
-   `ui`: buttons and actions
-   `mocap`
-   `portal(worldId, payload?)`

Its rule: it never imports or types against a renderer.

This SDK is larger than the bridge in this repository
(`oncyber-content.js`). The two have not been merged. Don't assume any SDK
call above exists in this repository.

**Three overlapping world contracts exist in the private SDK repo today:**

1.  A plain SDK world: `index.html`, the SDK global and a manifest.
2.  A `build(scene, camera, ctx) → { tick(dt), dispose() }` split used by a
    studio.
3.  The optional portable profile: a lifecycle the host drives, and a travel
    coordinator.

**One lifecycle, not three.** This record makes the third the only lifecycle.
A world either follows it or is a plain web page with the SDK.

### The lifecycle

Copied from the private SDK repo on 14 November 2026. This is the contract.

```ts
type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

interface Continuity {
    avatar: { id: string; asset?: string; position: Vec3; rotation: Quat };
    camera: { position: Vec3; target: Vec3; fov: number; mode: string };
    party: Array<{ id: string; position: Vec3; rotation: Quat }>;
}

type Phase =
    | "created"
    | "preparing"
    | "ready"
    | "entered"
    | "suspended"
    | "failed"
    | "disposed";

interface GraphicsSurface {
    canvas: unknown; // browser canvas or a tested native canvas adapter
    context?: unknown;
    device?: unknown;
    width: number;
    height: number;
    pixelRatio: number;
    decodeImage?(bytes: ArrayBuffer, mimeType: string): Promise<unknown>;
    openVideo?(asset: string): Promise<{
        width: number;
        height: number;
        frame(): unknown | null;
        setVolume?(volume: number): void;
        play(): void;
        pause(): void;
        close(): void;
    }>;
}

interface HostServices {
    identity: { id: string; name: string; avatar?: string };
    // Only this release's declared files.
    asset(path: string, signal: AbortSignal): Promise<ArrayBuffer>;
    // Permission-checked by the host.
    call(
        capability: string,
        operation: string,
        value: Json,
        signal: AbortSignal
    ): Promise<Json>;
}

interface GameContext {
    graphics: GraphicsSurface;
    services: HostServices;
    signal: AbortSignal;
    input: Readonly<Record<string, number>>; // declared actions
    deltas: Readonly<Record<string, number>>; // relative input, consumed once
    pressed: Readonly<Record<string, boolean>>; // rising edges, cleared after update
    ui: { publish(value: Json): void }; // bounded JSON to a separate UI frame
}

interface PortableGame {
    prepare(): Promise<void>;
    enter(continuity: Continuity): Promise<void> | void;
    update(seconds: number): void;
    suspend(): Promise<Json> | Json;
    restore(snapshot: Json): Promise<void> | void;
    dispose(): Promise<void> | void;
    inspect(): Record<string, Json>; // game-specific facts for checks
}

// The world module's default export.
type GameFactory = (context: GameContext) => PortableGame;
```

What each function is for:

| Function     | The host calls it                               | The world must                                                        |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| `prepare()`  | Once, in the background, before the world shows | Load and build everything, compile shaders. Nothing is visible yet.   |
| `enter(c)`   | When the world becomes the one on screen        | Place the avatar, camera and party from `Continuity`.                 |
| `update(dt)` | Every frame. The host owns the clock.           | Advance the rules by `dt` seconds and draw one frame.                 |
| `suspend()`  | When the world leaves the screen                | Stop, and return its state as plain JSON.                             |
| `restore(s)` | To put state back                               | Accept JSON from `suspend()`, including one made by an older version. |
| `dispose()`  | When the world is finished with                 | Free what it made.                                                    |
| `inspect()`  | Whenever a check or an agent asks               | Return a few facts about itself (score, position). No side effects.   |

Travel between two worlds already uses it, in the private SDK repo: prepare
the next world, suspend the previous one, enter the next with `Continuity`,
dispose the previous. A failure restores the previous world.

**Additions this record proposes for live editing:**

-   `export const stateVersion = n` on the module. Raise it when the state's
    shape breaks. The host then starts the new version with fresh state.
-   `snapshot(): Json`, like `suspend()` but with no side effects, for
    rewind.
-   `ctx.keep(key, inputs, build, dispose?)`: the host hands the same object
    to the next version when `key` and `inputs` are unchanged.
-   `ctx.params`: data the world reads every frame. Changing it needs no
    swap.

All four are implemented in the prototype
(`docs/plans/live-swap-prototype/rt/live.js`) and used by its sample worlds.

## How other platforms decided

Platforms split by what they sell. Engine platforms sell one shared world,
portals sell distribution, and both now build for agents.

| Platform                                                                                                                                                                                              | Model         | What it shows                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Roblox](https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic)                                                                                                                       | Engine        | Studio went "agentic" in April 2026: a planning mode, a playtesting agent and a built-in MCP server for outside coding agents. 44% of its top 1,000 creators use AI tools.           |
| Meta Horizon ([UploadVR](https://www.uploadvr.com/meta-horizon-studio-upgrade-ai-assistant-horizon-worlds/), [RuntimeWire](https://runtimewire.com/article/meta-horizon-create-studio-ai-game-tools)) | Engine        | Meta is replacing the Unity runtime with its own engine, and its assistant generates worlds, assets and TypeScript. In September 2026 it opened a waitlist for prompt-to-game tools. |
| [YouTube Playables](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability)                                                                                      | Engine-less   | No engine is named. Limits instead: a 30 MiB first bundle and a 512 MB heap.                                                                                                         |
| [Discord Activities](https://docs.discord.com/developers/activities/how-activities-work.md)                                                                                                           | Engine-less   | A web app in an iframe. The SDK talks to Discord over `postMessage`.                                                                                                                 |
| [CrazyGames](https://docs.crazygames.com/requirements/technical/)                                                                                                                                     | Engine-less   | Limits on size and on time to gameplay (20 s).                                                                                                                                       |
| [Rosebud](https://lab.rosebud.ai/blog/how-does-vibe-coding-work-for-games)                                                                                                                            | AI game maker | Generates plain JavaScript and three.js that runs in the browser.                                                                                                                    |
| [Vibe Jam 2026](https://vibejam.com/2026/press)                                                                                                                                                       | Open jam      | 945 web games in a month, each with at least 90% AI-written code. Any engine was allowed and three.js was recommended.                                                               |

Three things follow.

1.  **Engine platforms keep the engine for the platform's needs, not the
    agent's.** Safety, shared avatars, one look and every device come from
    it. Engine-less has to earn those another way.
    [What Oncyber has to own](#what-oncyber-has-to-own-whatever-is-chosen)
    lists how.
2.  **What Roblox gives its agents is sight.** Logs, a model of the world to
    query and a test player. That part is worth copying, and it needs no
    engine.
3.  **Engine-less portals already run at scale on rules alone.** A sandbox, a
    small SDK and measured limits.

Vibe Jam is the closest outside evidence. One judge, a game developer, called
this year's quality "much higher level than last year". He expects entries to
match many game developers within a year, though not the top 20%
([levels.io](https://levels.io/vibe-jam-2026-winners-quality)).

## What agents can build alone today

Agents write whole games best when they pick their own stack. They fail at
knowing whether the result works.

| Benchmark                                                             | Setup                                                                | Best result                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| [GameXpert-Bench](https://arxiv.org/html/2608.21833v1), Aug 2026      | 97 browser games from one brief each. The agent picks its own stack. | 79.7 of 100, with completeness at 94.4 (Claude Opus 5) |
| [GameCraft-Bench](https://huggingface.co/papers/2606.17861), Jun 2026 | 140 games built inside Godot                                         | 41.5%                                                  |
| [CEGame-Bench](https://arxiv.org/abs/2610.26098), Oct 2026            | Full games in Defold, Godot, Roblox Studio, Unity and Unreal         | The game reaches its ending in 16% of runs             |
| [UnityBench-Mini3D](https://arxiv.org/html/2610.35980v1), Oct 2026    | 77 Unity editor tasks                                                | 72.5%                                                  |
| [GameDevBench](https://huggingface.co/papers/2602.11103), Feb 2026    | 132 tasks drawn from tutorials                                       | 54.5%                                                  |

The scoring differs between them, so this is not a controlled comparison. The
pattern still matches Oncyber's own two builds. Free web code is all text the
model can read. Engines add editor state, scene wiring and asset references.
In Unity, scene structure and wiring cause 16 to 29% of failed checks.

Where agents fail, in every benchmark:

-   **They don't look.** Some agent setups never capture a rendered frame
    (UnityBench). Image and video feedback lifted one model from 33.3% to
    47.7% (GameDevBench). A playtest-and-repair skill added 14 to 24 points
    (CEGame-Bench).
-   **Built but broken.** 5.3% of coded features failed when run. Over half
    of those failed at load or crashed (GameXpert-Bench).
-   **3D and layout.** 3D games scored 5.8 points below 2D ones. The
    interface was misaligned in 15% of runs (GameXpert-Bench).

Can agents bootstrap a bespoke engine for one game? Yes.

-   Sixteen Claude agents wrote a 100,000-line C compiler that builds Linux,
    in two weeks, for under $20,000
    ([Anthropic](https://anthropic.com/engineering/building-c-compiler)).
-   Cursor's agents wrote a browser of over a million lines in about a week
    ([Cursor](https://cursor.com/blog/scaling-agents)).
-   A game's own engine is far smaller than either.
-   [METR](https://metr.org/time-horizons/) sees no sign that the length of
    task agents can finish is growing more slowly.

The compiler write-up credits its tests above everything else. The verifier
must be "nearly perfect, otherwise Claude will solve the wrong problem".

So the small SDK should grow eyes and a referee, not more APIs: run the
world, look at it, press keys, read the logs, check it against limits.

The benchmark papers were read through summaries of their pages. Check a
figure against the paper before quoting it publicly.

## What Oncyber has to own whatever is chosen

Without an engine, Oncyber can't see inside a world, so everything it
guarantees has to sit at the boundary.

The contract in one line: the world owns everything inside the frame. Oncyber
owns the frame, the clock when the world uses the lifecycle, and the checks.

| What engine platforms get from the engine | Where engine-less gets it                               | State on 14 November 2026                                                              |
| ----------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Code that can't hurt visitors or the site | The sandboxed frame and its network rules               | Built, in this repository and in the private SDK repo                                  |
| Identity, friends, rooms, voice, chat     | The SDK and the page around the frame                   | Built in the private SDK repo. Not in this repository's bridge yet.                    |
| Performance on every device               | Measured limits per device at publish, shown as labels  | Designed, not built. See [Performance checks](#performance-checks-design-summary).     |
| Controls on keyboard, touch and VR        | Input actions the world declares and the host maps      | Declared actions are in the lifecycle (`input`, `deltas`, `pressed`)                   |
| Seamless travel, pause, live edits        | The lifecycle                                           | Travel is built in the private SDK repo. Live edits are prototyped in this repository. |
| Thumbnails and moderation                 | Screenshots the host takes through the lifecycle        | Not built                                                                              |
| Avatars that travel with you              | Avatar data from the SDK, plus an optional three.js kit | Weakest point. See [Risks](#risks-and-what-would-change-this-decision).                |
| Remixing someone's world                  | Fork its source files, which a draft already keeps      | Not built                                                                              |
| Worlds that keep working                  | A world is a static bundle that pins its own three.js   | True today                                                                             |

The last row is the one an engine can't match. The gallery engine needs
`three/compat.js` to keep old spaces lit correctly between three r153 and
r187. A game engine would owe that to every world on every release. A
self-contained bundle owes it to nobody.

### Performance checks design, summary

The full design is a private document. This is the part that matters here.

-   **The loop.** An agent runs a `check` command locally as often as it
    likes. `publish` runs the same check on Oncyber's side, where the numbers
    are trusted, and answers with a JSON report. The agent fixes and
    publishes again.
-   **Two stages.** A static scan of the built folder (bytes, textures,
    meshes), a few seconds, no GPU. Then a run in headless Chromium at each
    profile's screen size, about a minute, that waits for the world's ready
    message, walks a short camera path and records frames.
-   **Three profiles: desktop, phone, Quest.** Each gets pass, warn or fail.
    Results label a world; they don't block it. A world that fails phone
    still opens on a phone with a "may run slowly" note. Only worlds that
    pass Quest are offered in VR.
-   **What blocks publishing on every profile:** more than 10,000 files or
    200 MB in all, no first frame within 30 s, or an uncaught error before
    ready.
-   **Profiles live in one versioned file** (`quality-profiles.json`), and
    every report names the version it used.

Starting budgets. All are first guesses to tune with real visitor data:

| Budget                            | Desktop        | Phone          | Quest (VR)       |
| --------------------------------- | -------------- | -------------- | ---------------- |
| Frame rate held at p95            | 30 fps         | 30 fps         | 72 fps (13.9 ms) |
| Bytes before first frame          | 25 MB          | 10 MB          | 15 MB            |
| Total download                    | 80 MB          | 40 MB          | 40 MB            |
| Time to first frame               | 8 s at 20 Mbps | 8 s at 10 Mbps | 8 s at 20 Mbps   |
| Triangles on screen               | 500k           | 150k           | 150k             |
| Draw calls                        | 300            | 150            | 100              |
| Texture memory                    | 512 MB         | 192 MB         | 256 MB           |
| Largest texture                   | 4096 px        | 2048 px        | 2048 px          |
| KTX2 textures                     | Warn without   | Warn without   | Required         |
| Meshopt or Draco meshes           | Warn without   | Warn without   | Required         |
| LODs on meshes over 20k triangles | Optional       | Warn without   | Required         |

The report an agent reads. Each problem says what to change, in words an
agent can act on without reading docs:

```json
{
    "world": "my-world",
    "version": 7,
    "profiles": "2026-11-14",
    "preview": "https://oncyber.io/spaces/my-world?v=7",
    "blocking": false,
    "results": { "desktop": "pass", "phone": "warn", "quest": "fail" },
    "metrics": {
        "bytesTotal": 31200000,
        "bytesBeforeFirstFrame": 12400000,
        "firstFrameMs": { "desktop": 3100, "phone": 6900 },
        "triangles": { "peak": 182000, "median": 96000 },
        "drawCalls": { "peak": 214, "median": 140 },
        "textureMemoryMB": 238,
        "frameMs": { "p50": 9.1, "p95": 17.8, "vsReference": 1.9 }
    },
    "problems": [
        {
            "code": "DRAW_CALLS_HIGH",
            "profiles": ["phone"],
            "severity": "warn",
            "viewpoint": "spawn",
            "detail": "214 draw calls, budget 150",
            "fix": "Merge static meshes that share a material, or use InstancedMesh for repeated props"
        }
    ]
}
```

**One correction to that design.** For some worlds it assumes the SDK owns
the renderer and can report on it. Under the engine-less rule the SDK never
does. Two things replace that:

-   For a lifecycle world, the host can still measure frame time exactly,
    because it calls `update()` and so owns the clock.
-   For counts inside someone else's scene (draw calls, triangles, texture
    uploads), the check page injects a probe script that wraps the renderer's
    draw call and the WebGPU device. The probe runs in checks only, never for
    visitors.

## Live editing: how an update is applied

An update is a trip from version N of a world to version N+1. It reuses the
steps a visitor's travel between two worlds already takes.

```text
             before the swap        the swap, under 1 ms    after the swap
             ---------------        --------------------    --------------
version N    playing at 60 fps  ->  suspend() returns   ->  kept suspended for
                                    its state               a 20-frame trial,
                                                            then disposed

version N+1  loads and runs     ->  enter(), then       ->  playing
             prepare() in the       restore(state)
             background

The way back, if N+1 throws at any point up to the end of the trial:

version N    restore(state), then plays on
version N+1  disposed
```

Play never stops. The swap itself takes under a millisecond, and the wait
before it happens in the background.

1.  The new code loads and runs `prepare()` in the background. The old
    version keeps playing.
2.  Between two frames, the old version's `suspend()` returns its state as
    plain data.
3.  The new version gets `enter()` and `restore(state)`, then plays the next
    frame.
4.  The old version stays suspended for a short trial (20 frames in the
    prototype), then is disposed.
5.  If anything throws before or during the trial, the old version takes its
    state back and carries on.

**Reload, rewind or keep playing?** The host decides on every update. It
tries the cheapest safe option and checks the result. The agent declares
nothing.

| What changed                                                         | What the host does                                                      | What the player sees                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Only data: numbers, colours or text the world reads from `params`    | Passes the new values                                                   | The change on the next frame               |
| Code, same state shape                                               | Swaps and carries the state                                             | Play continues with the new look or rules  |
| Code, new state shape (`stateVersion` raised, or `restore()` throws) | Swaps with fresh state at the same position                             | A restart in place                         |
| Rules, and a replay is asked for                                     | Restores a snapshot and replays the recorded input through the new code | The last seconds again under the new rules |
| A syntax error, or a throw in `prepare`, `enter` or the trial        | Rejects it or rolls back                                                | Nothing. The agent gets the error.         |
| The world has no lifecycle                                           | Reloads the frame                                                       | A reload                                   |

**Every update returns a structured result**, so an agent can act on it with
nobody watching. In the prototype it is this message from the frame:

```json
{
    "tag": "live",
    "kind": "applied",
    "seq": 4,
    "changed": ["lib/player.js"],
    "outcome": "swapped",
    "ms": 214.3,
    "loadMs": 6.1,
    "prepareMs": 201.7,
    "commitMs": 0.4,
    "framesDuring": 13,
    "maxFrameGapMs": 16.8,
    "keepHits": 4,
    "keepMisses": 0
}
```

| `outcome`             | Meaning                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `mounted`             | First version of the world is playing.                                                    |
| `swapped`             | New version is playing with the old state. A `committed` or `reverted` message follows.   |
| `swapped-state-reset` | New version is playing with fresh state, because `stateVersion` changed.                  |
| `rejected`            | The code did not load (`stage: "load"`, with `error`). The old version never stopped.     |
| `rolled-back`         | `prepare` or `enter` threw (`stage`, `error`). The old version carries on with its state. |
| `superseded`          | A newer edit arrived while this one was preparing, so this one was dropped.               |

After a swap, `{"kind":"committed","version":n}` says the trial passed, and
`{"kind":"reverted","error":"…","toVersion":n}` says the new version threw
during the trial and the old one is back.

This also answers whether a world can update while its code is still being
written. It can. Half-written code is rejected in milliseconds, and a burst
of edits collapses to the latest text.

**Rewind uses the same parts.** The host takes a snapshot every half second
(every 30 frames, keeping the last 40) and records input, so it can restore
any snapshot and replay input forward.

**What a world needs to be editable live.** It keeps its state as plain data,
returns it from `suspend()` and accepts it in `restore()`. To make edits
faster, it can ask the host to keep costly things between versions with
`ctx.keep(key, inputs, build)`.

**Drafts need no bundler and no server.** The frame receives source text,
turns it into blob modules itself and resolves `three` through an import map.
The frame has to do this itself: a blob URL belongs to the origin that made
it, and the frame's origin is opaque, so the page can't build modules for it.
TypeScript can be stripped in the frame too, as
[es-module-shims](https://cdn.jsdelivr.net/npm/es-module-shims@2.8.1/README.md)
does. A bundler runs only at publish.

## Prototype: what was built and what it showed

Code and raw results are in
[`live-swap-prototype/`](live-swap-prototype/README.md). A 330-line host
inside a sandboxed frame live-swapped a three.js r187 world on WebGL2 and
WebGPU. Every failure case rolled back.

| File              | What it is                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `rt/live.js`      | The draft host. Runs inside the frame. Loads, prepares, swaps, trials, rolls back, snapshots, records input, rewinds, replays. |
| `rt/runtime.html` | The frame page: an import map for `three`, then `live.js`.                                                                     |
| `host/index.html` | The parent page: mounts the frame with `sandbox="allow-scripts"` and relays messages.                                          |
| `world/`          | Sample world that keeps geometry and materials between versions.                                                               |
| `world2/`         | Same world, but it keeps the whole static scene between versions.                                                              |
| `drive.cjs`       | Playwright driver. Starts two local servers (ports 8200 and 8201), runs the tests, prints JSON and writes `results.json`.      |
| `results/`        | JSON from the runs quoted below.                                                                                               |

### Run it in a cloud container

Checked on 14 November 2026 in a cloud container: 4 CPU cores, no GPU, Node,
and the pre-installed Playwright Chromium 153. `manual`, `webgpu` and
`webgl2` all ran with no errors and every outcome as in the tables below.

```sh
cd docs/plans/live-swap-prototype
./setup.sh                    # once: copies three.js out of vendor/three/
node drive.cjs manual         # rewind and replay, about 10 s
node drive.cjs webgpu         # swap cases, burst, 30-swap memory check
node drive.cjs webgl2         # same on WebGL2, presenting to a canvas
WORLD=world2 node drive.cjs granularity   # edit time when the scene is kept
WORLD=world2 node drive.cjs shot          # screenshots before and after swaps
```

What to expect in a container with no GPU:

| Run      | Outcomes | Timings                                                                                                                            |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `manual` | Correct  | Not a timing test.                                                                                                                 |
| `webgpu` | Correct  | Match the recorded ones: 60 fps, edits live in 0.26 to 0.39 s, longest frame gap 16.8 ms. It draws off screen.                     |
| `webgl2` | Correct  | Slow: about 10 fps and 6 to 8 s per edit, because the CPU draws every frame to a canvas. Use it for pixel checks, not for timings. |

-   Don't install Playwright again. `require("playwright")` works as is.
-   The driver needs ports 8200 and 8201 free on `127.0.0.1`.
-   The driver writes `results.json` and `shot-*.png` into the folder. Both
    are ignored by git. Set `OUT=name.json` to write elsewhere.
-   At the end of a software `webgpu` run, the pixel check reports
    `readback timed out` and the "full reload" time is inflated by that wait
    (62 s here). Both are the known software WebGPU limit below, not a
    failure.
-   On a machine with a GPU:
    `GPU=real PW_CHANNEL=chrome HEADLESS=0 node drive.cjs webgpu`. A cloud
    container can't do this, so real-GPU timings need a person.

### Messages the frame understands

The parent page posts these to the frame:

| Message                              | Effect                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `{ type: "files", files, opts? }`    | New source text, as `{ "game.js": "…", "lib/player.js": "…" }`. Starts an update. `opts.replayFrames` asks for a replay after the swap. |
| `{ type: "params", params }`         | A data-only change. No swap.                                                                                                            |
| `{ type: "action", action, value }`  | Sets an input action, for example `moveX` to `1`.                                                                                       |
| `{ type: "step", n }`                | Advances `n` frames. Used with `manual=1`, where the clock only moves on request.                                                       |
| `{ type: "rewind", frames, replay }` | Restores an earlier snapshot, and replays input if `replay` is true.                                                                    |
| `{ type: "probe", id, pixels }`      | Asks for a report: `inspect()`, frame cost, kept keys, GPU object counts, heap, and a pixel summary if `pixels` is true.                |

The frame posts back messages tagged `live`, with `kind` one of `booted`,
`applied`, `committed`, `reverted`, `params`, `stepped`, `rewound`, `probe`
and `error`.

Query flags on the frame URL: `backend=webgl2|webgpu`, `present=0|1`,
`manual=1`, `freeze=1`, `nokeep=1`, `size=WxH`.

### Results

The setup was headless Chromium 153 on a software GPU. The world has 24
shader materials, 300 props, 3,000 instanced trees, a player and coins. The
frame is fully sandboxed: an opaque origin, no storage and no way to reach
the page.

| Test                                                                   | Result                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A visual edit and a logic edit                                         | Live in 0.18 to 0.33 s. The old version held 60 fps, and the longest frame gap was 16.8 ms. |
| The swap step alone                                                    | 0.1 to 0.7 ms                                                                               |
| A syntax error                                                         | Rejected in 7 ms. The world kept playing.                                                   |
| A throw in `prepare`, in `enter`, or on the fifth frame after the swap | Rolled back each time, with state intact                                                    |
| A new state field meeting an old snapshot                              | Adopted                                                                                     |
| `stateVersion` raised                                                  | A restart in place with fresh state                                                         |
| A data-only change                                                     | Speed went from 6 to 18 units a second with no swap                                         |
| Eight edits sent back to back                                          | One dropped as outdated, one swap. The latest was live in about 0.4 s.                      |
| Rewind 150 frames and replay the same code                             | The same end state                                                                          |
| Change the jump, then replay 150 frames through the new code           | The jump peak went from 1.17 to 2.93, with the same position and clock                      |
| Rules that call `Math.random`                                          | The host detected that the replay diverged                                                  |
| A full reload, for comparison                                          | 0.5 to 1.1 s, and the state is lost                                                         |

One finding changed the advice. On a bigger world (96 materials, 600 props),
what the world keeps decides both edit time and memory.

| What the world keeps between versions | Typical prepare time                           | Heap after 30 edits, from 14 MB |
| ------------------------------------- | ---------------------------------------------- | ------------------------------- |
| Nothing                               | About 640 ms                                   | Not measured                    |
| Geometry and materials (`world/`)     | 550 to 680 ms                                  | 52 MB                           |
| The whole static scene (`world2/`)    | 7 ms for a logic edit, 34 ms for a colour edit | 19 MB                           |

Keeping GPU objects alone saved nothing. three.js rebuilds its shader graphs
for each new scene and set of lights, and it holds on to the old ones. An
agent can find this without a rule from Oncyber, because the host reports
prepare time after every edit.

GPU object counts stayed flat across 30 edits in every run.

### Limits of the test

-   Software rendering, one world and one browser.
-   Software WebGPU loses its device when it presents to a canvas, so WebGPU
    runs drew off screen (`present=0`). Only the first pixel readback
    resolves there, so pixel checks use the WebGL2 backend.
-   Real GPUs compile shaders at other speeds. Prepare runs in the
    background, so that changes the wait for an edit, not the smoothness.
-   Not tried with multiplayer state.

### What the prototype leaves out

The prototype proves the swap. It is not the product. Anything built from it
has to close these gaps:

-   **Sandbox.** It uses `sandbox="allow-scripts"`. The content host uses
    `allow-scripts allow-pointer-lock` with a Permissions Policy,
    `credentialless` and no referrer. Use the content host's settings.
-   **Message safety.** It posts with target origin `*` and trusts any
    message from its parent. It has no session nonce, size limit or rate
    limit. The content host's bridge has all of these
    (`ContentMessageGate`). Draft messages need the same care.
-   **Context.** Its `ctx` has no `services` (identity, assets, host calls).
    It adds three test-only things that are not in the lifecycle:
    `graphics.createRenderer`, `ctx.own` and `ctx.render`.
-   **Modules.** Its loader rewrites only static relative imports
    (`from "./x.js"`) with a regular expression. No bare side-effect
    imports, no dynamic `import()`, no TypeScript.
-   **Libraries.** Its import map points at `127.0.0.1:8201`. A real frame
    needs three.js served with `Access-Control-Allow-Origin: *`.
-   **Continuity.** It builds `Continuity` from `inspect()` fields named `x`,
    `y` and `z`. A real host gets the avatar and camera from the page.
-   **Snapshots.** It falls back to `inspect()` when a world has no
    `snapshot()`.

## Where the earlier proposal can be better

The earlier proposal had the right frame: engine-less, a sandbox and a thin
contract. This record changes four parts of it.

1.  **Swap levels declared per module (visual, logic, rewind, reload).** Drop
    them. They are a small engine concept the agent must learn, and a wrong
    label fails silently. State does not live at module boundaries either.
    One swap of the whole version, checked by the host, covers all four.
2.  **Bundling in the browser.** Drafts don't need it. Native modules and an
    import map are enough. WebContainers would also need a commercial licence
    for production use ([StackBlitz](https://webcontainers.io/enterprise)).
3.  **A new runtime contract.** One exists: the lifecycle above, which
    already has travel with rollback. Live editing adds four small things:
    `stateVersion`, a `snapshot()` with no side effects, `ctx.keep` and
    `ctx.params`.
4.  **Rewind for every world.** Rewind needs honest snapshots. Replay through
    new code also needs rules that give the same result twice. Offer both,
    detect when they don't hold, and say so.

It also treated the live update as the hard part. The prototype says that is
the easy part. The hard part is the agent's feedback loop.

Other tools point the same way. State survives an update when it is plain
data held outside the code being replaced, and the tool has to fall back
loudly.

| Tool                                                                                                                             | How it updates running code                                                                                             | Lesson                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Vite](https://vite.dev/guide/api-hmr)                                                                                           | A module opts in with `accept` and passes state through `hot.data`.                                                     | It works because frameworks write that code, not app authors.           |
| [React Fast Refresh](https://reactnative.dev/docs/fast-refresh)                                                                  | Keeps state "only if it's safe to do so", and resets it when hook order changes. Recovers from errors on the next edit. | No labels from the author. The tool decides and falls back.             |
| [Flutter](https://docs.flutter.dev/tools/hot-reload)                                                                             | Hot reload keeps state but does not rerun `main()` or `initState()`.                                                    | Some edits show nothing, so a restart has to be one key away.           |
| [PlayCanvas](https://developer.playcanvas.com/user-manual/scripting/hot-reloading)                                               | Each script writes `swap(old)`, copies its state and re-attaches its listeners by hand.                                 | This is the per-module design. Every script author has to get it right. |
| [Bevy 0.17](https://bevy.org/news/bevy-0-17/)                                                                                    | Hot-patches systems. "If the system's parameters change, it will not be hot reloaded."                                  | Partial patching has edges the author must know.                        |
| [Tomorrow Corporation](https://linen.futureofcoding.org/t/18768900/the-tooling-here-is-next-level-bret-victor-would-be-proud-ht) | Time travel from heap snapshots taken at frame boundaries.                                                              | Rewind is cheap when state is one block of data.                        |

## Risks and what would change this decision

The main risk is not what agents can build. It is worlds that feel unrelated
to each other.

-   **Avatars.** Each world draws visitors itself. If many skip it, "your
    avatar travels with you" weakens. Start with an optional avatar kit, a
    check and a label on the listing. Then measure how many worlds use them.
-   **Phones and Quest.** Agent code is often careless with draw calls and
    textures. The publish checks label worlds and don't block them. Expect
    many "may run slowly" labels at first.
-   **Edit times on real GPUs.** Not measured yet. The worst case is a longer
    wait for an edit, not a stutter.
-   **Memory in long edit sessions.** A world that rebuilds its scene on
    every edit grows the heap. The host should reload the frame past a limit.
-   **Dishonest snapshots.** A world can return only part of its state. The
    trial catches crashes, not slow drift. Comparing a replay catches some of
    it.
-   **Moderation.** The host sees pixels, not content. Screenshots and
    reports are the tools.
-   **Two sandbox designs.** This repository uses an opaque frame. The
    private SDK repo uses a subdomain per world. The prototype ran in the
    stricter opaque one. Pick one before building the draft host for real
    visitors.
-   **Multiplayer during a live edit.** Each client would swap locally while
    shared room state stays on the server. This is untested.

What would change the decision:

-   **Visitors leave because worlds feel inconsistent**, and kits and labels
    don't fix it. The answer is stricter checks and better kits. It is still
    not an engine.
-   **People should build by dragging things, with no agent.** That needs a
    known scene format. Gallery spaces already cover it.
-   **World models mature.** Project Genie caps a session at 60 seconds, and
    Google says it "is not a game engine"
    ([The Register](https://www.theregister.com/2026/01/29/googles_project_genie_ai/)).
    A sandboxed frame could host such a world later. An engine would not
    help.

## Build order

Each step is usable alone, and the first three are small. The last column
says what a cloud agent with only this repository can do.

| Step | What                                                                                                                                                                                                      | From this repository alone                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **One lifecycle.** Publish the lifecycle as the single contract, with the four additions. Templates and the agent guide produce it by default. Worlds without it still run.                               | Partly. The types and docs can be written here. The templates and agent guide are in the private SDK repo.                                        |
| 2    | **Draft host.** Turn the prototype into a product inside the content frame: apply, trial, rollback, snapshots and the structured result.                                                                  | Yes. Start from `live-swap-prototype/rt/live.js` and close the gaps listed under [What the prototype leaves out](#what-the-prototype-leaves-out). |
| 3    | **Local loop first.** A CLI `dev` command watches a folder and live-swaps it into the browser. Claude Code, Codex or Cursor get live editing with no new interface. The strongest agents run there today. | Needs a decision. The world CLI is in the private SDK repo. `scripts/world-cli.mjs` here is for gallery spaces.                                   |
| 4    | **Eyes for the agent.** Screenshot, logs, `inspect()`, play input for N frames, step and rewind. Offer them in the CLI and as MCP tools, and reuse them in `check`.                                       | Mostly. The prototype already has `probe`, `action`, `step` and `rewind`. Where the CLI lives is the same open decision as step 3.                |
| 5    | **Publish checks and fixed versions.** As summarised under [Performance checks](#performance-checks-design-summary). Drafts change freely. A release never changes.                                       | Partly. There is no world publishing flow here yet, and where the server-side browser run lives is undecided.                                     |
| 6    | **Vibecoding on the site.** Chat, editor and preview on the same draft host, with the person's own model key, as contributor mode does. A one-time key can let an outside agent edit the same draft.      | After step 2. Contributor mode is on branch `claude/project-thread-ax5gx3`, not on `main`.                                                        |
| 7    | **Live rooms.** Send a new release to visitors in a room with the same swap. Shared drafts come after.                                                                                                    | After steps 2 and 5. Untested with multiplayer.                                                                                                   |
| 8    | **Kits by demand.** Avatars, controls, touch and VR input as optional libraries. Track which worlds use them.                                                                                             | Later.                                                                                                                                            |

Drafting needs no server per person, unlike the contributor sandboxes plan,
which gives each contributor a short-lived dev server. A world is static
files, and the swap runs in the person's own tab.

### A good first piece of work

A dev page where a person edits a world on their own GPU, as the first test
of step 2. It would also replace the software-GPU timings above with real
ones. Suggested shape, to confirm with whoever gave you the task:

-   A page under `frontend/pages/dev/`, beside the other dev pages there.
-   The world runs in a frame with the content host's sandbox settings, not
    the prototype's.
-   The page has an editor for the world's source files, sends each edit to
    the frame, and shows the structured result and timings after every edit.
-   The sample world from `live-swap-prototype/world2/` is the default
    content.
-   Pure logic (the module graph, the apply and rollback transitions, the
    snapshot ring) sits in its own files with Jest tests beside them. See
    [`docs/state-machines.md`](../state-machines.md).
-   The prototype's failure cases (syntax error; throws in `prepare`, in
    `enter` and during the trial; a burst of edits; `stateVersion` raised)
    pass against the new code in a browser.

### Decisions a person has to make

A cloud agent should ask, not choose, on these:

-   Which sandbox design: this repository's opaque frame, or a subdomain per
    world.
-   Where the world SDK and its CLI live: stay in the private SDK repo, or
    move into this one.
-   Where drafts and releases are stored and served from.
-   Where the server-side check run lives. It needs Chromium and about a
    minute per publish.
-   Whether a failing profile hides a world from that device or only labels
    it. This record assumes it labels, except for VR.

## Rules for work in this repository

Read [`AGENTS.md`](../../AGENTS.md) first. The ones that bite here:

-   The product is Oncyber. Don't add other product or SDK names to code,
    docs or the interface.
-   Branch off `main` and land through a pull request. Before opening one,
    share a test link (a Vercel preview, or steps to run it locally) and wait
    for it to be tried.
-   New files are TypeScript, formatted with Prettier (four spaces, 80
    columns). Tests sit beside the code.
-   Run `pnpm -C frontend test <changed tests>` and
    `pnpm -C frontend check:types` for what you touch.
-   For rendering changes, try it in a browser and say which one.
-   This repository is public. Don't commit keys, visitor data or private
    documents.

## Sources

Everything below was read on 14 November 2026.

**In this repository**

-   [`docs/content-host.md`](../content-host.md),
    `frontend/features/content-host/` and
    `frontend/public/oncyber-content.js`
-   [`live-swap-prototype/`](live-swap-prototype/README.md) and its
    `results/`

**Not in this repository** (summarised above)

-   The private SDK repo: its README, strategy and blueprint notes, the
    portable runtime doc, the runtime source, the SDK types and the agent
    guide.
-   The January engine: its guide, and a file and line count of its source.
-   Two private documents: publish-time performance checks, and the
    contributor sandboxes plan.

**Platforms**

-   [Roblox Studio is going agentic](https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic),
    [Meta Horizon Studio](https://www.uploadvr.com/meta-horizon-studio-upgrade-ai-assistant-horizon-worlds/),
    [Meta's prompt-to-game waitlist](https://runtimewire.com/article/meta-horizon-create-studio-ai-game-tools)
-   [YouTube Playables requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability),
    [How Discord Activities work](https://docs.discord.com/developers/activities/how-activities-work.md),
    [CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/)
-   [Rosebud on vibe coding games](https://lab.rosebud.ai/blog/how-does-vibe-coding-work-for-games),
    [Vibe Jam 2026 press page](https://vibejam.com/2026/press),
    [Vibe Jam 2026 winners](https://levels.io/vibe-jam-2026-winners-quality),
    [Project Genie](https://www.theregister.com/2026/01/29/googles_project_genie_ai/)

**What agents can build**

-   [GameXpert-Bench](https://arxiv.org/html/2608.21833v1),
    [GameCraft-Bench](https://huggingface.co/papers/2606.17861),
    [CEGame-Bench](https://arxiv.org/abs/2610.26098),
    [UnityBench-Mini3D](https://arxiv.org/html/2610.35980v1),
    [GameDevBench](https://huggingface.co/papers/2602.11103)
-   [Building a C compiler with a team of parallel Claudes](https://anthropic.com/engineering/building-c-compiler),
    [Scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents),
    [METR time horizons](https://metr.org/time-horizons/)

**Live updates**

-   [Vite HMR API](https://vite.dev/guide/api-hmr),
    [React Fast Refresh](https://reactnative.dev/docs/fast-refresh),
    [Flutter hot reload](https://docs.flutter.dev/tools/hot-reload),
    [PlayCanvas hot reloading](https://developer.playcanvas.com/user-manual/scripting/hot-reloading),
    [Bevy 0.17](https://bevy.org/news/bevy-0-17/)
-   [Tomorrow Corporation tooling thread](https://linen.futureofcoding.org/t/18768900/the-tooling-here-is-next-level-bret-victor-would-be-proud-ht),
    [es-module-shims](https://cdn.jsdelivr.net/npm/es-module-shims@2.8.1/README.md),
    [WebContainers licensing](https://webcontainers.io/enterprise)
