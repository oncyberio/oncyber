import * as T from "three/webgpu";
import type { Character } from "./catalog";
import { recipeTransform, type AvatarRecipe } from "./recipes";
import type { Point } from "./sculpt";
import {
    landmarks,
    composition,
    cmPerPixel,
    type Chain,
    type Landmarks,
} from "./referenceLandmarks";
export {
    composition,
    cmPerPixel,
    type Landmarks,
    type OpenHand,
} from "./referenceLandmarks";

export interface ReferenceLayout {
    origin: { x: number; floor: number };
    landmarks: Landmarks;
    eyeLine: number;
}
export type DrawingJoint = {
    name: string;
    parent: string | null;
    point: Point;
    rest: T.Vector3;
    orientation: T.Quaternion;
};
export function drawingRig(
    id: Character,
    recipe: AvatarRecipe = { template: id },
    layout?: ReferenceLayout
) {
    const raw = layout?.landmarks ?? landmarks[id],
        base = layout?.origin ?? composition[id],
        joints = new Map<string, DrawingJoint>();
    const fitPoint = recipeTransform(
        recipe,
        base.x,
        base.floor,
        raw.jaw,
        raw.hip,
        layout?.eyeLine
    );
    const limbs = new Map<
        string,
        { a: Point; b: Point; scale: number; axis: number }
    >();
    if (recipe.limbWidth) {
        ["right", "left"].forEach((side, i) => {
            for (const [kind, chain, scale, axis] of [
                ["Arm", raw.arms[i], recipe.limbWidth.arms, 0],
                ["Leg", raw.legs[i], recipe.limbWidth.legs, 1],
            ] as const) {
                ["Upper", "Lower"].forEach((joint, j) =>
                    limbs.set(side + joint + kind, {
                        a: chain[j],
                        b: chain[j + 1],
                        scale,
                        axis,
                    })
                );
            }
        });
    }
    const transform = (
        point: Point,
        head = false,
        eyes = false,
        crown = false,
        pupil = false,
        part?: string
    ) => {
        let p = point;
        const limb = part && limbs.get(part);
        if (limb) {
            const { a, b, axis, scale } = limb;
            const t = Math.max(
                0,
                Math.min(1, (p[axis] - a[axis]) / (b[axis] - a[axis] || 1))
            );
            p = point.map((v, k) => {
                if (k === axis) return v;
                const mid = a[k] + (b[k] - a[k]) * t;
                return mid + (v - mid) * scale;
            }) as Point;
        } else if (part === "coat" && recipe.coatFit) {
            const { hem, widths } = recipe.coatFit;
            const t = Math.min(3, Math.max(0, ((point[1] - 227) * 3) / 269));
            const lo = Math.floor(t),
                hi = Math.min(3, lo + 1);
            const scale = widths[lo] + (widths[hi] - widths[lo]) * (t - lo);
            const blend = Math.max(0, Math.min(1, (point[1] - 197) / 30));
            p = [
                raw.jaw[0] +
                    (point[0] - raw.jaw[0]) * (1 + (scale - 1) * blend),
                point[1] + Math.max(0, point[1] - 220) * (hem - 1),
                point[2],
            ];
        }
        return fitPoint(p, head, eyes, crown, pupil);
    };
    const move = (p: Point) => fitPoint(p);
    const l: Landmarks = {
        ...raw,
        hip: move(raw.hip),
        neck: move(raw.neck),
        jaw: move(raw.jaw),
        arms: raw.arms.map((c) => c.map(move)) as [Chain, Chain],
        legs: raw.legs.map((c) => c.map(move)) as [Chain, Chain],
        feet: raw.feet.map(move) as [Point, Point],
    };
    const world = ([x, y, z]: Point) =>
        new T.Vector3(
            (x - base.x) * cmPerPixel,
            (base.floor - y) * cmPerPixel,
            z * cmPerPixel
        );
    const direction = (a: Point, b: Point) =>
        world(b).sub(world(a)).normalize();
    const yaw = (angle: number) =>
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), angle);
    const add = (
        name: string,
        parent: string | null,
        point: Point,
        orientation = new T.Quaternion()
    ) => {
        if (raw.restJoints?.[name]) {
            point = move(raw.restJoints[name] as Point);
            orientation = new T.Quaternion();
        }
        const prior = joints.get(parent);
        const rest = prior
            ? world(point)
                  .sub(world(prior.point))
                  .applyQuaternion(prior.orientation.clone().invert())
                  .add(prior.rest)
            : world(point);
        joints.set(name, { name, parent, point, rest, orientation });
    };
    // Upright bind spine. The front study restores the lean visible in the drawing.
    const torso = new T.Quaternion()
        .setFromUnitVectors(new T.Vector3(0, 1, 0), direction(l.hip, l.neck))
        .multiply(yaw(l.torsoYaw));
    const between = (a: Point, b: Point, t: number): Point =>
        a.map((v, i) => v + (b[i] - v) * t) as Point;
    add("hips", null, l.hip, torso);
    add("spine", "hips", between(l.hip, l.neck, 0.32), torso);
    add("chest", "spine", between(l.hip, l.neck, 0.68), torso);
    add("upperChest", "chest", between(l.hip, l.neck, 0.88), torso);
    add("neck", "upperChest", l.neck, torso);
    add(
        "head",
        "neck",
        l.jaw,
        new T.Quaternion().setFromEuler(
            new T.Euler(l.headPitch ?? 0, l.headYaw, l.headRoll ?? 0, "YXZ")
        )
    );
    for (const [i, side] of ["right", "left"].entries()) {
        const sign = i === 0 ? -1 : 1,
            axis = new T.Vector3(sign, 0, 0);
        const [shoulder, elbow, wrist] = l.arms[i],
            [hip, knee, ankle] = l.legs[i];
        const align = (axis: T.Vector3, a: Point, b: Point) =>
            new T.Quaternion().setFromUnitVectors(axis, direction(a, b));
        add(
            side + "Shoulder",
            "upperChest",
            between(l.neck, shoulder, 0.4),
            torso
        );
        add(
            side + "UpperArm",
            side + "Shoulder",
            shoulder,
            align(axis, shoulder, elbow)
        );
        add(
            side + "LowerArm",
            side + "UpperArm",
            elbow,
            align(axis, elbow, wrist)
        );
        const [dx, dy, dz] = l.fingers[i];
        const handDirection = new T.Vector3(dx, -dy, dz).normalize();
        // Face palm toward the reference plane. Local z spans the fingers.
        const spread = l.handScale
            ? new T.Vector3(0, 0, 1)
            : new T.Vector3(-handDirection.y, handDirection.x, 0)
                  .normalize()
                  .multiplyScalar(sign);
        const fan = l.openHands?.[i];
        const roll = fan ? Math.sign(fan[0][3] - fan[3][3]) * 82 : l.palmRoll;
        if (roll !== undefined && l.handScale)
            spread.applyAxisAngle(
                handDirection,
                sign * T.MathUtils.degToRad(roll)
            );
        const handX = handDirection.clone().multiplyScalar(sign),
            handY = spread.clone().cross(handX);
        const handQ = new T.Quaternion().setFromRotationMatrix(
            new T.Matrix4().makeBasis(handX, handY, spread)
        );
        add(side + "Hand", side + "LowerArm", wrist, handQ);
        const fingerPoint = (
            length: number,
            curl: number,
            lateral: number
        ): Point => {
            const v = new T.Vector3(sign * length, curl, lateral)
                .multiplyScalar(l.handScale ?? 1)
                .applyQuaternion(handQ);
            return [wrist[0] + v.x, wrist[1] - v.y, wrist[2] + v.z];
        };
        for (const [f, finger] of [
            "Thumb",
            "Index",
            "Middle",
            "Ring",
            "Little",
        ].entries()) {
            const thumb = f === 0,
                size = [10, 17, 18, 16, 12][f] * (id === "morty" ? 0.82 : 1);
            const names = thumb
                ? ["Metacarpal", "Proximal", "Distal"]
                : ["Proximal", "Intermediate", "Distal"];
            for (let j = 0; j < 3; j++) {
                const t = j / 3,
                    curl = l.grip[i] ? t * t * size * 0.8 : t * t * size * 0.24;
                const point = fingerPoint(
                    (thumb ? 5 : 13) + t * size * (l.grip[i] ? 0.74 : 1),
                    curl,
                    thumb ? 6 + t * 5 : 7 - f * 3.3
                );
                const digit = fan?.[f];
                if (digit) {
                    // Keep the benchmark joint depth and align its projected
                    // chain with the traced knuckle and fingertip. The final
                    // phalanx continues the last segment in drawFittedHand.
                    point[0] =
                        wrist[0] +
                        sign * T.MathUtils.lerp(digit[0], digit[2], t);
                    point[1] =
                        wrist[1] + T.MathUtils.lerp(digit[1], digit[3], t);
                }
                const parent = j ? side + finger + names[j - 1] : side + "Hand";
                add(side + finger + names[j], parent, point, handQ);
            }
        }
        const down = new T.Vector3(0, -1, 0);
        add(side + "UpperLeg", "hips", hip, align(down, hip, knee));
        add(
            side + "LowerLeg",
            side + "UpperLeg",
            knee,
            align(down, knee, ankle)
        );
        add(
            side + "Foot",
            side + "LowerLeg",
            ankle,
            yaw(Math.atan2(l.feet[i][0] - ankle[0], l.feet[i][2] - ankle[2]))
        );
        add(
            side + "Toes",
            side + "Foot",
            l.feet[i],
            joints.get(side + "Foot").orientation
        );
    }
    return { joints, world, landmarks: raw, transform };
}
