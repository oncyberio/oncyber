/**
 * Writes an outfit as a GLB: every garment in one mesh, so the outfit is
 * one draw. Positions and normals as floats; colour as 16-bit (dark
 * cloth bands at 8 bits); four bones and weights a vertex as bytes. What
 * the wearer needs to put it on rides in the mesh's extras: the bone
 * names the joints count in, and the body triangles it covers.
 *
 * Given meshopt's encoder, the buffers are packed with it
 * (EXT_meshopt_compression): about a third of the size, unpacked by the
 * loader's meshopt decoder.
 */
export interface Piece {
    name: string;
    positions: Float32Array;
    normals: Float32Array;
    /** Linear RGB. */
    colours: Float32Array;
    /** What kind of cloth, 0..1: the colour's alpha. */
    kinds: Float32Array;
    indices: Uint32Array;
    joints: Uint16Array;
    weights: Float32Array;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Runs of consecutive numbers, as [first, count] pairs, flattened. */
export function runs(values: number[]) {
    const out: number[] = [];
    for (const v of values) {
        const n = out.length;
        if (n && out[n - 2] + out[n - 1] === v) out[n - 1]++;
        else out.push(v, 1);
    }
    return out;
}

/** What writeGlb needs of meshopt's encoder (`MeshoptEncoder`). */
export interface Encoder {
    reorderMesh(
        indices: Uint32Array,
        triangles: boolean,
        optsize: boolean
    ): [Uint32Array, number];
    encodeGltfBuffer(
        source: Uint8Array,
        count: number,
        size: number,
        mode: "ATTRIBUTES" | "TRIANGLES"
    ): Uint8Array;
}

export function writeGlb(
    pieces: Piece[],
    extras: { name: string; bones: string[]; hides: number[]; figure: string },
    encoder?: Encoder
) {
    const count = pieces.reduce((n, p) => n + p.positions.length / 3, 0);
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colours = new Uint16Array(count * 4);
    const joints = new Uint8Array(count * 4);
    const weights = new Uint8Array(count * 4);
    const indices: number[] = [];
    let base = 0;
    for (const p of pieces) {
        const n = p.positions.length / 3;
        positions.set(p.positions, base * 3);
        normals.set(p.normals, base * 3);
        for (let v = 0; v < n; v++) {
            const o = base + v;
            for (let k = 0; k < 3; k++)
                colours[o * 4 + k] = Math.round(
                    Math.min(1, Math.max(0, p.colours[v * 3 + k])) * 65535
                );
            colours[o * 4 + 3] = Math.round(p.kinds[v] * 65535);
            // Bytes that still sum to 255.
            const w = [0, 1, 2, 3].map((k) =>
                Math.round(p.weights[v * 4 + k] * 255)
            );
            w[0] += 255 - w.reduce((a, b) => a + b, 0);
            for (let k = 0; k < 4; k++) {
                if (p.joints[v * 4 + k] > 255)
                    throw new Error("More than 256 bones");
                joints[o * 4 + k] = p.joints[v * 4 + k];
                weights[o * 4 + k] = Math.max(0, w[k]);
            }
        }
        for (const i of p.indices) indices.push(i + base);
        base += n;
    }
    const wide = count > 65535;
    let vertexArrays = [positions, normals, colours, joints, weights];
    // Rewritten in place by the reorder.
    const order = Uint32Array.from(indices);
    if (encoder) {
        // Floats with their low bits dropped pack far smaller: positions
        // to about a tenth of a millimetre, normals to a few hundredths.
        trim(positions, 10);
        trim(normals, 13);
        // Vertices in the order the triangles use them: smaller packed.
        const [remap] = encoder.reorderMesh(order, true, false);
        vertexArrays = vertexArrays.map((a) => {
            const width = a.length / count;
            const out = new (a.constructor as new (n: number) => typeof a)(
                a.length
            );
            for (let v = 0; v < count; v++)
                for (let k = 0; k < width; k++)
                    out[remap[v] * width + k] = a[v * width + k];
            return out;
        });
    }
    const index = wide ? order : Uint16Array.from(order);
    const arrays = [...vertexArrays, index];
    const chunks = arrays.map(
        (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
    );
    const strides = arrays.map((a, i) =>
        i < vertexArrays.length ? a.byteLength / count : a.BYTES_PER_ELEMENT
    );
    const views: Json[] = [];
    const stored: Uint8Array[] = [];
    let length = 0;
    let raw = 0;
    chunks.forEach((chunk, i) => {
        const attribute = i < vertexArrays.length;
        const view: Json = {
            buffer: 0,
            byteOffset: 0,
            byteLength: chunk.length,
        };
        if (attribute) view.byteStride = strides[i];
        let data = chunk;
        if (encoder) {
            const mode = attribute ? "ATTRIBUTES" : "TRIANGLES";
            const n = attribute ? count : index.length;
            data = encoder.encodeGltfBuffer(chunk, n, strides[i], mode);
            // The view stands in the empty fallback buffer; the packed
            // bytes sit in the real one.
            view.buffer = 1;
            view.byteOffset = raw;
            raw += Math.ceil(chunk.length / 4) * 4;
            view.extensions = {
                EXT_meshopt_compression: {
                    buffer: 0,
                    byteOffset: length,
                    byteLength: data.length,
                    byteStride: strides[i],
                    mode,
                    count: n,
                },
            };
        } else view.byteOffset = length;
        views.push(view);
        stored.push(data);
        length += Math.ceil(data.length / 4) * 4;
    });
    const bin = new Uint8Array(length);
    let at = 0;
    for (const data of stored) {
        bin.set(data, at);
        at += Math.ceil(data.length / 4) * 4;
    }
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++)
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], positions[i * 3 + k]);
            max[k] = Math.max(max[k], positions[i * 3 + k]);
        }
    const json: Json = {
        asset: { version: "2.0", generator: "tasks/avatar-figure clothes" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: extras.name, mesh: 0 }],
        meshes: [
            {
                name: extras.name,
                extras: {
                    bones: extras.bones,
                    hides: runs(extras.hides),
                    figure: extras.figure,
                    pieces: pieces.map((p) => p.name),
                },
                primitives: [
                    {
                        attributes: {
                            POSITION: 0,
                            NORMAL: 1,
                            COLOR_0: 2,
                            JOINTS_0: 3,
                            WEIGHTS_0: 4,
                        },
                        indices: 5,
                    },
                ],
            },
        ],
        accessors: [
            {
                bufferView: 0,
                componentType: 5126,
                count,
                type: "VEC3",
                min,
                max,
            },
            { bufferView: 1, componentType: 5126, count, type: "VEC3" },
            {
                bufferView: 2,
                componentType: 5123,
                normalized: true,
                count,
                type: "VEC4",
            },
            { bufferView: 3, componentType: 5121, count, type: "VEC4" },
            {
                bufferView: 4,
                componentType: 5121,
                normalized: true,
                count,
                type: "VEC4",
            },
            {
                bufferView: 5,
                componentType: wide ? 5125 : 5123,
                count: indices.length,
                type: "SCALAR",
            },
        ],
        bufferViews: views,
        buffers: [{ byteLength: length }],
    };
    if (encoder) {
        json.buffers.push({
            byteLength: raw,
            extensions: { EXT_meshopt_compression: { fallback: true } },
        });
        json.extensionsUsed = ["EXT_meshopt_compression"];
        json.extensionsRequired = ["EXT_meshopt_compression"];
    }
    let text = Buffer.from(JSON.stringify(json));
    if (text.length % 4)
        text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), " ")]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
    const chunk = (type: number, data: Uint8Array) => {
        const head = Buffer.alloc(8);
        head.writeUInt32LE(data.length, 0);
        head.writeUInt32LE(type, 4);
        return [head, Buffer.from(data)];
    };
    return Buffer.concat([
        header,
        ...chunk(0x4e4f534a, text),
        ...chunk(0x004e4942, bin),
    ]);
}

/** Zero the lowest `bits` of each float's mantissa, rounding to nearest. */
function trim(values: Float32Array, bits: number) {
    const words = new Uint32Array(
        values.buffer,
        values.byteOffset,
        values.length
    );
    const half = 1 << (bits - 1);
    const mask = ~((1 << bits) - 1) >>> 0;
    for (let i = 0; i < words.length; i++)
        words[i] = ((words[i] + half) & mask) >>> 0;
}
