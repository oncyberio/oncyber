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

1. **A visitor's world in a frame.** _(Done.)_ The page frames the world
   host, reports a world that fails to load and offers to reload it. The
   world hides the header the page now draws. The page draws nothing over
   a loading world: the world's own loading animation is what the visitor
   sees, as it always was.
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

        The microphone's shortcut is Cmd or Ctrl with M, a shortcut of the
        dock's voice button; M on its own is the world's. Pressed inside
        the frame it can only mute, like anything else the world asks: the
        page's own button, or the shortcut while the page has the
        keyboard, turns the microphone on. Not yet: screen share drawn in
        3D, which needs its own answer because a stream cannot cross into
        the frame.

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

4. **What the world asks the page for.**

    1. **Links.** _(Done.)_ A world cannot open a tab or leave its frame,
       so everything in it that would (an artwork's marketplace link, a
       link portal, a share button, a link in a panel, a script) is a
       request to the page, made in one place for all of them
       (`features/worlds/worldLinks.ts`). The page says which site a link
       goes to and opens it on the visitor's own click; a link to another
       page of this site travels there. One more click than unframed, and
       no world can send a visitor anywhere on its own word.
    2. **The account.** _(Done.)_ A signed-in visitor's world knows who
       they are and has their settings, and holds a stand-in where the
       session token would be, never the token. The few account calls the
       in-world interface makes (my avatars, saving my settings, am I let
       in, feedback, an edit to my own space) are on an explicit list
       (`features/worlds/accountRelay.ts`) and are made by the page with
       its own session; nothing else is. Signing in from the world opens
       the page's dialog.
    3. **Gated worlds.** _(Done.)_ Framed like any other: the page, which
       holds the session, says whether its visitor is let in, and the
       gate is the world's own interface as it is unframed.
    4. **Files.** _(Done.)_ A photo the world takes is offered for saving
       by the page, by name, on the visitor's click.
    5. **Still to move.** Screen share drawn in 3D, wallet prompts that
       need a popup, the list of avatars owned by linked wallets, and
       fullscreen.

5. **The lobby.** _(Done.)_ A world reached from the lobby is two
   frames below it. The page between them passes the journey's protocol
   both ways, unchanged (`utils/lobbyDestinationBridge.ts`), and what the
   lobby set or read directly on the destination's document (the party
   chat flag, the Enter key, the loading budget, travel options) is
   passed on too.

    The lobby and the landing page start a world's downloads before the
    visitor goes there: the engine's scripts and the room model. A
    browser keeps each host's caches apart, so what the site downloads a
    framed world never finds. The warm-up therefore runs on the world
    host: the site keeps one small hidden frame there (`/world-warmup`,
    `features/worlds/worldWarmup.ts`), tells it which world to warm, and
    downloads nothing of the world's itself. Still direct, and so missing
    for a framed world: the portal's live preview.

6. **World scripts.** _(Done.)_ Two kinds, both in the world.

    Code kept in this repository (`features/worldMods/`) is a module
    loaded inside the world with the engine in reach, built with the app.
    The Starry Night house is the first: it opens the first house down the
    road and paints a room inside.

    A script written by the AI (`features/world-scripts/`,
    [../world-scripts.md](../world-scripts.md)) runs in an opaque sandbox
    inside the world and changes the scene through checked messages. It
    is split along the frame's own line: the sandbox, the engine it draws
    through and what it shows on screen are the world's
    (`runtime.ts`); who may edit, the AI sidebar and its button in the
    dock, the calls to the model, the save and undo are the page's
    (`controller.ts`, `PageWorldScripts.tsx`). The page drives the
    world's runtime through messages (`runtimeRelay.ts`), each naming the
    space it is for. The AI is in early access: the button is offered
    only to editors on the list, and the server checks both.

    A space embedded on another site keeps running in its own page: a
    frame inside a frame inside someone else's page has no way to ask
    its visitor anything.

