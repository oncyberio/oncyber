# Frontend

The frontend is a Next.js application containing the web UI, API routes, shared
Three.js lobby, and native 3D scene runtime.

## Install and run

Use Node.js 22 and pnpm 9.12.2. From the repository root:

```sh
corepack enable
corepack prepare pnpm@9.12.2 --activate
pnpm install --frozen-lockfile
pnpm dev:frontend
```

Open [localhost:13000](http://localhost:13000). Install dependencies from the root
workspace, not with `npm install` inside this directory.

## Configure integrations

Use [.env.example](.env.example) as the starting point for
`frontend/.env.local`, preserving any existing local configuration. It sets the
web application origin to port 13000 and the optional local crowd lobby to port 2568. It contains no service credentials. Configure only the integrations needed
for your work using a development project and test data.

| Configuration                                           | Used for                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*`                                | Firebase browser application configuration; see `env.ts`                   |
| `FIREBASE_ADMIN_*`                                      | Server-side Firebase access; see `utils/firebaseAdmin.js`                  |
| `FIREBASE_ADMIN_DATABASE_URL`                           | Optional server-side Firebase database URL override                        |
| `NEXT_PUBLIC_API`, `NEXT_PUBLIC_DEV_API`                | API endpoint selection; see `env.ts`                                       |
| `SECRET_JWT_KEY`                                        | Server-side token operations                                               |
| `NEXT_PUBLIC_LOBBY_REGIONS`, `NEXT_PUBLIC_LOBBY_REGION` | Lobby endpoint and region configuration; see the multiplayer documentation |

The example covers core settings, not every integration. Individual API routes
and features have additional provider settings. Check the feature's
implementation before supplying credentials. Values prefixed `NEXT_PUBLIC_` are
exposed to the browser and must not contain server credentials.

Every service key comes from your environment; nothing falls back to
Oncyber's accounts. With no Firebase settings the landing page and docs still
render in development, and the console names the missing values. Account and
database routes need your own Firebase project and service account.
Production builds stop if the Firebase browser settings are missing.

Multiplayer is a separate npm package; `pnpm dev` starts only the frontend.
See [the root guide](../README.md) and
[multiplayer setup](../multiplayer/README.md) for the lobby server.

## Commands

From the repository root:

```sh
pnpm -C frontend test --runInBand path/to/changed.test.ts
pnpm -C frontend check:types
pnpm -C frontend build
pnpm -C frontend find:unused
```

The Next.js build ignores TypeScript errors. Run `check:types` separately;
it fails only on errors that are not in `scripts/type-baseline.json`.
`find:unused` lists files and packages nothing imports.
The build's source-map upload step is skipped when its PostHog CLI credentials
are absent.

`pnpm dev:https` serves the same app over HTTPS on port 13000 with a
self-signed certificate that Next.js creates, for WebXR testing on headsets.

## Source map

| Directory                   | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `pages/`                    | Next.js pages and API routes                            |
| `features/lobby/`           | Shared lobby scene, controls, multiplayer, and journeys |
| `components/_3DExhibit-v2/` | Native Three.js scene runtime and exhibit UI            |
| `features/`                 | Feature-specific application code                       |
| `components/`, `ui/`        | Shared components and interface primitives              |
| `utils/`                    | Shared utilities and service integrations               |
| `styles/brand/`             | Brand tokens                                            |
| `public/`                   | Served assets, including required decoder/runtime files |

Path aliases are defined in `tsconfig.json`; Jest mappings are in
`jest.config.js`. Pinned third-party tarballs live in `../vendor/`.

See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[the brand guide](../docs/brand/README.md) before making changes.
