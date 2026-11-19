import { MathUtils } from "three/webgpu";
import { frontOfLoft, type Depth, type Drawing, type Section } from "./drawing";
import type { CartoonDesign } from "./cartoonCast";
import { drawRoundedProfile, type RoundedSection } from "./roundedProfile";
import type { Point } from "./sculpt";

// Frontal width/height of the fitted Sunshine skull oval.
export const sunshineSkullAspect = 60.5 / 61.2;

// Height fraction, sagittal radius and center in skull widths from the neck,
// depth fraction of the cheek tangent, and cross-section exponent. Fitted
// from the classic head's 0°, 35° and 90° isolated silhouettes.
const classic = [
    [0.0, 0.0687, 0.16478, 0.475, 2.0],
    [0.01093, 0.11749, 0.15258, 0.5, 2.0833],
    [0.04323, 0.24771, 0.12165, 0.525, 2.0],
    [0.09549, 0.32952, 0.11007, 0.5, 2.1667],
    [0.16543, 0.3874, 0.1018, 0.575, 2.25],
    [0.25, 0.41794, 0.1018, 0.575, 2.4167],
    [0.34549, 0.42939, 0.10562, 0.625, 2.5],
    [0.44774, 0.4388, 0.12266, 0.55, 2.4167],
    [0.55226, 0.48092, 0.17241, 0.45, 1.3333],
    [0.65451, 0.42557, 0.13997, 0.475, 1.3333],
    [0.75, 0.34733, 0.10371, 0.9, 2.6667],
    [0.83457, 0.35316, 0.15333, 0.75, 2.6667],
    [0.90451, 0.29326, 0.15396, 0.55, 2.1667],
    [0.95677, 0.21794, 0.17814, 0.5, 2.0],
    [0.98907, 0.13815, 0.18768, 0.45, 2.0],
    [1.0, 0.03817, 0.19531, 0.3, 2.0],
];

export function cranialStations(
    g: CartoonDesign,
    outline: Section[]
): RoundedSection[] | undefined {
    const measured = g.fit?.sections?.cranium;
    if (measured) return measured;
    const source = g.parts?.skull ?? (g.parts?.jaw && "classic");
    if (!source) return;
    const jaw = g.parts?.jaw ?? source;
    const top = outline[0][0],
        height = outline.at(-1)[0] - top;
    const width = g.head[0];
    return outline.map(([y, left, right]) => {
        const t = (y - top) / height;
        // Interpolate the two closed sections across the cheek, keeping both
        // the photographed width and the eye sockets above it in place.
        const blend = MathUtils.smoothstep(
            t,
            g.face?.eyeHeight ?? 0.5,
            g.face?.mouthHeight ?? 0.8
        );
        const scientist = MathUtils.lerp(
            Number(source === "classic"),
            Number(jaw === "classic"),
            blend
        );
        const ovalRadius = width * (60.4 / 121) * 2 * Math.sqrt(t * (1 - t));
        const ovalCenter = (-4.58 / 121) * width;
        if (scientist === 0)
            return [y, left, right, ovalRadius, ovalCenter, 0.5, 2];
        let i = 1;
        while (i < classic.length - 1 && classic[i][0] < t) i++;
        const a = classic[i - 1],
            b = classic[i];
        const u = (t - a[0]) / (b[0] - a[0]);
        const at = (k: number) => MathUtils.lerp(a[k], b[k], u);
        const pole = Math.min(
            1,
            Math.sqrt(Math.max(0, Math.min(t, 1 - t)) * 100)
        );
        return [
            y,
            left,
            right,
            MathUtils.lerp(ovalRadius, width * at(1) * pole, scientist),
            MathUtils.lerp(ovalCenter, width * at(2), scientist),
            MathUtils.lerp(0.5, at(3), scientist),
            MathUtils.lerp(2, at(4), scientist),
        ];
    });
}

/** Depth of a normalized anatomical section, before local facial sculpting. */
export function cranialDepth(stations: RoundedSection[], side: 1 | -1): Depth {
    return (x, y) => {
        let i = 1;
        while (i < stations.length - 1 && stations[i][0] < y) i++;
        const a = stations[i - 1],
            b = stations[i];
        const t = MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
        const v = (k: number) => MathUtils.lerp(a[k], b[k], t);
        const left = v(1),
            right = v(2),
            radius = v(3),
            center = v(4),
            widest = v(5),
            power = v(6);
        const tangent = center + radius * (2 * widest - 1);
        const u = Math.min(
            1,
            Math.abs((2 * x - left - right) / Math.max(0.0001, right - left))
        );
        const reach = Math.max(0, 1 - u ** power) ** (1 / power);
        return (
            tangent +
            (side > 0 ? center + radius - tangent : center - radius - tangent) *
                reach
        );
    };
}

export function cranialSurfaces(
    d: Drawing,
    stations: RoundedSection[],
    color: string
) {
    const rings = drawRoundedProfile(d, stations, color);
    const front = frontOfLoft(rings);
    const mirrored = frontOfLoft(
        rings.map((row) => row.map(([x, y, z]): Point => [x, y, -z]))
    );
    // Features may extend beyond a silhouette (ear roots, lashes, hair).
    // Continue from the lateral tangent at that height when there is no hit.
    const tangent = (y: number) => {
        let i = 1;
        while (i < stations.length - 1 && stations[i][0] < y) i++;
        const a = stations[i - 1],
            b = stations[i];
        const z = (row: RoundedSection) => row[4] + row[3] * (2 * row[5] - 1);
        return MathUtils.lerp(
            z(a),
            z(b),
            MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1)
        );
    };
    const attach =
        (projection: Depth, sign: number): Depth =>
        (x, y) => {
            const hit = projection(x, y);
            return Number.isFinite(hit) ? sign * hit : tangent(y);
        };
    return { front: attach(front, 1), back: attach(mirrored, -1) };
}
