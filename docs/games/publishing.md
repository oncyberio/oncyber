# Publishing a game from outside the repository

A creator builds a game on their own machine, signs in and publishes it with
the `oncyber` command. The game then runs at `/games/<id>` inside Oncyber's
game page, with the visitor's avatar, party, chat and voice, like a game in
this repository. It is **unlisted**: reachable by its link, not shown in the
lobby.

This page is the contract between the command (`games/cli/`) and the site.
Games kept in this repository still publish with `pnpm games:publish`
([releases.md](releases.md)).

## The loop

```sh
oncyber new my-game          # a working starter game in ./my-game
cd my-game && npm install
oncyber dev                  # the game alone, on a local port
oncyber check                # the same checks as pnpm games:check
oncyber login                # opens the browser; saves a token
oncyber publish              # build, check, upload; prints the game's link
oncyber games                # what this account has published
oncyber unpublish my-game    # take it down
```

`ONCYBER_BASE_URL` chooses the site (default `https://oncyber.io`;
`http://localhost:13000` for a development server). `ONCYBER_SESSION_TOKEN`
stands in for a saved login.

## Who may publish

The site decides with `GAMES_PUBLISHING`:

| Value         | Meaning                                      |
| ------------- | -------------------------------------------- |
| unset         | Off. On the development server it is `open`. |
| `open`        | Any signed-in account.                       |
| `id1,id2,...` | Only these account ids.                      |

Registered games are served only where game pages are
(`gamesPreviewEnabled()`), like every other game. With publishing off,
every call below is refused, the upload address answers 404, and the games
already registered have no page and no served files.

## Signing in

The command uses the existing sign-in for terminal tools: it opens
`/cli-auth`, the signed-in visitor authorises, and the command exchanges the
code for a session token (`pages/api/_v2/cli/authorize.ts`, `exchange.ts`).
The token is saved to `~/.oncyber/credentials.json` with mode 600.

## The calls

RPC procedures in `frontend/pages/api/_v2/gamePublish/`, called like every
other procedure: `POST /api/_v2/gamePublish` with
`{ "type": "method", "method": "<name>", "params": [<input>], "token": "<session token>" }`.
All need a signed-in account that may publish. A refusal is the
procedure layer's usual error answer, `{ "type": "Error", "error": "<a
sentence for the creator>" }`: status 400 for input that does not fit the
shapes below, 401 without a session, 500 for everything the rules refuse.

### `begin`

Input:

```json
{
    "id": "my-game",
    "manifest": {},
    "entry": {},
    "files": [{ "path": "index.html", "bytes": 4419, "sha256": "<hex>" }],
    "check": {
        "status": "passed",
        "checkedAt": "<ISO date>",
        "release": "<16 hex>"
    }
}
```

-   `id`: `^[a-z0-9][a-z0-9-]{2,40}$`, with single dashes and none at the
    end. Not an id in this repository's catalog. It cannot contain `-party-`
    or end in `-party` (those spell party rooms). Free, or already owned by
    this account.
-   `manifest`: the game's `game.json`, at most 64 KiB. The site keeps
    nothing from it today; the listing is `entry`.
-   `entry`: the listing built from it, as `pnpm games:catalog` builds one.
    The site validates every field with the listing's rules
    ([listing.md](listing.md)) and keeps only these:

    | Field         | Rule                                                               |
    | ------------- | ------------------------------------------------------------------ |
    | `title`       | 1 to 60 characters, plain text                                     |
    | `tagline`     | 1 to 60 characters, plain text                                     |
    | `description` | 30 to 200 characters, plain text, no links                         |
    | `players`     | `{ min, max }`, whole numbers 1 to 500, `min` no larger than `max` |
    | `partySizes`  | whole numbers 2 to 8; optional                                     |
    | `devices`     | one or more of `desktop`, `phone`, `gamepad`                       |
    | `tags`        | one to six lowercase tags                                          |
    | `crowdLabel`  | at most 40 characters; optional                                    |

    Anything else in it (`id`, `thumbnail`, `room`, `socialRoom`, `relay`,
    `controlsStyle`, `ownPage`) is dropped, not refused, so a whole catalog
    entry may be sent. The site sets the rooms itself: no room of the
    game's own, no relay outside a party, and `oncyber-<id>-social-v1` for
    chat and voice.

-   `files`: every file of the release, as [releases.md](releases.md) lists a
    release (`network.json` and `credits.json` included; `check.json`,
    `release.json` and `thumbnail.jpg` are not hashed and must not be
    listed). At most 30 MiB and 400 files, and an `index.html` among them.
    `thumbnail.jpg` may be uploaded beside them. A path is relative, at most
    200 characters and 12 folders deep, and each of its names starts with a
    letter, digit or `_` and holds only letters, digits and `. _ - @ + ~`:
    no spaces, no dot files, no `..`, no name ending in a dot. No two paths
    may differ only by case, and `oncyber-release.json` is reserved.
-   `check`: the command's own check result. It must say `passed`, and its
    `release` must be the release id of `files`. It is recorded as
    **self-reported**: the site has not run it.

