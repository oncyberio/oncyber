import * as THREE from "three/webgpu";
import { CharacterSpec, RUNNER } from "./characters";
import {
    AvatarData,
    GenerateOptions,
    MaterialSpec,
    generateAvatar,
    generateSteps,
} from "./generate";
import { SpringChain } from "./spring";

export { CHARACTERS, RUNNER } from "./characters";
export type { CharacterSpec } from "./characters";
export { generateAvatar } from "./generate";
export type { AvatarData } from "./generate";

/**
 * A procedural avatar on a three.js skeleton. Bones carry the VRM humanoid
 * names and rest in a T-pose with identity rotations, facing +Z, so the
 * same motion clips that drive VRM avatars drive this one.
 */
export interface ProceduralAvatar {
    /** Holds the skinned meshes and the skeleton's root bone. */
    scene: THREE.Group;
    bones: Record<string, THREE.Bone>;
    /** Named parts, so clothes can be shown or hidden one by one. */
    parts: Record<string, THREE.SkinnedMesh>;
    /** Put the skeleton in the pose the surfaces were sculpted in. */
    applyDesignPose(): void;
    /** Advance secondary motion (hair). Call after animation each frame. */
    update(dt: number): void;
    /** Milliseconds spent building each stage, for tuning. */
    timings: Record<string, number>;
    dispose(): void;
}

function createMaterial(spec: MaterialSpec): THREE.Material {
    if (spec.kind === "glass")
        return new THREE.MeshLambertMaterial({
            color: spec.colour,
            transparent: true,
            opacity: spec.opacity,
        });
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    if (spec.kind === "textured") {
        const { data, width, height } = spec.texture;
        const texture = new THREE.DataTexture(
            data,
            width,
            height,
            THREE.RGBAFormat
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = 4;
        if (spec.repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        material.map = texture;
    }
    return material;
}

/** Turn generated avatar data into three.js objects. */
export function assembleAvatar(data: AvatarData): ProceduralAvatar {
    const scene = new THREE.Group();
    scene.name = `procedural-avatar-${data.id}`;
    const index: Record<string, number> = {};
    data.bones.forEach((bone, i) => (index[bone.name] = i));
    const nodes = data.bones.map((def) => {
        const bone = new THREE.Bone();
        bone.name = def.name;
        return bone;
    });
    const inverses: THREE.Matrix4[] = [];
    data.bones.forEach((def, i) => {
        const parent = def.parent === null ? null : index[def.parent];
        const from = parent === null ? [0, 0, 0] : data.bones[parent].position;
        nodes[i].position.set(
            def.position[0] - from[0],
            def.position[1] - from[1],
            def.position[2] - from[2]
        );
        if (parent !== null) nodes[parent].add(nodes[i]);
        inverses.push(
            new THREE.Matrix4().makeTranslation(
                -def.position[0],
                -def.position[1],
                -def.position[2]
            )
        );
    });
    scene.add(nodes[0]);
    const skeleton = new THREE.Skeleton(nodes, inverses);
    const parts: Record<string, THREE.SkinnedMesh> = {};
    for (const part of data.parts) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(part.positions, 3)
        );
        geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(part.normals, 3)
        );
        geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(part.colors, 3)
        );
        geometry.setAttribute("uv", new THREE.BufferAttribute(part.uvs, 2));
        geometry.setAttribute(
            "skinIndex",
            new THREE.Uint16BufferAttribute(part.skinIndex, 4)
        );
        geometry.setAttribute(
            "skinWeight",
            new THREE.Float32BufferAttribute(part.skinWeight, 4)
        );
        geometry.setIndex(
            new THREE.BufferAttribute(
                part.positions.length / 3 > 65535
                    ? part.indices
                    : new Uint16Array(part.indices),
                1
            )
        );
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const mesh = new THREE.SkinnedMesh(
            geometry,
            createMaterial(part.material)
        );
        mesh.name = `${data.id}_${part.name}`;
        // Skinned bounds lag the pose; the avatar is always worth drawing.
        mesh.frustumCulled = false;
        scene.add(mesh);
        mesh.bind(skeleton, new THREE.Matrix4());
        parts[part.name] = mesh;
    }
    const bones = Object.fromEntries(nodes.map((bone) => [bone.name, bone]));
    const springs = data.springs.map((spec) => new SpringChain(bones, spec));
    return {
        scene,
        bones,
        parts,
        timings: data.timings,
        applyDesignPose() {
            for (const [name, [axis, angle]] of Object.entries(data.pose)) {
                const rotation = [0, 0, 0];
                rotation[axis] = angle;
                bones[name]?.rotation.set(
                    rotation[0],
                    rotation[1],
                    rotation[2]
                );
            }
        },
        update(dt) {
            for (const spring of springs) spring.update(dt);
        },
        dispose() {
            for (const mesh of Object.values(parts)) {
                mesh.geometry.dispose();
                const material = mesh.material as THREE.MeshLambertMaterial;
                material.map?.dispose();
                material.dispose();
            }
            skeleton.dispose();
        },
    };
}

/** Build a character and put it on a skeleton, all at once. */
export function createProceduralAvatar(
    spec: CharacterSpec = RUNNER,
    options: GenerateOptions = {}
): ProceduralAvatar {
    return assembleAvatar(generateAvatar(spec, options));
}

/**
 * Build a character's data without holding up the page: generation runs in
 * slices, yielding to the browser between them.
 */
export async function generateAvatarInSlices(
    spec: CharacterSpec,
    options: GenerateOptions = {},
    signal?: AbortSignal
): Promise<AvatarData> {
    const steps = generateSteps(spec, options);
    for (;;) {
        const next = steps.next();
        if (next.done) return next.value;
        signal?.throwIfAborted();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}
