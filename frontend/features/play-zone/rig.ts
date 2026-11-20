import {
    ACTION_REST,
    type ActionPoint,
    type PlayAction,
    type PlayMoment,
} from "../../../multiplayer/protocol/play-action";

/**
 * Turns an action (a few moments saying where the hands, feet and hips
 * should be) into a whole body at any instant. Arms and legs are solved
 * from their ends inward, so a hand lands exactly where a moment puts it
 * and the elbow follows.
 *
 * Everything is in the person's own space, in metres, for a body 1.8 m
 * tall: x to their right, y up from the floor, z the way they face.
 */

/** The joints `actionPose` writes, three numbers each. */
export const JOINTS = [
    "hips",
    "spine",
    "chest",
    "head",
    "leftShoulder",
    "leftElbow",
    "leftHand",
    "rightShoulder",
    "rightElbow",
    "rightHand",
    "leftHip",
    "leftKnee",
    "leftFoot",
    "rightHip",
    "rightKnee",
    "rightFoot",
] as const;
export type Joint = (typeof JOINTS)[number];
const J = Object.fromEntries(JOINTS.map((name, i) => [name, i * 3])) as Record<
    Joint,
    number
>;

/** Pairs of joints to draw a limb between, with how thick it is. */
export const BONES: Array<[Joint, Joint, number]> = [
    ["hips", "spine", 0.13],
    ["spine", "chest", 0.14],
    ["chest", "head", 0.07],
    ["leftShoulder", "rightShoulder", 0.08],
    ["leftShoulder", "leftElbow", 0.055],
    ["leftElbow", "leftHand", 0.048],
    ["rightShoulder", "rightElbow", 0.055],
    ["rightElbow", "rightHand", 0.048],
    ["leftHip", "rightHip", 0.09],
    ["leftHip", "leftKnee", 0.075],
    ["leftKnee", "leftFoot", 0.06],
    ["rightHip", "rightKnee", 0.075],
    ["rightKnee", "rightFoot", 0.06],
];

export const BODY = {
    spine: 0.5,
    neck: 0.22,
    shoulder: 0.2,
    upperArm: 0.3,
    forearm: 0.32,
    hip: 0.1,
    thigh: 0.45,
    shin: 0.44,
    /** The ankle sits this far above where the foot is placed. */
    ankle: 0.07,
};

const EASE: Record<PlayMoment["ease"], (u: number) => number> = {
    linear: (u) => u,
    in: (u) => u * u,
    out: (u) => 1 - (1 - u) * (1 - u),
    "in-out": (u) => u * u * (3 - 2 * u),
};

type Place = "rightHand" | "leftHand" | "rightFoot" | "leftFoot" | "hips";
type Turn = "lean" | "twist";

/**
 * Where one part is at `t` (0 to 1). The action starts and ends standing
 * still, so a part eases from rest to its first mention and from its last
 * mention back to rest. `mix` also gets the stops before and after the two
 * it is between, so a position can curve through its moments instead of
 * turning a corner at each one.
 */
function track<T>(
    action: PlayAction,
    part: Place | Turn,
    t: number,
    rest: T,
    read: (value: unknown) => T,
    mix: (before: T, a: T, b: T, after: T, u: number) => T
): T {
    // Every stop of this part, with standing still at both ends.
    const stops: Array<{ at: number; value: T; ease: PlayMoment["ease"] }> = [
        { at: 0, value: rest, ease: "in-out" },
    ];
    for (const moment of action.moments) {
        const value = (moment as any)[part];
        if (value === undefined) continue;
        const stop = { at: moment.at, value: read(value), ease: moment.ease };
        // A moment at the very start replaces standing still there.
        if (moment.at <= 0) stops[0] = stop;
        else stops.push(stop);
    }
    if (stops[stops.length - 1].at < 1)
        stops.push({ at: 1, value: rest, ease: "in-out" });
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1].at <= t) i++;
    const a = stops[i],
        b = stops[i + 1];
    if (b.at <= a.at) return b.value;
    const u = EASE[b.ease](
        Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)))
    );
    return mix(
        (stops[i - 1] || a).value,
        a.value,
        b.value,
        (stops[i + 2] || b).value,
        u
    );
}

