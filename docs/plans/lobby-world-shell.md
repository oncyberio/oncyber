# Plan: one world shell for lobby trips, and a cached engine

Status: proposal, 10 November 2026. Step 1 of the recommendation (prefetch at
lobby idle) is built, 11 November 2026; nothing else in this plan is built yet
except what "Already in place" lists.

## The problem in one paragraph

Every trip from the lobby opens the destination as a brand-new web page inside
a hidden frame. That page starts from zero: it asks the server for the page,
downloads and runs the whole app again (the Next.js runtime, every provider,
the 3D engine, three.js), creates a second graphics device, compiles its
shaders and only then starts on the world itself. In the 12 October
development run, about 2.1 s of the 2.5 s it took the frame to be "prepared"
was this start-up, not the world. When the visitor comes back to the lobby the
frame is thrown away, so the next trip pays the same start-up again, even to
the same world. The only things shared between trips today are files the
browser already keeps: its normal HTTP cache, and the engine's own
`room-v1` / `hdr_v1` caches for room models and sky images.

## What the frame redoes on every trip

- **The page request.** The server runs `getServerSideProps` for the space
  (exhibit, destination, access rules) and sends HTML that may not be stored.
- **All of the app's JavaScript, parsed and run again.** Downloads usually come
  from the browser cache, but parsing and running them happens every time.
  This includes the app shell (`_app.tsx` providers, account and wallet
  context, analytics tags) that the lobby already has running.
- **The engine.** `Exhibit3DGate` loads `DisplayScene`, which loads `Scene3D`,
  the renderer and `world3D`. Each trip creates a new WebGPU (or WebGL2)
  device and compiles the materials of that world.
- **Workers and decoders.** The baker, floor and room-texture workers start
  again; Draco and Basis decoders are fetched (from cache) and initialised
  again.
- **The world.** The room model and sky come from `room-v1` / `hdr_v1` when
  present, but are parsed and uploaded to the graphics card again. Artworks,
  avatars and portals load as on a direct visit.
- **Side work.** Fonts are preloaded again and avatar lookups repeat. Tracking
  tags are being removed from the frame by separate work.

## Already in place

- Next serves its own built files (`/_next/static/...`, where the engine and
  three.js end up) with names that change whenever their content changes, and
  tells browsers to keep them for a year.
- Separate work in `frontend/next.config.js` (another worker, this round) adds
  long-lived cache headers for the fixed-name folders under `public/`:
  `/draco`, `/basis`, `/libs/basis`, `/fonts`, `/lobby`, `/models`,
  `/envmaps`, `/textures` for an hour plus a day of background refresh, and a
  year for hashed lobby motion packs. This plan builds on that and does not
  change it.
- A network-only warm-up at selection (room description and low-detail room
  model into `room-v1`, plus a router prefetch of the route's scripts) was
  built and measured this round but left out, because in local measurements
  it added long frames to the visible departure (see "When a trip starts
  loading" in `docs/in-app-space-navigation.md`).
- Every lobby trip now records its stages (`lobby-trip` load timings), so the
  options below can be measured on real visits.

## The options

### A. One long-lived world shell

Start one hidden frame while the lobby is idle, run the engine in it with no
world loaded, and on each trip tell that frame to load the chosen world
through the app's in-app navigation, the same way a visitor moving between
spaces at top level already reuses one paused engine.

- **Gain.** The start-up part of every trip goes away after the first: no
  page request for the app shell, no second parse of the app, no new device.
  Up to about 2.1 s per trip in the development run, more on slow phones.
- **Cost: memory.** Two engines live side by side for as long as the lobby is
  open: the lobby's renderer and the shell's (JavaScript heap, a graphics
  device, decoder workers). On phones that may be the difference between
  working and the tab being killed. This has to be measured before deciding,
  not guessed.
- **Cost: the bridge.** The lobby and the frame speak a per-document protocol
  today: the attempt id is in the frame's URL (`__lobbyAttempt`), "dispose"
  ends the document, and `utils/lobbyDestinationBridge.ts` keeps one session
  per page. A shell needs a "load this world for attempt X" command, a clean
  reset between worlds (multiplayer room, voice, audio, embedded world frames, input
  holds, camera state), and a way to report that reset finished.
- **Cost: invalidation.** A shell started before a deploy keeps running the
  old build; it must be replaced when the app version changes, when the
  visitor signs in or out, or after an error.
- **Risk.** Pre-booting while the lobby is idle costs the lobby's main thread
  at a moment the visitor can see. It must be scheduled in idle time through
  the same loading budget the frame already uses, and stop when the visitor
  starts moving or opens a panel.

### B. Keep the last frame, paused, after Back

When the visitor returns to the lobby, pause the frame instead of throwing it
away. Going back into the same world resumes it; going to another world reuses
the paused document through in-app navigation (the same reset work as A, but
only for a frame that already exists).

- **Gain.** Re-entering the last world becomes close to instant; other worlds
  skip the app start-up like A, from the second trip on.
- **Cost.** The memory of one paused world while the visitor is in the lobby.
  Multiplayer presence, voice and audio in the paused world must be fully
  stopped so nobody appears to be in two places.
- **Risk.** Smaller than A: no pre-boot, and the frame can still be thrown
  away whenever memory runs low, the page is hidden for long, or a timer
  expires, which falls back to today's behaviour.

### C. A service worker that keeps the engine warm

A service worker is a small script the browser keeps for the site. It can
store the engine's files in a cache the site controls and answer requests for
them without the network, across visits and for every world that uses the
same engine build.

- **Gain.** The download part of the engine and three.js is gone on every
  visit after the first, even after the browser evicts its normal cache, and
  the lobby can fill that cache while idle. It does not remove parsing, device
  creation or shader compilation; only A and B do that.
- **Cost.** Build tooling to list the engine's files per release; a cache name
  per release and cleanup of old releases; care that a broken release can be
  switched off (a service worker update that unregisters itself).
- **Risk.** oncyber.io already registers one service worker at the site root,
  `public/anon-service-worker.js`, for Studio's local uploads. There can be
  only one per scope, so engine caching must be added to that script, not a
  second one. That script also currently routes every request of the site
  through itself without caching anything, which is worth fixing on its own.

### Three.js across many custom worlds

Custom worlds run in frames on their own origins and bundle their own three.js. A service worker on
oncyber.io cannot serve files to those frames, and each world subdomain is a
separate origin with its own service worker and caches. What can be shared is
the browser's HTTP cache: Chrome keys it by the top-level site and the frame's
site, so all worlds from one host opened inside oncyber.io share one
partition. If every world loads three.js from one fixed, versioned URL that
never changes (for example a path containing `0.187.0-dev.d90ae4b`, served for
a year), the first world downloads it and every later world reads it from the
cache. That needs the world template to load three.js through an
import map pointing at that URL instead of bundling it.

## Recommendation

1. **First reversible step: list and prefetch the engine at lobby idle.**
   Built without a separate build step: on the lobby's pages,
   `pages/_document.tsx` reads Next's `react-loadable-manifest.json` (which
   Next already keeps beside the server) and the build manifest, and writes
   into the HTML the files of the engine's three chunk groups (the gate's
   `DisplayScene`, `@3renderer`, `world3D.js` with `events/mediator.js`) and
   of the world routes' own scripts, minus what the lobby page loads itself
   (`features/lobby/engineChunks.ts`). Production only. Once the lobby is
   ready, idle (no trip, no avatar loading) for 4 s and the browser has a
   free moment, `useEnginePrefetch` (`features/lobby/enginePrefetch.ts`) adds
   one `<link rel="prefetch">` per file. Download only, nothing runs; never
   with Save-Data or on 2G/3G, never in a hidden tab, once per page. Each
   `lobby-trip` timeline carries `enginePrefetch` (`none`, `skipped`,
   `started`, `loaded`, `failed`: the state at selection), so the timings
   show how much of "frame mounted → prepared" it removes. Undo by deleting
   the hook call in `Lobby.tsx`. Not covered: worker scripts and the
   decoders under `public/`, which are not in those manifests.
