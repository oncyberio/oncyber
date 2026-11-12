---
title: Contribute
description: Branches, focused changes, checks and pull requests.
order: 2
---

# Contribute

Thanks for helping. A good contribution is small, explained and verified.

## Branch from main

`main` is the default branch. Branch off it and open a pull request back into
it. Keep branches short-lived.

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c describe-the-change
```

## Make a focused change

1. Check `git status` first and keep unrelated local changes out of your work.
2. Read the docs for the area you're touching.
3. Change one thing, with the tests and docs it needs.
4. Run the checks that cover it.
5. Read your own diff for generated files, local config and secrets.

Prefer extending shared code over adding a second version of it. The lobby UI
lives in `frontend/features/lobby`, the scene runtime in
`frontend/components/_3DExhibit-v2`, and UI tokens in `frontend/styles/tokens`
(browse them at `/dev/tokens`). The brand guide is in `docs/brand/README.md`.

Formatting is Prettier with four-space indentation and an 80-column width.
Format the files you changed, not the whole repository.

## Verify it

Pick targeted checks instead of running everything:

```sh
pnpm -C frontend test --runInBand features/lobby/LobbyChat.test.tsx
pnpm -C frontend check:types
npm --prefix multiplayer run test:lobby-wire
```

For anything visual or interactive, try it in the browser too and say which
browser and device you used. If a check already failed before your change, say
so instead of calling it passing.

Build, upload, migration and deployment scripts can reach real services. Read a
script and point it at your own test destination before running it.

## Open the pull request

Describe the problem, what changes for people using Oncyber, and the checks you
ran. Add a screenshot or short recording for visual changes. Mention any new
environment variables or data migrations.

Never include credentials, account data or private logs. If you think a secret
was exposed, tell the maintainers privately first.

## Packages outside the workspace

`multiplayer/`, Cloud Functions and the standalone tools in `tasks/` have their
own npm lockfiles and runtimes. Install and test them from their own folders.
