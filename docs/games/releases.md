# Game releases

A published game is a **release**: a fixed set of files stored outside the
repository and named by a hash of their contents. A small **pointer** says
which release each game's page loads. Publishing uploads a release; rolling
back moves the pointer and uploads nothing.

**The committed build is the default.** A game's page loads
`frontend/public/games/<id>/` until a person switches that game to hosted
releases with `pnpm games:release point <id>`. Publishing stores a release
and lists it in the pointer file, but moves the pointer only for a game
that is already switched. No game is switched today.

## Rules for coding agents

1. **Never edit a release.** To change a published game, change its source
   in `games/<id>/` and run `pnpm games:publish <id>`. That makes a new
   release with a new id. Storage refuses different files under an existing
   id.
2. **The working build is the draft.** `frontend/public/games/<id>/` is what
   the build writes and `pnpm games:check` checks. It is not a release until
   it is published. On the development server, `/games/<id>?draft` shows it.
3. **Use relative URLs inside a game.** A release is served from an address
   the game doesn't choose, so write `./assets/x.js` and keep Vite's
   `base: "./"`. An absolute path such as `/games/<id>/x.png` fails the
   check with `RELEASE_ESCAPES`.
4. **Don't ship a file named `oncyber-release.json`.** Every stored release
   gets one: its file list with sizes and hashes.
5. **Don't write the pointer by hand, and don't switch a game to hosted.**
   `pnpm games:release point <id>` is a person's decision. For a game that
   is switched, use `pnpm games:publish` and `pnpm games:release rollback`.
   The pointer moves only after the stored copy has been read back and
   every hash matches, and only to a host that sends what a release needs
   (below).
6. **Keep keys out of it.** With no settings, everything uses the local
   folder backend. `PINATA_JWT_KEY` is server-only and is never written to a
   pointer or a release.
7. **Leave the committed builds.** `frontend/public/games/<id>/` is what
   every game loads today and the fallback for a game with no pointer. A
   person removes it, not an agent.

## Commands

```sh
pnpm games:check <id>                  # includes the hosted stage, below
pnpm games:publish <id>                # build, check, store the release; moves the pointer of a hosted game
pnpm games:release list [<id>]         # every game in the catalog: what its page loads, and its stored releases
pnpm games:release point <id> [<rel>]  # switch the page to the newest (or named) stored release
pnpm games:release rollback <id>       # back to the release before the current one
pnpm games:release rollback <id> <rel> # to a named release (forward works too)
pnpm games:release verify <id> [<rel>] # read a stored release back, compare every hash
pnpm games:release upload <id>         # store the committed build as it is, no rebuild
pnpm games:release unpoint <id>        # back to the committed build; stored releases stay listed
pnpm games:release:test                # the tests for all of this
```

## How it fits together

| Piece        | Where                                            | What it does                                                                   |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Storage      | `scripts/games/releases/storage.mjs`             | `put` a release, `read` a file back. Backends: `local`, `pinata`.              |
| Pointer      | `scripts/games/releases/pointer.mjs`             | `current` release per game (or none) plus the last 20, each with its base URL. |
| Publish      | `scripts/games/releases/publish.mjs`             | Store, verify, list; move a hosted game's pointer. Checks the host's headers.  |
| Check stage  | `scripts/games/releases/stage.mjs`               | The `hosted` stage of `games:check`.                                           |
| Page reader  | `frontend/features/games/gameRelease.ts`         | Turns pointers into the frame's `src`. Unusable pointers are skipped.          |
| Local server | `frontend/pages/api/games/releases/[...path].ts` | Serves the local folder to the page, read-only, with the headers below.        |

The release id is the first 16 hex digits of the SHA-256 of every
`path:sha256` line, the same id `release.json` already carried. The stored
file list (`oncyber-release.json`) has no dates in it, so the same build
always stores as the same bytes, and on IPFS as the same CID.

### What is in a release

Everything in the build folder, except what the check writes about it:

