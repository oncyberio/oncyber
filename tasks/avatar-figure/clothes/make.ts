/**
 * Makes the outfits figures wear (see ../clothes.ts): cuts each garment to
 * the figure's body, finds its surface, cuts it down, binds it to the
 * body's bones, shades its creases, and writes one GLB per outfit: one
 * mesh, one draw, with the body triangles it covers listed so the wearer
 * can leave them out.
 *
 * Bundled and run by ../clothes.ts; not run directly.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MeshoptSimplifier } from "meshoptimizer";
import { meshField } from "../../../frontend/features/procedural-avatar/kernel/mesher";
import {
    TriangleTree,
    bakeOpenness,
} from "../../../frontend/features/procedural-avatar/figure/bake";
import { bodyField } from "./bodyField";
import { loadFigure, type Figure } from "./figure";
import { stagehandOutfit, type Garment } from "./outfits";
import { writeGlb, type Piece } from "./glb";
import { CLOTH_KINDS } from "../../../frontend/features/procedural-avatar/figure/outfitFiles";

declare const process: { argv: string[]; env: Record<string, string> };

const ROOT = process.env.CLOTHES_ROOT;
const FIGURE = path.join(ROOT, "frontend/public/models/figure_male.vrm");
const OUT = path.join(ROOT, "frontend/public/models/clothes");

const clock = () => {
    const start = Date.now();
    return () => `${((Date.now() - start) / 1000).toFixed(1)} s`;
};

/** The garment's surface, cut down to its share of triangles. */
function surface(garment: Garment) {
    if (!garment.pair) return surfaceOf(garment.shape, garment, garment.box);
    // Each of a pair on its own, closed where it meets x = 0.
    const [min, max] = garment.box;
    const halves = ([-1, 1] as const).map((s) =>
        surfaceOf(
            {
                eval: (x, y, z) =>
                    Math.max(garment.shape.eval(x, y, z), -s * x + 0.0005),
            },
            { ...garment, triangles: garment.triangles / 2 },
            s < 0
                ? [min, [Math.min(max[0], 0.002), max[1], max[2]]]
                : [[Math.max(min[0], -0.002), min[1], min[2]], max]
        )
    );
    const [a, b] = halves;
    const offset = a.positions.length / 3;
    const join = (x: Float32Array, y: Float32Array) => {
        const out = new Float32Array(x.length + y.length);
        out.set(x);
        out.set(y, x.length);
        return out;
    };
    const indices = new Uint32Array(a.indices.length + b.indices.length);
    indices.set(a.indices);
    indices.set(
        b.indices.map((i) => i + offset),
        a.indices.length
    );
    return {
        positions: join(a.positions, b.positions),
        normals: join(a.normals, b.normals),
        indices,
        before: a.before + b.before,
    };
}

function surfaceOf(
    shape: Garment["shape"],
    garment: Pick<Garment, "cell" | "triangles">,
    box: Garment["box"]
) {
    const raw = meshField(shape, {
        min: box[0],
        max: box[1],
        cell: garment.cell,
    });
    let indices = raw.indices;
    const target = garment.triangles * 3;
    for (const error of [0.0005, 0.001, 0.002, 0.004, 0.008]) {
        if (indices.length <= target) break;
        [indices] = MeshoptSimplifier.simplify(
            raw.indices,
            raw.positions,
            3,
            target,
            error
        );
    }
    // Keep only the vertices still used.
    const used = new Map<number, number>();
    const order: number[] = [];
    const out = Uint32Array.from(indices, (i) => {
        if (!used.has(i)) {
            used.set(i, order.length);
            order.push(i);
        }
        return used.get(i);
    });
    const pick = (data: Float32Array) => {
        const r = new Float32Array(order.length * 3);
        order.forEach((v, i) => r.set(data.subarray(v * 3, v * 3 + 3), i * 3));
        return r;
    };
    return {
        positions: pick(raw.positions),
        normals: pick(raw.normals),
        indices: out,
        before: raw.indices.length / 3,
    };
}

/**
 * Bind each vertex to the bones of the skin nearest it, so the cloth moves
 * with what it covers: the six nearest skin vertices, by inverse square
 * distance, their bones summed and the four strongest kept.
 */
