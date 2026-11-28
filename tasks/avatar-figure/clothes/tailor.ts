/**
 * Altering garments taken from another model (see donor.ts), the way a
 * tailor would: trimming their cut-away edges, lengthening sleeves,
 * widening and shortening legs, and painting them anew. The paint is where
 * a garment's folds, seams and buttons live, as VRoid's clothes have them:
 * the shell stays clean and light.
 */
import {
    boundaryLoops,
    weld,
} from "../../../frontend/features/procedural-avatar/figure/bake";
import type { DonorGarment } from "./donor";
import type { BodyField } from "./bodyField";
import type { V3 } from "./figure";

/** Where a ray from `from` along `dir` first leaves a shape. */
function surfaceAlong(
    s: { eval(x: number, y: number, z: number): number },
    from: V3,
    dir: V3,
    reach: number
): V3 {
    let t = 0;
    const at = (d: number): V3 => [
        from[0] + dir[0] * d,
        from[1] + dir[1] * d,
        from[2] + dir[2] * d,
    ];
    for (let i = 0; i < 400 && t < reach; i++) {
        const d = s.eval(...at(t));
        if (d >= 0) return at(t);
        t += Math.max(0.0005, -d * 0.5);
    }
    return at(t);
}

/** A garment as it is being altered, with the texture it will wear. */
export interface Cut {
    garment: DonorGarment;
    texture: Texture;
    /** Texels a side on the outfit's texture: 1024 or 512. */
    size: number;
    /** Bind it to the bones afresh, from the skin nearest each point. */
    rebind: boolean;
    /** With `rebind`, take skin only from this side (see Garment.side). */
    side?: (p: V3) => -1 | 1 | 0;
}

/** An image as plain RGBA bytes, rows from the top. */
export interface Texture {
    data: Uint8Array;
    width: number;
    height: number;
}

/** The texel at (u, v), 0..1 each, as 0..1 RGBA. */
export function sample(tex: Texture, u: number, v: number) {
    const x = Math.min(tex.width - 1, Math.max(0, Math.floor(u * tex.width)));
    const y = Math.min(tex.height - 1, Math.max(0, Math.floor(v * tex.height)));
    const o = (y * tex.width + x) * 4;
    return [0, 1, 2, 3].map((k) => tex.data[o + k] / 255) as [
        number,
        number,
        number,
        number
    ];
}

/** Keep only the triangles `keep` says to, and the vertices they use. */
export function keepTriangles(
    g: DonorGarment,
    keep: (t: number) => boolean
): DonorGarment {
    const used = new Map<number, number>();
    const order: number[] = [];
    const indices: number[] = [];
    for (let t = 0; t < g.indices.length / 3; t++) {
        if (!keep(t)) continue;
        for (let k = 0; k < 3; k++) {
            const i = g.indices[t * 3 + k];
            if (!used.has(i)) {
                used.set(i, order.length);
                order.push(i);
            }
            indices.push(used.get(i));
        }
    }
    const pick = <T extends Float32Array | Uint16Array>(a: T, w: number) => {
        const out = new (a.constructor as new (n: number) => T)(
            order.length * w
        );
        order.forEach((v, i) => {
            for (let k = 0; k < w; k++) out[i * w + k] = a[v * w + k];
        });
        return out;
    };
    return {
        ...g,
        positions: pick(g.positions, 3),
        normals: pick(g.normals, 3),
        uvs: pick(g.uvs, 2),
        joints: pick(g.joints, 4),
        weights: pick(g.weights, 4),
        indices: Uint32Array.from(indices),
    };
}

/**
 * Leave out the triangles the texture cuts away whole: the zigzag teeth
 * VRoid puts at hems and cuffs, which only its alpha hides.
 */
export function trimCutaway(g: DonorGarment, tex: Texture) {
    return keepTriangles(g, (t) => {
        let u = 0;
        let v = 0;
        for (let k = 0; k < 3; k++) {
            u += g.uvs[g.indices[t * 3 + k] * 2] / 3;
            v += g.uvs[g.indices[t * 3 + k] * 2 + 1] / 3;
        }
        return sample(tex, u, v)[3] >= 0.5;
    });
}

