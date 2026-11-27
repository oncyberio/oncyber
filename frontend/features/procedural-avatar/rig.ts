import { Shape, Vec3, roundCone, stretch } from "./kernel/sdf";

/**
 * The avatar's skeleton, and the pose its surfaces are sculpted in.
 *
 * Bones use the VRM humanoid names and rest in a T-pose with identity
 * rotations, facing +Z with the left side on +X: the "normalized" rig every
 * Oncyber motion clip targets.
 *
 * Surfaces are not sculpted in that T-pose. They are sculpted in a relaxed
 * design pose (arms lowered, elbows slightly bent), where shoulders and
 * sleeves look the way they will for most of the avatar's life, and then
 * carried back to the T-pose by inverting the skin transform per vertex.
 * Posing the finished avatar into the design pose reproduces the sculpt
 * exactly.
 */

/** A 4x4 transform, column-major like three.js `Matrix4.elements`. */
export type Mat4 = number[];

const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Array(16) as Mat4;
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            out[c * 4 + r] =
                a[r] * b[c * 4] +
                a[4 + r] * b[c * 4 + 1] +
                a[8 + r] * b[c * 4 + 2] +
                a[12 + r] * b[c * 4 + 3];
    return out;
}

function translation(x: number, y: number, z: number): Mat4 {
    const m = identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
}

/** Rotation about one axis (0 = X, 1 = Y, 2 = Z) by `angle` radians. */
function rotation(axis: number, angle: number): Mat4 {
    const m = identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    m[u * 4 + u] = c;
    m[v * 4 + v] = c;
    m[u * 4 + v] = s;
    m[v * 4 + u] = -s;
    return m;
}

export interface BoneDef {
    name: string;
    parent: string | null;
    /** T-pose position in metres, avatar space. */
    position: Vec3;
}

const SIDES = [
    ["left", 1],
    ["right", -1],
] as const;

const FINGERS = {
    Thumb: {
        joints: ["Metacarpal", "Proximal", "Distal"],
        root: [0.02, -0.01, 0.021],
        direction: [0.6, -0.2, 0.77],
        lengths: [0.034, 0.027, 0.024],
        radius: [0.0105, 0.0092, 0.0078],
    },
    Index: {
        joints: ["Proximal", "Intermediate", "Distal"],
        root: [0.083, -0.001, 0.0255],
        direction: [1, -0.02, 0.085],
        lengths: [0.037, 0.023, 0.02],
        radius: [0.0082, 0.0074, 0.0064],
    },
    Middle: {
        joints: ["Proximal", "Intermediate", "Distal"],
        root: [0.0865, 0, 0.0065],
        direction: [1, -0.02, 0.01],
        lengths: [0.041, 0.026, 0.021],
        radius: [0.0084, 0.0076, 0.0066],
    },
    Ring: {
        joints: ["Proximal", "Intermediate", "Distal"],
        root: [0.082, -0.0015, -0.012],
        direction: [1, -0.02, -0.07],
        lengths: [0.037, 0.024, 0.02],
        radius: [0.008, 0.0072, 0.0062],
    },
    Little: {
        joints: ["Proximal", "Intermediate", "Distal"],
        root: [0.074, -0.0045, -0.0285],
        direction: [1, -0.03, -0.17],
        lengths: [0.029, 0.018, 0.017],
        radius: [0.0072, 0.0064, 0.0055],
    },
} as const;

export type FingerName = keyof typeof FINGERS;
export const FINGER_NAMES = Object.keys(FINGERS) as FingerName[];

/** Key heights and offsets of a T-pose, in metres (left side). */
export interface Proportions {
    hips: Vec3;
    spine: Vec3;
    chest: Vec3;
    upperChest: Vec3;
    neck: Vec3;
    head: Vec3;
    shoulder: Vec3;
    upperArm: Vec3;
    lowerArm: Vec3;
    hand: Vec3;
    upperLeg: Vec3;
    lowerLeg: Vec3;
    foot: Vec3;
    toes: Vec3;
    /** Wrist to fingertip. */
    handLength: number;
    /** Size of the hand and fingers relative to the reference hand. */
    handScale: number;
    /** Size of the head relative to the reference head. */
    headScale: number;
}