| File                         | In the release (hashed and stored)? | Why                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the game's own files         | yes                                 | Including `licenses/*.txt`.                                                                                                                                                                  |
| `network.json`               | yes                                 | The hosts the game may reach ([trust.md](trust.md)), written by the check from `game.json`. The host's policy is built from it.                                                              |
| `credits.json`               | yes                                 | What the page's Credits panel shows ([credits.md](credits.md)), written by the check from `game.json`. The page reads it from where the frame loads, so the credits are the shown release's. |
| `check.json`, `release.json` | no                                  | Reports of one check and one publish, with dates. They stay in the committed folder for `/dev/games`.                                                                                        |
| `thumbnail.jpg`              | no                                  | The card picture the check captures ([listing.md](listing.md)). The site shows it where no frame is loaded; it stays in the committed folder, like `preview.jpg`.                            |
| `oncyber-release.json`       | stored, not hashed                  | The release's own file list, added by storage.                                                                                                                                               |

`RELEASE_REPORTS` in `storage.mjs` is the one list of the excluded files;
`games.mjs` lists a build with it.

### Backends

| Backend           | Release lives at                                     | Pointer file                                       | Needs                                      |
| ----------------- | ---------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `local` (default) | `.games-releases/<game>/<release>/` (ignored by git) | `.games-releases/pointers.json`                    | nothing                                    |
| `pinata`          | one pinned IPFS directory, `<gateway>/ipfs/<cid>/`   | `frontend/features/games/releases.json`, committed | `PINATA_JWT_KEY`, `GAMES_RELEASES_GATEWAY` |

Select with `GAMES_RELEASES_BACKEND`. `GAMES_RELEASES_DIR` moves the local
folder. The scripts read these from the shell's environment, not from
`frontend/.env.local`. A local publish never touches the committed pointer, so trying
things on a laptop cannot change production.

To add a backend, return `{ name, put, read }` from a function in
`storage.mjs` and add it to `releaseTarget` in `publish.mjs`. `put` must be
a no-op for the same files and refuse different files under the same id.

### What the page loads

`/games/<id>` asks `loadGameFrame` (server side) and takes the first that
applies:

1. `?draft` on the development server: the working build.
2. The local pointer, where the local folder is on (the development server,
   or any server with `GAMES_RELEASES_DIR` set) and a person pointed the
   game there.
3. The committed pointer, `frontend/features/games/releases.json`, for a
   game a person pointed.
4. The committed build, `/games/<id>/index.html`.

Everything that needs to know which build a visit shows uses that one
answer:

-   **The game page** gets the frame in its props and loads it.
-   **The kill switch** ([field-health.md](field-health.md)):
    `GAMES_DISABLED="<id>@<release>"` stops a hosted release by the id its
    pointer names, decided on the server before anything loads
    (`pauseForRelease`); the committed build's id is still read from its
    `release.json`. `GAMES_DISABLED="<id>"` stops the game wherever it
    loads from. Rolling the pointer back to a release that is not listed
    brings the game back.
-   **The lobby's hidden prepare frame**
    ([loading-and-pausing.md](loading-and-pausing.md)) asks
    `/api/games/paused?game=<id>`, which answers with the pause and the same
    frame, and prepares that address.
-   **Health reports** carry the pointer's release id for a hosted release.
-   **The Credits panel** reads `credits.json` and the licence texts from
    the release.
-   **The list of games** is the generated catalog
    ([listing.md](listing.md)): only a game in it can be pointed or
    uploaded.

The frame keeps `sandbox="allow-scripts allow-pointer-lock"` wherever it
loads from. The page accepts a base URL only if it is this app's releases
route for that game and release, or an `https` URL ending in `/` with no
credentials, query or fragment.

### What a host must send

A host of releases must send two headers with **every file of a release**:

1. `Access-Control-Allow-Origin: *`. The frame's origin is opaque, so the
   browser fetches the game's modules and files in CORS mode.
2. `Content-Security-Policy`: the game's own policy, built from the
   `network.json` inside that release, followed by
   `sandbox allow-scripts allow-pointer-lock`. This is the same policy
   `frontend/next.config.js` sends for a committed build
   ([trust.md](trust.md)): the game reaches its own files and the hosts it
   declared, nothing else. The sandbox keeps a release opened directly in a
   tab off the host's origin. `releaseContentSecurityPolicy()` in
   `frontend/features/games/networkPolicy.js` returns the exact value.

Without the second header a game loaded from that host could reach any
server, so the rule is enforced, not only written down:

-   The local backend sends both, from the development server's route and
    from the check's server (`serve.mjs`).
