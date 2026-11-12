import type * as THREE from "three/webgpu";

/** Include node/shader samplers, but don't follow references into other scenes. */
export function collectAvatarTextures(
    material: THREE.Material,
    target: Set<THREE.Texture>
) {
    const visited = new Set<object>();
    const visit = (value: any) => {
        if (!value || typeof value !== "object" || visited.has(value)) return;
        if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
        visited.add(value);
        if (value.isTexture) target.add(value);
        else if (!value.isObject3D) Object.values(value).forEach(visit);
    };
    Object.values(material).forEach(visit);
}

function imageSources(texture: THREE.Texture): any[] {
    const data = texture.source?.data ?? texture.image;
    return Array.isArray(data) ? data : [data];
}

/** Texture clones can share a bitmap even when their sampler settings differ. */
export function disposeAvatarTextures(
    textures: Set<THREE.Texture>,
    retained: Set<THREE.Texture> = new Set()
) {
    const keptImages = new Set([...retained].flatMap(imageSources));
    for (const texture of textures)
        if (texture.userData?.isShared)
            imageSources(texture).forEach((image) => keptImages.add(image));
    const closed = new Set();
    for (const texture of textures) {
        if (retained.has(texture) || texture.userData?.isShared) continue;
        texture.dispose();
        // Three's Texture.dispose only releases the GPU allocation. GLTF's
        // decoded ImageBitmaps need explicit closing when their last owner leaves.
        for (const image of imageSources(texture)) {
            if (
                typeof image?.close !== "function" ||
                keptImages.has(image) ||
                closed.has(image)
            )
                continue;
            closed.add(image);
            image.close();
        }
    }
}

/** Each parsed lobby avatar owns its resources; peers only share encoded bytes. */
export function disposeAvatarGraph(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    const skeletons = new Set<THREE.Skeleton>();
    const materials = new Set<THREE.Material>(
        root.userData.lobbyRetiredMaterials
    );
    const textures = new Set<THREE.Texture>();
    const retained = new Set<THREE.Texture>();
    root.traverse((object) => {
        const mesh = object as THREE.SkinnedMesh;
        if (mesh.geometry && !mesh.geometry.userData?.isShared)
            geometries.add(mesh.geometry);
        if (mesh.skeleton) skeletons.add(mesh.skeleton);
        const values = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        values.forEach((material) => {
            if (material) materials.add(material);
        });
    });
    materials.forEach((material) =>
        collectAvatarTextures(
            material,
            material.userData?.isShared ? retained : textures
        )
    );
    geometries.forEach((geometry) => geometry.dispose());
    skeletons.forEach((skeleton) => skeleton.dispose());
    disposeAvatarTextures(textures, retained);
    materials.forEach((material) => {
        if (!material.userData?.isShared) material.dispose();
    });
    root.userData.lobbyRetiredMaterials?.clear();
}
