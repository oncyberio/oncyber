# Lobby Flash

Flash lets a signed-in visitor choose an image from their wallet collection and show it in a gold 3D frame in front of their avatar. The avatar plays the supplied pointing gesture and holds it until dismissed; the camera turns toward the avatar’s front once preparation completes. The local image and gesture are prepared before the selection is announced to nearby participants. Flash uses the existing lobby renderer; it creates no iframe, second canvas, or independent animation loop.

## Collection and media scope

`FlashPicker.tsx` and `useFlashNfts.ts` use the authenticated account's default/linked wallets and `fetchOwnedAssets(wallet, cursor)`. They do not substitute Studio demo wallets or insert sample NFTs. The existing provider routing supports Ethereum, Tezos, Solana, Nifty Gateway, and Counterparty identities; availability and completeness remain provider-dependent. A wallet selector appears for multiple linked wallets. Pages load on request, deduplicate by artwork ID, and expose retry/error/empty states. Requests time out after 20 seconds; provider APIs do not accept an abort signal, so closing, changing wallet, or signing out invalidates late results.

Only image/poster fields are selected, in this order: `display_image_url`, `image_preview_url`, `image_url`, `image_original_preview_url`, `image_original_url`. IPFS URLs become gateway URLs; images use the existing CORS-safe relay. NFT video, audio, HTML, and model content is not instantiated. Such NFTs can still appear if their provider supplies a usable image/poster. Broken thumbnails cannot be selected. Shared artwork metadata describes a public presentation; the multiplayer server does not verify NFT ownership.

## Pointing asset

`frontend/public/lobby/flash/source-manifest.json` records the supplied `Pointing Gesture.fbx`, its SHA-256, the reference rig hash, importer version, and normalization. The original FBX is 54,094,416 bytes. The shipped animation-only LCP1 pack is `flash.1b83425c080e.lcp`, 17,912 bytes raw (13,536 gzip / 12,593 Brotli measured offline; actual transfer compression depends on hosting).

The pack retains the authored 1.833-second take, 53 tracks including all 30 finger joints, and no source mesh, textures, or FBX loader. Playback advances through the first second, then holds that sample instead of replaying the source's arm-lowering ending. Reduced motion starts directly at the hold pose. `flashAnimationPack.ts` fetches/decodes lazily on first presentation, shares the decoded source, and permits retry after failure; each avatar owns its retargeted action. Both avatar adapters serialize preparation with their existing bake queue. The browser never parses the original FBX.

Rebuild from the web repository root with the pinned source FBX in an external directory:

```sh
node frontend/scripts/pack-travel-animations.mjs \
  --input '/path/to/source-directory' \
  --source-manifest frontend/public/lobby/flash/source-manifest.json \
  --group flash \
  --output frontend/public/lobby/flash
```

The converter validates source/reference hashes and records compression and retargeting error bounds. Review normalization and provenance before changing pinned inputs. Preserve the generated manifest and hashed payload together.

## Rendering and resource ownership

`flashFrame.ts` builds actual faceted geometry: stepped gold molding, dark recesses, raised leaf/scroll ornaments, and a solid rear backing. The reusable frame defaults to 1.05 m; the lobby presents it at 0.88 m before avatar scaling and uses 3,972 triangles and five draws including artwork. Four meshes merge the frame's material regions; the fifth holds the image. Portrait/landscape openings adapt to aspect ratio; extreme ratios use contain-fit without cropping. Presentation scale/fade is separate from the caller's placement transform. The frame disposes its own geometries/materials and borrows its texture.

`flashPresentation.ts` owns one frame/texture/abort controller per admitted actor. It places the frame in front of the torso, scales it with avatar height, and prepares image and gesture concurrently. Normal intro/outro takes approximately 250 ms; reduced motion changes visibility immediately. Image loading uses anonymous CORS and a 15-second timeout. The decoded image is drawn to a canvas with its longest side capped at 1,024 pixels, then uploaded as an sRGB texture. **This limits GPU upload and retained texture dimensions, but does not cap the original network transfer, browser image decode, or its temporary CPU memory.** The original must decode before canvas resizing. There is no cross-actor texture cache; entries own and release their textures independently.

`createLobbyScene.tsx` admits at most **four remote Flash actors within 12 m**, plus the local actor, from the existing nearest/retained crowd admission set. Those remotes temporarily use live avatar rigs for the authored gesture; other visitors stay on the normal crowd path and do not load Flash images or clips. Leaving range or stopping returns the avatar to the crowd path. Flash promotion alone does not warm travel animations. These are active admission limits; outgoing frame fades can briefly overlap incoming presentations. A remote nonce is dismissed on movement, becoming airborne, or another emote, preventing stale profile data from restarting it when the avatar stops.

