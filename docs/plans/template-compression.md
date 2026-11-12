# Compressing the popular room templates: a plan

This is for the owner's confirmation. No code, assets or data are changed. It
was written on 10 November 2026 from a read of `claude/ui-review-fixes` and the
asset audit in `docs/in-app-space-navigation.md`. Anything marked
_(inference)_ was deduced, not read. Figures marked _typical_ are the usual
result for this kind of content, not measurements of our files.

## 1. What is true today, and what it costs visitors

The 15 most-visited spaces use 11 room templates. Each template has PNG/JPEG
`low`, `mid` and `high` files, and only one of them, the 6529 hub, has a
`low_compressed` file. None of the audited files uses Draco, meshopt or KTX2.

| Template                    |  High | Low (what phones get) |
| --------------------------- | ----: | --------------------: |
| Rift Mark Two               | 42.05 |                 28.74 |
| Macy's                      |     ? |                 39.73 |
| OM sector                   |     ? |                 31.19 |
| Space Pod (Meta Trap house) | 23.13 |                  5.48 |
| 6529 hub                    |     ? |   17.50 (14.70 comp.) |
| Temple (6529 AB)            |  6.80 |                  3.46 |
| Brute (WANIMAL BLUE)        |  7.18 |                  0.48 |

All sizes are in decimal MB. Rift's low file still has 343,820 triangles, 502
meshes and 101 images, and only half of its 28.74 MB is images. The rest,
15.02 MB, is raw geometry. The phone tier is lighter only because its textures
are smaller. The geometry is the same in every tier.

The bigger cost is GPU memory. A PNG or JPEG has to be decoded to raw pixels
on the visitor's device, and the graphics card stores those pixels uncompressed.

| One texture, with mipmaps | Uncompressed RGBA | 8 bits per pixel | 4 bits per pixel |
| ------------------------- | ----------------: | ---------------: | ---------------: |
| 4096 × 4096               |           ≈ 89 MB |          ≈ 22 MB |          ≈ 11 MB |
| 2048 × 2048               |           ≈ 22 MB |         ≈ 5.6 MB |         ≈ 2.8 MB |
| 1024 × 1024               |          ≈ 5.6 MB |         ≈ 1.4 MB |         ≈ 0.7 MB |

KTX2 textures stay compressed on the GPU, at 8 or 4 bits per pixel. A room
with 101 images could need up to about 565 MB of GPU memory at 1024 px
uncompressed (the upper bound if every image were 1024²). That is enough to
crash or stall a phone browser. Decoding PNG/JPEG also costs time on the
device, and so does uploading the raw pixels.

Our uploader already makes the right kind of file, but only for new uploads.
It runs Draco once and writes high, mid and low at 4096, 2048 and 1024 px
(`modules/optimiser/index.js`, lines 254 to 404). It makes KTX2 only for the
1024 tier, in ETC1S mode only. It skips metallic-roughness maps and stretches
every texture to a power of two. The popular templates are older than this
step and were never re-run through it _(inference)_.

## 2. The target, per tier

**Geometry: Draco, encoded once per template.** All new tiers of a template
share the same Draco geometry, byte for byte. Only the textures differ. Draco
is already wired in the runtime: the decoder runs in workers from `/draco/`,
so the first load needs no new decoder. Meshopt decodes several times faster
_(typical)_ and is the fallback if phones decode Draco too slowly. Its decoder
ships in three (`examples/jsm/libs/meshopt_decoder.module.js`) and
`meshoptimizer` 0.19 is installed. It is not wired in, though: `loader.js`
never calls `setMeshoptDecoder`. Meshopt files are also larger than Draco
unless the asset host serves them gzip-compressed, and the Pinata gateway's
behaviour on that is unknown _(inference)_. Draco is lossy. We use 14-bit
positions, or 16-bit on templates with large floors, so that collision
surfaces move by well under a centimetre.

**Textures: KTX2 with mipmaps stored in the file.**

-   Colour (base colour, emissive) uses ETC1S, which becomes about 4 bits per
    pixel on the GPU (8 with alpha).
-   Normal maps, metallic-roughness and occlusion maps, and lightmaps use UASTC,
    about 8 bits per pixel, compressed further with zstd.
-   In unlit rooms where the lighting is baked into the colour texture, smooth
    gradients can band in ETC1S. Any texture that fails review switches to UASTC
    on its own.
-   Sizes keep the original aspect ratio, rounded to a multiple of 4. No
    stretching to a power of two.

