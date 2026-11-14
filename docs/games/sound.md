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
-   **Suspend and restore.** Silent while suspended or while the tab is
    hidden, back as it was afterwards.

## Do

```js
import { connectGameAudio } from "@oncyber/game-runtime/audio-browser";

// Once, before the game says hello. The argument is the game's id.
const audio = connectGameAudio("mygame");
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

## Don't

-   Don't connect anything to `context.destination`, and don't make a second
    `AudioContext`.
-   Don't play `<audio>` or `<video>` elements directly. Wrap them with
    `context.createMediaElementSource(element)` and connect that to
    `audio.output`.
-   Don't keep a `muted` flag, a volume slider value or a saved sound
    setting in the game. Read `audio.muted` and `audio.volume`; ask with
    `audio.requestMuted()`.
-   Don't call `context.suspend()`, `resume()` or `close()` yourself.

## The check

`pnpm games:check <id>` runs a `sound` stage after the others
(`scripts/games/sound-check.mjs`). It plays the page's part and asserts on
the output's `inspect()` facts:

| Fails with            | Means                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `SOUND_NOT_CONNECTED` | The game declares the `audio` capability but has no SDK output.   |
| `SOUND_LOCKED`        | Sound did not start on a gesture made on the page.                |
| `SOUND_NOT_ROUTED`    | Nothing the game plays arrives at `audio.output` within 8 s.      |
| `SOUND_MUTE`          | Page mute did not bring the level at the speakers' end to zero.   |
| `SOUND_DUCK`          | The game did not drop while someone speaks, or did not come back. |
| `SOUND_BYPASS`        | A node was connected to a destination, or a media element played. |

So a game with sound must be making some within a few seconds of loading
(music, an ambient bed). A game that never answers is reported as `skipped`
unless it declares `audio`; a silent game is fine.

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
    sound button).
-   The game frame has `allow="autoplay"`. Without it the browser ignores a
    gesture made on the page, and sound would wait for one inside the game.
-   Voice gives the page one thing, a `SpeakingSource`:
    `subscribe(listener: (speaking: boolean) => void): () => void`. Pass it
    to `useGameAudio(game, frame, speaking)`. The page holds the game down
    for 0.6 s after speech stops so it doesn't pump between words.
-   The page decides the setting. A game can ask for mute on or off; it
    cannot set the volume.
