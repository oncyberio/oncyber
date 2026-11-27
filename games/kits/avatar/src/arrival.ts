/**
 * The arrival pose. A visitor leaves the lobby crouched, facing the lobby's
 * camera with nothing in their hands. A game that shows the same thing in
 * its first frame, then stands the avatar up when the page says `entered`,
 * makes the trip look like one continuous shot. Pure state: no renderer.
 */

import { arrival as lobbyArrival } from "../../locomotion/src/arrival.ts";

export interface ArrivalView {
    /** The lobby camera, relative to the avatar's feet. */
    cameraOffset: { x: number; y: number; z: number };
    cameraTargetOffset: { x: number; y: number; z: number };
    avatarRotation: number;
    avatarHeight: number;
    fov: number;
}
export type ArrivalPhase = "none" | "crouched" | "rising" | "standing";

/** Seconds from crouched to standing. */
export const ARRIVAL_RISE_SECONDS = 0.7;

/** The page's `arrival` message `view`, or null when it is malformed. */
export function readArrivalView(value: any): ArrivalView | null {
    const vector = (v: any) =>
        v &&
        [v.x, v.y, v.z].every(
            (n) =>
                typeof n === "number" &&
                Number.isFinite(n) &&
                Math.abs(n) <= 1000
        );
    if (
        !value ||
        !vector(value.cameraOffset) ||
        !vector(value.cameraTargetOffset) ||
        !Number.isFinite(value.avatarRotation) ||
        !(value.fov > 5 && value.fov < 150)
    )
        return null;
    const copy = (v: any) => ({ x: v.x, y: v.y, z: v.z });
    return {
        cameraOffset: copy(value.cameraOffset),
        cameraTargetOffset: copy(value.cameraTargetOffset),
        avatarRotation: value.avatarRotation,
        avatarHeight:
            value.avatarHeight >= 0.2 && value.avatarHeight <= 10
                ? value.avatarHeight
                : 1.8,
        fov: value.fov,
    };
}

export interface ArrivalFraming {
    /** Camera position and look-at point in the avatar's own frame: the avatar stands at the origin facing +z. */
    offset: [number, number, number];
    look: [number, number, number];
    fov: number;
}
const DEFAULT_FRAMING: ArrivalFraming = {
    offset: [0, 2.3, 4.8],
    look: [0, 1.25, 0],
    fov: 50,
};

/**
 * The lobby's camera in the avatar's frame, scaled to the game's avatar
 * height. The lobby camera sits in front of the avatar, so with the avatar
 * facing +z the camera comes out on the +z side: the visitor faces it.
 *
 * The turn itself is the locomotion kit's `arrival` helper
 * (games/kits/locomotion), the one place that maps a lobby view into a
 * game: this asks it for an avatar at the origin facing +z. A game that
 * also walks like the lobby calls `arrival` directly and gets its follow
 * camera too (Ace does).
 */
export function arrivalFraming(
    view: ArrivalView | null,
    height: number
): ArrivalFraming {
    const fallback = (fov = DEFAULT_FRAMING.fov): ArrivalFraming => ({
        offset: [...DEFAULT_FRAMING.offset],
        look: [...DEFAULT_FRAMING.look],
        fov,
    });
    if (!view) return fallback();
    // The helper's headings have 0 facing -z; +z is half a turn.
    const staged = lobbyArrival(view, {
        at: { x: 0, z: 0 },
        facing: 0,
        avatarFacing: Math.PI,
        avatarHeight: height,
    });
    const { position: p, target: t } = staged;
    // No lobby framing came out of it, or a camera at the avatar's feet or
    // inside it: not a usable view.
    if (staged.camera.fov === null || Math.hypot(p.x, p.y, p.z) < 0.6)
        return fallback(view.fov);
    return { offset: [p.x, p.y, p.z], look: [t.x, t.y, t.z], fov: staged.fov };
}

