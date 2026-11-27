import { TriangleTree } from "./bake";
import type { FigureLandmarks, FigureRim } from "./format";
import type { FaceFeature, FaceLandmark } from "./style";

/**
 * The geometry a style needs from a figure, and does to it: where its
 * eyes and mouth open, the reshaping of its face, and where its brows
 * lie. Plain arrays, in the space the figure's vertices are stored in.
 */

export type V2 = [number, number];
export type V3 = [number, number, number];

/** Points an opening's edge is described by: half above, half below. */
export const RIM_POINTS = 24;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
};
const point = (array: ArrayLike<number>, v: number): V3 => [
    array[v * 3],
    array[v * 3 + 1],
    array[v * 3 + 2],
];

/** An opening in the face (an eye, the mouth) in a flat frame of its own. */
export interface OpeningFrame {
    centre: V3;
    /** From its first corner to its far one; up; and out of the face. */
    across: V3;
    up: V3;
    out: V3;
    /**
     * Its edge in that frame, `RIM_POINTS` of them from the first corner:
     * the upper edge to the far corner, then the lower edge back.
     */
    rim: V2[];
}

/** Points evenly spaced along a line of points. */
export function resample(points: V2[], count: number): V2[] {
    const lengths = [0];
    for (let i = 1; i < points.length; i++)
        lengths.push(
            lengths[i - 1] +
                Math.hypot(
                    points[i][0] - points[i - 1][0],
                    points[i][1] - points[i - 1][1]
                )
        );
    const total = lengths[lengths.length - 1];
    const out: V2[] = [];
    let at = 1;
    for (let k = 0; k < count; k++) {
        const want = (total * k) / (count - 1);
        while (at < points.length - 1 && lengths[at] < want) at++;
        const span = lengths[at] - lengths[at - 1] || 1;
        const t = Math.min(1, Math.max(0, (want - lengths[at - 1]) / span));
        out.push([
            points[at - 1][0] + (points[at][0] - points[at - 1][0]) * t,
            points[at - 1][1] + (points[at][1] - points[at - 1][1]) * t,
        ]);
    }
    return out;
}

