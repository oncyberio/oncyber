# oncyber

The `oncyber` command: build a game for Oncyber on your own machine, without
a checkout of the Oncyber repository, and publish it. The package carries
the game SDK (the lifecycle runtime and the avatar, locomotion and UI kits),
the checks a published game is held to, the docs, and a starter game.

The site's half of publishing is described in
[docs/games/publishing.md](../../docs/games/publishing.md); this package is
the command's half.

## Install

The package is **not on npm**. Until a person publishes it there, install it
from a tarball made from a checkout of the repository:

```sh
cd games/cli && npm pack            # writes oncyber-<version>.tgz
```

Then, in the folder your games will live in:

```sh
npm init -y
npm install /path/to/oncyber-<version>.tgz
npx oncyber --help                  # or add node_modules/.bin to PATH
```

It needs Node 22.18 or newer. `oncyber check` and `oncyber publish` also
need Playwright with a Chromium, which the package does not install:

```sh
npm install --save-dev playwright && npx playwright install chromium
```

(`PW_CHANNEL=chrome` checks in an installed Chrome instead.)

## The loop

```sh
oncyber new my-game --name "My Game"   # a working starter game in ./my-game
cd my-game && npm install
oncyber docs                 # how a game fits Oncyber; `oncyber docs --list`
oncyber dev                  # the game alone, on a local port
oncyber check                # the same checks as the repository's pnpm games:check
oncyber login                # opens the browser; saves a token
oncyber publish              # build, check, upload; prints the game's link
oncyber games                # what this account has published
oncyber link my-game sky-run # also at /sky-run, when the name is free
oncyber unpublish my-game    # take it down
```

| Command                       | What it does                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new <id> [--name "Name"]`    | Writes the starter into `./<id>`: a small, complete game (walk a courtyard, catch lanterns, alone or with a party) that passes `check` as created. The id is 3 to 32 lowercase letters, digits or dashes. |
| `dev [-- <vite arguments>]`   | `npm run dev` in the game's folder.                                                                                                                                                                       |
| `build`                       | `npm run build`: the game to `./dist`.                                                                                                                                                                    |
| `check [--video] [--headed]`  | Runs every stage of the check on `./dist` in a real browser. Exits 0 when the game passes. The report is `.oncyber/check.json`, the screenshots are in `.check/`.                                         |
| `login`, `logout`             | Sign in through the site's `/cli-auth` page. The token is saved to `~/.oncyber/credentials.json` (mode 600) with the site it is for, and is only ever sent to that site.                                  |
| `publish [--video]`           | Builds, checks, and only when the check passes sends the release to the site: `begin`, each file with its SHA-256, `finish`. Prints the game's link. The game is unlisted.                                |
| `games [--json]`              | The account's games: id, title, status, release, date, link.                                                                                                                                              |
| `unpublish <id>`              | Takes a game down. The id stays the owner's.                                                                                                                                                              |
| `link <id> <slug>`            | Gives a published game the address `/<slug>` beside `/games/<id>`, when no page, space or other game has the name. `link <id> --clear` gives it up.                                                       |
| `docs [topic]`, `docs --list` | Prints the guide (`games/llms.txt`), or a page of `docs/games/` by name: `oncyber docs party`.                                                                                                            |

## Environment

| Variable                | Meaning                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `ONCYBER_BASE_URL`      | The site. Default `https://oncyber.io`; `http://localhost:13000` for a development server.             |
| `ONCYBER_SESSION_TOKEN` | A session token, used in place of a saved login.                                                       |
| `GAMES_CHECK_TIMEOUT_S` | How long the check waits for the game's report. Default 180; set 600 or more on a machine with no GPU. |
| `GAMES_CHECK_VIDEO=1`   | The same as `check --video`: record the bot's run to `.check/bot.webm`.                                |
| `PW_CHANNEL`            | `chrome` to check in an installed Chrome.                                                              |

## A game's folder

```
my-game/
  BRIEF.md         what the game is; the check reads it
  game.json        the manifest
  package.json     "oncyber": { "id": "my-game" } is the id it publishes under
  vite.config.js   export default oncyberGame()
  src/  test/  public/  scenario.json  bot.json
  dist/            the build (ignored)
  .oncyber/        check.json (ignored)
  .check/          the check's screenshots and video (ignored)
```

`vite.config.js` is a few lines: `oncyberGame()` from `oncyber/vite` maps
`@oncyber/game-runtime/*`, `@oncyber/avatar-kit`, `@oncyber/kit-locomotion`
and `@oncyber/game-ui` to the source this package carries, and builds to
`./dist` with relative URLs. Pass your own Vite settings as its argument.

A new game's `package.json` names this package by where it is installed
(`"oncyber": "file:..."`), because it is not on npm. Change that line if you
move the game.

## What works outside the repository, and what does not

Works: creating, running, building and checking a game; signing in;
publishing; listing and unpublishing. `oncyber publish` uploads the way the
site asks it to:

-   mode `site`: each file to the site itself, with the session token (a
    development server or a self-hosted one);
-   mode `storage`: each file straight to the site's storage bucket,
    through a short-lived address the site signed for that one file, a few
    files at a time. The address is the credential, so the session token
    is not sent there: it only ever goes to the site. The command sends
    exactly the headers the site names, refuses an address that is not
    `https` (plain `http` is taken for this machine only), and tries a file
    once more when the connection fails. The site verifies every file
    before it registers the release. Not yet run against a real bucket:
    see "Not verified" in the contract.

Different from the repository:

-   The check holds the game to the contract as a listed game is held, and
    skips three steps that only mean something in the repository: the
    generated catalog, the saved-data declarations the page reads, and
    `THIRD_PARTY_NOTICES.md`.
-   Licence exceptions (`games/licenses.json` in the repository) are a
    person's decision about one of the repository's games. Outside it there
    are none: every bundled file needs an allowed licence.
-   The avatar kit's lobby motion clips (`@oncyber/avatar-kit/motion/*`) are
    not in the package: they have no recorded licence. Generate clips in
    code, as the starter's `src/motion.js` does.
-   `pnpm games:score` and the lobby recording of the departure check
    (`--lobby`) are repository tools.

Not yet:

-   Upload mode `pinata` (a site that stores releases on IPFS). The contract
    calls that mode provisional and unverified, and lets the command refuse
    it. The command does: it stops with nothing uploaded and says so.
-   For a published game: recorded results and the leaderboard, saved data
    on the server, and a card in the lobby (the site's side; see the
    contract).

## Working on the command

```sh
pnpm games:cli:test          # from the repository root
node games/cli/bin/oncyber.mjs --help   # runs from the checkout, no pack needed
node games/cli/test/standin.mjs 4010    # a stand-in site to publish to by hand
node games/cli/test/standin.mjs 4010 storage   # the same, answering with upload mode `storage`
```

`npm pack` runs `scripts/prepack.mjs`, which copies the runtime, the kits,
the check tool (`scripts/games/`), the docs and the starter's template
(`games/lantern-tag/`) into `sdk/`, laid out as in the repository, and
removes the copy afterwards. Nothing is copied by hand, so the package is
whatever the repository is when it is packed. The check tool finds a game
outside the repository through `scripts/games/layout.mjs`.

Publishing the package to npm is a person's step: it needs the `oncyber`
name there and a decision about versions.
