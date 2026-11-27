import {
    Basis,
    Field,
    Shape,
    Vec3,
    capsule,
    ellipsoid,
    euler,
    field,
    halfSpace,
    mulBasis,
    place,
    roundBox,
    roundCone,
    sphere,
} from "../kernel/sdf";
import { FINGER_NAMES, Rig } from "../rig";

/**
 * The avatar's whole skin as one distance field, in the design pose: head,
 * neck, torso, arms, hands and legs blended into a single surface. Meshes
 * for the head, hands and body are cut from this same field, so they meet
 * without a seam, and the field also tells cloth and hair where the body is.
 */

/** Where the reference head's joint sits; head parts are authored around it. */
export const HEAD_ORIGIN: Vec3 = [0, 1.452, -0.002];

/** Face landmarks and sculpt controls, in the reference head's space. */
export interface FaceSpec {
    eye: Vec3;
    eyeRadius: number;
    lidRadius: number;
    /** Upper and lower lid edges, degrees above the eye's horizon. */
    upperLid: number;
    lowerLid: number;
    /** Degrees the outer corners sit above the inner ones. */
    eyeTilt: number;
    mouthY: number;
    mouthZ: number;
    mouthWidth: number;
    /** Lip fullness, 1 is the reference. */
    lips: number;
    noseTip: Vec3;
    nose: number;
    /** Half-width at the jaw corners, and how square they are. */
    jaw: number;
    jawRadius: number;
    /** Width of the jaw where it leaves the cheeks. */
    jawCone: number;
    chin: number;
    chinY: number;
    cheek: number;
    brow: number;
    crownY: number;
    ear: Vec3;
    /** Size of the hollow the eye sits in; 1 is the reference. */
    socket: number;
    /** Width of the skull and face relative to the reference head. */
    width: number;
    /**
     * A clean jawline: the underside of the jaw is cut flat, rising towards
     * the ear by this much per unit of depth. 0 leaves the jaw rounded.
     */
    jawLine: number;
    /** How much of a lower lid there is: 0 none, 1 the reference rim. */
    lowerLid_rim: number;
}

export const FACE: FaceSpec = {
    eye: [0.0315, 1.554, 0.0655],
    eyeRadius: 0.018,
    lidRadius: 0.0204,
    upperLid: 13,
    lowerLid: -22,
    eyeTilt: 6,
    mouthY: 1.5035,
    mouthZ: 0.0855,
    mouthWidth: 0.0138,
    lips: 1.15,
    noseTip: [0, 1.5235, 0.0985],
    nose: 0.9,
    jaw: 0.047,
    jawRadius: 0,
    jawCone: 0.06,
    chin: 0.0155,
    chinY: 1.489,
    cheek: 1.1,
    brow: 0,
    crownY: 1.683,
    ear: [0.0735, 1.548, -0.012],
    socket: 1,
    width: 1,
    jawLine: 0,
    lowerLid_rim: 1,
};

/** Girths of the body; the rig's proportions give the lengths. */
export interface Build {
    /** Half-width and half-depth of pelvis, waist and ribcage. */
    hips: [number, number];
    waist: [number, number];
    chest: [number, number];
    /** 0 is a flat chest, 1 the reference. */
    bust: number;
    seat: number;
    neck: number;
    arm: number;
    thigh: number;
    calf: number;
    /** Foot size relative to the reference foot. */
    foot: number;
}

export const BUILD: Build = {
    hips: [0.149, 0.103],
    waist: [0.107, 0.079],
    chest: [0.129, 0.09],
    bust: 0.4,
    seat: 1,
    neck: 0.037,
    arm: 1,
    thigh: 1,
    calf: 1,
    foot: 1,
};

