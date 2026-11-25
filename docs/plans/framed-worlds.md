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
-   **Relaying a full room through the page costs almost nothing.** With
    the frame in its own process, a message carrying 700 visitors'
    positions, 20 times a second, took 0.3 ms to send and arrived in 2 to
    3 ms, and neither side dropped a frame (still 16.7 ms apart). Sixty
    times a second measured the same. Measured between two idle documents
    in headless Chromium; with the engine drawing _(not measured)_.
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
2. **Identity and navigation.** _(Done.)_ The page answers the world's
   `hello` with who is visiting: a name, a portrait and an avatar, the
   same public fields a game gets (`features/worlds/worldVisitor.ts`). The
   world waits for that answer before it starts, so it never starts as a
   guest and restarts. No account id and no proof of one cross: until
   slice 3 the room knows a framed visitor by name and avatar only, so
   they have no moderator rights in it. Signing in or out on the page
   starts the world again as that visitor.

    The world says where it is (`location`) and the page keeps the address
    bar on it. The page believes the address only: after a portal taken
    inside the frame it shows the title the world gives the place, as text,
    and looks up which space that address is itself
    (`features/worlds/worldLocation.ts`). A world cannot leave its frame,
    so its ways out (search, the lobby) are a `travel` request the page
    carries out, on the site only. Back is the page's.

3. **The room, voice and chat in the page.** In three steps.

    1. **The room.** _(Done.)_ The page holds the world's room connection,
       joined as the page's own visitor, and relays it into the frame
       (`features/worlds/roomRelay.ts`): each patch of who is in the room
       goes down, the world's own moves go up. The world's code sees a
       room like the one it has always had, so presence, chat and the
       people list work as before. Who is joining is the page's to say:
       the world cannot rename a signed-in visitor, and `login` and voice
       signalling never come from a world. The session is lent only to the
       room of the space the page opened; a room reached through a portal
       inside the frame is joined by name alone. One join function now
       serves worlds, games and this (`utils/arena/join.ts`).
    2. **Voice, and one dock.** _(Done.)_ The microphone and every voice
       heard are the page's, in the room it holds. The world's own voice
       rules keep running, against a voice service that is only messages
       (`features/worlds/relayedVoice.ts`), and the page does what they
       say (`worldVoiceHost.ts`): whether this visitor may speak (a
       moderator's leave included), how loud each voice is (the engine
       works that out from distance and the space's voice range, as it
       always has), whom this visitor's voice reaches, and who is shown
       talking. One thing is not the world's to say: a microphone goes on
       only from the page's own button, because a click inside the frame
       is not one the page can see. A world can mute its visitor; it
       cannot unmute them. The world's code never reaches a microphone or
       a peer connection. The page's voice is the one a game page has
       (`features/games/roomVoice.ts`).

        The world asks the page what only the page can know (`ask`): so
        far, whether its visitor moderates the space, answered with the
        page's session and only for the space the page opened. A
        moderator's acts (kick, the voice range) reach the room with the
        page's session added.

        There is one dock and the page draws it
        (`features/worlds/worldDock.ts`). The world says which buttons it
        has and is told when one is pressed; what a button opens is still
        drawn in the world. The voice button is the page's own once the
        world's rules let the visitor speak, and the world's until then
        (asking a moderator). The world says when it holds the pointer, so
        the page's interface steps back as it does unframed. This is the
        shape for anything in a frame: the page's controls are the page's,
        and a frame adds buttons to the same dock.

        Not yet: unmuting from the keyboard inside the world (M mutes, the
        page's button unmutes), and screen share drawn in 3D, which needs
        its own answer because a stream cannot cross into the frame.

    3. **A world that stops.** _(Done.)_ A world that has drawn says it
       is alive about once a second; silence while the page is in view
       means its thread hangs or died (`features/games/frameStall.ts`).
       The page says so, with a way to load the world again, and what is
       the page's carries on: the room, voice, the header and the dock.

        Chat and the people list stay drawn by the world. They run on the
        relayed room with the code they have unframed, so a framed visitor
        and an unframed one in the same room see the same chat. The cost:
        they stop with a world that stops, until it is loaded again. Moving
        them to the page would mean a second chat interface speaking the
        world's chat; not planned unless that cost turns out to matter.

4. **What the world asks the page for.** Artwork info and its links, opening
   a link, sharing, gating and password prompts, fullscreen, screenshots.
   (The heartbeat that tells a hung world from a slow one is in, with
   slice 3.)
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
-   Slice 2, the same way: signed in as the local demo account, the
    world's name tag showed that name and portrait, with no cookie or
    token inside the frame; as a guest it showed the world's own guest.
    The address bar and title followed locations sent from the world's
    window, an address that is not a world's was ignored, and `travel`
    went through for a page on the site and not for another site. The
    headless browser could not walk the avatar, so the engine's own
    location reports were not seen end to end _(not tested)_.
-   Slice 3, the room: with the room server running locally, a
    signed-in visitor and a guest opened the same framed world. Both were
    in one room, each world drew the other's avatar, and the room knew the
    signed-in visitor as the space's admin, with the session on the page
    only. Chat between them, moving, and leaving _(not tested)_ in a
    browser; the relay's two halves are tested against each other.
-   Slice 3, voice and the dock: two visitors in one framed world, with
    the room server local and a fake microphone, the space's owner and a
    guest. The world asked the page and learned its visitor moderates the
    space, so its rules let them speak; they pressed the page's
    microphone button, and that page asked for the microphone once. The
    guest's engine set that voice's volume and the guest's page played it;
    both worlds were sent talking levels; the guest, whom the space's
    rules do not let speak without asking, could not turn a microphone on;
    and neither world frame touched a microphone or a peer connection. A
    press on a world's button in the page's dock reached the world and the
    keyboard went back to it. The dock was sent from the world's window:
    the headless browser never got the world to show its own dock, so the
    engine's own dock crossing, asking a moderator to speak, and the
    speaking animation were not seen _(not tested)_. Whether two people
    hear each other clearly _(not tested)_.
-   Slice 3, a world that stops: a framed world's thread was hung for
    25 s. The page kept running (145 ms worst gap), said the world had
    stopped responding with a way to load it again, and took the notice
    away when the world came back.
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
-   Inside a framed world the avatar picker and saved settings still try
    to save to an account the world does not have. They move to the page
    with slice 4.
-   A script in a world can ask the page to `travel` without the visitor
    clicking anything. It can only reach this site's own pages.
-   A frame-rate setting at the Oncyber level, by game and hardware. Not
    part of this work.
