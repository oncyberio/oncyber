/**
 * Reading another model's file as it stands: its JSON, its accessors as
 * plain numbers, and where each node is in its rest pose. Shared by the
 * hair and clothes makers.
 */
import * as THREE from "three/webgpu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

const COMPONENTS: Record<
    number,
    [number, (v: DataView, at: number) => number]
> = {
    5121: [1, (v, at) => v.getUint8(at)],
    5123: [2, (v, at) => v.getUint16(at, true)],
    5125: [4, (v, at) => v.getUint32(at, true)],
    5126: [4, (v, at) => v.getFloat32(at, true)],
};
const WIDTHS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function readGlb(file: Buffer) {
    const jsonLength = file.readUInt32LE(12);
    const json: Json = JSON.parse(
        file.subarray(20, 20 + jsonLength).toString("utf8")
    );
    const start = 20 + jsonLength + 8;
    const bin = file.subarray(
        start,
        start + file.readUInt32LE(20 + jsonLength)
    );
    const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const accessor = (index: number) => {
        const a = json.accessors[index];
        const width = WIDTHS[a.type];
        const [bytes, read] = COMPONENTS[a.componentType];
        const bv = json.bufferViews[a.bufferView];
        const stride = bv.byteStride || bytes * width;
        const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
        const out = new Float64Array(a.count * width);
        for (let r = 0; r < a.count; r++)
            for (let c = 0; c < width; c++)
                out[r * width + c] = read(view, base + r * stride + c * bytes);
        return out;
    };
    /** The bytes of an image stored in the file. */
    const image = (index: number) => {
        const bv = json.bufferViews[json.images[index].bufferView];
        return bin.subarray(
            bv.byteOffset || 0,
            (bv.byteOffset || 0) + bv.byteLength
        );
    };
    return { json, accessor, image };
}

/** Where each node is, as the file stands (its rest pose). */
export function worldOf(json: Json) {
    const world: THREE.Matrix4[] = [];
    const parent = new Map<number, number>();
    json.nodes.forEach((node: Json, i: number) =>
        (node.children || []).forEach((c: number) => parent.set(c, i))
    );
    const of = (i: number): THREE.Matrix4 => {
        if (world[i]) return world[i];
        const node = json.nodes[i];
        const local = new THREE.Matrix4().compose(
            new THREE.Vector3(...(node.translation || [0, 0, 0])),
            new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])),
            new THREE.Vector3(...(node.scale || [1, 1, 1]))
        );
        world[i] = parent.has(i)
            ? of(parent.get(i)).clone().multiply(local)
            : local;
        return world[i];
    };
    return of;
}