/** Heading (radians about +y, 0 faces +z) that turns something at `from` toward `to`. */
export function headingToward(
    from: { x: number; z: number },
    to: { x: number; z: number }
): number {
    return Math.atan2(to.x - from.x, to.z - from.z);
}

/** True when a body with this heading at `from` faces `to` within 60 degrees. */
export function faces(
    from: { x: number; z: number },
    heading: number,
    to: { x: number; z: number }
): boolean {
    const dx = to.x - from.x,
        dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) return true;
    return (Math.sin(heading) * dx + Math.cos(heading) * dz) / length >= 0.5;
}

export interface Arrival {
    readonly phase: ArrivalPhase;
    /** 1 crouched, 0 standing, eased: quick off the floor, gentle at the top. */
    readonly crouch: number;
    /** True from staging until the game hands the visitor something. */
    readonly handsEmpty: boolean;
    readonly view: ArrivalView | null;
    /** The page sent `arrival`: crouch (when a lobby view came with it) and empty the hands. */
    stage(view: ArrivalView | null, options?: { entered?: boolean }): void;
    /** The page sent `entered`: stand up. */
    enter(): void;
    /** The game gave the visitor something to hold (a racket, a tool). */
    fillHands(): void;
    update(seconds: number): void;
}

export function createArrival(): Arrival {
    let phase: ArrivalPhase = "none",
        sink = 0,
        rising = false,
        hands = false,
        view: ArrivalView | null = null;
    return {
        get phase() {
            return phase;
        },
        get crouch() {
            return sink * sink * (3 - 2 * sink);
        },
        get handsEmpty() {
            return hands;
        },
        get view() {
            return view;
        },
        stage(next, options = {}) {
            view = next;
            hands = true;
            // Without a lobby view nobody saw the visitor crouch: start standing.
            sink = next ? 1 : 0;
            rising = !next || Boolean(options.entered);
            phase = sink > 0 ? (rising ? "rising" : "crouched") : "standing";
        },
        enter() {
            if (phase === "none") return;
            rising = true;
            if (sink > 0) phase = "rising";
        },
        fillHands() {
            hands = false;
        },
        update(seconds) {
            if (!rising || sink <= 0 || !(seconds > 0)) return;
            sink = Math.max(0, sink - seconds / ARRIVAL_RISE_SECONDS);
            if (sink === 0) phase = "standing";
        },
    };
}

export interface CrouchPose {
    /** How far the hips come down, in the same unit as the leg lengths. */
    drop: number;
    /** Rotations about x, radians, for a rig that faces +z in a T-pose. */
    upperLeg: number;
    lowerLeg: number;
    foot: number;
    spine: number;
    head: number;
    /** The left upper arm's rotation about z (the right arm mirrors it), and both arms' swing forward about y. */
    armDown: number;
    armForward: number;
    elbow: number;
}

/**
 * A crouch that keeps the feet planted: the hips drop and the knees take up
 * the slack (thigh `upper`, shin `lower`), the back leans in and the head
 * stays up toward the camera. `amount` 1 is the full crouch, 0 standing.
 */
export function crouchPose(
    amount: number,
    upper: number,
    lower: number
): CrouchPose {
    const k = Math.max(0, Math.min(1, amount));
    const reach = upper + lower;
    const drop = reach * 0.42 * k;
    const span = Math.max(Math.abs(upper - lower) + 1e-6, reach - drop);
    const angle = (a: number, b: number, c: number) =>
        Math.acos(
            Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)))
        );
    const hip = upper > 0 && k > 0 ? angle(upper, span, lower) : 0;
    const ankle = lower > 0 && k > 0 ? angle(lower, span, upper) : 0;
    return {
        drop,
        upperLeg: -hip,
        lowerLeg: hip + ankle,
        foot: -ankle,
        spine: 0.3 * k,
        head: -0.22 * k,
        armDown: -1.2 * k,
        armForward: 0.35 * k,
        elbow: 0.5 * k,
    };
}
