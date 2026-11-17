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
   (below). A release on IPFS is never loaded from its gateway: the page
   loads it from the site's releases route.
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

| Piece           | Where                                            | What it does                                                                                                                                   |
| --------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage         | `scripts/games/releases/storage.mjs`             | `put` a release, `read` a file back. Backends: `local`, `pinata`.                                                                              |
| Pointer         | `scripts/games/releases/pointer.mjs`             | `current` release per game (or none) plus the last 20, each with its base URL.                                                                 |
| Publish         | `scripts/games/releases/publish.mjs`             | Store, verify, list; move a hosted game's pointer. Checks the host's headers.                                                                  |
| Check stage     | `scripts/games/releases/stage.mjs`               | The `hosted` stage of `games:check`.                                                                                                           |
| Page reader     | `frontend/features/games/gameRelease.ts`         | Turns pointers into the frame's `src`. Unusable pointers are skipped.                                                                          |
| Releases route  | `frontend/pages/api/games/releases/[...path].ts` | Serves a release to the page with the headers below: from the local folder, or from the IPFS gateway of a release the committed pointer lists. |
| Gateway request | `frontend/features/games/pinnedGateway.ts`       | The route's one outbound request: https, public addresses only, no redirect followed, a timeout.                                               |

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

| Backend           | Release lives at                                     | The page loads it from                                            | Pointer file                                       | Needs                                      |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `local` (default) | `.games-releases/<game>/<release>/` (ignored by git) | `/api/games/releases/<game>/<release>/`, read from the folder     | `.games-releases/pointers.json`                    | nothing                                    |
| `pinata`          | one pinned IPFS directory, `<gateway>/ipfs/<cid>/`   | `/api/games/releases/<game>/<release>/`, fetched from the gateway | `frontend/features/games/releases.json`, committed | `PINATA_JWT_KEY`, `GAMES_RELEASES_GATEWAY` |

Both variables of the `pinata` backend are for the publishing scripts. The
site needs neither: it reads each release's gateway address from the
committed pointer.

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

A pointer entry with backend `pinata` is different: its `base` is where the
site fetches from, not where the page loads from. The frame's `src` is
`/api/games/releases/<id>/<release>/index.html`, and everything above (the
prepare frame, the Credits panel, the kill switch, health reports) follows
that address. Such an entry is used only when its `address` is an IPFS CID
and its `base` is an `https` URL ending in `/ipfs/<that cid>/`; otherwise
the page loads the committed build (`pinnedGatewayBase` in
`gameRelease.ts`).

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

-   The local backend sends both, from the site's releases route and
    from the check's server (`serve.mjs`).
-   The `hosted` check stage fails with `RELEASE_CORS` or `RELEASE_POLICY`
    when a file is served without them, and runs the game under the policy:
    a request to an undeclared host is `NETWORK_UNDECLARED`, as in every
    other stage.
-   The pointer never moves to another `https` host that does not send
    them: for a backend whose address the page loads directly, `point`,
    `rollback` and a hosted game's publish ask the host for the release's
    `index.html` first and stop if either header is missing.
-   A release on IPFS is not loaded from its gateway, so the gateway is not
    asked for the headers. The site's releases route sends them (next
    section).

### The site in front of the gateway

A plain IPFS gateway sends neither a per-release policy nor, always, CORS.
So for the `pinata` backend the site's own releases route is the host:
`/api/games/releases/<game>/<release>/<path>`.

For a request the local folder does not answer (production has no local
folder), the route:

1. looks the game and release up in the committed pointer,
   `frontend/features/games/releases.json`. Any listed release counts, not
   only `current`, so a rollback needs nothing new. Not listed, or not a
   usable `pinata` entry: 404, and nothing is fetched;
2. reads the release's `network.json` from the entry's gateway folder and
   builds the policy with `releaseContentSecurityPolicy()`. The policy is
   kept in memory per release (a release never changes);
3. fetches `<base><path>` from the gateway and streams it back with
   `Access-Control-Allow-Origin: *`, the policy,
   `Cache-Control: public, max-age=31536000, immutable`,
   `X-Content-Type-Options: nosniff`, and a content type from the route's
   own table by file extension. Nothing the gateway sends as a header is
   passed on except the file's length.

What it refuses:

| Case                                                                 | Answer                              |
| -------------------------------------------------------------------- | ----------------------------------- |
| Game or release not in the committed pointer, or a bad path segment  | 404, nothing fetched                |
| Entry whose base is not `https://…/ipfs/<its cid>/`                  | 404, nothing fetched                |
| The gateway answers 404 for the file                                 | 404                                 |
| The gateway answers anything else but 200 (a redirect included)      | 502                                 |
| The gateway is silent for 15 seconds, or cannot be reached           | 502                                 |
| The gateway's name resolves to a private or loopback address         | 502                                 |
| `network.json` is missing (404) or malformed                         | the file, under "own files only"    |
| `network.json` cannot be read for another reason (5xx, timeout, ...) | 502, and it is read again next time |

The last two rows follow the local folder: a release with no declaration,
or a broken one, reaches only its own files. A gateway failure is not the
same thing, so no file is sent under a policy that was never read. Failures
are sent with `Cache-Control: no-store` and an empty body.

The address to fetch comes only from the committed pointer. A request
chooses a game, a release that file lists, and a path inside that
release's folder; each path segment is encoded, and `.`, `..`, empty
segments, slashes and control characters are refused.

What the scripts check for `pinata`, since the site is not running when a
release is published:

