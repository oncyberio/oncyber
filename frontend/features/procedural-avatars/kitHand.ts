import * as T from "three/webgpu";
import { type Drawing, type Section } from "./drawing";
import { drawDigit } from "./humanoidParts";
import { composition } from "./referenceLandmarks";
import { kitDigits, type FingerSpread } from "./kitFingerPose";
import type { Point } from "./sculpt";

export interface KitHand {
    /** Radii as fractions of the full drawn figure's height. */
    wristRadius: number;
    padRadius: number;
    /** Upper and lower diffuse luminance relative to the center of the drawn forearm. */
    light?: [number, number];
    spread?: FingerSpread;
    /** Lateral position and width in half-spans from chest center to fingertip. */
    band?: {
        center: number;
        width: number;
        color: string;
        side?: "left" | "right";
    };
}

const stature = composition.sunshine.floor - 10;

/** Continuous forearm and palm. A band replaces a strip of skin on the
 * same surface, and the wrist and thenar pad share the hand's joint weights. */
export function drawKitPalm(
    d: Drawing,
    lowerArm: string,
    forearm: Section[],
    hand: KitHand,
    skin: string
) {
    const side = lowerArm.startsWith("left") ? "left" : "right";
    const sign = side === "left" ? 1 : -1;
    const joint = (part: string) => d.sourceJoints.get(side + part).point;
    const chest = d.sourceJoints.get("upperChest").point[0];
    const at = (x: number) => sign * (x - chest);
    const wrist = joint("Hand"),
        index = joint("IndexProximal"),
        little = joint("LittleProximal");
    const middle = joint("MiddleProximal"),
        distal = joint("MiddleDistal"),
        intermediate = joint("MiddleIntermediate");
    const tip = at(distal[0]) + Math.abs(distal[0] - intermediate[0]);
    const [ex, et, eb, ed, ez = 0] = sign > 0 ? forearm[0] : forearm.at(-1);
    const start = at(ex),
        wx = at(wrist[0]),
        knuckles = at(middle[0]),
        length = knuckles - wx;
    const radius = hand.spread
            ? hand.spread.wrist * (tip - wx)
            : hand.wristRadius * stature,
        finger = hand.padRadius * stature;
    const palmDepth = Math.abs(index[2] - little[2]) / 2 + finger;
    const spreadZ = (index[2] + little[2]) / 2;
    // Each transverse section specifies distance, center Y, height radius,
    // depth radius and center Z in the neutral skeleton's drawing space.
    const rows: [number, number, number, number, number][] = [
        [start, (et + eb) / 2, (eb - et) / 2, ed, ez],
        [
            T.MathUtils.lerp(start, wx, 0.62),
            wrist[1],
            T.MathUtils.lerp((eb - et) / 2, radius, 0.68),
            T.MathUtils.lerp(ed, radius, 0.68),
            wrist[2],
        ],
        [wx, wrist[1], radius, radius, wrist[2]],
        [
            wx + length * 0.3,
            wrist[1],
            radius * 0.98,
            Math.max(radius, palmDepth * 0.8),
            T.MathUtils.lerp(wrist[2], spreadZ, 0.35),
        ],
        [
            wx + length * 0.72,
            middle[1],
            Math.max(finger * 1.15, radius * 0.82),
            palmDepth,
            spreadZ,
        ],
        [knuckles, middle[1], finger * 1.07, palmDepth, spreadZ],
        [
            knuckles + finger * 0.7,
            middle[1],
            finger * 0.86,
            palmDepth * 0.85,
            spreadZ,
        ],
        [knuckles + finger * 1.22, middle[1], 0, 0, spreadZ],
    ];
    if (hand.spread) {
        const top = Math.min(index[1], little[1]);
        const bottom = Math.max(index[1], little[1]);
        const handLength = tip - wx;
        const pad = hand.spread.digits[2][4] * handLength;
        const center = (top + bottom) / 2;
        const half = (bottom - top) / 2 + pad;
        const depth = Math.max(pad * 1.45, radius * 0.7);
        const atPalm = (t: number) => T.MathUtils.lerp(wx, knuckles, t);
        rows.splice(
            3,
            rows.length - 3,
            [
                atPalm(0.42),
                T.MathUtils.lerp(wrist[1], center, 0.45),
                T.MathUtils.lerp(radius, half, 0.55),
                depth,
                wrist[2],
            ],
            [atPalm(0.88), center, half, depth, middle[2]],
            [knuckles + 0.6 * pad, center, half, depth * 0.94, middle[2]],
            [
                knuckles + 1.55 * pad,
                center,
                half * 0.85,
                depth * 0.64,
                middle[2],
            ],
            [knuckles + 2.0 * pad, center, 0, 0, middle[2]]
        );
    }
    const band =
        !hand.band?.side || hand.band.side === side ? hand.band : undefined;
    const bandCenter = band ? tip * band.center : 0;
    const half = band ? tip * band.width * 0.5 : 0;
    const borders = band ? [bandCenter - half, bandCenter + half] : [];
    const join = [
        start,
        ...borders.filter((x) => x > start && x < rows.at(-1)[0]),
        rows.at(-1)[0],
    ];
    const ring = (x: number) => {
        const end = Math.max(
            1,
            rows.findIndex((row) => row[0] >= x)
        );
        const p = rows[end - 1],
            q = rows[end];
        const t = T.MathUtils.clamp((x - p[0]) / (q[0] - p[0]), 0, 1);
        const value = (i: number) => T.MathUtils.lerp(p[i], q[i], t);
        const roll = band
            ? Math.max(0, 1 - (Math.abs(x - bandCenter) / half) ** 4)
            : 0;
        return Array.from({ length: 9 }, (_, i): Point => {
            const angle = (2 * Math.PI * (i % 8)) / 8;
            return [
                chest + sign * x,
                value(1) + (value(2) + 0.12 * radius * roll) * Math.sin(angle),
                value(4) + (value(3) + 0.12 * radius * roll) * Math.cos(angle),
            ];
        });
    };
    d.s.blend = undefined;
    d.s.printUV = undefined;
    d.drape(lowerArm, side + "Hand", 0, 1);
    d.s.drape.weight = (x) =>
        T.MathUtils.smoothstep(at(x), wx - radius * 0.8, wx + length * 0.32);
    d.s.tone = (x, y) => {
        const distance = Math.abs(at(x) - bandCenter);
        const contact = band
            ? 0.15 *
              Math.exp(-((distance - half) ** 2) / (radius * radius * 0.09))
            : 0;
        return (
            1 -
            contact -
            (hand.light
                ? 0
                : 0.12 * T.MathUtils.smoothstep(y - wrist[1], 0, radius))
        );
    };
    for (let i = 1; i < join.length; i++) {
        const first = join[i - 1],
            last = join[i];
        const cuff = !!band && Math.abs((first + last) / 2 - bandCenter) < half;
        const knots = rows
            .map((r) => r[0])
            .filter((x) => first < x && x < last);
        if (cuff) knots.push(bandCenter);
        const rings = [
            first,
            ...Array.from(new Set(knots)).sort((a, b) => a - b),
            last,
        ].map(ring);
        d.s.surface(
            sign > 0 ? rings.reverse() : rings,
            cuff ? band.color : skin,
            true,
            "perimeter"
        );
    }
    d.s.tone = undefined;
    d.s.drape = undefined;
}