/** Rotation of a bone in the design pose, as a row-major basis. */
export function boneBasis(rig: Rig, bone: string): Basis {
    const e = rig.design[rig.index[bone]];
    return [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
}

function arm(rig: Rig, side: "left" | "right", build: Build, out: Field) {
    const s = side === "left" ? 1 : -1;
    const k = build.arm;
    const upper = `${side}UpperArm`;
    const lower = `${side}LowerArm`;
    const hand = `${side}Hand`;
    const hs = rig.body.handScale;
    const at = (bone: string, v: Vec3) => rig.at(bone, [v[0] * s, v[1], v[2]]);
    const upperBasis = boneBasis(rig, upper);
    const lowerBasis = boneBasis(rig, lower);
    const upperLength = rig.body.lowerArm[0] - rig.body.upperArm[0];
    const lowerLength = rig.body.hand[0] - rig.body.lowerArm[0];
    // Shoulder cap, upper arm, elbow, forearm, wrist.
    out.add(
        ellipsoid(
            at(upper, [0.012, 0.004, 0]),
            [0.05 * k, 0.046 * k, 0.047 * k],
            upperBasis
        ),
        0.045
    );
    out.add(
        roundCone(
            at(upper, [0, 0, 0]),
            at(lower, [0, 0, 0]),
            0.041 * k,
            0.0325 * k
        ),
        0.03
    );
    out.add(
        ellipsoid(
            at(upper, [upperLength * 0.4, 0.004, 0.002]),
            [upperLength * 0.34, 0.04 * k, 0.04 * k],
            upperBasis
        ),
        0.03
    );
    out.add(sphere(at(lower, [0, -0.002, -0.004]), 0.0325 * k), 0.02);
    out.add(
        roundCone(
            at(lower, [0, 0, 0]),
            at(hand, [-0.012, 0, 0]),
            0.033 * k,
            0.0225 * hs
        ),
        0.02
    );
    out.add(
        ellipsoid(
            at(lower, [lowerLength * 0.29, 0, 0.004]),
            [lowerLength * 0.33, 0.034 * k, 0.036 * k],
            lowerBasis
        ),
        0.025
    );
    out.add(
        ellipsoid(
            at(hand, [-0.004, 0, 0]),
            [0.03 * hs, 0.0185 * hs, 0.0255 * hs],
            lowerBasis
        ),
        0.014
    );
}

/** One hand: palm, pads and five fingers, in the design pose. */
export function handField(rig: Rig, side: "left" | "right"): Field {
    const s = side === "left" ? 1 : -1;
    const hand = `${side}Hand`;
    const basis = boneBasis(rig, hand);
    const hs = rig.body.handScale;
    const at = (v: Vec3) => rig.at(hand, [v[0] * s * hs, v[1] * hs, v[2] * hs]);
    const r = (v: Vec3): Vec3 => [v[0] * hs, v[1] * hs, v[2] * hs];
    const out = field();
    out.add(
        roundBox(
            at([0.047, -0.001, 0.0005]),
            r([0.042, 0.0118, 0.037]),
            0.0115 * hs,
            basis
        )
    );
    out.add(
        ellipsoid(at([0.014, 0, 0.001]), r([0.03, 0.0165, 0.029]), basis),
        0.016
    );
    // Thumb pad and the heel of the hand.
    out.add(
        ellipsoid(at([0.03, -0.008, 0.024]), r([0.03, 0.0125, 0.0165]), basis),
        0.01
    );
    out.add(
        ellipsoid(
            at([0.036, -0.006, -0.027]),
            r([0.034, 0.0115, 0.0125]),
            basis
        ),
        0.01
    );
    // Backs of the knuckles.
    out.add(
        ellipsoid(at([0.08, 0.006, 0]), r([0.012, 0.007, 0.034]), basis),
        0.01
    );
    const fingers = field();
    for (const name of FINGER_NAMES) {
        const chain = rig.finger(side, name);
        const rad = chain.radius;
        const pts = chain.points;
        fingers.add(
            roundCone(pts[0], pts[1], rad[0] + 0.0006, rad[1] + 0.0003),
            0.0012
        );
        fingers.add(
            roundCone(pts[1], pts[2], rad[1] + 0.0003, rad[2] + 0.0002),
            0.0012
        );
        // Stop short of the tip so the fingertip is the cone's round end.
        const tip: Vec3 = [
            pts[2][0] + (pts[3][0] - pts[2][0]) * 0.72,
            pts[2][1] + (pts[3][1] - pts[2][1]) * 0.72,
            pts[2][2] + (pts[3][2] - pts[2][2]) * 0.72,
        ];
        fingers.add(
            roundCone(pts[2], tip, rad[2] + 0.0002, rad[2] * 0.82),
            0.0012
        );
    }
    out.add(fingers, 0.0075);
    return out;
}

function leg(rig: Rig, side: "left" | "right", build: Build, out: Field) {
    const s = side === "left" ? 1 : -1;
    const m = (v: Vec3): Vec3 => [v[0] * s, v[1], v[2]];
    const hip = rig.body.upperLeg;
    const knee = rig.body.lowerLeg;
    const ankle = rig.body.foot;
    const t = build.thigh;
    const c = build.calf;
    const shin = knee[1] - ankle[1];
    out.add(
        roundCone(
            m([hip[0] + 0.006, hip[1] - 0.02, 0]),
            m(knee),
            0.079 * t,
            0.0475 * c
        ),
        0.05
    );
    // Kneecap.
    out.add(
        ellipsoid(m([knee[0], knee[1] + 0.008, 0.026 * c]), [
            0.031 * c,
            0.04,
            0.024 * c,
        ]),
        0.02
    );
    out.add(
        roundCone(
            m(knee),
            m([ankle[0], ankle[1] + 0.012, ankle[2]]),
            0.045 * c,
            0.0275 * c
        ),
        0.03
    );
    out.add(
        ellipsoid(m([knee[0] + 0.002, knee[1] - shin * 0.35, -0.021 * c]), [
            0.045 * c,
            shin * 0.285,
            0.046 * c,
        ]),
        0.03
    );
    // Ankle bones.
    out.add(
        sphere(m([ankle[0] + 0.026 * c, ankle[1] + 0.004, ankle[2]]), 0.0125),
        0.012
    );
    out.add(
        sphere(m([ankle[0] - 0.024 * c, ankle[1] + 0.01, ankle[2]]), 0.0115),
        0.012
    );
    // Foot: heel, arch, ball, toes. The sole rests inside the shoe.
    const f = build.foot;
    const sole = ankle[1] - 0.066 * f;
    const z0 = ankle[2];
    out.add(
        sphere(m([ankle[0], sole + 0.031 * f, z0 - 0.026 * f]), 0.031 * f),
        0.02
    );
    out.add(
        roundCone(
            m([ankle[0], sole + 0.036 * f, z0 - 0.005]),
            m([ankle[0] + 0.004, sole + 0.019 * f, z0 + 0.104 * f]),
            0.035 * f,
            0.019 * f
        ),
        0.02
    );
    out.add(
        ellipsoid(m([ankle[0] + 0.004, sole + 0.016 * f, z0 + 0.106 * f]), [
            0.041 * f,
            0.016 * f,
            0.03 * f,
        ]),
        0.012
    );
    const toes = [
        [-0.027, 0.146, 0.0105],
        [-0.011, 0.151, 0.0088],
        [0.003, 0.148, 0.0082],
        [0.016, 0.142, 0.0077],
        [0.028, 0.133, 0.0072],
    ];
    const group = field();
    for (const [dx, z, r] of toes)
        group.add(
            roundCone(
                m([
                    ankle[0] + dx * 0.9 * f,
                    sole + (r + 0.003) * f,
                    z0 + 0.114 * f,
                ]),
                m([ankle[0] + dx * f, sole + r * f, z0 + z * f]),
                r * f,
                r * 0.92 * f
            ),
            0.001
        );
    out.add(group, 0.008);
}

function torso(rig: Rig, build: Build, out: Field, neckTop: number) {
    const b = rig.body;
    const hy = b.hips[1];
    const uy = b.upperChest[1];
    const sy = b.upperArm[1];
    const sx = b.upperArm[0];
    // Pelvis, seat, waist, ribcage, shoulder girdle.
    out.add(
        ellipsoid([0, hy - 0.03, -0.004], [build.hips[0], 0.105, build.hips[1]])
    );
    for (const s of [1, -1])
        out.add(
            ellipsoid(
                [build.hips[0] * 0.44 * s, hy - 0.067, -0.05],
                [build.hips[0] * 0.5, 0.078, 0.07 * build.seat]
            ),
            0.04
        );
    out.add(
        ellipsoid(
            [0, hy + (b.chest[1] - hy) * 0.625, 0.002],
            [build.waist[0], 0.1, build.waist[1]]
        ),
        0.07
    );
    out.add(
        ellipsoid(
            [0, uy - 0.01, -0.006],
            [build.chest[0], (sy - hy) * 0.35, build.chest[1]]
        ),
        0.07
    );
    out.add(
        ellipsoid([0, sy - 0.013, -0.014], [sx - 0.002, 0.04, 0.052]),
        0.05
    );
    for (const s of [1, -1]) {
        const bust = build.bust;
        out.add(
            ellipsoid(
                [
                    build.chest[0] * 0.45 * s,
                    uy + 0.013,
                    build.chest[1] - 0.05 + 0.018 * bust,
                ],
                [0.05, 0.04 + 0.007 * bust, 0.022 + 0.018 * bust]
            ),
            0.035
        );
        // Trapezius and collar bone.
        out.add(
            roundCone(
                [0.018 * s, b.neck[1] + 0.033, -0.026],
                [(sx - 0.03) * s, sy + 0.009, -0.02],
                0.026,
                0.024
            ),
            0.03
        );
        out.add(
            roundCone(
                [0.016 * s, sy - 0.003, 0.038],
                [(sx - 0.023) * s, sy + 0.013, 0.004],
                0.0085,
                0.0075
            ),
            0.02
        );
    }
    out.add(
        roundCone(
            [0, sy - 0.033, -0.016],
            [0, b.head[1] + neckTop, 0],
            build.neck + 0.0095,
            build.neck
        ),
        0.03
    );
}

/** Skull, mid-face, jaw and cheeks, before any features. */
function headBase(face: FaceSpec): Field {
    const out = field();
    out.add(
        ellipsoid([0, 1.598, -0.011], [0.0765 * face.width, 0.0865, 0.094])
    );
    // The face: an egg under the skull, narrowed towards the chin by a wedge.
    const bottom = face.chinY - face.chin + 0.003;
    const lower = field().add(
        ellipsoid(
            [0, 1.546, 0.019],
            [face.jawCone * face.width, 1.546 - bottom, 0.063]
        )
    );
    for (const s of [1, -1])
        lower.clip(
            halfSpace(
                [face.jaw * s, face.chinY + 0.02, 0],
                [0.76 * s, -0.65, 0]
            ),
            0.032
        );
    if (face.jawLine > 0)
        // Under the jaw: a flat plane from the chin back up to the ear, so
        // the chin stands clear of the neck.
        lower.clip(
            halfSpace(
                [0, face.chinY - face.chin + 0.001, 0.05],
                [0, -1, -face.jawLine]
            ),
            0.006
        );
    out.add(lower, 0.03);
    out.add(sphere([0, face.chinY, 0.053], face.chin), 0.02);
    for (const s of [1, -1]) {
        if (face.jawRadius > 0)
            out.add(
                sphere([(face.jaw + 0.004) * s, 1.506, -0.006], face.jawRadius),
                0.03
            );
        out.add(
            ellipsoid(
                [0.032 * s, 1.529, 0.05],
                [0.0225 * face.cheek, 0.022, 0.0195 * face.cheek]
            ),
            0.028
        );
        // Brow bone.
        if (face.brow > 0)
            out.add(
                capsule(
                    [0.014 * s, 1.578, 0.0775],
                    [0.05 * s, 1.577, 0.063],
                    face.brow
                ),
                0.02
            );
    }
    return out;
}

function surfaceZ(shape: Shape, x: number, y: number) {
    let z = 0.14;
    for (let i = 0; i < 48; i++) {
        const d = shape.eval(x, y, z);
        if (d < 0.00005) break;
        z -= d * 0.9;
    }
    return z;
}

/**
 * Seat the eyes, nose and mouth on the face they belong to: their depths
 * are measured from the featureless head, so any jaw or cheek shape works.
 */
export function resolveFace(face: FaceSpec): FaceSpec {
    const base = headBase(face);
    return {
        ...face,
        eye: [
            face.eye[0],
            face.eye[1],
            surfaceZ(base, face.eye[0] * 0.8, face.eye[1]) -
                face.eyeRadius -
                0.0002,
        ],
        mouthZ: surfaceZ(base, 0, face.mouthY) - 0.0026,
        noseTip: [
            0,
            face.noseTip[1],
            surfaceZ(base, 0, face.noseTip[1]) + 0.0125 * face.nose,
        ],
    };
}

/** The head on its own, in reference head space: skull, face, ears, eyelids. */
export function headField(face: FaceSpec = resolveFace(FACE)): Field {
    const out = field();
    const eye = face.eye;
    out.add(headBase(face));
    // Nose: a low bridge, a small tip, soft wings.
    const tip = face.noseTip;
    const n = face.nose;
    out.add(
        roundCone(
            [0, face.eye[1] - 0.003, tip[2] - 0.019 * n],
            [0, tip[1] + 0.006, tip[2] - 0.0055],
            0.0042 * n,
            0.0058 * n
        ),
        0.014
    );
    out.add(sphere(tip, 0.0063 * n), 0.008);
    for (const s of [1, -1])
        out.add(
            sphere(
                [0.0072 * n * s, tip[1] - 0.003, tip[2] - 0.0102],
                0.0046 * n
            ),
            0.007
        );
    // Lips.
    const my = face.mouthY;
    const mz = face.mouthZ;
    for (const lip of lipShapes(face)) out.add(lip, 0.004);
    for (const s of [1, -1]) {
        // Eye socket.
        out.carve(
            ellipsoid(
                [eye[0] * s, eye[1] - 0.0005, eye[2] + 0.018],
                [
                    face.eyeRadius * (1.06 + 0.22 * face.socket),
                    face.eyeRadius * (0.66 + 0.2 * face.socket),
                    0.011 + 0.0055 * face.socket,
                ]
            ),
            0.006
        );
    }
    out.carve(
        ellipsoid(
            [0, my - 0.0002, mz + 0.0045],
            [face.mouthWidth, 0.0012, 0.005]
        ),
        0.002
    );
    // The dip between lower lip and chin, and the nostrils.
    out.carve(
        ellipsoid([0, my - 0.0135, mz + 0.0075], [0.015, 0.0055, 0.01]),
        0.012
    );
    for (const s of [1, -1])
        out.carve(
            ellipsoid(
                [0.0044 * n * s, tip[1] - 0.0066, tip[2] - 0.0058],
                [0.0021, 0.0016, 0.0036]
            ),
            0.002
        );
    for (const s of [1, -1]) {
        out.add(lidShape(face, s, true), 0.0035);
        if (face.lowerLid_rim > 0) out.add(lidShape(face, s, false), 0.0035);
    }
    for (const s of [1, -1]) {
        // Ears: a tilted disc with the bowl scooped out, plus a lobe.
        const ear = face.ear;
        const turn = mulBasis(euler(0, -0.42 * s, 0), euler(-0.2, 0, 0));
        const group = field()
            .add(
                ellipsoid(
                    [ear[0] * s, ear[1], ear[2]],
                    [0.0062, 0.029, 0.0165],
                    turn
                )
            )
            .add(
                sphere(
                    [(ear[0] - 0.002) * s, ear[1] - 0.026, ear[2] + 0.005],
                    0.0072
                ),
                0.006
            )
            .carve(
                ellipsoid(
                    [(ear[0] + 0.0052) * s, ear[1] + 0.001, ear[2] + 0.0015],
                    [0.0048, 0.0185, 0.009],
                    turn
                ),
                0.003
            );
        out.add(group, 0.006);
    }
    return out;
}

/** The lips as shapes: two halves of the upper lip, then the lower lip. */
export function lipShapes(face: FaceSpec): Shape[] {
    const my = face.mouthY;
    const mz = face.mouthZ;
    const l = face.lips;
    const w = face.mouthWidth / 0.0165;
    return [
        ...[1, -1].map((s) =>
            ellipsoid(
                [0.0052 * w * s, my + 0.0034 * l, mz],
                [0.0098 * w, 0.0038 * l, 0.0048],
                euler(0, 0, -0.14 * s)
            )
        ),
        ellipsoid(
            [0, my - 0.0042 * l, mz - 0.0006],
            [0.0118 * w, 0.0048 * l, 0.0052]
        ),
    ];
}

/**
 * The frame an eyelid edge lies in: `across` runs from the inner to the
 * outer corner, `normal` points away from the lid, `forward` completes it.
 */
export function lidFrame(face: FaceSpec, s: number, upper: boolean) {
    const tilt = euler(0, 0, (face.eyeTilt * Math.PI * s) / 180);
    const a = ((upper ? face.upperLid : face.lowerLid) * Math.PI) / 180;
    const turn = (v: Vec3): Vec3 => [
        tilt[0] * v[0] + tilt[1] * v[1] + tilt[2] * v[2],
        tilt[3] * v[0] + tilt[4] * v[1] + tilt[5] * v[2],
        tilt[6] * v[0] + tilt[7] * v[1] + tilt[8] * v[2],
    ];
    const sign = upper ? 1 : -1;
    return {
        centre: [face.eye[0] * s, face.eye[1], face.eye[2]] as Vec3,
        across: turn([s, 0, 0]),
        // Points into the open eye, away from the lid's own half.
        normal: turn([0, -Math.cos(a) * sign, Math.sin(a) * sign]),
        forward: turn([0, Math.sin(a), Math.cos(a)]),
    };
}

/** One eyelid: the part of a shell around the eyeball on its side of the edge. */
function lidShape(face: FaceSpec, s: number, upper: boolean): Field {
    const frame = lidFrame(face, s, upper);
    // The lower lid is only a rim, so the eye does not look pouched.
    const radius = upper
        ? face.lidRadius
        : face.eyeRadius +
          (face.lidRadius - face.eyeRadius) * 0.45 * face.lowerLid_rim;
    return field()
        .add(sphere(frame.centre, radius))
        .clip(halfSpace(frame.centre, frame.normal), 0.0008);
}

export interface SkinField {
    /** Everything: head, body and both hands, in the design pose. */
    all: Shape;
    /** The body without the head, for clothes to wrap. */
    body: Field;
    /** The head in reference head space (see `toHead`). */
    head: Field;
    face: FaceSpec;
    build: Build;
    rig: Rig;
    /** A reference-head-space point in avatar space. */
    toHead: (p: Vec3) => [number, number, number];
    /** An avatar-space point in reference head space. */
    fromHead: (p: Vec3) => [number, number, number];
}

export function skinField(
    rig: Rig,
    build: Build = BUILD,
    face: FaceSpec = FACE
): SkinField {
    const body = field();
    // The neck runs up to just under the chin, wherever this face puts it.
    const resolved = resolveFace(face);
    torso(
        rig,
        build,
        body,
        Math.max(
            0.018,
            (resolved.chinY - resolved.chin - HEAD_ORIGIN[1] - 0.004) *
                rig.body.headScale
        )
    );
    leg(rig, "left", build, body);
    leg(rig, "right", build, body);
    const arms = field();
    for (const side of ["left", "right"] as const) {
        arm(rig, side, build, arms);
        arms.add(handField(rig, side), 0.012);
    }
    body.add(arms, 0.03);
    face = resolveFace(face);
    const head = headField(face);
    const joint = rig.body.head;
    const scale = rig.body.headScale;
    const all = field()
        .add(body)
        .add(place(head, HEAD_ORIGIN, joint, scale), 0.022);
    return {
        all,
        body,
        head,
        face,
        build,
        rig,
        toHead: (p) => [
            joint[0] + (p[0] - HEAD_ORIGIN[0]) * scale,
            joint[1] + (p[1] - HEAD_ORIGIN[1]) * scale,
            joint[2] + (p[2] - HEAD_ORIGIN[2]) * scale,
        ],
        fromHead: (p) => [
            HEAD_ORIGIN[0] + (p[0] - joint[0]) / scale,
            HEAD_ORIGIN[1] + (p[1] - joint[1]) / scale,
            HEAD_ORIGIN[2] + (p[2] - joint[2]) / scale,
        ],
    };
}
