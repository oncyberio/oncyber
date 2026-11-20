# Chat and voice in games

**Rule: a game never builds its own chat or voice.** The page around the
game owns both. A visitor's lobby chat and microphone keep running when they
travel into a game, in the game's room or their party's room, and the game
does nothing to make that happen.

## What a game must not do

-   No chat box, message list or text input for talking to other players.
-   No `getUserMedia`, `RTCPeerConnection`, `MediaRecorder` or speech
    recognition. `pnpm games:check` fails a build that contains them
    (`SOCIAL_OWN_VOICE`).
-   No chat over the relay. A `net` packet shaped like a chat message
    (`type: "MESSAGE"`) or a room command (`type: "RTM_COMMAND"`) is dropped
    by the page, so a game can't speak in a visitor's name.
-   No mute, push-to-talk or volume controls for other people's voices. The
    page has the microphone button.

A game may still play its own sounds and show its own emotes, pings and
quick-chat wheels made of game events. Those are gameplay, not chat.

## What a game may do

Both are optional. A game that does neither still has chat and voice.

```js
import { connectVoice } from "@oncyber/game-runtime/voice";

const voice = connectVoice("<game id>");

// 1. Say where voices come from. Call it every frame if you like; it is
//    sent at most ten times a second. Ids are room ids (from `peers`).
voice.setPoses(
    { x: camera.x, y: camera.y, z: camera.z, h: camera.heading },
    players.map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z }))
);

// 2. Show who is talking.
voice.onTalking((ids, self) => {
    for (const p of players) p.nameTag.talking = ids.includes(p.id);
});
voice.isTalking(id); // or ask per frame
```

Without `setPoses`, a voice's volume follows the room poses the game already
sends with `pose` (full within 4 m, silent past 60 m). Send poses when the
visitor hears from somewhere else (a camera far from the avatar, a seat, a
court) or when players stand where the room doesn't know. A player left out
of `players` keeps the room's rule. Volume follows distance today; `h` is
kept for left and right.

Add the alias to the game's `vite.config.js` next to the other runtime
aliases (see `games/garden/vite.config.js`). Without the runtime, the same
two messages work directly:

| From | Kind      | Meaning                                                         |
| ---- | --------- | --------------------------------------------------------------- |
| game | `voice`   | `{ listener: { x, y, z, h }, players: [{ id, x, y, z }] }`      |
| page | `talking` | `{ ids, self }`: room ids of everyone talking, and whether you. |

## What the page does

| Piece                                              | Where                                                |
| -------------------------------------------------- | ---------------------------------------------------- |
| The social layer: chat log, voice restore, talkers | `frontend/features/games/gameSocial.ts` (no imports) |
| Its React hook and the chat panel                  | `useGameSocial.ts`, `GameChat.tsx`                   |
| The room: chat channel, voice mesh, volumes        | `gameRoom.ts`, `voiceLevels.ts`                      |
| The lobby's half of the handoff                    | `lobbySocialHandoff.ts`, called from `Lobby.tsx`     |
| The game's helper                                  | `games/runtime/src/voice.ts`                         |

On the way in, the game page asks the lobby page around it for the visitor's
recent room chat and their voice state (`oncyber:game-social-request`, same
origin only). It shows that chat above whatever is said in the game, and at
the reveal puts voice back as it was: live if the visitor was talking,
listening if they were listening. The lobby turns its own voice off at the
reveal, so a microphone is never live in two places.

Chat and voice run in one room: the party's (`oncyber-<game>-party-<trip>`)
for a party, else the game's `room`, else its `socialRoom` (both from
`page` in `game.json`, [listing.md](listing.md)). A `socialRoom` is for games with no multiplayer of their own
(Ace): visitors can talk, and the game is told nothing about who is there.
Chat uses the same message as spaces and the lobby (`chat-channel`,
`{ type: "MESSAGE", text }`), at most one a second.

## The check

`pnpm games:check <id>` runs a `social` stage for every game
(`scripts/games/social-check.mjs`). Two visitors chat in a lobby, travel
into the game's real build in the site's sandbox, and the stage fails unless:

-   chat sent before the trip is still shown after it, for both;
-   a message sent in the game arrives, and its sender sees it too;
-   voice comes back as it was (talking, listening), with one microphone
    request and none left in the lobby;
-   who is talking reaches both pages and both game frames, and stops;
-   poses from the game set the volume;
-   the game was posted no chat, and a chat-shaped relay packet is refused
    while an ordinary one still crosses.

The stage runs the page's own `gameSocial.ts`. Rooms and audio are stand-ins
(a headless browser has no microphone): a room is a `BroadcastChannel`, a
voice is a level. The result is `social` in `check.json`; a failure is the
finding `STAGE_SOCIAL`.

## Not built yet

-   Voice state on the way back: returning to the lobby starts with voice
    off, as before.
-   Party chat: the lobby's party conversation still opens over the game
    (and hides this panel while it is open) rather than being this chat.
-   A visit that doesn't start in the lobby has no history to carry.
-   Left and right panning from the listener's heading.
