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
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { meshField } from "../../../frontend/features/procedural-avatar/kernel/mesher";
import {
    TriangleTree,
    bakeOpenness,
} from "../../../frontend/features/procedural-avatar/figure/bake";
import { bodyField } from "./bodyField";
import { loadFigure, type Figure } from "./figure";
import { stagehandOutfit, type Garment } from "./outfits";
import { writeGlb, type Piece } from "./glb";
import { donorClothes, type DonorGarment } from "./donor";
import type { Cut, Texture } from "./tailor";
import { createRequire } from "node:module";
import { CLOTH_KINDS } from "../../../frontend/features/procedural-avatar/figure/outfitFiles";

declare const process: { argv: string[]; env: Record<string, string> };

const ROOT = process.env.CLOTHES_ROOT;
const FIGURE = path.join(ROOT, "frontend/public/models/figure_male.vrm");
const OUT = path.join(ROOT, "frontend/public/models/clothes");
const need = createRequire(import.meta.url);
// Next.js's image library, from the repository's install.
const sharp = need(path.join(ROOT, "node_modules/sharp"));

/** The texture every outfit's garments share, and where each sits on it. */
const ATLAS = 2048;
const BLANK: [number, number] = [(ATLAS - 32) / ATLAS, (ATLAS - 32) / ATLAS];
const TILES = [
    { x: 0, y: 0, size: 1024 },
    { x: 1024, y: 0, size: 1024 },
    ...[0, 512, 1024, 1536].map((x) => ({ x, y: 1024, size: 512 })),
    // The last spot holds the blank in its far corner.
    ...[0, 512, 1024].map((x) => ({ x, y: 1536, size: 512 })),
];

async function decode(png: Uint8Array): Promise<Texture> {
    const { data, info } = await sharp(Buffer.from(png))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return {
        data: new Uint8Array(data),
        width: info.width,
        height: info.height,
    };
}