/** The reference proportions: a slender figure about 1.68 m tall. */
export const BODY: Proportions = {
    hips: [0, 0.955, 0],
    spine: [0, 1.02, 0.002],
    chest: [0, 1.115, 0.002],
    upperChest: [0, 1.225, 0],
    neck: [0, 1.372, -0.012],
    head: [0, 1.452, -0.002],
    shoulder: [0.022, 1.345, -0.008],
    upperArm: [0.148, 1.343, -0.014],
    lowerArm: [0.4, 1.343, -0.014],
    hand: [0.628, 1.343, -0.014],
    upperLeg: [0.08, 0.9, 0],
    lowerLeg: [0.08, 0.482, 0.002],
    foot: [0.08, 0.096, -0.014],
    toes: [0.08, 0.036, 0.098],
    handLength: 0.168,
    handScale: 1,
    headScale: 1,
};

function norm(v: Vec3): [number, number, number] {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
}

function buildBones(BODY: Proportions): BoneDef[] {
    const hs = BODY.handScale;
    const bones: BoneDef[] = [
        { name: "hips", parent: null, position: BODY.hips },
        { name: "spine", parent: "hips", position: BODY.spine },
        { name: "chest", parent: "spine", position: BODY.chest },
        { name: "upperChest", parent: "chest", position: BODY.upperChest },
        { name: "neck", parent: "upperChest", position: BODY.neck },
        { name: "head", parent: "neck", position: BODY.head },
    ];
    for (const [side, s] of SIDES) {
        const m = (v: Vec3): Vec3 => [v[0] * s, v[1], v[2]];
        bones.push(
            {
                name: `${side}Shoulder`,
                parent: "upperChest",
                position: m(BODY.shoulder),
            },
            {
                name: `${side}UpperArm`,
                parent: `${side}Shoulder`,
                position: m(BODY.upperArm),
            },
            {
                name: `${side}LowerArm`,
                parent: `${side}UpperArm`,
                position: m(BODY.lowerArm),
            },
            {
                name: `${side}Hand`,
                parent: `${side}LowerArm`,
                position: m(BODY.hand),
            }
        );
        for (const finger of FINGER_NAMES) {
            const def = FINGERS[finger];
            const dir = norm(def.direction);
            let parent = `${side}Hand`;
            let along = 0;
            def.joints.forEach((joint, i) => {
                const name = `${side}${finger}${joint}`;
                bones.push({
                    name,
                    parent,
                    position: m([
                        BODY.hand[0] + (def.root[0] + dir[0] * along) * hs,
                        BODY.hand[1] + (def.root[1] + dir[1] * along) * hs,
                        BODY.hand[2] + (def.root[2] + dir[2] * along) * hs,
                    ]),
                });
                parent = name;
                along += def.lengths[i];
            });
        }
        bones.push(
            {
                name: `${side}UpperLeg`,
                parent: "hips",
                position: m(BODY.upperLeg),
            },
            {
                name: `${side}LowerLeg`,
                parent: `${side}UpperLeg`,
                position: m(BODY.lowerLeg),
            },
            {
                name: `${side}Foot`,
                parent: `${side}LowerLeg`,
                position: m(BODY.foot),
            },
            {
                name: `${side}Toes`,
                parent: `${side}Foot`,
                position: m(BODY.toes),
            }
        );
    }
    return bones;
}

/** Degrees the arms hang below horizontal while sculpting. */
const ARM_DROP = 52;
const ELBOW_BEND = 14;

const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

export interface FingerChain {
    bones: number[];
    /** Design-pose joints, then the fingertip. */
    points: [number, number, number][];
    radius: readonly number[];
}

