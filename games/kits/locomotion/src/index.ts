// Oncyber locomotion kit: walk, run, jump and look around like the lobby.
// Pure logic here; ./three applies a camera pose, ./controls binds a page.
export {
    ARRIVAL,
    CAMERA,
    GAIT,
    GAMEPAD,
    KEYS,
    MOTION,
    TOUCH,
} from "./constants.ts";
export {
    STEP,
    advanceVelocity,
    createWalker,
    distanceFromRest,
    stepWalker,
    walkerState,
} from "./motion.ts";
export type {
    MoveInput,
    Walker,
    WalkerOptions,
    WalkerState,
} from "./motion.ts";
export {
    MOVE_CODES,
    createJumpInput,
    keyCode,
    readGamepad,
    readKeys,
    stickVector,
} from "./input.ts";
export {
    cameraPose,
    createFollowCamera,
    dragLook,
    lobbyFov,
    turnLook,
    updateCamera,
    wheelLook,
} from "./camera.ts";
export type { CameraPose, FollowCamera, Point } from "./camera.ts";
export { arrival, readLobbyView } from "./arrival.ts";
export type {
    Arrival,
    ArrivalOptions,
    ContinuityView,
    LobbyView,
} from "./arrival.ts";
export { exposeLocomotionProbe } from "./probe.ts";
export type { LocomotionProbe } from "./probe.ts";
export { applyCameraPose } from "./three.ts";
export { bindControls } from "./controls.ts";
export type { Controls, ControlsOptions } from "./controls.ts";
