import * as T from "three/webgpu";
import type { CartoonDesign, EyeDepth } from "./cartoonCast";
import {
    frontOfLoft,
    headDepth,
    profileDepth,
    sectionPoint,
    type Drawing,
    type Depth,
    type Section,
    type XY,
} from "./drawing";
import { forelockDepth } from "./partedBob";
import {
    cranialDepth,
    cranialStations,
    sunshineSkullAspect,
} from "./cranialBase";
import type { RoundedSection } from "./roundedProfile";
import { turnContours } from "./turnContours";
import {
    classicEyeProjection,
    classicSkullAspect,
    fitSkullDepth,
} from "./humanoidParts";
import type { Point } from "./sculpt";

export function sideAt(g: CartoonDesign, y: number) {
    const rows = g.fit?.sections?.sideGuide?.rows;
    if (!rows) return undefined;
    const top = g.fit.sections.hair?.[0]?.[0] ?? 12;
    const h = g.head[1],
        eye = 12 + h * (g.face?.eyeHeight ?? 0.5);
    const t =
        y < eye ? ((y - top) / (eye - top)) * ((eye - 12) / h) : (y - 12) / h;
    const hi = rows.findIndex((row) => row[0] >= t);
    if (hi < 0) return rows.at(-1);
    if (!hi) return rows[0];
    const a = rows[hi - 1],
        b = rows[hi];
    if (t < 0.15) {
        // Near a spherical pole section area varies linearly with height.
        // Interpolating radius there leaves an angular tip on a rotating crown.
        const u = (t - a[0]) / (b[0] - a[0]);
        const center = T.MathUtils.lerp(
            (a[1] + a[2]) / 2,
            (b[1] + b[2]) / 2,
            u
        );
        const radius = Math.sqrt(
            T.MathUtils.lerp(
                ((a[2] - a[1]) / 2) ** 2,
                ((b[2] - b[1]) / 2) ** 2,
                u
            )
        );
        return [
            t,
            center - radius,
            center + radius,
            T.MathUtils.lerp(a[3], b[3], u),
        ];
    }
    return a.map((v, i) =>
        T.MathUtils.lerp(v, b[i], (t - a[0]) / (b[0] - a[0]))
    );
}
/** The short section of a side part leaves the forehead behind the swept
 * section. The part and the eye set the ends of the temple opening. */
export function partedTemple(g: CartoonDesign, y: number, guide: number[]) {
    const sections = g.fit.sections;
    const part = sections.sidePart;
    if (!part && !sections.sideGuide?.templeEdge) return;
    const opening = sections.hair.find(
        (row) => row[4] - row[3] > g.head[0] * 0.02
    );
    if (!opening) return;
    const root = (opening[3] + opening[4]) / 2;
    const start = opening[0] - g.head[0] * 0.045;
    const end = 12 + g.head[1] * (g.face?.eyeHeight ?? 0.5);
    const u = T.MathUtils.clamp((y - start) / Math.max(1, end - start), 0, 1);
    const brow = sideAt(g, start + (end - start) * 0.78);
    if (!brow) return;
    const maximum = Math.max(
        0,
        (guide[2] - brow[2]) / Math.max(1, (guide[2] - guide[1]) * 0.5)
    );
    const openingWidth = part ? Math.abs(part[0] - root) / g.head[0] : 0;
    const strength = T.MathUtils.smoothstep(openingWidth, 0.025, 0.18);
    const inset =
        T.MathUtils.smoothstep(u, 0, 0.24) *
        (1 - T.MathUtils.smoothstep(u, 0.72, 1)) *
        maximum *
        strength;
    const observed = sections.sideGuide.templeEdge;
    if (observed) {
        const levels = observed.rows;
        const t = (y - 12) / g.head[1];
        const hi = levels.findIndex(([v]) => v >= t);
        const i = hi < 0 ? levels.length - 1 : Math.max(1, hi);
        const a = levels[i - 1],
            b = levels[i];
        const depth = T.MathUtils.lerp(
            a[1],
            b[1],
            T.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1)
        );
        const weight =
            T.MathUtils.smoothstep(t, levels[0][0] - 0.07, levels[0][0]) *
            (1 -
                T.MathUtils.smoothstep(
                    t,
                    levels.at(-1)[0],
                    levels.at(-1)[0] + 0.09
                ));
        const roll = observed.roll;
        if (
            roll &&
            part &&
            (sections.sideGuide.forelockSide ?? observed.side) === observed.side
        ) {
            // Both drawings register crown and eye height before exchanging
            // depths. The fringe root merges into the existing hair cap.
            const top = sections.hair[0][0],
                eyeHeight = g.face?.eyeHeight ?? 0.5;
            const level =
                ((y - top) * eyeHeight) / (12 + g.head[1] * eyeHeight - top);
            const next = roll.findIndex((row) => row[0] >= level);
            const hi = next < 0 ? roll.length - 1 : Math.max(1, next);
            const lower = roll[hi - 1],
                upper = roll[hi];
            const u = T.MathUtils.clamp(
                (level - lower[0]) / (upper[0] - lower[0]),
                0,
                1
            );
            const root = roll[0][0],
                tip = roll.at(-1)[0];
            const attach =
                T.MathUtils.smoothstep(level, root, root + 0.12) *
                (1 - T.MathUtils.smoothstep(level, tip, tip + 0.045));
            return {
                side: observed.side,
                inset,
                depth,
                weight,
                inner: T.MathUtils.lerp(lower[1], upper[1], u),
                outer: T.MathUtils.lerp(lower[2], upper[2], u),
                rollWeight: attach,
            };
        }
        return { side: observed.side, inset, depth, weight };
    }
    return part ? { side: Math.sign(part[0] - root), inset } : undefined;
}
/** Two exposed ears anchor the widest part of a bob across the temples.
 * Its sagittal midpoint can lie well behind that plane on a short front rim. */
export function bobTangent(g: CartoonDesign, y: number, row: number[]) {
    const sections = g.fit.sections;
    const guide = sections.sideGuide;
    if (!guide?.inferred || !guide.ear || sections.ears?.length !== 2) return;
    const [, back, edge] = row;
    const [earZ, earY, earDepth] = guide.ear;
    const center = (edge + back) / 2;
    const reach = T.MathUtils.clamp(
        earZ - earDepth * 0.45,
        center,
        edge - (edge - back) * 0.12
    );
    const blend = T.MathUtils.smoothstep(y, sections.hair[0][0], earY);
    return T.MathUtils.lerp(center, reach, blend);
}
/** Depth around a measured bob. Each front quadrant ends at the actual part
 * in the drawing. Above the part the fringe crosses the sagittal meridian. */
export function bobDepth(
    angle: number,
    first: number,
    last: number,
    guide: number[],
    temple?: ReturnType<typeof partedTemple>,
    tangent?: number
) {
    const back = guide[1],
        edge = guide[2];
    const center = tangent ?? (back + edge) * 0.5;
    const c = Math.cos(angle);
    if (c <= 0) return center + c * (center - back);
    const right = angle < Math.PI / 2;
    const end = right ? first : last - 2 * Math.PI;
    const scale = (right ? end > 0 : end < 0) ? Math.cos(end) : 1;
    const crest = (edge - center) * Math.min(1, c / Math.max(0.01, scale));
    if (!temple || (right ? 1 : -1) !== temple.side) return center + crest;
    const normal = center + crest * (1 - temple.inset);
    if (temple.depth == null) return normal;
    const rim = Math.max(0.02, Math.cos(end));
    return T.MathUtils.lerp(
        normal,
        center + (temple.depth - center) * Math.min(1, c / rim),
        temple.weight
    );
}