Output:

```json
{
    "uploadId": "<id>",
    "release": "<16 hex>",
    "stored": false,
    "upload": { "mode": "site", "url": "/api/games/uploads/<uploadId>/" }
}
```

`release` is the release id computed from `files`, the same id
`pnpm games:publish` gives. `stored: true` means this exact release is
already stored and nothing needs uploading: call `finish` straight away.
`upload.mode` is `site` (send each file to the site) or `pinata` (send them
to the storage address given; see below). An upload lasts 30 minutes;
after that, `begin` again. `begin` reserves nothing: the id becomes the
account's when `finish` registers its first release.

A server with no releases folder refuses `begin` with "Publishing is not
available on this server", unless its mode `pinata` is switched on.

### Uploading

Mode `site`: `PUT <url><path>` for each file, with the bytes as the body and
`Authorization: Bearer <session token>` (the header only: no cookie, query
or body token is read). The path is written as it was listed, with `/`
between its names. The site accepts only paths listed in `begin`, checks
size and SHA-256, and refuses anything else. A file may be sent again. This
mode needs a server with a disk (a development server, or a self-hosted
one) and keeps releases in the local releases folder.

| Answer | Meaning                                                                            |
| ------ | ---------------------------------------------------------------------------------- |
| 200    | Stored: `{ "path", "bytes", "sha256" }`                                            |
| 401    | No session token in the `Authorization` header, or not a valid one                 |
| 403    | The account may not publish here                                                   |
| 404    | No such upload for this account, a path `begin` did not list, or publishing is off |
| 405    | Not a `PUT`                                                                        |
| 409    | The upload is not a mode `site` one, or the server has no releases folder          |
| 410    | The upload expired                                                                 |
| 413    | More bytes than were listed (a wrong `Content-Length` is refused unread)           |
| 422    | The size or SHA-256 is not the listed one, or the thumbnail is not a JPEG          |

Refusals carry `{ "error": "<sentence>" }`. `thumbnail.jpg` is sent the same
way, to `<url>thumbnail.jpg`: a JPEG of at most 512 KiB. It is optional, and
kept beside the release, not in it.

Mode `pinata`: the site hands the command a short-lived address from its own
Pinata account, and the command uploads the release folder there directly,
so large files never pass through the site. `finish` then reads every file
back through the gateway and compares hashes before anything is registered.

**This mode is off, and has never run against Pinata.** The site answers
with it only when a person sets `GAMES_PUBLISHING_PINATA=car` on a server
that has `PINATA_JWT_KEY` and `GAMES_RELEASES_GATEWAY` and no releases
folder; otherwise such a server refuses `begin`. The command may refuse an
upload of mode `pinata`. Its provisional shape:

```json
{
    "mode": "pinata",
    "url": "<signed upload address>",
    "expires": 1800,
    "as": "car"
}
```

Pinata documents signed upload addresses for one file, and says its
current upload endpoint takes no folders, so the release folder (with its
`oncyber-release.json`) would travel as one CAR file: one multipart `POST`
to `url` with fields `file`, `network=public` and `car=true`. The command
then calls `finish` with the folder's CID as `address`. See "Not verified"
below.

### `finish`

Input: `{ "uploadId": "<id>" }`, and for mode `pinata` also
`"address": "<the folder's CID>"`. The site verifies every file is stored
with the hash `begin` listed, writes the game's record, and answers:

```json
{
    "id": "my-game",
    "release": "<16 hex>",
    "url": "/games/my-game",
    "status": "unlisted"
}
```

An upload finishes once. Publishing a release the game already lists makes
it the current one again and stores nothing.

### `mine`

No input (`"params": []`). The account's games:
`[{ id, title, status, release, publishedAt, url }]`, unpublished ones
included.

### `unpublish`

Input: `{ "id": "my-game" }`. Only the owner. Answers
`{ "id": "my-game", "status": "unpublished" }`. The game's page stops
loading and its releases stop being served (within ten seconds on other
server instances). The id stays reserved for the owner, and publishing
again brings the game back.

## What the site keeps

One record per game in the `publishedGames` collection:

```json
{
    "id": "my-game",
    "owner": "<account id>",
    "status": "unlisted",
    "entry": {},
    "current": "<16 hex>",
    "releases": [
        {
            "release": "<16 hex>",
            "backend": "local",
            "address": "<cid, for pinata>",
            "base": "<gateway base, for pinata>",
            "publishedAt": "<ISO date>",
            "files": 15,
            "bytes": 1650000,
            "check": "self-reported",
            "thumbnail": true
        }
    ],
    "createdAt": "<ISO date>",
    "updatedAt": "<ISO date>"
}
```

`status` is `unlisted` or `unpublished`. A person at Oncyber may set
`listed` later; nothing in the command can. `releases` keeps the last 20.
`thumbnail` is there when a `thumbnail.jpg` is stored beside the release.
The rooms are not in the record: the site makes them from the id each time.

