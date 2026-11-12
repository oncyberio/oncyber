# Oncyber

Where the project is heading: [GOAL.md](GOAL.md).

Oncyber is a web application for creating and visiting 3D spaces. This repository
contains the Next.js frontend (with its API routes and three.js scene runtime),
the multiplayer services, Firebase functions and asset-processing tools.

## Repository map

| Directory                       | Purpose                                                            | Dependency installation    |
| ------------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `frontend/`                     | Next.js application, API routes, shared lobby and 3D scene runtime | Root pnpm workspace        |
| `multiplayer/`                  | Colyseus rooms, lobby/world services, voice signaling              | Separate npm package       |
| `cloud-functions/functions/`    | Firebase asset optimization and upload functions                   | Separate npm package       |
| `cloud-functions/artist-index/` | Firebase artist indexing functions                                 | Separate npm package       |
| `tasks/`                        | Standalone asset-processing and migration tools                    | Per-tool packages          |
| `scripts/`                      | Development, maintenance, and content utilities                    | See each script or package |
| `docs/`                         | Architecture, feature notes, and measurements                      | —                          |

The root pnpm workspace contains only `frontend`. `vendor/` holds
pinned third-party package tarballs that the frontend installs from.

## Local development

Use Node.js 22, matching `.nvmrc`, and pnpm 9.12.2, matching `package.json`.
With Corepack available:

```sh
corepack enable
corepack prepare pnpm@9.12.2 --activate
pnpm install --frozen-lockfile
pnpm dev:frontend
```

The frontend runs at [localhost:13000](http://localhost:13000).
With no keys the landing page and docs run. Everything else uses services you
set up yourself: copy [frontend/.env.example](frontend/.env.example) to
`frontend/.env.local` and fill in what your work needs. [AGENTS.md](AGENTS.md)
has a table of which feature needs which service, and
[frontend setup](frontend/README.md) covers the details. Nothing falls back to
Oncyber's own accounts.

For multiplayer, install independently:

```sh
npm --prefix multiplayer ci
npm --prefix multiplayer run lobby:dev
```

The local crowd-lobby entry binds to `127.0.0.1:2568`. Its frontend connection
configuration and other server modes are documented in
[multiplayer/README.md](multiplayer/README.md) and
[the shared-world guide](docs/lobby-world-v2.md).

Cloud Functions and maintenance tools have separate runtimes, dependencies, and
service requirements. They are not required for ordinary frontend work. Check
their package manifests and configuration before running them; several tools
write remote data.

## Common checks

Run commands from the repository root:

```sh
pnpm -C frontend test --runInBand path/to/changed.test.ts
pnpm -C frontend check:types
pnpm -C frontend build
npm --prefix multiplayer test
```

The frontend build ignores TypeScript errors, so a successful build does not
replace the type check. `check:types` fails only on errors that are not in the
recorded baseline.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow,
[AGENTS.md](AGENTS.md) for how the code is organized, and
[the brand guide](docs/brand/README.md) for interface changes.

## License

MIT, see [LICENSE](LICENSE). Avatar models, animations and fonts carry their
own licenses next to the files; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
