# Museum of Checks media repair

2026-09-16. Gallery `hlc4dbyphjkHl9xH68fe` (`museumofchecks`).

## Live data repair

The gallery contains 172 placements: 142 image/video/panorama artworks, one HTML artwork, one GLB, and 28 text elements. A 12-second probe of 363 saved media URLs found 67 first-choice sources unavailable or timing out; this was not treated as proof of deletion. Several legacy OpenSea URLs failed, original IPFS copies often remained reachable, and the HTML artwork was fetching a dead marketplace URL despite having a working saved HTML copy.

Prepared 256px previews, 1024px images (2048px panoramas), and 720px H.264 fast-start animations. Animated WebP is decoded frame by frame before encoding. Embedded SVGs are decoded from NFT metadata; oversized originals use current provider derivatives instead of exceeding the decode budget. The 142 initial previews total 975,908 bytes. All image/video derivatives total 28,843,921 bytes including repeated placements. Preserved originals and NFT identities.

Published 295 immutable files to the existing Oncyber Pinata account and verified every downloaded file against its local SHA-256. A guarded Firestore transaction updated 948 media fields across 143 artworks. The GLB was verified and needed no changes. All placements, transformations, titles, and attribution were retained. `lastUpdatedAt` was bumped to invalidate version-keyed exhibit caches.

Backups, source audit, derivative manifests, upload hashes, and exact before/after fields are in `/tmp/oncyber-museum-media/`. `immediately-before-apply.json` is the pre-write gallery backup; `repair-plan.json` records each changed field; `after.json` is the verified result. These contain gallery data and must not be committed.

## Loader changes

- Initial LOD loads show a small preview before upgrading nearby artwork.
- Media alternatives each get an 8-second attempt inside the existing 30-second total budget. Cancellation stops fallback work.
- Failed artwork jobs retry only after the first pass; retry can request fresh NFT media even when the failed URL is not a recognized retired provider.
- Cached derivative manifests are tied to NFT identity and bypass dynamic image-transform URLs.
- Proxy requests encode the nested media URL without dropping its query parameters.
- HTML artworks prefer the saved HTML copy, reject HTTP error pages, and use bounded fallback loading.

The renderer changes are local until the corresponding frontend release is deployed. The gallery data repair works with the existing production renderer.

## Reproduction

Use the existing checkout and dependencies, Node 22+, Sharp, and FFmpeg. Set `GALLERY_MEDIA_DIR` to an absolute private directory to retain an independent audit. These scripts intentionally target this gallery and require its expected artwork counts.

```sh
node scripts/museum-media/snapshot.cjs
node scripts/museum-media/audit.cjs
node scripts/museum-media/prepare.cjs
node scripts/museum-media/extras.cjs
node scripts/museum-media/publish.cjs
node scripts/museum-media/apply.cjs
node scripts/museum-media/apply.cjs --apply
```

Snapshot/audit/preparation only read external data. Publish adds immutable derivatives. Apply is a dry run unless `--apply` is present, verifies uploaded bytes and NFT identity, and rejects concurrent edits to any media field it changes. It never deletes artworks. A rollback must likewise restore only the plan's fields after checking they still match the applied values, then bump `lastUpdatedAt`; never replace the entire gallery with its backup.

## Validation

31 focused media tests passed, covering per-source timeout, fallback cancellation, retry ordering, cached variant identity, preview-first initialization, HTML fallback, recovery, and proxy query preservation. A fresh production visit after cache invalidation and a local visit using the updated renderer logged no artwork-loading failures. Unrelated existing avatar/React/extension warnings remain. TypeScript reports 605 diagnostics both before and after this change in an in-memory baseline comparison, with zero added diagnostics. Production frontend code was not deployed from this shared checkout; it also contains unrelated ongoing landing/search edits.