/** Fit the two observed oblique tangents at each crown height. Deform only
 * inside the existing frontal and sagittal spans so both original silhouettes survive. */
export function turnCrown(
    g: CartoonDesign,
    outer: Point[][],
    inside: Point[][]
) {
    const marks = g.fit.sections.sideGuide?.turnedCrown;
    if (!marks) return;
    const angle = T.MathUtils.degToRad(35),
        c = Math.cos(angle),
        s = Math.sin(angle);
    outer.forEach((ring, i) => {
        const t = (ring[0][1] - 12) / g.head[1];
        if (t < marks[0][0] - 0.1 || t > marks.at(-1)[0] + 0.1) return;
        const next = marks.findIndex((row) => row[0] >= t);
        const hi = next < 0 ? marks.length - 1 : Math.max(next, 1);
        const a = marks[hi - 1],
            b = marks[hi];
        const blend = T.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
        const support = ring.map(([x, , z]) => c * x + s * z);
        const low = Math.min(...support),
            high = Math.max(...support);
        const dx0 = T.MathUtils.lerp(a[1], b[1], blend) - low,
            dx1 = T.MathUtils.lerp(a[2], b[2], blend) - high;
        const xs = ring.map((p) => p[0]),
            zs = ring.map((p) => p[2]);
        const x0 = Math.min(...xs),
            x1 = Math.max(...xs),
            z0 = Math.min(...zs),
            z1 = Math.max(...zs);
        if (high - low < 1 || Math.min(x1 - x0, z1 - z0) < 1) return;
        const extent = Math.min(x1 - x0, z1 - z0);
        const fade =
            T.MathUtils.smoothstep(t, marks[0][0] - 0.1, marks[0][0]) *
            (1 -
                T.MathUtils.smoothstep(
                    t,
                    marks.at(-1)[0],
                    marks.at(-1)[0] + 0.1
                ));
        for (let j = 0; j < ring.length; j++) {
            const [x, , z] = ring[j];
            const ux = (x - x0) / (x1 - x0),
                uz = (z - z0) / (z1 - z0);
            // Pin the hairline sewn to the face, and the extrema of each measured axis.
            const seam = T.MathUtils.smoothstep(
                Math.min(j, ring.length - 1 - j),
                0,
                3
            );
            const wx = 4 * ux * (1 - ux),
                wz = 4 * uz * (1 - uz);
            const error = T.MathUtils.lerp(
                dx0,
                dx1,
                (support[j] - low) / (high - low)
            );
            const move =
                fade *
                seam *
                T.MathUtils.clamp(
                    error / Math.max(0.01, c * c * wx + s * s * wz),
                    -extent * 0.19,
                    extent * 0.19
                );
            const xShift = c * wx * move,
                zShift = s * wz * move;
            for (const p of [ring[j], inside[i][j]]) {
                p[0] += xShift;
                p[2] += zShift;
            }
        }
    });
}

/** Fit the rear tangent of the turned bob while retaining the X and Z
 * extrema measured in the other two views. Both sides of its hem move together. */
export function fitBobBack(
    g: CartoonDesign,
    outer: Point[][],
    inner: Point[][]
) {
    const guide = g.fit.sections.sideGuide?.turnedBack;
    if (!guide) return;
    const angle = T.MathUtils.degToRad(35),
        c = Math.cos(angle),
        s = Math.sin(angle);
    outer.forEach((row, i) => {
        const px = (p: Point) => c * p[0] + s * p[2];
        const rear = row.reduce((a, b) => (px(a) < px(b) ? a : b));
        const t = (rear[1] - 12) / g.head[1];
        if (t <= guide[0][0] - 0.05 || t >= guide.at(-1)[0] + 0.05) return;
        const hi = guide.findIndex(([y]) => y >= t);
        const j = hi < 0 ? guide.length - 1 : Math.max(1, hi);
        const a = guide[j - 1],
            b = guide[j];
        const target = T.MathUtils.lerp(
            a[1],
            b[1],
            T.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1)
        );
        const xs = row.map((p) => p[0]),
            zs = row.map((p) => p[2]);
        const x0 = Math.min(...xs),
            x1 = Math.max(...xs),
            z0 = Math.min(...zs),
            z1 = Math.max(...zs);
        const width = x1 - x0,
            span = z1 - z0;
        if (Math.min(width, span) < 1) return;
        const weights = row.map(([x, , z], k) => {
            const u = (x - x0) / width,
                v = (z - z0) / span;
            const flank =
                (1 - T.MathUtils.smoothstep(u, 0.38, 0.7)) *
                (1 - T.MathUtils.smoothstep(v, 0.45, 0.78)) *
                T.MathUtils.smoothstep(Math.min(k, row.length - 1 - k), 0, 2);
            return [c * flank * 4 * u * (1 - u), s * flank * 4 * v * (1 - v)];
        });
        const shifted = (p: Point, k: number, delta: number) => [
            T.MathUtils.clamp(p[0] + weights[k][0] * delta, x0, x1),
            T.MathUtils.clamp(p[2] + weights[k][1] * delta, z0, z1),
        ];
        const limit = Math.min(width, span) * 0.34;
        let lo = -limit,
            high = limit;
        for (let iter = 0; iter < 12; iter++) {
            const delta = (lo + high) / 2;
            const actual = Math.min(
                ...row.map((p, k) => {
                    const [x, z] = shifted(p, k, delta);
                    return c * x + s * z;
                })
            );
            if (actual < target) lo = delta;
            else high = delta;
        }
        const fade =
            T.MathUtils.smoothstep(t, guide[0][0] - 0.05, guide[0][0]) *
            (1 -
                T.MathUtils.smoothstep(
                    t,
                    guide.at(-1)[0],
                    guide.at(-1)[0] + 0.05
                ));
        row.forEach((p, k) => {
            const [x, z] = shifted(p, k, (lo + high) * 0.5 * fade);
            inner[i][k][0] += x - p[0];
            inner[i][k][2] += z - p[2];
            p[0] = x;
            p[2] = z;
        });
    });
}

/** Fit the support of each lock in the intermediate view. The x coordinates
 * keep their T-pose silhouette and the back meridian and fringe stay sewn. */
