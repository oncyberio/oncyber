import * as T from "three/webgpu";
import { type Drawing, type Section } from "./drawing";
import type { Point } from "./sculpt";

/** Widths are projected shoe widths relative to the separation of the two feet. */
export interface KitFootwear {
    knit: string;
    bands: { start: number; end: number; color: string }[];
    rise: number;
    widths: number[];
    upper: string;
    sole: string;
    laces: number[];
    laceInk?: string;
    spread?: [number, number];
}

function sectionRing(row: Section, sides: number, radius = 1): Point[] {
    const [y, left, right, depth, z = 0] = row;
    return Array.from({ length: sides + 1 }, (_, i) => {
        const theta = (2 * Math.PI * (i % sides)) / sides;
        return [
            (left + right) / 2 +
                ((radius * (right - left)) / 2) * Math.sin(theta),
            y,
            z + radius * depth * Math.cos(theta),
        ];
    });
}

/** One shaft crosses the knee. Its rings keep both joint weights during a deep bend. */
export function drawKitLeg(
    d: Drawing,
    bone: string,
    upper: Section[],
    lower: Section[],
    paint: string
) {
    const shin = bone.replace("UpperLeg", "LowerLeg");
    const knee = d.sourceJoints.get(shin).point[1];
    const length = 0.5 * (lower[0][2] - lower[0][1]);
    const rows = [...upper.filter((s) => s[0] < lower[0][0]), ...lower];
    d.drape(bone, shin, knee - length, knee + length);
    const sides = d.s.detail === "crowd" ? 8 : 12;
    d.s.surface(
        rows.map((r) => sectionRing(r, sides)),
        paint,
        true,
        "perimeter"
    );
}

export function drawKitSock(
    d: Drawing,
    bone: string,
    base: Section[],
    fit: KitFootwear,
    floor: number
) {
    const [top, left, right, depth, z] = base[0];
    const center = (left + right) * 0.5;
    const ankle = d.sourceJoints.get(bone.replace("LowerLeg", "Foot")).point;
    const length = (floor - top) * (1 - fit.rise);
    const shoeHeight = floor - top - length;
    const end = 1 + (0.55 * shoeHeight) / length;
    // The cuff wraps around the calf. The buried end follows the foot through ankle flexion.
    d.drape(
        bone,
        bone.replace("LowerLeg", "Foot"),
        top + length * 0.91,
        top + length + shoeHeight * 0.29
    );
    const profile = (t: number): Section => {
        const cuff = 1 - T.MathUtils.smoothstep(t, 0.055, 0.08);
        const radius =
            (right - left) * (0.52 - 0.12 * Math.min(t, 1) + cuff * 0.033);
        const x = T.MathUtils.lerp(center, ankle[0], Math.min(t, 1));
        return [
            top + t * length,
            x - radius,
            x + radius,
            (depth * radius) / ((right - left) * 0.5),
            T.MathUtils.lerp(z ?? 0, ankle[2], Math.min(t, 1)),
        ];
    };
    const stops = [
        ...new Set([0, ...fit.bands.flatMap((b) => [b.start, b.end]), end]),
    ].sort((a, b) => a - b);
    const n = d.s.detail === "crowd" ? 8 : 12;
    d.s.tone = (_, y, zPos) => {
        const t = (y - top) / length;
        const hem = 1 - T.MathUtils.smoothstep(Math.abs(t - 0.08), 0, 0.024);
        return (
            1.01 +
            0.25 *
                T.MathUtils.smoothstep(
                    zPos,
                    ankle[2] - depth,
                    ankle[2] + depth
                ) -
            0.18 * hem -
            0.11 * T.MathUtils.smoothstep(t, 0.93, 1)
        );
    };
    for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1],
            b = stops[i],
            mid = (a + b) * 0.5;
        const pigment =
            fit.bands.find((band) => mid > band.start && mid < band.end)
                ?.color ?? fit.knit;
        const rows = [
            a,
            ...[0.055, 0.08, 0.107, 0.48, 0.91, 1].filter(
                (t) => t > a && t < b
            ),
            b,
        ].map(profile);
        const rings = rows.map((r) => sectionRing(r, n));
        // Only the thickness of the knit is visible around the calf.
        if (i === 1) rings.unshift(sectionRing(rows[0], n, 0.78));
        d.s.surface(rings, pigment, true, "perimeter");
    }
    d.s.tone = undefined;
}

