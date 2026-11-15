# Contributing

## Set up the project

Follow the [root setup guide](README.md); [AGENTS.md](AGENTS.md) lists which
service each feature needs so you can set up only those, with your own keys.
Use Node.js 22 and pnpm 9.12.2 for the root workspace. Run `pnpm install` from
the repository root; do not create a frontend npm lockfile.

`multiplayer`, the Cloud Functions packages, and standalone tools are outside
the pnpm workspace. Use their own manifests and npm lockfiles when working on
them. Every package runs on Node.js 22.

Use a development project and test data for integrations. Environment files
belong on your machine, not in commits. `NEXT_PUBLIC_*` variables are visible to
browser users; they must never contain server credentials.

## Branches and pull requests

Base new work on `main` and open its pull request against `main`. Keep feature
branches short-lived. For example, with a clean working tree:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c describe-the-change
```

Delete feature branches after their changes are merged.

## Make a focused change

1. Check `git status` before starting and preserve unrelated local changes.
2. Read the relevant package and feature documentation.
3. Keep the change focused, including any necessary tests and documentation.
4. Run the checks appropriate to the affected behavior.
5. Review the final diff for generated files, local configuration, and credentials.

The frontend's shared lobby lives in `frontend/features/lobby`. The native
scene runtime lives in `frontend/components/_3DExhibit-v2`. Prefer extending
shared behavior over introducing a second implementation.

For UI work, follow [the brand guide](docs/brand/README.md). The repository uses
four-space indentation and an 80-character formatting width. Format the files
you changed; avoid unrelated formatting across the repository.

## Validate the change

Examples from the repository root:

```sh
pnpm -C frontend test --runInBand path/to/changed.test.ts
pnpm -C frontend check:types
npm --prefix multiplayer run build
npm --prefix multiplayer run test:lobby-wire
```

Choose targeted checks rather than running every package indiscriminately.
Backend integration tests may contact configured databases or services.
Multiplayer load tools belong against a local test service. Build, upload,
migration, and deployment scripts can have effects beyond a local build; read
the script and configure its destination before running it.

For rendering and interaction changes, also verify the behavior in the browser.
Include the scenario and relevant device or browser details in the change
description. If a check fails for an existing reason, record the command and
failure instead of describing it as passing.

The frontend Next.js build skips TypeScript errors. Run `check:types`, which
fails only on errors the change introduces.

## Generated files and vendored dependencies

Do not commit compiler caches, browser network captures, local environment files,
or temporary export archives.

The tarballs under `vendor/` are package sources referenced by
`frontend/package.json`; do not delete them as caches. Likewise, public decoder binaries and application assets can be runtime inputs
even when they were originally generated.

## Describe the result

Explain the user-visible problem, the resulting behavior, and the checks you ran.
Share a way to try it: the pull request's Vercel preview, or steps to run it
locally.
Note any configuration or data migration requirements. Include a screenshot or
short recording when it makes a visual change easier to review.

## After you open a pull request

What to expect on your first pull request from a fork:

-   **Checks wait for a maintainer.** GitHub holds workflow runs from new
    contributors until a maintainer approves them, so the checks section may
    stay empty or say "approval required" for a while. You don't need to do
    anything; run the same checks locally in the meantime (see above).
-   **The Vercel preview waits too.** Previews run with the project's own
    keys, so a maintainer authorizes each fork's deployment by hand. Until
    then, put steps to try the change locally in the "Try it" section of the
    pull request.
-   **Which checks run depends on the paths you touched.** Frontend changes
    run the unit tests, the type check and the security regression tests;
    `multiplayer/` and `frontend/features/lobby/` also run the lobby world
    regression. The workflows are in `.github/workflows/`.

### Trying changes that need outside services

`pnpm dev:local` covers sign-in, spaces, the studio and the lobby with no
keys. Some features still need a key of your own: NFT listings and NFT gating
need `OPENSEA_X_API_KEY` (a free OpenSea key works) and an RPC for the chain.
Put them in `frontend/.env.local`; `dev:local` reads that file too. If you
couldn't try a change in a browser, say so in the pull request, along with
what you checked instead.

Do not include credentials, account data, private network captures, or sensitive
logs in issues or change descriptions. Report suspected credential exposure
privately to the maintainers before posting details publicly.
