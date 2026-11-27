/**
 * Builds a figure: a bare, texture-free humanoid that characters are made
 * from (frontend/features/procedural-avatar/figure).
 *
 *   cd tasks/avatar-figure
 *   npm run build -- /path/to/Base_Male.vrm
 *
 * Reads a base model (VRM 0.x, with the usual face parts and `Fcl_*`
 * morphs) and writes frontend/public/models/figure_male.vrm:
 *
 * - keeps the skin, the whites of the eyes, the inside of the mouth, and
 *   the flat pieces the irises, lid lines, lashes and brows sit on; leaves
 *   out the clothes, the hair and every image;
 * - joins them into three primitives (body, face, the face's ink), each
 *   vertex saying which part it belongs to;
 * - works out, for every vertex of skin, how open it is to the light, how
 *   sharply the surface turns there and how much flesh lies behind it,
 *   and stores that in place of painted shading;
 * - keeps the skeleton, the weights, every face morph (only the vertices
 *   each one moves) and the VRM description of them, so the result still
 *   poses, blinks and talks like the model it came from;
 * - stands the bare feet on the floor.
 *
 * The body and its proportions are not touched. The output depends only
 * on the input: run it twice, get the same file.
 *
 * The base is not kept here (it is 18 MB, nearly all of it images). The
 * figure in the repository was built from `Base_Male.vrm`, a public-domain
 * (CC0) model, sha256
 * ab9af434a229283c192546486f9e6eb9cd855bf7d8d45b5037ac211938cb903c.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
    TriangleTree,
    bakeCurvature,
    bakeDepth,
    bakeOpenness,
    bakeSkylight,
    boundaryLoops,
    neighbours,
    smoothOver,
    weld,
} from "../../frontend/features/procedural-avatar/figure/bake.ts";
import {
    BAKE_ATTRIBUTE,
    FIGURE_FORMAT,
    FIGURE_MATERIALS,
    PART_ATTRIBUTE,
    SKY_DIRECTION,
    encodeRound,
    encodeThin,
    partId,
    type FigureInfo,
    type FigurePart,
    type FigureRim,
} from "../../frontend/features/procedural-avatar/figure/format.ts";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "frontend/public/models/figure_male.vrm");

type Json = Record<string, any>;

// --- Reading -------------------------------------------------------------

const COMPONENT: Record<
    number,
    { bytes: number; read: (view: DataView, at: number) => number; max: number }
> = {
    5120: { bytes: 1, read: (v, at) => v.getInt8(at), max: 127 },
    5121: { bytes: 1, read: (v, at) => v.getUint8(at), max: 255 },
    5122: { bytes: 2, read: (v, at) => v.getInt16(at, true), max: 32767 },
    5123: { bytes: 2, read: (v, at) => v.getUint16(at, true), max: 65535 },
    5125: { bytes: 4, read: (v, at) => v.getUint32(at, true), max: 1 },
    5126: { bytes: 4, read: (v, at) => v.getFloat32(at, true), max: 1 },
};
const WIDTH: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
};

function readGlb(file: Buffer) {
    if (file.readUInt32LE(0) !== 0x46546c67) throw new Error("Not a GLB file");
    const jsonLength = file.readUInt32LE(12);
    const json: Json = JSON.parse(
        file.subarray(20, 20 + jsonLength).toString("utf8")
    );
    const binStart = 20 + jsonLength + 8;
    const bin = file.subarray(
        binStart,
        binStart + file.readUInt32LE(20 + jsonLength)
    );
    const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const cache = new Map<number, Float64Array>();
    /** An accessor's values, one row after another. */
    const accessor = (index: number): Float64Array => {
        if (cache.has(index)) return cache.get(index);
        const a = json.accessors[index];
        const width = WIDTH[a.type];
        const component = COMPONENT[a.componentType];
        const out = new Float64Array(a.count * width);
        const scale = a.normalized ? 1 / component.max : 1;
        const fill = (
            bufferView: number,
            offset: number,
            count: number,
            put: (row: number, column: number, value: number) => void,
            kind = component,
            columns = width
        ) => {
            const bv = json.bufferViews[bufferView];
            const stride = bv.byteStride || kind.bytes * columns;
            const start = (bv.byteOffset || 0) + offset;
            for (let row = 0; row < count; row++)
                for (let column = 0; column < columns; column++)
                    put(
                        row,
                        column,
                        kind.read(
                            view,
                            start + row * stride + column * kind.bytes
                        )
                    );
        };
        if (a.bufferView !== undefined)
            fill(a.bufferView, a.byteOffset || 0, a.count, (r, c, value) => {
                out[r * width + c] = value * scale;
            });
        if (a.sparse) {
            const which = new Uint32Array(a.sparse.count);
            fill(
                a.sparse.indices.bufferView,
                a.sparse.indices.byteOffset || 0,
                a.sparse.count,
                (r, _c, value) => {
                    which[r] = value;
                },
                COMPONENT[a.sparse.indices.componentType],
                1
            );
            fill(
                a.sparse.values.bufferView,
                a.sparse.values.byteOffset || 0,
                a.sparse.count,
                (r, c, value) => {
                    out[which[r] * width + c] = value * scale;
                }
            );
        }
        cache.set(index, out);
        return out;
    };
    return { json, accessor };
}

// --- Choosing what to keep ------------------------------------------------

type Primitive = "body" | "face" | "ink";