export function drawKitShoe(
    d: Drawing,
    bone: string,
    fit: KitFootwear,
    floor: number,
    cuff: number
) {
    const side = bone.startsWith("left") ? "left" : "right";
    const ankle = d.sourceJoints.get(bone).point;
    const other = d.sourceJoints.get(
        side === "right" ? "leftFoot" : "rightFoot"
    ).point;
    const toes = d.sourceJoints.get(side + "Toes").point;
    const height = (floor - cuff) * fit.rise,
        top = floor - height;
    const halfSpacing = Math.abs(ankle[0] - other[0]) * 0.5;
    const footLength = Math.abs(toes[2] - ankle[2]);
    const radii = fit.widths.map(
        (width) => width * halfSpacing * (fit.spread?.[1] ?? 1)
    );
    const widthLevels = [0, 0.08, 0.28, 0.52, 0.8, 0.94, 1];
    const widths = [radii[0] * 0.42, ...radii, radii[4] * 0.98];
    const halfWidthAt = (t: number) => {
        const i = Math.max(
            1,
            widthLevels.findIndex((s) => s >= t)
        );
        return T.MathUtils.lerp(
            widths[i - 1],
            widths[i],
            (t - widthLevels[i - 1]) / (widthLevels[i] - widthLevels[i - 1])
        );
    };
    // Depth comes from the benchmark ankle and toe. The tongue slopes onto the
    // vamp; the toe box rounds over a projecting sole with a vertical sidewall.
    const stations = [
        [0, 0.3, 0.34],
        [0.08, 0.1, 0.4],
        [0.28, -0.38, 0.61],
        [0.43, -0.45, 0.77],
        [0.54, -0.47, 1.08],
        [0.65, -0.48, 1.22],
        [0.75, -0.48, 1.25],
        [0.8, -0.5, 1.29],
        [0.94, -0.5, 1.3],
        [1, -0.48, 1.27],
    ];
    const profile = (t: number): Section => {
        const i = Math.max(
            1,
            stations.findIndex((row) => row[0] >= t)
        );
        const a = stations[i - 1],
            b = stations[i],
            u = (t - a[0]) / (b[0] - a[0]);
        const back = ankle[2] + footLength * T.MathUtils.lerp(a[1], b[1], u);
        const front = ankle[2] + footLength * T.MathUtils.lerp(a[2], b[2], u);
        const radius = halfWidthAt(t) * (t === 0.75 ? 0.965 : 1);
        return [
            top + t * height,
            ankle[0] - radius,
            ankle[0] + radius,
            (front - back) * 0.5,
            (front + back) * 0.5,
        ];
    };
    const n = d.s.detail === "crowd" ? 8 : 12;
    // The upper and sole meet on the same perimeter. Only the forefoot bends on the toe bone.
    d.drape(bone, side + "Toes", 0, 1);
    d.s.drape.weight = (_, y, z) =>
        0.62 *
        T.MathUtils.smoothstep(
            z,
            ankle[2] + footLength * 0.45,
            toes[2] + footLength * 0.2
        ) *
        T.MathUtils.smoothstep(y, top + height * 0.34, top + height * 0.85);
    const stops = [
        ...new Set([
            ...stations.map((s) => s[0]),
            ...fit.laces.flatMap((t) => [t - 0.022, t, t + 0.022]),
        ]),
    ].sort((a, b) => a - b);
    const laceCoverage = (x: number, t: number, z: number) => {
        const front = T.MathUtils.smoothstep(
            z,
            ankle[2] + 0.08 * footLength,
            ankle[2] + 0.38 * footLength
        );
        const center =
            1 -
            T.MathUtils.smoothstep(
                Math.abs(x - ankle[0]) / radii[1],
                0.48,
                0.78
            );
        const lace = fit.laces.reduce(
            (ink, at) =>
                Math.max(
                    ink,
                    1 - T.MathUtils.smoothstep(Math.abs(t - at), 0.004, 0.022)
                ),
            0
        );
        return front * center * lace;
    };
    d.s.tone = (x, y, z) => {
        const t = (y - top) / height;
        if (t >= 0.8)
            return (
                0.89 +
                0.35 * (1 - T.MathUtils.smoothstep(Math.abs(t - 0.94), 0, 0.14))
            );
        const front = T.MathUtils.smoothstep(
            z,
            ankle[2] + 0.08 * footLength,
            ankle[2] + 0.38 * footLength
        );
        const toe = Math.exp(-(((t - 0.57) / 0.15) ** 2));
        return (
            0.9 +
            front * (0.19 + 0.48 * toe) -
            (fit.laceInk ? 0 : 0.56 * laceCoverage(x, t, z)) -
            0.19 * T.MathUtils.smoothstep(t, 0.68, 0.78)
        );
    };
    // All tongue and vamp samples belong to one skin. Retain the short
    // vertical intervals carrying the observed lace pigment at both LODs.
    const ring = (t: number, cap = false) =>
        sectionRing(profile(t), n, cap ? 0 : 1);
    const previous = d.s.preserveVertex;
    d.s.preserveVertex = (x, y, z) =>
        previous?.(x, y, z) ||
        (z > ankle[2] + 0.12 * footLength &&
            Math.abs(x - ankle[0]) < radii[1] * 0.87 &&
            fit.laces.some((t) => Math.abs((y - top) / height - t) < 0.0221));
    // The outsole changes pigment on the same faces and shares its toe weights.
    // Its edge stays joined to the vamp when the toes bend.
    let upper = [ring(0, true), ...stops.map((t) => ring(t)), ring(1, true)];
    if (fit.laceInk) {
        const seam = 1 + stops.indexOf(0.75);
        d.s.paintMix = {
            color: fit.laceInk,
            amount: (x, y, z) => laceCoverage(x, (y - top) / height, z),
        };
        d.s.surface(upper.slice(0, seam + 1), fit.upper, true, "perimeter");
        upper = upper.slice(seam);
    }
    d.s.paintMix = {
        color: fit.sole,
        amount: (_, y) => T.MathUtils.smoothstep((y - top) / height, 0.75, 0.8),
    };
    d.s.surface(upper, fit.upper, true, "perimeter");
    d.s.paintMix = undefined;
    d.s.preserveVertex = previous;
    d.s.tone = undefined;
}
