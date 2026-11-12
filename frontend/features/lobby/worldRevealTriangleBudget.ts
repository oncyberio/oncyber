import { isWorldRevealShaderMaterial } from "./worldRevealMaterial";

const BASE_TRIANGLES = 120000;
const MAX_TRIANGLES = 160000;
const SOURCE_ALLOWANCE = 1.6;
const MAX_INSTANCES = 4096;

/** Count source topology, not empty room size. Dense authored interiors need
 * some space for tile cuts on top of their original triangles. This metadata-only
 * estimate stops at the hard ceiling and never reads/duplicates vertex buffers. */
export function getWorldRevealTriangleBudget(
    roots: any[],
    exclude?: (object: any) => boolean
): number {
    const visited = new Set<any>();
    let sourceTriangles = 0;
    let instanceReads = 0;
    const enough = () => sourceTriangles * SOURCE_ALLOWANCE >= MAX_TRIANGLES;
    const visit = (object: any) => {
        if (!object || visited.has(object) || enough()) return;
        visited.add(object);
        if (
            object.visible === false ||
            object.userData?.worldRevealExclude === true ||
            exclude?.(object)
        )
            return;
        if (object.isMesh) {
            const geometry = object.geometry;
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            const position = geometry?.attributes?.position;
            const total = geometry?.index?.count ?? position?.count;
            const supported =
                position &&
                Number.isSafeInteger(total) &&
                total >= 0 &&
                total / 3 <= MAX_TRIANGLES &&
                !object.isSkinnedMesh &&
                !geometry.isInstancedBufferGeometry &&
                !Object.keys(geometry.morphAttributes ?? {}).length &&
                materials.length &&
                materials.every(
                    (material) =>
                        material &&
                        !isWorldRevealShaderMaterial(material) &&
                        material.constructor?.name !== "BillboardYMaterial"
                );
            if (supported) {
                let copies = 1;
                if (object.isInstancedMesh) {
                    const count = object.count;
                    const matrices = object.instanceMatrix;
                    const colors = object.instanceColor;
                    if (
                        !Number.isSafeInteger(count) ||
                        count < 0 ||
                        !Number.isSafeInteger(matrices?.count) ||
                        matrices.itemSize !== 16 ||
                        count > matrices.count ||
                        typeof object.getMatrixAt !== "function" ||
                        instanceReads + count > MAX_INSTANCES ||
                        (colors &&
                            (colors.itemSize !== 3 || colors.count < count))
                    )
                        copies = 0;
                    else {
                        instanceReads += count;
                        copies = count;
                    }
                }
                const start = Math.max(0, geometry.drawRange?.start ?? 0);
                const end = Math.min(
                    total,
                    start + (geometry.drawRange?.count ?? total)
                );
                if (
                    Number.isSafeInteger(start) &&
                    Number.isSafeInteger(end) &&
                    end > start &&
                    copies
                ) {
                    let count = 0;
                    if (!Array.isArray(object.material)) {
                        if (object.material.visible !== false)
                            count = Math.floor((end - start) / 3);
                    } else {
                        // Groups normally partition the draw range. Clamp overlapping
                        // author data to the whole source as a conservative estimate.
                        for (const group of geometry.groups ?? []) {
                            if (
                                materials[group.materialIndex]?.visible ===
                                    false ||
                                !materials[group.materialIndex]
                            )
                                continue;
                            const overlap = Math.max(
                                0,
                                Math.min(end, group.start + group.count) -
                                    Math.max(start, group.start)
                            );
                            if (Number.isFinite(overlap))
                                count += Math.floor(overlap / 3);
                        }
                        count = Math.min(count, Math.floor((end - start) / 3));
                    }
                    sourceTriangles += count * copies;
                }
            }
        }
        for (const child of object.children ?? []) {
            if (enough()) break;
            visit(child);
        }
    };
    for (const root of roots) {
        let parent = root?.parent;
        let hidden = false;
        while (parent) {
            hidden ||= parent.visible === false;
            parent = parent.parent;
        }
        if (!hidden) visit(root);
        if (enough()) break;
    }
    return Math.max(
        BASE_TRIANGLES,
        Math.min(
            MAX_TRIANGLES,
            Math.ceil((sourceTriangles * SOURCE_ALLOWANCE) / 1000) * 1000
        )
    );
}
