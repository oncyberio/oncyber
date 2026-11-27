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
    ribbonCone,
    rotate,
    roundBox,
    roundCone,
    sphere,
    symmetric,
    torus,
} from "../kernel/sdf";
import { buildHumanoid } from "../humanoid/build";
import type { BuildOptions, HumanoidSpec } from "../humanoid/description";
import type { SculptHairSegment } from "./types";

/**
 * The Stagehand, sculpted whole in a T-pose: every shape is placed from
 * measurements of the character sheet (front, side, back and three-quarter
 * views), in metres, standing on y = 0 and facing +z.
 *
 * This is the reference sculpt for fidelity. It is traced per pixel by
 * `raymarch.ts`; the same shapes can be handed to the mesher.
 */

/** Height of the eye line, and the depth of the front of the ear. */
const EYE_Y = 1.631;
const Z0 = 0.005;

/**
 * A point of the head, measured from the middle of the eye line: x to his
 * left, y up, z forward of the front of the ear.
 */
const h = (x: number, y: number, z: number): Vec3 => [x, EYE_Y + y, Z0 + z];

// The eye is drawn, not modelled: a flat white surface set just behind an
// almond cut in the face, with iris, pupil and lid shadow drawn on it.
const EYE_SHAPE = {
    /** The middle of the line between its corners, from the eye line. */
    x: 0.0363,
    y: 0.0015,
    /** Degrees the outer corner sits above the inner one. */
    tilt: 14,
    halfWidth: 0.0178,
    /** How far the upper edge bows above that line, and the lower drops. */
    rise: 0.003,
    drop: 0.0128,
    /** How far behind the lid's edge the surface of the eye lies. */
    recess: 0.0032,
    /** The iris, along that line towards the temple, and up from it. */
    iris: { u: -0.005, v: -0.0036, radius: 0.0077 },
};
const EYE_ACROSS: [number, number] = [
    Math.cos((EYE_SHAPE.tilt * Math.PI) / 180),
    Math.sin((EYE_SHAPE.tilt * Math.PI) / 180),
];
/** An arc through both corners that bows out by `sagitta` in the middle. */
const eyeArc = (sagitta: number) => {
    const w = EYE_SHAPE.halfWidth;
    const radius = (w * w + sagitta * sagitta) / (2 * sagitta);
    return { radius, offset: radius - sagitta };
};
const EYE_UPPER = eyeArc(EYE_SHAPE.rise);
const EYE_LOWER = eyeArc(EYE_SHAPE.drop);

/**
 * The almond the eye shows through: what lies inside both arcs. `z` is the
 * depth of the skin there; `grow` widens it.
 */
function eyeOutline(z: number, grow: number): Field {
    const ex = EYE_SHAPE.x;
    const ey = EYE_Y + EYE_SHAPE.y;
    const [ax, ay] = EYE_ACROSS;
    // "Up" in the eye's own tilt is (-ay, ax).
    const disc = (offset: number, radius: number) =>
        ellipsoid(
            [ex + ay * offset, ey - ax * offset, z],
            // Deep, so the outline is the same at whatever depth the
            // skin crosses it.
            [radius + grow, radius + grow, 0.05]
        );
    return field()
        .add(disc(-EYE_LOWER.offset, EYE_LOWER.radius))
        .clip(disc(EYE_UPPER.offset, EYE_UPPER.radius));
}
const MOUTH_Y = -0.0662;

/** Where a ray down the z axis first meets a shape. */
function surfaceZ(shape: Shape, x: number, y: number) {
    let z = 0.2;
    for (let i = 0; i < 64; i++) {
        const d = shape.eval(x, y, z);
        if (d < 0.00005) break;
        z -= d * 0.9;
    }
    return z;
}

/** Skull, face, jaw: the left half, before features. */
function headBase(): Field {
    const out = field();
    out.add(ellipsoid(h(0, 0.04, 0.005), [0.0672, 0.08, 0.098]));
    // The face: an egg cut to a straight jawline that runs from under the
    // ear to a small flat chin, and flat underneath so the chin stands
    // clear of the neck.
    const mask = field()
        .add(ellipsoid(h(0, 0.0, 0.034), [0.0608, 0.104, 0.071]))
        .clip(halfSpace(h(0.0185, -0.099, 0), [0.81, -0.587, 0.0]), 0.012)
        .clip(halfSpace(h(0, -0.1, 0.078), [0, -0.8, -0.6]), 0.008);
    out.add(mask, 0.03);
    out.add(ellipsoid(h(0, -0.084, 0.0765), [0.019, 0.0155, 0.0165]), 0.014);
    // Cheekbone, the muzzle the mouth sits on, and the brow ridge.
    out.add(ellipsoid(h(0.035, -0.027, 0.066), [0.02, 0.021, 0.02]), 0.03);
    out.add(ellipsoid(h(0, -0.06, 0.079), [0.027, 0.024, 0.019]), 0.02);
    out.add(
        capsule(h(0.008, 0.017, 0.0935), h(0.05, 0.0245, 0.078), 0.009),
        0.016
    );
    return out;
}