function bind(positions: Float32Array, figure: Figure, side?: Garment["side"]) {
    const count = positions.length / 3;
    const joints = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    const skin = figure.positions;
    const skinCount = skin.length / 3;
    const K = 6;
    const best = new Float64Array(K);
    const bestAt = new Int32Array(K);
    for (let v = 0; v < count; v++) {
        const x = positions[v * 3];
        const y = positions[v * 3 + 1];
        const z = positions[v * 3 + 2];
        const s = side ? side([x, y, z]) : 0;
        best.fill(Infinity);
        bestAt.fill(-1);
        for (let u = 0; u < skinCount; u++) {
            const sx = skin[u * 3];
            if (s && sx * s < 0) continue;
            const dx = sx - x;
            const dy = skin[u * 3 + 1] - y;
            const dz = skin[u * 3 + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d >= best[K - 1]) continue;
            let at = K - 1;
            while (at > 0 && best[at - 1] > d) {
                best[at] = best[at - 1];
                bestAt[at] = bestAt[at - 1];
                at--;
            }
            best[at] = d;
            bestAt[at] = u;
        }
        const sum = new Map<number, number>();
        for (let k = 0; k < K; k++) {
            const u = bestAt[k];
            if (u < 0) continue;
            const w = 1 / (best[k] + 1e-6);
            for (let j = 0; j < 4; j++) {
                const bone = figure.joints[u * 4 + j];
                const bw = figure.weights[u * 4 + j] * w;
                if (bw > 0) sum.set(bone, (sum.get(bone) || 0) + bw);
            }
        }
        const top = [...sum].sort((a, b) => b[1] - a[1]).slice(0, 4);
        const total = top.reduce((n, [, w]) => n + w, 0) || 1;
        top.forEach(([bone, w], k) => {
            joints[v * 4 + k] = bone;
            weights[v * 4 + k] = w / total;
        });
    }
    return { joints, weights };
}

/** The body's triangles that lie wholly under the cloth. */
function covered(figure: Figure, shapes: Garment["shape"][], depth = 0.003) {
    const skin = figure.positions;
    const inside = (v: number) =>
        shapes.some(
            (s) =>
                s.eval(skin[v * 3], skin[v * 3 + 1], skin[v * 3 + 2]) < -depth
        );
    const memo = new Map<number, boolean>();
    const at = (v: number) => {
        if (!memo.has(v)) memo.set(v, inside(v));
        return memo.get(v);
    };
    const hidden: number[] = [];
    for (let t = 0; t < figure.bodyTriangles; t++)
        if (
            at(figure.indices[t * 3]) &&
            at(figure.indices[t * 3 + 1]) &&
            at(figure.indices[t * 3 + 2])
        )
            hidden.push(t);
    return hidden;
}

/** A piece without its triangles that lie inside other garments. */
function uncovered(piece: Piece, others: Garment["shape"][], depth = 0.002) {
    const p = piece.positions;
    const count = p.length / 3;
    const inside = new Uint8Array(count);
    for (let v = 0; v < count; v++)
        inside[v] = others.some(
            (s) => s.eval(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]) < -depth
        )
            ? 1
            : 0;
    const kept: number[] = [];
    for (let t = 0; t < piece.indices.length; t += 3) {
        const [a, b, c] = [
            piece.indices[t],
            piece.indices[t + 1],
            piece.indices[t + 2],
        ];
        if (!(inside[a] && inside[b] && inside[c])) kept.push(a, b, c);
    }
    // Keep only the vertices still used.
    const used = new Map<number, number>();
    const order: number[] = [];
    const indices = Uint32Array.from(kept, (i) => {
        if (!used.has(i)) {
            used.set(i, order.length);
            order.push(i);
        }
        return used.get(i);
    });
    const pick = <T extends Float32Array | Uint16Array>(
        data: T,
        width: number
    ) => {
        const out = new (data.constructor as new (n: number) => T)(
            order.length * width
        );
        order.forEach((v, i) => {
            for (let k = 0; k < width; k++)
                out[i * width + k] = data[v * width + k];
        });
        return out;
    };
    return {
        positions: pick(piece.positions, 3),
        normals: pick(piece.normals, 3),
        colours: pick(piece.colours, 3),
        kinds: pick(piece.kinds, 1),
        joints: pick(piece.joints, 4),
        weights: pick(piece.weights, 4),
        indices,
    };
}

