/**
 * Clothes taken from another model built on the same base (a VRoid model):
 * its garments are clean shells with their folds, seams and trims painted
 * into a texture, which is what makes them read as real clothes. Each is
 * moved onto the figure bone by bone, then set the same distance off the
 * figure's skin as it stood off its own model's skin.
 */
import { readFileSync } from "node:fs";
import { bodyField, type BodyField } from "./bodyField";
import type { Figure, V3 } from "./figure";
import { readGlb, worldOf, type Json } from "../vrmFile";
import * as THREE from "three/webgpu";

export interface DonorGarment {
    name: string;
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    /** Bones by index in the figure's skeleton. */
    joints: Uint16Array;
    weights: Float32Array;
    /** Its texture as stored in the model (PNG). */
    image: Uint8Array;
    /** Texels below this alpha are cut away. */
    cutoff: number;
}

/**
 * The garments of `file` whose material names match `pick`, fitted to the
 * figure. `body` is the figure's own distance field.
 */
export function donorClothes(
    file: string,
    figure: Figure,
    body: BodyField,
    pick: RegExp
): DonorGarment[] {
    const { json, accessor, image } = readGlb(readFileSync(file));
    const world = worldOf(json);
    const at = (node: number) =>
        new THREE.Vector3().setFromMatrixPosition(world(node)).toArray() as V3;
    const parent = new Map<number, number>();
    json.nodes.forEach((node: Json, i: number) =>
        (node.children || []).forEach((c: number) => parent.set(c, i))
    );
    // The figure's bone for each of the model's nodes: the same name, or
    // the nearest ancestor that has one.
    const ourBone = (node: number): number => {
        for (let n = node; n !== undefined; n = parent.get(n)) {
            const i = figure.bones.indexOf(json.nodes[n].name);
            if (i >= 0) return i;
        }
        return 0;
    };
    const humanoid: Record<string, number> = Object.fromEntries(
        json.extensions.VRM.humanoid.humanBones.map((b: Json) => [
            b.bone,
            b.node,
        ])
    );
    // Sizes differ: scale about each bone by the ratio of the heights.
    const scale = figure.joint("head")[1] / at(humanoid.head)[1];

    // The model's own skin, to measure how far its clothes stand off it.
    const skin = {
        positions: [] as number[],
        normals: [] as number[],
        indices: [] as number[],
    };
    const meshNode = json.nodes.findIndex(
        (n: Json) =>
            n.mesh !== undefined &&
            n.skin !== undefined &&
            json.meshes[n.mesh].primitives.some((p: Json) =>
                /Body_00_SKIN/.test(json.materials[p.material].name)
            )
    );
    const mesh = json.meshes[json.nodes[meshNode].mesh];
    const skinJoints: number[] = json.skins[json.nodes[meshNode].skin].joints;
    for (const p of mesh.primitives) {
        if (!/Body_00_SKIN/.test(json.materials[p.material].name)) continue;
        const pos = accessor(p.attributes.POSITION);
        const nrm = accessor(p.attributes.NORMAL);
        const base = skin.positions.length / 3;
        // Only the vertices this primitive uses.
        const map = new Map<number, number>();
        for (const i of accessor(p.indices)) {
            if (!map.has(i)) {
                map.set(i, base + map.size);
                skin.positions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                skin.normals.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
            }
            skin.indices.push(map.get(i));
        }
    }
    const theirs = bodyField({
        positions: Float32Array.from(skin.positions),
        normals: Float32Array.from(skin.normals),
        indices: Uint32Array.from(skin.indices),
    });

    const gradient = (x: number, y: number, z: number): V3 => {
        const e = 0.002;
        const f = (a: number, b: number, c: number) => body.skin.eval(a, b, c);
        const g: V3 = [
            f(x + e, y, z) - f(x - e, y, z),
            f(x, y + e, z) - f(x, y - e, z),
            f(x, y, z + e) - f(x, y, z - e),
        ];
        const l = Math.hypot(...g) || 1;
        return [g[0] / l, g[1] / l, g[2] / l];
    };

    const out: DonorGarment[] = [];
    for (const p of mesh.primitives) {
        const material = json.materials[p.material];
        if (!pick.test(material.name)) continue;
        const pos = accessor(p.attributes.POSITION);
        const nrm = accessor(p.attributes.NORMAL);
        const uv = accessor(p.attributes.TEXCOORD_0);
        const jn = accessor(p.attributes.JOINTS_0);
        const wt = accessor(p.attributes.WEIGHTS_0);
        const map = new Map<number, number>();
        const order: number[] = [];
        const indices = Uint32Array.from(accessor(p.indices), (i) => {
            if (!map.has(i)) {
                map.set(i, order.length);
                order.push(i);
            }
            return map.get(i);
        });
        const n = order.length;
        const positions = new Float32Array(n * 3);
        const normals = new Float32Array(n * 3);
        const uvs = new Float32Array(n * 2);
        const joints = new Uint16Array(n * 4);
        const weights = new Float32Array(n * 4);
        order.forEach((v, o) => {
            const src: V3 = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
            // Bone by bone onto the figure.
            const moved: V3 = [0, 0, 0];
            let total = 0;
            for (let k = 0; k < 4; k++) {
                const w = wt[v * 4 + k];
                if (w <= 0) continue;
                const node = skinJoints[jn[v * 4 + k]];
                const from = at(node);
                const to = figure.boneAt(ourBone(node));
                for (let a = 0; a < 3; a++)
                    moved[a] += w * (to[a] + (src[a] - from[a]) * scale);
                total += w;
                joints[o * 4 + k] = ourBone(node);
                weights[o * 4 + k] = w;
            }
            for (let a = 0; a < 3; a++) moved[a] /= total || 1;
            // As far off the figure's skin as it stood off its own.
            const off = Math.max(0.0025, theirs.skin.eval(...src) * scale);
            for (let step = 0; step < 4; step++) {
                const d = body.skin.eval(...moved);
                if (Math.abs(d) >= body.band * 0.95) break;
                const g = gradient(...moved);
                for (let a = 0; a < 3; a++) moved[a] += g[a] * (off - d);
            }
            positions.set(moved, o * 3);
            normals.set([nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]], o * 3);
            uvs.set([uv[v * 2], uv[v * 2 + 1]], o * 2);
        });
        const tex =
            json.textures[material.pbrMetallicRoughness.baseColorTexture.index];
        out.push({
            name: material.name,
            positions,
            normals,
            uvs,
            indices,
            joints,
            weights,
            image: image(tex.source),
            cutoff:
                material.alphaMode === "MASK" ? material.alphaCutoff ?? 0.5 : 0,
        });
    }
    return out;
}