/** Each open rim of a garment, as rings of vertex indices. */
export function rims(g: DonorGarment) {
    const welded = weld(g.positions, 1e-4);
    const first = new Map<number, number>();
    for (let v = 0; v < welded.of.length; v++)
        if (!first.has(welded.of[v])) first.set(welded.of[v], v);
    return boundaryLoops(g.indices, welded).map((loop) =>
        loop.map((place) => first.get(place))
    );
}

/**
 * The far end of a sleeve (on side `side` of x = 0, beyond `beyond`): in
 * each of `around` directions round the arm, the point that reaches
 * furthest. VRoid turns its cuffs in, so the end is a fold, not an edge.
 */
export function sleeveEnd(
    g: DonorGarment,
    side: number,
    axis: (x: number) => [number, number],
    beyond: number,
    around = 24
) {
    const p = g.positions;
    const best = new Array<number>(around).fill(-1);
    const angle = (v: number) => {
        const [ay, az] = axis(p[v * 3]);
        return Math.atan2(p[v * 3 + 2] - az, p[v * 3 + 1] - ay);
    };
    for (let v = 0; v < p.length / 3; v++) {
        if (p[v * 3] * side < beyond) continue;
        const b = Math.min(
            around - 1,
            Math.floor(((angle(v) + Math.PI) / (2 * Math.PI)) * around)
        );
        if (best[b] < 0 || p[v * 3] * side > p[best[b] * 3] * side) best[b] = v;
    }
    return best.filter((v) => v >= 0);
}

/**
 * A tube that carries on from `rim` along the arm to `to` (the x the cuff
 * ends at), `ease` off the skin: a sleeve lengthened. Its uvs run along
 * the arm in u and round it in v, for painting on a tile of its own.
 */
/**
 * Cuts each short sleeve off square, `back` short of where it ends: a
 * clean ring for a long sleeve to carry on from, instead of the folded,
 * toothed hem.
 */
export function cutSleeves(g: DonorGarment, back: number): DonorGarment {
    const p = g.positions;
    const ends = [0, 0];
    for (let v = 0; v < p.length; v += 3) {
        const s = p[v] < 0 ? 0 : 1;
        ends[s] = Math.max(ends[s], Math.abs(p[v]));
    }
    const at = (x: number) => ends[x < 0 ? 0 : 1] - back;
    const kept = keepTriangles(g, (t) => {
        let x = 0;
        for (let k = 0; k < 3; k++) x += p[g.indices[t * 3 + k] * 3] / 3;
        return Math.abs(x) <= at(x);
    });
    const q = kept.positions;
    for (let v = 0; v < q.length; v += 3)
        if (Math.abs(q[v]) > at(q[v])) q[v] = Math.sign(q[v]) * at(q[v]);
    return kept;
}

/**
 * Takes in a puffed short sleeve so it runs on into a fitted one: past
 * `from` (distance out from the middle), each vertex comes in toward the
 * arm, all the way by the sleeve's end, never pushed out.
 */
export function slim(
    g: DonorGarment,
    axis: (x: number) => [number, number],
    from: number,
    body: BodyField,
    ease: (x: number) => number
) {
    const p = g.positions;
    const ends = [0, 0];
    for (let v = 0; v < p.length; v += 3) {
        const s = p[v] < 0 ? 0 : 1;
        ends[s] = Math.max(ends[s], Math.abs(p[v]));
    }
    for (let v = 0; v < p.length; v += 3) {
        const x = p[v];
        const ax = Math.abs(x);
        if (ax <= from) continue;
        const end = ends[x < 0 ? 0 : 1];
        const t = Math.min(1, (ax - from) / Math.max(0.01, end - from - 0.01));
        const blend = t * t * (3 - 2 * t);
        const [ay, az] = axis(x);
        const dy = p[v + 1] - ay;
        const dz = p[v + 2] - az;
        const r0 = Math.hypot(dy, dz);
        if (r0 < 1e-5) continue;
        const grown = {
            eval: (a: number, b: number, c: number) =>
                body.skin.eval(a, b, c) - ease(x),
        };
        const q = surfaceAlong(grown, [x, ay, az], [0, dy / r0, dz / r0], 0.2);
        const r1 = Math.hypot(q[1] - ay, q[2] - az);
        const r = r0 + (Math.min(r0, r1) - r0) * blend;
        p[v + 1] = ay + (dy / r0) * r;
        p[v + 2] = az + (dz / r0) * r;
    }
}

