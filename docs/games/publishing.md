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
oncyber health my-game       # how it starts and runs for real visitors, by device
oncyber link my-game sky-run # also at /sky-run, when the name is free
oncyber link my-game --clear # give the name up; /games/my-game stays
oncyber unpublish my-game    # take it down
```

The check also prints the scene profile, and `publish` repeats its
warnings after the link: what the build makes a visitor wait for and draw,
with what to change ([scene-profile.md](scene-profile.md)). They do not stop
a publish.

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

### `health`

Input `{ "id": "my-game" }`. The game's field health for whoever made it
([field-health.md](field-health.md), "Reading it back"): per release, the
visits, time to first frame and frame times for each kind of device, what
failed, and `findings`, each a code and a sentence that says what to do.
The game's own account, or a site admin for any game.

### `begin`

Input:

```json
{
    "id": "my-game",
    "manifest": {},
    "entry": {},
    "files": [
        {
            "path": "index.html",
            "bytes": 4419,
            "sha256": "<hex>",
            "md5": "<hex>"
        }
    ],
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
    `controlsStyle`) is dropped, not refused, so a whole catalog
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
    `md5` is optional: the file's MD5, 32 hex digits. Only mode `storage`
    uses it, to have the storage refuse other bytes as they arrive. It is
    no part of the release id, and a release is verified by its SHA-256s.
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
An upload lasts 30 minutes; after that, `begin` again. `begin` reserves
nothing: the id becomes the account's when `finish` registers its first
release.

`upload.mode` says where the files go:

| Mode      | The command sends                                     | Releases are kept in                        | For                                        |
| --------- | ----------------------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| `site`    | each file to the site, with the session token         | the local releases folder                   | a development server, or a self-hosted one |
| `storage` | each file to its own signed address in the storage    | the site's Firebase Storage bucket, private | production: a host with no disk of its own |
| `pinata`  | one archive to a signed address (off, and unverified) | IPFS, read through a gateway                | later                                      |

A server answers with the first of these that it has:

1. `storage`, when `GAMES_PUBLISHING_STORAGE=on` and a bucket is
   configured. This is how a development server, which has a releases
   folder, is made to use its bucket.
2. `site`, when it has a local releases folder (`GAMES_RELEASES_DIR`; on by
   default on the development server).