/** Which of the base's materials become which part of the figure. */
const KEEP: { material: RegExp; primitive: Primitive; part: FigurePart }[] = [
    { material: /_Body_\d+_SKIN$/, primitive: "body", part: "skin" },
    { material: /_Face_\d+_SKIN$/, primitive: "face", part: "skin" },
    { material: /_EyeWhite_/, primitive: "face", part: "eyeWhite" },
    // Split below into teeth, tongue and the rest.
    { material: /_FaceMouth_/, primitive: "face", part: "mouth" },
    { material: /_EyeIris_/, primitive: "ink", part: "iris" },
    { material: /_FaceEyeline_/, primitive: "ink", part: "lidLine" },
    { material: /_FaceEyelash_/, primitive: "ink", part: "lash" },
    { material: /_FaceBrow_/, primitive: "ink", part: "brow" },
];

/** Triangles of one part, still pointing at the base's vertices. */
interface Piece {
    part: FigurePart;
    primitive: Primitive;
    /** The base's mesh the piece comes from. */
    mesh: number;
    /** Material name in the base, for the report. */
    from: string;
    position: Float64Array;
    normal: Float64Array;
    uv: Float64Array;
    joints: Float64Array;
    weights: Float64Array;
    targets: Float64Array[];
    indices: Uint32Array;
}

/** Groups of triangles that share vertices. */
function islands(indices: Uint32Array): Uint32Array[] {
    const parent = new Map<number, number>();
    const find = (x: number): number => {
        let root = x;
        while (parent.get(root) !== root) root = parent.get(root);
        while (parent.get(x) !== root) {
            const up = parent.get(x);
            parent.set(x, root);
            x = up;
        }
        return root;
    };
    for (const v of indices) if (!parent.has(v)) parent.set(v, v);
    for (let t = 0; t < indices.length; t += 3) {
        const a = find(indices[t]);
        parent.set(find(indices[t + 1]), a);
        parent.set(find(indices[t + 2]), a);
    }
    const groups = new Map<number, number[]>();
    for (let t = 0; t < indices.length; t += 3) {
        const root = find(indices[t]);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(indices[t], indices[t + 1], indices[t + 2]);
    }
    return [...groups.values()].map((group) => Uint32Array.from(group));
}

// --- Writing -------------------------------------------------------------

class GlbWriter {
    private chunks: Buffer[] = [];
    private length = 0;
    readonly bufferViews: Json[] = [];
    readonly accessors: Json[] = [];

    private view(data: ArrayBufferView, target?: number) {
        while (this.length % 4) {
            this.chunks.push(Buffer.alloc(1));
            this.length++;
        }
        const bytes = Buffer.from(
            data.buffer,
            data.byteOffset,
            data.byteLength
        );
        this.bufferViews.push({
            buffer: 0,
            byteOffset: this.length,
            byteLength: bytes.length,
            ...(target ? { target } : {}),
        });
        this.chunks.push(bytes);
        this.length += bytes.length;
        return this.bufferViews.length - 1;
    }

    accessor(
        data: Float32Array | Uint16Array | Uint8Array | Uint32Array,
        type: keyof typeof WIDTH,
        options: {
            normalized?: boolean;
            target?: number;
            bounds?: boolean;
        } = {}
    ) {
        const width = WIDTH[type];
        const componentType =
            data instanceof Float32Array
                ? 5126
                : data instanceof Uint16Array
                ? 5123
                : data instanceof Uint32Array
                ? 5125
                : 5121;
        const accessor: Json = {
            bufferView: this.view(data, options.target),
            componentType,
            count: data.length / width,
            type,
        };
        if (options.normalized) accessor.normalized = true;
        if (options.bounds) Object.assign(accessor, bounds(data, width));
        this.accessors.push(accessor);
        return this.accessors.length - 1;
    }

    /** A morph target: only the vertices that move are stored. */
    sparse(count: number, moved: number[], deltas: number[]) {
        const values = Float32Array.from(deltas);
        const accessor: Json = {
            componentType: 5126,
            count,
            type: "VEC3",
            ...(moved.length
                ? bounds(values, 3, true)
                : { min: [0, 0, 0], max: [0, 0, 0] }),
        };
        if (moved.length)
            accessor.sparse = {
                count: moved.length,
                indices: {
                    bufferView: this.view(Uint16Array.from(moved)),
                    componentType: 5123,
                },
                values: { bufferView: this.view(values) },
            };
        this.accessors.push(accessor);
        return this.accessors.length - 1;
    }

    finish(json: Json): Buffer {
        while (this.length % 4) {
            this.chunks.push(Buffer.alloc(1));
            this.length++;
        }
        json.buffers = [{ byteLength: this.length }];
        json.bufferViews = this.bufferViews;
        json.accessors = this.accessors;
        let text = Buffer.from(JSON.stringify(json), "utf8");
        if (text.length % 4)
            text = Buffer.concat([
                text,
                Buffer.alloc(4 - (text.length % 4), 0x20),
            ]);
        const header = Buffer.alloc(12);
        header.writeUInt32LE(0x46546c67, 0);
        header.writeUInt32LE(2, 4);
        header.writeUInt32LE(12 + 8 + text.length + 8 + this.length, 8);
        const jsonHeader = Buffer.alloc(8);
        jsonHeader.writeUInt32LE(text.length, 0);
        jsonHeader.writeUInt32LE(0x4e4f534a, 4);
        const binHeader = Buffer.alloc(8);
        binHeader.writeUInt32LE(this.length, 0);
        binHeader.writeUInt32LE(0x004e4942, 4);
        return Buffer.concat([
            header,
            jsonHeader,
            text,
            binHeader,
            ...this.chunks,
        ]);
    }
}