/** Where the flat of the eye sits, fitted to the face it is cut into. */
function eyePlacement(base: Shape) {
    const w = EYE_SHAPE.halfWidth;
    const ex = EYE_SHAPE.x;
    const ey = EYE_Y + EYE_SHAPE.y;
    const [ax, ay] = EYE_ACROSS;
    // The skin falls away towards the temple; the eye turns with it.
    const inner = surfaceZ(base, ex - ax * w, ey - ay * w);
    const outer = surfaceZ(base, ex + ax * w, ey + ay * w);
    const skinZ = (inner + outer) / 2;
    const turn = Math.atan2(inner - outer, 2 * w * ax);
    // Whichever way round `euler` turns, the eye faces a little outwards.
    const basis =
        rotate(euler(0, turn, 0), [0, 0, 1])[0] > 0
            ? euler(0, turn, 0)
            : euler(0, -turn, 0);
    return {
        skinZ,
        basis,
        centre: [ex, ey, skinZ - EYE_SHAPE.recess] as Vec3,
    };
}

function head() {
    const base = headBase();
    const out = field().add(base);
    // Nose: a wedge, straight down the bridge.
    // It widens to a rounded tip over a broad base, and is cut flat
    // underneath, the cut rising back to the lip.
    out.add(
        field()
            .add(
                roundCone(
                    h(0, 0.006, 0.0965),
                    h(0, -0.036, 0.1105),
                    0.0052,
                    0.0066
                )
            )
            .add(sphere(h(0, -0.0408, 0.1122), 0.0074), 0.006)
            .add(
                ellipsoid(h(0, -0.0432, 0.1035), [0.0102, 0.0066, 0.0095]),
                0.007
            )
            .clip(halfSpace(h(0, -0.0488, 0.108), [0, -0.96, 0.28]), 0.0035),
        0.011
    );
    // Mouth: thin lips pressed into a slight frown.
    const mouthZ = surfaceZ(base, 0, EYE_Y + MOUTH_Y) - Z0 - 0.0022;
    out.add(
        ellipsoid(
            h(0.0065, MOUTH_Y + 0.0028, mouthZ - 0.0022),
            [0.0115, 0.0028, 0.004],
            euler(0, 0, -0.12)
        ),
        0.004
    );
    out.add(
        ellipsoid(
            h(0, MOUTH_Y - 0.0046, mouthZ - 0.0024),
            [0.0125, 0.0046, 0.0046]
        ),
        0.004
    );
    out.carve(
        ellipsoid(
            h(0, MOUTH_Y, mouthZ + 0.0045),
            [0.0178, 0.0011, 0.005],
            euler(0, 0, -0.07)
        ),
        0.002
    );
    out.carve(sphere(h(0.018, MOUTH_Y - 0.0018, mouthZ + 0.001), 0.003), 0.004);
    out.carve(
        ellipsoid(
            h(0, MOUTH_Y - 0.0135, mouthZ + 0.0075),
            [0.015, 0.0055, 0.01]
        ),
        0.012
    );
    // Eye: a deep socket, then lids as a shell round the eyeball.
    // Eye: the almond is cut out of the face; the eye itself is another
    // layer set just behind it.
    const eye = eyePlacement(base);
    out.carve(eyeOutline(eye.skinZ, 0), 0.0025);
    // Ear: a flat disc standing well off the head, its front edge on the
    // skull, with the bowl scooped out of its outer face and a lobe.
    const earTop = h(0.078, 0.01, -0.013);
    const earBottom = h(0.075, -0.022, -0.008);
    const earAxis = norm(sub(earBottom, earTop));
    const lean: Vec3 = [Math.cos(0.72), 0, Math.sin(0.72)];
    const k = dot(lean, earAxis);
    const earOut = norm([
        lean[0] - earAxis[0] * k,
        lean[1] - earAxis[1] * k,
        lean[2] - earAxis[2] * k,
    ]);
    // Towards the face, across the ear.
    const earFront = (() => {
        const c = cross(earAxis, earOut);
        return c[2] > 0 ? c : ([-c[0], -c[1], -c[2]] as Vec3);
    })();
    const earLength = Math.hypot(
        earBottom[0] - earTop[0],
        earBottom[1] - earTop[1],
        earBottom[2] - earTop[2]
    );
    /** A point of the ear: `t` down it, `f` towards the face, `o` out of it. */
    const E = (t: number, f: number, o: number): Vec3 => [
        earTop[0] +
            earAxis[0] * t * earLength +
            earFront[0] * f +
            earOut[0] * o,
        earTop[1] +
            earAxis[1] * t * earLength +
            earFront[1] * f +
            earOut[1] * o,
        earTop[2] +
            earAxis[2] * t * earLength +
            earFront[2] * f +
            earOut[2] * o,
    ];
    out.add(
        field()
            .add(ribbonCone(earTop, earBottom, 0.021, 0.014, earOut, 0.25))
            .add(sphere(h(0.072, -0.032, -0.004), 0.0072), 0.006)
            // Hollow the face of it, leaving the rolled rim...
            .carve(
                ribbonCone(
                    E(0.04, 0.0015, 0.0064),
                    E(0.92, 0.002, 0.0064),
                    0.0162,
                    0.0092,
                    earOut,
                    0.5
                ),
                0.0028
            )
            // ...then the ridge inside it that forks towards the top,
            .add(
                capsule(
                    E(0.22, -0.003, 0.0018),
                    E(0.74, 0.004, 0.0018),
                    0.0036
                ),
                0.003
            )
            .add(
                capsule(
                    E(0.22, -0.003, 0.0018),
                    E(0.06, 0.007, 0.0018),
                    0.0028
                ),
                0.003
            )
            // the bowl in front of the ridge, and the flap over the canal.
            .carve(sphere(E(0.62, 0.0095, 0.0042), 0.0058), 0.003)
            .add(sphere(E(0.6, 0.0165, 0.0036), 0.0036), 0.003),
        0.006
    );
    return { shape: out, mouthZ, eye };
}

