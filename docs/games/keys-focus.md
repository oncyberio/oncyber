# Games: keys and focus

The rule, for anyone (person or coding agent) writing a game:

> **A game takes input only as the actions it declares in `game.json`. It
> never listens for keys itself, and never binds a key the page reserves.**

The page around a game has a world menu, chat and a sound switch. If a game
reads the keyboard itself, typing "wasd" in chat walks the player. So the
page tells the game when the visitor's attention is elsewhere, and owns one
key. It takes no more than that: every other key is the game's.

## Keys the page reserves

| Key (`KeyboardEvent.code`) | The page does                   |
| -------------------------- | ------------------------------- |
| `Escape`                   | Opens and closes the world menu |

Escape is the page's because it cannot be a game's: the browser takes it to
free the pointer whatever the game does. Enter and M are the game's to bind,
like any other key. The page opens chat and changes sound from its own
buttons, and takes no key with Cmd, Ctrl or Alt held, so the system's and
the browser's shortcuts (Cmd+M among them) work as they do anywhere.

The table lives in `games/runtime/src/keys.ts` (`RESERVED_KEYS`) and
`frontend/features/games/gameInput.ts`; a test keeps them equal. A reserved
key in `game.json` fails the check: use P for a pause of your own.

## Do

1. Declare every action and its keys in `game.json`: `runtime.input` for a
   game on the lifecycle, top-level `input` otherwise.

    ```json
    "input": {
        "up": { "keyboard": ["KeyW", "ArrowUp"] },
        "flat": { "keyboard": ["KeyJ", "Space"] }
    }
    ```

2. Bind once, with the runtime (alias `@oncyber/game-runtime/keys-browser`
   to `games/runtime/src/keysBrowser.ts` in the game's Vite config):

    ```js
    import { bindPageKeys } from "@oncyber/game-runtime/keys-browser";
    import manifest from "../game.json";

    const keys = bindPageKeys({
        game: "ace", // the game's id
        prefix: GAME_MESSAGE_PREFIX, // a game on the one contract (contract.md)
        input: manifest.input,
        action(name, value) {}, // a declared action went down (1) or up (0)
        paused(reason) {}, // "typing", "menu", ...: stop taking input
        resumed() {},
        probe: () => ({ position: [x, y, z] }), // facts for the check
    });
    ```

    A game on the lifecycle calls
    `bindSessionKeys(session, { game, prefix, input })` instead (Ace does, in
    `games/ace/src/host.js`): the actions are the ones `runtime.input`
    declares, they go to the session, the session takes no action or delta
    from any device while input is paused, and the game may implement
    `inputPaused(paused, reason)`. A game whose interface is a nested frame
    binds in that frame too and calls `relayPageKeys(frame, game)` in the
    outer one (Garden does).

3. On `paused`, stop reading every device (touch, gamepad, mouse), not only
   the keyboard, and let nothing the visitor controls move. Held actions
   have already been released with `action(name, 0)`. A single-player game
   should also stop its clock: hold the game's one pause for it
   (`pausing.hold("input")`, [loading-and-pausing.md](loading-and-pausing.md)),
   as Ace does for a match against the CPU. A match another person is
   playing is never held. `resumed` comes
   exactly once per pause, however many page surfaces overlapped.

4. Take the pointer lock with `keys.lockPointer(element)`. The binder gives
   the lock up when input pauses and takes it back on the visitor's next
   click after it resumes. When the browser drops the lock on Escape (it
   keeps that key event to itself), the binder tells the page, so the world
   menu opens.

## Don't

-   `addEventListener("keydown" | "keyup" | "keypress", ...)`, `onkeydown`,
    or a helper that does the same, anywhere in the game's source.
-   `element.requestPointerLock()` or `navigator.keyboard.lock()`.
-   A menu on Escape. A sound key or button of the game's own asks the
    page through the game's sound output (`audio.requestMuted`,
    [sound.md](sound.md)): sound stays the page's one setting.
-   A text field that needs a key listener. `change` fires when the visitor
    presses Enter in a field.

## What the page does

`frontend/features/games/gameInput.ts` (used by `GameInputLayer`, mounted in
`GamePage`):

-   Pauses the game while any text field of the page has focus (and, inside
    the lobby, any text field of the lobby), and while the world menu is
    open. Other page surfaces call `host.hold("reason")` and
    `host.release("reason")`.
-   Handles Escape the same way whether the game or the page has focus:
    it opens and closes the world menu. In a text field it leaves the
    field and gives the game its focus back; every other key there is
    text.
-   Changes sound from the page's own button, the page's one sound setting
    (`gameAudio.ts`); the game hears it on the sound channel
    ([sound.md](sound.md)).

Messages, after the prefix (`oncyber:game:` for a game on the one contract,
`<id>:` for an older build; the page answers in the form the game greeted
in, see [contract.md](contract.md)):

| From | Kind          | Meaning                                                        |
| ---- | ------------- | -------------------------------------------------------------- |
| game | `key`         | `{ code }`: Escape was pressed while the game had focus        |
| page | `input`       | `{ paused, reason }`: stop or resume all input                 |
| page | `muted`       | `{ muted }`: only for a build from before [sound.md](sound.md) |
| page | `input-probe` | Checks only: asks for `input-state`                            |
| game | `input-state` | `{ paused, reason, held, delivered, locked, probe }`           |

## The check

`pnpm games:check <id>` runs `scripts/games/keysCheck.mjs` after the other
stages and writes the result under `keys` in `check.json`:

-   **Scan.** Reads the game's source (not `test/`, `scripts/`, `tools/`,
    `public/`). Fails on raw key listeners (`RAW_KEY_LISTENER`), direct
    pointer or keyboard lock (`RAW_POINTER_LOCK`, `RAW_KEYBOARD_LOCK`) and
    reserved or malformed bindings (`KEY_RESERVED`, `KEY_INVALID`). Alone:
    `node scripts/games/keysCheck.mjs scan <id>`.
-   **Browser.** Opens the build beside the page's real key handling and a
    chat field. It plays, holds a movement key while chat takes the focus,
    types every bound letter into chat, opens the menu with Escape while
    the game keeps the keyboard focus, turns sound off from the page, and
    resumes. The game must take no
    action and `probe().position` must not change while paused
    (`KEYS_LEAK`, `KEYS_MOVED_WHILE_TYPING`, `KEYS_MOVED_IN_MENU`), and must
    move again after.

Tell the browser half how to reach play, in `game.json`:

```json
"keysCheck": { "start": ["Space", "Space"], "ready": { "screen": "playing" }, "move": "KeyD" }
```

`start` is keys to press from the first screen, `ready` is what `probe()`
must report before the test begins, `move` is a key that moves the player.
With `move` set, the check also fails if that key does not move the player
in play, since then it would prove nothing. The key is held several times
(before typing, as focus leaves, after resuming), so pick a place and a
direction with room: Padel's server stands in a box a few metres wide and
ran into its edge, so its check walks the club instead
(`"ready": { "screen": "arrival" }, "move": "KeyW"`). A walker keeps gliding
after its keys are let go: stop it dead in `inputPaused`
(`walker.place({})`), or the visitor slides while they type.

`"keysCheck": { "legacy": true }` lists the scan's findings as warnings and
skips the browser half. It is for a game that still runs on a page of its
own (none today); a game on the shared `GamePage` must not use it.

Tests: `pnpm games:test` (runtime and the check, including a fixture game
that breaks the rule on purpose) and
`pnpm -C frontend test features/games/gameInput.test.ts`.
