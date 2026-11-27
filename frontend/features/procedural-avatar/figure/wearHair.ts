import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HAIR_FILES, hairUrl } from "./hairFiles";
import type { StyledFigure } from "./createFigure";

/** Each cut's mesh, fetched once per page and copied for each wearer. */
const loaded = new Map<string, Promise<THREE.BufferGeometry>>();

function hairGeometry(id: string) {
    let pending = loaded.get(id);
    if (!pending) {
        pending = new GLTFLoader().loadAsync(hairUrl(id)).then((gltf) => {
            let geometry: THREE.BufferGeometry | undefined;
            gltf.scene.traverse((object) => {
                const mesh = object as THREE.Mesh;
                if (mesh.isMesh && !geometry) geometry = mesh.geometry;
            });
            if (!geometry) throw new Error(`No hair in ${id}`);
            return geometry;
        });
        loaded.set(id, pending);
        pending.catch(() => loaded.delete(id));
    }
    return pending;
}

/**
 * Put a cut on a figure, in a colour: one mesh on the figure's skeleton,
 * moved by the head bone alone, so it goes wherever the head does and a
 * crowd can draw it like the rest of the figure. Its own colours are
 * light and shade; `colour` is the hair's. Null for no hair.
 */
export async function wearHair(
    figure: StyledFigure,
    id: string | null,
    colour: string
): Promise<THREE.SkinnedMesh | null> {
    if (!id || !HAIR_FILES[id]) return null;
    const body = figure.meshes.body;
    const skeleton = body.skeleton;
    const head = skeleton.bones.findIndex((bone) => /_C_Head$/.test(bone.name));
    if (head < 0) throw new Error("The figure has no head bone");
    const geometry = (await hairGeometry(id)).clone();
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute(
        "skinIndex",
        new THREE.Uint16BufferAttribute(
            new Uint16Array(count * 4).map((_, i) => (i % 4 ? 0 : head)),
            4
        )
    );
    geometry.setAttribute(
        "skinWeight",
        new THREE.Float32BufferAttribute(
            new Float32Array(count * 4).map((_, i) => (i % 4 ? 0 : 1)),
            4
        )
    );
    // Plain lit colour: the lobby gives it the same light as other avatars.
    const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(colour),
        vertexColors: true,
    });
    material.name = "FigureHair";
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = `Hair_${id}`;
    mesh.frustumCulled = false;
    body.parent.add(mesh);
    mesh.bind(skeleton, body.bindMatrix);
    return mesh;
}
