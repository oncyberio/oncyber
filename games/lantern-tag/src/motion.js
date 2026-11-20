// The avatars' idle, walk, run, jump and wave, generated here instead of
// shipped as files: each clip is a handful of sine curves on the limbs,
// written in the shape the avatar kit's `motion` option takes (the lobby's
// clip format: quaternion tracks named after the source skeleton's bones).
// The kit plays them on a rig that faces +z in a T-pose with identity
// rests, so a rotation here is a rotation of that bone in its parent.

const FRAMES = 24;
const IDENTITY = [0, 0, 0, 1];
// Every bone the kit's arrival crouch bends. The kit lays the crouch on top
// of what the clips wrote this frame, and the animation mixer only writes a
// value that changed, so every one of these bones (and the hips' height)
// has to move a little in every clip, every frame: a breath too small to
// see. Without it a still bone keeps the crouch and the hips keep sinking.
const BONES = [
    "Hips",
    "Spine",
    "Head",
    "LeftUpLeg",
    "RightUpLeg",
    "LeftLeg",
    "RightLeg",
    "LeftFoot",
    "RightFoot",
    "LeftArm",
    "RightArm",
    "LeftForeArm",
    "RightForeArm",
];
const breath = (phase, index) => 0.003 * Math.sin(phase + index * 1.7);

/** A rotation about one axis as [x, y, z, w]. */
const about = (axis, angle) => {
    const s = Math.sin(angle / 2);
    return [
        axis === "x" ? s : 0,
        axis === "y" ? s : 0,
        axis === "z" ? s : 0,
        Math.cos(angle / 2),
    ];
};
/** a then b: `b` is applied to the bone already turned by `a`'s parent frame. */
const times = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

/**
 * One clip. `pose(phase)` returns, for a phase from 0 to 2π, the rotation
 * of each bone it moves: `{ Hips: [x, y, z, w], ... }`.
 */
function clip(name, duration, pose, bob = 0) {
    const times_ = [];
    const values = {};
    // The hips' height, as a share of their height at rest.
    const hips = [];
    for (let i = 0; i <= FRAMES; i++) {
        times_.push((i / FRAMES) * duration);
        const phase = (i / FRAMES) * Math.PI * 2;
        hips.push(
            0,
            1 - bob * (0.5 + 0.5 * Math.cos(phase * 2)) + breath(phase, 0),
            0
        );
        const frame = pose(phase);
        BONES.forEach((bone, index) =>
            (values[bone] ??= []).push(
                ...times(
                    frame[bone] ?? IDENTITY,
                    about("x", breath(phase, index))
                )
            )
        );
    }
    return {
        name,
        duration,
        tracks: [
            { name: "mixamorigHips.position", times: times_, values: hips },
            ...Object.entries(values).map(([bone, v]) => ({
                name: `mixamorig${bone}.quaternion`,
                times: times_,
                values: v.map((n) => Math.round(n * 1e6) / 1e6),
            })),
        ],
    };
}

// An arm hanging at the side (the T-pose arm turned down about z), swung
// forward or back about x, with the elbow bent toward the front.
const arm = (side, swing, down = 1.25) =>
    times(about("x", swing), about("z", side * down));
const elbow = (side, bend) => about("y", side * bend);

function gait({ stride, knee, swing, bend, lean, bounce }) {
    return (p) => {
        const left = Math.sin(p),
            right = -left;
        // A knee bends while its leg comes forward.
        const kneeOf = (lead) =>
            about("x", knee * Math.max(0, Math.cos(lead + 0.6)) + 0.08);
        return {
            Hips: about("x", lean * 0.4 + Math.sin(p * 2) * bounce),
            Spine: about("x", lean),
            LeftUpLeg: about("x", -stride * left - 0.05),
            RightUpLeg: about("x", -stride * right - 0.05),
            LeftLeg: kneeOf(p),
            RightLeg: kneeOf(p + Math.PI),
            // Arms swing against the legs.
            LeftArm: arm(-1, swing * left),
            RightArm: arm(1, swing * right),
            LeftForeArm: elbow(-1, bend),
            RightForeArm: elbow(1, bend),
        };
    };
}

/** The clips the avatar kit blends between: `{ IDLE, WALK, RUN, JUMP, WAVING }`. */
export function createMotion() {
    return {
        IDLE: clip("IDLE", 3, (p) => ({
            Spine: about("x", 0.02 + Math.sin(p) * 0.015),
            Head: about("x", -Math.sin(p) * 0.01),
            LeftArm: arm(-1, Math.sin(p) * 0.02),
            RightArm: arm(1, Math.sin(p) * 0.02),
            LeftForeArm: elbow(-1, 0.15),
            RightForeArm: elbow(1, 0.15),
            LeftUpLeg: about("x", 0),
            RightUpLeg: about("x", 0),
            LeftLeg: about("x", 0),
            RightLeg: about("x", 0),
            Hips: about("x", 0),
        })),
        WALK: clip(
            "WALK",
            1,
            gait({
                stride: 0.42,
                knee: 0.7,
                swing: 0.4,
                bend: 0.3,
                lean: 0.05,
                bounce: 0.01,
            }),
            0.015
        ),
        RUN: clip(
            "RUN",
            0.7,
            gait({
                stride: 0.8,
                knee: 1.3,
                swing: 0.9,
                bend: 1.2,
                lean: 0.2,
                bounce: 0.03,
            }),
            0.04
        ),
        JUMP: clip("JUMP", 1, () => ({
            Hips: about("x", 0.05),
            Spine: about("x", 0.1),
            LeftUpLeg: about("x", -0.5),
            RightUpLeg: about("x", -0.2),
            LeftLeg: about("x", 0.9),
            RightLeg: about("x", 0.5),
            LeftArm: arm(-1, -0.3, 0.7),
            RightArm: arm(1, -0.3, 0.7),
            LeftForeArm: elbow(-1, 0.4),
            RightForeArm: elbow(1, 0.4),
        })),
        WAVING: clip("WAVING", 1.2, (p) => ({
            Spine: about("x", 0.02),
            LeftArm: arm(-1, 0),
            // The right arm up, the forearm rocking.
            RightArm: about("z", -0.9),
            RightForeArm: about("z", -0.6 + Math.sin(p * 2) * 0.35),
            LeftForeArm: elbow(-1, 0.15),
        })),
    };
}