3. `storage`, when a bucket is configured (`GAMES_STORAGE_BUCKET`, or else
   the Firebase project's `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`) and
   `GAMES_PUBLISHING_STORAGE` is not `off`.
4. `pinata`, when a person switched it on (`GAMES_PUBLISHING_PINATA=car`).

With none of them, `begin` is refused with "Publishing is not available on
this server".

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

Mode `storage`: `begin` answers

```json
{
    "mode": "storage",
    "expires": 1800,
    "files": [
        {
            "path": "index.html",
            "url": "https://storage.googleapis.com/<bucket>/games-staging/<uploadId>/index.html?X-Goog-Algorithm=...",
            "headers": {
                "Content-Type": "application/octet-stream",
                "Content-MD5": "<base64>",
                "x-goog-content-length-range": "4419,4419",
                "x-goog-if-generation-match": "0"
            }
        }
    ]
}
```

with one entry for every listed file and one more for `thumbnail.jpg`
(which the command may leave unused). `files` is empty when `stored` is
true. For each file the command sends `PUT <url>` with the bytes as the
body and **exactly** the `headers` given, and nothing else of its own: no
session token, no cookie. The address is the credential, it is not on the
site's origin, and the token never goes anywhere but the site. The command
takes an address only if it is `https` (or plain `http` to this machine,
for a development server's emulator), sends a few files at a time, and
tries a file once more when the connection fails or the storage answers
5xx.

| Answer | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| 200    | Stored                                                                          |
| 400    | Not the listed size, or not the bytes of the listed MD5                         |
| 403    | The address expired, or a header is not the one that was signed                 |
| 412    | The object is already there: an address writes once. The command counts it sent |

Each address is a V4 signed URL of Cloud Storage, good for 30 minutes and
for one object: `games-staging/<uploadId>/<path>`. What it signs, and so
what the storage enforces:

-   the object's name, so nothing is written anywhere else;
-   `x-goog-content-length-range`: exactly the listed size (for the
    picture, at most 512 KiB);
-   `Content-MD5`, when `begin` listed an `md5`: only those bytes;
-   `x-goog-if-generation-match: 0`: the object is created, never replaced;
-   `Content-Type: application/octet-stream`: the uploader names no type.
    The site chooses every content type when it serves.

Nothing is served from `games-staging/`. `finish` reads every staged file
once, checks its size and SHA-256, and copies that very version of it (its
generation) to `games/<id>/<release>/`, where only the site's server
writes and nothing is ever replaced. So an address that is still valid
after `finish`, or an upload racing it, cannot change a file a visitor is
served. See "Setting up mode `storage`" below.

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

In mode `storage`, `finish` is where the work is: every file is read from
the bucket once to hash it (Cloud Storage keeps an MD5 and a CRC32C of an
object, not a SHA-256), then copied inside the bucket. That is one
metadata read, one download and one copy per file, at most 30 MiB read in
all, a few files at a time; the server never holds a whole file in
memory. A `finish` that finds files missing or wrong registers nothing,
removes the wrong ones from staging, and may be called again once they are
sent. Staged files are removed after a `finish` that registered, and when
`finish` is called on an expired upload; anything else left in staging is
for the bucket's lifecycle rule (below).

### `mine`

No input (`"params": []`). The account's games:
`[{ id, title, status, release, publishedAt, url, slug }]`, unpublished
ones included. `url` is the game's canonical address: `/<slug>` when it has
one, else `/games/<id>`. `slug` is null without one.

### `link`

Input: `{ "id": "my-game", "slug": "sky-run" }` to claim the address
`/sky-run`, `{ "id": "my-game", "slug": null }` to give it up. Only the
owner. Answers `{ "id": "my-game", "slug": "sky-run", "url": "/sky-run" }`.

A slug is 3 to 40 lowercase letters and digits, in words joined by single
dashes. It is one name among the site's: the claim is refused when the name
is one of the site's own pages or a catalogued game's
(`/<slug> is taken; choose another link.`), another published game's
(`/<slug> is another game's link; choose another.`) or a space's
(`/<slug> is a space's link; choose another.`). The check and the claim
are one transaction, and a space asking for the name afterwards is refused
by the same claim. Claiming a new slug gives the old one up. `/games/<id>`
answers whether or not the game has a slug, and `finish` and `mine` answer
with the slug's address once there is one.

A game keeps its slug across releases and when it is unpublished; give it
up to free the name.

### `unpublish`

Input: `{ "id": "my-game" }`. Only the owner. Answers
`{ "id": "my-game", "status": "unpublished" }`. The game's page stops
loading and its releases stop being served (within ten seconds on other
server instances). The id stays reserved for the owner, and publishing
again brings the game back.

Stored releases are kept, in every mode: the id is still the owner's, and
publishing a release the game already lists needs no upload. Nothing of an
unpublished game is served. To delete its files, a person removes
`games/<id>/` from the bucket (or the game's folder from the releases
folder) by hand.

## What the site keeps

One record per game in the `publishedGames` collection:

```json
{
    "id": "my-game",
    "owner": "<account id>",
    "status": "unlisted",
    "slug": "sky-run",
    "entry": {},
    "current": "<16 hex>",
    "releases": [
        {
            "release": "<16 hex>",
            "backend": "local | storage | pinata",
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
A `storage` release records no bucket and no object name: the server reads
it from `games/<id>/<release>/` in the bucket it is configured with, a
place made from the record's own id and release.
The rooms are not in the record: the site makes them from the id each time.
`slug` is there only while the game holds one, and each held slug has a
claim, `gameLinks/<slug>` (`{ game, owner, claimedAt }`): the document a
space's link and another game's claim are checked against, and what
`/<slug>` is resolved from.

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
-   In mode `storage` the bucket stays private. A creator's command can
    create objects under its own upload's staging folder and do nothing
    else: it cannot read, list, replace or delete, and cannot name another
    upload's folder or a release's. The site reads a release from the
    bucket itself and passes it on through the releases route with that
    route's headers; no visitor is ever given an address in the bucket or
    sent to it. What the bucket says when it fails stays in the server's
    log: the creator and the visitor get a sentence or a 502.

## The site's settings

| Variable                   | What it does                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GAMES_PUBLISHING`         | Who may publish (above). Server-only.                                                                                       |
| `GAMES_PREVIEW`            | `1` shows game pages outside the development server; publishing follows it.                                                 |
| `GAMES_RELEASES_DIR`       | The local releases folder, where mode `site` stores. On by default on the development server.                               |
| `GAMES_DISABLED`           | The kill switch ([field-health.md](field-health.md)): `<id>` or `<id>@<release>` stops a registered game.                   |
| `GAMES_PUBLISHING_STORAGE` | Mode `storage`: unset uses the bucket where there is no releases folder; `on` uses it even where there is one; `off` never. |
| `GAMES_STORAGE_BUCKET`     | The bucket for mode `storage`. Unset: the Firebase project's bucket, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.                 |
| `FIREBASE_ADMIN_*`         | The service account that signs the upload addresses and reads and writes the bucket. Server-only.                           |
| `GAMES_PUBLISHING_PINATA`  | `car` switches mode `pinata` on. Not verified; leave unset.                                                                 |
| `SECRET_JWT_KEY`           | Signs the session tokens the command sends.                                                                                 |

The code: the rules in `frontend/features/games/publish/publishedGames.ts`, the
store and the folder in `publishedGamesServer.ts`, the procedures in
`frontend/pages/api/_v2/gamePublish/`, the upload address in
`frontend/pages/api/games/uploads/[...path].ts`, mode `storage` in
`publishedGamesStorage.ts` over the bucket in `releaseBucket.ts`, and mode
`pinata` in `pinnedUploads.ts`.

`ReleaseBucket` in `releaseBucket.ts` is all the site asks of a store:
sign an upload address, read, copy one version to a new name, create,
list, remove. Another store is another implementation of it. A release
never changes and is named by the hash of its files, with the same layout
in the bucket as in the local releases folder (`<id>/<release>/<path>`,
with `oncyber-release.json` and `thumbnail.jpg` beside the files), so
moving releases to another store later is a copy.

## Setting up mode `storage`

For a person with access to the site's Firebase project. An agent does not
run these.

1. **Enable Storage** on the Firebase project (Firebase console, Build,
   Storage, Get started), in the region the site's server runs in. The
   bucket's name is the project's `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. To
   keep games apart from anything else the project stores, make a second
   bucket in the Google Cloud console instead (uniform bucket-level
   access, public access prevention **enforced**) and name it in
   `GAMES_STORAGE_BUCKET`.
2. **Keep it private.** Do not grant `allUsers` or `allAuthenticatedUsers`
   anything on the bucket. For the project's own bucket, the Firebase
   Storage rules decide what the Firebase client SDKs may do, so they must
   give nothing under the two prefixes:

    ```
    match /games/{all=**} { allow read, write: if false; }
    match /games-staging/{all=**} { allow read, write: if false; }
    ```

    The site's server does not go through these rules. A bucket made in
    the Cloud console, never added to Firebase, has none to set.

3. **The service account.** The site signs addresses and reaches the bucket
   as the service account in `FIREBASE_ADMIN_*`. It needs, on the bucket,
   `storage.objects.create`, `get`, `list` and `delete`: the role **Storage
   Object Admin** (`roles/storage.objectAdmin`). The Firebase Admin SDK's
   default service account normally has this already; grant it on the
   bucket if `begin` or `finish` say the storage did not answer. With the
   account's private key in `FIREBASE_ADMIN_PRIVATE_KEY`, as the site is
   set up, addresses are signed on the server with that key and nothing
   more is needed. Only a server that runs as a service account _without_
   a key file (application default credentials) signs through the IAM API,
   and then that account also needs `iam.serviceAccounts.signBlob` on
   itself: the role **Service Account Token Creator**.
4. **No CORS.** The command is not a browser, and visitors' browsers never
   talk to the bucket, so the bucket needs no CORS configuration. Leave it
   with none.
5. **A lifecycle rule for staging.** Uploads nobody finished stay under
   `games-staging/` until something removes them. Add a rule that deletes
   objects there after a day (Cloud console, the bucket, Lifecycle; or
   `gcloud storage buckets update gs://<bucket> --lifecycle-file=rule.json`):

    ```json
    {
        "rule": [
            {
                "action": { "type": "Delete" },
                "condition": { "age": 1, "matchesPrefix": ["games-staging/"] }
            }
        ]
    }
    ```

    Set no lifecycle rule, retention policy or object versioning that
    touches `games/`: releases there are kept.

6. **Switch it on.** On the server: `GAMES_PREVIEW=1`, `GAMES_PUBLISHING`
   (start with a list of account ids), the bucket's name as above, and no
   `GAMES_RELEASES_DIR`. `begin` then answers with mode `storage`.
7. **Try it once**, with the command, as "Not verified" below asks:
   publish a small game, open its page, send a file again to an address
   after `finish`, and send a larger file to an address, and see the
   last two change nothing and be refused.

`finish` runs inside one request: on a serverless host give the
`/api/_v2/gamePublish` function enough time for a 30 MiB release (a
minute is ample) and note that `begin` signs up to 401 addresses, which is
quick with a key and slow through the IAM API.

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
oncyber link <id> sky-run && curl -sI -A "Mozilla/5.0" http://localhost:13000/sky-run   # 200, the same page
oncyber unpublish <id>                                                         # all three answer 404
```

The records are in the emulator's data browser
(http://127.0.0.1:4000/firestore) under `publishedGames`.

To try mode `storage` with no keys, start the server with the switch:

```sh
GAMES_PUBLISHING_STORAGE=on pnpm dev:local --no-lobby
```

`pnpm dev:local` runs the Storage emulator too, and the server then keeps
releases in its bucket (`demo-oncyber.appspot.com`; browse it at
http://127.0.0.1:4000/storage) instead of `.games-releases/`. The emulator
does not implement signed URLs, nor the `PUT /<bucket>/<object>` they are
for, so on the emulator `begin` hands out the address of an upload session
of the emulator instead: still one `PUT` of the bytes to an address that
names one object, so the command does the same thing. Everything after the
upload is the same code as production: `finish` reading, hashing and
copying, the record, and the releases route serving from the bucket. What
the emulator leaves unproven is listed below.

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
-   **Mode `storage` has not run against Cloud Storage.** No project or key
    exists where it was built. What has run: the whole loop with the real
    command against `pnpm dev:local` and the Storage emulator (publish, the
    page in a browser, a second release, unpublish); the site's tests
    against a stand-in bucket; and the storage library's own V4 signer,
    with a key made for the test, checked to sign the object's name and
    each header listed above. What a person must check on the first real
    run, because the emulator does none of it:
    -   that Cloud Storage accepts the signed `PUT` at all with these
        headers (the signature, and the address surviving the command's
        HTTP client unchanged for paths holding `@ + ~`);
    -   that it refuses a body of another size
        (`x-goog-content-length-range`), other bytes (`Content-MD5`), a
        second write (`x-goog-if-generation-match: 0`, expected as 412)
        and an expired address;
    -   that the copy at `finish` honours the source generation and the
        create-only precondition (the emulator ignores preconditions, so
        there the code looks before it writes), and leaves the copy with
        the content type the server names;
    -   the service account's permissions, and `iam.serviceAccounts.signBlob`
        where the server has no key file;
    -   that the bucket is private: the emulator has no access control and
        answers anyone on this machine;
    -   the time `begin` and `finish` take for a release near the limits on
        the real host.