export function turnBobLocks(
    g: CartoonDesign,
    outer: Point[][],
    inside: Point[][]
) {
    const marks = g.fit.sections.sideGuide?.turnedHair;
    if (!marks) return;
    const angle = (35 * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
    // The near lock has already been fitted to the side portrait. Only its
    // opposite can swing forward behind the cheek in the intermediate view.
    const offsets = outer.map((ring) => {
        // The nape and outer lock have different hem heights. Register this
        // tangent at its final height after the hair has been draped.
        const rim = ring.reduce((a, b) =>
            c * a[0] + s * a[2] > c * b[0] + s * b[2] ? a : b
        );
        const t = (rim[1] - 12) / g.head[1];
        const next = marks.findIndex((row) => row[0] >= t);
        const hi = next < 0 ? marks.length - 1 : Math.max(1, next);
        const a = marks[hi - 1],
            b = marks[hi];
        const target = T.MathUtils.lerp(
            a[1],
            b[1],
            T.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1)
        );
        const fade =
            T.MathUtils.smoothstep(
                t,
                Math.max(0.45, marks[0][0] - 0.03),
                Math.max(0.72, marks[0][0] + 0.13)
            ) *
            (1 -
                T.MathUtils.smoothstep(
                    t,
                    marks.at(-1)[0],
                    marks.at(-1)[0] + 0.09
                ));
        const xs = ring.map((p) => p[0]),
            min = Math.min(...xs),
            max = Math.max(...xs);
        const mid = (min + max) / 2,
            radius = Math.max(0.1, (max - min) / 2);
        const weights = xs.map(
            (x, j) =>
                T.MathUtils.smoothstep((x - mid) / radius, 0.05, 0.88) *
                T.MathUtils.smoothstep(Math.min(j, ring.length - 1 - j), 0, 3)
        );
        const tangent = (shift: number) =>
            Math.max(
                ...ring.map(
                    ([x, , z], j) => c * x + s * (z + shift * weights[j])
                )
            );
        const initial = tangent(0),
            direction = Math.sign(target - initial),
            limit = radius * 0.65;
        const attainable = Math.min(
            Math.abs(target - initial),
            Math.abs(tangent(direction * limit) - initial)
        );
        let lo = 0,
            high = limit;
        for (let step = 0; step < 12; step++) {
            const amount = (lo + high) * 0.5;
            if (
                Math.abs(tangent(direction * amount) - initial) <
                attainable - 0.025
            )
                lo = amount;
            else high = amount;
        }
        return { shift: direction * high * fade, weights };
    });
    offsets.forEach(({ weights }, i) => {
        const shift =
            [1, 4, 6, 4, 1].reduce(
                (acc, w, j) =>
                    acc +
                    w *
                        offsets[
                            T.MathUtils.clamp(i + j - 2, 0, offsets.length - 1)
                        ].shift,
                0
            ) / 16;
        for (let j = 0; j < weights.length; j++) {
            outer[i][j][2] += shift * weights[j];
            inside[i][j][2] += shift * weights[j];
        }
    });
}

export function headSections(g: CartoonDesign): Section[] {
    const [w, h] = g.head;
    const taper =
        g.face?.chinTaper ??
        { round: 0.018, oval: 0.11, long: 0.15, square: 0.055 }[g.skull];
    const power = g.skull === "square" ? 0.78 : g.skull === "long" ? 0.88 : 1;
    const rows: Section[] = Array.from({ length: 19 }, (_, i) => {
        const a = (Math.PI * i) / 18,
            t = (1 - Math.cos(a)) * 0.5;
        let radius =
            Math.sin(a) ** power *
            (1 - taper * T.MathUtils.smoothstep(t, 0.58, 0.97)) *
            (1 +
                ((g.face?.jawWidth ?? 1) - 1) *
                    Math.exp(-((t - 0.8) ** 2) / 0.022));
        if (g.household) {
            const widths = g.household.widths;
            const pos = t * (widths.length - 1),
                lo = Math.floor(pos);
            // Cross-sectional area approaches zero smoothly at each pole.
            radius = Math.sqrt(
                T.MathUtils.lerp(
                    widths[lo] ** 2,
                    widths[Math.min(lo + 1, widths.length - 1)] ** 2,
                    pos - lo
                )
            );
        }
        const y =
                12 +
                h * (t + (g.fit?.sections?.nape ? 0.115 * (1 - t) ** 2.5 : 0)),
            jaw = g.fit?.sections?.jaw;
        if (jaw && y >= jaw[0][0] && y < jaw.at(-1)[0]) {
            const i = jaw.findIndex((r) => r[0] >= y);
            const high = jaw[i],
                low = jaw[Math.max(0, i - 1)];
            const f = (y - low[0]) / Math.max(0.001, high[0] - low[0]);
            let blend = T.MathUtils.smoothstep(
                y,
                jaw[0][0],
                jaw[0][0] + h * 0.09
            );
            // If a wide neck shares the cheek pigment, the last measured row
            // contains neck too. Round the underside back toward the chin.
            const end = jaw.at(-1);
            if (end[2] - end[1] > w * 0.4)
                blend *= 1 - T.MathUtils.smoothstep(t, 0.85, 0.995);
            const left = T.MathUtils.lerp(
                -w * radius * 0.5,
                T.MathUtils.lerp(low[1], high[1], f),
                blend
            );
            const right = T.MathUtils.lerp(
                w * radius * 0.5,
                T.MathUtils.lerp(low[2], high[2], f),
                blend
            );
            return [y, left, right, w * 0.45 * radius, (t - 0.5) * 4];
        }
        return [
            y,
            -w * 0.5 * radius,
            w * 0.5 * radius,
            w * 0.45 * radius,
            (t - 0.5) * 4,
        ];
    });
    if (!g.fit?.sections?.jaw) return rows;
    const chinInk = g.fit.sections.chin;
    if (chinInk?.length) {
        // The skin underneath the chin continues down the neck in a T-pose.
        // Recover the mandible from its curved ink instead of tracing that neck
        // as the right or left corner of the jaw.
        const chin = chinInk.reduce((a, b) => (a[1] > b[1] ? a : b));
        const samples = chinInk.filter(
            ([x, y]) => chin[1] - y > h * 0.018 && chin[1] - y < h * 0.17
        );
        if (samples.length) {
            const radii = samples
                .map(([x, y]) => Math.abs(x - chin[0]) / Math.sqrt(chin[1] - y))
                .sort((a, b) => a - b);
            const radius = radii[Math.floor(radii.length / 2)];
            for (const row of rows) {
                const weight = T.MathUtils.smoothstep(
                    row[0],
                    12 + h * 0.865,
                    12 + h * 0.978
                );
                const half = radius * Math.sqrt(Math.max(0, 12 + h - row[0]));
                row[1] = T.MathUtils.lerp(row[1], chin[0] - half, weight);
                row[2] = T.MathUtils.lerp(row[2], chin[0] + half, weight);
            }
        }
    }
    const fitted = fitSkullDepth(rows, w);
    for (const row of fitted) {
        const side = sideAt(g, row[0]);
        if (!side) break;
        const ratio = headDepth(row[0], rows, -1, 1);
        const tail = T.MathUtils.smoothstep((row[0] - 12) / h, 0.88, 1);
        const floor = g.fit.sections.sideGuide?.chinFloor;
        let front = side[3];
        let rear = T.MathUtils.lerp(
            Math.max(side[1] + w * 0.03, row[4] + row[3] * ratio),
            front,
            tail ** 7
        );
        if (floor && row[0] >= floor.at(-1)[1]) {
            // Intersect the sagittal chin outline at the same latitude as
            // the frontal jaw. Its underside returns to the throat, while
            // its anterior tangent continues forward of the neck.
            const cuts: number[] = [];
            for (let i = 1; i < floor.length; i++) {
                const [za, ya] = floor[i - 1],
                    [zb, yb] = floor[i];
                if (
                    row[0] < Math.min(ya, yb) - 0.02 ||
                    row[0] > Math.max(ya, yb) + 0.02
                )
                    continue;
                const t =
                    ya === yb
                        ? 0.5
                        : T.MathUtils.clamp((row[0] - ya) / (yb - ya), 0, 1);
                cuts.push(T.MathUtils.lerp(za, zb, t));
            }
            if (cuts.length) {
                front = Math.max(...cuts);
                const throat =
                    cuts.length > 1 ? Math.min(...cuts) : floor[0][0];
                rear = T.MathUtils.lerp(
                    rear,
                    throat,
                    T.MathUtils.smoothstep(
                        row[0],
                        floor[0][1] - h * 0.045,
                        floor[0][1]
                    )
                );
            }
        }
        row[3] = Math.max(0, (front - rear) / (1 - ratio));
        row[4] = front - row[3];
    }
    return fitted;
}
/** Position a pinna between its frontal and sagittal measurements. */
export function fittedEar(g: CartoonDesign, side: number) {
    const [w] = g.head;
    const lobes = g.fit?.sections?.ears;
    const guide = g.fit?.sections?.sideGuide;
    const visible = lobes?.find(([x]) => Math.sign(x) === side);
    const other = guide && lobes?.[0];
    const lobe =
        visible ??
        (other ? [side * w * 0.405, other[1], other[2], other[3]] : undefined);
    if (!lobe) return undefined;
    const [x, fy, rx, fry] = lobe;
    const observed = guide?.ear;
    const y = observed ? T.MathUtils.lerp(fy, observed[1], 0.65) : fy;
    const ry = observed ? T.MathUtils.lerp(fry, observed[3], 0.55) : fry;
    const root = Math.min(Math.abs(x) - rx * 0.46, w * 0.44);
    let reach = Math.max(1, Math.abs(x) + rx - root);
    const edge = sideAt(g, y);
    const depth = observed
        ? observed[2]
        : edge
        ? Math.max(rx * 1.14, w * 0.125)
        : Math.max(rx * 0.65, w * (g.household?.depth ? 0.103 : 0.058));
    const z = observed
        ? observed[0]
        : edge
        ? edge[2] + depth * 0.7
        : g.fit?.sections?.nape
        ? w * 0.18
        : w * (g.household?.ears ? 0.025 : 0.085);
    if (side < 0 && !visible && guide?.turnedEar != null) {
        // Support of the sagittal ear ellipse in the oblique drawing. Its
        // frontal position is unconstrained when the bob hides this lobe.
        const a = T.MathUtils.degToRad(35),
            c = Math.cos(a),
            s = Math.sin(a);
        const tangent = s * z - guide.turnedEar - c * root;
        const fittedReach =
            Math.sqrt(Math.max(0, tangent * tangent - (s * depth) ** 2)) / c;
        // Keep the root joined to the temple. Even an oblique portrait
        // cannot expose a lobe that the frontal hairline covers.
        reach = T.MathUtils.clamp(
            fittedReach,
            reach - rx * 0.35,
            reach + rx * 0.35
        );
    }
    return { visible, y, ry, rx, root, reach, depth, z, observed };
}