const ARM_Y = 1.399;

const NECK = 0.041;

function shirt(): Shape {
    const out = field();
    out.add(ellipsoid([0, 1.31, 0.0], [0.166, 0.2, 0.103]));
    out.add(roundBox([0, 1.335, -0.002], [0.164, 0.12, 0.084], 0.07), 0.03);
    // Shoulders, the sleeve with the slack of it hanging underneath, and
    // the buttoned cuff it gathers into.
    out.add(
        roundCone([0, 1.452, -0.012], [0.186, 1.428, -0.006], 0.044, 0.046),
        0.04
    );
    out.add(
        roundCone([0.19, 1.412, 0], [0.598, 1.4, 0.002], 0.056, 0.043),
        0.03
    );
    out.add(ellipsoid([0.37, 1.376, 0.0], [0.2, 0.04, 0.046]), 0.03);
    out.add(
        roundCone([0.606, ARM_Y, 0.003], [0.66, ARM_Y, 0.003], 0.0345, 0.0335),
        0.003
    );
    // The waist blouses out over the belt.
    out.add(ellipsoid([0, 1.19, 0.0], [0.156, 0.075, 0.103]), 0.04);
    out.clip(halfSpace([0, 1.122, 0], [0, -1, 0]), 0.012);
    out.carve(
        roundCone(
            [0, 1.45, -0.014],
            [0, 1.62, 0.02],
            NECK + 0.012,
            NECK + 0.03
        ),
        0.006
    );
    // Collar: a stand round the neck, open at the throat, and two leaves
    // folded down over it to points either side of the knot.
    const stand = field()
        .add(roundCone([0, 1.468, -0.012], [0, 1.512, -0.004], 0.064, 0.054))
        .carve(roundCone([0, 1.44, -0.012], [0, 1.56, -0.002], 0.053, 0.047))
        .clip(halfSpace([0, 1.516, 0], [0, 1, 0.12]), 0.002)
        .clip(halfSpace([0.004, 1.5, 0.03], [-0.86, 0.3, 0.42]), 0.003);
    out.add(stand, 0.004);
    const A: Vec3 = [0.06, 1.514, 0.008];
    const B: Vec3 = [0.008, 1.492, 0.058];
    const tip: Vec3 = [0.044, 1.452, 0.086];
    const root: Vec3 = [
        (A[0] + B[0]) / 2,
        (A[1] + B[1]) / 2,
        (A[2] + B[2]) / 2,
    ];
    const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const ac = [tip[0] - A[0], tip[1] - A[1], tip[2] - A[2]];
    const normal = norm([
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    ]);
    out.add(
        ribbonCone(
            root,
            tip,
            Math.hypot(ab[0], ab[1], ab[2]) / 2,
            0.004,
            normal,
            0.2
        ),
        0.0015
    );
    return symmetric(out);
}

/** The tie hangs from under the knot out over the chest. */
const BLADE: Basis = (() => {
    const tilt = Math.atan2(0.008, 0.39);
    const a = euler(tilt, 0, 0);
    // Whichever way round `euler` turns, the top of the blade goes back.
    return rotate(a, [0, 1, 0])[2] < 0 ? a : euler(-tilt, 0, 0);
})();

function tie(): Shape {
    const out = field();
    // The blade: narrow under the knot, widest near the tip, cut to a point.
    out.add(
        field()
            .add(
                roundBox(
                    [0, 1.272, 0.1125],
                    [0.04, 0.196, 0.0032],
                    0.002,
                    BLADE
                )
            )
            .clip(halfSpace([0.0135, 1.455, 0], [0.9987, 0.0507, 0]), 0.001)
            .clip(halfSpace([0, 1.083, 0], [0.871, -0.491, 0]), 0.001)
    );
    // The knot: wider at the top, sitting proud of the blade.
    out.add(
        field()
            .add(roundBox([0, 1.47, 0.1], [0.02, 0.019, 0.0135], 0.007))
            .clip(halfSpace([0.012, 1.451, 0], [0.97, -0.24, 0]), 0.004),
        0.002
    );
    return symmetric(out);
}

function trousers(): Shape {
    const out = field();
    out.add(ellipsoid([0, 1.03, -0.008], [0.124, 0.1, 0.108]));
    out.add(
        roundCone([0.07, 1.06, -0.006], [0.125, 0.6, -0.013], 0.056, 0.108),
        0.03
    );
    out.add(
        roundCone([0.125, 0.6, -0.013], [0.14, 0.25, -0.018], 0.108, 0.112),
        0.0
    );
    out.clip(halfSpace([0, 1.108, 0], [0, 1, 0]), 0.004);
    out.clip(halfSpace([0, 0.214, 0], [0, -1, 0]), 0.003);
    return symmetric(out);
}

const FOOT_X = 0.137;
const FOOT_Z = -0.028;
const TOE_OUT = 0.21;

/** A point of the left shoe, given from the ankle with toes straight ahead. */
function foot(x: number, y: number, z: number): Vec3 {
    const c = Math.cos(TOE_OUT);
    const s = Math.sin(TOE_OUT);
    return [FOOT_X + x * c + z * s, y, FOOT_Z - x * s + z * c];
}
const FOOT_BASIS: Basis = euler(0, TOE_OUT, 0);