Two more collections hold what is in flight: `gameUploads/<uploadId>` (an
upload between `begin` and `finish`; `expireAt` is there for a Firestore
TTL policy) and `gamePublishers/<account id>` (the account's game ids and
today's counts).

## What a published game gets

The game page loads a registered game exactly as it loads a catalogued one:
the same sandboxed frame, the release served by the site's releases route
with the game's own policy, the kill switch, and the page's identity,
avatar, party, chat and voice.

Not yet, for a registered game:

-   **Recorded results and the leaderboard.** The page still shows the
    result card and passes it to the party; the game hears
    `result-status` `unrecorded` with reason `NOT_RECORDED`.
-   **Saved data.** The site holds no declarations for a registered game,
    so every `saved` request is answered `undeclared`, on the server and in
    the browser.
-   **A card in the lobby**, and with it the lobby's hidden prepare frame:
    arriving from the lobby loads the game when the page opens.
-   **The working build**: `?draft` does nothing for a registered game.

## Trust

-   The frame is sandboxed and reaches only the hosts the release declares.
-   The check result is the creator's word until the site runs it itself.
-   Every file is hash-checked before a release is registered, and a release
    never changes.
-   `GAMES_DISABLED` stops a registered game like any other.
-   An account may hold at most 10 games and publish at most 20 releases a
    day (UTC), and may begin at most 60 uploads a day.
-   A registered game never takes a catalogued game's id, its rooms or its
    saved data: the id is refused, the rooms are made from the id by the
    site, and nothing is saved for it.
-   The upload address takes only the paths `begin` listed, compared as
    whole strings, streams each body to disk cut off at its listed size,
    and keeps it only if its SHA-256 matches. The site chooses every
    content type by file extension when it serves; the uploader chooses
    none.
-   The releases route serves a game outside the catalog only as its record
    says: published, the release listed, and not stopped. Files in the
    releases folder under an id nobody registered are not served.

## The site's settings

| Variable                  | What it does                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GAMES_PUBLISHING`        | Who may publish (above). Server-only.                                                                     |
| `GAMES_PREVIEW`           | `1` shows game pages outside the development server; publishing follows it.                               |
| `GAMES_RELEASES_DIR`      | The local releases folder, where mode `site` stores. On by default on the development server.             |
| `GAMES_DISABLED`          | The kill switch ([field-health.md](field-health.md)): `<id>` or `<id>@<release>` stops a registered game. |
| `GAMES_PUBLISHING_PINATA` | `car` switches mode `pinata` on. Not verified; leave unset.                                               |
| `SECRET_JWT_KEY`          | Signs the session tokens the command sends.                                                               |

The code: the rules in `frontend/features/games/publishedGames.ts`, the
store and the folder in `publishedGamesServer.ts`, the procedures in
`frontend/pages/api/_v2/gamePublish/`, the upload address in
`frontend/pages/api/games/uploads/[...path].ts`, and mode `pinata` in
`pinnedUploads.ts`.

## Try it locally

With no keys: `pnpm dev:local` runs the site on Firebase emulators
([local-dev/README.md](../../local-dev/README.md)), where publishing is
open and releases go to `.games-releases/` at the repository root.

```sh
pnpm dev:local --no-lobby                 # the site on http://localhost:13000
export ONCYBER_BASE_URL=http://localhost:13000
oncyber login                             # sign in as demo@example.com: the emulator
                                          # prints the sign-in link in the first terminal
oncyber publish                           # prints http://localhost:13000/games/<id>
```

Without a browser, mint a session token for the demo account with the
development server's signing key and hand it to the command:

```sh
export ONCYBER_SESSION_TOKEN=$(cd frontend && node -e '
  console.log(require("jsonwebtoken").sign(
    { user: "demo-user-1" },
    "local-dev-session-signing-key-not-for-production",
    { expiresIn: "1h" }))')
```

Then check what a visitor gets. Pages refuse tools' own user agents
(`frontend/middleware.ts`), so name a browser's for the page:

```sh
curl -sI -A "Mozilla/5.0" http://localhost:13000/games/<id>                    # 200
curl -sI http://localhost:13000/api/games/releases/<id>/<release>/index.html   # 200, the release headers
oncyber unpublish <id>                                                         # both answer 404
```

The records are in the emulator's data browser
(http://127.0.0.1:4000/firestore) under `publishedGames`.

## Not verified

-   **Mode `pinata` has not run against Pinata or a gateway.** No keys exist
    where it was built. What is tested, against stand-ins: the request for a
    signed upload address (`POST https://uploads.pinata.cloud/v3/files/sign`
    with `network`, `expires`, `filename`, `max_file_size`, answering
    `{ "data": "<url>" }`, as Pinata documents it); `finish` reading every
    file back through the gateway and refusing a missing, longer or
    different one; and the releases route serving the registered release.
    What is not known: whether a signed address accepts a CAR file (`car`)
    and returns the folder's CID, whether `max_file_size` is enforced for
    it, and everything [releases.md](releases.md) lists as not verified
    about gateways. Until a person has run it, leave
    `GAMES_PUBLISHING_PINATA` unset.
-   **Mode `site` on a host with more than one server**: the releases folder
    must be one disk they share.