/** The ear interrupts the visible hairline in both drawings. Continue the
 * temple behind the pinna between its two roots before drawing the ear. */
export function hairBehindEars(g: CartoonDesign): CartoonDesign {
    const sections = g.fit?.sections;
    const ear = sections?.sideGuide?.ear;
    if (!ear || !sections.ears?.length || !sections.nape || !sections.hair)
        return g;
    const bridgeOpening = <R extends number[]>(
        rows: R[],
        col: number,
        center: number,
        radius: number,
        direction: number
    ): R[] => {
        const above = rows.filter((r) => r[0] <= center - radius).at(-1);
        const below = rows.find((r) => r[0] >= center + radius);
        if (!above || !below) return rows;
        return rows.map((row) => {
            const y = row[0];
            if (y <= above[0] || y >= below[0]) return row;
            const tangent = T.MathUtils.lerp(
                above[col],
                below[col],
                (y - above[0]) / (below[0] - above[0])
            );
            const copy = [...row] as R;
            copy[col] =
                direction > 0
                    ? Math.min(row[col], tangent)
                    : Math.max(row[col], tangent);
            return copy;
        });
    };
    let hair = sections.hair;
    for (const [x, y, , ry] of sections.ears) {
        hair = bridgeOpening(hair, x > 0 ? 4 : 3, y, ry, Math.sign(x));
    }
    const rows = bridgeOpening(
        sections.sideGuide.rows,
        2,
        (ear[1] - 12) / g.head[1],
        ear[3] / g.head[1],
        -1
    );
    return {
        ...g,
        fit: {
            ...g.fit,
            sections: {
                ...sections,
                hair,
                sideGuide: { ...sections.sideGuide, rows },
            },
        },
    };
}

/** Stretch the visible globe forward from its posterior rim. The pupil, lid
 * and skin socket remain registered to the same sagittal sections. */
export function scaleEyeDepth<T extends EyeDepth>(orbit: T, scale = 1): T {
    if (scale === 1 || orbit?.eyeCenter == null || !orbit.eyeSpan) return orbit;
    const back = orbit.eyeCenter - orbit.eyeSpan / 2;
    const project = (z: number) => back + (z - back) * scale;
    return {
        ...orbit,
        eyeCenter: project(orbit.eyeCenter),
        eyeSpan: orbit.eyeSpan * scale,
        pupilDepth:
            orbit.pupilDepth == null ? undefined : project(orbit.pupilDepth),
        lidSpan: orbit.lidSpan?.map(project),
        eyeRows: orbit.eyeRows?.map(([y, rear, front]) => [
            y,
            project(rear),
            project(front),
        ]),
    };
}

/** Both sockets use one sagittal plane even when a T-pose turns the face.
 * Rick's exposed side opening measures three quarters of its frontal width. */
export function fittedOrbits(g: CartoonDesign, base: Depth) {
    const sections = g.fit?.sections;
    if (sections?.eyes?.length !== 2) return undefined;
    const eyes = sections.eyes.map(({ rim }) => {
        const xs = rim.map((p) => p[0]),
            ys = rim.map((p) => p[1]);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2,
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
        };
    });
    const axis = (eyes[0].x + eyes[1].x) / 2,
        height = (eyes[0].y + eyes[1].y) / 2;
    const width = (eyes[0].width + eyes[1].width) / 2;
    const guide = sections.sideGuide;
    const eyeSpan = guide?.eyeSpan ?? width * 0.75;
    return {
        axis,
        height,
        width,
        // When both whites expose nearly the full globe they directly bound
        // its sagittal section. A narrow lid or an occluding lock hides that cue.
        roundPair:
            eyes.every(
                (e) =>
                    Math.min(e.width, e.height) >=
                    Math.max(e.width, e.height) * 0.82
            ) &&
            Math.min(eyes[0].width, eyes[1].width) >=
                Math.max(eyes[0].width, eyes[1].width) * 0.84,
        halfSpacing: (eyes[1].x - eyes[0].x) / 2,
        eyeSpan,
        eyeCenter:
            guide?.eyeCenter ??
            (sections.nape && sections.hair
                ? base(axis, height) - eyeSpan * 0.6
                : base(axis, height) +
                  width * classicEyeProjection -
                  eyeSpan * 0.5),
        pupilDepth: guide?.pupilDepth,
        eyeRows: guide?.eyeRows,
        lidSpan: guide?.lidSpan,
    };
}

