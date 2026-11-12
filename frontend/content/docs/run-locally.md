---
title: Run Oncyber locally
description: Install, start and open the app on your machine.
order: 1
---

# Run Oncyber locally

You need Node.js 22 and pnpm. Then:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:local
```

Open [localhost:13000](http://localhost:13000). This starts everything on your
machine with sample data and no accounts or keys: a welcome space at
[/welcome](http://localhost:13000/welcome), the shared lobby, and every
template in Create. The first run takes a few minutes while it downloads what
it needs.

To sign in, pick Email and enter `demo@example.com`. The sign-in link appears
in your terminal.

:::details What `pnpm dev:local` runs

-   Local copies of the Firebase services (sign-in, database), seeded from
    `local-dev/fixtures/`. They need Java 21; if you don't have it, the first
    run downloads a private copy into `local-dev/.java/`.
-   The lobby server from `multiplayer/`, installed on first run.
-   The app, pointed at both.

Your changes are kept between runs. `pnpm dev:local --reset` starts again from
the sample data, and `--no-lobby` skips the lobby. The data browser is at
[127.0.0.1:4000](http://127.0.0.1:4000). More in `local-dev/README.md`.

:::

:::details Use your own services instead

```sh
cp frontend/.env.example frontend/.env.local
pnpm dev:frontend
```

Uploads, wallets and NFT lookups need real services, listed below.

:::

:::details Which services each part needs

Every key comes from `frontend/.env.local`, and nothing falls back to
Oncyber's accounts. Set up only what your change needs:

| To work on                        | You need                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Sign-in, profiles, spaces, Studio | Your own Firebase project and a service account (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*`) |
| The shared lobby, chat and voice  | A local lobby server. See [Multiplayer](/docs/multiplayer)                                     |
| Uploads                           | A Pinata key (`PINATA_JWT_KEY`)                                                                |
| NFTs from wallets                 | Ethereum and Solana RPCs (`NEXT_PUBLIC_ETH_MAINNET_RPC`, `NEXT_PUBLIC_SOLANA_RPC`)             |

`frontend/.env.example` lists every variable with a comment. Use development
projects and test data, and never commit keys. `NEXT_PUBLIC_*` values are
visible to every visitor, so never put a secret in one.

The exact pnpm version is 9.12.2 (`corepack prepare pnpm@9.12.2 --activate`),
and `.nvmrc` pins Node.

:::

:::details Checks and rendering options

```sh
pnpm -C frontend test --runInBand path/to/changed.test.ts
pnpm -C frontend check:types    # fails only on new type errors
npm --prefix multiplayer run build
```

Rendering uses WebGPU where the browser supports it and falls back to WebGL2.
Add `?renderer=webgl` to a URL to force the fallback.

:::
