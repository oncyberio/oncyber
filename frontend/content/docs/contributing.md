---
title: Contribute
description: How to send a small, clear, tested change.
order: 2
---

# Contribute

Thanks for helping. The best changes are small, explained and tried.

1. Branch off `main`.
2. Change one thing, with its tests.
3. Try it, in the browser too if it's visual.
4. Open a pull request that says what changed and how you checked it.

Never include keys, account data or private logs. If you think a secret was
exposed, tell the maintainers privately.

:::details Branching and formatting

```sh
git switch main
git pull --ff-only origin main
git switch -c describe-the-change
```

Keep branches short-lived and unrelated local changes out of your work.
Formatting is Prettier with four-space indentation and an 80-column width.
Format the files you changed, not the whole repository.

:::

:::details Where to make changes

Extend shared code instead of adding a second version of it. The lobby UI
lives in `frontend/features/lobby`, the scene runtime in
`frontend/components/_3DExhibit-v2`, and UI tokens in `frontend/styles/tokens`
(browse them at `/dev/tokens`). The brand guide is in `docs/brand/README.md`.

:::

:::details Checks to run

Pick targeted checks instead of running everything:

```sh
pnpm -C frontend test --runInBand features/lobby/LobbyChat.test.tsx
pnpm -C frontend check:types
npm --prefix multiplayer run test:lobby-wire
```

For visual changes, say which browser and device you used and add a screenshot
or short recording. If a check already failed before your change, say so.
Mention any new environment variables or data migrations.

Build, upload, migration and deployment scripts can reach real services. Read
a script and point it at your own test destination before running it.

`multiplayer/`, Cloud Functions and the tools in `tasks/` have their own npm
lockfiles. Install and test them from their own folders.

:::