/** A curve through a and b that heads the way its neighbours suggest (Catmull-Rom). */
const curve = (p0: number, p1: number, p2: number, p3: number, u: number) =>
    0.5 *
    (2 * p1 +
        (p2 - p0) * u +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
        (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
const mixPoint = (
    before: ActionPoint,
    a: ActionPoint,
    b: ActionPoint,
    after: ActionPoint,
    u: number
): ActionPoint => [
    curve(before[0], a[0], b[0], after[0], u),
    // Never through the floor, however the curve swings.
    Math.max(0, curve(before[1], a[1], b[1], after[1], u)),
    curve(before[2], a[2], b[2], after[2], u),
];
const mixNumber = (
    _before: number,
    a: number,
    b: number,
    _after: number,
    u: number
) => a + (b - a) * u;

/**
 * Solves a limb of two bones: given where it starts and where its end
 * should be, finds the middle joint, bent towards `pole`. An end out of
 * reach is brought back to full stretch. Writes the middle and the end.
 */
export function solveLimb(
    out: Float32Array,
    start: number,
    middle: number,
    end: number,
    target: ActionPoint,
    upper: number,
    lower: number,
    pole: ActionPoint
) {
    const ax = out[start],
        ay = out[start + 1],
        az = out[start + 2];
    let dx = target[0] - ax,
        dy = target[1] - ay,
        dz = target[2] - az;
    const far = Math.hypot(dx, dy, dz) || 1e-6;
    // Never quite straight or quite folded: the joint keeps a direction to bend in.
    const reach = Math.min(
        (upper + lower) * 0.999,
        Math.max(Math.abs(upper - lower) + 0.02, far)
    );
    dx /= far;
    dy /= far;
    dz /= far;
    const along = (upper * upper + reach * reach - lower * lower) / (2 * reach);
    const off = Math.sqrt(Math.max(0, upper * upper - along * along));
    // The part of the pole that is square to the limb's line.
    const dot = pole[0] * dx + pole[1] * dy + pole[2] * dz;
    let px = pole[0] - dx * dot,
        py = pole[1] - dy * dot,
        pz = pole[2] - dz * dot;
    const length = Math.hypot(px, py, pz);
    if (length < 1e-5) {
        // The pole lies along the limb; any square direction will do.
        px = dy;
        py = -dx;
        pz = 0;
    }
    const scale = 1 / (Math.hypot(px, py, pz) || 1);
    out[middle] = ax + dx * along + px * scale * off;
    out[middle + 1] = ay + dy * along + py * scale * off;
    out[middle + 2] = az + dz * along + pz * scale * off;
    out[end] = ax + dx * reach;
    out[end + 1] = ay + dy * reach;
    out[end + 2] = az + dz * reach;
}

/**
 * The whole body at `t` (0 to 1 through the action), as three numbers a
 * joint in the order of JOINTS. `target` is where the thing being hit is,
 * for moments that send a hand to it.
 */
export function actionPose(
    action: PlayAction | null,
    t: number,
    target: ActionPoint | null = null,
    out: Float32Array = new Float32Array(JOINTS.length * 3)
) {
    const at = Math.min(1, Math.max(0, t));
    const moving = action || {
        name: "",
        seconds: 1,
        contact: null,
        moments: [],
    };
    const place = (part: Place) =>
        track<ActionPoint>(
            moving,
            part,
            at,
            ACTION_REST[part] as ActionPoint,
            (value) =>
                value === "target"
                    ? target || [0.2, 1.5, 0.5]
                    : (value as ActionPoint),
            mixPoint
        );
    const turn = (part: Turn) =>
        track<number>(
            moving,
            part,
            at,
            0,
            (value) => value as number,
            mixNumber
        );

    const hips = place("hips");
    const lean = (turn("lean") * Math.PI) / 180,
        // A twist is a turn to the person's left: the other way round y.
        yaw = (-turn("twist") * Math.PI) / 180;
    const cos = Math.cos(yaw),
        sin = Math.sin(yaw);
    /**
     * A point of the torso, `side` along the shoulders, at the end of a
     * chain of spine pieces, each a length and a share of the lean. The
     * lower back bends less than the upper, and the neck bends back
     * towards level, as a person's does.
     */
    const torso = (
        index: number,
        side: number,
        pieces: Array<[number, number]>
    ) => {
        let y = 0,
            z = 0;
        for (const [length, share] of pieces) {
            y += length * Math.cos(lean * share);
            z += length * Math.sin(lean * share);
        }
        out[index] = hips[0] + side * cos + z * sin;
        out[index + 1] = hips[1] + y;
        out[index + 2] = hips[2] - side * sin + z * cos;
    };
    const half = BODY.spine / 2;
    const lower: [number, number] = [half, 0.55],
        upper: [number, number] = [half, 1.2],
        neck: [number, number] = [BODY.neck, 0.5];
    out.set(hips, J.hips);
    torso(J.spine, 0, [lower]);
    torso(J.chest, 0, [lower, upper]);
    torso(J.head, 0, [lower, upper, neck]);
    torso(J.leftShoulder, -BODY.shoulder, [lower, upper]);
    torso(J.rightShoulder, BODY.shoulder, [lower, upper]);
    // The pelvis follows a third of the twist, so the legs do not snap round.
    const third = yaw / 3;
    for (const [joint, side] of [
        [J.leftHip, -BODY.hip],
        [J.rightHip, BODY.hip],
    ]) {
        out[joint] = hips[0] + side * Math.cos(third);
        out[joint + 1] = hips[1];
        out[joint + 2] = hips[2] - side * Math.sin(third);
    }

    // Elbows hang down, back and out; knees point forward and a little out.
    solveLimb(
        out,
        J.leftShoulder,
        J.leftElbow,
        J.leftHand,
        place("leftHand"),
        BODY.upperArm,
        BODY.forearm,
        [-0.4, -1, -0.5]
    );
    solveLimb(
        out,
        J.rightShoulder,
        J.rightElbow,
        J.rightHand,
        place("rightHand"),
        BODY.upperArm,
        BODY.forearm,
        [0.4, -1, -0.5]
    );
    const ankle = (part: "leftFoot" | "rightFoot"): ActionPoint => {
        const foot = place(part);
        return [foot[0], foot[1] + BODY.ankle, foot[2]];
    };
    solveLimb(
        out,
        J.leftHip,
        J.leftKnee,
        J.leftFoot,
        ankle("leftFoot"),
        BODY.thigh,
        BODY.shin,
        [-0.15, 0, 1]
    );
    solveLimb(
        out,
        J.rightHip,
        J.rightKnee,
        J.rightFoot,
        ankle("rightFoot"),
        BODY.thigh,
        BODY.shin,
        [0.15, 0, 1]
    );
    return out;
}

/** One joint of a pose, for tests and for placing things on the body. */
export function jointOf(pose: Float32Array, joint: Joint): ActionPoint {
    const i = J[joint];
    return [pose[i], pose[i + 1], pose[i + 2]];
}
