/** Borrow the actual native avatar's authored surfaces for its travel skeleton.
 * The rig owns its original materials; never dispose the native player's maps. */
export function matchNativeTravelMaterials(travelRoot: any, nativeRoot: any) {
    const byMesh = new Map<string, any>();
    const byMaterial = new Map<string, any>();
    nativeRoot?.traverse?.((mesh: any) => {
        if (!mesh.isMesh) return;
        if (mesh.name) byMesh.set(mesh.name, mesh.material);
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            if (material?.name) byMaterial.set(material.name, material);
    });
    const originals: Array<[any, any]> = [];
    travelRoot.traverse((mesh: any) => {
        if (!mesh.isMesh) return;
        const source = mesh.material;
        const matched = byMesh.get(mesh.name);
        const replace = (material: any) =>
            byMaterial.get(material?.name) || material;
        const material =
            matched ||
            (Array.isArray(source) ? source.map(replace) : replace(source));
        if (material === source) return;
        originals.push([mesh, source]);
        mesh.material = material;
    });
    return () => {
        for (const [mesh, material] of originals) mesh.material = material;
    };
}