function bounds(data: ArrayLike<number>, width: number, withZero = false) {
    const min = new Array(width).fill(withZero ? 0 : Infinity);
    const max = new Array(width).fill(withZero ? 0 : -Infinity);
    for (let i = 0; i < data.length; i++) {
        const column = i % width;
        if (data[i] < min[column]) min[column] = data[i];
        if (data[i] > max[column]) max[column] = data[i];
    }
    // As the 32-bit floats they are stored as.
    return { min: min.map(Math.fround), max: max.map(Math.fround) };
}

// --- The build -----------------------------------------------------------

function build(sourcePath: string) {
    const file = readFileSync(sourcePath);
    const { json, accessor } = readGlb(file);
    const vrm = json.extensions?.VRM;
    if (!vrm) throw new Error("The base has to be a VRM 0.x model");
    const report: string[] = [];
    const say = (line: string) => report.push(line);

    // The pieces to keep.
    const pieces: Piece[] = [];
    json.meshes.forEach((mesh: Json, meshIndex: number) => {
        for (const primitive of mesh.primitives) {
            const name: string = json.materials[primitive.material].name;
            const keep = KEEP.find((k) => k.material.test(name));
            if (!keep) {
                say(`  left out: ${name}`);
                continue;
            }
            const base = {
                primitive: keep.primitive,
                mesh: meshIndex,
                from: name,
                position: accessor(primitive.attributes.POSITION),
                normal: accessor(primitive.attributes.NORMAL),
                uv: accessor(primitive.attributes.TEXCOORD_0),
                joints: accessor(primitive.attributes.JOINTS_0),
                weights: accessor(primitive.attributes.WEIGHTS_0),
                targets: (primitive.targets || []).map((t: Json) =>
                    accessor(t.POSITION)
                ),
            };
            const indices = Uint32Array.from(accessor(primitive.indices));
            if (keep.part !== "mouth") {
                pieces.push({ ...base, part: keep.part, indices });
                continue;
            }
            // The inside of the mouth is told apart by where its pieces
            // sit on the base's image: teeth on the left half, the tongue
            // and the roof on the top right, the walls below.
            const groups = islands(indices).map((group) => {
                let u = 0;
                let v = 0;
                for (const vertex of group) {
                    u += base.uv[vertex * 2] / group.length;
                    v += base.uv[vertex * 2 + 1] / group.length;
                }
                return { group, u, v };
            });
            const topRight = groups.filter((g) => g.u >= 0.5 && g.v < 0.5);
            // Of those, the tongue is the lower-left one.
            const tongue = topRight.sort((a, b) => b.v - b.u - (a.v - a.u))[0];
            for (const g of groups) {
                const part: FigurePart =
                    g.u < 0.5 && g.v < 0.5
                        ? "teeth"
                        : g === tongue
                        ? "tongue"
                        : "mouth";
                say(
                    `  mouth piece of ${g.group.length / 3} triangles at ` +
                        `${g.u.toFixed(2)}, ${g.v.toFixed(2)} is ${part}`
                );
                pieces.push({ ...base, part, indices: g.group });
            }
        }
    });

    // Stand the bare feet on the floor.
    let floor = Infinity;
    for (const piece of pieces)
        if (piece.primitive === "body")
            for (const v of piece.indices)
                floor = Math.min(floor, piece.position[v * 3 + 1]);
    say(`  feet were ${(floor * 1000).toFixed(1)} mm off the floor`);
    const lowered = new Set<Float64Array>();
    for (const piece of pieces) {
        if (lowered.has(piece.position)) continue;
        lowered.add(piece.position);
        // A copy, so the reader's cache keeps the base as it was.
        piece.position = Float64Array.from(piece.position);
    }
    {
        // Pieces of one mesh share their vertices: lower each pool once.
        const pools = new Map<string, Float64Array>();
        for (const piece of pieces) {
            const key = `${piece.mesh}`;
            if (!pools.has(key)) {
                const pool = piece.position;
                for (let i = 1; i < pool.length; i += 3) pool[i] -= floor;
                pools.set(key, pool);
            }
            piece.position = pools.get(key);
        }
    }

    // Put each primitive's pieces together.
    const order: FigurePart[] = [
        "skin",
        "eyeWhite",
        "teeth",
        "tongue",
        "mouth",
        "iris",
        "lidLine",
        "lash",
        "brow",
    ];
    const made = (["body", "face", "ink"] as Primitive[]).map((primitive) => {
        const mine = pieces
            .filter((p) => p.primitive === primitive)
            .sort((a, b) => order.indexOf(a.part) - order.indexOf(b.part));
        const position: number[] = [];
        const normal: number[] = [];
        const uv: number[] = [];
        const joints: number[] = [];
        const weights: number[] = [];
        const part: number[] = [];
        const indices: number[] = [];
        /** For each new vertex: its piece and the base's vertex. */
        const origin: { piece: Piece; vertex: number }[] = [];
        for (const piece of mine) {
            const remap = new Map<number, number>();
            for (const vertex of piece.indices) {
                let to = remap.get(vertex);
                if (to === undefined) {
                    to = origin.length;
                    remap.set(vertex, to);
                    origin.push({ piece, vertex });
                    for (let k = 0; k < 3; k++) {
                        position.push(piece.position[vertex * 3 + k]);
                        normal.push(piece.normal[vertex * 3 + k]);
                    }
                    uv.push(piece.uv[vertex * 2], piece.uv[vertex * 2 + 1]);
                    for (let k = 0; k < 4; k++) {
                        joints.push(piece.joints[vertex * 4 + k]);
                        weights.push(piece.weights[vertex * 4 + k]);
                    }
                    part.push(partId(piece.part));
                }
                indices.push(to);
            }
        }
        return {
            primitive,
            pieces: mine,
            position: Float32Array.from(position),
            normal: Float32Array.from(normal),
            uv,
            joints,
            weights,
            part,
            indices: Uint32Array.from(indices),
            origin,
            bake: new Uint8Array(origin.length * 4),
            partBytes: new Uint8Array(origin.length * 4),
            coords: new Float32Array(origin.length * 2),
        };
    });
    const [body, face, ink] = made;

    // Light the skin: every vertex of skin, of both primitives, as one
    // surface, so that the neck and the hairline have no seam.
    {
        const skin = [body, face].flatMap((m) =>
            m.origin
                .map((o, vertex) => ({ m, vertex, o }))
                .filter(({ o }) => o.piece.part === "skin")
        );
        const index = new Map<object, Map<number, number>>();
        skin.forEach(({ m, vertex }, i) => {
            if (!index.has(m)) index.set(m, new Map());
            index.get(m).set(vertex, i);
        });
        const positions = new Float32Array(skin.length * 3);
        const normals = new Float32Array(skin.length * 3);
        skin.forEach(({ m, vertex }, i) => {
            for (let k = 0; k < 3; k++) {
                positions[i * 3 + k] = m.position[vertex * 3 + k];
                normals[i * 3 + k] = m.normal[vertex * 3 + k];
            }
        });
        const triangles: number[] = [];
        for (const m of [body, face]) {
            const mine = index.get(m);
            for (let t = 0; t < m.indices.length; t += 3) {
                if (!mine.has(m.indices[t])) continue;
                triangles.push(
                    mine.get(m.indices[t]),
                    mine.get(m.indices[t + 1]),
                    mine.get(m.indices[t + 2])
                );
            }
        }
        const surface = {
            positions,
            normals,
            indices: Uint32Array.from(triangles),
        };
        const welded = weld(positions);
        // Where two pieces meet they should be one surface. The base's
        // seams are a few microns open in places and weighted a little
        // differently on each side, which shows as specks of background
        // and opens further when the figure moves: close them.
        {
            const first = new Map<number, number>();
            for (let i = 0; i < skin.length; i++) {
                const lead = first.get(welded.of[i]);
                if (lead === undefined) {
                    first.set(welded.of[i], i);
                    continue;
                }
                const from = skin[lead];
                const to = skin[i];
                for (let k = 0; k < 3; k++) {
                    positions[i * 3 + k] = positions[lead * 3 + k];
                    to.m.position[to.vertex * 3 + k] =
                        from.m.position[from.vertex * 3 + k];
                }
                for (let k = 0; k < 4; k++) {
                    to.m.joints[to.vertex * 4 + k] =
                        from.m.joints[from.vertex * 4 + k];
                    to.m.weights[to.vertex * 4 + k] =
                        from.m.weights[from.vertex * 4 + k];
                }
            }
        }
        // Their normals should agree too; where they nearly do, make
        // them.
        let seams = 0;
        {
            const sum = new Float64Array(welded.count * 3);
            for (let i = 0; i < skin.length; i++)
                for (let k = 0; k < 3; k++)
                    sum[welded.of[i] * 3 + k] += normals[i * 3 + k];
            for (let i = 0; i < skin.length; i++) {
                const w = welded.of[i] * 3;
                const length = Math.hypot(sum[w], sum[w + 1], sum[w + 2]);
                if (!length) continue;
                const dot =
                    (sum[w] * normals[i * 3] +
                        sum[w + 1] * normals[i * 3 + 1] +
                        sum[w + 2] * normals[i * 3 + 2]) /
                    length;
                if (dot > 0.99999 || dot < 0.7) continue;
                seams++;
                const { m, vertex } = skin[i];
                for (let k = 0; k < 3; k++) {
                    normals[i * 3 + k] = sum[w + k] / length;
                    m.normal[vertex * 3 + k] = normals[i * 3 + k];
                }
            }
        }
        say(
            `  skin: ${skin.length} vertices in ${welded.count} places, ` +
                `${
                    triangles.length / 3
                } triangles, ${seams} seam normals evened`
        );
        for (const loop of boundaryLoops(surface.indices, welded)) {
            const at = [0, 0, 0];
            const first = new Map<number, number>();
            for (let i = 0; i < skin.length; i++)
                if (!first.has(welded.of[i])) first.set(welded.of[i], i);
            for (const place of loop)
                for (let k = 0; k < 3; k++)
                    at[k] += positions[first.get(place) * 3 + k] / loop.length;
            say(
                `  open edge of ${loop.length} vertices round ` +
                    at.map((x) => x.toFixed(3)).join(", ")
            );
        }
        const near = neighbours(surface.indices, welded);
        const tree = new TriangleTree(positions, surface.indices);
        const open = smoothOver(
            bakeOpenness(surface, welded, tree, { floor: 0 }),
            near,
            2
        );
        // The figure faces the way its toes point.
        let toes = 0;
        for (let i = 0; i < skin.length; i++)
            if (positions[i * 3 + 1] < 0.03) toes += positions[i * 3 + 2];
        const forwardZ = Math.sign(toes) || 1;
        const sky = smoothOver(
            bakeSkylight(
                surface,
                welded,
                tree,
                [0, SKY_DIRECTION[0], SKY_DIRECTION[1] * forwardZ],
                { spread: 0.68 }
            ),
            near,
            2
        );
        const depth = smoothOver(bakeDepth(surface, welded, tree), near, 2);
        const curve = smoothOver(bakeCurvature(surface, welded, near), near, 2);
        skin.forEach(({ m, vertex }, i) => {
            const w = welded.of[i];
            m.bake[vertex * 4] = Math.round(open[w] * 255);
            m.bake[vertex * 4 + 1] = Math.round(sky[w] * 255);
            m.bake[vertex * 4 + 2] = Math.round(encodeRound(curve[w]) * 255);
            m.bake[vertex * 4 + 3] = Math.round(encodeThin(depth[w]) * 255);
        });
        const mean = (values: Float32Array) =>
            values.reduce((a, b) => a + b, 0) / values.length;
        say(
            `  openness ${mean(open).toFixed(3)} on average, light from ` +
                `above ${mean(sky).toFixed(3)}, flesh ` +
                `${(mean(depth) * 1000).toFixed(1)} mm; facing ` +
                `${forwardZ > 0 ? "+z" : "-z"}`
        );
    }
    for (const m of made)
        m.origin.forEach((o, vertex) => {
            if (o.piece.part !== "skin") {
                m.bake[vertex * 4] = 255;
                m.bake[vertex * 4 + 1] = 255;
                m.bake[vertex * 4 + 2] = 128;
                m.bake[vertex * 4 + 3] = 0;
            }
            m.partBytes[vertex * 4] = m.part[vertex];
        });

    // Vertices that are now alike in every way become one: the base
    // kept them apart for its images' sake.
    for (const m of made) {
        const targets = m.pieces[0]?.targets.length || 0;
        const seen = new Map<string, number>();
        const remap = new Uint32Array(m.origin.length);
        const keep: number[] = [];
        m.origin.forEach((o, v) => {
            const moves: number[] = [];
            for (let t = 0; t < targets; t++) {
                const d = o.piece.targets[t];
                if (
                    d[o.vertex * 3] ||
                    d[o.vertex * 3 + 1] ||
                    d[o.vertex * 3 + 2]
                )
                    moves.push(
                        t,
                        d[o.vertex * 3],
                        d[o.vertex * 3 + 1],
                        d[o.vertex * 3 + 2]
                    );
            }
            const key = [
                ...m.position.subarray(v * 3, v * 3 + 3),
                ...m.normal.subarray(v * 3, v * 3 + 3),
                ...m.joints.slice(v * 4, v * 4 + 4),
                ...m.weights.slice(v * 4, v * 4 + 4),
                ...m.bake.subarray(v * 4, v * 4 + 4),
                m.part[v],
                // The ink's pieces overlap by design; leave them be.
                m.primitive === "ink" ? v : -1,
                ...moves,
            ].join(",");
            let to = seen.get(key);
            if (to === undefined) {
                to = keep.length;
                seen.set(key, to);
                keep.push(v);
            }
            remap[v] = to;
        });
        const pick = <T extends { length: number }>(
            from: T,
            width: number,
            make: (length: number) => any
        ) => {
            const out = make(keep.length * width);
            keep.forEach((v, i) => {
                for (let k = 0; k < width; k++)
                    out[i * width + k] = (from as any)[v * width + k];
            });
            return out;
        };
        const before = m.origin.length;
        m.position = pick(m.position, 3, (n) => new Float32Array(n));
        m.normal = pick(m.normal, 3, (n) => new Float32Array(n));
        m.uv = pick(m.uv, 2, (n) => new Array(n));
        m.joints = pick(m.joints, 4, (n) => new Array(n));
        m.weights = pick(m.weights, 4, (n) => new Array(n));
        m.part = pick(m.part, 1, (n) => new Array(n));
        m.bake = pick(m.bake, 4, (n) => new Uint8Array(n));
        m.partBytes = pick(m.partBytes, 4, (n) => new Uint8Array(n));
        m.coords = new Float32Array(keep.length * 2);
        m.origin = keep.map((v) => m.origin[v]);
        m.indices = m.indices.map((v) => remap[v]);
        if (before !== keep.length)
            say(
                `  ${m.primitive}: ${before} vertices joined into ${keep.length}`
            );
    }

    // Which side is the figure's left: where its left eye's bone is.
    const boneNode = (bone: string): number =>
        vrm.humanoid.humanBones.find((b: Json) => b.bone === bone)?.node;
    const worldOf = (node: number): number[] => {
        const parents = new Map<number, number>();
        json.nodes.forEach((n: Json, i: number) =>
            (n.children || []).forEach((c: number) => parents.set(c, i))
        );
        const at = [0, 0, 0];
        for (let n = node; n !== undefined; n = parents.get(n)) {
            const t = json.nodes[n].translation || [0, 0, 0];
            for (let k = 0; k < 3; k++) at[k] += t[k];
        }
        return at;
    };
    const leftSign = Math.sign(worldOf(boneNode("leftEye"))[0]) || 1;

    // Landmarks: the openings in the front of the face.
    const landmarks = (() => {
        const front = face.pieces.find(
            (p) =>
                p.part === "skin" &&
                // The piece with the eyes in: it has more than one opening.
                boundaryLoops(p.indices, weld(Float32Array.from(p.position)))
                    .length > 2
        );
        if (!front) throw new Error("No face with eye openings found");
        const vertices = face.origin
            .map((o, vertex) => ({ o, vertex }))
            .filter(({ o }) => o.piece === front);
        const local = new Map<number, number>();
        vertices.forEach(({ vertex }, i) => local.set(vertex, i));
        const positions = new Float32Array(vertices.length * 3);
        vertices.forEach(({ vertex }, i) => {
            for (let k = 0; k < 3; k++)
                positions[i * 3 + k] = face.position[vertex * 3 + k];
        });
        const triangles: number[] = [];
        for (let t = 0; t < face.indices.length; t += 3)
            if (
                local.has(face.indices[t]) &&
                local.has(face.indices[t + 1]) &&
                local.has(face.indices[t + 2])
            )
                triangles.push(
                    local.get(face.indices[t]),
                    local.get(face.indices[t + 1]),
                    local.get(face.indices[t + 2])
                );
        const welded = weld(positions);
        const first = new Map<number, number>();
        vertices.forEach(({ vertex }, i) => {
            if (!first.has(welded.of[i])) first.set(welded.of[i], vertex);
        });
        const loops = boundaryLoops(Uint32Array.from(triangles), welded).map(
            (loop) => loop.map((place) => first.get(place))
        );
        const at = (vertex: number, k: number) => face.position[vertex * 3 + k];
        const centre = (loop: number[], k: number) =>
            loop.reduce((sum, v) => sum + at(v, k), 0) / loop.length;
        /** Start at one corner, upper edge first. */
        const rim = (loop: number[], startSign: number): FigureRim => {
            let start = 0;
            let turn = 0;
            loop.forEach((v, i) => {
                if (at(v, 0) * startSign > at(loop[start], 0) * startSign)
                    start = i;
            });
            let turned = [...loop.slice(start), ...loop.slice(0, start)];
            turned.forEach((v, i) => {
                if (at(v, 0) * startSign < at(turned[turn], 0) * startSign)
                    turn = i;
            });
            const height = (from: number, to: number) => {
                let sum = 0;
                for (let i = from; i < to; i++) sum += at(turned[i], 1);
                return sum / Math.max(1, to - from);
            };
            if (turn < 2 || height(1, turn) < height(turn + 1, turned.length)) {
                turned = [turned[0], ...turned.slice(1).reverse()];
                turn = turned.length - turn;
            }
            return { loop: turned, turn };
        };
        const eyes = loops.filter((loop) => Math.abs(centre(loop, 0)) > 0.02);
        const mouths = loops
            .filter((loop) => Math.abs(centre(loop, 0)) < 0.01)
            .sort((a, b) => a.length - b.length);
        const eye = (sign: number) => {
            const loop = eyes
                .filter((l) => Math.sign(centre(l, 0)) === sign)
                .sort((a, b) => a.length - b.length)[0];
            if (!loop) throw new Error("An eye opening is missing");
            // From the inner corner: the one nearer the nose.
            return rim(loop, -sign);
        };
        if (!mouths.length) throw new Error("The mouth opening is missing");
        say(`  openings: ${loops.map((l) => l.length).join(", ")} vertices`);
        return {
            eyes: { left: eye(leftSign), right: eye(-leftSign) },
            mouth: rim(mouths[0], -leftSign),
        };
    })();

    // What the ink is drawn in: for a brow, how far along and across its
    // strip; for an iris, metres from its middle, seen from the front.
    {
        const groups = new Map<string, number[]>();
        ink.origin.forEach((o, vertex) => {
            const side = Math.sign(ink.position[vertex * 3]) || 1;
            const key = `${o.piece.part} ${side}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(vertex);
        });
        for (const [key, vertices] of groups) {
            const [part, side] = key.split(" ");
            const column = (k: number) =>
                vertices.map((v) => ink.position[v * 3 + k]);
            const mid = (values: number[]) =>
                (Math.min(...values) + Math.max(...values)) / 2;
            if (part === "brow") {
                const u = vertices.map((v) => ink.uv[v * 2]);
                const w = vertices.map((v) => ink.uv[v * 2 + 1]);
                const [u0, u1] = [Math.min(...u), Math.max(...u)];
                const [w0, w1] = [Math.min(...w), Math.max(...w)];
                // Which end of the image's strip is the nose's, and which
                // edge is the top, is read off the vertices themselves.
                const along = vertices.map((_, i) => (u[i] - u0) / (u1 - u0));
                const across = vertices.map((_, i) => (w[i] - w0) / (w1 - w0));
                const x = column(0).map((value) => value * Number(side));
                const y = column(1);
                const slope = (a: number[], b: number[]) => {
                    const ma = a.reduce((s, q) => s + q, 0) / a.length;
                    const mb = b.reduce((s, q) => s + q, 0) / b.length;
                    return a.reduce((s, q, i) => s + (q - ma) * (b[i] - mb), 0);
                };
                const flipAlong = slope(along, x) < 0;
                const flipAcross = slope(across, y) < 0;
                vertices.forEach((v, i) => {
                    ink.coords[v * 2] = flipAlong ? 1 - along[i] : along[i];
                    ink.coords[v * 2 + 1] = flipAcross
                        ? 1 - across[i]
                        : across[i];
                });
            } else if (part === "iris") {
                const cx = mid(column(0));
                const cy = mid(column(1));
                vertices.forEach((v) => {
                    ink.coords[v * 2] = ink.position[v * 3] - cx;
                    ink.coords[v * 2 + 1] = ink.position[v * 3 + 1] - cy;
                });
            }
        }
    }

    // Write it out.
    const writer = new GlbWriter();
    const targetNames: string[] =
        json.meshes
            .flatMap((m: Json) => m.primitives)
            .find((p: Json) => p.extras?.targetNames)?.extras.targetNames || [];
    const primitiveJson = (m: (typeof made)[number], material: number) => {
        const count = m.origin.length;
        // Weights as 16 bits that still add up to one.
        const weights = new Uint16Array(count * 4);
        for (let v = 0; v < count; v++) {
            const raw = [0, 1, 2, 3].map((k) => m.weights[v * 4 + k]);
            const total = raw.reduce((a, b) => a + b, 0) || 1;
            const scaled = raw.map((w) => Math.floor((w / total) * 65535));
            let rest = 65535 - scaled.reduce((a, b) => a + b, 0);
            const largest = scaled.indexOf(Math.max(...scaled));
            scaled[largest] += rest;
            rest = 0;
            weights.set(scaled, v * 4);
        }
        const attributes: Json = {
            POSITION: writer.accessor(m.position, "VEC3", {
                target: 34962,
                bounds: true,
            }),
            NORMAL: writer.accessor(m.normal, "VEC3", { target: 34962 }),
            JOINTS_0: writer.accessor(Uint16Array.from(m.joints), "VEC4", {
                target: 34962,
            }),
            WEIGHTS_0: writer.accessor(weights, "VEC4", {
                target: 34962,
                normalized: true,
            }),
            [PART_ATTRIBUTE]: writer.accessor(m.partBytes, "VEC4", {
                target: 34962,
                normalized: true,
            }),
        };
        if (m.primitive !== "ink")
            attributes[BAKE_ATTRIBUTE] = writer.accessor(m.bake, "VEC4", {
                target: 34962,
                normalized: true,
            });
        if (m.primitive === "ink")
            attributes.TEXCOORD_0 = writer.accessor(m.coords, "VEC2", {
                target: 34962,
            });
        const out: Json = {
            attributes,
            indices: writer.accessor(Uint16Array.from(m.indices), "SCALAR", {
                target: 34963,
            }),
            material,
            mode: 4,
        };
        const targetCount = m.pieces[0]?.targets.length || 0;
        if (targetCount) {
            let stored = 0;
            out.targets = [];
            for (let t = 0; t < targetCount; t++) {
                const moved: number[] = [];
                const deltas: number[] = [];
                m.origin.forEach((o, vertex) => {
                    const d = o.piece.targets[t];
                    const x = d[o.vertex * 3];
                    const y = d[o.vertex * 3 + 1];
                    const z = d[o.vertex * 3 + 2];
                    if (Math.hypot(x, y, z) < 2e-6) return;
                    moved.push(vertex);
                    deltas.push(x, y, z);
                });
                stored += moved.length;
                out.targets.push({
                    POSITION: writer.sparse(count, moved, deltas),
                });
            }
            out.extras = { targetNames };
            say(
                `  ${m.primitive}: ${targetCount} morphs move ${stored} ` +
                    `vertices in all`
            );
        }
        return out;
    };
    if (body.origin.length > 65535 || face.origin.length > 65535)
        throw new Error("Too many vertices for 16-bit indices");

    const materials = [
        {
            name: FIGURE_MATERIALS.body,
            pbrMetallicRoughness: {
                baseColorFactor: [0.6, 0.36, 0.27, 1],
                metallicFactor: 0,
                roughnessFactor: 0.6,
            },
        },
        {
            name: FIGURE_MATERIALS.face,
            pbrMetallicRoughness: {
                baseColorFactor: [0.6, 0.36, 0.27, 1],
                metallicFactor: 0,
                roughnessFactor: 0.6,
            },
        },
        {
            // Unstyled, the ink is clear: a viewer that does not draw
            // the figure's features shows a bare face, not black cards.
            name: FIGURE_MATERIALS.ink,
            alphaMode: "BLEND",
            pbrMetallicRoughness: {
                baseColorFactor: [0, 0, 0, 0],
                metallicFactor: 0,
                roughnessFactor: 1,
            },
        },
    ];
    const meshes = [
        {
            name: "Face",
            primitives: [primitiveJson(face, 1), primitiveJson(ink, 2)],
            extras: { targetNames },
        },
        { name: "Body", primitives: [primitiveJson(body, 0)] },
    ];

    // The skeleton, lowered with the feet. Only the nodes the scene's
    // own roots reach are kept, less the holders for hair and springs.
    const scene = json.scenes[json.scene || 0];
    const faceNode = json.nodes.findIndex((n: Json) => n.mesh === 0);
    const bodyNode = json.nodes.findIndex((n: Json) => n.mesh === 1);
    const skeletonRoots = scene.nodes.filter(
        (n: number) =>
            n !== faceNode &&
            n !== bodyNode &&
            (json.nodes[n].children || []).length
    );
    const keepNodes: number[] = [];
    const walk = (n: number) => {
        keepNodes.push(n);
        (json.nodes[n].children || []).forEach(walk);
    };
    [faceNode, bodyNode, ...skeletonRoots].forEach(walk);
    keepNodes.sort((a, b) => a - b);
    const nodeMap = new Map<number, number>();
    keepNodes.forEach((n, i) => nodeMap.set(n, i));
    const hips = boneNode("hips");
    const nodes = keepNodes.map((n) => {
        const node: Json = { ...json.nodes[n] };
        if (node.children)
            node.children = node.children.map((c: number) => nodeMap.get(c));
        if (n === hips)
            node.translation = [
                node.translation[0],
                Math.fround(node.translation[1] - floor),
                node.translation[2],
            ];
        if (n === faceNode) node.mesh = 0;
        if (n === bodyNode) node.mesh = 1;
        return node;
    });
    // A joint's inverse bind matrix is the inverse of where it stood;
    // every joint from the hips down now stands `floor` lower.
    const below = new Set<number>();
    const mark = (n: number) => {
        below.add(n);
        (json.nodes[n].children || []).forEach(mark);
    };
    mark(hips);
    const skins = json.skins.map((skin: Json) => {
        const inverse = Float32Array.from(accessor(skin.inverseBindMatrices));
        skin.joints.forEach((joint: number, i: number) => {
            if (!below.has(joint)) return;
            // M * translate(0, floor, 0): the y column carries it.
            for (let row = 0; row < 3; row++)
                inverse[i * 16 + 12 + row] += inverse[i * 16 + 4 + row] * floor;
        });
        return {
            inverseBindMatrices: writer.accessor(inverse, "MAT4"),
            joints: skin.joints.map((j: number) => nodeMap.get(j)),
            ...(skin.skeleton !== undefined
                ? { skeleton: nodeMap.get(skin.skeleton) }
                : {}),
        };
    });

    const triangles = {
        body: body.indices.length / 3,
        face: face.indices.length / 3,
        ink: ink.indices.length / 3,
    };
    const info: FigureInfo = {
        format: FIGURE_FORMAT,
        source: {
            title: vrm.meta.title || "",
            author: vrm.meta.author || "",
            license: vrm.meta.licenseName || "",
        },
        landmarks,
        triangles,
    };
    const meta = { ...vrm.meta };
    // The thumbnail was an image.
    delete meta.texture;
    const out: Json = {
        asset: { version: "2.0", generator: "Oncyber figure builder" },
        extensionsUsed: ["VRM"],
        extensions: {
            VRM: {
                exporterVersion: "Oncyber figure builder",
                specVersion: vrm.specVersion || "0.0",
                meta,
                humanoid: {
                    ...vrm.humanoid,
                    humanBones: vrm.humanoid.humanBones.map((b: Json) => ({
                        ...b,
                        node: nodeMap.get(b.node),
                    })),
                },
                firstPerson: {
                    ...vrm.firstPerson,
                    firstPersonBone: nodeMap.get(
                        vrm.firstPerson.firstPersonBone
                    ),
                    meshAnnotations: [],
                },
                blendShapeMaster: {
                    blendShapeGroups: vrm.blendShapeMaster.blendShapeGroups.map(
                        (group: Json) => ({
                            ...group,
                            // Every morph the base binds is on mesh 0 here too.
                            binds: group.binds.filter(
                                (bind: Json) => bind.mesh === 0
                            ),
                            materialValues: [],
                        })
                    ),
                },
                secondaryAnimation: { boneGroups: [], colliderGroups: [] },
                materialProperties: materials.map((material, i) => ({
                    name: material.name,
                    shader: "VRM_USE_GLTFSHADER",
                    renderQueue: i === 2 ? 3000 : 2000,
                    floatProperties: {},
                    vectorProperties: {},
                    textureProperties: {},
                    keywordMap: {},
                    tagMap: {},
                })),
            },
        },
        materials,
        meshes,
        skins,
        nodes,
        scenes: [
            {
                nodes: scene.nodes
                    .filter((n: number) => nodeMap.has(n))
                    .map((n: number) => nodeMap.get(n)),
                extras: { figure: info },
            },
        ],
        scene: 0,
    };
    const glb = writer.finish(out);
    return { glb, report, info, floor, sizeBefore: file.length };
}

const source = process.argv[2];
if (!source) {
    console.error("Usage: npm run build -- /path/to/base-model.vrm [out.vrm]");
    process.exit(1);
}
const outPath = process.argv[3] ? path.resolve(process.argv[3]) : OUT;
const { glb, report, info, sizeBefore } = build(path.resolve(source));
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, glb);
console.log(`Built from "${info.source.title}" (${info.source.license}):`);
for (const line of report) console.log(line);
console.log(
    `  triangles: body ${info.triangles.body}, face ${info.triangles.face}, ` +
        `ink ${info.triangles.ink}`
);
console.log(
    `  ${(sizeBefore / 1e6).toFixed(1)} MB in, ${(glb.length / 1e3).toFixed(
        0
    )} kB out ` +
        `(sha256 ${createHash("sha256")
            .update(glb)
            .digest("hex")
            .slice(0, 12)})`
);
console.log(`Wrote ${path.relative(ROOT, outPath)}`);
