# Game sound

**Rule for coding agents: route all sound through the SDK's output; never
keep a private mute.**

A game has one sound output from the runtime. Everything the game plays
connects to `audio.output` (a Web Audio `GainNode`). What happens after that
node belongs to the page, not the game:

-   **Volume and mute.** One setting for the visitor, shared by the page's
    own controls and every game, saved in the browser (`oncyber:sound`).
-   **Starting.** Browsers only start sound after a trusted gesture. The
    output starts on the first one, in the game or on the page around it.
-   **Voice chat.** While someone speaks, the game drops to 30% and comes
    back when they stop.
-   **Suspend and restore.** Silent while the session is suspended, back as
    it was afterwards. Only the one pause suspends a session
    ([loading-and-pausing.md](loading-and-pausing.md)): a hidden tab or a
    page menu silences a solo game, and a match another person is playing
    is never suspended, so it keeps its sound.

## Do

```js
import { connectGameAudio } from "@oncyber/game-runtime/audio-browser";

// Once, before the game says hello. A game on the one contract passes
// nothing; a build from before it passes its id.
const audio = connectGameAudio();
const context = audio.context; // null where there is no Web Audio

const music = context.createGain();
music.connect(audio.output); // not context.destination

// A sound button or the M key asks the page; the answer comes back.
button.onclick = () => audio.requestMuted(!audio.muted);
audio.onChange(() => (label.textContent = audio.muted ? "Off" : "On"));
```

-   Build the graph at load. The context exists but is silent until the
    first gesture; `audio.unlock()` inside a click handler is allowed but
    not needed.
-   Keep your own mix levels (music against effects) on your own gain nodes
    in front of `audio.output`.
-   Skip scheduling work when `audio.audible` is false if it saves effort.
-   On the lifecycle, pass the output to the session
    (`new RuntimeSession(factory, { ..., audio })`). The session silences it
    on `suspend()`, brings it back on `restore()`, hands it to the game as
    `context.audio`, and adds its facts to `inspect()`.
-   Call `audio.dispose()` when the page sends `dispose`.
-   If the game uses the voice helper (`connectVoice`,
    [voice-chat.md](voice-chat.md)), feed it to the duck as well:
    `voice.onTalking((ids, self) => audio.setTalking(ids.length > (self ? 1 : 0)))`.
    The game is lowered while that or the page's `speaking` is true. Ace
    and Garden do this in their hosts.

## Don't

-   Don't connect anything to `context.destination`, and don't make a second
    `AudioContext`.
-   Don't play `<audio>` or `<video>` elements directly. Wrap them with
    `context.createMediaElementSource(element)` and connect that to
    `audio.output`.
-   Don't keep a `muted` flag, a volume slider value or a saved sound
    setting in the game. Read `audio.muted` and `audio.volume`; ask with
    `audio.requestMuted()`.
-   Don't call `context.suspend()`, `resume()` or `close()` yourself, and
    don't listen for `visibilitychange`.
-   Don't use the keys binder's `muted` callback or a saved `muted` value:
    they are from before this channel.

## The check

`pnpm games:check <id>` runs a `sound` stage on the game the scenario
played in, right after the scenario and before the loading stage
(`scripts/games/sound-check.mjs`). It plays the page's part, in the form
the game greeted in, and asserts on the output's `inspect()` facts:

| Fails with            | Means                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `SOUND_NOT_CONNECTED` | The game declares the `audio` capability but has no SDK output.   |
| `SOUND_LOCKED`        | Sound did not start on a gesture made on the page.                |
| `SOUND_NOT_ROUTED`    | Nothing the game plays arrives at `audio.output` within 8 s.      |
| `SOUND_MUTE`          | Page mute did not bring the level at the speakers' end to zero.   |
| `SOUND_DUCK`          | The game did not drop while someone speaks, or did not come back. |
| `SOUND_BYPASS`        | A node was connected to a destination, or a media element played. |

So a game with sound must be making some within a few seconds of loading
(music, an ambient bed). Every later step reads the level at one moment
too, so short one-shot sounds alone do not pass, however many there are:
Padel, whose sound is all Foley, added a very quiet open-air bed for this.
A game that never answers is reported as `skipped` unless it declares
`audio`; a silent game is fine.

The stage has its own test against small fixture games, in headless
Chromium: `node --test scripts/games/sound-check.test.mjs`.

The facts (`audioState`, `audioRouted`, `audioBypass`, `audioMuted`,
`audioVolume`, `audioDucked`, `audioSuspended`, `audioGain`, `audioInput`,
`audioLevel`) are also there for a scenario to assert on.

## How it works

| From | Kind          | Meaning                                                                                                                                             |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| page | `audio`       | Any of `{ volume, muted, speaking, gesture, probe }`. Sent after `hello`, on every change, and on a trusted gesture on the page (`gesture: true`).  |
| game | `audio`       | `{ hello: true }` when the output is created, or `{ muted }` when the game's own control asks. The page saves the setting and answers with `audio`. |
| game | `audio-state` | The output's facts, in answer to `probe: true`.                                                                                                     |

-   Game side: `games/runtime/src/audio.ts` (the output, no DOM) and
    `audio-browser.ts` (messages, gestures, tab visibility, the bypass count).
-   Page side: `frontend/features/games/gameAudio.ts` (the setting and the
    bridge) and `GameSound.tsx` (the hook `GamePage` uses and the page's
    sound button). The hook sends through `GamePage`'s `send`, so a game
    hears `oncyber:game:audio`. M and the world menu's Sound button
    (`GameInputLayer`) change the same setting.
-   The game frame has `allow="autoplay"`. Without it the browser ignores a
    gesture made on the page, and sound would wait for one inside the game.
-   Voice gives the page one thing: whether someone else in the room is
    talking, from the same tracker that sends the game `talking`
    (`useGameSocial`'s `state.talking`, without the visitor). `GamePage`
    passes it to `useGameAudio({ game, fromGame, send, speaking })`. The
    page holds the game down for 0.6 s after speech stops so it doesn't
    pump between words. (`createGameAudioBridge` also takes a
    `SpeakingSource` with `subscribe`, for a page without React.)
-   The page decides the setting. A game can ask for mute on or off; it
    cannot set the volume.
