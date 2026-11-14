# Games: phones and gamepads

Rule for coding agents: **declare the devices your game supports in
`game.json`, bind every action there, and never read touch or gamepad
events yourself.** The runtime builds the on-screen stick, the buttons and
the gamepad mapping from the bindings; `pnpm games:check` then plays the
game on each device.

## Declare

```json
{
    "devices": ["desktop", "phone", "gamepad"],
    "runtime": {
        "input": {
            "up": {
                "keyboard": ["KeyW", "ArrowUp"],
                "touch": "stick-up",
                "gamepad": ["left-stick-up", "dpad-up"]
            },
            "jump": {
                "keyboard": ["Space"],
                "touch": "button:Jump",
                "gamepad": "button-a"
            }
        }
    }
}
```

`devices` lists what you claim works: `desktop` (keyboard), `phone` (touch,
portrait, 412 x 839) and `gamepad`. Claim only what the check passes.

| Binding    | Values                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `keyboard` | A list of `KeyboardEvent.code` values.                                                                                                                                                                                                                                                                                                                                               |
| `touch`    | `stick-up`, `stick-down`, `stick-left`, `stick-right` (0 to 1); `stick-x`, `stick-y` (-1 to 1, right and up positive); `button` or `button:Label` (label up to 12 characters). The first button declared is the large one in the corner.                                                                                                                                             |
| `gamepad`  | One name or a list. Buttons: `button-a`, `button-b`, `button-x`, `button-y`, `left-bumper`, `right-bumper`, `left-trigger`, `right-trigger`, `button-select`, `button-start`, `left-stick-press`, `right-stick-press`, `dpad-up`, `dpad-down`, `dpad-left`, `dpad-right`. Sticks: `left-stick-` or `right-stick-` plus `up`, `down`, `left`, `right` (0 to 1) or `x`, `y` (-1 to 1). |

Any other `touch` string names a control your own UI page provides through
the UI bridge; the runtime draws nothing for it and the phone check cannot
press it.

## Read

Game code reads actions, never devices:

```js
const x = ctx.input.right - ctx.input.left; // held value, any device
if (ctx.pressed.jump) jump(); // rising edge, any device
```

A game on the lifecycle gets this from `createBrowserSession`. A game that
isn't yet can call `bindBrowserInput(sink, manifest.runtime)` from
`@oncyber/game-runtime/browser` with a sink that has `action(name, value)`,
`clearInput()` and `phase: "entered"` (see `games/ace/src/input.js`).

Do not add listeners for `touchstart`, `touchmove`, `touchend`, pointer
events filtered by `pointerType`, or call `navigator.getGamepads()`. The
check lists every source line that does (`DEVICE_CODE`).

## Style and show

The controls appear on touch screens only, as plain elements you may
restyle or hide from CSS. Every runtime rule has zero specificity, so any
rule of yours wins.

```css
.oncyber-controls {
    display: none;
} /* hide in menus */
body.playing .oncyber-controls {
    display: block;
}
.oncyber-controls [data-oncyber-action="jump"] {
    background: gold;
}
.oncyber-controls [data-oncyber-stick-base] {
    border-color: white;
}
```

Menus are ordinary HTML buttons; a tap is a click. Keep the controls
hidden while a menu is open so they don't cover it.

## Check

`pnpm games:check <id>` runs three profiles and prints one line each:

| Profile   | How it plays                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop` | 1280 x 720. The scenario sets actions directly.                                                                                                                                  |
| `phone`   | A phone-sized touch viewport. Each scenario action is a real touch on the stick or button bound to it. Also checks the controls are on screen, 44 px or more, and don't overlap. |
| `gamepad` | 1280 x 720 with a stand-in standard gamepad. Each scenario action presses the button or tilts the stick bound to it. Runs when any action has a gamepad binding.                 |

A game without a scenario (boot only) gets every control pressed in turn
instead; open with `?check`, it should go straight to play so the controls
are showing.

Results land in `check.json` under `devices` (`declared`, `notes`,
`profiles.desktop|phone|gamepad`) with `.check/screenshot-phone.png` and
`.check/screenshot-gamepad.png`. Device results are labels, with one
exception: **if `devices` claims `phone` and the phone run fails, the check
fails** (`PHONE_FAILED`) and nothing is published.

To make a lifecycle game's host drive devices, pass the driver to
`runCheck` (one line, see `games/garden/src/host/browser.js`):

```js
import { deviceAct } from "@oncyber/game-runtime/device-check";
runCheck({ ..., act: deviceAct(host.session) });
```

Common findings:

| Code                                  | Fix                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `DEVICES_UNDECLARED`                  | Add `devices` to `game.json`.                                               |
| `NO_TOUCH_CONTROL:<action>`           | The scenario uses an action with no `stick-*` or `button` binding. Add one. |
| `TOUCH_CONTROL_HIDDEN:<action>`       | Your CSS hides the controls while the scenario needs them.                  |
| `NO_GAMEPAD_BINDING:<action>`         | Add a `gamepad` binding.                                                    |
| `DEVICE_INPUT_LOST`, `CONTROL_DEAD`   | The control was pressed but the game never saw it; something covers it.     |
| `TOUCH_CONTROLS_OVERLAP`, `..._SMALL` | Too many buttons for a phone. Merge actions or restyle.                     |
| `DEVICE_CODE`                         | Remove the touch or gamepad listener; bind the action instead.              |

## Where it lives

| Path                                  | What                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| `games/runtime/src/devices.ts`        | Binding names, stick and gamepad maths, `describeDevices` |
| `games/runtime/src/deviceControls.ts` | The on-screen controls and gamepad polling                |
| `games/runtime/src/deviceCheck.ts`    | `deviceAct`, the in-frame half of the device profiles     |
| `scripts/games/devices.mjs`           | The device stage of `games:check`                         |
| `games/runtime/test/devices.test.mjs` | Tests                                                     |

## Today

Ace declares all three devices and passes all three. Garden declares
desktop and gamepad; its touch controls are still drawn by its own UI page,
so its phone run is reported as failing and not claimed.

Not built: look and pinch gestures as bindings, a landscape phone profile,
and a headset profile.
