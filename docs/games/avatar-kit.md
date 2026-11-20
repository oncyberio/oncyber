# Avatars in games

Rules for anyone, human or coding agent, building a game in `games/<id>/`.
The lifecycle and the page bridge: [../games.md](../games.md).

## The rule

1. **Other people appear as their Oncyber avatar** unless the game says why
   not in `game.json`. A player whose avatar hasn't loaded, or who has none,
   still appears: as a stand-in body with their name.
2. **The visitor arrives in the arrival pose**: when `enter()` hears a
   lobby arrival with its view (`continuity.arrival`,
   [contract.md](contract.md); the `arrival` message in a build before the
   contract), the first frame shows their avatar crouched, facing the
   camera, with empty hands. When the page sends `entered`, the avatar
   stands up. Give them a racket, a tool or a pet only after that.

`game.json` (both lines are the default; write them anyway):

```json
"avatars": { "others": "avatar", "arrival": "pose" }
```

To opt out of either, say why in a sentence. The check prints the reason
instead of testing it:

```json
"avatars": {
    "others": "other",
    "why": "Everyone is a chess piece; the board is the game.",
    "arrival": "none",
    "arrivalWhy": "The board is seen from above, with no body to stand up."
}
```

## Use the kit

`games/kits/avatar/` is an optional library for three.js games. A game
bundles it like any other source; the lifecycle runtime never imports it
(the runtime has no renderer). Alias it in `vite.config.js` as Ace does
(`games/ace/vite.config.js`), with `dedupe: ["three", "@pixiv/three-vrm"]`
so the game and the kit share one copy of each.

```js
import { createAvatarKit, arrivalFraming } from "@oncyber/avatar-kit";
import locomotionUrl from "@oncyber/avatar-kit/motion/locomotion.json?url";
import emotesUrl from "@oncyber/avatar-kit/motion/emotes.json?url";

const kit = createAvatarKit({
    services, // context.services: identity.avatar and avatar(ref, signal)
    motion: () => fetch(locomotionUrl).then((r) => r.json()),
    emotes: () => fetch(emotesUrl).then((r) => r.json()), // fetched on first use
    height: 1.75,
});
scene.add(kit.self.root, kit.group); // the visitor, and everyone else
await kit.loadSelf();

// From the host (Ace: games/ace/src/host.js hands these to the game)
page.on("peers", (players) => kit.setPeers(players)); // poses, names, avatars, talking
function enter(continuity) {
    const view = continuity.arrival.view; // null on a direct visit
    kit.arrival.stage(view); // crouched, hands empty
    const { offset, look, fov } = arrivalFraming(view, 1.75); // the lobby's camera, avatar facing +z
}
page.on("revealed", () => kit.arrival.enter()); // the page's `entered`: stand up

// Every frame, before rendering
kit.self.motion = { speed }; // or { air: true }, { wave: true }
kit.update(seconds, camera);

kit.emote("HIPHOP"); // a lobby emote; kit.emote("") ends it
postPose(kit.pose(position, heading)); // others see the motion and the emote
inspect: () => ({ ...kit.inspect() /* , the game's own facts */ });
```

What it does:

-   **Avatars.** The visitor's and other players' VRMs, only through
    `services.avatar()`, so only avatars the page vouches for. A game not on
    the lifecycle host yet gets the same contract from `pageAvatarService()`
    (`@oncyber/avatar-kit/page`): vouch the identity's avatar and each
    announced player's, nothing else is fetched.
-   **Lobby motion.** Idle, walk, run, jump and wave from the lobby's own clip
    files (`motion/`, copied by `npm run motion`; a test fails when they
    drift). Emotes are four short lobby loops by default.
-   **Name tag and talking indicator** over each other player. The page
    decides who is talking; no audio reaches the game. The kit reads
    `talking` on each entry of `peers`. Ace's host also sets it from the
    voice helper (`connectVoice().isTalking(id)`,
    [voice-chat.md](voice-chat.md)) before handing the list to the kit.
-   **Arrival pose.** `kit.arrival` holds the crouch until `entered`, then
    stands the avatar up in 0.7 s. Call `kit.arrival.fillHands()` when the
    game hands the visitor something.
-   **Arrival camera.** One helper turns the lobby's view into a camera in
    the game's space: `arrival` in the locomotion kit
    ([locomotion.md](locomotion.md)). `arrivalFraming` is that helper asked
    for an avatar at the origin facing +z, for a game that only needs the
    framing. A game whose visitor then walks calls `arrival` itself and
    keeps the follow camera it returns (Ace does); don't compute it twice.
-   **A game that poses the rig itself** (Ace's tennis swing) sets
    `kit.self.manual = true` while it does, after `kit.self.rest()`.

A game with its own avatar code (Garden's DOM-free reader) can keep it: pass
`load` to the kit, or report the same facts itself with `drawProbe()`
(`@oncyber/avatar-kit/probe`) as Garden does.

Not built: a way to play a game's own clips on the kit's rig. `addClips`
takes lobby clips only, so a game with its own motion either poses the
bones by hand (`manual`, Ace) or keeps separate bodies for play and loads
the visitor's avatar a second time from the same bytes (Padel's match
bodies, `games/padel/src/avatars.js`). The kit also has no avatar for an
NPC, and its stand-in body has near-black legs that the departure stage
cannot tell from the black frame; the check's main visit sends no avatar,
so a game that shows the stand-in there fails `DEPARTURE_MISMATCH` (Padel
gives a visitor without an avatar its house avatar instead).

## The check

`pnpm games:check <id>` runs an avatar stage
(`scripts/games/avatar-check.mjs`). It opens the build with
`?check=avatars&party=2`, plays the page's part for a party of two with a
test avatar (answering in the form the game greeted in: a contract game
gets the lobby's view and the party in `enter`), and asks the game for
`inspect()`:

| When                 | Must be true                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| after the arrival    | `avatarSelf` is `vrm` or `stand-in`, `avatarSelfInFrame`, `avatarArrival: "crouched"`, `avatarFacingCamera`, `avatarHandsEmpty` |
| after `entered`      | `avatarArrival: "standing"`                                                                                                     |
| with a second player | `avatarOthersDrawn >= 1` and `avatarOthersVrm >= 1`                                                                             |

"Drawn" means the renderer submitted the body's meshes in the last frame,
not that an object exists. To answer the question, call
`answerInspect(inspect)` from `@oncyber/avatar-kit/page` once (it only
answers when the page was opened with `?check`). Findings are `AVATAR_*`
in `check.json`; the two frames are saved as
`games/<id>/.check/avatar-arrival.png` and `avatar-party.png`.

If the headless browser loses its graphics device the stage fails with
`AVATAR_GPU_LOST`: run with `PW_CHANNEL=chrome`, or
`GAMES_CHECK_QUERY="&webgl"` for a game with a WebGL fallback (Garden).

Tests: `npm --prefix games/kits/avatar test`.