2. **Then B, behind a flag**, measured on real visits: keep the last frame
   paused after Back, with a memory guard and a timeout.
3. **Then C**, merged into `anon-service-worker.js`, once step 1's file list
   exists, so the engine survives cache eviction and new visits.
4. **A last**, only if B's numbers and memory measurements on phones justify
   a second engine for the whole lobby session.
5. **For custom worlds**, publish versioned three.js builds at one immutable
   URL and point the world template at it.

## Appendix: what "the engine" and three.js are made of

Source (all under `frontend/`):

| Part | Files | How it is loaded |
| --- | --- | --- |
| three.js | `node_modules/three/build/three.core.js`, `three.webgpu.js`, `three.tsl.js` (from `vendor/three/three-0.187.0-dev.d90ae4b.tgz`); loaders from `three/examples/jsm/` (GLTF, Draco, KTX2) | Bundled by webpack; one copy for the app (`next.config.js` pins `three/webgpu` and `three/tsl`), shared by the lobby renderer and the engine |
| Engine gate | `components/_3DExhibit-v2/displyUI/Exhibit3DGate.tsx` | Part of the space route's own chunk |
| Engine | `components/_3DExhibit-v2/displyUI/DisplayScene.tsx` → `Scene3D.tsx` → `three/world3D.js`, `@3renderer`, `three/root`, `three/loader.js` and the rest of `components/_3DExhibit-v2/three/` | Dynamic import from the gate: its own chunk group |
| Arrival and return | `components/_3DExhibit-v2/three/utils/nativeLobbyTransitions` (with `lobbyWorldReveal.ts`, `lobbyWorldDeparture.ts`, `nativeTravelAnimation.ts`) | One lazy chunk, after the world initialises |
| Workers | `*.worker.js` files through `worker-loader` (baker, floor, room-texture donor) | Separate worker scripts |
| Decoders | `public/draco/`, `public/basis/`, `public/libs/basis/` | Fixed-name files, fetched at engine start |
| Lobby renderer | `features/lobby/webgpu/backend.ts`, `webgpu/avatarAdapter.ts` | Lazy chunks of the lobby page |

Built output:

- Scripts are written to `/_next/static/chunks/` with a content hash in the
  name and served as immutable by Next. In a development build the engine's
  main chunk is `components__3DExhibit-v2_three_world3D_js.js` (24.6 MB of
  unminified development code with source maps; not a production size). The
  production names and sizes have to be read from a production build
  (`.next/react-loadable-manifest.json` and `.next/build-manifest.json`);
  that listing is step 1.
- Where `worker-loader` writes the worker scripts in a production build, and
  whether they carry a content hash, must be checked in that same build: if
  they land outside `/_next/static/`, they do not get Next's immutable header.
- Caches the engine already reads: `room-v1` (room and avatar models, keyed by
  full URL), `hdr_v1` (sky images), `octree_v1` and `octree_meshes_v1`
  (collision data; currently unused), all in
  `components/_3DExhibit-v2/three/utils/cachestorage.js`.
