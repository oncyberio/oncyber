# Oncyber: where we're going

Oncyber started in 2021 as a place to build and visit 3D galleries for digital
art. The goal now is a **shared 3D lobby that connects many spaces**:
galleries and creator-built worlds, all reachable from one place, with your
identity, avatar, friends and voice coming with you as you travel.

## What we're building

1. **One social lobby.** A shared 3D space where people arrive, see who's
   around, chat and talk, emote, flash art from their wallet, and travel into a
   space together without a loading screen breaking the moment.
2. **Spaces on WebGPU.** The lobby and gallery spaces render with a WebGPU
   engine (three.js and TSL), with a WebGL2 fallback.
3. **Any engine, one host.** The content host runs outside experiences, such as
   plain three.js or WebGPU pages, inside a sandboxed frame. A world keeps its
   own engine and talks to Oncyber through a small message bridge (see
   `docs/content-host.md`), which is where identity, party travel, chat and
   voice come from. The host also has code, not live yet, that can serve
   awe.box experiences.
4. **Creation in the browser.** An editable Studio and Gaussian-splat galleries,
   so people can make and curate spaces without leaving the site.
5. **Discovery.** A landing page and explore experience to find spaces, worlds
   and people.
6. **Content that lasts.** Art and spaces are stored on IPFS, and over time on
   Arweave, so they outlive any one server, including ours.
7. **Open source.** The code is public so outside developers can read it, run
   it and contribute. Docs live in the app at `/docs` and cover contributing,
   plain three.js experiences, multiplayer and avatars.

## Staged launch

1. **Infrastructure first.** Open-source the lobby, landing, WebGPU spaces and
   the content host. No games in this repository.
2. **Creation.** Open Studio and splat galleries to more people.
3. **Outside worlds.** Open the content host to more engines and publishers,
   one small step at a time. Games come back later the same way.

## Contributing with your own setup

Anyone can run Oncyber against services they own. Nothing in the repository
points at Oncyber's accounts: every key is an environment variable, and
`frontend/.env.example` lists them. [AGENTS.md](AGENTS.md) has the table of
which feature needs which service.

-   **No keys:** the landing page and docs run as soon as you install.
-   **Your own Firebase project:** sign-in, profiles, spaces and Studio. This is
    the one service most work needs today.
-   **A local lobby server** (`multiplayer/`): the shared lobby, chat and voice.
-   **Optional services:** Pinata for uploads, an Ethereum and a Solana RPC for
    NFTs, the licensed brand fonts. Without the fonts the site uses open ones.

Firebase is a stopgap, not the destination. The plan is for profiles, follows
and space edits to become signed records stored on Arweave, so a fork needs
less hosted infrastructure over time. Only live multiplayer and chat need to
stay on servers.

## How we work

-   `main` is the default branch and deploys to Vercel. Every change branches off
    `main` and lands through a pull request, after a test link (a Vercel preview
    or localhost) has been tried.
-   Feature branches are short-lived and deleted once merged.
-   Code nothing uses gets removed, not commented out; `pnpm -C frontend
find:unused` finds it. Git history keeps the old versions.

## Naming

The product is Oncyber. Don't add other product or SDK names to code, docs or
the interface. The one exception is the content-host code that can serve
awe.box experiences, which names that domain.

## Before the repository goes public

-   The repository started without history. Rotate every key that was
    hardcoded in the original oncyber repository before going public.
-   Keep environment files out of commits; start from the `.env.example` files.
-   Brand fonts are licensed and fetched at build time (see `docs/fonts.md`).
-   Known dependency work left: Colyseus 0.14 to 0.18 in `multiplayer/`, and
    `@metaplex/js` (deprecated) for Solana NFT reads. See
    `docs/dependency-triage.md`.