/** Carry the rounded Rick fingertip pad on each existing Sunshine phalanx,
 * preserving the original fingertip extent and right-hand attachment basis. */
export function drawKitDigit(
    d: Drawing,
    bone: string,
    path: Point[],
    hand: KitHand,
    skin: string
) {
    const side = bone.startsWith("left") ? "left" : "right";
    const finger = bone
        .slice(side.length)
        .replace(/(Metacarpal|Proximal)$/, "");
    const factors = {
        Thumb: 1.05,
        Index: 0.97,
        Middle: 1,
        Ring: 0.93,
        Little: 0.8,
    };
    let radius = hand.padRadius * stature * factors[finger];
    if (hand.spread) {
        const joint = (name: string) => d.sourceJoints.get(side + name).point;
        const chain =
            finger === "Thumb"
                ? ["Metacarpal", "Proximal", "Distal"]
                : ["Proximal", "Intermediate", "Distal"];
        const [a, b, c] = chain.map((name) => joint(finger + name));
        const end = c.map((n, i) => 2 * n - b[i]) as Point;
        path = [a, b, c, end];
        const ray =
            hand.spread.digits[
                kitDigits.findIndex((digit) => digit === finger)
            ];
        const handLength = Math.abs((end[0] - joint("Hand")[0]) / ray[2]);
        radius = handLength * ray[4];
    }
    const tip = new T.Vector3(...path.at(-1));
    const tangent = tip
        .clone()
        .sub(new T.Vector3(...path.at(-2)))
        .normalize();
    const pad = tip.addScaledVector(tangent, -radius).toArray() as Point;
    drawDigit(
        d,
        side,
        finger,
        [...path.slice(0, -1), pad],
        [radius, radius, radius * 0.98, radius],
        skin,
        radius,
        d.s.detail === "crowd" ? 5 : 7,
        true
    );
}
