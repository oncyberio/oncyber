# Artwork recovery and adaptive media

Status: 2026-09-16. Code changes are local; the targeted Cologne Dude media URL repair has been applied to its saved gallery. No artwork placements were deleted.

## Cologne verification — 2026-09-17

A fresh Chrome check of both `https://oncyber.io/cologne_dude` and the existing Vercel preview confirmed that the viewer requests artwork thumbnails through Pinata with `img-width=256`, `img-height=256`, and `img-fit=scale-down`. These parameters are added when loading; their absence from the saved Firestore URLs does not mean resizing is disabled. This supersedes the earlier local-only status for this particular behavior.

For `STK_Doll_MonoLisa.jpg`, the original was 2040 × 2040 and 1,578,473 bytes; Pinata returned a 256 × 256 JPEG of 9,461 bytes. Nearby images can still upgrade to originals. `marfaMESH #291.png` contains AVIF data: its resize request returned HTTP 415, and the preview successfully fell back to the original. Native Pinata thumbnails therefore do not mean that every artwork and animation has been fully optimized.

At 11:38–11:39 UTC, the saved gallery still contained all 131 placements and zero `media_variants` records. It is rank 2,351 in the frozen top-30,000 manifest, but `top30000-media-20260916-v1` had no completed gallery or artwork reports for it yet. The earlier 58-placement URL repair is complete; the new cached-image/animation backfill had not reached this gallery. Probe logs and measurements are under `/private/tmp/oncyber-gallery-maintenance/cologne-*-probe.json` and `cologne-pinata-measurement.json`.

## What failed

`cologne_dude` (`NWlznCZJL5opEcTRSOtP`) has 131 placements: 75 NFTs, 28 uploads, 28 text entries. Its saved records included 55 NFTs using the retired `img.reservoir.tools` service and three uploads using Oncyber's inaccessible Cloudinary account. All 55 NFTs were found through the existing OpenSea integration; all three uploads had surviving originals in `assets-upload-hash`.

The recovery changed 276 media URL fields across those 58 placements in a Firestore transaction. It checked the previous field values before writing, so a concurrent curator edit would abort the repair. The full original record and exact patch are under `/private/tmp/oncyber-cologne-debug/` (`gallery-before-applied-repair.json`, `gallery-repair-plan.json`, `gallery-after-repair.json`). Titles, ownership metadata, placement, scale, and the artwork count were preserved. This temporary backup should be retained with the incident record before the temporary directory is cleaned.

Six animated-image previews timed out in the initial small-range probe; their movies were independently reachable. OpenSea also returns one MP4 in its `image_url` field. Recovery treats that as video, not a decodable poster. A provider timeout or rate limit is never evidence that the artwork is permanently gone.

The reported Next.js fatal error was not reproduced on the initial load. Missing media was reproducible. The viewer also ignored pointer hover for info selection: only the camera-centre ray selected artwork. Free-cursor desktop browsing now selects nearby hovered artwork, while camera focus continues to drive audio/video behavior. Compact details controls are clickable.

## Changes in this patch

- Recover known retired NFT URLs through a fixed OpenSea server endpoint. Validate chain/contract/token; cap response size, duration and concurrent requests; deduplicate lookups and cache successful media. Do not persist provider failures or delete artwork during a visitor request.
- Preserve original artwork identity and presentation metadata. Recover only missing/retired URL fields. Existing upload-hash recovery remains available for uploaded media.
- Bound initial artwork jobs to four, or two on the engine's low GPU tier. Catch preprocessing failures as well as media loader failures. Avoid invoking editor placeholder restoration in a visitor session.
- Preserve abort signals through alternative URLs; time out stalled image/video loads; handle missing content-type headers and revoked blob URLs. Reject empty URL lists explicitly.
- Restore distance-based thumbnails using the existing supported CDN resize paths, not just Cloudinary. Distant videos can use a poster. Failed posters fall back to available originals; failed movies can keep their posters.
- Handle rejected pointer-lock requests without an unhandled promise, and guard details actions when an artwork has been removed.

These changes reduce simultaneous work and avoid many unnecessary downloads. They do **not** impose a global GPU memory budget, prevent every large-image decode, or transcode arbitrary originals. A width parameter is only useful on a provider that honors it. Large GIFs and movies without posters still require generated derivatives.

## Validation and remaining limits

