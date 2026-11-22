import type * as T from "three/webgpu";
import {
    linearDye,
    shapeWeights,
    visiblePart,
    type Look,
    type Surface,
} from "./look";
export function applyLiveLook(root: T.Object3D, look: Look) {
    const values = shapeWeights(look);
    root.traverse((node) => {
        const mesh = node as T.Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as T.MeshBasicMaterial;
        const part: Surface = material.userData;
        if (part.studioColor) {
            const [r, g, b] = linearDye(part.studioColor, look);
            material.color.setRGB(r, g, b);
        }
        mesh.visible = visiblePart(part, look);
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        for (const [shape, weight] of Object.entries(values)) {
            const i = mesh.morphTargetDictionary[shape];
            if (i !== undefined) mesh.morphTargetInfluences[i] = weight;
        }
    });
}
