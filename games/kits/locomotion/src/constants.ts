// Every number that makes walking feel like the Oncyber lobby, in one place.
// They are copies: the lobby's own code stays the source. The drift test
// (test/lobby-parity.test.mjs) reads the lobby's files and fails when a
// value here no longer matches, so change the lobby first, then this file.
//
// This file imports nothing, so any tool can read it.

/** Movement. Source: multiplayer/protocol/movement.js. Metres and seconds
 * for an avatar of `referenceHeight`. */
export const MOTION = {
    /** Fixed simulation step, seconds. */
    step: 1 / 60,
    /** Top speed with movement held. */
    walkSpeed: 3.2,
    /** Top speed with run (Shift) held. */
    runSpeed: 5.4,
    /** Speed can grow by at most this much per second. */
    acceleration: 6.4,
    /** How fast velocity eases toward the input while moving (1/s). */
    steerRate: 12,
    /** How fast it eases to rest after release (1/s). */
    brakeRate: 28,
    /** Below this speed with no input, the avatar is at rest. */
    restSpeed: 0.06,
    /** Input smaller than this counts as released. */
    inputDeadzone: 0.01,
    /** Launch speed of a jump, and of the second jump in the air. */
    jumpSpeed: 6,
    gravity: 18,
    /** Jumps allowed before landing. */
    maxJumps: 2,
    /** How fast the body turns to face its travel (1/s). */
    faceRate: 12,
    /** The body only turns while travelling faster than this. */
    faceMinSpeed: 0.1,
    /** Longest frame the simulation accepts, seconds. */
    maxFrame: 0.1,
    /** Avatar height the speeds are tuned for (docs/locomotion.md). */
    referenceHeight: 1.8,
} as const;

/** Speeds the lobby's walk and run clips are authored at
 * (frontend/features/lobby/locomotion.ts), for picking a clip by speed. */
export const GAIT = { walk: 1.6, run: 4.5 } as const;

/** Third-person camera. Source: frontend/features/lobby/createLobbyScene.tsx. */
export const CAMERA = {
    /** From the look point to the camera. */
    distance: 5,
    /** The look point's height above the avatar's feet. */
    lookHeight: 1.2,
    /** Resting pitch, radians. Negative looks down. */
    pitch: -0.28,
    pitchMin: -0.65,
    pitchMax: 0.05,
    /** Vertical field of view, degrees. */
    fov: 58,
    /** Field of view when the view is narrower than `narrowWidth` CSS px. */
    narrowFov: 72,
    narrowWidth: 600,
    near: 0.08,
    /** How fast the view eases to where the visitor pointed it (1/s). */
    lookRate: 18,
    /** Radians of yaw and pitch per CSS pixel dragged. */
    dragYaw: 0.0032,
    dragPitch: 0.0025,
    /** Radians of pitch per wheel pixel, and the most one event counts. */
    wheelPitch: 0.0015,
    wheelMax: 160,
    /** Arrow keys turn the view at this rate, radians per second. */
    keyTurnRate: Math.PI / 2,
    /** A press that moves less than this many pixels is a click, not a drag. */
    dragThreshold: 6,
} as const;

/** Keyboard actions, by KeyboardEvent.code. Source: lobbyControls.ts and
 * createLobbyScene.tsx. Arrows steer the view; A and D strafe. */
export const KEYS = {
    forward: ["KeyW", "ArrowUp"],
    back: ["KeyS", "ArrowDown"],
    left: ["KeyA"],
    right: ["KeyD"],
    turnLeft: ["ArrowLeft"],
    turnRight: ["ArrowRight"],
    run: ["ShiftLeft", "ShiftRight"],
    jump: ["Space"],
} as const;

/** Touch. Source: createLobbyScene.tsx. The stick reaches full tilt this
 * many CSS pixels from its centre; a drag on the view looks around. */
export const TOUCH = { stickRadius: 30 } as const;

/** Gamepad (standard mapping). The lobby reads no gamepad yet, so these are
 * the kit's own and nothing checks them against the lobby. */
export const GAMEPAD = {
    moveAxes: [0, 1],
    lookAxes: [2, 3],
    deadzone: 0.2,
    /** Right stick at full tilt, radians per second. */
    lookYawRate: 2.6,
    lookPitchRate: 1.6,
    /** A. */
    jumpButton: 0,
    /** Left stick press, or the right trigger. */
    runButtons: [10, 7],
} as const;

/** After `arrival`, the camera eases from the lobby's last frame to the
 * follow camera at this rate (1/s) once the visitor moves or looks. Kit's own. */
export const ARRIVAL = { settleRate: 4 } as const;
