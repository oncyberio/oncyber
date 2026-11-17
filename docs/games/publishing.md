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
(`gamesPreviewEnabled()`), like every other game.

## Signing in

The command uses the existing sign-in for terminal tools: it opens
`/cli-auth`, the signed-in visitor authorises, and the command exchanges the
code for a session token (`pages/api/_v2/cli/authorize.ts`, `exchange.ts`).
The token is saved to `~/.oncyber/credentials.json` with mode 600.

## The calls

RPC procedures in `frontend/pages/api/_v2/gamePublish/`, called like every
other procedure: `POST /api/_v2/gamePublish` with
`{ "type": "method", "method": "<name>", "params": [<input>], "token": "<session token>" }`.
All need a signed-in account that may publish.

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

-   `id`: `^[a-z0-9][a-z0-9-]{2,40}$`. Not an id in this repository's catalog.
    Free, or already owned by this account.
-   `manifest`: the game's `game.json`.
-   `entry`: the listing built from it (title, tagline, description, players,
    party sizes, devices, tags, crowd label), as `pnpm games:catalog` builds
    one. The site validates every field and sets the rooms itself.
-   `files`: every file of the release, as [releases.md](releases.md) lists a
    release (`network.json` and `credits.json` included; `check.json`,
    `release.json` and `thumbnail.jpg` are not hashed). At most 30 MiB and
    400 files. `thumbnail.jpg` may be uploaded beside them.
-   `check`: the command's own check result. It must say `passed` for these
    files. It is recorded as **self-reported**: the site has not run it.

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
already stored and nothing needs uploading. `upload.mode` is `site` (send
each file to the site) or `pinata` (send them to the storage address given;
see below).

### Uploading

Mode `site`: `PUT <url><path>` for each file, with the bytes as the body and
`Authorization: Bearer <session token>`. The site accepts only paths listed
in `begin`, checks size and SHA-256, and refuses anything else. This mode
needs a server with a disk (a development server, or a self-hosted one) and
keeps releases in the local releases folder.

Mode `pinata`: the site hands the command a short-lived address from its own
Pinata account, and the command uploads the release folder there directly,
so large files never pass through the site. `finish` then reads every file
back through the gateway and compares hashes before anything is registered.

### `finish`

Input: `{ "uploadId": "<id>" }`. The site verifies every file is stored with
the hash `begin` listed, writes the game's record, and answers:

```json
{
    "id": "my-game",
    "release": "<16 hex>",
    "url": "/games/my-game",
    "status": "unlisted"
}
```

### `mine`

No input. The account's games: `[{ id, title, status, release, publishedAt, url }]`.

### `unpublish`

Input: `{ "id": "my-game" }`. Only the owner. The game's page stops loading.
The id stays reserved for the owner.

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
            "check": "self-reported"
        }
    ],
    "createdAt": "<ISO date>",
    "updatedAt": "<ISO date>"
}
```

`status` is `unlisted` or `unpublished`. A person at Oncyber may set
`listed` later; nothing in the command can.

## What a published game gets

The game page loads a registered game exactly as it loads a catalogued one:
the same sandboxed frame, the release served by the site's releases route
with the game's own policy, the kill switch, and the page's identity,
avatar, party, chat and voice.

Not yet, for a registered game: recorded results and the leaderboard, saved
data on the server, and a card in the lobby.

## Trust

-   The frame is sandboxed and reaches only the hosts the release declares.
-   The check result is the creator's word until the site runs it itself.
-   Every file is hash-checked before a release is registered, and a release
    never changes.
-   `GAMES_DISABLED` stops a registered game like any other.
-   An account may hold at most 10 games and publish at most 20 releases a day.
