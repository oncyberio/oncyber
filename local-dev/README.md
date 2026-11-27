# Local data mode

`pnpm dev:local` (from the repository root) runs Oncyber on your machine with
no Firebase account, no keys and no access to Oncyber's data.

## What it starts

| Piece              | Where                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| The site           | http://localhost:13000                                                               |
| Firebase emulators | Auth `127.0.0.1:9099`, Firestore `:8085`, Realtime Database `:9000`, Storage `:9199` |
| Emulator data UI   | http://127.0.0.1:4000 (browse and edit every document)                               |
| Lobby server       | `127.0.0.1:2568`, installed into `multiplayer/` on first run                         |

The emulators run as the project `demo-oncyber`. Firebase treats any project
id starting with `demo-` as offline only, so nothing here can reach a real
project. The launcher sets every Firebase variable itself, so it ignores the
Firebase values in `frontend/.env.local` if you have one; other keys you put
there (an RPC URL, Pinata, ...) still apply.

## Requirements

-   Node 22 and pnpm, as for the rest of the repository.
-   Java 21 or newer, which the Firestore and Database emulators run on. If
    none is installed (or only an older one), the first run downloads a
    private copy of Eclipse Temurin 21 (a 50 MB download, 150 MB unpacked) into `local-dev/.java/`
    and uses it from there; nothing is installed system-wide.
-   The first run downloads the Firebase CLI (pinned in `start.mjs`) and the
    emulators, about 150 MB.

## Sample data

`fixtures/` is everything the emulators start with. It holds no one's account
and no private data:

-   `exhibits.json`: the **Welcome to Oncyber** space (`/welcome`), an empty
    world on the built-in grid terrain, owned by the demo account. It is the
    staff pick, so it leads the landing page.
-   `users.json`: the demo account `demo-user-1` (`@demo_curator`).
-   `curation.json`: the staff-pick list.
-   `destinations.json`: the template catalog shown in Create, copied from
    oncyber.io's public template list with author accounts replaced by
    `oncyber` (only the author's display name is kept).

To sign in, choose **Email** in the sign-in dialog and enter
**demo@example.com**. The emulator doesn't send mail: it prints the sign-in
link in the terminal running `pnpm dev:local`. Open it and you are the demo
account, so `/studio` opens the welcome space for editing. Any other address
works the same way and makes a new account.

To share a space you built locally as a fixture, copy its document from the
emulator UI (http://127.0.0.1:4000/firestore) into `exhibits.json`.

The engine loads some shared assets (sky, loading textures, default avatar
parts) from IPFS, so the first visit needs an internet connection.

The Storage emulator holds one thing: the releases of games published from
outside the repository, when the server is started with
`GAMES_PUBLISHING_STORAGE=on` ([docs/games/publishing.md](../docs/games/publishing.md)).
Without it those go to `.games-releases/`. `storage.rules` gives the
Firebase client SDKs nothing; only the site's server uses the bucket.

## Real spaces

The sample space is enough for most work. To debug a real space (a world
that misbehaves, an outside experience attached to a space, a world
script), copy it in. The stack must be running.

```sh
ONCYBER_BASE_URL=https://oncyber.io pnpm world login   # once: sign the terminal in to the real site
pnpm world spaces                                      # your spaces there: name, link, id
pnpm world import <link | id | address>                # a copy of one, here
```

`import` takes a space's link (`rayan`), its id, or its whole address
(`https://oncyber.io/rayan`). It copies the space, its placed objects and
portals, and the world it is built on, then prints where the copy opens:
the same link on `localhost:13000`.

-   **Only your own.** The site gives a copy to the space's owner and
    editors, and to Oncyber's site admins. Anyone else is told there is no
    such space.
-   **The copy is yours to break.** The demo account owns it, so sign in as
    demo@example.com to edit it in the Studio. Nothing done here reaches
    the real space. Importing again replaces the copy.
-   **Left off:** who owns and edits the real space, and its gate (a
    password or tokens cannot be checked here, so the copy opens for
    anyone). The command says what it left off.
-   **Files stay where they are.** Models, images and video load from the
    addresses the real space uses, so they need an internet connection. An
    outside experience (`awe-app`, `web`) is framed from its own address,
    as on the site. `pnpm world spaces` marks those spaces with what runs
    them.
-   **Where it writes.** To the Firestore emulator and nowhere else: the
    project is `demo-oncyber`, which Firebase keeps offline.

On a machine with no browser, sign in with `pnpm world login --code`
([docs/world-scripts.md](../docs/world-scripts.md), "Writing one in a
file"). `--from <site>` reads from another deployment, a preview for
instance; the terminal must be signed in to that one.

## Commands

```sh
pnpm dev:local              # start; keeps what you changed last time
pnpm dev:local --reset      # throw away local changes, reseed from fixtures/
pnpm dev:local --no-lobby   # don't start the lobby server
node local-dev/seed.mjs     # reseed into emulators that are already running
```

Emulator state is saved to `local-dev/.emulator-data/` when you stop with
Ctrl+C, and loaded on the next start. It is ignored by git.

## What doesn't work locally

-   Uploads need a Pinata key (`PINATA_JWT_KEY` in `frontend/.env.local`).
-   Asset optimization and other Cloud Functions are not emulated.
-   NFT lookups from wallets need the RPC and marketplace keys listed in
    `frontend/.env.example`.
