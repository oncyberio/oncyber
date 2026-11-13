# AGENTS.md

Instructions for anyone, human or coding agent, changing this repository.
`CLAUDE.md` points here, so there is one copy to keep current. Where the
project is going: [GOAL.md](GOAL.md).

## What this is

Oncyber is a web app for building and visiting 3D spaces: a shared social
lobby, gallery spaces rendered with WebGPU, and a content host that runs
outside 3D experiences in a sandboxed frame. Visitors bring an identity,
avatar, friends and voice as they travel between spaces.

## Repository map

| Path                            | What it is                                                                                     | Install with                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| `frontend/`                     | Next.js 15 app (React 18): pages, API routes, the lobby and the 3D engine                      | root `pnpm install`           |
| `multiplayer/`                  | The new lobby world server, Colyseus rooms for spaces, voice signaling, TURN credentials       | `npm --prefix multiplayer ci` |
| `cloud-functions/functions/`    | Firebase functions: 3D asset and avatar optimization, IPFS uploads                             | its own `npm ci`              |
| `cloud-functions/artist-index/` | Firebase functions: artist search index                                                        | its own `npm ci`              |
| `scripts/`                      | Maintenance and content tools (gallery CDN, museum media, world CLI)                           | per script                    |
| `tasks/`                        | Standalone asset tools (VRM resize, texture compression, FBX to VRM animation, camera splines) | per tool                      |
| `docs/`                         | Architecture notes, brand guide, measurements and plans                                        |                               |
| `vendor/`                       | Pinned, patched third-party tarballs the frontend installs (three.js, camera-controls)         |                               |

Only `frontend` is a pnpm workspace member. The other packages keep their own
npm lockfiles because they deploy on their own (Firebase installs with npm;
multiplayer has its own Dockerfile and `multiplayer/infra/`).

### Inside `frontend/`