-   every file is read back from the gateway and its SHA-256 compared
    (`verifyRelease`), on publish, `point` and `rollback`. The read follows
    no redirect, as the route follows none;
-   the pointer entry is one the route accepts (a CID, an `https` base
    ending in `/ipfs/<cid>/`), and it is marked `"served": "site"`;
-   the route's headers are proved by its tests
    (`frontend/features/games/pinnedRelease.test.ts`), against a stand-in
    gateway. The `hosted` check stage still runs on the local folder
    backend; it does not start the site.

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

## Publish a game to Pinata

For a person with a Pinata account. An agent does not run these: switching
a game to hosted is a person's decision (rule 5).

You need a Pinata API key (JWT) that may pin files, and a gateway of that
account that serves HTML. Set three variables in the shell that runs the
commands; the scripts do not read `frontend/.env.local`, and the key is
never written to a file:

```sh
export GAMES_RELEASES_BACKEND=pinata
export PINATA_JWT_KEY=<the key>                                  # server-only, never commit it
export GAMES_RELEASES_GATEWAY=https://<your-gateway-host>        # origin only; /ipfs/<cid>/ is added
```

Then, for a game `<id>` from the catalog:

```sh
pnpm games:publish <id>          # build, check, pin the release, read every file back and compare hashes
pnpm games:release list <id>     # the release is listed; the page still uses the committed build
pnpm games:release point <id>    # read it back again, then switch the game's page to it
git add frontend/features/games/releases.json
git commit -m "Games: <id> loads its hosted release"
```

`pnpm games:release upload <id>` pins the committed build as it is, instead
of `games:publish`, when it should not be rebuilt.

`point` writes the game's entry into
`frontend/features/games/releases.json`: the release id, the CID, the
gateway folder and `"served": "site"`. Nothing changes for visitors until
that file is deployed. Open a pull request with it; the preview deployment
is where to try it:

1. Open `/games/<id>`. The frame's address is
   `/api/games/releases/<id>/<release>/index.html`, not the gateway.
2. Ask for one file and read its headers:
   `curl -sI https://<preview-host>/api/games/releases/<id>/<release>/index.html`.
   Expect `200`, `access-control-allow-origin: *`,
   `content-type: text/html; charset=utf-8` and a
   `content-security-policy` naming the hosts in the game's `network.json`
   and ending in `sandbox allow-scripts allow-pointer-lock`.
3. Play the game, open its Credits, and enter it from the lobby.

To try it before a deployment, run `pnpm dev` after `point`: the
development server reads the same committed file and serves the release
through the same route.

Afterwards, with the same three variables set:

```sh
pnpm games:publish <id>              # a new release; the pointer moves to it
pnpm games:release rollback <id>     # back to the one before; reads it back first
pnpm games:release verify <id>       # read the current release back from the gateway
pnpm games:release unpoint <id>      # back to the committed build
```

Each of these changes `releases.json`, except `verify`; commit and deploy
it.

### Not verified

None of this has run against Pinata or any real gateway. The storage code,
the scripts and the route are tested against stand-ins that behave as the
Pinata API and a gateway are documented to. Check these on the first real
publish:

-   that the upload returns a CID for the directory and that
    `<gateway>/ipfs/<cid>/index.html` answers `200` with the stored bytes
    (the publish fails if not, and says which file);
-   that the gateway answers a path with `200` and not a redirect. A
    gateway that redirects (to a subdomain address, for example) fails
    `verify` here and would be a `502` from the route; use one that does
    not;
-   that the gateway serves HTML and JavaScript on your plan, and answers
    requests from the site's servers, which send no key and no browser
    headers. A gateway restricted by key, host or address would work from
    your shell and fail from the site, or the other way round;
-   that the deployment streams large files through the route (models,
    audio) within its limits on response size and duration;
-   how long a first, uncached load takes with every file passing through
    the site, and whether the platform's CDN keeps the responses.

## Before production: decisions for a person

These were chosen as the smallest reversible option and need confirming.

0. **Switching a game to hosted.** Nothing is switched. When a game should
   load from its release, follow "Publish a game to Pinata" above.
1. **Where the production pointer lives.** It is a committed JSON file, so a
   publish or rollback ships with a deploy and is reviewed like code. The
   alternative is a database record that changes without a deploy.
2. **Which Pinata account and gateway.** Nothing defaults to an Oncyber
   account. What sits in front of the gateway is decided: the site's
   releases route ("The site in front of the gateway"). The gateway must
   serve HTML and JavaScript files as stored (Pinata limits this by plan
   and gateway setting) and answer the site's servers without a key or an
   allow-list. **This has not been run against a real gateway**: no keys
   exist where it was built. Follow "Publish a game to Pinata" below with
   one game and read its "Not verified" list.
3. **One gateway is one server, and the site is now in the path.** IPFS
   content can be re-pinned anywhere and keeps its CID, but each pointer
   entry stores one gateway address, fixed when the release was published.
   Every file of a hosted game is fetched by the site and passed on, so a
   game's files cost the site a function call and their bytes, once per
   file per cache. Decide whether a CDN in front of
   `/api/games/releases/` should keep them (the responses are public and
   immutable), and whether to add a second gateway to fall back to.
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
7. **A frame policy.** The site sets no `frame-src` policy today. A release
   on IPFS loads from the site's own route, so `'self'` covers it; another
   release host would need to be allowed.
8. **Local folder in production.** Any server with `GAMES_RELEASES_DIR` set
   serves that folder at `/api/games/releases/`, before the committed
   pointer is asked. Leave it unset on hosted deployments unless
   self-hosting releases is intended.