const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

await MeshoptSimplifier.ready;
const only = process.argv[2];
const time = clock();
const figure = await loadFigure(FIGURE);
const body = bodyField(figure);
console.log(`figure and its field: ${time()}`);
mkdirSync(OUT, { recursive: true });
for (const outfit of [stagehandOutfit(figure, body)]) {
    if (only && outfit.id !== only) continue;
    const pieces: Piece[] = [];
    for (const garment of outfit.garments) {
        const took = clock();
        const mesh = surface(garment);
        const skin = bind(mesh.positions, figure, garment.side);
        const count = mesh.positions.length / 3;
        const colours = new Float32Array(count * 3);
        const kinds = new Float32Array(count);
        for (let v = 0; v < count; v++) {
            const p: [number, number, number] = [
                mesh.positions[v * 3],
                mesh.positions[v * 3 + 1],
                mesh.positions[v * 3 + 2],
            ];
            colours.set(garment.colour(p).map(toLinear), v * 3);
            kinds[v] = CLOTH_KINDS[garment.finish?.(p) ?? "plain"];
        }
        pieces.push({ name: garment.name, ...mesh, ...skin, colours, kinds });
        console.log(
            `${outfit.id} ${garment.name}: ${mesh.before} → ${
                mesh.indices.length / 3
            } triangles, ${count} vertices, ${took()}`
        );
    }
    // Cloth under other cloth never shows: the shirt tucked into the
    // trousers, the socks inside the shoes.
    outfit.garments.forEach((garment, g) => {
        const others = outfit.garments
            .filter((_, o) => o !== g)
            .map((o) => o.shape);
        const piece = pieces[g];
        const before = piece.indices.length / 3;
        Object.assign(piece, uncovered(piece, others));
        const after = piece.indices.length / 3;
        if (after < before)
            console.log(
                `${outfit.id} ${garment.name}: ${
                    before - after
                } triangles under other cloth left out`
            );
    });
    // Creases and the places cloth meets cloth or skin, darker.
    const all = [
        ...pieces.map((p) => ({ positions: p.positions, indices: p.indices })),
        { positions: figure.positions, indices: figure.indices },
    ];
    const total = all.reduce((n, p) => n + p.positions.length, 0);
    const positions = new Float32Array(total);
    const indices: number[] = [];
    let base = 0;
    for (const part of all) {
        positions.set(part.positions, base * 3);
        for (const i of part.indices) indices.push(i + base);
        base += part.positions.length / 3;
    }
    const tree = new TriangleTree(positions, Uint32Array.from(indices));
    for (const piece of pieces) {
        const count = piece.positions.length / 3;
        const open = bakeOpenness(
            {
                positions: piece.positions,
                normals: piece.normals,
                indices: piece.indices,
            },
            { of: Uint32Array.from({ length: count }, (_, i) => i), count },
            tree,
            { samples: 48, reach: 0.06 }
        );
        for (let v = 0; v < count; v++) {
            const s = 0.4 + 0.6 * Math.pow(open[v], 1.2);
            for (let k = 0; k < 3; k++) piece.colours[v * 3 + k] *= s;
        }
    }
    const hides = covered(
        figure,
        outfit.garments.map((g) => g.shape)
    );
    const figureHash = createHash("sha256")
        .update(readFileSync(FIGURE))
        .digest("hex");
    writeFileSync(
        path.join(OUT, `${outfit.id}.glb`),
        writeGlb(pieces, {
            name: outfit.id,
            bones: figure.bones,
            hides,
            figure: figureHash.slice(0, 16),
        })
    );
    console.log(
        `${outfit.id}: ${pieces.reduce(
            (n, p) => n + p.indices.length / 3,
            0
        )} triangles, hides ${hides.length} of ${
            figure.bodyTriangles
        } body triangles, ${time()}`
    );
}
