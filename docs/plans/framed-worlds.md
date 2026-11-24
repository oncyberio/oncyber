# Native worlds in a frame: a plan

Written on 24 November 2026 on `games-dev`, from a read of the space page,
the lobby's destination frame, sign-in and the room server, and a spike that
loaded a space three ways in local dev. Anything marked _(not measured)_ or
_(not tested)_ is exactly that.

## 1. Why

Today a native world (the engine in `frontend/components/_3DExhibit-v2/`)
runs in the signed-in page. The page's session token is a prop of that page
and is handed to the engine, so any code that runs in a world runs with the
visitor's account. That rules out letting a creator, or a model, write code
for a world.

Games on this branch already solve it for themselves: a game runs in a frame
that cannot reach the page, and the page keeps identity, the room, voice,
chat and saved data ([games.md](../games.md)). This plan puts native worlds
behind the same kind of frame and the same contract, so that:

-   code inside a world can change anything in the 3D world and nothing
    outside it;
-   the page's account, wallet, voice and chat survive whatever a world does;
-   world scripts (the AI sidebar, and source kept in this repository) can
    later run inside the world with direct access to three.js.

## 2. What is true today

-   **The world already loads in a frame from another origin**, as a
    signed-out visitor, with no code change. Space pages send no
    `frame-ancestors`; every public read is a relative URL, so it stays on
    whichever host served the page. (Spike: `localhost:13000` framing
    `127.0.0.1:13000`.)
-   **An opaque sandbox, as games use, does not fit the engine.** It has no
    Cache Storage, IndexedDB or localStorage, which hold the room model and
    the avatar bakes, and the app's scripts are refused without CORS headers.
    A frame with a real origin of its own keeps all three.
-   **A frozen world freezes the page only when the browser keeps both in
    one process.** With the frame in its own process the page kept ticking
    (51 ms worst gap) through an 8 s freeze; in one process it froze for all
    8 s. Desktop Chrome isolates frames from another site. Safari and phones
    _(not tested)_.
-   **The session is a 30-day token in a host-only cookie**, also copied
    into page props and passed to the engine (`Scene3D` →
    `setCurrentUser({ token })`). A document on another host has no cookie
    and gets no token.
-   **The room server trusts what a client says about itself.** A world in a
    frame can already join as a guest. A signed-in visitor's name, avatar and
    moderator rights reach the room only through the session token.
-   **Chat, voice and the people list are React code beside the engine** that
    reads engine state, and the engine is handed the live room object. The
    cut between page and world runs through them.
-   **The lobby's own destination frame is same-origin** and reaches into the
    framed page directly in four places (portal preview, a `data-` attribute,
    a key listener, the parent's query string).

## 3. The design

**Two origins, one deployment.** The site stays where it is. Worlds are
served by the same app on a second host, `NEXT_PUBLIC_WORLD_ORIGIN`: a
different registrable domain, not a subdomain, so no cookie or same-site
rule ever joins the two. Unset, nothing changes: worlds run in the page as
they do now.

**The same address, two roles.** `/spaces/<id>` and `/<slug>` answer on
both hosts.

| On the site host: the page                               | On the world host: the world                   |
| -------------------------------------------------------- | ---------------------------------------------- |
| Account, sign-in, wallet, every prompt                   | The engine, the 3D scene, avatars as drawn     |
| Header, title, back, space info, Explore, the AI sidebar | Pointer lock, movement, the joystick           |
| The room, voice and chat (slice 3)                       | Artworks, portals, in-world menus that need 3D |
| Saving, gating decisions                                 | World scripts (slice 6)                        |

The world host serves only worlds: no sign-in, no account API, no studio.
It sends `frame-ancestors` naming the site, so nothing else can frame it.

**One contract.** The world speaks the games contract
([games/contract.md](../games/contract.md)): `oncyber:game:<kind>` messages,
`hello` → `identity` → `progress` / `first-frame` / `ready`, and the rest as
slices need them. The page's code for a framed game (the loading cover, the
watchdog, reserved keys, safe areas, chat and voice) is shared; a world is
one more thing it hosts. The only difference is which origin the page
expects: `"null"` for a game's opaque frame, the world origin for a world.

**What is deliberately not here.** No second message protocol. No copy of
the engine's UI in the page before the slice that moves it. No session token
in the world, ever: what the world needs from the account arrives as public
fields or as short-lived, single-purpose tokens.

## 4. Slices, in order

Each is behind the flag, tested, and leaves no half-moved feature as the
default.

1. **A visitor's world in a frame.** The page frames the world host, shows
   the cover until the first frame, reports a world that fails to load and
   offers to reload it. The world hides the header the page now draws. The
   visitor is a guest inside the world. _(This change.)_
2. **Identity.** The page answers the world's `hello` with who is
   visiting: a name, a portrait and an avatar, the same public fields a
   game gets (`features/worlds/worldVisitor.ts`). The world waits for that
   answer before it starts, so it never starts as a guest and restarts.
   No account id and no proof of one cross: until slice 3 the room knows a
   framed visitor by name and avatar only, so they have no moderator
   rights in it. Signing in or out on the page starts the world again as
   that visitor. The address bar follows the world (`location`), and Back
   and travel go through the page.
3. **The room, voice and chat in the page.** The engine's multiplayer gets a
   transport seam: poses up, peers down, as games do. Voice and chat move to
   the page's existing game code and keep running when a world stops. The
   engine's copies are removed in the same slice.
4. **What the world asks the page for.** Artwork info and its links, opening
   a link, sharing, gating and password prompts, fullscreen, screenshots.
   A heartbeat, so the page can tell a hung world from a slow one.
5. **The lobby.** The lobby frames the world host; its four direct reaches
   become messages; the warm-up runs on the world host so the room model is
   cached where the world reads it.
6. **World scripts.** A script is a module loaded inside the world, with the
   engine and three.js in reach and a small SDK as the documented way in.
   The AI sidebar stays in the page; source kept in the repository builds to
   the same kind of module, as games do. The Starry Night house
   (`claude/awesome-dirac-5zs3eb`) is the first one.

The studio stays unframed until editing has its own plan.

## 5. Checks

-   Unit tests beside each piece; the contract's two halves keep one test
    that they agree.
-   A browser run on two origins for every slice: the world loads, the page
    cannot be reached from it (`window.top` access throws), the cover and
    the failure path work.
-   Slice 1 was run that way in local dev (headless Chromium, WebGL2,
    software rendering; `localhost:13000` framing `127.0.0.1:13000`): the
    cover followed the world's progress and lifted on its first frame, the
    world was a signed-out visitor in its own process, reading `window.top`
    or the parent document threw, a popup and a top-level navigation from
    the world were refused, and opening the world host directly landed on
    the site. WebGPU, Safari, phones and a real GPU _(not tested)_.
-   First measurement on a production build and a real device: cold and warm
    load against today's page _(not measured)_.

## 6. Open

-   The world host's domain, and adding it to the room servers' allowed
    origins and the Firebase project's allowed domains.
-   Production Firestore rules are not in this repository; the world reads
    as a signed-out visitor does today.
-   VR from inside a frame needs `xr-spatial-tracking` on the frame and a
    headset to try it _(not tested)_.
-   Who draws phone controls, the page or the world.
-   A frame-rate setting at the Oncyber level, by game and hardware. Not
    part of this work.
