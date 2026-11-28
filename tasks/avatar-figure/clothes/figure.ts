/**
 * The figure as clothes are cut for it: its skin in the pose the file
 * stands in, how each vertex is bound to the bones, and where the joints
 * are.
 */
import { readFileSync } from "node:fs";
import * as THREE from "three/webgpu";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { styleFigure } from "../../../frontend/features/procedural-avatar/figure/createFigure";
import { STAGEHAND_STYLE } from "../../../frontend/features/procedural-avatar/figure/style";

export type V3 = [number, number, number];

export interface Figure {
    /** Every vertex of the body mesh, then every vertex of the face. */
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    /** Of those triangles, how many are the body's (they come first). */
    bodyTriangles: number;
    /** Four bones and weights per vertex, bones by index in `bones`. */
    joints: Uint16Array;
    weights: Float32Array;
    /** The body skeleton's bone names, in its order. */
    bones: string[];
    /** Where a humanoid bone's joint is, by VRM name (leftUpperArm, ...). */
    joint(name: string): V3;
    /** Bone index of a humanoid bone. */
    bone(name: string): number;
    /** Where a bone of the body skeleton is, by its index. */
    boneAt(index: number): V3;
}

export async function loadFigure(file: string): Promise<Figure> {
    const bytes = readFileSync(file);
    const loader = new GLTFLoader();
    loader.register((p) => new VRMLoaderPlugin(p));
    const gltf = await loader.parseAsync(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        ),
        ""
    );
    const vrm = gltf.userData.vrm;
    vrm.scene.updateMatrixWorld(true);
    const figure = styleFigure(vrm, STAGEHAND_STYLE, { form: "basic" });
    const { body, face } = figure.meshes;
    const bones = body.skeleton.bones.map((b) => b.name);
    const parts = [body, face];
    const count = parts.reduce(
        (n, m) => n + m.geometry.getAttribute("position").count,
        0
    );
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const joints = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    const indices: number[] = [];
    let base = 0;
    let bodyTriangles = 0;
    for (const mesh of parts) {
        const g = mesh.geometry;
        const p = g.getAttribute("position");
        const n = g.getAttribute("normal");
        const si = g.getAttribute("skinIndex");
        const sw = g.getAttribute("skinWeight");
        // The face hangs on the same bones (crowd.ts checks as much).
        const map = mesh.skeleton.bones.map((b) => bones.indexOf(b.name));
        for (let v = 0; v < p.count; v++) {
            const o = base + v;
            positions.set([p.getX(v), p.getY(v), p.getZ(v)], o * 3);
            normals.set([n.getX(v), n.getY(v), n.getZ(v)], o * 3);
            for (let k = 0; k < 4; k++) {
                joints[o * 4 + k] = Math.max(0, map[si.getComponent(v, k)]);
                weights[o * 4 + k] = sw.getComponent(v, k);
            }
        }
        const index = g.index.array;
        for (let i = 0; i < index.length; i++) indices.push(index[i] + base);
        if (mesh === body) bodyTriangles = index.length / 3;
        base += p.count;
    }
    return {
        positions,
        normals,
        indices: Uint32Array.from(indices),
        bodyTriangles,
        joints,
        weights,
        bones,
        joint(name) {
            const node = vrm.humanoid.getRawBoneNode(name);
            if (!node) throw new Error(`No ${name} bone`);
            return node.getWorldPosition(new THREE.Vector3()).toArray() as V3;
        },
        boneAt(index) {
            return body.skeleton.bones[index]
                .getWorldPosition(new THREE.Vector3())
                .toArray() as V3;
        },
        bone(name) {
            const node = vrm.humanoid.getRawBoneNode(name);
            return bones.indexOf(node?.name);
        },
    };
}
