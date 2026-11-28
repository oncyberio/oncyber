/**
 * The figure's body as a sewing simulator wants it: a mesh in centimetres
 * facing +z, which of its vertices belong to each arm and leg (so a
 * sleeve may lie against the arm it is on without counting as caught on
 * the body), and the measurements sewing patterns are drafted from.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Figure, V3 } from "../clothes/figure";

/**
 * Our figure faces -z; the simulator's bodies face +z. Both are in metres
 * (the simulator drafts patterns in cm, from measurements in cm).
 */
export const toSim = (p: V3): V3 => [-p[0], p[1], -p[2]];
export const fromSim = (p: V3): V3 => [-p[0], p[1], -p[2]];
const CM = 100;

const LIMBS: [string, RegExp][] = [
    [
        "left_arm",
        /^(left)(UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/,
    ],
    [
        "right_arm",
        /^(right)(UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/,
    ],
    ["left_leg", /^(left)(UpperLeg|LowerLeg|Foot|Toes)/],
    ["right_leg", /^(right)(UpperLeg|LowerLeg|Foot|Toes)/],
];

const HUMANOID = [
    "hips",
    "spine",
    "chest",
    "upperChest",
    "neck",
    "head",
    ...["left", "right"].flatMap((s) =>
        [
            "Shoulder",
            "UpperArm",
            "LowerArm",
            "Hand",
            "UpperLeg",
            "LowerLeg",
            "Foot",
            "Toes",
            ...["Thumb", "Index", "Middle", "Ring", "Little"].flatMap((f) =>
                ["Proximal", "Intermediate", "Distal", "Metacarpal"].map(
                    (k) => f + k
                )
            ),
        ].map((b) => s + b)
    ),
];

/** Perimeter of the convex hull of points in a plane (x, z). */
function hullPerimeter(points: [number, number][]) {
    if (points.length < 3) return 0;
    const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: number[], a: number[], b: number[]) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: [number, number][] = [];
    for (const q of p) {
        while (
            lower.length >= 2 &&
            cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0
        )
            lower.pop();
        lower.push(q);
    }
    const upper: [number, number][] = [];
    for (const q of [...p].reverse()) {
        while (
            upper.length >= 2 &&
            cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0
        )
            upper.pop();
        upper.push(q);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    let sum = 0;
    for (let i = 0; i < hull.length; i++) {
        const a = hull[i];
        const b = hull[(i + 1) % hull.length];
        sum += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    return sum;
}

export function writeBody(figure: Figure, dir: string, name = "figure") {
    const P = figure.positions;
    const count = P.length / 3;
    const at = (v: number): V3 => toSim([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const atCm = (v: number): V3 => at(v).map((x) => x * CM) as V3;

    // Which limb each vertex follows most.
    const boneLimb = figure.bones.map(() => "body");
    for (const h of HUMANOID) {
        let index = -1;
        try {
            index = figure.bone(h);
        } catch {
            continue;
        }
        if (index < 0) continue;
        for (const [limb, re] of LIMBS) if (re.test(h)) boneLimb[index] = limb;
    }
    const limbOf: string[] = [];
    const segments: Record<string, number[]> = {
        body: [],
        left_arm: [],
        left_leg: [],
        right_arm: [],
        right_leg: [],
        face_internal: [],
    };
    for (let v = 0; v < count; v++) {
        let best = 0;
        for (let k = 1; k < 4; k++)
            if (figure.weights[v * 4 + k] > figure.weights[v * 4 + best])
                best = k;
        const limb = boneLimb[figure.joints[v * 4 + best]];
        limbOf.push(limb);
        segments[limb].push(v);
    }

    let obj = "";
    for (let v = 0; v < count; v++)
        obj += `v ${at(v)
            .map((x) => x.toFixed(6))
            .join(" ")}\n`;
    const I = figure.indices;
    // Winding flips with the mirror (x and z both negated keeps handedness).
    for (let t = 0; t < I.length; t += 3)
        obj += `f ${I[t] + 1} ${I[t + 1] + 1} ${I[t + 2] + 1}\n`;
    writeFileSync(path.join(dir, `${name}.obj`), obj);
    writeFileSync(
        path.join(dir, `${name}_segmentation.json`),
        JSON.stringify(segments)
    );

    // Measurements, in cm, from slices of the torso.
    let lo = Infinity;
    let hi = -Infinity;
    for (let v = 0; v < count; v++) {
        lo = Math.min(lo, atCm(v)[1]);
        hi = Math.max(hi, atCm(v)[1]);
    }
    const j = (n: string) => toSim(figure.joint(n)).map((x) => x * CM) as V3;
    // Round a limb or the torso, cut across `axis` (1 = level, 0 = along
    // an arm held out).
    const slice = (y: number, limb = "body", band = 1, axis = 1) => {
        const pts: [number, number][] = [];
        const [a, b] = axis === 1 ? [0, 2] : [1, 2];
        for (let v = 0; v < count; v++) {
            if (limbOf[v] !== limb) continue;
            const q = atCm(v);
            if (Math.abs(q[axis] - y) < band) pts.push([q[a], q[b]]);
        }
        return pts.length < 12 ? NaN : hullPerimeter(pts);
    };
    const neck = j("neck");
    const head = j("head");
    const hips = j("hips");
    const sL = j("leftUpperArm");
    const sR = j("rightUpperArm");
    const eL = j("leftLowerArm");
    const wL = j("leftHand");
    const hipL = j("leftUpperLeg");
    const range = (
        a: number,
        b: number,
        f: (y: number) => number,
        pick: (a: number, b: number) => number
    ) => {
        let best = f(a);
        let at = a;
        for (let y = a; y <= b; y += 0.5) {
            const m = f(y);
            if (!Number.isFinite(m)) continue;
            if (!Number.isFinite(best) || (pick(m, best) === m && m !== best)) {
                best = m;
                at = y;
            }
        }
        return [best, at];
    };
    const [bust, bustY] = range(
        sL[1] - 18,
        sL[1] - 4,
        (y) => slice(y),
        Math.max
    );
    const [waist, waistY] = range(
        hips[1] + 2,
        bustY - 4,
        (y) => slice(y),
        Math.min
    );
    const [hipsC, hipsY] = range(
        hipL[1] - 6,
        hips[1] + 2,
        (y) => slice(y),
        Math.max
    );
    const height = hi - lo;
    const ref = {
        // mean_all_tpose, for what we don't measure, scaled to suit.
        height: 171.99,
        bust: 99.8407,
        waist: 84.3338,
        hips: 103.478,
    };
    const tall = height / ref.height;
    const wide = bust / ref.bust;
    const len = (a: V3, b: V3) =>
        Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const armAngle =
        (Math.atan2(sL[1] - wL[1], Math.abs(wL[0] - sL[0])) * 180) / Math.PI;
    const body = {
        arm_length: len(sL, eL) + len(eL, wL) + 2,
        arm_pose_angle: Math.max(0, armAngle),
        armscye_depth: 12.8679 * tall,
        back_width: 47.6761 * wide,
        bum_points: 18.2342 * wide,
        bust,
        bust_line: Math.max(4, neck[1] - bustY),
        bust_points: 16.9463 * wide,
        crotch_hip_diff: 8.81363 * tall,
        head_l: hi - neck[1],
        height,
        hip_back_width: hipsC / 2 + 3,
        hip_inclination: 9.86489 * tall,
        hips: hipsC,
        hips_line: Math.max(4, waistY - hipsY),
        leg_circ: slice(hipL[1] - 6, "left_leg", 1) || 60.2039 * wide,
        neck_w: slice(neck[1] + 2, "body", 1) / Math.PI + 2,
        shoulder_incl: 21.6777,
        shoulder_w: Math.abs(sL[0] - sR[0]) + 2,
        underbust: bust * 0.9,
        vert_bust_line: 21.1388 * tall,
        waist,
        waist_back_width: waist / 2 - 3,
        waist_line: neck[1] - waistY,
        waist_over_bust_line: (neck[1] - waistY) * 1.1,
        wrist:
            slice(wL[0] + Math.sign(sL[0] - wL[0]) * 2, "left_arm", 0.8, 0) ||
            16.5945 * wide,
    };
    const yaml =
        "body:\n" +
        Object.entries(body)
            .sort()
            .map(([k, v]) => `  ${k}: ${(v as number).toFixed(4)}`)
            .join("\n") +
        "\n";
    writeFileSync(path.join(dir, `${name}.yaml`), yaml);
    return { body, head, waistY, hipsY, bustY };
}
