---
title: Run Oncyber locally
description: Install dependencies, configure the frontend and open the app.
order: 1
---

# Run Oncyber locally

You need Node.js 22 (see `.nvmrc`) and pnpm 9.12.2.

```sh
corepack enable
corepack prepare pnpm@9.12.2 --activate
pnpm install --frozen-lockfile
cp frontend/.env.example frontend/.env.local   # only if you have no .env.local yet
pnpm dev:frontend
```

Open [localhost:13000](http://localhost:13000). With no keys the landing page
and these docs run; the console names the settings that are missing.

## Use your own services

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

## Useful checks

Run these from the repository root:

```sh
pnpm -C frontend test --runInBand path/to/changed.test.ts
pnpm -C frontend check:types    # fails only on new type errors
npm --prefix multiplayer run build
```

Rendering uses WebGPU where the browser supports it and falls back to WebGL2.
Add `?renderer=webgl` to a URL to force the fallback.