-   The `hosted` check stage fails with `RELEASE_CORS` or `RELEASE_POLICY`
    when a file is served without them, and runs the game under the policy:
    a request to an undeclared host is `NETWORK_UNDECLARED`, as in every
    other stage.
-   The pointer never moves to a host that does not send them: `point`,
    `rollback` and a hosted game's publish ask the host for the release's
    `index.html` first and stop if either header is missing.

A plain IPFS gateway sends neither a per-release policy nor, always, CORS.
A gateway used for production needs a proxy or a domain in front of it that
adds the policy from each release's `network.json` (decision 2 below).

Glasshouse Padel has its own page with a same-origin frame and keeps
loading its committed build until it moves into the sandbox.

## The check

`pnpm games:check <id>` runs a `hosted` stage after the browser check and
records it in `check.json` under `hosted`. With no keys and no network it:

1. publishes the checked files to a throwaway local-folder backend, points
   it at them and reads the pointer back;
2. stores the same files again (must be accepted) and different files under
   the same id (must be refused);
3. fetches every file over HTTP from the pointer's base URL and compares its
   SHA-256, and checks the CORS header and the game's policy;
4. opens the game from that address in the sandboxed frame, under that
   policy and the check's network watch, and waits for `ready`, watching
   for requests outside the release.

The stage runs after the saved-data stage and before the process stage.
The health stage also runs the kill switch's decision for the release as a
hosted one.

| Finding                 | Meaning                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `RELEASE_PUBLISH`       | Storing or verifying failed (for example a file changed).    |
| `RELEASE_POINTER`       | The pointer does not name the stored release.                |
| `RELEASE_HASH_MISMATCH` | A served file's hash differs from the checked build.         |
| `RELEASE_FILE_MISSING`  | A file is not served from the release address.               |
| `RELEASE_CORS`          | A file is served without `Access-Control-Allow-Origin: *`.   |
| `RELEASE_POLICY`        | A file is served without the game's Content-Security-Policy. |
| `RELEASE_MUTABLE`       | Storage accepted different files under an existing id.       |
| `RELEASE_BOOT`          | The game did not start from the release address.             |
| `RELEASE_ESCAPES`       | The game requested a file outside its release (rule 3).      |

Any finding fails the check, and a failed check publishes nothing.

## Before production: decisions for a person

These were chosen as the smallest reversible option and need confirming.

0. **Switching a game to hosted.** Nothing is switched. When a game should
   load from its release: publish it with the production backend, run
   `pnpm games:release point <id>` and commit the pointer file.
1. **Where the production pointer lives.** It is a committed JSON file, so a
   publish or rollback ships with a deploy and is reviewed like code. The
   alternative is a database record that changes without a deploy.
2. **Which Pinata account and gateway.** Nothing defaults to an Oncyber
   account. The gateway must serve HTML and JavaScript (Pinata limits this by
   plan and gateway setting) and must send both headers under "What a host
   must send"; a gateway alone cannot send each release's policy, so decide
   what sits in front of it. This has not been run against a real gateway:
   publish one game with real keys, run `pnpm games:release verify <id>`
   and `pnpm games:release point <id>` (which refuses a host without the
   headers), then load the page.
3. **One gateway is one server.** IPFS content can be re-pinned anywhere and
   keeps its CID, but the pointer stores one base URL. Decide whether to add
   a second gateway or a domain of Oncyber's in front of it.
4. **Who may publish.** Today it is whoever holds `PINATA_JWT_KEY` and can
   commit the pointer. Decide whether publishing runs in CI only.
5. **Retention.** Releases are never unpinned and the pointer keeps the last
   20 per game. Decide when old releases may be unpinned (rollback to an
   unpinned release would fail `verify`).
6. **Removing committed builds.** Once a game has a production pointer, its
   `frontend/public/games/<id>/` build (but not `preview.jpg` and
   `thumbnail.jpg`, which the lobby cards use, nor `check.json` and
   `release.json`, which `/dev/games` reads) can be deleted and the folder
   ignored. Until then it is the fallback. `next.config.js` reads each
   committed `network.json` for the committed build's policy.
7. **A frame policy.** The site sets no `frame-src` policy today. If one is
   added, it must allow the release gateway.
8. **Local folder in production.** Any server with `GAMES_RELEASES_DIR` set
   serves that folder at `/api/games/releases/`. Leave it unset on hosted
   deployments unless self-hosting releases is intended.
