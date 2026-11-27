/**
 * What a world script can use, by name: the one list of it. `true` means
 * the model's brief (./brief.ts) tells of it; `false` means it is in the
 * SDK and works, and the model is not offered it yet.
 *
 * The SDK (./sdk.ts) is what makes these names real, and the brief is what
 * the model reads; both are prose and code that no compiler compares. So
 * this list is what they are held to: scriptApi.test.ts runs the real SDK
 * and fails when it has a name that is not here or lacks one that is, and
 * fails when the brief tells of a name marked false, or is silent on one
 * marked true. To add to the API: add it here, in the SDK, and (when the
 * model should use it) in the brief.
 *
 * A thing's own properties (position, color, text...) are not repeated
 * here: they are THING_PROPS in ./protocol.ts, with the same flag.
 */

/** What the script's code is handed, in this order (sdk.ts, both ends). */
export const SCRIPT_GLOBALS = [
    "world",
    "input",
    "ui",
    "sound",
    "keep",
    "wait",
    "every",
    "random",
    "distance",
    "console",
] as const;

export const SCRIPT_API = {
    world: {
        add: true,
        player: true,
        camera: true,
        artworks: true,
        artwork: true,
        things: true,
        time: true,
        style: true,
        onUpdate: true,
        onClick: true,
        restart: true,
        // Made and tested, not yet tried with the model in a browser.
        build: false,
        solid: false,
        open: false,
        avatar: false,
        doors: false,
        door: false,
    },
    input: { isDown: true, onKeyDown: true, onKeyUp: true },
    ui: { hud: true, toast: true, banner: true, clear: true },
    sound: { play: true },
    console: { log: true, warn: false, error: false },
    /** world.player */
    player: { position: true, forward: true, yaw: true, moveTo: true },
    /** world.camera */
    camera: { position: true, forward: true },
    /** Every thing, besides its properties (THING_PROPS). */
    thing: {
        id: true,
        data: true,
        set: true,
        remove: true,
        onClick: true,
        distanceTo: true,
        lookAt: true,
        add: true,
        removed: false,
    },
    /** What world.build() adds to a thing. */
    model: {
        poly: false,
        box: false,
        beam: false,
        prism: false,
        line: false,
        place: false,
        clear: false,
    },
    /** What world.avatar() adds to a thing. */
    avatar: { speak: false },
    /** Each of world.artworks. */
    artwork: {
        id: true,
        name: true,
        type: true,
        position: true,
        rotation: true,
        scale: true,
        visible: true,
        onClick: true,
        reset: true,
        distanceTo: false,
    },
    /** Each of world.doors. */
    door: {
        id: false,
        position: false,
        yaw: false,
        width: false,
        height: false,
        portal: false,
        building: false,
        open: false,
        toWorld: false,
        toLocal: false,
        distanceTo: false,
    },
} as const;

export type ScriptApiOwner = keyof typeof SCRIPT_API;

/** Shapes world.add() makes that the model is not offered yet. */
export const SHAPES_NOT_OFFERED = ["model", "solid", "opening", "avatar"];