/** A drawn nasal stroke marks the edge of one continuous facial relief. */
export function fittedNose(g: CartoonDesign) {
    const traced = g.fit?.sections?.nose;
    if (!traced) return undefined;
    const w = g.head[0];
    const xs = traced.stroke.map(([x]) => x);
    const width = Math.max(...xs) - Math.min(...xs);
    const mid = (Math.max(...xs) + Math.min(...xs)) * 0.5;
    const stroke: XY[] = traced.stroke.map(([x, y]) => [
        mid + (x - mid) * (g.face?.noseWidth ?? 1),
        y,
    ]);
    const root = stroke[0],
        end = stroke.at(-1);
    const height = Math.max(1, ...stroke.map((p) => p[1] - root[1]));
    const side = end[0] >= mid ? 1 : -1;
    const tip = stroke.reduce((a, b) => (side * b[0] < side * a[0] ? b : a));
    // When both ends of the ink turn up around the nostrils, it describes
    // the underside. Its width measures the alae, not the nose projection.
    const underside =
        width > height * 1.5 && Math.abs(root[1] - end[1]) < height * 0.45;
    const contour = g.fit.sections.sideGuide?.noseProfile;
    const lo = contour
            ? 12 + contour[0][0] * g.head[1]
            : root[1] - (underside ? width * 0.68 : height * 0.13),
        hi = contour
            ? 12 + contour.at(-1)[0] * g.head[1]
            : root[1] + height * 1.13;
    const bottom = root[1] + height;
    const amp =
        g.fit?.sections?.sideGuide?.noseRise ??
        Math.min(
            w * (g.household ? 0.085 : 0.15),
            width *
                (underside ? 0.48 : Math.min(1.34, height / Math.max(1, width)))
        ) * (g.face?.noseProjection ?? 1);
    const projection =
        g.household?.depth && !contour
            ? Math.max(
                  amp,
                  Math.min(w * 0.135, height * 0.58) *
                      (g.face?.noseProjection ?? 1)
              )
            : amp;
    const center = (y: number) =>
        underside
            ? mid
            : T.MathUtils.lerp(
                  root[0],
                  tip[0] + side * width * 0.47,
                  T.MathUtils.smoothstep(y, lo, bottom)
              );
    const lift = (x: number, y: number) => {
        const axis = center(y);
        const t = T.MathUtils.clamp((y - lo) / (hi - lo), 0, 1);
        const rise =
            T.MathUtils.smoothstep(t, 0, 0.7) *
            (1 - T.MathUtils.smoothstep(t, 0.7, 1));
        const broad = 0.52 + 0.56 * rise;
        const lateral =
            (x - axis) /
            (width *
                broad *
                (underside ? 0.58 : side * (x - axis) > 0 ? 1.35 : 0.92));
        let depth = projection * rise;
        if (contour) {
            const v = (y - 12) / g.head[1];
            const index = contour.findIndex((r) => r[0] >= v);
            if (index < 1) return 0;
            const a = contour[index - 1],
                b = contour[index];
            depth = T.MathUtils.lerp(a[1], b[1], (v - a[0]) / (b[0] - a[0]));
        }
        return depth * Math.max(0, 1 - lateral * lateral) ** 2;
    };
    return { lift, stroke, hi, lo, center, width };
}

/** For a lone T-pose, derive sagittal stations from the benchmark cranium
 * and the drawn widths of the bob. A supplied profile takes precedence. */
export function fitBobDepth(g: CartoonDesign): CartoonDesign {
    const fit = g.fit,
        parts = fit?.sections;
    if (parts?.sideGuide || !parts?.nape || !parts.hair || !parts.jaw) return g;
    const head = headSections(g);
    if (!g.parts?.skull && !parts.cranium) {
        const aspect = g.head[0] / (head.at(-1)[0] - head[0][0]);
        if (
            Math.abs(aspect - sunshineSkullAspect) <
            Math.abs(aspect - classicSkullAspect)
        ) {
            // A drawn human chin retains the forward mandible beneath the round vault.
            const jaw =
                g.parts?.jaw ??
                (parts.chin?.length && parts.nose ? "classic" : undefined);
            g = { ...g, parts: { ...g.parts, skull: "sunshine", jaw } };
        }
    }
    // The cap, eyes and visible face need the same skull and neck origin.
    // Otherwise an explicitly round base still inherits the scientist's bridge.
    const registered = cranialStations(g, head);
    const front = registered
        ? cranialDepth(registered, 1)
        : profileDepth(head, 1, true);
    const rear = registered
        ? cranialDepth(registered, -1)
        : profileDepth(head, -1, true);
    const eyes = fittedOrbits(g, front);
    if (!eyes) return g;
    const h = g.head[1],
        w = g.head[0],
        hair = parts.hair,
        top = hair[0][0];
    const nose = fittedNose(g);
    const eyeHeight = g.face?.eyeHeight ?? 0.5;
    const eyeY = 12 + h * eyeHeight;
    const last = 12 + h;
    if (top >= eyeY || eyeY >= last) return g;
    const levels = hair.filter(([y]) => y < last);
    const lastRow = hair.at(-1);
    const stations = [...levels, [last, ...lastRow.slice(1)]];
    const rows = stations.map(
        ([y, left, right, innerLeft, innerRight]): [
            number,
            number,
            number,
            number
        ] => {
            // Use the identical crown/eye registration as sideAt. Sampling
            // the next station biases short rings towards the row below them.
            const t =
                y < eyeY
                    ? ((y - top) / (eyeY - top)) * eyeHeight
                    : (y - 12) / h;
            const x = sectionPoint(head, 0, y)[0];
            const radius = (right - left) * 0.5;
            const back = Math.min(rear(x, y) - radius * 0.17, -radius * 0.87);
            const forehead = front(x, y);
            const mid = (right + left) / 2;
            // At a closed row the crown reaches the front meridian. As the
            // part opens, the inner rim lies farther around that same ellipse.
            const nearEdge =
                innerLeft <= mid && mid <= innerRight
                    ? Math.min(mid - innerLeft, innerRight - mid)
                    : 0;
            const chord = Math.sqrt(
                Math.max(0, 1 - (nearEdge / Math.max(1, radius)) ** 2)
            );
            const vault = radius * 0.94;
            const temple = T.MathUtils.smoothstep(
                t,
                eyeHeight * 0.5,
                eyeHeight * 1.01
            );
            const edge = T.MathUtils.lerp(
                vault * chord,
                -radius * 0.12,
                temple
            );
            return [t, back, edge, forehead];
        }
    );
    // The ear sits halfway between the covered occiput and the exposed cheek.
    // Its frontal lobe constrains the height and scale of the side opening.
    const lobe =
        parts.ears?.length &&
        parts.ears.reduce((a, b) => (a[2] * a[3] >= b[2] * b[3] ? a : b));
    const temple =
        lobe &&
        rows.reduce((a, b) => {
            const at = (lobe[1] - top) / (12 + h - top);
            return Math.abs(a[0] - at) < Math.abs(b[0] - at) ? a : b;
        });
    const ear: [number, number, number, number] | undefined = lobe
        ? [
              (temple[1] + temple[3]) * 0.5,
              lobe[1],
              Math.sqrt(lobe[2] * lobe[3]),
              lobe[3],
          ]
        : undefined;
    const smile = parts.mouth;
    let mouthCorner: XY | undefined;
    if (smile?.expression === "smile" && !smile.color && g.mouth === "smile") {
        const a = smile.rows[0],
            b = smile.rows.at(-1);
        const r = (b[0] - a[0]) / 2,
            low = Math.max(...smile.rows.map((p) => p[1]));
        // The closed smile wraps around the muzzle. Use its drawn half-width
        // as the arc radius when no view supplies the commissure depth.
        mouthCorner = [
            front((a[0] + b[0]) / 2, low) - r,
            0.8 * (low - Math.min(a[1], b[1])),
        ];
    }
    const rise = nose
        ? Math.max(
              ...Array.from({ length: 12 }, (_, i) => {
                  const y = T.MathUtils.lerp(nose.lo, nose.hi, i / 11);
                  return nose.lift(nose.center(y), y);
              })
          )
        : w * 0.1;
    return {
        ...g,
        fit: {
            ...fit,
            sections: {
                ...parts,
                sideGuide: {
                    inferred: true,
                    rows,
                    noseRise: rise,
                    mouthCorner,
                    eyeSpan: eyes.eyeSpan,
                    eyeCenter: eyes.eyeCenter,
                    ear,
                },
            },
        },
    };
}