function socks(): Shape {
    return symmetric(
        field().add(
            roundCone(
                [FOOT_X, 0.25, FOOT_Z],
                [FOOT_X, 0.1, FOOT_Z],
                0.036,
                0.034
            )
        )
    );
}

/** Everything black and smooth: belt, shoes, headphones, player, ring. */
function black(ring: Vec3): { shape: Shape; asymmetric: Shape } {
    const out = field();
    // Belt.
    out.add(
        field()
            .add(ellipsoid([0, 1.12, -0.004], [0.1235, 0.3, 0.1095]))
            .clip(halfSpace([0, 1.139, 0], [0, 1, 0]), 0.004)
            .clip(halfSpace([0, 1.101, 0], [0, -1, 0]), 0.004)
    );
    // Derby shoe: a thick sole with a heel, a long upper, a round toe.
    const shoe = field();
    shoe.add(
        roundBox(foot(0, 0.015, 0.075), [0.05, 0.015, 0.135], 0.012, FOOT_BASIS)
    );
    shoe.carve(
        roundBox(
            foot(0, -0.004, 0.045),
            [0.07, 0.012, 0.045],
            0.008,
            FOOT_BASIS
        ),
        0.004
    );
    shoe.add(
        ellipsoid(foot(0, 0.058, 0.07), [0.046, 0.04, 0.128], FOOT_BASIS),
        0.012
    );
    shoe.add(
        ellipsoid(foot(0, 0.05, 0.145), [0.049, 0.034, 0.062], FOOT_BASIS),
        0.02
    );
    shoe.add(
        ellipsoid(foot(0, 0.082, -0.012), [0.043, 0.048, 0.058], FOOT_BASIS),
        0.02
    );
    shoe.clip(halfSpace([0, 0, 0], [0, -1, 0]), 0.002);
    // Laces: three bars across the instep.
    for (let i = 0; i < 3; i++)
        shoe.add(
            capsule(
                foot(-0.017, 0.106 - i * 0.012, 0.03 + i * 0.022),
                foot(0.017, 0.106 - i * 0.012, 0.03 + i * 0.022),
                0.0035
            ),
            0.002
        );
    out.add(shoe);
    // Headphones round the neck: a cup on each collarbone, the band
    // running up over the shoulders and behind the neck.
    const cup: Vec3 = [0.077, 1.448, 0.088];
    const face = mulBasis(euler(0, 0.38, 0), euler(Math.PI / 2 - 0.2, 0, 0));
    const phones = field();
    phones.add(ellipsoid(cup, [0.033, 0.012, 0.033], face));
    phones.add(torus(cup, 0.0265, 0.008, face), 0.003);
    const band: Vec3[] = [
        [0.076, 1.466, 0.058],
        [0.08, 1.498, 0.022],
        [0.071, 1.522, -0.024],
        [0.046, 1.535, -0.058],
        [0, 1.54, -0.07],
    ];
    for (let i = 0; i + 1 < band.length; i++)
        phones.add(capsule(band[i], band[i + 1], 0.0085), 0.004);
    out.add(phones);

    // One-sided things: the cable down to the player on the belt, the
    // badge clip, the ring on his right hand.
    const lone = field();
    const cable: Vec3[] = [
        [0.07, 1.415, 0.084],
        [0.074, 1.36, 0.103],
        [0.082, 1.27, 0.107],
        [0.1, 1.18, 0.108],
        [0.122, 1.125, 0.112],
        [0.13, 1.095, 0.114],
    ];
    for (let i = 0; i + 1 < cable.length; i++)
        lone.add(capsule(cable[i], cable[i + 1], 0.0028), 0.002);
    lone.add(ellipsoid([0.133, 1.082, 0.113], [0.028, 0.028, 0.012]), 0.002);
    lone.add(roundBox([0.089, 1.379, 0.106], [0.0055, 0.011, 0.004], 0.002));
    lone.add(torus(ring, 0.0098, 0.003, euler(0, 0, Math.PI / 2)));
    return { shape: symmetric(out), asymmetric: lone };
}

function badge(): Shape {
    return field().add(
        roundBox(
            [0.093, 1.339, 0.1045],
            [0.033, 0.03, 0.0022],
            0.002,
            euler(0.05, 0.12, 0)
        )
    );
}

type Path = Vec3[];

