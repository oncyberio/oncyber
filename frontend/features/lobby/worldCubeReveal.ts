import {
    sampleWorldCell,
    WORLD_TILE_MAX_DELAY,
    WORLD_TILE_SPAN,
} from "./worldTileMotion";
import {
    buildRadialCellSchedule,
    type RevealPoint,
    type WorldRevealDirection,
} from "./worldRadialReveal";
import { createWorldTileGlowMaterial } from "./worldTileGlow";
import { createWorldTileBackMaterial } from "./worldTileBack";
import { finishNow } from "./slicedWork";
import {
    cloneWorldRevealMaterial,
    copyWorldRevealMaterial,
    isWorldRevealShaderMaterial,
} from "./worldRevealMaterial";

/** Actual destination mesh fragments, partitioned in world metres. No DOM,
 * render targets, framebuffer copies, screen coordinates or image readback. */
export interface WorldCubeRevealOptions {
    scene: any;
    anchor: { x: number; y: number; z: number };
    exclude?: (object: any) => boolean;
    /** Hold these media groups too, so late children cannot bypass the snapshot.
     * Do not include ancestors of excluded avatars or sky sources. */
    hideRoots?: readonly any[];
    cellSize?: number;
    mode?: "reveal" | "dissolve";
    /** Spatial order, independent of tile motion. Arrival defaults to outward. */
    direction?: WorldRevealDirection;
    /** Shared physical wave extent when another effect handles media separately. */
    waveExtent?: number;
    /** Near-detail extent in metres. Nearby mode omits more distant geometry. */
    radius?: number;
    /** Cover the complete source surfaces with coarser, aligned tiles farther out. */
    coverage?: "nearby" | "all";
    /** Spend remaining bounds on smaller cells after complete surfaces are retained. */
    refinement?: {
        minCellSize: number;
        maxCellSize: number;
        /** Distance through which the finest squares are preferred. Defaults to 8m. */
        detailRadius?: number;
        /** Camera position: spend the same detail bounds where tiles appear largest. */
        focus?: RevealPoint;
        /** World view direction. Offscreen cells retain complete coarse coverage. */
        forward?: RevealPoint;
    };
    /** Reuse bounded compact high-detail props instead of copying/cutting their triangles. */
    rigidProps?: {
        minTriangles: number;
        maxExtent: number;
        maxSources: number;
        maxTriangles: number;
    };
    maxTriangles?: number;
    maxCells?: number;
    maxFragments?: number;
    maxClipTests?: number;
    maxBatches?: number;
    /** Maximum instance matrices inspected across the reveal. */
    maxInstances?: number;
    onSkip?: (object: any, reason: string) => void;
    onInstance?: (object: any, index: number) => void;
}
export interface WorldCubeRevealRestartOptions {
    mode: "reveal" | "dissolve";
    anchor: RevealPoint;
    direction?: WorldRevealDirection;
    waveExtent?: number;
}
interface Vertex {
    p: number[];
    attributes: Record<string, number[]>;
}
const clamp = (n: number) =>
    Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
function snapshotRevealAnchor(anchor: RevealPoint): RevealPoint {
    // The native Three fork's ObsVector3 exposes xyz through prototype getters.
    // Spreading it copies only _x/_y/_z and loses the actual coordinates.
    const point = { x: anchor?.x, y: anchor?.y, z: anchor?.z };
    if (![point.x, point.y, point.z].every(Number.isFinite))
        throw new Error("Reveal anchor needs finite coordinates.");
    return point;
}
function interpolate(a: Vertex, b: Vertex, t: number): Vertex {
    const attributes: Record<string, number[]> = {};
    for (const key of Object.keys(a.attributes))
        attributes[key] = a.attributes[key].map(
            (v, i) => v + (b.attributes[key][i] - v) * t
        );
    return { p: a.p.map((v, i) => v + (b.p[i] - v) * t), attributes };
}
/** Sutherland-Hodgman clipping retains material UVs and other vertex attributes. */
function clip(
    vertices: Vertex[],
    axis: number,
    bound: number,
    above: boolean
): Vertex[] {
    if (!vertices.length) return [];
    const output: Vertex[] = [];
    let last = vertices[vertices.length - 1],
        insideLast = above
            ? last.p[axis] >= bound - 1e-7
            : last.p[axis] <= bound + 1e-7;
    for (const current of vertices) {
        const inside = above
            ? current.p[axis] >= bound - 1e-7
            : current.p[axis] <= bound + 1e-7;
        if (inside !== insideLast)
            output.push(
                interpolate(
                    last,
                    current,
                    (bound - last.p[axis]) / (current.p[axis] - last.p[axis])
                )
            );
        if (inside) output.push(current);
        last = current;
        insideLast = inside;
    }
    return output;
}
export function createWorldCubeReveal(
    THREE: any,
    roots: any[],
    options: WorldCubeRevealOptions
) {
    return finishNow(buildWorldCubeReveal(THREE, roots, options));
}