/** Round a line of points off, keeping its two ends (corner cutting). */
export function roundOff(points: V2[], passes = 2): V2[] {
    let line = points;
    for (let pass = 0; pass < passes; pass++) {
        const next: V2[] = [line[0]];
        for (let i = 0; i < line.length - 1; i++) {
            const a = line[i];
            const b = line[i + 1];
            next.push(
                [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
                [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]
            );
        }
        next.push(line[line.length - 1]);
        line = next;
    }
    return line;
}

/**
 * The frame of an opening, from the vertices round it. `forwardZ` is
 * which way the figure faces along z, +1 or -1.
 */
export function openingFrame(
    position: ArrayLike<number>,
    normal: ArrayLike<number>,
    rim: FigureRim,
    forwardZ: number
): OpeningFrame {
    const points = rim.loop.map((v) => point(position, v));
    const centre: V3 = [0, 0, 0];
    for (const p of points)
        for (let k = 0; k < 3; k++) centre[k] += p[k] / points.length;
    // Out of the face: square to the opening where it has an area (an
    // eye), otherwise the way the skin round it faces (a closed mouth).
    const area: V3 = [0, 0, 0];
    let around = 0;
    points.forEach((p, i) => {
        const q = points[(i + 1) % points.length];
        const c = cross(sub(p, centre), sub(q, centre));
        for (let k = 0; k < 3; k++) area[k] += c[k] / 2;
        around += Math.hypot(...sub(q, p));
    });
    let out = unit(area);
    if (Math.hypot(...area) < 0.01 * around * around) {
        const sum: V3 = [0, 0, 0];
        for (const v of rim.loop)
            for (let k = 0; k < 3; k++) sum[k] += normal[v * 3 + k];
        out = unit(sum);
    }
    if (out[2] * forwardZ < 0) out = [-out[0], -out[1], -out[2]];
    const span = sub(points[rim.turn], points[0]);
    const along = dot(span, out);
    const across = unit([
        span[0] - out[0] * along,
        span[1] - out[1] * along,
        span[2] - out[2] * along,
    ]);
    let up = cross(across, out);
    if (up[1] < 0) up = [-up[0], -up[1], -up[2]];
    const flat = points.map((p): V2 => {
        const d = sub(p, centre);
        return [dot(d, across), dot(d, up)];
    });
    const half = RIM_POINTS / 2;
    // The edges as curves: the mesh's own corners are rounded off, so
    // lines drawn along them are smooth.
    const upper = resample(roundOff(flat.slice(0, rim.turn + 1)), half + 1);
    const lower = resample(
        roundOff([...flat.slice(rim.turn), flat[0]]),
        half + 1
    );
    return {
        centre,
        across,
        up,
        out,
        rim: [...upper.slice(0, half), ...lower.slice(0, half)],
    };
}

/**
 * Landmarks of the face, with the figure folded onto one side (x is the
 * distance from its middle), so that one description serves both halves.
 */
export type FaceMarks = Record<FaceLandmark, V3>;

export function faceMarks(
    position: ArrayLike<number>,
    isSkin: (vertex: number) => boolean,
    landmarks: FigureLandmarks,
    forwardZ: number
): FaceMarks {
    const mean = (vertices: number[]): V3 => {
        const sum: V3 = [0, 0, 0];
        for (const v of vertices) {
            sum[0] += Math.abs(position[v * 3]) / vertices.length;
            sum[1] += position[v * 3 + 1] / vertices.length;
            sum[2] += position[v * 3 + 2] / vertices.length;
        }
        return sum;
    };
    const eye = mean([
        ...landmarks.eyes.left.loop,
        ...landmarks.eyes.right.loop,
    ]);
    const lips = mean(landmarks.mouth.loop);
    let nose: V3 = [0, 0, -Infinity * forwardZ];
    let chin: V3 = [0, 0, -Infinity * forwardZ];
    let widest = 0;
    const count = position.length / 3;
    for (let v = 0; v < count; v++) {
        if (!isSkin(v)) continue;
        const p = point(position, v);
        widest = Math.max(widest, Math.abs(p[0]));
        const further = (than: V3) => p[2] * forwardZ > than[2] * forwardZ;
        if (Math.abs(p[0]) < 0.006 && p[1] > lips[1] && p[1] < eye[1]) {
            if (further(nose)) nose = p;
        } else if (Math.abs(p[0]) < 0.01 && p[1] < lips[1] - 0.006)
            if (further(chin)) chin = p;
    }
    const side: number[] = [];
    for (let v = 0; v < count; v++)
        if (isSkin(v) && Math.abs(position[v * 3]) > widest * 0.92)
            side.push(v);
    const ear = side.length ? mean(side) : ([widest, eye[1], 0] as V3);
    return {
        eye,
        nose: [0, nose[1], nose[2]],
        mouth: [0, lips[1], lips[2]],
        chin: [0, chin[1], chin[2]],
        ear,
        // The corner of the jaw: level with the mouth, under the ear.
        jaw: [
            ear[0] * 0.72,
            lips[1] + (chin[1] - lips[1]) * 0.1,
            (ear[2] + nose[2]) / 2,
        ],
    };
}

/** Vertices and the offsets that expressions move them by. */
export interface ShapeGeometry {
    position: Float32Array;
    /** Each morph as an offset from `position`, three numbers a vertex. */
    morphs: Float32Array[];
}

/**
 * Make some of a figure's expressions its resting face, and keep the
 * others sensible on top of it:
 *
 * - expressions that shut the eyes (a blink, a smile's closed eyes) still
 *   end in the figure's own shut eye, exactly: whatever the worn
 *   expressions did to the lids is undone as they close;
 * - other expressions of the eyes only lower a lid by what is left of
 *   its travel, so lids that already rest half shut are not driven past
 *   each other.
 */
export function wearMorphs(
    geometry: ShapeGeometry,
    names: string[],
    worn: Record<string, number>,
    closing = /EYE_(Close|Joy)|ALL_Joy/
) {
    const { position } = geometry;
    const baked = new Float32Array(position.length);
    // What of it moved the eyes.
    const lids = new Float32Array(position.length);
    let any = false;
    for (const [name, weight] of Object.entries(worn)) {
        const index = names.findIndex((n) => n.endsWith(name));
        const morph = geometry.morphs[index];
        if (!morph || !weight) continue;
        any = true;
        const eyes = /EYE_/.test(names[index]);
        for (let i = 0; i < baked.length; i++) {
            baked[i] += morph[i] * weight;
            if (eyes) lids[i] += morph[i] * weight;
        }
    }
    if (!any) return;
    for (let i = 0; i < baked.length; i++) position[i] += baked[i];
    // How each vertex travels when the eyes shut, before that changes.
    const shutIndex = names.findIndex((n) => n.endsWith("EYE_Close"));
    const shut = geometry.morphs[shutIndex]
        ? Float32Array.from(geometry.morphs[shutIndex])
        : null;
    geometry.morphs.forEach((morph, index) => {
        const name = names[index] || "";
        if (closing.test(name)) {
            // It may shut one eye only: a side counts if a fair share
            // of its movement is there.
            const moved = [0, 0];
            for (let v = 0; v < morph.length; v += 3)
                moved[position[v] > 0 ? 1 : 0] += Math.hypot(
                    morph[v],
                    morph[v + 1],
                    morph[v + 2]
                );
            const share = (moved[0] + moved[1]) * 0.1;
            for (let v = 0; v < morph.length; v += 3)
                if (moved[position[v] > 0 ? 1 : 0] > share)
                    for (let k = 0; k < 3; k++) morph[v + k] -= lids[v + k];
            return;
        }
        if (!shut || !/EYE_|ALL_/.test(name)) return;
        for (let v = 0; v < morph.length; v += 3) {
            const travel =
                shut[v] * shut[v] +
                shut[v + 1] * shut[v + 1] +
                shut[v + 2] * shut[v + 2];
            if (travel < 4e-8) continue;
            const along = (from: Float32Array) =>
                (from[v] * shut[v] +
                    from[v + 1] * shut[v + 1] +
                    from[v + 2] * shut[v + 2]) /
                travel;
            const rests = Math.min(1, Math.max(0, along(lids)));
            const moves = along(morph);
            if (!rests || moves <= 0) continue;
            for (let k = 0; k < 3; k++)
                morph[v + k] -= moves * rests * shut[v + k];
        }
    });
}

/**
 * The reshaping of a face as a function of where a point is, so that
 * skin, lids, the eye behind them and every expression's version of them
 * all move together.
 */
export function faceWarp(
    features: FaceFeature[],
    marks: FaceMarks,
    forwardZ: number
): (p: V3) => V3 {
    const plans = features.map((feature) => {
        const base = marks[feature.at];
        const offset = feature.offset || [0, 0, 0];
        const turn = ((feature.turn || 0) * Math.PI) / 180;
        return {
            centre: [
                base[0] + offset[0],
                base[1] + offset[1],
                base[2] + offset[2] * forwardZ,
            ] as V3,
            radius: feature.radius,
            scale: feature.scale || [1, 1, 1],
            move: feature.move || [0, 0, 0],
            turn,
        };
    });
    return (p) => {
        const side = p[0] < 0 ? -1 : 1;
        // Folded onto one side: x is outwards.
        let q: V3 = [Math.abs(p[0]), p[1], p[2]];
        for (const plan of plans) {
            const d = sub(q, plan.centre);
            const t = Math.hypot(d[0], d[1], d[2]) / plan.radius;
            if (t >= 1) continue;
            const w = (1 - t * t) ** 2;
            const angle = plan.turn * w;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const turned: V3 = [
                d[0] * cos - d[1] * sin,
                d[0] * sin + d[1] * cos,
                d[2],
            ];
            // Nothing crosses the middle of the face.
            const out = plan.centre[0] < 1e-6 ? 0 : plan.move[0];
            q = [
                Math.max(
                    0,
                    plan.centre[0] +
                        turned[0] * (1 + (plan.scale[0] - 1) * w) +
                        out * w
                ),
                plan.centre[1] +
                    turned[1] * (1 + (plan.scale[1] - 1) * w) +
                    plan.move[1] * w,
                plan.centre[2] +
                    turned[2] * (1 + (plan.scale[2] - 1) * w) +
                    plan.move[2] * forwardZ * w,
            ];
        }
        return [q[0] * side, q[1], q[2]];
    };
}

/** Reshape vertices, and what every expression makes of them. */
export function warpGeometry(geometry: ShapeGeometry, warp: (p: V3) => V3) {
    const { position, morphs } = geometry;
    for (let v = 0; v < position.length; v += 3) {
        const from: V3 = [position[v], position[v + 1], position[v + 2]];
        const to = warp(from);
        if (to[0] === from[0] && to[1] === from[1] && to[2] === from[2])
            continue;
        for (const morph of morphs) {
            if (!morph[v] && !morph[v + 1] && !morph[v + 2]) continue;
            const moved = warp([
                from[0] + morph[v],
                from[1] + morph[v + 1],
                from[2] + morph[v + 2],
            ]);
            for (let k = 0; k < 3; k++) morph[v + k] = moved[k] - to[k];
        }
        for (let k = 0; k < 3; k++) position[v + k] = to[k];
    }
}

/** A smooth curve through a few points, as many (Catmull-Rom). */
export function smoothCurve(points: V2[], perSpan = 8): V2[] {
    if (points.length < 3) return points.slice();
    const out: V2[] = [];
    const at = (i: number) =>
        points[Math.min(points.length - 1, Math.max(0, i))];
    for (let i = 0; i < points.length - 1; i++) {
        const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        for (let step = 0; step < perSpan; step++) {
            const t = step / perSpan;
            const blend = (k: number) =>
                0.5 *
                (2 * b[k] +
                    (c[k] - a[k]) * t +
                    (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t +
                    (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t);
            out.push([blend(0), blend(1)]);
        }
    }
    out.push(points[points.length - 1]);
    return out;
}

/** How far along a line of points each of them is, 0 to 1. */
function alongLine(points: V2[]): number[] {
    const run = [0];
    for (let i = 1; i < points.length; i++)
        run.push(
            run[i - 1] +
                Math.hypot(
                    points[i][0] - points[i - 1][0],
                    points[i][1] - points[i - 1][1]
                )
        );
    const total = run[run.length - 1] || 1;
    return run.map((r) => r / total);
}

/** The point a part of the way along a line of points. */
function pointAlong(points: V2[], part: number[], t: number): V2 {
    let i = 1;
    while (i < points.length - 1 && part[i] < t) i++;
    const span = part[i] - part[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (t - part[i - 1]) / span));
    return [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k,
    ];
}

/** An eye's outline, as a style draws it. */
export interface EyeOutline {
    /**
     * Its upper edge and its lower, each from the inner corner at [0, 0]
     * to the outer: [out, up] in eye widths, seen from the front.
     */
    upper: V2[];
    lower: V2[];
}

export interface EyeFit {
    /** The places of the rim's vertices, in the rim's own order. */
    rim: V3[];
    /** Where in `rim` the outer corner is. */
    turn: number;
    /** The sign of x on this eye's side of the face. */
    side: number;
    forwardZ: number;
    outline: EyeOutline;
    /** The new eye's width, as a multiple of the one it has. */
    size: number;
    /** Where the inner corner goes: [outwards, up] in the width it has. */
    inset: V2;
}

const smoothstep = (from: number, to: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
    return t * t * (3 - 2 * t);
};

/**
 * The reshaping that puts an eye's rim on an outline. Each vertex of the
 * rim goes to the same part of the way along its edge of the outline;
 * what lies inside and round the rim, at any depth, goes with the nearest
 * of them, and it fades out over the width of the eye. Seen from the
 * front, the rim then is the outline exactly.
 */
export function eyeWarp(fit: EyeFit): (p: V3) => V3 {
    const { rim, turn, side } = fit;
    const inner = rim[0];
    const width = Math.abs(rim[turn][0] - inner[0]) || 1;
    // The rim seen from the front: [out from the inner corner, up].
    const flat = rim.map(
        (p): V2 => [(p[0] - inner[0]) * side, p[1] - inner[1]]
    );
    const target = flat.map((): V2 => [0, 0]);
    const place = (edge: number[], curve: V2[]) => {
        const now = edge.map((i) => flat[i]);
        const part = alongLine(now);
        const smooth = smoothCurve(curve);
        const curvePart = alongLine(smooth);
        edge.forEach((i, k) => {
            const at = pointAlong(smooth, curvePart, part[k]);
            target[i] = [
                at[0] * width * fit.size + fit.inset[0] * width,
                at[1] * width * fit.size + fit.inset[1] * width,
            ];
        });
    };
    const upper = Array.from({ length: turn + 1 }, (_, i) => i);
    const lower = [
        0,
        ...Array.from(
            { length: rim.length - turn },
            (_, i) => rim.length - 1 - i
        ),
    ];
    place(lower, fit.outline.lower);
    place(upper, fit.outline.upper);
    const move = flat.map(
        (p, i): V2 => [target[i][0] - p[0], target[i][1] - p[1]]
    );
    const depth = rim.reduce((sum, p) => sum + p[2], 0) / rim.length;
    const soft = (0.02 * width) ** 2;
    return (p) => {
        const out = p[0] * side;
        const deep = Math.abs(p[2] - depth);
        if (out < 0.002 || deep > 0.06) return p;
        const x = (p[0] - inner[0]) * side;
        const y = p[1] - inner[1];
        let nearest = Infinity;
        let total = 0;
        let dx = 0;
        let dy = 0;
        for (let i = 0; i < flat.length; i++) {
            const d2 = (flat[i][0] - x) ** 2 + (flat[i][1] - y) ** 2;
            if (d2 < nearest) nearest = d2;
            const weight = 1 / (d2 + soft) ** 2;
            total += weight;
            dx += move[i][0] * weight;
            dy += move[i][1] * weight;
        }
        const reach =
            (1 - smoothstep(0.3 * width, width, Math.sqrt(nearest))) *
            (1 - smoothstep(0.03, 0.06, deep)) *
            // Nothing crosses the middle of the face.
            smoothstep(0.002, 0.014, out);
        if (reach <= 0) return p;
        return [
            p[0] + (dx / total) * reach * side,
            p[1] + (dy / total) * reach,
            p[2],
        ];
    };
}

/** The direction a flat thing is thinnest in. */
function thinAxis(points: V3[]): V3 {
    const mean: V3 = [0, 0, 0];
    for (const p of points)
        for (let k = 0; k < 3; k++) mean[k] += p[k] / points.length;
    const c = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (const p of points)
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                c[i][j] += (p[i] - mean[i]) * (p[j] - mean[j]);
    // The axis the points vary least along: found by repeated
    // multiplication, with the spread turned upside down.
    const trace = c[0][0] + c[1][1] + c[2][2];
    let v: V3 = [1, 0.3, 0.2];
    for (let pass = 0; pass < 120; pass++)
        v = unit([
            trace * v[0] - (c[0][0] * v[0] + c[0][1] * v[1] + c[0][2] * v[2]),
            trace * v[1] - (c[1][0] * v[0] + c[1][1] * v[1] + c[1][2] * v[2]),
            trace * v[2] - (c[2][0] * v[0] + c[2][1] * v[1] + c[2][2] * v[2]),
        ]);
    return v;
}

/** The band stretched round some points: its corners, in order. */
export function hullOf(points: V2[]): V2[] {
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const half = (from: V2[]) => {
        const chain: V2[] = [];
        for (const p of from) {
            while (chain.length >= 2) {
                const [o, a] = [
                    chain[chain.length - 2],
                    chain[chain.length - 1],
                ];
                const turn =
                    (a[0] - o[0]) * (p[1] - o[1]) -
                    (a[1] - o[1]) * (p[0] - o[0]);
                if (turn > 0) break;
                chain.pop();
            }
            chain.push(p);
        }
        return chain.slice(0, -1);
    };
    return [...half(sorted), ...half(sorted.reverse())];
}

/** The oval of the same area and spread as an outline: where, and how. */
function ovalOf(outline: V2[]) {
    let [area, cx, cy, xx, yy, xy] = [0, 0, 0, 0, 0, 0];
    outline.forEach((p, i) => {
        const q = outline[(i + 1) % outline.length];
        const w = p[0] * q[1] - q[0] * p[1];
        area += w / 2;
        cx += (p[0] + q[0]) * w;
        cy += (p[1] + q[1]) * w;
        xx += (p[0] * p[0] + p[0] * q[0] + q[0] * q[0]) * w;
        yy += (p[1] * p[1] + p[1] * q[1] + q[1] * q[1]) * w;
        xy +=
            (p[0] * q[1] + 2 * p[0] * p[1] + 2 * q[0] * q[1] + q[0] * p[1]) * w;
    });
    cx /= 6 * area;
    cy /= 6 * area;
    const sxx = xx / (12 * area) - cx * cx;
    const syy = yy / (12 * area) - cy * cy;
    const sxy = xy / (24 * area) - cx * cy;
    const mid = (sxx + syy) / 2;
    const off = Math.hypot((sxx - syy) / 2, sxy);
    return {
        centre: [cx, cy] as V2,
        tilt: 0.5 * Math.atan2(2 * sxy, sxx - syy),
        // Half its length and half its width.
        long: 2 * Math.sqrt(mid + off),
        short: 2 * Math.sqrt(Math.max(1e-12, mid - off)),
    };
}

/** Where an ear's bowl is. */
export interface EarFrame {
    /** Its middle. */
    centre: V3;
    /**
     * Along the ear's length and across its width, each divided by half
     * that size: a point's offset from the middle, measured along them,
     * is 0 there and 1 at the ear's rim.
     */
    long: V3;
    short: V3;
    /** Out of the side of the ear that faces away from the head. */
    out: V3;
}

/**
 * Round an ear off. An ear is a flap: in the flap's own plane its outline
 * is drawn towards the oval of the same area and spread, so a point comes
 * in and a flat stretch fills out. It keeps its place on the head, where
 * nothing moves, and what lies inside the outline moves less than the
 * outline does. `size` makes it larger or smaller about where it joins,
 * and `cup` hollows it: its middle is set back by that part of its
 * half-width, so that its rim stands round a bowl.
 */
export function roundEar(
    position: Float32Array,
    ear: { all: number[]; root: number[] },
    forwardZ: number,
    round: number,
    size = 1,
    cup = 0
): EarFrame | null {
    const roots = ear.root.map((v) => point(position, v));
    const fixed = new Set(ear.root);
    const free = ear.all.filter((v) => !fixed.has(v));
    if (!free.length || !roots.length) return null;
    const points = ear.all.map((v) => point(position, v));
    // The flap's plane: towards the back of the head, and up.
    const thin = thinAxis(points);
    const lie = (axis: V3): V3 => {
        const along = dot(axis, thin);
        return unit([
            axis[0] - thin[0] * along,
            axis[1] - thin[1] * along,
            axis[2] - thin[2] * along,
        ]);
    };
    const back = lie([0, 0, -forwardZ]);
    const up = cross(thin, back);
    if (up[1] < 0) for (let k = 0; k < 3; k++) up[k] = -up[k];
    const hold: V3 = [0, 0, 0];
    for (const r of roots)
        for (let k = 0; k < 3; k++) hold[k] += r[k] / roots.length;
    // The side of the flap that faces away from the head.
    const outward = thin[0] * hold[0] < 0 ? -1 : 1;
    const flat = (p: V3): V2 => [
        dot(sub(p, hold), back),
        dot(sub(p, hold), up),
    ];
    // Its outline in that plane, and the oval of the same area and spread.
    const outline = hullOf(points.map(flat));
    const oval = ovalOf(outline);
    const centre = oval.centre;
    /** How far from its middle the outline is, in a direction. */
    const reachAt = (angle: number) => {
        const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
        let reach = 0;
        outline.forEach((a, i) => {
            const b = outline[(i + 1) % outline.length];
            const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
            const det = dy * ex - dx * ey;
            if (Math.abs(det) < 1e-14) return;
            const [px, py] = [a[0] - centre[0], a[1] - centre[1]];
            const along = (py * ex - px * ey) / det;
            const on = (dx * py - dy * px) / det;
            if (along > 0 && on > -1e-9 && on < 1 + 1e-9)
                reach = Math.max(reach, along);
        });
        return reach;
    };
    const ovalAt = (angle: number) =>
        1 /
        Math.hypot(
            Math.cos(angle - oval.tilt) / oval.long,
            Math.sin(angle - oval.tilt) / oval.short
        );
    for (const v of free) {
        const p = point(position, v);
        let nearest = Infinity;
        for (const r of roots)
            nearest = Math.min(nearest, Math.hypot(...sub(p, r)));
        const loose = smoothstep(0.002, 0.016, nearest);
        const q = flat(p);
        const r = Math.hypot(q[0] - centre[0], q[1] - centre[1]);
        const angle = Math.atan2(q[1] - centre[1], q[0] - centre[0]);
        const now = reachAt(angle) || 1;
        const want = now + (ovalAt(angle) - now) * round;
        const outer = smoothstep(0.2, 0.9, r / now);
        const grow = (want / now - 1) * outer * loose;
        // Out from the ear's middle, in its plane.
        const du = (q[0] - centre[0]) * grow;
        const dv = (q[1] - centre[1]) * grow;
        // The bowl: deepest a little forward of the middle, nothing at
        // the rim or where the ear joins the head.
        const bu = q[0] - centre[0] + oval.short * 0.15;
        const bv = q[1] - centre[1];
        const rho = Math.hypot(
            (bu * Math.cos(oval.tilt) + bv * Math.sin(oval.tilt)) / oval.long,
            (bv * Math.cos(oval.tilt) - bu * Math.sin(oval.tilt)) / oval.short
        );
        const sunk =
            -outward *
            cup *
            oval.short *
            (1 - smoothstep(0.25, 0.85, rho)) *
            smoothstep(0.003, 0.014, nearest);
        // Then its size.
        const scale = 1 + (size - 1) * loose;
        for (let k = 0; k < 3; k++)
            position[v * 3 + k] =
                hold[k] +
                (p[k] + back[k] * du + up[k] * dv + thin[k] * sunk - hold[k]) *
                    scale;
    }
    // Where its bowl is now, for whoever shades it.
    const [cos, sin] = [Math.cos(oval.tilt), Math.sin(oval.tilt)];
    const middle: V2 = [centre[0] - oval.short * 0.15, centre[1]];
    const axis = (u: number, v: number, half: number): V3 => [
        (back[0] * u + up[0] * v) / (half * size),
        (back[1] * u + up[1] * v) / (half * size),
        (back[2] * u + up[2] * v) / (half * size),
    ];
    return {
        centre: [
            hold[0] + (back[0] * middle[0] + up[0] * middle[1]) * size,
            hold[1] + (back[1] * middle[0] + up[1] * middle[1]) * size,
            hold[2] + (back[2] * middle[0] + up[2] * middle[1]) * size,
        ],
        long: axis(cos, sin, oval.long),
        short: axis(-sin, cos, oval.short),
        out: [thin[0] * outward, thin[1] * outward, thin[2] * outward],
    };
}

/**
 * Normals for some of a surface's vertices, from the triangles that touch
 * them; vertices in the same place share one.
 */
export function renewNormals(
    position: Float32Array,
    normal: Float32Array,
    indices: ArrayLike<number>,
    vertices: number[]
) {
    const wanted = new Set(vertices);
    const key = (v: number) =>
        Math.round(position[v * 3] * 2e4) +
        "," +
        Math.round(position[v * 3 + 1] * 2e4) +
        "," +
        Math.round(position[v * 3 + 2] * 2e4);
    const sums = new Map<string, V3>();
    for (let t = 0; t < indices.length; t += 3) {
        const tri = [indices[t], indices[t + 1], indices[t + 2]];
        if (!tri.some((v) => wanted.has(v))) continue;
        const [p, q, r] = tri.map((v) => point(position, v));
        const face = cross(sub(q, p), sub(r, p));
        for (const v of tri) {
            if (!wanted.has(v)) continue;
            const k = key(v);
            const sum = sums.get(k) || [0, 0, 0];
            sums.set(k, [sum[0] + face[0], sum[1] + face[1], sum[2] + face[2]]);
        }
    }
    for (const v of vertices) {
        const sum = sums.get(key(v));
        if (!sum) continue;
        const n = unit(sum);
        normal[v * 3] = n[0];
        normal[v * 3 + 1] = n[1];
        normal[v * 3 + 2] = n[2];
    }
}

/** How far forward the skin is at a place seen from the front. */
export function depthFinder(
    position: Float32Array,
    indices: ArrayLike<number>,
    forwardZ: number
): (x: number, y: number) => number | null {
    const tree = new TriangleTree(position, Uint32Array.from(indices));
    return (x, y) => {
        const hit = tree.cast(x, y, forwardZ, 0, 0, -forwardZ, 2);
        return hit < 2 ? forwardZ * (1 - hit) : null;
    };
}

/** Where a brow's line has its points, and how thick it is at each. */
export interface BrowLine {
    /**
     * Each point: how far along the strip (0 at the nose), how far up it
     * (0 at its lower edge), and the line's thickness there in metres.
     */
    knots: { along: number; up: number; width: number }[];
    /** The strip's height, metres. */
    height: number;
    /** The strip's length, metres. */
    length: number;
}

/** The strip a brow is drawn on: its vertices by column and row. */
function browStrip(coords: ArrayLike<number>, vertices: number[]) {
    const columns = [
        ...new Set(vertices.map((v) => Math.round(coords[v * 2] * 1e4))),
    ]
        .sort((a, b) => a - b)
        .map((c) => c / 1e4);
    const column = (v: number) =>
        columns.reduce(
            (best, c, i) =>
                Math.abs(c - coords[v * 2]) <
                Math.abs(columns[best] - coords[v * 2])
                    ? i
                    : best,
            0
        );
    return { columns, column };
}

/** The size of a brow's strip as the figure has it. */
export function measureBrow(
    position: ArrayLike<number>,
    coords: ArrayLike<number>,
    vertices: number[]
) {
    const { columns, column } = browStrip(coords, vertices);
    // Its middle row, end to end; and its columns, bottom to top.
    const mid = columns.map((_, c) => {
        const mine = vertices.filter((v) => column(v) === c);
        const lo = mine.reduce((a, b) =>
            coords[a * 2 + 1] < coords[b * 2 + 1] ? a : b
        );
        const hi = mine.reduce((a, b) =>
            coords[a * 2 + 1] > coords[b * 2 + 1] ? a : b
        );
        return { lo: point(position, lo), hi: point(position, hi) };
    });
    let length = 0;
    let height = 0;
    mid.forEach((c, i) => {
        height += Math.hypot(...sub(c.hi, c.lo)) / mid.length;
        if (!i) return;
        const a = mid[i - 1];
        length += Math.hypot(
            (c.lo[0] + c.hi[0] - a.lo[0] - a.hi[0]) / 2,
            (c.lo[1] + c.hi[1] - a.lo[1] - a.hi[1]) / 2,
            (c.lo[2] + c.hi[2] - a.lo[2] - a.hi[2]) / 2
        );
    });
    return { length, height };
}

/** How far off the skin a brow's strip lies, metres. */
const PROUD = 0.0009;

export interface LayBrow {
    position: Float32Array;
    /** Per vertex: how far along its strip, and how far up it. */
    coords: ArrayLike<number>;
    /** The strip's vertices. */
    vertices: number[];
    /** Which side of the face the strip is on: the sign of its x. */
    side: number;
    /** [out from the middle of the face, up from the eye line]. */
    path: V2[];
    widths: number[];
    eyeLine: number;
    /** Depth of the skin at a place, to lay the strip on. */
    depth: (x: number, y: number) => number | null;
    forwardZ: number;
    /** How far below the line its shadow may fall, metres. */
    shadow?: number;
    /**
     * The expressions that move the strip, as offsets. They were made
     * for where the strip used to lie: each keeps its movement across
     * the face and is put back on the skin there.
     */
    morphs?: Float32Array[];
}

/**
 * Lay a brow's strip along a path over the face: its columns follow the
 * path, with one at every corner of it, and it stays just proud of the
 * skin. Each vertex keeps what its expressions add to it.
 */
export function layBrow(args: LayBrow): BrowLine {
    const { position, coords, vertices, side, path, widths } = args;
    const { columns, column } = browStrip(coords, vertices);
    const margin = 0.0035;
    // Room round the line for its soft edge, and below it for the shadow
    // it casts.
    const thickest = Math.max(...widths);
    const below = thickest / 2 + margin + (args.shadow ?? 0);
    const height = below + thickest / 2 + margin;
    const middle = below / height;
    // The path, run on a little at both ends.
    const ends = (a: V2, b: V2): V2 => {
        const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        return [
            a[0] + ((a[0] - b[0]) / l) * margin,
            a[1] + ((a[1] - b[1]) / l) * margin,
        ];
    };
    const line: V2[] = [
        ends(path[0], path[1]),
        ...path,
        ends(path[path.length - 1], path[path.length - 2]),
    ];
    const run = [0];
    for (let i = 1; i < line.length; i++)
        run.push(
            run[i - 1] +
                Math.hypot(
                    line[i][0] - line[i - 1][0],
                    line[i][1] - line[i - 1][1]
                )
        );
    const total = run[run.length - 1];
    // A column for every point of the path, in order, the rest between.
    const last = columns.length - 1;
    const anchor = [0];
    for (let i = 1; i < line.length - 1; i++)
        anchor.push(
            Math.min(
                last - (line.length - 1 - i),
                Math.max(anchor[i - 1] + 1, Math.round((run[i] / total) * last))
            )
        );
    anchor.push(last);
    const normalOf = (i: number): V2 => {
        const a = line[Math.max(0, i - 1)];
        const b = line[Math.min(line.length - 1, i)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    };
    const at = (c: number) => {
        let i = 1;
        while (i < anchor.length - 1 && anchor[i] < c) i++;
        const span = anchor[i] - anchor[i - 1] || 1;
        const t = (c - anchor[i - 1]) / span;
        const x = line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t;
        const y = line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t;
        let normal = normalOf(i);
        if (c === anchor[i] && i < line.length - 1) {
            // At a corner: between the two sides, and as much longer as
            // keeps the line's thickness round the bend.
            const next = normalOf(i + 1);
            const sum: V2 = [normal[0] + next[0], normal[1] + next[1]];
            const l = Math.hypot(sum[0], sum[1]) || 1;
            const cos = (sum[0] * normal[0] + sum[1] * normal[1]) / l;
            const stretch = Math.min(2, 1 / Math.max(cos, 0.5));
            normal = [(sum[0] / l) * stretch, (sum[1] / l) * stretch];
        }
        return { x, y, normal };
    };
    let known = 0;
    for (const v of vertices) {
        const place = at(column(v));
        const offset = (coords[v * 2 + 1] - middle) * height;
        const x = (place.x + place.normal[0] * offset) * side;
        const y = args.eyeLine + place.y + place.normal[1] * offset;
        const skin = args.depth(x, y);
        if (skin !== null) known = skin;
        position[v * 3] = x;
        position[v * 3 + 1] = y;
        // Just proud of the skin, so it never dips into it.
        position[v * 3 + 2] = (skin ?? known) + PROUD * args.forwardZ;
        for (const morph of args.morphs || []) {
            if (!morph[v * 3] && !morph[v * 3 + 1] && !morph[v * 3 + 2])
                continue;
            const there = args.depth(x + morph[v * 3], y + morph[v * 3 + 1]);
            if (there !== null)
                morph[v * 3 + 2] =
                    there + PROUD * args.forwardZ - position[v * 3 + 2];
        }
    }
    return {
        knots: path.map((_, i) => ({
            along: columns[anchor[i + 1]],
            up: middle,
            width: widths[Math.min(i, widths.length - 1)],
        })),
        height,
        length: total,
    };
}
