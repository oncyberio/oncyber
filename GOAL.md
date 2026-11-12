# Oncyber: where we're going

Oncyber started in 2021 as a place to build and visit 3D galleries for digital
art. The goal now is **a home for 3D spaces on the web**: galleries, worlds
people build in the browser, and outside worlds made with any engine, joined
by a shared lobby, with your identity, avatar, friends and voice coming with
you as you travel.

## What we're building

1. **One social lobby.** A shared 3D space where people arrive, see who's
   around, chat and talk, emote, flash art from their wallet, and travel into a
   space together without a loading screen breaking the moment.
2. **Spaces on WebGPU.** The lobby and gallery spaces render with a WebGPU
   engine (three.js and TSL), with a WebGL2 fallback.
3. **Any engine, one host.** The direction: outside experiences, such as plain
   three.js or WebGPU pages, run inside a sandboxed frame, keep their own
   engine, and get identity, party travel, chat and voice from Oncyber through
   a small message bridge (see `docs/content-host.md`). Today only the sandbox
   and an early bridge exist: a space owner attaches a self-hosted page with an
   API call, and identity, avatars and multiplayer aren't wired in yet. The host also has code, not live yet, that can serve
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

## Architecture in brief

-   **`frontend/`** is one Next.js app on Vercel. It serves the landing, the
    lobby, spaces, Studio and the in-app docs, and its API routes hold the
    server logic (RPC procedures in `pages/api/_v2/`).
-   **The 3D engine** (`components/_3DExhibit-v2/`) is three.js `WebGPURenderer`
    with TSL materials, so the same code runs on WebGPU and the WebGL2 fallback.
    The lobby and every native space render with it.
-   **`multiplayer/`** is a separate Colyseus service for presence, chat and
    voice signaling. The lobby and spaces join its rooms.
-   **The content host** (`features/content-host/`) runs an outside experience
    in a sandboxed frame. The world never touches the wallet or the account; it
    asks the Oncyber page through the message bridge, and the page decides.
-   **Data.** Accounts, profiles and space records are in Firebase today. Media
    and space files go to IPFS (Pinata), and to Arweave over time.
    `cloud-functions/` optimizes uploaded 3D assets and avatars.

[AGENTS.md](AGENTS.md) has the full repository map and the code conventions.

## Design system

Every piece of interface follows one system, so the app looks like one product.
Read [docs/brand/README.md](docs/brand/README.md) before building UI, take
values from the tokens, and check `/dev/tokens` in the running app, which shows
every value and the real components.

-   **Tokens, never literals.** All values live in `frontend/styles/tokens/` and
    import from `@styles/tokens`. `base.ts` is shared; `landing.ts`, `lobby.ts`
    and `studio.ts` sit on top for the three surfaces; `action.ts` is the one
    button spec. A value only one surface uses goes in that surface's set; it
    moves to the base when a second surface needs it. See
    [docs/brand/tokens.md](docs/brand/tokens.md).
-   **Three surfaces.** The landing is a quiet dark canvas (`#101010`) with
    solid panels (`#191919`) and paper cards. The lobby floats glass panels over
    the 3D world. Studio is dense, with flat neutral greys and no glass. Keep
    each surface's material on that surface.
-   **Type.** Aeonik (registered as "Oncyber Sans") for language, Space Mono for
    small numbers and labels. Body 14 px / 1.5, panel titles 16 px medium,
    buttons 13 px medium. Sentence case. Never tilt, squash or re-track text to
    make it fit; truncate it instead.
-   **Color.** Color comes from the worlds; the interface stays neutral. Ink
    `#f3f3f1`, secondary `#c2c2bd`, muted `#93938e`, white hairlines from
    `line.faint` to `line.selected`. Blue `#2567ff` is for focus, the active
    choice and important actions. The cyan-to-lime line marks a selected card.
    Create red `#ff3b3b` is for Create. Never show state by color alone: add a
    check, text or an accessible state.
-   **Shape and spacing.** A 4 px rhythm (4, 8, 12, 16, 20, 24, 32). Corners are
    8 for nested items, 12 for controls, 16 for compact cards and 24 for cards,
    panels and dialogs. Studio is a little tighter (see its tokens).
-   **Buttons.** One spec everywhere: 40 px high, 10 × 16 padding, 1 px border,
    12 px corners or a full pill. Blue only to sign in or publish (at most one
    per screen), white for the ordinary main action, outline for the rest. Use
    `ActionButton` or the primitives in `@styles/brand`.
-   **Shared components.** Dialogs come from `components/Dialogs` and are dark
    everywhere except sign in. Empty lists use `EmptyState`. Studio panels use
    the primitives in `features/studio/styles/` under `StudioTheme`. Reuse these
    before writing a new one.
-   **Motion.** 120 ms for hover, 180 ms for small affordances, 220 ms for a
    popover entering, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`. Animate opacity
    and transform, never layout or type. Reduced motion turns durations to zero.
-   **Access.** Every control has a visible focus ring (2 px blue), icon-only
    controls have names, menus work with the keyboard and Escape, and touch
    targets are at least 44 px.

When a design decision changes, update the brand guide and the tokens in the
same pull request.

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

## Keys and the public repository

The repository is public. It started without history, and a secret scan
(gitleaks and trufflehog, every branch, tag and pull request, 2026-11-12)
found no live credentials in it. What it found are public by design: the
browser search key for Algolia, OneSignal app ids, Firebase Storage download
links for public avatars, contract addresses and test placeholders.

Still to do: rotating the keys that were hardcoded in the original, private
oncyber repository. None of them are in this repository, and the list is
tracked privately with the maintainers, not here. Until that's done, don't
copy configuration or code from the old repository.

-   Keep environment files out of commits; start from the `.env.example` files.
-   Brand fonts are licensed and fetched at build time (see `docs/fonts.md`).
-   Known dependency work left: Colyseus 0.14 to 0.18 in `multiplayer/`, and
    `@metaplex/js` (deprecated) for Solana NFT reads. See
    `docs/dependency-triage.md`.