/** Yields between meshes, refinements and batches; see slicedWork. */
export function* buildWorldCubeReveal(
    THREE: any,
    roots: any[],
    options: WorldCubeRevealOptions
) {
    // Validate before adding a container or hiding any destination meshes.
    const anchor = snapshotRevealAnchor(options.anchor);
    const size = Number.isFinite(options.cellSize)
        ? Math.max(0.3, Math.min(8, options.cellSize))
        : 0.55;
    const maxCells = options.maxCells ?? 12000,
        maxTriangles = options.maxTriangles ?? 120000;
    const scene = options.scene;
    let mode = options.mode ?? "reveal";
    let direction = options.direction;
    let waveExtent = options.waveExtent;
    const radius = Number.isFinite(options.radius)
        ? Math.max(size, options.radius)
        : Infinity;
    const fullCoverage = options.coverage === "all";
    // Every outer shell doubles the physical tile size. An even cell count makes
    // its inner boundary coincide exactly with the preceding shell's grid.
    const shellCells =
        2 *
        Math.max(
            1,
            Math.ceil((Number.isFinite(radius) ? radius : 18) / size / 2)
        );
    const anchorVector = new THREE.Vector3(anchor.x, anchor.y, anchor.z);
    const container = new THREE.Group();
    container.name = "native-world-cube-reveal";
    type Span = {
        start: number;
        count: number;
        source: string;
        cellKey: string;
    };
    type Cell = {
        center: any;
        pivot?: any;
        surfaceNormal?: { x: number; y: number; z: number };
        size: number;
        delay: number;
        seed: number;
        spans: Span[];
        sample?: ReturnType<typeof sampleWorldCell>;
        motion?: Parameters<typeof sampleWorldCell>[1];
        unchanged?: string;
    };
    type Batch = {
        material: any;
        schema: Record<string, number>;
        layers: number;
        renderOrder: number;
        receiveShadow: boolean;
        sortSphere?: any;
        pieces: Array<{
            cell: Cell;
            cellKey: string;
            source: string;
            sourceId: string;
            vertices: Vertex[];
        }>;
    };
    const cells = new Map<string, Cell>();
    const rigidCells = new Map<string, Cell>();
    const rigidRecords = new Map<
        Cell,
        { proxy: any; matrix: any; drawCalls: number }
    >();
    const rigidMaterials = new Set<any>();
    const materialClones: Array<{
        source: any;
        clone: any;
        vertexColors?: boolean;
        color?: number[];
    }> = [];
    const preparedSources = new Set<any>();
    const batches = new Map<string, Batch>();
    const materialIds = new Map<any, number>();
    const instanceSources = new Map<
        any,
        {
            owner: any;
            index: number;
            color?: number[];
            vertexColors: boolean[];
        }
    >();
    const colorMaterials = new Map<any, any>();
    const tileMaterials = new Map<any, any>();
    // Double-sided room surfaces can be viewed from either authored face.
    // Preserve that sidedness throughout motion and cached departure reuse.
    const tileMaterial = (material: any) => {
        if (material.side !== THREE.DoubleSide) return material;
        if (!tileMaterials.has(material)) {
            const front = cloneWorldRevealMaterial(material);
            tileMaterials.set(material, front);
            materialClones.push({
                source: material,
                clone: front,
            });
        }
        return tileMaterials.get(material);
    };
    const geometryBounds = new Map<any, any>();
    const localBounds = (geometry: any) => {
        if (!geometryBounds.has(geometry)) {
            const bounds = new THREE.Box3();
            if (geometry?.boundingBox) bounds.copy(geometry.boundingBox);
            else if (geometry?.attributes?.position)
                bounds.setFromBufferAttribute(geometry.attributes.position);
            geometryBounds.set(geometry, bounds);
        }
        return geometryBounds.get(geometry);
    };
    const attributeSizes: Record<string, number> = { position: 3, normal: 3 };
    const originals = new Map<any, boolean>(),
        geometries: any[] = [];
    let background = scene.background,
        fog = scene.fog;
    const black = new THREE.Color(0x000000);
    const stats = {
        cells: 0,
        triangles: 0,
        sourceTriangles: 0,
        baseTriangles: 0,
        baseClipTests: 0,
        refinementClipTests: 0,
        clipTests: 0,
        clipSlabFastPaths: 0,
        vertexTransforms: 0,
        vertexCacheHits: 0,
        skipped: 0,
        fragments: 0,
        batches: 0,
        drawCalls: 0,
        backDrawCalls: 0,
        vertices: 0,
        instances: 0,
        rigidSources: 0,
        rigidTriangles: 0,
        maxDistance: 0,
        maxCellSize: 0,
        minCellSize: 0,
        refinedCells: 0,
        refinementAttempts: 0,
        refinementLimited: 0,
        refinementLimit: "none",
        reuseMiss: "",
        levels: 0,
        // Camera-cone estimates, not occlusion tests. Counts expose where detail went.
        viewCells: 0,
        viewCellSizeCounts: {} as Record<string, number>,
    };
    let measureView:
        | ((cell: Cell) => { apparent: number; visibility: number })
        | undefined;
    let disposed = false,
        parked = false,
        progress = 0,
        clipTests = 0;
    const clipSlab = (
        polygon: Vertex[],
        axis: number,
        lower: number,
        width = size
    ) => {
        if (++clipTests > (options.maxClipTests ?? 250000))
            throw new Error("clipping work bound");
        // Dense authored meshes mostly contain triangles already wholly inside
        // a slab. Preserve their vertices instead of allocating two polygons.
        let below = 0,
            above = 0;
        const low = lower - 1e-7,
            high = lower + width + 1e-7;
        for (const vertex of polygon) {
            if (vertex.p[axis] < low) below++;
            if (vertex.p[axis] > high) above++;
        }
        if (!below && !above) {
            stats.clipSlabFastPaths++;
            return polygon;
        }
        if (below === polygon.length || above === polygon.length) {
            stats.clipSlabFastPaths++;
            return [];
        }
        return clip(
            clip(polygon, axis, lower, true),
            axis,
            lower + width,
            false
        );
    };
    const visited = new Set<any>();
    scene.updateMatrixWorld(true);
    const inverseScene = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    container.matrixAutoUpdate = false;
    container.matrix.copy(inverseScene);
    // A departure builds (in slices) while the visitor still looks at the
    // world. Keep every source on screen and the half-built tiles off it until
    // the build commits; setProgress(0) then applies the intact state. A
    // reveal builds behind black, so it hides sources as it consumes them.
    const deferHiding = mode === "dissolve";
    if (deferHiding) container.visible = false;
    scene.add(container);
    const hide = (object: any) => {
        const owner = instanceSources.get(object)?.owner ?? object;
        if (!originals.has(owner)) originals.set(owner, owner.visible);
        if (!deferHiding) owner.visible = false;
    };
    const skip = (object: any, reason: string) => {
        hide(object);
        stats.skipped++;
        try {
            options.onSkip?.(object, reason);
        } catch {
            // Diagnostics must not interrupt scene construction or restoration.
        }
    };
    const tryRigid = (object: any, materials: any[], total: number) => {
        const limits = options.rigidProps,
            geometry = object.geometry;
        if (
            !limits ||
            !Number.isSafeInteger(limits.maxSources) ||
            !Number.isSafeInteger(limits.maxTriangles) ||
            !Number.isFinite(limits.minTriangles) ||
            !Number.isFinite(limits.maxExtent) ||
            limits.minTriangles <= 0 ||
            limits.maxExtent <= 0 ||
            stats.rigidSources >= limits.maxSources ||
            !Number.isSafeInteger(total) ||
            total < 3 ||
            !geometry?.attributes?.position ||
            object.isSkinnedMesh ||
            object.isInstancedMesh ||
            geometry.isInstancedBufferGeometry ||
            Object.keys(geometry.morphAttributes ?? {}).length ||
            !materials.length ||
            materials.some(
                (material) =>
                    !material ||
                    isWorldRevealShaderMaterial(material) ||
                    material.constructor?.name === "BillboardYMaterial"
            ) ||
            !object.matrixWorld?.elements?.every(Number.isFinite)
        )
            return false;
        const start = Math.max(0, geometry.drawRange?.start ?? 0);
        const end = Math.min(
            total,
            start + (geometry.drawRange?.count ?? total)
        );
        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start % 3 ||
            end % 3 ||
            end <= start
        )
            return false;
        let triangles = 0,
            drawCalls = 0;
        if (Array.isArray(object.material)) {
            for (const group of geometry.groups ?? []) {
                if (
                    !Number.isSafeInteger(group.start) ||
                    !Number.isSafeInteger(group.count) ||
                    group.start % 3 ||
                    group.count % 3
                )
                    return false;
                const material = materials[group.materialIndex];
                if (!material || material.visible === false) continue;
                const count = Math.max(
                    0,
                    Math.min(end, group.start + group.count) -
                        Math.max(start, group.start)
                );
                if (count) {
                    triangles += count / 3;
                    drawCalls++;
                }
            }
        } else if (materials[0].visible !== false) {
            triangles = (end - start) / 3;
            drawCalls = 1;
        }
        if (
            triangles < limits.minTriangles ||
            stats.rigidTriangles + triangles > limits.maxTriangles
        )
            return false;
        const bounds = localBounds(geometry)
            .clone()
            .applyMatrix4(object.matrixWorld);
        const extent = bounds.getSize(new THREE.Vector3());
        if (
            ![extent.x, extent.y, extent.z].every(Number.isFinite) ||
            bounds.isEmpty() ||
            Math.max(extent.x, extent.y, extent.z) > limits.maxExtent ||
            (!fullCoverage && bounds.distanceToPoint(anchorVector) > radius)
        )
            return false;
        const instance = instanceSources.get(object);
        // Multiply instance tint into a small material clone. Reusing source vertex
        // colors must still respect each original material's vertexColors flag.
        if (
            instance?.color &&
            materials.some((material) => !material.color?.isColor)
        )
            return false;
        const proxyMaterials = materials.map((source, index) => {
            let material = source;
            if (instance?.color) {
                material = cloneWorldRevealMaterial(source);
                material.color.multiply(
                    new THREE.Color().fromArray(instance.color)
                );
                material.vertexColors = instance.vertexColors[index];
                rigidMaterials.add(material);
                materialClones.push({
                    source,
                    clone: material,
                    color: instance.color,
                    vertexColors: instance.vertexColors[index],
                });
            }
            return tileMaterial(material);
        });
        const proxy = new THREE.Mesh(
            geometry,
            Array.isArray(object.material) ? proxyMaterials : proxyMaterials[0]
        );
        proxy.name = `world-rigid:${object.name || object.uuid}`;
        proxy.userData.worldRevealSources = [object.name || object.uuid];
        proxy.matrixAutoUpdate = false;
        proxy.matrix.copy(object.matrixWorld);
        proxy.layers.mask = object.layers.mask;
        proxy.renderOrder = object.renderOrder;
        proxy.receiveShadow = object.receiveShadow;
        proxy.castShadow = object.castShadow === true;
        proxy.frustumCulled = false;
        const center = bounds.getCenter(new THREE.Vector3());
        const cell: Cell = {
            center,
            pivot: center,
            size: Math.max(0.125, Math.max(extent.x, extent.y, extent.z)),
            surfaceNormal: {
                x: extent.y * extent.z,
                y: extent.x * extent.z,
                z: extent.x * extent.y,
            },
            delay: 0,
            seed: 0,
            spans: [],
        };
        const key = `rigid:${object.uuid}`;
        proxy.userData.worldRevealRigidKey = key;
        rigidCells.set(key, cell);
        rigidRecords.set(cell, {
            proxy,
            matrix: object.matrixWorld.clone(),
            drawCalls,
        });
        container.add(proxy);
        stats.rigidSources++;
        stats.rigidTriangles += triangles;
        preparedSources.add(instance?.owner ?? object);
        if (instance) {
            stats.instances++;
            try {
                options.onInstance?.(instance.owner, instance.index);
            } catch {
                /* diagnostic only */
            }
        }
        hide(object);
        return true;
    };
    const candidates: any[] = [];
    const collect = (object: any, inheritedExcluded = false) => {
        if (!object || visited.has(object) || object === container) return;
        visited.add(object);
        const excluded =
            inheritedExcluded ||
            options.exclude?.(object) ||
            object.userData?.worldRevealExclude === true ||
            object.userData?.worldTravelBackground === true;
        if (excluded || object.visible === false) return;
        if (object.isMesh) candidates.push(object);
        for (const child of object.children ?? []) collect(child, excluded);
    };
    const visit = (object: any) => {
        if (object.isMesh && object.visible) {
            const geometry = object.geometry,
                position = geometry?.attributes?.position;
            const instance = instanceSources.get(object);
            const attrs = Object.entries(geometry?.attributes ?? {}).filter(
                ([name, a]: [string, any]) =>
                    name !== "position" &&
                    a.itemSize <= 4 &&
                    !a.isInstancedBufferAttribute
            );
            const schema: Record<string, number> = { position: 3, normal: 3 };
            for (const [name, a] of attrs as Array<[string, any]>)
                schema[name] = a.itemSize;
            if (instance?.color)
                schema.color =
                    geometry.attributes.color?.itemSize === 4 ? 4 : 3;
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            const total = geometry?.index?.count ?? position?.count ?? 0;
            // Transparent surfaces require per-object sorting; do not merge them
            // into an incorrectly sorted global material batch.
            const schemaKey = Object.keys(schema)
                .sort()
                .map((key) => `${key}:${schema[key]}`)
                .join(",");
            const batchKey = (material: any) => {
                if (!materialIds.has(material))
                    materialIds.set(material, materialIds.size);
                return `${materialIds.get(material)}|${schemaKey}|${
                    object.layers.mask
                }|${object.renderOrder}|${Number(object.receiveShadow)}${
                    material.transparent ? `|${object.uuid}` : ""
                }`;
            };
            if (tryRigid(object, materials, total)) return;
            const unsupported = object.isSkinnedMesh
                ? "skinned"
                : materials.some(
                      (m: any) => m?.constructor?.name === "BillboardYMaterial"
                  )
                ? "billboard-material"
                : object.isInstancedMesh || geometry?.isInstancedBufferGeometry
                ? "instanced"
                : Object.keys(geometry?.morphAttributes ?? {}).length > 0
                ? "morph"
                : materials.some((m: any) => !m)
                ? "missing-material"
                : materials.some(isWorldRevealShaderMaterial)
                ? "shader-material"
                : !position
                ? "missing-position"
                : total / 3 > maxTriangles
                ? "source-triangle-budget"
                : null;
            if (unsupported) {
                skip(object, unsupported);
            } else {
                try {
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(
                        object.matrixWorld
                    );
                    const v = new THREE.Vector3();
                    const mirrored = object.matrixWorld.determinant() < 0;
                    const getters = ["getX", "getY", "getZ", "getW"];
                    // Indexed architecture reuses each transformed vertex across
                    // its incident faces. Face-derived normals and per-material
                    // instance tints remain triangle-local; never cache those.
                    const vertexCache =
                        geometry.index &&
                        geometry.attributes.normal &&
                        !instance?.color
                            ? new Map<number, Vertex>()
                            : undefined;
                    const read = (index: number): Vertex => {
                        const cached = vertexCache?.get(index);
                        if (cached) {
                            stats.vertexCacheHits++;
                            return cached;
                        }
                        stats.vertexTransforms++;
                        v.fromBufferAttribute(position, index).applyMatrix4(
                            object.matrixWorld
                        );
                        const p = [v.x, v.y, v.z],
                            attributes: Record<string, number[]> = {};
                        for (const [name, a] of attrs as Array<[string, any]>) {
                            const values = new Array(a.itemSize);
                            for (let i = 0; i < a.itemSize; i++)
                                values[i] = a[getters[i]](index);
                            if (name === "normal") {
                                v.fromArray(values)
                                    .applyMatrix3(normalMatrix)
                                    .normalize();
                                values.splice(0, 3, v.x, v.y, v.z);
                            }
                            if (name === "tangent") {
                                v.fromArray(values).transformDirection(
                                    object.matrixWorld
                                );
                                values.splice(0, 3, v.x, v.y, v.z);
                                if (values.length > 3 && mirrored)
                                    values[3] *= -1;
                            }
                            attributes[name] = values;
                        }
                        const vertex = { p, attributes };
                        vertexCache?.set(index, vertex);
                        return vertex;
                    };
                    const fragments = new Map<
                        string,
                        {
                            center: any;
                            size: number;
                            groups: Map<number, Vertex[]>;
                        }
                    >();
                    let produced = 0,
                        inputTriangles = 0,
                        newCells = 0;
                    const indexAt = (i: number) =>
                        geometry.index ? geometry.index.getX(i) : i;
                    const start = Math.max(0, geometry.drawRange?.start ?? 0),
                        end = Math.min(
                            total,
                            start + (geometry.drawRange?.count ?? total)
                        );
                    for (let offset = start; offset + 2 < end; offset += 3) {
                        const triangle = [
                            read(indexAt(offset)),
                            read(indexAt(offset + 1)),
                            read(indexAt(offset + 2)),
                        ];
                        if (mirrored) {
                            [triangle[1], triangle[2]] = [
                                triangle[2],
                                triangle[1],
                            ];
                        }
                        if (
                            !triangle.every((vertex) =>
                                vertex.p.every(Number.isFinite)
                            )
                        )
                            throw new Error("invalid geometry");
                        const materialGroup = geometry.groups?.find(
                            (g: any) =>
                                offset >= g.start && offset < g.start + g.count
                        );
                        if (Array.isArray(object.material) && !materialGroup)
                            continue;
                        const materialIndex = Array.isArray(object.material)
                            ? materialGroup?.materialIndex ?? 0
                            : 0;
                        const material = materials[materialIndex];
                        if (!material || material.visible === false) continue;
                        inputTriangles++;
                        if (instance?.color) {
                            for (const vertex of triangle) {
                                const source = instance.vertexColors[
                                    materialIndex
                                ]
                                    ? vertex.attributes.color
                                    : undefined;
                                vertex.attributes.color = instance.color.map(
                                    (value, axis) =>
                                        value * (source?.[axis] ?? 1)
                                );
                                if (schema.color === 4)
                                    vertex.attributes.color.push(
                                        source?.[3] ?? 1
                                    );
                            }
                        }
                        if (!schema.normal || !geometry.attributes.normal) {
                            const normal = new THREE.Vector3()
                                .fromArray(triangle[1].p)
                                .sub(
                                    new THREE.Vector3().fromArray(triangle[0].p)
                                )
                                .cross(
                                    new THREE.Vector3()
                                        .fromArray(triangle[2].p)
                                        .sub(
                                            new THREE.Vector3().fromArray(
                                                triangle[0].p
                                            )
                                        )
                                )
                                .normalize()
                                .toArray();
                            for (const vertex of triangle)
                                vertex.attributes.normal = normal;
                        }
                        const coords = [anchor.x, anchor.y, anchor.z];
                        const triangleMin = [Infinity, Infinity, Infinity];
                        const triangleMax = [-Infinity, -Infinity, -Infinity];
                        for (const vertex of triangle)
                            for (let axis = 0; axis < 3; axis++) {
                                triangleMin[axis] = Math.min(
                                    triangleMin[axis],
                                    vertex.p[axis]
                                );
                                triangleMax[axis] = Math.max(
                                    triangleMax[axis],
                                    vertex.p[axis]
                                );
                            }
                        let farthest = 0;
                        for (let axis = 0; axis < 3; axis++)
                            farthest = Math.max(
                                farthest,
                                Math.abs(triangleMin[axis] - coords[axis]),
                                Math.abs(triangleMax[axis] - coords[axis])
                            );
                        const detailExtent = shellCells * size;
                        const lastLevel =
                            fullCoverage && farthest >= detailExtent
                                ? Math.floor(
                                      Math.log2(farthest / detailExtent)
                                  ) + 1
                                : 0;
                        if (!Number.isFinite(lastLevel) || lastLevel > 52)
                            throw new Error("invalid cell bounds");
                        for (let level = 0; level <= lastLevel; level++) {
                            const gridSize = size * 2 ** level;
                            const min = coords.map((a, axis) =>
                                Math.floor((triangleMin[axis] - a) / gridSize)
                            );
                            const max = coords.map((a, axis) =>
                                Math.max(
                                    min[axis],
                                    Math.floor(
                                        (triangleMax[axis] - a - 1e-7) /
                                            gridSize
                                    )
                                )
                            );
                            if (fullCoverage || Number.isFinite(radius)) {
                                const first = fullCoverage
                                    ? -shellCells
                                    : Math.floor(-radius / gridSize);
                                const last = fullCoverage
                                    ? shellCells - 1
                                    : Math.ceil(radius / gridSize) - 1;
                                for (let axis = 0; axis < 3; axis++) {
                                    min[axis] = Math.max(min[axis], first);
                                    max[axis] = Math.min(max[axis], last);
                                }
                                if (
                                    min.some((value, axis) => value > max[axis])
                                )
                                    continue;
                            }
                            if (![...min, ...max].every(Number.isSafeInteger))
                                throw new Error("invalid cell bounds");
                            // Tighten the next axis after each clipped slab. A long,
                            // diagonal surface occupies far fewer cells than its 3D box.
                            const range = (polygon: Vertex[], axis: number) => {
                                let low = Infinity,
                                    high = -Infinity;
                                for (const vertex of polygon) {
                                    low = Math.min(low, vertex.p[axis]);
                                    high = Math.max(high, vertex.p[axis]);
                                }
                                const first = Math.max(
                                    min[axis],
                                    Math.floor(
                                        (low - coords[axis] - 1e-7) / gridSize
                                    )
                                );
                                const last = Math.min(
                                    max[axis],
                                    Math.max(
                                        first,
                                        Math.floor(
                                            (high - coords[axis] - 1e-7) /
                                                gridSize
                                        )
                                    )
                                );
                                return [first, last];
                            };
                            for (let x = min[0]; x <= max[0]; x++) {
                                const xPolygon = clipSlab(
                                    triangle,
                                    0,
                                    coords[0] + x * gridSize,
                                    gridSize
                                );
                                if (xPolygon.length < 3) continue;
                                const [yMin, yMax] = range(xPolygon, 1);
                                for (let y = yMin; y <= yMax; y++) {
                                    const xyPolygon = clipSlab(
                                        xPolygon,
                                        1,
                                        coords[1] + y * gridSize,
                                        gridSize
                                    );
                                    if (xyPolygon.length < 3) continue;
                                    const [zMin, zMax] = range(xyPolygon, 2);
                                    for (let z = zMin; z <= zMax; z++) {
                                        // Test cell bounds against the local sphere before clipping.
                                        // This is cell-granular, retaining complete physical squares.
                                        if (
                                            !fullCoverage &&
                                            Number.isFinite(radius)
                                        ) {
                                            const distanceSquared = [
                                                x,
                                                y,
                                                z,
                                            ].reduce((sum, n) => {
                                                const nearest =
                                                    n < 0
                                                        ? (n + 1) * gridSize
                                                        : n * gridSize;
                                                return sum + nearest * nearest;
                                            }, 0);
                                            if (
                                                distanceSquared >
                                                radius * radius
                                            )
                                                continue;
                                        }
                                        // The inner cube is owned by the finer shell. These
                                        // disjoint half-open cells leave no seams or overlap.
                                        if (
                                            level > 0 &&
                                            [x, y, z].every(
                                                (n) =>
                                                    n >= -shellCells / 2 &&
                                                    n < shellCells / 2
                                            )
                                        )
                                            continue;
                                        const xyz = [x, y, z],
                                            key = fullCoverage
                                                ? `${level}:${xyz.join(":")}`
                                                : xyz.join(":");
                                        const polygon = clipSlab(
                                            xyPolygon,
                                            2,
                                            coords[2] + z * gridSize,
                                            gridSize
                                        );
                                        if (polygon.length < 3) continue;
                                        const triangles: Vertex[] = [];
                                        for (
                                            let n = 1;
                                            n < polygon.length - 1;
                                            n++
                                        ) {
                                            const a = polygon[0].p,
                                                b = polygon[n].p,
                                                c = polygon[n + 1].p;
                                            const ux = b[0] - a[0],
                                                uy = b[1] - a[1],
                                                uz = b[2] - a[2];
                                            const vx = c[0] - a[0],
                                                vy = c[1] - a[1],
                                                vz = c[2] - a[2];
                                            if (
                                                Math.hypot(
                                                    uy * vz - uz * vy,
                                                    uz * vx - ux * vz,
                                                    ux * vy - uy * vx
                                                ) < 1e-10
                                            )
                                                continue;
                                            triangles.push(
                                                polygon[0],
                                                polygon[n],
                                                polygon[n + 1]
                                            );
                                        }
                                        if (!triangles.length) continue;
                                        if (!fragments.has(key)) {
                                            if (
                                                !cells.has(key) &&
                                                cells.size + newCells >=
                                                    maxCells
                                            )
                                                throw new Error("cell bound");
                                            if (!cells.has(key)) newCells++;
                                            fragments.set(key, {
                                                center: new THREE.Vector3(
                                                    anchor.x +
                                                        (x + 0.5) * gridSize,
                                                    anchor.y +
                                                        (y + 0.5) * gridSize,
                                                    anchor.z +
                                                        (z + 0.5) * gridSize
                                                ),
                                                size: gridSize,
                                                groups: new Map(),
                                            });
                                        }
                                        const fragment = fragments.get(key);
                                        if (!fragment.groups.has(materialIndex))
                                            fragment.groups.set(
                                                materialIndex,
                                                []
                                            );
                                        produced += triangles.length / 3;
                                        if (
                                            produced + stats.triangles >
                                            maxTriangles
                                        )
                                            throw new Error("triangle bound");
                                        fragment.groups
                                            .get(materialIndex)
                                            .push(...triangles);
                                    }
                                }
                            }
                        }
                    }
                    if (
                        stats.fragments + fragments.size >
                        (options.maxFragments ?? 20000)
                    )
                        throw new Error("fragment memory bound");
                    const needed = new Set<string>();
                    for (const fragment of fragments.values())
                        for (const index of fragment.groups.keys())
                            needed.add(batchKey(materials[index]));
                    if (
                        batches.size +
                            [...needed].filter((key) => !batches.has(key))
                                .length >
                        (options.maxBatches ?? 128)
                    )
                        throw new Error("material draw bound");
                    const nextAttributes = { ...attributeSizes };
                    for (const [name, count] of Object.entries(schema))
                        nextAttributes[name] = Math.max(
                            nextAttributes[name] ?? 0,
                            count
                        );
                    if (
                        Object.values(nextAttributes).reduce(
                            (sum, count) => sum + count,
                            0
                        ) > 64
                    )
                        throw new Error("attribute memory bound");
                    Object.assign(attributeSizes, nextAttributes);
                    // Commit only once every limit for this source mesh has passed.
                    for (const [key, fragment] of fragments) {
                        let cell = cells.get(key);
                        if (!cell) {
                            cell = {
                                center: fragment.center,
                                size: fragment.size,
                                delay: 0,
                                seed: 0,
                                spans: [],
                            };
                            cells.set(key, cell);
                        }
                        for (const [index, vertices] of fragment.groups) {
                            const material = materials[index],
                                materialKey = batchKey(material);
                            let batch = batches.get(materialKey);
                            if (!batch) {
                                batch = {
                                    material,
                                    schema,
                                    layers: object.layers.mask,
                                    renderOrder: object.renderOrder,
                                    receiveShadow: object.receiveShadow,
                                    pieces: [],
                                    sortSphere: material.transparent
                                        ? (
                                              geometry.boundingSphere?.clone() ??
                                              localBounds(
                                                  geometry
                                              ).getBoundingSphere(
                                                  new THREE.Sphere()
                                              )
                                          ).applyMatrix4(object.matrixWorld)
                                        : undefined,
                                };
                                batches.set(materialKey, batch);
                            }
                            batch.pieces.push({
                                cell,
                                cellKey: key,
                                source: object.name || object.uuid,
                                sourceId: object.uuid,
                                vertices,
                            });
                        }
                    }
                    stats.fragments += fragments.size;
                    stats.triangles += produced;
                    stats.sourceTriangles += inputTriangles;
                    if (produced)
                        preparedSources.add(instance?.owner ?? object);
                    if (instance && fragments.size) {
                        stats.instances++;
                        try {
                            options.onInstance?.(
                                instance.owner,
                                instance.index
                            );
                        } catch {
                            // An observer cannot change a committed source.
                        }
                    }
                    hide(object);
                } catch (error) {
                    skip(
                        object,
                        error instanceof Error
                            ? error.message
                            : "invalid-geometry"
                    );
                }
            }
        }
    };
    for (const root of roots) {
        let parent = root?.parent,
            hidden = false;
        while (parent) {
            hidden ||=
                parent.visible === false ||
                parent.userData?.worldTravelBackground === true;
            parent = parent.parent;
        }
        if (!hidden) collect(root);
    }
    // Cache validity is proportional to source/attribute counts, never to their
    // vertex counts. BufferAttribute versions cover uploads; identities also catch
    // LOD replacements. Texture slots are deliberately omitted and refreshed below.
    const attributeState = (attribute: any) =>
        attribute
            ? [
                  attribute,
                  attribute.array,
                  attribute.count,
                  attribute.itemSize,
                  attribute.normalized,
                  attribute.version,
                  attribute.data,
                  attribute.data?.array,
                  attribute.data?.version,
              ]
            : [attribute];
    const sourceState = (object: any): any[] => {
        const geometry = object.geometry;
        const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
        const state = [
            object.parent,
            object.visible,
            geometry,
            object.material,
            object.layers?.mask,
            object.renderOrder,
            object.receiveShadow,
            object.castShadow,
            object.count,
            ...(object.matrixWorld?.elements ?? []),
            ...attributeState(object.instanceMatrix),
            ...attributeState(object.instanceColor),
            geometry?.drawRange?.start,
            geometry?.drawRange?.count,
            ...attributeState(geometry?.index),
        ];
        for (const name of Object.keys(geometry?.attributes ?? {}).sort())
            state.push(name, ...attributeState(geometry.attributes[name]));
        for (const group of geometry?.groups ?? [])
            state.push(group.start, group.count, group.materialIndex);
        for (const material of materials)
            state.push(
                material,
                material?.side,
                material?.transparent,
                material?.vertexColors,
                material?.visible
            );
        return state;
    };
    const sameState = (left: any[], right: any[]) =>
        left.length === right.length &&
        left.every((value, index) => Object.is(value, right[index]));
    const sourceStates = new Map(
        candidates.map((object) => [object, sourceState(object)])
    );
    const sourceRoots = roots.map((root) => ({ root, parent: root?.parent }));
    const sceneMatrix = [...scene.matrixWorld.elements];
    const scanSources = (includeHidden = false) => {
        const found = new Set<any>(),
            seen = new Set<any>();
        const scan = (object: any) => {
            if (!object || seen.has(object) || object === container) return;
            seen.add(object);
            if (
                options.exclude?.(object) ||
                object.userData?.worldRevealExclude === true ||
                object.userData?.worldTravelBackground === true ||
                (!includeHidden && object.visible === false)
            )
                return;
            if (object.isMesh) found.add(object);
            for (const child of object.children ?? []) scan(child);
        };
        for (const { root } of sourceRoots) {
            let parent = root?.parent,
                excluded = false;
            while (parent) {
                excluded ||=
                    options.exclude?.(parent) ||
                    parent.userData?.worldRevealExclude === true ||
                    parent.userData?.worldTravelBackground === true ||
                    (!includeHidden && parent.visible === false);
                parent = parent.parent;
            }
            if (!excluded) scan(root);
        }
        return found;
    };
    const addedSources = () =>
        [...scanSources()].filter(
            (object) =>
                !preparedSources.has(object) &&
                (!sourceStates.has(object) ||
                    !sameState(sourceStates.get(object), sourceState(object)))
        );
    // Expand standard glTF GPU instances into bounded virtual sources. Their
    // source geometry/materials remain owned by the original InstancedMesh.
    let instanceReads = 0;
    const maxInstances = Number.isFinite(options.maxInstances)
        ? Math.max(0, Math.floor(options.maxInstances))
        : 4096;
    for (const object of candidates.splice(0)) {
        const geometry = object.geometry;
        const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
        if (
            !object.isInstancedMesh ||
            geometry?.isInstancedBufferGeometry ||
            object.isSkinnedMesh ||
            Object.keys(geometry?.morphAttributes ?? {}).length ||
            materials.some(
                (m: any) =>
                    !m ||
                    isWorldRevealShaderMaterial(m) ||
                    m.constructor?.name === "BillboardYMaterial"
            )
        ) {
            candidates.push(object);
            continue;
        }
        try {
            const count = object.count;
            if (
                !Number.isSafeInteger(count) ||
                count < 0 ||
                !Number.isSafeInteger(object.instanceMatrix?.count) ||
                object.instanceMatrix.itemSize !== 16 ||
                count > object.instanceMatrix.count ||
                typeof object.getMatrixAt !== "function"
            )
                throw new Error("invalid instance matrices");
            if (instanceReads + count > maxInstances)
                throw new Error("instance work bound");
            instanceReads += count;
            const colorAttribute = object.instanceColor;
            if (
                colorAttribute &&
                (colorAttribute.itemSize !== 3 || colorAttribute.count < count)
            )
                throw new Error("invalid instance colors");
            const expanded: any[] = [];
            for (let index = 0; index < count; index++) {
                const matrix = new THREE.Matrix4();
                object.getMatrixAt(index, matrix);
                matrix.premultiply(object.matrixWorld);
                if (!matrix.elements.every(Number.isFinite))
                    throw new Error("invalid instance matrix");
                const color = colorAttribute
                    ? [
                          colorAttribute.getX(index),
                          colorAttribute.getY(index),
                          colorAttribute.getZ(index),
                      ]
                    : undefined;
                if (color && !color.every(Number.isFinite))
                    throw new Error("invalid instance color");
                const virtualMaterials = color
                    ? materials.map((source: any) => {
                          if (!colorMaterials.has(source)) {
                              const material = cloneWorldRevealMaterial(source);
                              material.vertexColors = true;
                              colorMaterials.set(source, material);
                              materialClones.push({
                                  source,
                                  clone: material,
                                  vertexColors: true,
                              });
                          }
                          return colorMaterials.get(source);
                      })
                    : materials;
                const virtual = {
                    isMesh: true,
                    visible: true,
                    geometry,
                    material: Array.isArray(object.material)
                        ? virtualMaterials
                        : virtualMaterials[0],
                    matrixWorld: matrix,
                    name: `${object.name || object.uuid}[${index}]`,
                    uuid: `${object.uuid}:${index}`,
                    layers: object.layers,
                    renderOrder: object.renderOrder,
                    receiveShadow: object.receiveShadow,
                };
                expanded.push(virtual);
                instanceSources.set(virtual, {
                    owner: object,
                    index,
                    color,
                    vertexColors: materials.map(
                        (material: any) => material.vertexColors === true
                    ),
                });
            }
            candidates.push(...expanded);
            hide(object);
        } catch (error) {
            skip(
                object,
                error instanceof Error ? error.message : "invalid instances"
            );
        }
    }
    if (Number.isFinite(radius)) {
        const ordered = candidates.map((object) => {
            const bounds = localBounds(object.geometry)
                .clone()
                .applyMatrix4(object.matrixWorld);
            const extent = bounds.getSize(new THREE.Vector3());
            return {
                object,
                distance: bounds.distanceToPoint(anchorVector),
                footprint: (extent.x * extent.z) / Math.max(size, extent.y),
            };
        });
        ordered.sort(
            (a, b) => a.distance - b.distance || b.footprint - a.footprint
        );
        for (const entry of ordered) {
            visit(entry.object);
            yield;
        }
    } else
        for (const object of candidates) {
            visit(object);
            yield;
        }
    stats.baseTriangles = stats.triangles;
    stats.baseClipTests = clipTests;
    // Retain a complete coarse partition first. Refinement is transactional per
    // shared world cell, so running out of detail budget never drops a mesh or
    // leaves different materials on one surface using incompatible tile pivots.
    if (options.refinement && cells.size) {
        const minSize = Number.isFinite(options.refinement.minCellSize)
            ? Math.max(0.125, Math.min(size, options.refinement.minCellSize))
            : size;
        const maxSize = Number.isFinite(options.refinement.maxCellSize)
            ? Math.max(minSize, options.refinement.maxCellSize)
            : Infinity;
        const detailRadius = Number.isFinite(options.refinement.detailRadius)
            ? Math.max(minSize, options.refinement.detailRadius)
            : 8;
        type Piece = Batch["pieces"][number];
        type OwnedPiece = { batch: Batch; piece: Piece };
        const piecesByCell = new Map<string, OwnedPiece[]>();
        for (const batch of batches.values())
            for (const piece of batch.pieces) {
                if (!piecesByCell.has(piece.cellKey))
                    piecesByCell.set(piece.cellKey, []);
                piecesByCell.get(piece.cellKey).push({ batch, piece });
            }
        const rejected = new Set<string>();
        const limitCounts: Record<string, number> = {};
        const recordRefinementLimit = (reason: string, decisive = false) => {
            stats.refinementLimited = 1;
            limitCounts[reason] = (limitCounts[reason] ?? 0) + 1;
            if (
                decisive ||
                limitCounts[reason] > (limitCounts[stats.refinementLimit] ?? 0)
            )
                stats.refinementLimit = reason;
        };
        const priority = (cell: Cell) => {
            const distance = cell.center.distanceTo(focus ?? anchorVector);
            const desired = Math.min(
                maxSize,
                minSize *
                    2 **
                        Math.max(
                            0,
                            Math.floor(
                                Math.log2(Math.max(1, distance / detailRadius))
                            )
                        )
            );
            return {
                ratio: cell.size / desired,
                apparent: cell.size / Math.max(detailRadius, distance),
            };
        };
        const appendTriangle = (output: Vertex[], polygon: Vertex[]) => {
            for (let index = 1; index < polygon.length - 1; index++) {
                const a = polygon[0].p,
                    b = polygon[index].p,
                    c = polygon[index + 1].p;
                const ux = b[0] - a[0],
                    uy = b[1] - a[1],
                    uz = b[2] - a[2];
                const vx = c[0] - a[0],
                    vy = c[1] - a[1],
                    vz = c[2] - a[2];
                if (
                    Math.hypot(
                        uy * vz - uz * vy,
                        uz * vx - ux * vz,
                        ux * vy - uy * vx
                    ) >= 1e-10
                )
                    output.push(polygon[0], polygon[index], polygon[index + 1]);
            }
        };
        const finitePoint = (point?: RevealPoint) =>
            point && [point.x, point.y, point.z].every(Number.isFinite);
        const focus = finitePoint(options.refinement.focus)
            ? new THREE.Vector3().copy(options.refinement.focus)
            : undefined;
        const forward =
            focus && finitePoint(options.refinement.forward)
                ? new THREE.Vector3().copy(options.refinement.forward)
                : undefined;
        if (forward?.lengthSq() > 1e-10) forward.normalize();
        const hasForward = forward?.lengthSq() > 1e-10;
        if (focus)
            measureView = (cell: Cell) => {
                const dx = cell.center.x - focus.x,
                    dy = cell.center.y - focus.y,
                    dz = cell.center.z - focus.z;
                const distance = Math.hypot(dx, dy, dz);
                const apparent = cell.size / Math.max(0.5, distance);
                // The cell sphere conservatively includes surfaces crossing the
                // view edge or surrounding the camera. This changes priority only;
                // it never culls geometry or prevents later offscreen refinement.
                const visibility = hasForward
                    ? 0.04 +
                      0.96 *
                          clamp(
                              ((dx * forward.x +
                                  dy * forward.y +
                                  dz * forward.z +
                                  (cell.size * Math.sqrt(3)) / 2) /
                                  Math.max(0.5, distance) -
                                  0.1) /
                                  0.4
                          )
                    : 1;
                return { apparent, visibility };
            };
        type Candidate = {
            key: string;
            cell: Cell;
            depth: number;
            apparent: number;
            ratio: number;
            order: number;
        };
        function* refinementCandidates() {
            if (!focus) {
                // Preserve the original distance policy for callers without a view.
                for (let pass = 0; pass < 6; pass++) {
                    const previous = stats.refinedCells;
                    const pending = [...cells]
                        .map(([key, cell]) => ({
                            key,
                            cell,
                            ...priority(cell),
                        }))
                        .filter(
                            ({ key, ratio }) =>
                                ratio > 1.01 && !rejected.has(key)
                        )
                        .sort(
                            (a, b) =>
                                b.ratio - a.ratio || b.apparent - a.apparent
                        );
                    for (const entry of pending) yield entry;
                    if (stats.refinedCells === previous) return;
                }
                return;
            }
            // A heap lets newly split nearby children compete immediately. A broad
            // pass over the whole room can otherwise spend the ceiling before any
            // visible wall reaches the fine grid. At most one entry per live cell.
            const heap: Candidate[] = [];
            let order = 0;
            const before = (a: Candidate, b: Candidate) =>
                a.apparent > b.apparent ||
                (a.apparent === b.apparent &&
                    (a.ratio > b.ratio ||
                        (a.ratio === b.ratio && a.order < b.order)));
            const push = (key: string, cell: Cell, depth: number) => {
                const { ratio } = priority(cell);
                if (depth >= 6 || ratio <= 1.01 || rejected.has(key)) return;
                const { apparent, visibility } = measureView(cell);
                const entry = {
                    key,
                    cell,
                    depth,
                    apparent: apparent * visibility,
                    ratio,
                    order: order++,
                };
                let index = heap.length;
                heap.push(entry);
                while (index > 0) {
                    const parent = (index - 1) >> 1;
                    if (!before(entry, heap[parent])) break;
                    heap[index] = heap[parent];
                    index = parent;
                }
                heap[index] = entry;
            };
            const pop = () => {
                const entry = heap[0],
                    last = heap.pop();
                if (heap.length) {
                    let index = 0;
                    while (index * 2 + 1 < heap.length) {
                        let child = index * 2 + 1;
                        if (
                            child + 1 < heap.length &&
                            before(heap[child + 1], heap[child])
                        )
                            child++;
                        if (!before(heap[child], last)) break;
                        heap[index] = heap[child];
                        index = child;
                    }
                    heap[index] = last;
                }
                return entry;
            };
            for (const [key, cell] of cells) push(key, cell, 0);
            while (heap.length) {
                const entry = pop();
                yield entry;
                if (!cells.has(entry.key))
                    for (let index = 0; index < 8; index++) {
                        const key = `${entry.key}/${index}`;
                        const child = cells.get(key);
                        if (child) push(key, child, entry.depth + 1);
                    }
            }
        }
        // At most six half-size refinements, under the same global clipping,
        // triangle, cell and fragment limits as the initial partition.
        for (const { key, cell } of refinementCandidates()) {
            yield;
            // No detail budget remains: keep the complete current partition
            // instead of clipping every remaining cell only to reject it.
            if (
                stats.triangles >= maxTriangles ||
                clipTests >= (options.maxClipTests ?? 250000)
            ) {
                recordRefinementLimit(
                    stats.triangles >= maxTriangles ? "triangles" : "clipping",
                    true
                );
                break;
            }
            stats.refinementAttempts++;
            const owned = piecesByCell.get(key);
            const previousTriangles = owned.reduce(
                (sum, { piece }) => sum + piece.vertices.length / 3,
                0
            );
            const childSize = cell.size / 2;
            const center = [cell.center.x, cell.center.y, cell.center.z];
            const children = new Map<number, Cell>();
            const additions: OwnedPiece[] = [];
            let triangles = 0;
            try {
                for (const { batch, piece } of owned) {
                    const pieces = new Map<number, Vertex[]>();
                    const divide = (
                        polygon: Vertex[],
                        axis: number,
                        child: number
                    ) => {
                        if (polygon.length < 3) return;
                        if (axis === 3) {
                            if (!pieces.has(child)) pieces.set(child, []);
                            appendTriangle(pieces.get(child), polygon);
                            return;
                        }
                        const min = Math.min(
                            ...polygon.map((vertex) => vertex.p[axis])
                        );
                        const max = Math.max(
                            ...polygon.map((vertex) => vertex.p[axis])
                        );
                        // Coplanar surfaces belong to just one half. Most small
                        // source triangles need no clipping or new vertices.
                        if (min >= center[axis] - 1e-7) {
                            divide(polygon, axis + 1, child | (1 << axis));
                        } else if (max <= center[axis] + 1e-7) {
                            divide(polygon, axis + 1, child);
                        } else {
                            if (++clipTests > (options.maxClipTests ?? 250000))
                                throw new Error("refinement clipping bound");
                            divide(
                                clip(polygon, axis, center[axis], false),
                                axis + 1,
                                child
                            );
                            divide(
                                clip(polygon, axis, center[axis], true),
                                axis + 1,
                                child | (1 << axis)
                            );
                        }
                    };
                    for (
                        let index = 0;
                        index < piece.vertices.length;
                        index += 3
                    )
                        divide(piece.vertices.slice(index, index + 3), 0, 0);
                    for (const [child, vertices] of pieces) {
                        if (!vertices.length) continue;
                        triangles += vertices.length / 3;
                        if (
                            stats.triangles - previousTriangles + triangles >
                            maxTriangles
                        )
                            throw new Error("refinement triangle bound");
                        let childCell = children.get(child);
                        if (!childCell) {
                            childCell = {
                                center: new THREE.Vector3(
                                    ...center.map(
                                        (value, axis) =>
                                            value +
                                            ((child & (1 << axis) ? 1 : -1) *
                                                childSize) /
                                                2
                                    )
                                ),
                                size: childSize,
                                delay: 0,
                                seed: 0,
                                spans: [],
                            };
                            children.set(child, childCell);
                        }
                        additions.push({
                            batch,
                            piece: {
                                cell: childCell,
                                cellKey: `${key}/${child}`,
                                source: piece.source,
                                sourceId: piece.sourceId,
                                vertices,
                            },
                        });
                    }
                }
                if (cells.size - 1 + children.size > maxCells)
                    throw new Error("refinement cell bound");
                // Count source-cell fragments rather than material pieces:
                // two materials of one source can fall in different children.
                const fragmentGrowth =
                    new Set(
                        additions.map(
                            ({ piece }) => `${piece.cellKey}|${piece.sourceId}`
                        )
                    ).size -
                    new Set(owned.map(({ piece }) => piece.sourceId)).size;
                if (
                    stats.fragments + fragmentGrowth >
                    (options.maxFragments ?? 20000)
                )
                    throw new Error("refinement fragment bound");
                cells.delete(key);
                piecesByCell.delete(key);
                for (const { piece } of owned) piece.vertices = [];
                for (const [child, childCell] of children)
                    cells.set(`${key}/${child}`, childCell);
                for (const addition of additions) {
                    addition.batch.pieces.push(addition.piece);
                    const childKey = addition.piece.cellKey;
                    if (!piecesByCell.has(childKey))
                        piecesByCell.set(childKey, []);
                    piecesByCell.get(childKey).push(addition);
                }
                stats.triangles += triangles - previousTriangles;
                stats.fragments += fragmentGrowth;
                stats.refinedCells++;
            } catch (error) {
                rejected.add(key);
                const message = error instanceof Error ? error.message : "";
                recordRefinementLimit(
                    {
                        "refinement triangle bound": "triangles",
                        "refinement cell bound": "cells",
                        "refinement fragment bound": "fragments",
                        "refinement clipping bound": "clipping",
                    }[message] ?? "invalid"
                );
            }
        }
        for (const batch of batches.values())
            batch.pieces = batch.pieces.filter(
                (piece) => piece.vertices.length
            );
    }
    stats.clipTests = clipTests;
    stats.refinementClipTests = clipTests - stats.baseClipTests;
    // Rigid sources join the same spatial wave only after cut cells finish
    // refinement. They neither consume copied buffers nor enter the split queue.
    const motionCells = new Map([...cells, ...rigidCells]);
    /** Per cell: its nearest possible point to the anchor, and the progress
     * at which it has finished assembling. */
    let assembly: { reach: number; done: number }[] = [];
    const configureRevealAnchor = (
        nextAnchor: RevealPoint,
        nextWaveExtent?: number
    ) => {
        const fixedAnchor = snapshotRevealAnchor(nextAnchor);
        if (Number.isFinite(nextWaveExtent) && nextWaveExtent > 0)
            waveExtent = nextWaveExtent;
        const schedule = buildRadialCellSchedule(
            [...motionCells].map(([key, cell]) => ({
                key,
                center: cell.center,
            })),
            fixedAnchor,
            {
                radius: Number.isFinite(radius) ? radius : undefined,
                fullRange: fullCoverage,
                direction,
                extent: waveExtent,
            }
        );
        container.userData.worldRevealSchedule = schedule.map((step) => ({
            ...step,
            delay: step.fraction * WORLD_TILE_MAX_DELAY,
            span: WORLD_TILE_SPAN,
        }));
        stats.maxDistance = 0;
        assembly = [];
        for (const step of schedule) {
            stats.maxDistance = Math.max(stats.maxDistance, step.distance);
            const cell = motionCells.get(step.key);
            cell.seed = step.seed;
            cell.delay = step.fraction * WORLD_TILE_MAX_DELAY;
            // A cube's corner is at most sqrt(3)/2 of its size from its centre.
            assembly.push({
                reach: step.distance - cell.size * 0.87,
                done: Math.min(1, cell.delay + WORLD_TILE_SPAN),
            });
            cell.motion = {
                center: cell.center,
                anchor: fixedAnchor,
                mode,
                delay: cell.delay,
                cellSize: cell.size,
                seed: cell.seed,
                surfaceNormal: cell.surfaceNormal,
            };
            // Hidden and settled buffers do not depend on the wave anchor.
            // Keeping their state avoids rewriting intact geometry on reuse.
        }
    };
    // The lattice decides which fragments move together, but its empty volume
    // is not a useful hinge for thin walls. Turn around the actual fragment
    // bounds so a wall a few centimetres from a cell edge stays anchored.
    const surfaceBounds = new Map<Cell, any>();
    const surfacePoint = new THREE.Vector3();
    for (const batch of batches.values()) {
        yield;
        for (const piece of batch.pieces) {
            const cell = piece.cell;
            if (!surfaceBounds.has(cell))
                surfaceBounds.set(cell, new THREE.Box3());
            const bounds = surfaceBounds.get(cell);
            const normal = (cell.surfaceNormal ??= { x: 0, y: 0, z: 0 });
            for (let i = 0; i < piece.vertices.length; i += 3) {
                const a = piece.vertices[i].p,
                    b = piece.vertices[i + 1].p,
                    c = piece.vertices[i + 2].p;
                bounds.expandByPoint(surfacePoint.fromArray(a));
                bounds.expandByPoint(surfacePoint.fromArray(b));
                bounds.expandByPoint(surfacePoint.fromArray(c));
                const ux = b[0] - a[0],
                    uy = b[1] - a[1],
                    uz = b[2] - a[2];
                const vx = c[0] - a[0],
                    vy = c[1] - a[1],
                    vz = c[2] - a[2];
                normal.x += Math.abs(uy * vz - uz * vy);
                normal.y += Math.abs(uz * vx - ux * vz);
                normal.z += Math.abs(ux * vy - uy * vx);
            }
        }
    }
    for (const [cell, bounds] of surfaceBounds)
        cell.pivot = bounds.getCenter(new THREE.Vector3());
    surfaceBounds.clear();
    configureRevealAnchor(anchor);
    stats.cells = cells.size;
    stats.levels = new Set([...cells.values()].map((cell) => cell.size)).size;
    for (const cell of cells.values()) {
        stats.maxCellSize = Math.max(stats.maxCellSize, cell.size);
        stats.minCellSize = stats.minCellSize
            ? Math.min(stats.minCellSize, cell.size)
            : cell.size;
        if (measureView?.(cell).visibility >= 0.5) {
            stats.viewCells++;
            const key = String(cell.size);
            stats.viewCellSizeCounts[key] =
                (stats.viewCellSizeCounts[key] ?? 0) + 1;
        }
    }
    stats.batches = batches.size;
    stats.vertices = stats.triangles * 3;
    // All draw batches share dynamic position/normal buffers. Every original
    // material keeps its own attribute schema and a single contiguous draw range.
    const base: Record<string, Float32Array> = {};
    for (const [name, count] of Object.entries(attributeSizes))
        base[name] = new Float32Array(stats.vertices * count);
    const positions = new THREE.BufferAttribute(
        new Float32Array(stats.vertices * 3),
        3
    );
    const normals = new THREE.BufferAttribute(
        new Float32Array(stats.vertices * 3),
        3
    );
    positions.setUsage(THREE.DynamicDrawUsage);
    normals.setUsage(THREE.DynamicDrawUsage);
    const tangents = attributeSizes.tangent
        ? new THREE.BufferAttribute(
              new Float32Array(stats.vertices * attributeSizes.tangent),
              attributeSizes.tangent
          )
        : null;
    tangents?.setUsage(THREE.DynamicDrawUsage);
    const glowColors = new THREE.BufferAttribute(
        new Float32Array(stats.vertices * 3),
        3
    );
    glowColors.setUsage(THREE.DynamicDrawUsage);
    const glowUV = new Float32Array(stats.vertices * 2);
    const auxiliary = new Map<
        string,
        {
            glow: number[];
            backs: Map<number, number[]>;
            layers: number;
            renderOrder: number;
        }
    >();
    const frontRecords: Array<{
        batch: Batch;
        start: number;
        count: number;
        spans: Span[];
    }> = [];
    let cursor = 0;
    for (const batch of batches.values()) {
        yield;
        const start = cursor,
            spans: Span[] = [];
        const auxKey = `${batch.layers}|${batch.renderOrder}`;
        if (!auxiliary.has(auxKey))
            auxiliary.set(auxKey, {
                glow: [],
                backs: new Map(),
                layers: batch.layers,
                renderOrder: batch.renderOrder,
            });
        const aux = auxiliary.get(auxKey);
        // A synthetic backing only fills an unauthored side. Double-sided
        // walls already have a visible reverse face (often the room interior);
        // covering it with a dark tile causes a pop when originals return.
        let backIndices: number[] | undefined;
        if (batch.material.side !== THREE.DoubleSide) {
            const backSide =
                batch.material.side === THREE.BackSide
                    ? THREE.FrontSide
                    : THREE.BackSide;
            if (!aux.backs.has(backSide)) aux.backs.set(backSide, []);
            backIndices = aux.backs.get(backSide);
        }
        for (const piece of batch.pieces) {
            const span = {
                start: cursor,
                count: piece.vertices.length,
                cellKey: piece.cellKey,
                source: piece.source,
            };
            piece.cell.spans.push(span);
            spans.push(span);
            const center = piece.cell.center;
            for (let n = 0; n < piece.vertices.length; n++) {
                const vertex = piece.vertices[n];
                base.position.set(vertex.p, cursor * 3);
                for (const [name, count] of Object.entries(attributeSizes)) {
                    if (name === "position") continue;
                    const values = vertex.attributes[name];
                    for (let i = 0; i < count; i++)
                        base[name][cursor * count + i] =
                            values?.[i] ??
                            (name === "color" || (name === "tangent" && i === 3)
                                ? 1
                                : 0);
                }
                // Map the cut cell to a soft edge texture using the triangle's
                // dominant surface plane; never borrow an artwork's texture UVs.
                const tri = Math.floor(n / 3) * 3;
                const pa = piece.vertices[tri].p,
                    pb = piece.vertices[tri + 1].p,
                    pc = piece.vertices[tri + 2].p;
                const ux = pb[0] - pa[0],
                    uy = pb[1] - pa[1],
                    uz = pb[2] - pa[2],
                    vx = pc[0] - pa[0],
                    vy = pc[1] - pa[1],
                    vz = pc[2] - pa[2];
                const abs = [
                    Math.abs(uy * vz - uz * vy),
                    Math.abs(uz * vx - ux * vz),
                    Math.abs(ux * vy - uy * vx),
                ];
                const axis =
                    abs[0] > abs[1] && abs[0] > abs[2]
                        ? 0
                        : abs[1] > abs[2]
                        ? 1
                        : 2;
                const axes = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1];
                const centers = [center.x, center.y, center.z];
                glowUV[cursor * 2] =
                    (vertex.p[axes[0]] - centers[axes[0]]) / piece.cell.size +
                    0.5;
                glowUV[cursor * 2 + 1] =
                    (vertex.p[axes[1]] - centers[axes[1]]) / piece.cell.size +
                    0.5;
                aux.glow.push(cursor);
                backIndices?.push(cursor);
                cursor++;
            }
        }
        frontRecords.push({ batch, start, count: cursor - start, spans });
        batch.pieces.length = 0;
    }
    const fixed = new Map<string, any>();
    for (const [name, values] of Object.entries(base))
        if (!["position", "normal", "tangent"].includes(name))
            fixed.set(
                name,
                new THREE.BufferAttribute(values, attributeSizes[name])
            );
    for (const { batch, start, count, spans } of frontRecords) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", positions);
        geometry.setAttribute("normal", normals);
        for (const name of Object.keys(batch.schema)) {
            if (name === "tangent") geometry.setAttribute(name, tangents);
            else if (fixed.has(name))
                geometry.setAttribute(name, fixed.get(name));
        }
        geometry.setDrawRange(start, count);
        geometry.userData.worldRevealRanges = spans;
        const bounds = new THREE.Box3();
        const point = new THREE.Vector3();
        for (let i = start; i < start + count; i++)
            bounds.expandByPoint(point.fromArray(base.position, i * 3));
        geometry.boundingSphere =
            batch.sortSphere?.clone() ??
            bounds.getBoundingSphere(new THREE.Sphere());
        geometry.boundingSphere.radius += size * 2;
        const mesh = new THREE.Mesh(geometry, tileMaterial(batch.material));
        mesh.name = `world-batch:${stats.drawCalls++}`;
        mesh.userData.worldRevealSources = [
            ...new Set(spans.map((span) => span.source)),
        ];
        mesh.layers.mask = batch.layers;
        mesh.renderOrder = batch.renderOrder;
        mesh.receiveShadow = batch.receiveShadow;
        mesh.frustumCulled = false;
        container.add(mesh);
        geometries.push(geometry);
    }
    const glow = createWorldTileGlowMaterial(THREE);
    const tileUV = new THREE.BufferAttribute(glowUV, 2);
    const backMaterials = new Map<
        number,
        ReturnType<typeof createWorldTileBackMaterial>
    >();
    for (const aux of auxiliary.values()) {
        if (aux.glow.length) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", positions);
            geometry.setAttribute("color", glowColors);
            geometry.setAttribute("uv", tileUV);
            geometry.setIndex(aux.glow);
            const mesh = new THREE.Mesh(geometry, glow.material);
            mesh.name = "world-tile-glow";
            mesh.layers.mask = aux.layers;
            mesh.renderOrder = aux.renderOrder + 1;
            mesh.frustumCulled = false;
            container.add(mesh);
            geometries.push(geometry);
        }
        for (const [side, indices] of aux.backs) {
            if (!indices.length) continue;
            if (!backMaterials.has(side))
                backMaterials.set(
                    side,
                    createWorldTileBackMaterial(THREE, side)
                );
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", positions);
            geometry.setAttribute("uv", tileUV);
            geometry.setIndex(indices);
            const mesh = new THREE.Mesh(
                geometry,
                backMaterials.get(side).material
            );
            mesh.name = "world-tile-back";
            stats.backDrawCalls++;
            mesh.layers.mask = aux.layers;
            mesh.renderOrder = aux.renderOrder;
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            container.add(mesh);
            geometries.push(geometry);
        }
    }
    stats.drawCalls =
        container.children.length +
        [...rigidRecords.values()].reduce(
            (sum, record) => sum + record.drawCalls - 1,
            0
        );
    const rigidTransform = new THREE.Matrix4();
    const rotation = new THREE.Matrix4(),
        quaternion = new THREE.Quaternion(),
        euler = new THREE.Euler();
    let previousProgress = -1;
    const setProgress = (value: number) => {
        if (disposed || parked) return;
        progress = clamp(value);
        if (progress === previousProgress) return;
        previousProgress = progress;
        const intact = mode === "dissolve" ? progress === 0 : progress === 1;
        scene.background = intact ? background : black;
        scene.fog = intact ? fog : null;
        for (const [object, visible] of originals)
            object.visible = intact ? visible : false;
        container.visible =
            mode === "dissolve" ? progress > 0 && progress < 1 : progress < 1;
        let changed = false;
        for (const cell of motionCells.values()) {
            const sample = sampleWorldCell(progress, cell.motion, cell.sample);
            cell.sample = sample;
            const identity =
                sample.visible &&
                sample.scale === 1 &&
                sample.glow === 0 &&
                sample.rotation.x === 0 &&
                sample.rotation.y === 0 &&
                sample.rotation.z === 0 &&
                sample.offset.x === 0 &&
                sample.offset.y === 0 &&
                sample.offset.z === 0;
            const unchanged = !sample.visible
                ? "hidden"
                : identity
                ? "settled"
                : "";
            if (unchanged && unchanged === cell.unchanged) continue;
            cell.unchanged = unchanged;
            const rigid = rigidRecords.get(cell);
            if (!rigid) changed = true;
            euler.set(sample.rotation.x, sample.rotation.y, sample.rotation.z);
            quaternion.setFromEuler(euler);
            rotation.makeRotationFromQuaternion(quaternion);
            const m = rotation.elements,
                scale = sample.visible ? sample.scale : 0;
            const pivot = cell.pivot ?? cell.center;
            const cx = pivot.x,
                cy = pivot.y,
                cz = pivot.z;
            if (rigid) {
                // Solid props cannot disappear edge-on like flat tiles. Shrink
                // with their existing quarter-turn so the final hidden frame has
                // no remaining volume to pop away; materials stay opaque.
                const rigidScale =
                    scale *
                    (mode === "dissolve"
                        ? Math.max(
                              0,
                              Math.cos(
                                  Math.max(
                                      Math.abs(sample.rotation.x),
                                      Math.abs(sample.rotation.y),
                                      Math.abs(sample.rotation.z)
                                  )
                              )
                          )
                        : 1);
                rigid.proxy.visible = sample.visible && rigidScale > 1e-7;
                if (identity) rigid.proxy.matrix.copy(rigid.matrix);
                else {
                    rigidTransform.copy(rotation);
                    const elements = rigidTransform.elements;
                    for (let column = 0; column < 3; column++) {
                        const start = column * 4;
                        elements[start] *= rigidScale;
                        elements[start + 1] *= rigidScale;
                        elements[start + 2] *= rigidScale;
                    }
                    elements[12] =
                        cx +
                        sample.offset.x -
                        rigidScale * (m[0] * cx + m[4] * cy + m[8] * cz);
                    elements[13] =
                        cy +
                        sample.offset.y -
                        rigidScale * (m[1] * cx + m[5] * cy + m[9] * cz);
                    elements[14] =
                        cz +
                        sample.offset.z -
                        rigidScale * (m[2] * cx + m[6] * cy + m[10] * cz);
                    rigid.proxy.matrix.multiplyMatrices(
                        rigidTransform,
                        rigid.matrix
                    );
                }
                rigid.proxy.matrixWorldNeedsUpdate = true;
            }
            for (const span of cell.spans)
                for (let i = span.start; i < span.start + span.count; i++) {
                    const j = i * 3,
                        x = (base.position[j] - cx) * scale,
                        y = (base.position[j + 1] - cy) * scale,
                        z = (base.position[j + 2] - cz) * scale;
                    positions.array[j] =
                        cx + sample.offset.x + m[0] * x + m[4] * y + m[8] * z;
                    positions.array[j + 1] =
                        cy + sample.offset.y + m[1] * x + m[5] * y + m[9] * z;
                    positions.array[j + 2] =
                        cz + sample.offset.z + m[2] * x + m[6] * y + m[10] * z;
                    const nx = base.normal[j],
                        ny = base.normal[j + 1],
                        nz = base.normal[j + 2];
                    normals.array[j] = m[0] * nx + m[4] * ny + m[8] * nz;
                    normals.array[j + 1] = m[1] * nx + m[5] * ny + m[9] * nz;
                    normals.array[j + 2] = m[2] * nx + m[6] * ny + m[10] * nz;
                    glowColors.array[j] =
                        glowColors.array[j + 1] =
                        glowColors.array[j + 2] =
                            sample.glow;
                    if (tangents) {
                        const k = i * attributeSizes.tangent,
                            tx = base.tangent[k],
                            ty = base.tangent[k + 1],
                            tz = base.tangent[k + 2];
                        tangents.array[k] = m[0] * tx + m[4] * ty + m[8] * tz;
                        tangents.array[k + 1] =
                            m[1] * tx + m[5] * ty + m[9] * tz;
                        tangents.array[k + 2] =
                            m[2] * tx + m[6] * ty + m[10] * tz;
                        if (attributeSizes.tangent === 4)
                            tangents.array[k + 3] = base.tangent[k + 3];
                    }
                }
        }
        if (changed) {
            positions.needsUpdate = true;
            normals.needsUpdate = true;
            glowColors.needsUpdate = true;
            if (tangents) tangents.needsUpdate = true;
        }
    };
    // Capture only after collecting and partitioning the current children. Empty
    // media groups can receive images/videos asynchronously during the reveal.
    for (const root of options.hideRoots ?? []) {
        let source = root,
            background = false;
        while (source) {
            background ||= source.userData?.worldTravelBackground === true;
            source = source.parent;
        }
        if (!background && root && root !== scene && root !== container)
            hide(root);
    }
    // A sliced build may have paused while the space swapped its sky.
    background = scene.background;
    fog = scene.fog;
    setProgress(0);
    // A parked effect owns buffers only. Each activation gets a new hook record,
    // so another renderer wrapping an older hook cannot create a restart cycle.
    type Hook = { previous: any; callback: any };
    let activeHook: Hook | undefined;
    const isIntact = () =>
        mode === "dissolve" ? progress === 0 : progress === 1;
    const attachHook = () => {
        const hook: Hook = {
            previous: scene.onBeforeRender,
            callback: undefined,
        };
        hook.callback = function (this: any, ...args: any[]) {
            hook.previous?.apply(this, args);
            if (disposed || parked || activeHook !== hook || isIntact()) return;
            for (const object of originals.keys()) object.visible = false;
        };
        activeHook = hook;
        scene.onBeforeRender = hook.callback;
    };
    const detachHook = () => {
        if (activeHook && scene.onBeforeRender === activeHook.callback)
            scene.onBeforeRender = activeHook.previous;
        activeHook = undefined;
    };
    attachHook();
    let sourceDisposed = false;
    let disposedSourceName = "";
    const sourceLabel = (object: any) =>
        String(
            object?.name ||
                object?.uuid ||
                object?.constructor?.name ||
                "source"
        ).slice(0, 96);
    const stateLabel = (value: any) => {
        if (value === null || typeof value !== "object")
            return String(value).slice(0, 64);
        return `${value.constructor?.name ?? "object"}${
            value.uuid ? `#${String(value.uuid).slice(0, 36)}` : ""
        }`;
    };
    const firstChangedState = (before: any[], after: any[]) => {
        for (
            let index = 0;
            index < Math.max(before.length, after.length);
            index++
        )
            if (
                index >= before.length ||
                index >= after.length ||
                !Object.is(before[index], after[index])
            )
                return index;
        return -1;
    };
    const sourceGeometries = new Set(
        [...preparedSources].map((object) => object.geometry)
    );
    const sourceGeometryDisposed = (event: any) => {
        sourceDisposed = true;
        const source = [...preparedSources].find(
            (object) => sourceStates.get(object)?.[2] === event?.target
        );
        disposedSourceName = sourceLabel(source ?? event?.target);
    };
    for (const geometry of sourceGeometries)
        geometry?.addEventListener?.("dispose", sourceGeometryDisposed);
    const canReuse = () => {
        const miss = (reason: string) => {
            stats.reuseMiss = reason;
            return false;
        };
        stats.reuseMiss = "";
        if (disposed) return miss("disposed");
        if (sourceDisposed)
            return miss(`geometry-disposed:${disposedSourceName}`);
        if (!parked && !isIntact()) return miss("active-transition");
        scene.updateMatrixWorld(true);
        const sceneChanged = firstChangedState(
            sceneMatrix,
            scene.matrixWorld.elements
        );
        if (sceneChanged >= 0)
            return miss(
                `scene-matrix[${sceneChanged}]:${stateLabel(
                    sceneMatrix[sceneChanged]
                )}->${stateLabel(scene.matrixWorld.elements[sceneChanged])}`
            );
        for (const { root, parent } of sourceRoots)
            if (root?.parent !== parent)
                return miss(
                    `${sourceLabel(root)} parent:${stateLabel(
                        parent
                    )}->${stateLabel(root?.parent)}`
                );
        const present = scanSources();
        for (const object of preparedSources) {
            if (!present.has(object)) {
                let hidden = object;
                while (hidden && hidden.visible !== false)
                    hidden = hidden.parent;
                return miss(
                    hidden
                        ? `${sourceLabel(object)} hidden:${sourceLabel(hidden)}`
                        : `${sourceLabel(object)} missing-or-excluded`
                );
            }
            const before = sourceStates.get(object),
                after = sourceState(object);
            const index = firstChangedState(before, after);
            if (index >= 0)
                return miss(
                    `${sourceLabel(object)} state[${index}]:${stateLabel(
                        before[index]
                    )}->${stateLabel(after[index])}`
                );
        }
        return true;
    };
    const park = () => {
        if (disposed) return false;
        if (parked) return true;
        if (!isIntact()) {
            for (const [object, visible] of originals) object.visible = visible;
            scene.background = background;
            scene.fog = fog;
        }
        parked = true;
        container.visible = false;
        container.removeFromParent();
        detachHook();
        return true;
    };
    // Packed attributes and cell spans own everything needed for replay. Release
    // construction-only objects now rather than keeping clipping scratch for the
    // whole room visit. Buffer attributes remain referenced by the draw meshes.
    candidates.length = 0;
    instanceSources.clear();
    geometryBounds.clear();
    materialIds.clear();
    visited.clear();
    batches.clear();
    frontRecords.length = 0;
    auxiliary.clear();
    fixed.clear();
    cells.clear();
    rigidCells.clear();
    return {
        stats,
        setProgress,
        /** The reveal progress by which every cell that can reach within
         * `radius` metres of the anchor has finished assembling; 1 when no
         * cell is that close. */
        completeWithin(radius: number) {
            let done = -1;
            for (const cell of assembly)
                if (cell.reach <= radius) done = Math.max(done, cell.done);
            return done < 0 ? 1 : done;
        },
        park,
        canReuse,
        getAddedSources() {
            if (disposed) return [];
            scene.updateMatrixWorld(true);
            return addedSources();
        },
        restart(next: WorldCubeRevealRestartOptions) {
            let nextAnchor: RevealPoint;
            try {
                nextAnchor = snapshotRevealAnchor(next?.anchor);
            } catch {
                return false;
            }
            if (
                (next.mode !== "reveal" && next.mode !== "dissolve") ||
                (next.direction !== undefined &&
                    next.direction !== "inward" &&
                    next.direction !== "outward") ||
                !canReuse()
            )
                return false;
            // A skipped placeholder that gained real geometry belongs to the
            // caller's delta effect, not this earlier snapshot's visibility map.
            for (const object of addedSources())
                if (!(options.hideRoots ?? []).includes(object))
                    originals.delete(object);
            park();
            background = scene.background;
            fog = scene.fog;
            for (const object of originals.keys())
                originals.set(object, object.visible);
            // Low-to-high texture upgrades replace map slots directly, without
            // changing material.version. Refresh every clone dependency in order.
            for (const record of materialClones) {
                const { source, clone } = record;
                copyWorldRevealMaterial(clone, source);
                if (record.vertexColors !== undefined)
                    clone.vertexColors = record.vertexColors;
                if (record.color)
                    clone.color.multiply(
                        new THREE.Color().fromArray(record.color)
                    );
                clone.needsUpdate = true;
            }
            mode = next.mode;
            direction = next.direction;
            waveExtent = next.waveExtent;
            configureRevealAnchor(nextAnchor);
            parked = false;
            previousProgress = -1;
            scene.add(container);
            setProgress(0);
            attachHook();
            return true;
        },
        setRevealAnchor(nextAnchor: RevealPoint, nextWaveExtent?: number) {
            if (disposed || parked) return;
            configureRevealAnchor(nextAnchor, nextWaveExtent);
            previousProgress = -1;
            setProgress(progress);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            detachHook();
            if (!parked) {
                for (const [object, visible] of originals)
                    object.visible = visible;
                scene.background = background;
                scene.fog = fog;
            }
            container.removeFromParent();
            geometries.forEach((g) => g.dispose());
            geometries.length = 0;
            container.clear();
            delete container.userData.worldRevealSchedule;
            // A completed controller may stay alive until leaving the destination.
            // Release its cut-geometry CPU buffers as well as the GPU resources.
            for (const name of Object.keys(base))
                base[name] = new Float32Array(0);
            for (const attribute of [positions, normals, glowColors, tangents])
                if (attribute) attribute.array = new Float32Array(0);
            glow.dispose();
            backMaterials.forEach((back) => back.dispose());
            backMaterials.clear();
            tileMaterials.forEach((material) => material.dispose());
            tileMaterials.clear();
            colorMaterials.forEach((material) => material.dispose());
            colorMaterials.clear();
            rigidMaterials.forEach((material) => material.dispose());
            rigidMaterials.clear();
            rigidRecords.clear();
            rigidCells.clear();
            motionCells.clear();
            instanceSources.clear();
            geometryBounds.clear();
            candidates.length = 0;
            batches.clear();
            cells.clear();
            originals.clear();
            materialClones.length = 0;
            preparedSources.clear();
            sourceStates.clear();
            sourceRoots.length = 0;
            for (const geometry of sourceGeometries)
                geometry?.removeEventListener?.(
                    "dispose",
                    sourceGeometryDisposed
                );
            sourceGeometries.clear();
        },
    };
}