export function lengthen(
    g: DonorGarment,
    rim: number[],
    axis: (x: number) => [number, number],
    to: number,
    body: BodyField,
    ease: (x: number) => number,
    rings: number
): DonorGarment {
    const p = g.positions;
    const ring = [...rim, rim[0]];
    const n = ring.length;
    const startX = rim.reduce((s, v) => s + p[v * 3], 0) / rim.length;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    // Each rim point's direction round the arm, from the axis there.
    const around = ring.map((v) => {
        const [ay, az] = axis(p[v * 3]);
        const dy = p[v * 3 + 1] - ay;
        const dz = p[v * 3 + 2] - az;
        const l = Math.hypot(dy, dz) || 1;
        return [dy / l, dz / l];
    });
    for (let k = 0; k <= rings; k++) {
        const t = k / rings;
        ring.forEach((v, j) => {
            const x = p[v * 3] + (to - p[v * 3]) * t;
            const [ay, az] = axis(x);
            const grown = {
                eval: (a: number, b: number, c: number) =>
                    body.skin.eval(a, b, c) - ease(x),
            };
            const [dy, dz] = around[j];
            let q: V3;
            if (k === 0) q = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
            else {
                const s = surfaceAlong(grown, [x, ay, az], [0, dy, dz], 0.2);
                // Ease in from where the rim stood.
                const r0 = Math.hypot(p[v * 3 + 1] - ay, p[v * 3 + 2] - az);
                const r1 = Math.hypot(s[1] - ay, s[2] - az);
                const blend = Math.min(1, (t * rings) / 2);
                const r = r0 + (r1 - r0) * blend;
                q = [x, ay + dy * r, az + dz * r];
            }
            positions.push(...q);
            normals.push(0, dy, dz);
            uvs.push(t, j / (n - 1));
        });
    }
    const indices: number[] = [];
    for (let k = 0; k < rings; k++)
        for (let j = 0; j < n - 1; j++) {
            const a = k * n + j;
            const b = a + 1;
            const c = a + n;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
    // Facing out: wound the way its normals point.
    const P = positions;
    const [i0, i1, i2] = [indices[0], indices[1], indices[2]];
    const e1 = [0, 1, 2].map((k) => P[i1 * 3 + k] - P[i0 * 3 + k]);
    const e2 = [0, 1, 2].map((k) => P[i2 * 3 + k] - P[i0 * 3 + k]);
    const face = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
    ];
    if (
        face[0] * normals[i0 * 3] +
            face[1] * normals[i0 * 3 + 1] +
            face[2] * normals[i0 * 3 + 2] <
        0
    )
        for (let t = 0; t < indices.length; t += 3)
            [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
    const count = positions.length / 3;
    return {
        name: `${g.name} lengthened`,
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        uvs: Float32Array.from(uvs),
        indices: Uint32Array.from(indices),
        joints: new Uint16Array(count * 4),
        weights: new Float32Array(count * 4),
        image: new Uint8Array(),
        cutoff: 0,
    };
}

/**
 * Paint a garment anew: every texel its triangles cover gets `paint` of
 * the point of the garment there, its normal and its uv. Texels no
 * triangle covers stay clear.
 */
export function paint(
    g: DonorGarment,
    size: number,
    fn: (p: V3, n: V3, uv: [number, number]) => [number, number, number, number]
): Texture {
    const data = new Uint8Array(size * size * 4);
    const done = new Uint8Array(size * size);
    const write = (
        x: number,
        y: number,
        a: number,
        b: number,
        c: number,
        t: number
    ) => {
        const i = y * size + x;
        const idx = [
            g.indices[t * 3],
            g.indices[t * 3 + 1],
            g.indices[t * 3 + 2],
        ];
        const mixed = (arr: Float32Array, w: number) =>
            Array.from(
                { length: w },
                (_, k) =>
                    arr[idx[0] * w + k] * a +
                    arr[idx[1] * w + k] * b +
                    arr[idx[2] * w + k] * c
            );
        const p = mixed(g.positions, 3) as V3;
        const nn = mixed(g.normals, 3);
        const l = Math.hypot(...nn) || 1;
        const uv = mixed(g.uvs, 2) as [number, number];
        const rgba = fn(p, [nn[0] / l, nn[1] / l, nn[2] / l], uv);
        for (let k = 0; k < 4; k++)
            data[i * 4 + k] = Math.round(
                Math.min(1, Math.max(0, rgba[k])) * 255
            );
    };
    for (let t = 0; t < g.indices.length / 3; t++) {
        const uv = [0, 1, 2].map((k) => [
            g.uvs[g.indices[t * 3 + k] * 2] * size - 0.5,
            g.uvs[g.indices[t * 3 + k] * 2 + 1] * size - 0.5,
        ]);
        // Grown by a texel, so edges bleed outward and mipmaps keep clean.
        const lo = [0, 1].map((a) =>
            Math.max(0, Math.floor(Math.min(uv[0][a], uv[1][a], uv[2][a]) - 1))
        );
        const hi = [0, 1].map((a) =>
            Math.min(
                size - 1,
                Math.ceil(Math.max(uv[0][a], uv[1][a], uv[2][a]) + 1)
            )
        );
        const [x0, y0] = uv[0];
        const [x1, y1] = uv[1];
        const [x2, y2] = uv[2];
        const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        if (Math.abs(area) < 1e-9) continue;
        for (let y = lo[1]; y <= hi[1]; y++)
            for (let x = lo[0]; x <= hi[0]; x++) {
                let b = ((x - x0) * (y2 - y0) - (x2 - x0) * (y - y0)) / area;
                let c = ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0)) / area;
                let a = 1 - b - c;
                const inside = a >= -1e-6 && b >= -1e-6 && c >= -1e-6;
                // Within a texel of the edge: clamp onto the triangle.
                const edge = Math.min(a, b, c) * Math.sqrt(Math.abs(area));
                if (!inside && edge < -1.5) continue;
                a = Math.max(0, a);
                b = Math.max(0, b);
                c = Math.max(0, c);
                const s = a + b + c;
                // 1: inside a triangle; 2: bled into from one beside it.
                const i = y * size + x;
                if (inside ? done[i] === 1 : done[i] !== 0) continue;
                write(x, y, a / s, b / s, c / s, t);
                done[i] = inside ? 1 : 2;
            }
    }
    return { data, width: size, height: size };
}

/**
 * The same painting in another colour: each texel's lightness kept (its
 * folds and seams), its colour made `colour` at the texture's mean
 * lightness. Texels `keep` says to are left as they are.
 */
export function recolour(
    tex: Texture,
    colour: [number, number, number],
    keep: (u: number, v: number) => boolean = () => false
): Texture {
    const { data, width, height } = tex;
    const out = new Uint8Array(data);
    const lum = (o: number) =>
        (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    let sum = 0;
    let n = 0;
    for (let o = 0; o < data.length; o += 4)
        if (data[o + 3] > 128) (sum += lum(o)), n++;
    const mean = sum / Math.max(1, n);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            if (keep((x + 0.5) / width, (y + 0.5) / height)) continue;
            const o = (y * width + x) * 4;
            const k = lum(o) / mean;
            for (let c = 0; c < 3; c++)
                out[o + c] = Math.round(
                    Math.min(1, colour[c] * Math.pow(k, 1.1)) * 255
                );
        }
    return { data: out, width, height };
}
