import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { StyledFigure } from "./createFigure";
import { OUTFIT_FILES, outfitUrl } from "./outfitFiles";
import { createClothMaterial } from "./shading";

interface LoadedOutfit {
    geometry: THREE.BufferGeometry;
    /** Bone names its joints count in. */
    bones: string[];
    /** Body triangles it covers, as [first, count] runs. */
    hides: number[];
}

/** Each outfit, fetched once per page and copied for each wearer. */
const loaded = new Map<string, Promise<LoadedOutfit>>();

function outfitFile(id: string) {
    let pending = loaded.get(id);
    if (!pending) {
        // Outfits are packed with meshopt (tasks/avatar-figure/clothes).
        const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
        pending = loader.loadAsync(outfitUrl(id)).then((gltf) => {
            let found: LoadedOutfit | undefined;
            gltf.scene.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (!mesh.isMesh || found) return;
                const extras = (mesh.userData || {}) as Partial<LoadedOutfit>;
                found = {
                    geometry: mesh.geometry,
                    bones: extras.bones || [],
                    hides: extras.hides || [],
                };
            });
            if (!found) throw new Error(`No clothes in ${id}`);
            return found;
        });
        loaded.set(id, pending);
        pending.catch(() => loaded.delete(id));
    }
    return pending;
}

/**
 * Dress a figure: one mesh on the figure's skeleton, bound as the file
 * says, and the body's triangles under it left out (they would only show
 * through where the body bends). Its colours are its own. Null for none.
 */
export async function wearClothes(
    figure: StyledFigure,
    id: string | null
): Promise<THREE.SkinnedMesh | null> {
    if (!id || !OUTFIT_FILES[id]) return null;
    const body = figure.meshes.body;
    const skeleton = body.skeleton;
    const outfit = OUTFIT_FILES[id];
    const file = await outfitFile(outfit.file);
    const geometry = file.geometry.clone();
    // The file counts joints in the body skeleton's own order; map by name
    // in case the order ever differs.
    const names = skeleton.bones.map((bone) => bone.name);
    const remap = file.bones.map((name) => Math.max(0, names.indexOf(name)));
    const joints = geometry.getAttribute("skinIndex");
    if (remap.some((to, from) => to !== from)) {
        const out = new Uint16Array(joints.count * 4);
        for (let v = 0; v < joints.count; v++)
            for (let k = 0; k < 4; k++)
                out[v * 4 + k] = remap[joints.getComponent(v, k)] ?? 0;
        geometry.setAttribute(
            "skinIndex",
            new THREE.Uint16BufferAttribute(out, 4)
        );
    }
    const material = createClothMaterial(outfit.stripes);
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = `Clothes_${id}`;
    mesh.frustumCulled = false;
    body.parent.add(mesh);
    mesh.bind(skeleton, body.bindMatrix);
    hideCovered(body.geometry, file.hides);
    return mesh;
}

/** Leave the covered triangles out of the body's index. */
function hideCovered(geometry: THREE.BufferGeometry, hides: number[]) {
    const index = geometry.index;
    if (!index || !hides.length) return;
    const triangles = index.count / 3;
    const hidden = new Uint8Array(triangles);
    for (let i = 0; i < hides.length; i += 2)
        hidden.fill(1, hides[i], Math.min(triangles, hides[i] + hides[i + 1]));
    const kept: number[] = [];
    for (let t = 0; t < triangles; t++)
        if (!hidden[t])
            kept.push(
                index.getX(t * 3),
                index.getX(t * 3 + 1),
                index.getX(t * 3 + 2)
            );
    geometry.setIndex(kept);
}