interface ArmChain {
    sign: number;
    shoulder: number;
    upper: number;
    lower: number;
    hand: number;
    pUpper: Vec3;
    pLower: Vec3;
    pHand: Vec3;
    pTip: Vec3;
    dUpper: Vec3;
    dLower: Vec3;
    elbowNormal: Vec3;
    fingers: FingerChain[];
}

/** Up to four bone influences for one vertex. */
export class Influence {
    readonly bones = new Int32Array(8);
    readonly weights = new Float32Array(8);
    count = 0;
    clear() {
        this.count = 0;
        return this;
    }
    add(bone: number, weight: number) {
        if (weight <= 1e-4) return this;
        for (let i = 0; i < this.count; i++)
            if (this.bones[i] === bone) {
                this.weights[i] += weight;
                return this;
            }
        if (this.count < 8) {
            this.bones[this.count] = bone;
            this.weights[this.count++] = weight;
        } else {
            let least = 0;
            for (let i = 1; i < 8; i++)
                if (this.weights[i] < this.weights[least]) least = i;
            if (weight > this.weights[least]) {
                this.bones[least] = bone;
                this.weights[least] = weight;
            }
        }
        return this;
    }
    /** Keep the four strongest and make them sum to one. */
    finish() {
        for (let i = 0; i < this.count; i++)
            for (let j = i + 1; j < this.count; j++)
                if (this.weights[j] > this.weights[i]) {
                    const b = this.bones[i];
                    const w = this.weights[i];
                    this.bones[i] = this.bones[j];
                    this.weights[i] = this.weights[j];
                    this.bones[j] = b;
                    this.weights[j] = w;
                }
        this.count = Math.min(this.count, 4);
        let sum = 0;
        for (let i = 0; i < this.count; i++) sum += this.weights[i];
        if (sum <= 0) {
            this.count = 1;
            this.bones[0] = 0;
            this.weights[0] = 1;
            sum = 1;
        }
        for (let i = 0; i < 4; i++) {
            if (i < this.count) this.weights[i] /= sum;
            else {
                this.bones[i] = 0;
                this.weights[i] = 0;
            }
        }
        return this;
    }
}

export interface SkinOptions {
    /** 0 keeps a surface off the arms entirely (a tie, a belt). */
    arms?: number;
    /** Widens the shoulder blend for loose cloth. */
    loose?: number;
}

function segmentDistance(p: Vec3, a: Vec3, b: Vec3) {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const apx = p[0] - a[0];
    const apy = p[1] - a[1];
    const apz = p[2] - a[2];
    const l2 = abx * abx + aby * aby + abz * abz;
    const t =
        l2 > 0
            ? Math.min(1, Math.max(0, (apx * abx + apy * aby + apz * abz) / l2))
            : 0;
    return Math.hypot(apx - abx * t, apy - aby * t, apz - abz * t);
}

export class Rig {
    readonly bones: BoneDef[];
    readonly index: Record<string, number> = {};
    /** Design-pose world matrix of each bone. */
    readonly design: Mat4[] = [];
    /** T-pose to design-pose skin matrix of each bone. */
    readonly skin: Mat4[] = [];
    /**
     * The design pose as rotations of a T-pose skeleton: bone name to
     * [axis, radians], axis 0 = X, 1 = Y, 2 = Z.
     */
    readonly pose: Record<string, [number, number]> = {};
    /** Bones the design pose leaves where the T-pose has them. */
    readonly identity: boolean[] = [];
    private readonly arms: ArmChain[] = [];
    private readonly torso: Shape;
    private readonly spineChain: { bone: number; y: number }[];
    private readonly legs: {
        sign: number;
        upper: number;
        lower: number;
        foot: number;
        toes: number;
    }[];