7. **Each frame loads what it runs.** _(Done; what is left is listed.)_
   Measured on a guest's visit to Sunshine Square, from the files each
   frame fetched and their source maps, so every byte is counted against
   the source file it came from. Scripts only, gzipped:

    | Frame | First measured | Now      |
    | ----- | -------------- | -------- |
    | Page  | 603 KB         | 550 KB   |
    | World | 2,045 KB       | 1,890 KB |

    The first measurement was taken after the two largest cuts, which an
    earlier, coarser count had already found: the page no longer downloads
    the engine it never ran, and the world no longer loads Firebase.

    - **The page no longer downloads the engine.** The space's route
      imported the engine's side of the page, and importing it starts the
      engine's downloads. That side is now a file of its own
      (`features/worlds/NativeSpace.tsx`) which only a document that
      draws a world loads. Where worlds are not framed it stays part of
      the page: the choice is made on the value written at build time, so
      that build is as it was.
    - **The world loads no Firebase.** For every visitor a world kept two
      live channels open so that edits show as they are saved: a listener
      on the space's document and a feed of editor actions. They are the
      page's now (`utils/liveSpace/`, `features/worlds/relayedLive.ts`):
      the page reads for whichever space the world is in and writes only
      to the feed of the space it opened. The page loads Firebase once
      the world has drawn, and without its sign-in library for a visitor
      who has no Firebase sign-in saved.
    - **The world loads no rooms client**, no Ethereum library (it was
      imported up front to sign a purchase), no date library (one call,
      now a small function checked against it), no debug panel unless
      `?debug=true`, and no script runtime until a script is run.
    - **The world's side has a lighter app shell.** The server says which
      side of the frame a document is, so from the first render the
      world leaves out the studio's AI assistant, the sign-in sheet, the
      sign-in link handler and the site's header, and their code.
    - **Sign-in and wallet-address code load when used**, on both sides.

    What the world still loads is, by weight, the engine: three.js
    (624 KB), the engine's own code (about 550 KB), the avatar library
    (72 KB) and React. Not the engine, and left for now: the interface's
    animation library (34 KB, used by the engine's own panels), every
    language's translations (33 KB, in both frames), the artwork and
    account panels (33 KB), the search panel (20 KB) and the live
    document store shared with the studio (22 KB). On the page: Firebase
    (about 170 KB, for the live channels, after the world has drawn), the
    rooms client it uses, and the same translations.

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
-   Slice 4, links: a framed world called `window.open`, and a link to
    a new tab was clicked in it. The page offered each by its host;
    pressing the offer opened the tab at that address; a `javascript:`
    address was ignored. The artwork panel's own links _(not tested)_ in
    a browser.
-   Framed against unframed, on production builds of the same commit
    (headless Chromium, WebGL2, software rendering), for the three staff
    picks after Starry Night (980 Madison, CyberKongz, Sunshine Square), as
    a guest and as the signed-in owner: the same avatar and size, dock,
    title and connection line, the same errors and failed requests, and
    load times within a few seconds of each other. CyberKongz's 54
    artworks arrive one by one, so a count taken mid-load differs from run
    to run; both settle on the same 746 meshes.
-   Slice 4, the account, on Starry Night as the owner: the avatar picker
    listed the same 136 avatars, a pick was saved by the page with its
    session, the emotes and people panels opened, and the frame held no
    cookie and no token. A photo the world made was offered by name and
    saved on the click. An account's own uploaded avatars, wallet-owned
    avatars and saving an edit to a space _(not tested)_.
-   Slice 4, gates, in the phone layout: a password world showed its lock,
    then the prompt, kept it on a wrong password and closed it on the right
    one; a no-guests world stayed locked. The same, step for step, as
    unframed. The desktop entry control, which follows the pointer, and a
    token gate _(not tested)_.
-   Embedded on another site, a space ran in its own page, not in a second
    frame.
-   Slice 6, world scripts, on Starry Night with a real model call: the
    house was there; the space's saved script started in the world's frame
    for the owner and for a guest; the AI button and sidebar were the
    page's and absent from the world; a request was written, tried and
    swapped into the world, and undo went back; a guest had no button;
    every call to the model and every save came from the page's origin.
    The same, step for step, as unframed. Software rendering draws Starry
    Night at under a frame a second, so the world's own meshes were hidden
    during these runs to keep it usable.
-   Slice 5, the lobby: a stand-in lobby (a page of the site framing the
    world as the lobby does and speaking the journey's protocol) took
    Sunshine Square through the whole journey with the world three frames
    down: prepared, enter, entered, stage-reveal, reveal-ready, reveal,
    revealed, ending in play with input released. The same steps as
    unframed, in 37 s against 35 s. The real lobby, its portal preview and
    its warm-up _(not tested)_.
-   A real GPU, WebGPU, Safari, a phone, and load times on a real device
    _(not tested)_.

## 6. Open

-   With the engine drawing, a message relayed by the page (700 positions,
    20 times a second) was handled in the world no later than a message
    the world sent itself: both wait for the frame being drawn. Measured
    in software rendering at 70 ms and 122 ms a frame; on a real GPU
    _(not measured)_. If it ever shows there, the world can hold its own
    socket with a ticket for one room from the page.
-   The world host's domain, and adding it to the room servers' allowed
    origins and the Firebase project's allowed domains. Until there is
    one, a Vercel preview of the `games-dev` branch frames worlds by
    itself: Vercel serves each deployment at its own address as well as
    at the branch's, so the branch's address is the site and the
    deployment's own is the world host (`frontend/utils/siteOrigin.js`).
    Production and every other branch are as before.
-   Production Firestore rules are not in this repository; the world reads
    as a signed-out visitor does today.
-   VR from inside a frame needs `xr-spatial-tracking` on the frame and a
    headset to try it _(not tested)_.
-   Who draws phone controls, the page or the world.
-   A browser slows a frame from another origin to about two frames a
    second while something opaque covers it, or while it is unseen. The
    engine paces loading by frames, so a covered world loaded in 134 s
    against 51 s unframed. The cover is now a breath short of opaque and
    a framed world keeps its own frames coming while the browser holds
    them back (`features/worlds/worldFrames.ts`): 54 s. Anything new
    drawn over a loading world must not be fully opaque.
-   Games published before the page's keys changed (Escape and Enter are
    the page's; Cmd or Ctrl with M mutes) carry the old key list until
    they are built again.
-   A script in a world can ask the page to `travel` without the visitor
    clicking anything. It can only reach this site's own pages.
-   A frame-rate setting at the Oncyber level, by game and hardware. Not
    part of this work.
