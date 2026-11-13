# Space export

A space's owner can download the whole space as one JSON file from Studio:
**World settings → Export → Download JSON**. The step only shows for the
signed-in owner (`canExportSpace` in
`frontend/features/studio/export/spaceExport.ts`).

The point is that a space should outlive the servers that hold it today. The
code being open lets anyone redeploy the app, but the spaces themselves live
in Firebase records and pinned IPFS files. The export file is the piece a
fork, an archive or a static viewer can rebuild a space from, with no Firebase
and no account.

## The file

`<slug>-<date>.oncyber.json`, built by `buildSpaceExport`:

| Field        | What it holds                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`     | Always `"oncyber.space"`                                                                                                                                         |
| `version`    | `1`. Bumped when a field changes meaning; readers should refuse versions they don't know                                                                         |
| `exportedAt` | ISO time of the export                                                                                                                                           |
| `source`     | The space id and its link                                                                                                                                        |
| `kind`       | `"native"` (renders with the Oncyber engine from `space` and `room`) or `"external"` (a page hosted elsewhere, at `space.runtime.url`)                           |
| `space`      | The space record as Studio holds it: info, artworks with transforms, portals, kitbash, params, gating, scripts                                                   |
| `room`       | The room (`RoomParameters`) the space is built on: model paths, skins, lighting, env map                                                                         |
| `files`      | Every URL found in `space` and `room`, deduplicated. `pinned` entries carry an IPFS `cid`; `hosted` entries are plain URLs. Each lists where it was found (`at`) |

Left out on purpose: cached copies of other records (`ownerData`,
`portalExhibits`, `portalsDestinations`, `portalsOwners`), live flags
(`pendingTransaction`, `invited`, `mock`) and the world password. Only the
password's visitor message is kept.

`files.hosted` is the honest list of what can still break: anything not
content-addressed (an OpenSea CDN link, a room model on a plain server, an
external world's page) is only as permanent as that server.

## Next steps (proposal)

### 1. A static viewer

A page, `/view`, that takes an export file (dropped in, or `?src=<url>` to an
IPFS or Arweave copy) and renders it read-only, with no Firebase calls and no
sign-in.

Most of it exists: the engine already renders from an `Experience` plus a
`RoomParameters`, and the studio's `local` store mode already runs a space
from memory without Firebase. The viewer:

-   validates `format` and `version`,
-   mounts the read-only space renderer with `space` and `room` from the file,
-   resolves `ipfs://` and `/ipfs/<cid>` URLs through a list of public
    gateways (and later oncyber's own ar.io gateway), so no single gateway is
    required,
-   turns off everything that needs a server: multiplayer, chat, voice,
    portals to other spaces (shown as posters), likes and visit counts.

Because the viewer is part of the static build, a fork or an IPFS copy of the
site can show any exported space.

### 2. Pinning the export itself

Add **Pin to IPFS** next to Download. It uploads the JSON through the existing
Pinata route and returns a CID, so the space has one permanent address. Later
the same file can go to Arweave with the rest of the archive plan.

### 3. External worlds as pinned bundles

An external world (`kind: "external"`) is only a URL on someone else's server;
when that server goes, the world goes, and the export can't save it.

Let the owner attach a **bundle**: a zip of the world's static build (its
`index.html`, scripts and assets). Oncyber unpacks it, pins it to IPFS as a
directory, and stores the directory CID on the space:

```ts
runtime: {
    kind: "web",
    url: "https://world.example/",      // where it runs today
    bundle: { cid: "bafy...", entry: "index.html", pinnedAt: 1731456000000 },
}
```

The content host then prefers the live `url` and falls back to the bundle
through a gateway (still inside the same sandboxed frame), and the export
lists the bundle CID under `files.pinned`. This only works for worlds that
build to static files; a world that needs its own server (a game backend)
stays a URL, and the export says so.

Open questions: a size limit for bundles, who pays for pinning large ones,
and whether the sandboxed frame needs its own origin when it serves pinned
files rather than the creator's domain.