    /**
     * `pose` sets the pose shapes are authored in: by default the arms
     * hang lowered and a little bent; `{ armDrop: 0, elbowBend: 0 }` is the
     * T-pose itself, where the skin matrices are all identity.
     */
    constructor(
        readonly body: Proportions = BODY,
        extraBones: BoneDef[] = [],
        pose: { armDrop?: number; elbowBend?: number } = {}
    ) {
        const armDrop = pose.armDrop ?? ARM_DROP;
        const elbowBend = pose.elbowBend ?? ELBOW_BEND;
        this.bones = buildBones(body);
        this.bones.push(...extraBones);
        const BODY = body;
        this.bones.forEach((bone, i) => (this.index[bone.name] = i));
        const rad = Math.PI / 180;
        for (const [side, s] of SIDES) {
            this.pose[`${side}UpperArm`] = [2, -armDrop * s * rad];
            this.pose[`${side}LowerArm`] = [1, -elbowBend * s * rad];
        }
        this.bones.forEach((bone, i) => {
            const parent = bone.parent === null ? -1 : this.index[bone.parent];
            const from = parent < 0 ? [0, 0, 0] : this.bones[parent].position;
            let local = translation(
                bone.position[0] - from[0],
                bone.position[1] - from[1],
                bone.position[2] - from[2]
            );
            const turn = this.pose[bone.name];
            if (turn) local = multiply(local, rotation(turn[0], turn[1]));
            const world =
                parent < 0 ? local : multiply(this.design[parent], local);
            this.design[i] = world;
            this.skin[i] = multiply(
                world,
                translation(
                    -bone.position[0],
                    -bone.position[1],
                    -bone.position[2]
                )
            );
            this.identity[i] = this.skin[i].every(
                (v, k) => Math.abs(v - (k % 5 === 0 ? 1 : 0)) < 1e-9
            );
        });

        for (const [side, s] of SIDES) {
            const pUpper = this.joint(`${side}UpperArm`);
            const pLower = this.joint(`${side}LowerArm`);
            const pHand = this.joint(`${side}Hand`);
            const pTip = this.at(`${side}Hand`, [BODY.handLength * s, 0, 0]);
            const dUpper = norm([
                pLower[0] - pUpper[0],
                pLower[1] - pUpper[1],
                pLower[2] - pUpper[2],
            ]);
            const dLower = norm([
                pHand[0] - pLower[0],
                pHand[1] - pLower[1],
                pHand[2] - pLower[2],
            ]);
            this.arms.push({
                sign: s,
                shoulder: this.index[`${side}Shoulder`],
                upper: this.index[`${side}UpperArm`],
                lower: this.index[`${side}LowerArm`],
                hand: this.index[`${side}Hand`],
                pUpper,
                pLower,
                pHand,
                pTip,
                dUpper,
                dLower,
                elbowNormal: norm([
                    dUpper[0] + dLower[0],
                    dUpper[1] + dLower[1],
                    dUpper[2] + dLower[2],
                ]),
                fingers: FINGER_NAMES.map((finger) =>
                    this.finger(side, finger)
                ),
            });
        }
        const shoulderX = BODY.upperArm[0];
        this.torso = stretch(
            roundCone(
                [0, BODY.hips[1] - 0.025, 0],
                [0, BODY.upperArm[1] - 0.023, -0.005],
                BODY.upperLeg[0] + 0.065,
                shoulderX - 0.013
            ),
            [0, BODY.chest[1], 0],
            [1, 1, 0.7]
        );
        this.spineChain = ["spine", "chest", "upperChest", "neck"].map(
            (name) => ({
                bone: this.index[name],
                y: this.bones[this.index[name]].position[1],
            })
        );
        this.legs = SIDES.map(([side, s]) => ({
            sign: s,
            upper: this.index[`${side}UpperLeg`],
            lower: this.index[`${side}LowerLeg`],
            foot: this.index[`${side}Foot`],
            toes: this.index[`${side}Toes`],
        }));
    }

    /** Design-pose position of a bone's joint. */
    joint(bone: string): [number, number, number] {
        const e = this.design[this.index[bone]];
        return [e[12], e[13], e[14]];
    }