async function atlas(cut: Cut[]) {
    if (cut.length > TILES.length) throw new Error("Too many textures");
    // The largest first, onto the largest tiles.
    const order = cut
        .map((c, i) => i)
        .sort((a, b) => cut[b].size - cut[a].size);
    const tileOf = new Map(order.map((c, i) => [c, i]));
    const garments = cut.map((c) => c.garment);
    const layers = await Promise.all(
        cut.map(async (c, i) => ({
            input: await sharp(Buffer.from(c.texture.data), {
                raw: {
                    width: c.texture.width,
                    height: c.texture.height,
                    channels: 4,
                },
            })
                .resize(TILES[tileOf.get(i)].size, TILES[tileOf.get(i)].size)
                .png()
                .toBuffer(),
            left: TILES[tileOf.get(i)].x,
            top: TILES[tileOf.get(i)].y,
        }))
    );
    layers.push({
        input: await sharp({
            create: {
                width: 64,
                height: 64,
                channels: 4,
                background: "#ffffff",
            },
        })
            .png()
            .toBuffer(),
        left: ATLAS - 64,
        top: ATLAS - 64,
    });
    const webp: Buffer = await sharp({
        create: {
            width: ATLAS,
            height: ATLAS,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite(layers)
        .webp({ quality: 88, alphaQuality: 100 })
        .toBuffer();
    // Each garment's uvs, onto its tile.
    garments.forEach((g, i) => {
        const t = TILES[tileOf.get(i)];
        for (let v = 0; v < g.uvs.length; v += 2) {
            g.uvs[v] = (t.x + g.uvs[v] * t.size) / ATLAS;
            g.uvs[v + 1] = (t.y + g.uvs[v + 1] * t.size) / ATLAS;
        }
    });
    return new Uint8Array(webp);
}

/** Body triangles wholly below a height: the feet, inside shoes. */
function below(figure: Figure, height: number) {
    const hidden: number[] = [];
    const y = (i: number) => figure.positions[figure.indices[i] * 3 + 1];
    for (let t = 0; t < figure.bodyTriangles; t++)
        if (y(t * 3) < height && y(t * 3 + 1) < height && y(t * 3 + 2) < height)
            hidden.push(t);
    return hidden;
}

/** Body triangles under the donor garments: each corner sees cloth along its normal. */
function coveredBy(figure: Figure, garments: DonorGarment[]) {
    if (!garments.length) return [];
    const total = garments.reduce((n, g) => n + g.positions.length, 0);
    const positions = new Float32Array(total);
    const indices: number[] = [];
    let base = 0;
    for (const g of garments) {
        positions.set(g.positions, base * 3);
        for (const i of g.indices) indices.push(i + base);
        base += g.positions.length / 3;
    }
    const tree = new TriangleTree(positions, Uint32Array.from(indices));
    const p = figure.positions;
    const n = figure.normals;
    const memo = new Map<number, boolean>();
    const under = (v: number) => {
        if (!memo.has(v)) {
            const hit = tree.cast(
                p[v * 3] + n[v * 3] * 0.0005,
                p[v * 3 + 1] + n[v * 3 + 1] * 0.0005,
                p[v * 3 + 2] + n[v * 3 + 2] * 0.0005,
                n[v * 3],
                n[v * 3 + 1],
                n[v * 3 + 2],
                0.08
            );
            memo.set(v, hit < 0.08);
        }
        return memo.get(v);
    };
    const hidden: number[] = [];
    for (let t = 0; t < figure.bodyTriangles; t++)
        if (
            under(figure.indices[t * 3]) &&
            under(figure.indices[t * 3 + 1]) &&
            under(figure.indices[t * 3 + 2])
        )
            hidden.push(t);
    return hidden;
}

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
/**
 * Pushes each vertex out from the body's centre line (x = 0, at the
 * vertex's own height) until it clears the cloth in `tree`, then lets
 * every vertex take the largest push within 3 cm, so rigid parts move
 * as one and long thin parts (a band, a cable) bend over what's under.
 */
function wrap(name: string, p: Float32Array, tree: TriangleTree) {
    const count = p.length / 3;
    const dirs = new Float32Array(p.length);
    const need = new Float32Array(count);
    const centreZ = 0.005;
    for (let v = 0; v < count; v++) {
        const x = p[v * 3];
        const z = p[v * 3 + 2] - centreZ;
        const l = Math.hypot(x, z) || 1;
        const d = [x / l, 0, z / l];
        dirs.set(d, v * 3);
        // Cloth between the vertex and the outside: the far side of it.
        const reach = 0.04;
        const from = [
            p[v * 3] + d[0] * reach,
            p[v * 3 + 1],
            p[v * 3 + 2] + d[2] * reach,
        ];
        const hit = tree.cast(
            from[0],
            from[1],
            from[2],
            -d[0],
            0,
            -d[2],
            reach
        );
        if (hit < reach) need[v] = reach - hit + 0.0025;
    }
    const pushed = new Float32Array(count);
    const r2 = 0.03 * 0.03;
    for (let v = 0; v < count; v++) {
        let m = need[v];
        for (let u = 0; u < count; u++) {
            if (need[u] <= m) continue;
            const dx = p[u * 3] - p[v * 3];
            const dy = p[u * 3 + 1] - p[v * 3 + 1];
            const dz = p[u * 3 + 2] - p[v * 3 + 2];
            if (dx * dx + dy * dy + dz * dz < r2) m = need[u];
        }
        pushed[v] = m;
    }
    let most = 0;
    for (let v = 0; v < count; v++) {
        for (const a of [0, 2]) p[v * 3 + a] += dirs[v * 3 + a] * pushed[v];
        most = Math.max(most, pushed[v]);
    }
    console.log(
        `${name}: wrapped over the clothes, up to ${(most * 1000).toFixed(
            1
        )} mm`
    );
}

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
await MeshoptEncoder.ready;
const models = process.argv[2];
const only = process.argv[3];
const time = clock();
const figure = await loadFigure(FIGURE);
const body = bodyField(figure);
console.log(`figure and its field: ${time()}`);
mkdirSync(OUT, { recursive: true });
for (const outfit of [stagehandOutfit(figure, body)]) {
    if (only && outfit.id !== only) continue;
    const pieces: Piece[] = [];
    const donated = outfit.donor
        ? donorClothes(
              path.join(models, outfit.donor.model),
              figure,
              body,
              outfit.donor.pick
          )
        : [];
    let cut: Cut[] = await Promise.all(
        donated.map(async (garment) => ({
            garment,
            texture: await decode(garment.image),
            size: /Shoes/.test(garment.name) ? 512 : 1024,
            rebind: false,
        }))
    );
    if (outfit.donor?.tailor) cut = outfit.donor.tailor(cut);
    for (const c of cut)
        if (c.rebind) {
            const skin = bind(c.garment.positions, figure, c.side);
            c.garment.joints = skin.joints;
            c.garment.weights = skin.weights;
        }
    const webp = cut.length ? await atlas(cut) : undefined;
    for (const { garment: g } of cut) {
        const count = g.positions.length / 3;
        pieces.push({
            name: g.name,
            positions: g.positions,
            normals: g.normals,
            uvs: g.uvs,
            indices: g.indices,
            joints: g.joints,
            weights: g.weights,
            colours: new Float32Array(count * 3).fill(1),
            kinds: new Float32Array(count).fill(CLOTH_KINDS.plain),
        });
        console.log(
            `${outfit.id} ${g.name}: ${g.indices.length / 3} triangles, from ${
                outfit.donor.model
            }`
        );
    }
    const own = pieces.length;
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
    // Things worn over the donor's clothes, brought out in front of them.
    if (cut.length) {
        const all = cut.map((c) => c.garment);
        const total = all.reduce((n, g) => n + g.positions.length, 0);
        const positions = new Float32Array(total);
        const indices: number[] = [];
        let base = 0;
        for (const g of all) {
            positions.set(g.positions, base * 3);
            for (const i of g.indices) indices.push(i + base);
            base += g.positions.length / 3;
        }
        const tree = new TriangleTree(positions, Uint32Array.from(indices));
        outfit.garments.forEach((garment, g) => {
            if (!garment.over) return;
            const piece = pieces[own + g];
            const p = piece.positions;
            if (garment.over === "wrap") {
                wrap(garment.name, p, tree);
                return;
            }
            let shift = 0;
            for (let v = 0; v < p.length; v += 3) {
                // Only what hangs in front (a headphone band goes behind).
                if (p[v + 2] > -0.03) continue;
                const hit = tree.cast(p[v], p[v + 1], p[v + 2], 0, 0, -1, 0.03);
                if (hit < 0.03) shift = Math.max(shift, hit + 0.0025);
            }
            for (let v = 0; v < p.length; v += 3) p[v + 2] -= shift;
            if (shift)
                console.log(
                    `${outfit.id} ${garment.name}: brought ${(
                        shift * 1000
                    ).toFixed(1)} mm forward`
                );
        });
    }
    // Cloth under other cloth never shows: the shirt tucked into the
    // trousers, the socks inside the shoes.
    outfit.garments.forEach((garment, g) => {
        const others = outfit.garments
            .filter((_, o) => o !== g)
            .map((o) => o.shape);
        const piece = pieces[own + g];
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
            // Painted garments carry their own shading: only a touch more.
            const s = piece.uvs
                ? 0.75 + 0.25 * open[v]
                : 0.4 + 0.6 * Math.pow(open[v], 1.2);
            for (let k = 0; k < 3; k++) piece.colours[v * 3 + k] *= s;
        }
    }
    const hides = [
        ...new Set([
            ...covered(
                figure,
                outfit.garments.map((g) => g.shape)
            ),
            ...coveredBy(
                figure,
                cut.map((c) => c.garment)
            ),
            ...below(figure, outfit.donor?.feet ?? 0),
        ]),
    ].sort((a, b) => a - b);
    const figureHash = createHash("sha256")
        .update(readFileSync(FIGURE))
        .digest("hex");
    writeFileSync(
        path.join(OUT, `${outfit.id}.glb`),
        writeGlb(
            pieces,
            {
                name: outfit.id,
                bones: figure.bones,
                hides,
                figure: figureHash.slice(0, 16),
            },
            MeshoptEncoder,
            webp ? { webp, cutoff: 0.5, blank: BLANK } : undefined
        )
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