The room loader has no separate lightmap step. In these templates, baked
lighting appears to live in the colour of unlit materials, or in `aoMap` and
`lightMap` on a second UV set _(inference; the per-texture slot list in the
script's report will settle it)_.

**New keys beside the old ones.** Each template's `paths` gets
`low_compressed`, `mid_compressed` and `high_compressed` (1024, 2048 and up to
4096 px). The existing `low`, `mid` and `high` files are left exactly as they
are. Devices that cannot use any compressed format keep getting them: the
runtime sets `COMPRESSED_SUPPORT` from `KTX2Loader.detectSupport`.

| After the switch                    | Arrives with      | Refines to        |
| ----------------------------------- | ----------------- | ----------------- |
| Desktop, KTX2-capable               | `mid_compressed`  | `high_compressed` |
| Phone or low-tier GPU, KTX2-capable | `low_compressed`  | `mid_compressed`  |
| No compressed format                | today's PNG tiers | today's PNG tiers |

This builds on the change now in progress in `roomModelSource.js`, where
desktop loads mid first and refines to high.

**What the texture-upgrade path must support.** Today the background
refinement accepts only uncompressed geometry with PNG/JPEG images. The worker
`roomTextureDonor.worker.js` rejects `KHR_draco_mesh_compression`,
`EXT_meshopt_compression` and any texture extension, KTX2 included. It matches
old and new textures by a fingerprint of each mesh's vertices and UVs, so a
Draco file can never refine from a non-Draco file, and the reverse is also
true. Three code changes are needed:

-   (a) Tier selection: prefer the `*_compressed` key when compressed formats
    are supported, and always refine within the same family. Add a site-wide
    switch that ignores the new keys.
-   (b) The donor worker: decode Draco and accept KTX2. Upload compressed mip
    levels whole or in block-aligned pieces, in place of today's 128 × 128 RGBA
    tiles.
-   (c) Let the 128 MiB desktop and 64 MiB phone budgets count compressed bytes,
    so a 4096 ETC1S texture (≈ 11 MB) fits.

Without (b), visitors who arrive from the lobby stay at `mid_compressed` on
desktop and `low_compressed` on phones. That is still a large improvement, so
(b) can follow later.

## 3. The pipeline

**One reusable script, `tasks/template-compress/`.** It is standalone, like
the other `tasks/*`, with its own pinned dependencies.

-   **Input:** `templates.json`, holding each template's slug, the URL of its
    live `high` file (the source, because its node order is the one that
    exhibits depend on) and optional per-texture overrides (ETC1S or UASTC,
    quantisation bits).
-   **Steps:** read the file; `dedup` and `prune`, but nothing that reorders,
    merges, flattens, joins or instances nodes, and no simplification in the
    first pass; Draco once; then three texture passes at 1024, 2048 and 4096 px.
-   **Output:** `out/<slug>/{low,mid,high}_compressed.glb`, plus a report for
    each template.
-   **The report:** file sizes; triangle, mesh and image counts; estimated GPU
    bytes per tier; a hash of the node names in order; the count, order and
    world transform of every placeholder; portal and camera names; collision
    and floor bounding boxes; and every texture's slot, size and mode.

**Packages.** In the root `node_modules` today:

-   `@gltf-transform/core`, `extensions` and `functions` at `4.0.0-alpha.8`,
    which is an alpha; the task should pin a stable 4.x;
-   `meshoptimizer` 0.19.0;
-   `sharp` 0.32.6, which arrives as a dependency of another package.

Missing:

-   `draco3dgltf`, the Draco encoder for Node (npm, WebAssembly);
-   a KTX2 encoder. The simplest is KTX-Software's `ktx` command-line tool,
    version 4.3 or later. It is a native binary, installed once on the machine
    that runs the script, and gltf-transform's KTX2 step calls it.
    `frontend/public/basis/basis_encoder.{js,wasm}` is a WebAssembly encoder
    already in the repo, but its adapter (`optimiser/ktx/toktx.js`) runs only in
    a browser.

`tasks/gltf` (hard-coded to Temple, and it reorders geometry) and
`tasks/texturecompressetc` (forces 256 × 256, needs missing binaries) cannot be
reused as they are.

**Upload.** Running the script with `--upload` sends each file to Pinata and
prints its URL, with `?filename=<slug>-<tier>-compressed.glb` added for
readability. IPFS addresses are content hashes, so new files always get new
URLs and nothing old can be overwritten. After upload, fetch each URL once to
warm the gateway.

**Data change.** A second script, `apply-paths`, writes the three keys into
each template's `new-destinations` document. It saves the previous `paths`
into a dated backup field and a local JSON file, and it bumps the
active-catalog version. With `--rollback` it puts the backup back.

The switch reaches visitors within about 5 to 45 minutes _(inference)_. That
range comes from the caches in front of the data:

-   the CDN keeps `/api/destinations/<slug>` for 300 s and may serve it stale
    for another 600 s;
-   each warm server instance keeps the slug in memory for 30 minutes;
-   open browser tabs keep it for the whole session.

## 4. Checks per template before switching

1. **Automated gate, from the report.** Node order hash unchanged. Placeholder
   count, order and transforms identical (to 1 mm). Every `Portal_Mesh_*` and
   `Portal_Door_*` present. Cameras and animations present. Collision and
   floor bounding boxes within 1 cm. If any of these fails, the template does
   not switch.

    Placeholders are matched to artworks **by their position in the file**
    (`factory/artwork/placeholders/index.js`). A plane is recognised by having
    exactly 4 vertices. Reordering them would move the artworks in every space
    built on that template.

2. **Visual.** Five fixed camera positions per template: the spawn point and
   four views chosen with the owner. Capture old and new at the same viewport,
   on desktop Chrome (WebGPU and `?renderer=webgl`), one Android phone and one
   iPhone. Compare by pixel difference, then side by side by eye, looking
   closely at baked-light gradients, logos and text on screens. This needs a
   small development-only switch that forces a tier _(new code)_.
3. **In the world.** Arrive from the lobby and by direct link and confirm the
   spawn point. Walk the floors, stairs and walls (collisions). Check that the
   artworks sit on the same walls in the most-visited exhibit using the
   template. Open each portal. Watch the background refinement, which reports
   `data-native-room-texture-*` in development.
4. **Numbers.** File size and estimated GPU memory before and after, and
   arrival time on a mid-range phone.

**Rollback.** Run `apply-paths --rollback` for that template, or turn the
site-wide switch off. The old files are never deleted, and returning visitors
still have them in the browser's model cache, which is keyed by full URL. A
rollback takes the same 5 to 45 minutes as the switch, or one deploy for the
site-wide switch.

## 5. Order of work, effort, risks and what needs you

**Order.**

1. Inventory: confirm the 11 templates and their visit counts (Appendix B).
2. Write the script and its report.
3. Runtime change (a) and the forced-tier switch, behind the site-wide switch.
4. Pilot on the template used by the most-visited world.
5. The rest, largest gain first (visits × MB saved). Rift, Macy's and OM
   sector are probably the largest _(inference)_.
6. Runtime changes (b) and (c).

**Effort _(estimates)_.** Setup is 4 to 7 days: script and report 2 to 3,
runtime (a) 1 to 2, the capture harness 1 to 2. Each template takes about 30
minutes of machine time. Review takes 2 to 3 hours for a simple template, and
half a day to a day for the heavy ones, which need per-texture tuning. Change
(b) is another 3 to 5 days.

**Risks.**

-   **ETC1S artefacts** (blocks, banding, colour shifts) on baked lighting and
    text. The answer is per-texture UASTC, at roughly 2× the bytes of ETC1S
    _(typical)_.
-   **Old devices with no compressed format.** These keep today's PNG files.
-   **Old iPhones without ASTC.** These fall back to PVRTC, which wants square
    power-of-two textures, so non-square textures may be stored uncompressed on
    those phones _(inference)_.
-   **Draco decoding is slow on phones.** A Rift-sized room can take hundreds of
    milliseconds to over a second, in a worker _(typical)_. If measurements show
    this, switch that template to meshopt; that requires wiring its decoder.
-   **Cache invalidation.**
    -   Every visitor's first load after the switch is cold.
    -   Old files stay in the `room-v1` browser cache, which has no eviction, so
        they take up disk space.
    -   The switch arrives with the 5 to 45 minute delay above.
    -   The first request for a new IPFS address can be slow, so warm each one
        after upload.
-   **Mixed families.** If a compressed file refined from an uncompressed one,
    the fingerprint mismatch would quietly disable refinement. Rule (a)
    prevents that.
-   **Re-uploads.** If a template's author re-uploads it, the uploader rewrites
    `paths` in full and drops the new keys. That is safe, but the compression is
    lost _(inference)_.
-   **Texture bytes.** Download size for textures will drop only a little,
    around 20 to 50% for ETC1S, and may grow with UASTC _(typical)_. The large
    savings are in geometry bytes, GPU memory and decode time.

**What needs you.**

-   Pinata upload credentials and Firestore write access on the machine that
    runs the upload and data steps, held there and never committed. Or you run
    those two steps yourself.
-   Confirmation of the list of 11 templates.
-   Approval of each template's visual comparison before it switches.
-   The test devices.
-   Whether ETC1S is acceptable on colour textures, or UASTC is preferred
    everywhere at a larger download.

## Appendix A. Files involved

-   `docs/in-app-space-navigation.md`, lines 574 to 597 and 655 to 715: the
    audit and the refinement policy.
-   `frontend/components/_3DExhibit-v2/three/modules/optimiser/index.js`, lines
    254 to 404 and 586 to 592; `optimiser/ktx/toktx.js`;
    `ktx/loadbasisencodermodule.js`: the uploader's existing pipeline.
-   `cloud-functions/functions/src/https/optimize_v2_ipfs/optimizeGLTF.ts` and
    `toktx.ts`: a Node version of the same steps for 3D artworks, using `sharp`,
    `draco3dgltf` and a `basisu` binary. It is a useful reference, but it runs
    `join`, `instance` and `palette`, which merge meshes and materials, so it is
    unsafe for rooms.
-   `three/utils/roomModelSource.js`: tier selection and refinement target.
    `factory/space/kits/classic/index.js` and `kits/kitbash/index.js` call it.
    The kitbash call passes neither `isMobile` nor `quality`, so phones that open
    a kitbash room by direct link start on `high` (observed; it may be in flux).
-   `three/loader.js`, lines 154 to 234: the Draco decoder at `/draco/`; the
    KTX2 transcoder at `/basis/`, with `COMPRESSED_SUPPORT` set from it; no
    meshopt.
-   `three/loader/GLTFLoader.js`: Draco, KTX2 and meshopt support (meshopt
    needs a decoder to be set).
-   `three/utils/roomTextureDonor.worker.js`, `roomTextureUpgrade.js` and
    `roomTextureUpgradeController.js`: refinement, its fingerprints and its
    budgets.
-   `three/factory/artwork/placeholders/index.js`: index-based placeholders.
    `three/portal/`: the `Portal_Mesh_` and `Portal_Door_` names. The named
    root nodes (`collision`, `floor`, `placeholder` and others) are read in
    `kits/classic/index.js`.
-   `three/camera/controls/physics/collisions/octreecollisions.js`: the octree
    is built at runtime from collider meshes. Its cache is commented out, so
    there is no stale-octree risk.
-   `three/utils/cachestorage.js`: the `room-v1` browser model cache, keyed by
    URL.
-   `frontend/utils/firestore/destinations.ts` (the `new-destinations`
    collection, caches and `updateDestination`);
    `pages/api/destinations/[path].js` (its CDN cache);
    `gl/fetchExhibitData.js` (`getDestination`, `pathToSlug`, `oldToNew`);
    `@types/roomParameters.d.ts` and `@types/Asset.d.ts`.
-   The uploader's write of `paths`:
    `features/spaces/create/components/DestinationSelector/Uploader/Modals/Loader/index.tsx`,
    lines 379 to 456.
-   `frontend/public/draco/` and `frontend/public/basis/`: the decoders and the
    browser encoders.

## Appendix B. The 11 templates

The repository does not contain the list. The audit names seven:

1. Rift Mark Two
2. Macy's
3. OM sector
4. Space Pod (Meta Trap house; slug probably `rtfktspacepod`)
5. 6529 hub (probably `6529hub`; the one with `low_compressed`)
6. Temple (6529 AB; `temple`, which `getDestination` maps to `temple_v2`)
7. Brute (WANIMAL BLUE; probably `brute`)

The slugs are _(inference)_, taken from a 2022 export in
`tasks/gltf/newdestinations.json`.

To get the full list (read-only):

1. Read the 15 public, non-deleted `exhibits` with the highest
   `number_of_visits`. This is the "Most Popular" feed, key `most-visited`.
2. Take each one's `info.room`, and map it through `pathToSlug` and `oldToNew`
   in `gl/fetchExhibitData.js`.
3. Fetch `/api/destinations/<slug>` for each.
4. Group them by file address, since two slugs can share one file.
5. Record any `skins.*.paths` and `night_*` keys. Those are further files to
   compress.

The output of these steps is `templates.json`.