    /** Design-pose position of a point given relative to a bone's T-pose joint. */
    at(bone: string, offset: Vec3): [number, number, number] {
        const e = this.design[this.index[bone]];
        return [
            e[0] * offset[0] + e[4] * offset[1] + e[8] * offset[2] + e[12],
            e[1] * offset[0] + e[5] * offset[1] + e[9] * offset[2] + e[13],
            e[2] * offset[0] + e[6] * offset[1] + e[10] * offset[2] + e[14],
        ];
    }

    /** A T-pose direction as it points in the design pose. */
    direction(bone: string, v: Vec3): [number, number, number] {
        const e = this.design[this.index[bone]];
        return norm([
            e[0] * v[0] + e[4] * v[1] + e[8] * v[2],
            e[1] * v[0] + e[5] * v[1] + e[9] * v[2],
            e[2] * v[0] + e[6] * v[1] + e[10] * v[2],
        ]);
    }

    finger(side: "left" | "right", finger: FingerName): FingerChain {
        const def = FINGERS[finger];
        const s = side === "left" ? 1 : -1;
        const bones = def.joints.map(
            (joint) => this.index[`${side}${finger}${joint}`]
        );
        const points = bones.map((bone) => this.joint(this.bones[bone].name));
        const dir = norm(def.direction);
        const hs = this.body.handScale;
        const last = def.lengths[def.lengths.length - 1] * hs;
        points.push(
            this.at(this.bones[bones[bones.length - 1]].name, [
                dir[0] * last * s,
                dir[1] * last,
                dir[2] * last,
            ])
        );
        return { bones, points, radius: def.radius.map((r) => r * hs) };
    }

    /**
     * Bone influences for a design-pose point. Works for skin and for cloth:
     * a point takes after whatever part of the body it sits over.
     */
    skinAt(
        x: number,
        y: number,
        z: number,
        out: Influence,
        options: SkinOptions = {}
    ) {
        out.clear();
        const p: Vec3 = [x, y, z];
        const armScale = options.arms ?? 1;
        const loose = options.loose ?? 0;
        let body = 1;
        if (armScale > 0) {
            const torso = this.torso.eval(x, y, z);
            for (const arm of this.arms) {
                if (x * arm.sign < -0.02) continue;
                const dArm =
                    Math.min(
                        segmentDistance(p, arm.pUpper, arm.pLower),
                        segmentDistance(p, arm.pLower, arm.pHand),
                        segmentDistance(p, arm.pHand, arm.pTip)
                    ) - 0.034;
                const band = 0.03 + loose;
                const armness =
                    smoothstep(-band, band, torso - dArm - loose * 0.5) *
                    armScale;
                if (armness <= 0) continue;
                body -= armness;
                this.armWeights(arm, p, armness, out);
            }
        }
        if (body > 1e-4) this.bodyWeights(x, y, z, body, out);
        return out.finish();
    }