/** When the frontal drawing trails off on the side hidden by hair, the
 * anatomical corner can continue around the cheek, visible on a turn. */
export function coveredSmileWidth(
    g: CartoonDesign,
    side: number,
    half: number
) {
    const parts = g.fit.sections;
    const lobes = parts.ears;
    if (lobes?.length !== 1 || Math.sign(lobes[0][0]) === side) return half;
    const rows = parts.mouth.rows;
    const a = rows[0][1],
        b = rows.at(-1)[1],
        low = Math.max(...rows.map((p) => p[1]));
    const flatEnd = side < 0 ? a - b : b - a;
    return (
        half *
        (1 +
            0.65 *
                T.MathUtils.clamp(
                    flatEnd / Math.max(1, low - Math.min(a, b)),
                    0,
                    1
                ))
    );
}

/** Reconstruct the mandibular angle hidden by a bob. With one frontal
 * portrait, the lobe and chin bound the missing side of the jaw. */
export function mandibularEdge(
    g: CartoonDesign,
    sections: Section[]
): [number, number, number][] | undefined {
    const parts = g.fit?.sections;
    const guide = parts?.sideGuide;
    const observed = guide?.jawEdge;
    if (observed?.every((row) => row[2] != null))
        return observed.map(([t, z, x]) => [t, z, x]);
    if (!guide?.ear || parts.ears?.length !== 1 || !parts.chin?.length) return;
    const [earX, , rx] = parts.ears[0];
    const [z, y, rz, ry] = guide.ear;
    const side = -Math.sign(earX);
    const h = g.head[1];
    const chin = parts.chin.reduce((a, b) => (a[1] > b[1] ? a : b));
    const crownToChin = 12 + h;
    const start = T.MathUtils.clamp((y + ry - 12) / h, 0.62, 0.86);
    const nearEar = side * (Math.abs(earX) - 0.24 * rx);
    const chinZ = sectionPoint(sections, 0, crownToChin)[2];
    const levels =
        observed?.map(([t]) => t) ??
        Array.from({ length: 8 }, (_, i) =>
            T.MathUtils.lerp(start, 0.946, i / 7)
        );
    return levels.map((t, i) => {
        const u = T.MathUtils.clamp((t - start) / (1 - start), 0, 1);
        const x = T.MathUtils.lerp(chin[0], nearEar, Math.sqrt(1 - u));
        const depth =
            observed?.[i][1] ?? T.MathUtils.lerp(z - rz * 0.12, chinZ, u ** 6);
        return [t, depth, x];
    });
}

/** The hair roots and exposed face share the same closed cranium. Splitting each
 * ring at the drawn hairline keeps skin from peeking through a turning fringe. */
