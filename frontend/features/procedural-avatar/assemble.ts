import type { PartMesh } from "./kernel/build";
import { Influence, Rig, SkinOptions } from "./rig";

export type SkinFn = (x: number, y: number, z: number, out: Influence) => void;

/** Skin every vertex to one bone: glasses, earrings, a radio. */
export const rigid =
    (bone: number): SkinFn =>
    (_x, _y, _z, out) => {
        out.clear().add(bone, 1).finish();
    };

export const followBody =
    (rig: Rig, options?: SkinOptions): SkinFn =>
    (x, y, z, out) => {
        rig.skinAt(x, y, z, out, options);
    };

/** One finished part: T-pose geometry with skin weights, as flat arrays. */
export interface BoundPart {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    skinIndex: Uint16Array;
    skinWeight: Float32Array;
}

/**
 * Bind a design-pose part to the skeleton: weight each vertex, then carry
 * it back to the T-pose through the inverse of its blended skin matrix.
 */
export function bindPart(rig: Rig, part: PartMesh, skin: SkinFn): BoundPart {
    const count = part.positions.length / 3;
    const positions = new Float32Array(part.positions);
    const normals = new Float32Array(part.normals);
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    const influence = new Influence();
    const m = new Float64Array(12);
    for (let i = 0; i < count; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        skin(x, y, z, influence);
        m.fill(0);
        let moved = false;
        for (let k = 0; k < 4; k++) {
            const w = influence.weights[k];
            skinIndex[i * 4 + k] = influence.bones[k];
            skinWeight[i * 4 + k] = w;
            if (w <= 0) continue;
            const e = rig.skin[influence.bones[k]];
            // Column-major 4x4 to row-major 3x4.
            m[0] += e[0] * w;
            m[1] += e[4] * w;
            m[2] += e[8] * w;
            m[3] += e[12] * w;
            m[4] += e[1] * w;
            m[5] += e[5] * w;
            m[6] += e[9] * w;
            m[7] += e[13] * w;
            m[8] += e[2] * w;
            m[9] += e[6] * w;
            m[10] += e[10] * w;
            m[11] += e[14] * w;
            if (!rig.identity[influence.bones[k]]) moved = true;
        }
        if (!moved) continue;
        // Invert the 3x3, apply to (p - t).
        const a = m[0],
            b = m[1],
            c = m[2];
        const d = m[4],
            e2 = m[5],
            f = m[6];
        const g = m[8],
            h = m[9],
            k2 = m[10];
        const A = e2 * k2 - f * h;
        const B = -(d * k2 - f * g);
        const C = d * h - e2 * g;
        const det = a * A + b * B + c * C;
        if (Math.abs(det) < 1e-9) continue;
        const id = 1 / det;
        const px = x - m[3];
        const py = y - m[7];
        const pz = z - m[11];
        positions[i * 3] =
            (A * px + (c * h - b * k2) * py + (b * f - c * e2) * pz) * id;
        positions[i * 3 + 1] =
            (B * px + (a * k2 - c * g) * py + (c * d - a * f) * pz) * id;
        positions[i * 3 + 2] =
            (C * px + (b * g - a * h) * py + (a * e2 - b * d) * pz) * id;
        // Normals travel by the transpose of the forward matrix.
        const nx = normals[i * 3];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];
        const tx = a * nx + d * ny + g * nz;
        const ty = b * nx + e2 * ny + h * nz;
        const tz = c * nx + f * ny + k2 * nz;
        const l = Math.hypot(tx, ty, tz) || 1;
        normals[i * 3] = tx / l;
        normals[i * 3 + 1] = ty / l;
        normals[i * 3 + 2] = tz / l;
    }
    return {
        positions,
        normals,
        colors: new Float32Array(part.colors),
        uvs: new Float32Array(part.uvs),
        indices: new Uint32Array(part.indices),
        skinIndex,
        skinWeight,
    };
}