    private armWeights(arm: ArmChain, p: Vec3, total: number, out: Influence) {
        const along = (origin: Vec3, dir: Vec3) =>
            (p[0] - origin[0]) * dir[0] +
            (p[1] - origin[1]) * dir[1] +
            (p[2] - origin[2]) * dir[2];
        const wUpper = smoothstep(-0.055, 0.04, along(arm.pUpper, arm.dUpper));
        const wLower = smoothstep(
            -0.04,
            0.04,
            along(arm.pLower, arm.elbowNormal)
        );
        const wHand = smoothstep(-0.014, 0.012, along(arm.pHand, arm.dLower));
        out.add(arm.shoulder, total * (1 - wUpper));
        out.add(arm.upper, total * wUpper * (1 - wLower));
        out.add(arm.lower, total * wUpper * wLower * (1 - wHand));
        const hand = total * wUpper * wLower * wHand;
        if (hand <= 1e-4) return;
        // Share the hand between the palm and the fingers the point is on.
        let best = Infinity;
        const distances: number[] = [];
        for (const finger of arm.fingers) {
            let d = Infinity;
            for (let i = 0; i + 1 < finger.points.length; i++)
                d = Math.min(
                    d,
                    segmentDistance(p, finger.points[i], finger.points[i + 1])
                );
            distances.push(d);
            best = Math.min(best, d);
        }
        let shares = 0;
        const share = distances.map((d) => {
            const v = Math.exp(-(d - best) / 0.002);
            shares += v;
            return v;
        });
        let palm = hand;
        arm.fingers.forEach((finger, f) => {
            const portion = share[f] / shares;
            if (portion < 0.02) return;
            const pts = finger.points;
            const dir = norm([
                pts[1][0] - pts[0][0],
                pts[1][1] - pts[0][1],
                pts[1][2] - pts[0][2],
            ]);
            const isThumb = f === 0;
            const reach = isThumb
                ? smoothstep(0.028, 0.012, distances[f]) *
                  smoothstep(-0.014, 0.012, along(pts[0], dir))
                : smoothstep(-0.009, 0.006, along(pts[0], dir)) *
                  smoothstep(0.024, 0.013, distances[f]);
            const w = hand * portion * reach;
            if (w <= 1e-4) return;
            palm -= w;
            const w2 = smoothstep(-0.0045, 0.0045, along(pts[1], dir));
            const w3 = smoothstep(-0.004, 0.004, along(pts[2], dir));
            out.add(finger.bones[0], w * (1 - w2));
            out.add(finger.bones[1], w * w2 * (1 - w3));
            out.add(finger.bones[2], w * w2 * w3);
        });
        out.add(arm.hand, Math.max(0, palm));
    }

    private bodyWeights(
        x: number,
        y: number,
        z: number,
        total: number,
        out: Influence
    ) {
        const BODY = this.body;
        const hipY = BODY.upperLeg[1];
        const legness = smoothstep(
            0,
            0.13,
            hipY + 0.035 - y + 0.35 * (Math.abs(x) - BODY.upperLeg[0])
        );
        if (legness > 0) {
            const left = smoothstep(-0.012, 0.012, x);
            for (const leg of this.legs) {
                const w = total * legness * (leg.sign > 0 ? left : 1 - left);
                if (w <= 1e-4) continue;
                const knee = smoothstep(
                    BODY.lowerLeg[1] + 0.05,
                    BODY.lowerLeg[1] - 0.05,
                    y
                );
                const ankle = smoothstep(
                    BODY.foot[1] + 0.03,
                    BODY.foot[1] - 0.03,
                    y - 0.25 * Math.max(0, z - 0.02)
                );
                const toe =
                    ankle *
                    smoothstep(BODY.toes[2] - 0.02, BODY.toes[2] + 0.02, z);
                out.add(leg.upper, w * (1 - knee));
                out.add(leg.lower, w * knee * (1 - ankle));
                out.add(leg.foot, w * knee * (ankle - toe));
                out.add(leg.toes, w * knee * toe);
            }
        }
        let rest = total * (1 - legness);
        if (rest <= 1e-4) return;
        // The jaw hangs forward of the head joint: tilt the blend plane.
        const headness = smoothstep(
            BODY.head[1] - 0.016,
            BODY.head[1] + 0.02,
            y + 0.55 * z
        );
        out.add(this.index.head, rest * headness);
        rest *= 1 - headness;
        if (rest <= 1e-4) return;
        // Collar bones follow the shoulders a little.
        const collar =
            smoothstep(0.035, 0.13, Math.abs(x)) *
            smoothstep(BODY.upperArm[1] - 0.073, BODY.upperArm[1] - 0.008, y) *
            0.55;
        if (collar > 0) {
            out.add(
                this.index[x > 0 ? "leftShoulder" : "rightShoulder"],
                rest * collar
            );
            rest *= 1 - collar;
        }
        let bone = this.index.hips;
        let remaining = rest;
        for (const link of this.spineChain) {
            const half = link.bone === this.index.neck ? 0.022 : 0.036;
            const up = smoothstep(link.y - half, link.y + half, y);
            out.add(bone, remaining * (1 - up));
            remaining *= up;
            bone = link.bone;
            if (remaining <= 1e-4) return;
        }
        out.add(bone, remaining);
    }
}