| Path                              | What it holds                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pages/`                          | Routes. `pages/api/` holds API routes; `pages/api/_v2/` holds RPC procedures (see below)                           |
| `features/`                       | Feature code, one folder per feature: `lobby`, `content-host`, `studio`, `social`, `docs`, `landing-carousel`, ... |
| `components/_3DExhibit-v2/`       | The native 3D engine (three.js `WebGPURenderer`, TSL materials) and the in-space UI                                |
| `components/`, `ui/`              | Shared React components and interface primitives                                                                   |
| `utils/`                          | Shared helpers and service clients (Firebase Admin, Pinata, RPC, security)                                         |
| `dApp/`                           | Wallet connections (Ethereum via ethers, Solana, Tezos) and marketplaces                                           |
| `styles/tokens/`, `styles/brand/` | Design tokens and the landing's brand variables                                                                    |
| `content/docs/`                   | Markdown for the in-app docs at `/docs` (also served as `llms.txt`)                                                |
| `env.ts`                          | Every environment variable the app reads, in one place                                                             |

Path aliases (`@components/*`, `@features/*`, `@utils/*`, `@dapp/*`, `@api/*`
for `pages/api/_v2/*`, `@3/*` for the engine, ...) are in
`frontend/tsconfig.json`; Jest mirrors them in `frontend/jest.config.js`.
Add an alias to both.

## Run it with no services

`pnpm dev:local` starts everything on your machine: Firebase emulators seeded
with a sample space (`local-dev/fixtures/`), the lobby server and the app. The
emulators run on Java 21; when it's missing, the first run downloads a
private copy into `local-dev/.java/`. See [local-dev/README.md](local-dev/README.md).
Use it for anything that doesn't need real uploads, wallets or NFT lookups.

## Set up with your own services

You need Node 22 and pnpm 9.12.2 (`corepack enable` picks it up from
`package.json`).

```sh
pnpm install --frozen-lockfile
cp frontend/.env.example frontend/.env.local   # only if you have none yet
pnpm dev                                        # http://localhost:13000
```

With no keys at all, the landing page and docs run, and the console lists
the missing Firebase settings. Add services as your work needs them; every
key comes from `frontend/.env.local`, nothing falls back to Oncyber's own
accounts.

| To work on                        | Set up                                                                                                                  | Variables                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sign-in, profiles, spaces, studio | A Firebase project of your own: Firestore, Realtime Database, Authentication, plus a service account for the API routes | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*`, `SECRET_JWT_KEY` (any long random string)                     |
| The shared lobby                  | Run it locally: `npm --prefix multiplayer ci && npm --prefix multiplayer run lobby:dev`                                 | `NEXT_PUBLIC_LOBBY_REGIONS`, `NEXT_PUBLIC_LOBBY_REGION` (the example already points at it)                  |
| Lobby voice and chat identity     | Same lobby, plus a shared secret                                                                                        | `LOBBY_IDENTITY_SECRET` on both sides                                                                       |
| Uploads                           | A Pinata account                                                                                                        | `PINATA_JWT_KEY` (server-only)                                                                              |
| NFTs from wallets                 | An Alchemy (or other) RPC, a Solana RPC with the DAS API, OpenSea key                                                   | `NEXT_PUBLIC_ETH_MAINNET_RPC`, `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_SOLANA_RPC`, `OPENSEA_X_API_KEY` |
| Brand fonts                       | Optional. Without them the site uses open fallbacks                                                                     | `LICENSED_FONTS_URL` (see `docs/fonts.md`)                                                                  |

`frontend/.env.example` lists the rest, grouped and commented. Rules:

-   `NEXT_PUBLIC_*` values ship to every browser. Never put a secret in one.
-   Server-only keys (`FIREBASE_ADMIN_*`, `PINATA_JWT_KEY`, minting signer keys)
    stay unprefixed and out of commits.
-   Use a development Firebase project and test data, never production.

For multiplayer modes, the WebTransport shared world and deployment, see
[multiplayer/README.md](multiplayer/README.md) and
[docs/lobby-world-v2.md](docs/lobby-world-v2.md). For HTTPS (WebXR on a
headset), `pnpm dev:https` uses Next's self-signed certificate.

## Commands

From the repository root:

```sh
pnpm -C frontend test path/to/changed.test.ts   # Jest
pnpm -C frontend check:types                    # type check, fails only on new errors
pnpm -C frontend build                          # production build (needs NEXT_PUBLIC_FIREBASE_*)
pnpm -C frontend find:unused                    # files and packages nothing uses (knip)
npm --prefix multiplayer test                   # multiplayer (mocha)
pnpm format:all                                 # Prettier
```

The Next.js build ignores type errors, so run `check:types` separately. The
frontend has a few hundred known type errors; `scripts/type-baseline.json`
records them and the check fails only when a change adds one. Lower the
baseline with `pnpm -C frontend check:types:update` when you fix some.

CI runs the frontend tests, the type ratchet, the lobby world tests and the
security regression tests on every pull request (`.github/workflows/`).

## How the code is built

-   **API routes and RPC.** Most server logic is an RPC procedure in
    `pages/api/_v2/<area>/*.ts`, declared with `proc({ schema, auth, handler })`
    from `utils/rpc/server.ts`. `schema` is a Zod schema; `auth: true` rejects
    callers without a valid session. Inside the handler, `this.userId` is the
    signed-in account. Check ownership against it before any write.
-   **Outbound fetches** of user-supplied URLs go through
    `utils/net/publicFetch`, which refuses private and internal addresses at
    connect time. Don't call `fetch` on a user URL directly from the server.
-   **3D engine.** three.js r187 `WebGPURenderer` from `vendor/three/`. Shaders
    are TSL node materials, so the same code runs on WebGPU and on the WebGL2
    fallback (`?renderer=webgl`). Spaces keep the r153 light scale through
    `three/compat.js`. See [docs/webgpu-porting-guide.md](docs/webgpu-porting-guide.md).
-   **State machines.** Where a feature moves through a fixed set of states,
    the transitions live in one pure file beside it. See
    [docs/state-machines.md](docs/state-machines.md) and add a row when you
    extract one.
-   **Content host.** Outside experiences run in a sandboxed frame and talk to
    the page through the message bridge in `features/content-host/`. See
    [docs/content-host.md](docs/content-host.md).
-   **Wallets.** `dApp/connect.tsx` returns a connection per chain. An Ethereum
    connection carries an ethers provider (`getEthersProvider(connection)`);
    sign and send through it.
-   **UI.** Follow [docs/brand/README.md](docs/brand/README.md) and use the
    tokens in `frontend/styles/tokens/` (browse them at `/dev/tokens`).

TypeScript is not strict (`strict: false`), and JavaScript and TypeScript
files sit side by side. New files should be TypeScript.

## Making a change

1. Branch off `main`; land through a pull request. Keep branches short-lived.
2. Keep the change focused and add or update tests beside the code
   (`thing.ts` and `thing.test.ts`).
3. Run the checks for what you touched. For rendering or interaction changes,
   also try it in a browser and say which one.
4. Before opening the pull request, share a test link (the Vercel preview, or
   steps to run it locally) so a reviewer can try it.
5. Fill in `.github/pull_request_template.md`: what changed, how you checked
   it, any setup or data migration it needs.

Formatting is Prettier: four spaces, 80 columns. Format the files you change,
not the whole repository.

Don't commit environment files, build output (`.next*`, `lib/`, `build/`),
network captures or exported archives. `vendor/` tarballs and the decoder
files in `frontend/public/` are inputs, not caches.

## Naming

The product is Oncyber. Don't add other product or SDK names to code, docs
or the interface. The one exception is the content-host code that can serve
awe.box experiences, which names that domain.

## Security

Report suspected vulnerabilities or exposed credentials privately to the
maintainers, not in a public issue. Don't paste credentials, account data
or private logs into issues or pull requests.