18 focused tests pass (recovery parsing, endpoint bounds/cache/error status, per-artwork failure isolation, cancellation/timeouts, both LOD fallback directions, and hover selection). The local browser loaded all 131 placements in the first recovery pass. A later reload loaded every named media artwork but stalled on one text placement during a font fetch; this is separate from NFT recovery. The full frontend type check still reports 623 diagnostics across the existing codebase/dependencies; the new helpers and endpoint have no diagnostics. A development hot reload also briefly produced disposed-geometry errors; a fresh reload did not reproduce those, so this is not proof that every renderer failure mode is fixed.

Browser checks confirmed that the recovered `#11 − Making Intelligence` has a visible info bubble when hovered **off the camera centre** with pointer lock unavailable, and that its details open from the compact 900px control. The subsequent activity fixes replace the retired history endpoint with OpenSea v2; see [Artwork activity and profile pictures](artwork-activity.md) for the final behavior and validation.

## Recommended next step: generate once, serve static variants

Use the existing upload records and storage integration. Run a bounded background job on upload/import, then backfill frequently visited galleries. Do not put arbitrary remote image processing on every gallery request.

| Media | Stored outputs | Viewer behavior |
| --- | --- | --- |
| Still image | 256, 512, 1024, 2048-pixel long-edge WebP, original preserved | 256 at distance; 512 on low tier; 1024 nearby; 2048 only for an explicit close-up |
| Video / animated GIF | Still poster, 360p/720p H.264 MP4 with fast-start; optional 1080p | Poster at distance; load only nearby movies, cap active decoders; lower tier starts at 360p |
| Long video | Poster plus aligned HLS renditions | Native HLS where supported, existing hls.js path otherwise |
| Panorama | Separate 1024/2048/4096 long-edge variants | Retain panorama projection and aspect ratio; cap using measured device limits |

Sharp is already a dependency of `cloud-functions/functions`. It can resize inside a bounding box without enlarging the input. Set explicit input pixel/byte limits, strip unnecessary metadata, and isolate the job's memory/time budget. Default to WebP first; add AVIF only if measured bandwidth savings justify encoding cost. [Sharp resize](https://sharp.pixelplumbing.com/api-resize/), [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/).

FFmpeg can encode the MP4 renditions and poster and package HLS variants. Preserve aspect ratio and audio, use a fixed low concurrency, and publish the manifest only after every referenced output is complete. [FFmpeg HLS muxer](https://ffmpeg.org/ffmpeg-formats.html#hls-2).

Store an image/video-specific variant manifest keyed by source content hash and processing version, with width, height, byte size, MIME type, poster and URLs. The existing `d_optimized_files` field is primarily a 3D-model contract; do not overload it without migrating consumers. Hook the job into remote uploads/imports and `assets-upload-hash`, then teach `getMediaLODUrls` to consume the new manifest before external CDN URLs. The legacy Cloudinary optimizer (`utils/optimizeAssetMedia.ts` and its `optimize` endpoint) has been removed; for 2D media `optimize_v2_ipfs` only pins the original bytes to IPFS and does not resize or transcode.

Use immutable URLs and long-lived CDN caching. This shifts cost to one bounded encode plus storage/egress instead of repeated transformation. Exact cost depends on originals, traffic, storage/CDN contract and encode runtime; no new paid service is needed for a prototype. External OpenSea resizing is a useful recovery path, not the long-term storage guarantee. [OpenSea NFT endpoint](https://docs.opensea.io/reference/get_nft).

## Device safety and validation

JPEG/WebP file size is not GPU memory usage. A 4096 × 4096 RGBA texture is about 64 MiB before mipmaps; the full mip chain adds roughly one third. Device testing should track estimated resident textures, active video decoders and context loss. Dispose distant high-resolution textures, prefer smaller variants before decoding, and provide a static gallery fallback after repeated WebGL context loss. KTX2/Basis is a later option for GPU compression; it does not replace the initial variant pipeline. [MDN WebGL guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

Suggested rollout: one test gallery and a capped batch, then popular galleries, then new uploads by default. Verify portrait aspect ratios, alpha, GIF/video posters, malformed metadata, missing originals, slow/offline providers, navigation during loads, and a physical low-memory phone. Record time to first usable room, peak resident texture estimate, bytes downloaded, concurrent decoders and page/context errors. Never delete a curator's saved artwork because a visitor's network request failed; remove a placement only after a separate, backed-up recovery audit establishes no surviving source.