Replacement, disappearance, movement, travel, avatar replacement, and scene disposal end the presentation. Abort/nonce/generation checks prevent an old image or animation completion from attaching to a newer selection. Texture completion after cancellation is disposed. Failure stops the gesture and releases its frame/texture; a failed remote nonce is suppressed until the selection/avatar changes or leaves the admitted set, preventing a render-loop retry storm.

## Stopping and sharing

Stop Flash, movement/jump, a conflicting emote, leaving/travel, tab hiding, avatar changes, and account changes end the current presentation. Escape closes an open overlay first, otherwise dismisses an active Flash. Choosing another NFT clears the old shared state immediately and publishes the replacement only after local preparation succeeds. Scene callbacks carry the nonce, so stale ready/error/dismiss callbacks cannot stop or announce a newer selection.

The canonical wire contract is `multiplayer/protocol/lobby-flash.js` with its `.d.ts` declarations. Keep runtime frontend imports explicit (`lobby-flash.js`), since this shared directory is outside the normal Next TypeScript source tree. `LobbyConnection.setFlash(flash | null)` sends reliable `lobby-flash` controls. The server stamps `startedAt` and session identity, validates bounded artwork fields/URLs, and stores the sanitized presentation in the roster profile for late arrivals and AOI re-entry. Ordinary profile edits cannot inject Flash. WorldGateway profile replication carries it across workers and rejects older revision echoes. Imperative motion samples carry the same `player.flash` metadata as React roster snapshots.

Starts use a dedicated token bucket (one/second, burst three). Clears bypass both that bucket and the ordinary request budget; repeated no-op clears are suppressed. Server movement, group travel/destination presence, and disconnect also clear active state. Crowd controls queue through temporary backpressure; the world transport closes a connection that cannot preserve reliable control delivery. Desired local state survives an automatic reconnect, while explicit stop/leave does not.

Upgraded v1/v2 servers advertise `flash: true` in the welcome message. The client exposes `flashSupported`; legacy CyberRoom and older deployments remain false and receive no unknown Flash control. The local presentation still works when offline or unsupported. Ship the frontend code/assets **and** updated multiplayer server for nearby sharing; a frontend-only release does not upgrade existing servers. Use the existing frontend and multiplayer release processes; running the fixture or tests performs no deployment.

## Local preview and validation

With the existing local frontend running, open `http://localhost:13000/dev/lobby-flash`. This development-only fixture has explicit sample-artwork, Stop Flash, renderer selection, and nearby-avatar controls. Its synthetic artwork/peer never enter the owned NFT picker and do not demonstrate a live two-user session. Check the local and nearby frames, pointing hold, walking cancellation, repeated selection, both renderer paths, and reduced motion. The route returns 404 outside development.

Run from the web repository root:

```sh
pnpm -C frontend exec jest --runInBand --watchman=false \
  features/lobby/flash \
  features/lobby/FlashPicker.test.tsx \
  features/lobby/useFlashNfts.test.tsx \
  features/lobby/Lobby.test.tsx \
  features/lobby/LobbyScene.test.tsx \
  features/lobby/avatarAdapter.test.ts \
  features/lobby/LobbyConnection.test.ts \
  features/lobby/useLobbySocial.test.tsx \
  features/lobby/WorldLobbyConnection.test.ts
```

Run the modern avatar checks separately (the default Jest config excludes this directory):

```sh
pnpm -C frontend exec jest --config features/lobby/webgpu/jest.config.cjs \
  --runInBand --watchman=false features/lobby/webgpu/avatarAdapter.test.ts
```

Run the standalone multiplayer checks from `multiplayer/` (socket tests require permission to bind localhost):

```sh
node node_modules/typescript/lib/tsc.js --noEmit
TS_NODE_FILES=true node node_modules/mocha/bin/mocha \
  --require ts-node/register \
  test/CrowdFlash_test.ts test/WorldFlash_test.ts \
  test/CrowdRoom_test.ts test/WorldLobby_test.ts test/WorldGroups_test.ts \
  --exit --timeout 20000
```

Tests cover the packed asset/hash, frame budgets and disposal, media failures/cancellation, nonce replacement, picker/account lifecycle, scene callbacks, both avatar adapters, client reconnect/legacy behavior, and the real WebTransport stream adapter. Server tests exercise actual local Crowd websockets and two WorldGateway worker sockets, including server-owned identity/time, late-join hydration, rate-independent stopping, profile-echo ordering, travel/movement cleanup, and reliable backpressure handling. Local transport tests do not establish production deployment or live wallet-provider availability.