export function drawBobHead(
    d: Drawing,
    g: CartoonDesign,
    sections: Section[],
    orbits: ReturnType<typeof fittedOrbits>,
    cranium?: RoundedSection[]
) {
    const hair = g.fit.sections.hair;
    const base = cranium
            ? cranialDepth(cranium, 1)
            : profileDepth(sections, 1, true),
        rear = cranium
            ? cranialDepth(cranium, -1)
            : profileDepth(sections, -1, true);
    const guided = g.fit.sections.sideGuide;
    const nasal = guided && fittedNose(g);
    const jaw = mandibularEdge(g, sections);
    const mouth = g.fit.sections.mouth;
    const muzzle = (() => {
        if (!guided?.mouthCorner || !mouth) return;
        const first = mouth.rows[0],
            last = mouth.rows.at(-1);
        const center = (first[0] + last[0]) / 2,
            half = Math.max(1, (last[0] - first[0]) / 2);
        const y = (first[1] + last[1]) / 2,
            front = sideAt(g, y)[3];
        const origin = guided.mouthProfile?.[0],
            turn = guided.turnedMouth?.[0];
        const a = T.MathUtils.degToRad(35);
        const curve = [-1, 1].map((side) => {
            const edge = sectionPoint(sections, (side * Math.PI) / 2, y);
            // The side trace supplies depth at the commissure. Its oblique
            // projection supplies width, even when the frontal ink stops early.
            const reach =
                side < 0 && origin && turn
                    ? T.MathUtils.clamp(
                          center -
                              (turn[0] - origin[0] * Math.sin(a)) / Math.cos(a),
                          half * 0.75,
                          half * 1.85
                      )
                    : turn
                    ? half
                    : coveredSmileWidth(g, side, half);
            const f = Math.min(
                0.97,
                reach / Math.max(1, Math.abs(edge[0] - center))
            );
            const target = T.MathUtils.clamp(
                ((origin?.[0] ?? guided.mouthCorner[0]) - edge[2]) /
                    Math.max(1, front - edge[2]),
                0.05,
                0.99
            );
            return T.MathUtils.clamp(
                ((1 - f * f) / target - 1) / (f * f),
                -0.49,
                8
            );
        });
        return { center, y, curve };
    })();
    const bounds = (y: number) => {
        const index = hair.findIndex((row) => row[0] >= y);
        const hi = index < 0 ? hair.length - 1 : Math.max(1, index);
        const a = hair[hi - 1],
            b = hair[hi];
        const u = T.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
        const col = (i: number) => T.MathUtils.lerp(a[i], b[i], u);
        const left = col(1),
            right = col(2),
            mid = (left + right) / 2;
        const angle = (x: number) =>
            Math.asin(
                T.MathUtils.clamp(
                    (x - mid) / Math.max(0.01, (right - left) / 2),
                    -1,
                    1
                )
            );
        const first = angle(col(4)),
            last = Math.PI * 2 + angle(col(3));
        const side = sideAt(g, y);
        const temple = side && partedTemple(g, y, side);
        const tangent = side && bobTangent(g, y, side);
        const release = T.MathUtils.smoothstep(
            (y - 12) / g.head[1],
            0.53,
            0.86
        );
        const limits = [-Math.PI / 2, Math.PI / 2].map(
            (a) => sectionPoint(sections, a, y)[0]
        );
        const seat = (side: number, depth: number) =>
            temple?.rollWeight && temple.side === side
                ? T.MathUtils.lerp(
                      depth,
                      Math.max(depth, temple.inner + 1),
                      0.3 * temple.rollWeight
                  )
                : depth;
        return {
            left: T.MathUtils.lerp(col(3), limits[0], release),
            right: T.MathUtils.lerp(col(4), limits[1], release),
            lz: seat(-1, bobDepth(last, first, last, side, temple, tangent)),
            rz: seat(1, bobDepth(first, first, last, side, temple, tangent)),
            front: temple?.rollWeight
                ? T.MathUtils.lerp(
                      side[3],
                      forelockDepth(temple.outer, side[3]) + 0.65,
                      temple.rollWeight
                  )
                : side[3],
            release,
        };
    };
    // A row is sampled repeatedly by its skin, lids, paint and nose.
    const levels = new Map<number, ReturnType<typeof bounds>>();
    const section = (y: number) => {
        if (!levels.has(y)) levels.set(y, bounds(y));
        return levels.get(y);
    };
    // The front drawing measures the arch across the forehead. Its profile
    // measures how the temporal end turns back underneath the hair.
    const arches =
        guided?.browProfile &&
        orbits &&
        g.fit.sections.eyes?.map((eye, i, pair) => {
            const other = pair[1 - i];
            const path =
                eye.brow ??
                other?.brow
                    ?.map(([x, y]): XY => [2 * orbits.axis - x, y])
                    .reverse();
            if (!path) return;
            const trace =
                i === 0
                    ? guided.browProfile
                    : [...guided.browProfile].reverse();
            const start = path[0][0],
                width = path.at(-1)[0] - start;
            return path.map(([x, y]): Point => {
                const pos = ((trace.length - 1) * (x - start)) / width;
                const at = Math.min(
                    trace.length - 2,
                    Math.max(0, Math.floor(pos))
                );
                return [
                    x,
                    y,
                    T.MathUtils.lerp(trace[at][0], trace[at + 1][0], pos - at),
                ];
            });
        });
    const face = (x: number, y: number) => {
        const lip = g.face?.mouthHeight ?? 0.76,
            t = (y - 12) / g.head[1],
            u = x / g.head[0];
        const cheek = Math.exp(
            -(((Math.abs(u) - 0.22) / 0.115) ** 2) - ((t - lip) / 0.094) ** 2
        );
        let depth = base(x, y);
        if (guided) {
            const row = section(y);
            const opening = row.right - row.left;
            const axis = T.MathUtils.clamp(
                orbits?.axis ?? 0,
                row.left + opening * 0.17,
                row.right - opening * 0.17
            );
            const span = x < axis ? axis - row.left : row.right - axis;
            const u = Math.min(1, Math.abs(x - axis) / Math.max(0.1, span));
            const temple = x < axis ? row.lz : row.rz;
            const exposed = T.MathUtils.smoothstep(
                opening,
                0,
                g.head[0] * 0.62
            );
            // The longer sweep keeps its support when the short temple opens.
            // A measured side contour also locates the exposed forehead even
            // where the source T-pose shows only a narrow strip of skin.
            const parted = g.fit.sections.sidePart;
            const root = parted
                ? Math.max(row.lz, row.rz)
                : (row.lz + row.rz) * 0.5;
            const measured = parted && !guided.inferred;
            const peak = T.MathUtils.lerp(
                root,
                measured ? Math.max(root, row.front) : row.front,
                measured
                    ? T.MathUtils.smoothstep(opening, 0, g.head[0] * 0.14)
                    : exposed
            );
            const brow = temple + (peak - temple) * Math.sqrt(1 - u * u);
            depth = T.MathUtils.lerp(brow, depth, row.release);
        }
        if (orbits) {
            const { axis, height, width, halfSpacing, eyeSpan, eyeCenter } =
                orbits;
            // Leave the nasal bridge between the sockets exposed on a turn.
            const temporal = T.MathUtils.smoothstep(
                (Math.abs(x - axis) - halfSpacing) / Math.max(0.1, width),
                -0.12,
                0.5
            );
            const orbital =
                eyeCenter -
                eyeSpan * 0.29 * temporal -
                eyeSpan * 0.23 +
                (eyeSpan * 0.14 * (halfSpacing - Math.hypot(x - axis, 2))) /
                    Math.max(0.5, width);
            const radial = Math.hypot(
                (Math.abs(x - axis) - halfSpacing) / (width * 0.54),
                (y - height) / (width * 0.52)
            );
            const band = guided
                ? 1 - T.MathUtils.smoothstep(radial, 0.74, 1.52)
                : Math.exp(-(((y - height) / (g.head[1] * 0.135)) ** 4));
            const l = sectionPoint(sections, -Math.PI / 2, y)[0],
                r = sectionPoint(sections, Math.PI / 2, y)[0];
            depth = T.MathUtils.lerp(
                depth,
                guided ? Math.min(depth, orbital) : orbital,
                band *
                    T.MathUtils.smoothstep(Math.min(x - l, r - x), 0, 6) *
                    T.MathUtils.lerp(
                        guided ? 0 : 0.45,
                        1,
                        T.MathUtils.smoothstep(
                            Math.abs(x - axis),
                            1.5,
                            halfSpacing * 0.4
                        )
                    )
            );
        }
        const brow = arches?.[x < orbits?.axis ? 0 : 1];
        if (brow) {
            const k = brow.findIndex((p) => p[0] >= x);
            const i = k < 0 ? brow.length - 1 : Math.max(1, k);
            const a = brow[i - 1],
                b = brow[i];
            const t = T.MathUtils.clamp(
                (x - a[0]) / Math.max(0.01, b[0] - a[0]),
                0,
                1
            );
            const level = T.MathUtils.lerp(a[1], b[1], t);
            const span = brow.at(-1)[0] - brow[0][0];
            const lift = T.MathUtils.lerp(a[2], b[2], t) - depth;
            const outside = Math.max(0, brow[0][0] - x, x - brow.at(-1)[0]);
            const support = Math.exp(
                -(((y - level) / (span * 0.38)) ** 2) -
                    (outside / (span * 0.29)) ** 2
            );
            depth +=
                T.MathUtils.clamp(lift, -span * 0.85, span * 0.85) * support;
        }
        if (muzzle) {
            const center = muzzle.center,
                my = muzzle.y;
            const side = x < center ? -1 : 1;
            const edge = sectionPoint(sections, (side * Math.PI) / 2, y),
                front = sideAt(g, y)[3];
            const curve = muzzle.curve[side < 0 ? 0 : 1];
            const u = T.MathUtils.clamp(
                Math.abs(x - center) /
                    Math.max(0.01, Math.abs(edge[0] - center)),
                0,
                1
            );
            const rounded =
                edge[2] +
                ((front - edge[2]) * (1 - u * u)) / (1 + curve * u * u);
            const lipBand = Math.exp(-(((y - my) / (g.head[1] * 0.14)) ** 2));
            depth = T.MathUtils.lerp(depth, rounded, lipBand);
        } else if (guided) depth -= g.head[0] * 0.11 * cheek;
        const relief = nasal?.lift(x, y) ?? 0;
        if (!relief) return depth;
        // The T-pose can place the nose off-center. Preserve its measured
        // sagittal projection even when its root shares a recessed socket.
        const deficit = Math.max(0, section(y).front - depth);
        const ridge = nasal.lift(nasal.center(y), y);
        const bridge =
            T.MathUtils.smoothstep(
                y,
                nasal.lo,
                nasal.lo + (nasal.hi - nasal.lo) * 0.16
            ) *
            (1 -
                T.MathUtils.smoothstep(
                    y,
                    nasal.hi - (nasal.hi - nasal.lo) * 0.12,
                    nasal.hi
                ));
        return (
            depth +
            relief +
            (deficit * bridge * relief) / Math.max(0.001, ridge)
        );
    };
    const frontRows: Point[][] = [],
        scalpRows: Point[][] = [];
    const h = g.head[1];
    const ys = [
        ...new Set([
            ...sections.map((s) => s[0]),
            ...hair
                .filter(
                    (row, i) =>
                        i % 3 === 1 &&
                        row[0] > sections[0][0] &&
                        row[0] < 12 + h * 0.68
                )
                .map((row) => row[0]),
        ]),
    ].sort((a, b) => a - b);
    if (guided) {
        const nasalLevels =
            guided.noseProfile?.map(([height]) => 12 + h * height) ??
            (nasal
                ? Array.from({ length: 12 }, (_, i) =>
                      T.MathUtils.lerp(nasal.lo, nasal.hi, i / 11)
                  )
                : []);
        const levels = [
            ...new Set([
                ...ys,
                ...nasalLevels,
                ...hair.map((r) => r[0]).filter((y) => y < 12 + h * 0.85),
            ]),
        ].sort((a, b) => a - b);
        for (const y of levels) {
            const row = section(y);
            // Above the part, the hair encloses the entire cranium. A strip
            // spanning its closed opening becomes a blade of skin in profile.
            if (
                !frontRows.length &&
                y < 12 + h * (g.face?.eyeHeight ?? 0.5) &&
                row.right - row.left < g.head[0] * 0.01
            )
                continue;
            const mid = (row.left + row.right) / 2,
                radius = (row.right - row.left) / 2;
            // Keep meridians along each ala and the bridge. The lip paint and
            // eyelids use this exact shell as their depth support.
            const axis = nasal
                ? T.MathUtils.clamp(nasal.center(y), row.left, row.right)
                : mid;
            const wing = Math.min(
                nasal?.width ?? radius * 0.25,
                Math.min(axis - row.left, row.right - axis) * 0.8
            );
            const knots = [row.left, axis - wing, axis, axis + wing, row.right];
            const counts = [7, 4, 4, 7];
            const xs = knots.slice(0, -1).flatMap((x, i) =>
                Array.from({ length: counts[i] }, (_, j) => {
                    const u = j / counts[i];
                    const v =
                        i === 0
                            ? 1 - Math.cos(u * Math.PI * 0.5)
                            : i === 3
                            ? Math.sin(u * Math.PI * 0.5)
                            : u;
                    return T.MathUtils.lerp(x, knots[i + 1], v);
                })
            );
            const ring = [...xs, row.right].map(
                (x): Point => [x, y, face(x, y)]
            );
            frontRows.push(ring);
            // Close the covered half of the skull inside the hair and neck.
            const backRing = Array.from({ length: 5 }, (_, j): Point => {
                const angle = Math.PI * (j / 4 + 0.5),
                    x = mid + radius * Math.sin(angle);
                const depth = T.MathUtils.lerp(
                    ring.at(-1)[2],
                    ring[0][2],
                    j / 4
                );
                const side = sideAt(g, y);
                const back = T.MathUtils.clamp(
                    rear(x, y),
                    side[1] + 0.4,
                    Math.max(side[1] + 0.4, side[3] - 0.4)
                );
                return [x, y, T.MathUtils.lerp(depth, back, -Math.cos(angle))];
            });
            if (jaw?.length) {
                // The front drawing ends where the bob covers the skin. The
                // mandibular angle continues behind that lock to a point
                // reconstructed from the side and three-quarter projections.
                const t = (y - 12) / h;
                const hi = jaw.findIndex(([v]) => v >= t);
                const j = hi < 0 ? jaw.length - 1 : Math.max(hi, 1);
                const a = jaw[j - 1],
                    b = jaw[j];
                const u = T.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
                const w =
                    T.MathUtils.smoothstep(t, jaw[0][0] - 0.09, jaw[0][0]) *
                    (1 - T.MathUtils.smoothstep(t, jaw.at(-1)[0], 1));
                const left = jaw[0][2] < 0;
                const root = left ? backRing.at(-1) : backRing[0],
                    rear = left ? backRing.at(-2) : backRing[1];
                const x = (root[0] * 2 + rear[0]) / 3,
                    z = (root[2] * 2 + rear[2]) / 3;
                const px = T.MathUtils.clamp(
                    T.MathUtils.lerp(a[2], b[2], u),
                    root[0] - g.head[0] * (left ? 0.15 : 0.04),
                    root[0] + g.head[0] * (left ? 0.04 : 0.15)
                );
                backRing.splice(left ? -1 : 1, 0, [
                    T.MathUtils.lerp(x, px, w),
                    y,
                    T.MathUtils.lerp(z, T.MathUtils.lerp(a[1], b[1], u), w),
                ]);
            }
            scalpRows.push(backRing);
        }
    } else
        for (const y of ys) {
            const i = hair.findIndex((row) => row[0] >= y);
            const hi = i < 0 ? hair.length - 1 : Math.max(1, i);
            const a = hair[hi - 1],
                b = hair[hi];
            const u = T.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
            const left = sectionPoint(sections, -Math.PI / 2, y)[0];
            const right = sectionPoint(sections, Math.PI / 2, y)[0];
            const mid = (left + right) / 2,
                radius = (right - left) / 2;
            const opening = (col: number) =>
                Math.asin(
                    T.MathUtils.clamp(
                        (T.MathUtils.lerp(a[col], b[col], u) - mid) /
                            Math.max(radius, 0.01),
                        -1,
                        1
                    )
                );
            const t = (y - 12) / h,
                uncover = T.MathUtils.smoothstep(t, 0.48, 0.83);
            const l = T.MathUtils.lerp(opening(3), -Math.PI, uncover);
            const r = T.MathUtils.lerp(opening(4), Math.PI, uncover);
            const arc = (start: number, end: number, n: number) =>
                Array.from({ length: n + 1 }, (_, j): Point => {
                    const angle = T.MathUtils.lerp(start, end, j / n),
                        x = mid + radius * Math.sin(angle);
                    return [
                        x,
                        y,
                        Math.cos(angle) >= 0 ? face(x, y) : rear(x, y),
                    ];
                });
            frontRows.push(arc(l, r, 20));
            scalpRows.push(arc(r, l + 2 * Math.PI, 10));
        }
    if (guided)
        d.s.surfaceNormal = (x, y) => [
            face(x - 0.48, y) - face(x + 0.48, y),
            face(x, y - 0.48) - face(x, y + 0.48),
            0.96,
        ];
    if (guided) d.s.preserveVertex = turnContours(frontRows, g.head[0] * 0.005);
    const emittedFace = d.s.surface(
        frontRows,
        g.skin,
        true,
        guided ? undefined : "sides",
        guided ? 0.34 : undefined
    );
    d.s.surfaceNormal = undefined;
    d.s.preserveVertex = undefined;
    d.s.surface(
        scalpRows,
        guided ? g.skin : g.hair.color,
        true,
        guided ? undefined : "sides",
        0.68
    );
    if (guided) {
        const shell = frontOfLoft(emittedFace);
        return (x, y) => {
            const hit = shell(x, y);
            return Number.isFinite(hit) ? hit : face(x, y);
        };
    }
    const lipRows = frontRows.filter(
        (row) =>
            Math.abs((row[0][1] - 12) / h - (g.face?.mouthHeight ?? 0.76)) <
            0.19
    );
    const lips = frontOfLoft(lipRows);
    return (x, y) =>
        Math.abs((y - 12) / h - (g.face?.mouthHeight ?? 0.76)) < 0.08
            ? Math.max(face(x, y), lips(x, y))
            : face(x, y);
}