/** A point on a Catmull-Rom spline through `points`, t from 0 to 1. */
function along(points: Path, t: number): Vec3 {
    const n = points.length - 1;
    const f = Math.min(n - 1e-6, Math.max(0, t * n));
    const i = Math.floor(f);
    const u = f - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n, i + 2)];
    const out: number[] = [];
    for (let k = 0; k < 3; k++)
        out.push(
            0.5 *
                (2 * p1[k] +
                    (p2[k] - p0[k]) * u +
                    (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u +
                    (3 * p1[k] - 3 * p2[k] + p3[k] - p0[k]) * u * u * u)
        );
    return out as unknown as Vec3;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Radius along a lock: `radii` are evenly spaced samples. */
function radiusAt(radii: number[], t: number) {
    const f = Math.min(
        radii.length - 1 - 1e-6,
        Math.max(0, t * (radii.length - 1))
    );
    const i = Math.floor(f);
    return lerp(radii[i], radii[i + 1], f - i);
}

const SKULL: Vec3 = h(0, 0.04, 0.0);

function hair(): { cap: Shape; segments: SculptHairSegment[]; shape: Shape } {
    // The undercoat: short hair close to the skull, down to the nape and
    // to a point in front of each ear.
    const cap = symmetric(
        field()
            .add(ellipsoid(h(0, 0.038, 0.0), [0.0785, 0.0865, 0.1035]))
            .clip(halfSpace(h(0, 0.074, 0.103), [0, -0.6, 0.8]), 0.004)
            .clip(halfSpace(h(0, -0.074, -0.055), [0, -0.72, 0.69]), 0.004)
            .carve(sphere(h(0.081, -0.007, -0.012), 0.029), 0.004)
    );
    const segments: SculptHairSegment[] = [];
    let id = 0;
    interface LockOptions {
        pieces?: number;
        flat?: number;
        blend?: number;
    }
    /**
     * One lock: a flat tapered ribbon through `points` (head measurements),
     * `radii` its half-width along the way.
     */
    const lock = (points: Path, radii: number[], options: LockOptions = {}) => {
        const { pieces = 5, flat = 0.5, blend = 0.0035 } = options;
        const path = points.map((p) => h(p[0], p[1], p[2]));
        const tangent = (t: number) => {
            const a = along(path, Math.max(0, t - 0.02));
            const b = along(path, Math.min(1, t + 0.02));
            return norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        };
        id++;
        const joints: Vec3[] = [];
        for (let i = 0; i <= pieces; i++) joints.push(along(path, i / pieces));
        const axes: Vec3[] = [];
        for (let i = 0; i < pieces; i++)
            axes.push(sub(joints[i + 1], joints[i]));
        /** The part of `v` square to `axis`, as a unit vector. */
        const square = (v: Vec3, axis: Vec3): Vec3 => {
            const k = dot(v, axis);
            return norm([
                v[0] - axis[0] * k,
                v[1] - axis[1] * k,
                v[2] - axis[2] * k,
            ]);
        };
        // "Out", the direction the ribbon is thin in, starts as away from
        // the skull and is carried along the lock joint by joint, leaning
        // back towards "away from the skull" as it goes: the lock lies
        // flat on the head and never flips where it turns.
        const outs: Vec3[] = [];
        for (let i = 0; i <= pieces; i++) {
            const through = norm(
                i === 0
                    ? axes[0]
                    : i === pieces
                    ? axes[pieces - 1]
                    : [
                          axes[i - 1][0] + axes[i][0],
                          axes[i - 1][1] + axes[i][1],
                          axes[i - 1][2] + axes[i][2],
                      ]
            );
            const away = square(sub(joints[i], SKULL), through);
            if (i === 0) {
                outs.push(away);
                continue;
            }
            const carried = square(outs[i - 1], through);
            outs.push(
                dot(carried, away) > 0
                    ? norm([
                          carried[0] + away[0],
                          carried[1] + away[1],
                          carried[2] + away[2],
                      ])
                    : carried
            );
        }
        for (let i = 0; i < pieces; i++) {
            const axis = norm(axes[i]);
            const through = (j: number) =>
                norm(
                    j === 0
                        ? axes[0]
                        : j === pieces
                        ? axes[pieces - 1]
                        : [
                              axes[j - 1][0] + axes[j][0],
                              axes[j - 1][1] + axes[j][1],
                              axes[j - 1][2] + axes[j][2],
                          ]
                );
            segments.push({
                a: joints[i],
                b: joints[i + 1],
                ra: radiusAt(radii, i / pieces),
                rb: radiusAt(radii, (i + 1) / pieces),
                out: square(outs[i], axis),
                outEnd: square(outs[i + 1], axis),
                flat,
                ta: tangent(i / pieces),
                tb: tangent((i + 1) / pieces),
                // Neighbouring pieces agree on "across" where they meet,
                // so strands drawn along the lock run through the joints.
                sa: norm(cross(through(i), outs[i])),
                sb: norm(cross(through(i + 1), outs[i + 1])),
                va: i / pieces,
                vb: (i + 1) / pieces,
                lock: id,
                blend,
            });
        }
    };
    const both = (points: Path, radii: number[], options?: LockOptions) => {
        lock(points, radii, options);
        lock(
            points.map((p) => [-p[0], p[1], p[2]] as Vec3),
            radii,
            options
        );
    };
    /** Height of the skull under a point of the top of the head. */
    const top = (x: number, z: number) =>
        0.04 +
        0.08 *
            Math.sqrt(
                Math.max(
                    0.05,
                    1 - (x / 0.073) ** 2 - ((z - 0.005) / 0.098) ** 2
                )
            );

    // The body of the hair: one volume over the skull with a quiff pushed
    // forward above the forehead. Locks are laid over it like shingles.
    const coreCentre: Vec3 = [0, 0.058, 0.0];
    const coreRadii: Vec3 = [0.099, 0.08, 0.102];
    const core = field()
        .add(ellipsoid(h(...coreCentre), coreRadii))
        .add(ellipsoid(h(0, 0.1, 0.066), [0.066, 0.042, 0.05]), 0.03)
        .clip(halfSpace(h(0, 0.076, 0.108), [0, -0.6, 0.8]), 0.022)
        .clip(halfSpace(h(0, 0.008, 0), [0, -1, -0.42]), 0.012);
    const O: Vec3 = [0, 0.05, 0.0];
    /** The point of the hair's body in a direction from the middle of the head. */
    const onCore = (towards: Vec3, lift: number): Vec3 => {
        const dir = norm([
            towards[0] - O[0],
            towards[1] - O[1],
            towards[2] - O[2],
        ]);
        let t = 0.25;
        for (let i = 0; i < 48; i++) {
            const p = h(
                O[0] + dir[0] * t,
                O[1] + dir[1] * t,
                O[2] + dir[2] * t
            );
            const d = core.eval(p[0], p[1], p[2]);
            if (d < 0.0001) break;
            t -= d * 0.9;
        }
        t += lift;
        return [O[0] + dir[0] * t, O[1] + dir[1] * t, O[2] + dir[2] * t];
    };
    /** Carry a lock on past its last point, kicking out and up: a flick. */
    const flick = (points: Vec3[], kick: number): Vec3 => {
        const p = points[points.length - 1];
        const q = points[points.length - 2];
        const out = norm([p[0], 0, p[2]]);
        return [
            p[0] + (p[0] - q[0]) * 0.6 + out[0] * kick,
            p[1] + (p[1] - q[1]) * 0.3 + kick * 0.9,
            p[2] + (p[2] - q[2]) * 0.6 + out[2] * kick,
        ];
    };
    // Each lock is a leaf: narrow at the root, widest a third of the way
    // along, drawn in to a soft point. Two layers at different heights off
    // the head overlap like roof tiles.
    const leaf = [0.006, 0.019, 0.023, 0.023, 0.02, 0.013, 0.0015];
    const shingle = { pieces: 6, flat: 0.34, blend: 0.0025 };
    /** Carry a lock on along its own line, lifting a little: a soft point. */
    const point = (points: Vec3[]): Vec3 => {
        const p = points[points.length - 1];
        const q = points[points.length - 2];
        const out = norm([p[0], 0, p[2]]);
        return [
            p[0] + (p[0] - q[0]) * 0.5 + out[0] * 0.003,
            p[1] + (p[1] - q[1]) * 0.5,
            p[2] + (p[2] - q[2]) * 0.5 + out[2] * 0.003,
        ];
    };
    /** A point of the hair's body: `a` down from the top, at depth `z`. */
    const side = (s: number, a: number, z: number, lift: number) => {
        const k = Math.sqrt(Math.max(0.15, 1 - (z / coreRadii[2]) ** 2));
        return onCore(
            [
                s * coreRadii[0] * k * Math.sin(a),
                coreCentre[1] + coreRadii[1] * k * Math.cos(a),
                z,
            ],
            lift
        );
    };
    /** A point of the back of it: `down` from the top, `round` from behind. */
    const rear = (down: number, round: number, lift: number) =>
        onCore(
            [
                coreRadii[0] * Math.sin(down) * Math.sin(round),
                coreCentre[1] + coreRadii[1] * Math.cos(down),
                -coreRadii[2] * Math.sin(down) * Math.cos(round),
            ],
            lift
        );
    for (const s of [1, -1]) {
        // The top layer: locks lift across the parting and sweep out over
        // the sides and back, lying flat, each ending at its own height.
        for (let i = 0; i < 6; i++) {
            const root = 0.036 - 0.019 * i;
            const end = 1.0 + 0.2 * ((i * 2 + (s > 0 ? 0 : 1)) % 3);
            const points: Vec3[] = [];
            for (let j = 0; j < 5; j++) {
                const u = j / 4;
                points.push(
                    side(
                        s,
                        -0.12 + (end + 0.12) * u,
                        root -
                            (0.016 + 0.01 * i) * u +
                            0.007 * Math.sin(u * 4.4 + 0.6),
                        j === 0 ? -0.004 : i % 2 ? 0.008 : 0.003
                    )
                );
            }
            points.push(point(points));
            lock(points, leaf, shingle);
        }
        // The layer under it: from beneath the top locks down over the
        // temples to the top of the ear.
        for (let i = 0; i < 3; i++) {
            const root = 0.03 - 0.032 * i;
            const points: Vec3[] = [];
            for (let j = 0; j < 4; j++) {
                const u = j / 3;
                points.push(
                    side(
                        s,
                        0.75 + (0.9 + 0.1 * (i % 2)) * u,
                        root - 0.016 * u,
                        j === 0 ? -0.004 : 0.001
                    )
                );
            }
            points.push(point(points));
            lock(points, leaf, shingle);
        }
        // Flicks: the ends that leave the head and kick out and up, where
        // the character sheet shows them, lower on his right than his left.
        const drop = s > 0 ? 0 : 0.02;
        for (let i = 0; i < 3; i++) {
            const z = 0.022 - 0.036 * i;
            const start = 0.95 + 0.22 * i + drop * 4;
            const a = side(s, start, z, 0.002);
            const b2 = side(s, start + 0.28, z - 0.008, 0.005);
            const out = norm([b2[0], 0, b2[2]]);
            const reach = 0.014 + 0.003 * i;
            lock(
                [
                    a,
                    b2,
                    [
                        b2[0] + out[0] * reach,
                        b2[1] - 0.006,
                        b2[2] + out[2] * reach - 0.004,
                    ],
                    [
                        b2[0] + out[0] * reach * 2,
                        b2[1] + 0.004,
                        b2[2] + out[2] * reach * 2 - 0.01,
                    ],
                ],
                [0.008, 0.015, 0.012, 0.0012],
                { pieces: 5, flat: 0.45, blend: 0.003 }
            );
        }
    }
    // The crown: locks turning out of a whorl and down the back of the
    // head, drifting to his right; and a shorter layer under them that
    // ends above the nape.
    for (let j = 0; j < 7; j++) {
        const from = ((-84 + 28 * j) * Math.PI) / 180;
        const points: Vec3[] = [];
        for (let m = 0; m < 5; m++) {
            const u = m / 4;
            points.push(
                rear(
                    0.2 + (1.2 + 0.12 * (j % 3)) * u,
                    from - 0.3 * u + 0.09 * Math.sin(u * 4.4),
                    m === 0 ? -0.004 : j % 2 ? 0.008 : 0.003
                )
            );
        }
        points.push(point(points));
        lock(points, leaf, shingle);
    }
    for (let j = 0; j < 5; j++) {
        const from = ((-72 + 36 * j) * Math.PI) / 180;
        const points: Vec3[] = [];
        for (let m = 0; m < 4; m++) {
            const u = m / 3;
            points.push(
                rear(
                    1.0 + (0.95 + 0.1 * (j % 2)) * u,
                    from - 0.15 - 0.2 * u,
                    m === 0 ? -0.004 : 0.001
                )
            );
        }
        points.push(point(points));
        lock(points, leaf, shingle);
    }

    // The fringe: a curtain down each side of the forehead, following
    // its edge to the temple, and one thin strand between the brows.
    const curtain = { flat: 0.4 };
    lock(
        [
            [0.04, 0.106, 0.084],
            [0.056, 0.086, 0.108],
            [0.0645, 0.05, 0.113],
            [0.068, 0.016, 0.099],
            [0.0665, -0.014, 0.083],
        ],
        [0.005, 0.0095, 0.0095, 0.0065, 0.0008],
        curtain
    );
    lock(
        [
            [-0.042, 0.104, 0.084],
            [-0.057, 0.082, 0.105],
            [-0.065, 0.046, 0.107],
            [-0.0685, 0.014, 0.093],
            [-0.067, -0.012, 0.078],
        ],
        [0.005, 0.0095, 0.0095, 0.0065, 0.0008],
        curtain
    );
    lock(
        [
            [-0.006, 0.1, 0.086],
            [-0.0085, 0.06, 0.1125],
            [-0.0095, 0.028, 0.1125],
            [-0.009, 0.003, 0.1085],
        ],
        [0.0042, 0.0038, 0.0028, 0.0008],
        { pieces: 4, flat: 0.8, blend: 0.002 }
    );
    // The ragged lower edge: points in front of the ear, behind it, and
    // along the nape.
    const spike = { pieces: 2, flat: 0.32 };
    both(
        [
            [0.067, 0.03, 0.03],
            [0.0685, 0.004, 0.03],
            [0.067, -0.022, 0.026],
        ],
        [0.009, 0.006, 0.0008],
        spike
    );
    both(
        [
            [0.064, 0.04, 0.052],
            [0.066, 0.02, 0.055],
            [0.065, 0.004, 0.054],
        ],
        [0.008, 0.006, 0.001],
        spike
    );
    const nape: [number, number, number, number][] = [
        [0.06, -0.012, -0.04, -0.036],
        [0.05, -0.022, -0.062, -0.05],
        [0.032, -0.03, -0.08, -0.062],
        [0.012, -0.034, -0.09, -0.07],
    ];
    for (const [x, y, z, tipY] of nape)
        both(
            [
                [x, y + 0.03, z - 0.004],
                [x * 0.96, y, z],
                [x * 0.86, tipY, z + 0.01],
            ],
            [0.013, 0.01, 0.001],
            spike
        );

    const under = field().add(cap).add(core, 0.006);
    const shape = field().add(under);
    // Pieces of one lock simply overlap (blending them would swell every
    // joint into a bead); locks blend a little where they cross.
    const byLock = new Map<number, SculptHairSegment[]>();
    for (const seg of segments)
        byLock.set(seg.lock, [...(byLock.get(seg.lock) || []), seg]);
    for (const pieces of byLock.values()) {
        const one = field();
        for (const seg of pieces)
            one.add(
                ribbonCone(
                    seg.a,
                    seg.b,
                    seg.ra,
                    seg.rb,
                    seg.out,
                    seg.flat,
                    seg.outEnd
                )
            );
        shape.add(one, pieces[0].blend);
    }
    return { cap: under, segments, shape };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function norm(v: readonly number[]): Vec3 {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * The Stagehand as a described humanoid: his body in numbers read off the
 * character sheet, and his own head, hair and school uniform.
 */
export const STAGEHAND: HumanoidSpec = {
    id: "stagehand",
    name: "Stagehand",
    height: 1.79,
    proportions: {
        hips: [0, 1.0, 0],
        spine: [0, 1.08, 0.002],
        chest: [0, 1.18, 0.002],
        upperChest: [0, 1.29, 0],
        neck: [0, 1.445, -0.012],
        head: [0, 1.535, 0],
        shoulder: [0.026, 1.42, -0.008],
        upperArm: [0.175, 1.412, -0.006],
        lowerArm: [0.43, 1.404, -0.002],
        hand: [0.672, ARM_Y, 0.003],
        upperLeg: [0.088, 0.95, 0],
        lowerLeg: [0.115, 0.52, 0],
        // Barefoot, the sole of this foot rests on the floor.
        foot: [0.137, 0.0726, -0.028],
        toes: [0.137, 0.02, 0.09],
        handLength: 0.2,
        handScale: 1.1,
        headScale: 1,
    },
    build: {
        hips: [0.138, 0.098],
        waist: [0.116, 0.088],
        chest: [0.148, 0.098],
        bust: 0.1,
        seat: 0.9,
        neck: 0.039,
        arm: 1,
        thigh: 1,
        calf: 1.05,
        foot: 1.1,
    },
    underwear: { waist: 1.045, hem: 0.86 },
    palette: {
        skin: "#d58d70",
        skinShade: "#a45c49",
        blush: "#d06a52",
        lip: "#b96a55",
        lipLine: "#5a2c25",
        brow: "#17110f",
        lash: "#120d0c",
        iris: "#2e1b16",
        irisLight: "#6a4434",
        white: "#f7f2ef",
        hair: "#231c1f",
        hairSheen: "#9a705e",
        cotton: "#f1ecf1",
        cottonShade: "#c7caee",
        tie: "#4d78d8",
        tieStripe: "#c6d6f6",
        wool: "#353240",
        woolShade: "#1d1c26",
        black: "#1c1b1e",
        knit: "#f4eff1",
        metal: "#8f939c",
        card: "#f6f3f0",
        cardInk: "#7fa9e6",
        underwear: "#3d4a66",
        underwearBand: "#232c40",
    },
    head() {
        const { shape, mouthZ, eye } = head();
        return {
            shape: symmetric(shape),
            eye: {
                material: "eye",
                // A thin flat slab, kept to the almond it shows through.
                shape: symmetric(
                    field()
                        .add(
                            roundBox(
                                [
                                    eye.centre[0],
                                    eye.centre[1],
                                    eye.centre[2] - 0.003,
                                ],
                                [0.03, 0.03, 0.003],
                                0.0005,
                                eye.basis
                            )
                        )
                        .clip(eyeOutline(eye.skinZ, 0.0025))
                ),
                min: [
                    -eye.centre[0] - 0.028,
                    eye.centre[1] - 0.024,
                    eye.centre[2] - 0.022,
                ],
                max: [
                    eye.centre[0] + 0.028,
                    eye.centre[1] + 0.016,
                    eye.centre[2] + 0.012,
                ],
            },
            face: {
                eye: {
                    centre: eye.centre,
                    across: EYE_ACROSS,
                    halfWidth: EYE_SHAPE.halfWidth,
                    upper: EYE_UPPER,
                    lower: EYE_LOWER,
                    iris: EYE_SHAPE.iris,
                },
                brow: {
                    path: [
                        [0.0128, EYE_Y + 0.004],
                        [0.036, EYE_Y + 0.0125],
                        [0.053, EYE_Y + 0.0206],
                        [0.063, EYE_Y + 0.0188],
                    ],
                    width: [0.0088, 0.008, 0.006, 0.0012],
                    frontZ: Z0 + 0.062,
                },
                mouth: {
                    y: EYE_Y + MOUTH_Y,
                    z: Z0 + mouthZ,
                    halfWidth: 0.0175,
                },
                cheek: [0.04, EYE_Y - 0.036, Z0 + 0.075],
                noseTip: h(0, -0.0405, 0.1125),
                ear: h(0.077, -0.006, -0.01),
                chinY: EYE_Y - 0.099,
            },
        };
    },
    hair() {
        const parts = hair();
        return {
            layer: {
                material: "hair",
                shape: parts.shape,
                min: [-0.135, 1.545, -0.135],
                max: [0.135, 1.8, 0.145],
            },
            cap: parts.cap,
            segments: parts.segments,
        };
    },
    outfit(rig) {
        // The ring sits near the root of his right ring finger.
        const finger = rig.finger("right", "Ring").points;
        const ring: Vec3 = [
            finger[0][0] + (finger[1][0] - finger[0][0]) * 0.45,
            finger[0][1] + (finger[1][1] - finger[0][1]) * 0.45,
            finger[0][2] + (finger[1][2] - finger[0][2]) * 0.45,
        ];
        const blackParts = black(ring);
        return {
            layers: [
                {
                    material: "cotton",
                    shape: shirt(),
                    min: [-0.7, 1.1, -0.115],
                    max: [0.7, 1.53, 0.118],
                },
                {
                    material: "tie",
                    shape: tie(),
                    min: [-0.04, 1.075, 0.07],
                    max: [0.04, 1.495, 0.13],
                },
                {
                    material: "wool",
                    shape: trousers(),
                    min: [-0.26, 0.205, -0.14],
                    max: [0.26, 1.115, 0.11],
                },
                {
                    material: "knit",
                    shape: socks(),
                    min: [-0.18, 0.06, -0.07],
                    max: [0.18, 0.29, 0.015],
                },
                {
                    material: "black",
                    shape: blackParts.shape,
                    min: [-0.235, -0.002, -0.125],
                    max: [0.235, 1.555, 0.24],
                },
                {
                    material: "black",
                    shape: blackParts.asymmetric,
                    min: [-0.86, 1.05, -0.04],
                    max: [0.165, 1.42, 0.13],
                },
                {
                    material: "badge",
                    shape: badge(),
                    min: [0.055, 1.305, 0.095],
                    max: [0.13, 1.373, 0.115],
                },
            ],
            // Dressed, only the neck and the hands show.
            uncovered: symmetric(
                field()
                    .add(roundBox([0, 1.5, 0], [0.075, 0.07, 0.09], 0.01))
                    .add(halfSpace([0.656, 0, 0], [-1, 0, 0]))
            ),
            badge: {
                centre: [0.093, 1.339, 0.1045],
                half: [0.033, 0.03],
            },
            buckle: { centre: [0, 1.12, 0.106], half: [0.021, 0.017] },
        };
    },
};

/** The Stagehand as a sculpt: dressed, or in his underwear. */
export const stagehandSculpt = (options?: BuildOptions) =>
    buildHumanoid(STAGEHAND, options);
