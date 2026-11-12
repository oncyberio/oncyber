import {
    abs,
    float as tslFloat,
    max,
    mod,
    positionWorld,
    step,
    uniform,
} from "three/tsl";
import * as NodeClasses from "three/webgpu";
import { finishNow } from "./slicedWork";
import { readRevealStyle, readPreviewOption } from "./lobbyPreviewOptions";
import {
    cloneWorldRevealMaterial,
    isWorldRevealShaderMaterial,
} from "./worldRevealMaterial";

/**
 * A cheap alternative to the cube-tile reveal: the destination's own materials
 * get a radial front that spreads from the traveller's feet (or closes back in
 * on departure). Its edge breaks up in world-space cells, the same pattern the
 * avatar rise uses, scaled to architecture. Nothing is cut or copied: each
 * frame only one uniform changes.
 *
 * Opt in with `?travel=sweep` (see lobbyPreviewOptions.ts).
 */

export type WorldRevealStyle = "tiles" | "sweep";

export function readWorldRevealStyle(): WorldRevealStyle {
    return readRevealStyle();
}

/** Departure stays cubes unless explicitly previewing its alternative. */
export function readWorldDepartureStyle(): WorldRevealStyle {
    return readPreviewOption("departure") === "sweep" ? "sweep" : "tiles";
}

/** Sweep arrival duration; the tile reveal takes ~1.8 s. */
export const WORLD_SWEEP_REVEAL_MS = 800;
/** Cell edge in metres for the dithered front. */
const CELL = 0.2;
/** Width of the dithered band, in metres. */
const BAND = 1.2;

interface Point {
    x: number;
    y: number;
    z: number;
}

export interface WorldSweepRevealOptions {
    THREE: any;
    roots: readonly any[];
    anchor: Point;
    exclude?: (object: any) => boolean;
    mode?: "reveal" | "dissolve";
    /** Never sweep further than this (metres). */
    maxRadius?: number;
}

/** Classic materials (e.g. from glTF) as their node-material equivalents, the
 * same conversion WebGPURenderer applies internally before drawing them. */
const NODE_CLASSES: Record<string, any> = {
    MeshBasicMaterial: NodeClasses.MeshBasicNodeMaterial,
    MeshLambertMaterial: NodeClasses.MeshLambertNodeMaterial,
    MeshPhongMaterial: NodeClasses.MeshPhongNodeMaterial,
    MeshStandardMaterial: NodeClasses.MeshStandardNodeMaterial,
    MeshPhysicalMaterial: NodeClasses.MeshPhysicalNodeMaterial,
    MeshToonMaterial: NodeClasses.MeshToonNodeMaterial,
    MeshMatcapMaterial: NodeClasses.MeshMatcapNodeMaterial,
    MeshNormalMaterial: NodeClasses.MeshNormalNodeMaterial,
};
const SKIP_KEYS = new Set(["uuid", "id", "type", "version", "_listeners"]);
function toNodeMaterial(material: any) {
    const NodeClass = NODE_CLASSES[material.type];
    if (!NodeClass) return null;
    const node = new NodeClass();
    for (const key in material) {
        if (SKIP_KEYS.has(key)) continue;
        const value = material[key];
        if (typeof value === "function") continue;
        node[key] =
            value?.isColor || value?.isVector2 || value?.isEuler
                ? value.clone()
                : value;
    }
    node.name = material.name;
    return node;
}

/** Objects per slice while building, so travel animation keeps its frames. */
const OBJECTS_PER_SLICE = 24;

export function createWorldSweepReveal(options: WorldSweepRevealOptions) {
    return finishNow(buildWorldSweepReveal(options));
}

/** Sliced build: yields between small batches of objects. */
export function* buildWorldSweepReveal(options: WorldSweepRevealOptions) {
    const { THREE } = options;
    const mode = options.mode ?? "reveal";
    const maxRadius = options.maxRadius ?? 80;
    const front = uniform(0);
    const center = uniform(
        new THREE.Vector2(options.anchor.x, options.anchor.z)
    );
    const clones = new Map<any, any>();
    const swapped: Array<{ mesh: any; material: any }> = [];
    // Objects whose materials can't take the node: shown when the front passes them.
    const coarse: Array<{ object: any; distance: number; visible: boolean }> =
        [];
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    let extent = 0;
    let disposed = false;
    let parked = false;

    const sweepMaterial = (material: any) => {
        if (!material) return material;
        if (clones.has(material)) return clones.get(material);
        let clone: any = null;
        if (
            (material.isNodeMaterial !== true ||
                !isWorldRevealShaderMaterial(material)) &&
            !material.isShaderMaterial &&
            !material.isRawShaderMaterial
        ) {
            // NodeMaterial.copy() alone drops map, color and friends.
            clone =
                material.isNodeMaterial === true
                    ? cloneWorldRevealMaterial(material)
                    : toNodeMaterial(material);
        }
        if (clone) {
            const cell = abs(mod(positionWorld, CELL).sub(CELL / 2)).div(
                CELL / 2
            );
            const threshold = max(max(cell.x, cell.y), cell.z);
            const distance = positionWorld.xz.sub(center).length();
            const edge = front.sub(tslFloat(BAND).mul(threshold));
            // Visible inside the front. Reveal grows it; dissolve shrinks it,
            // so the far side goes first and the traveller's spot goes last.
            const visible = tslFloat(1).sub(step(edge, distance));
            clone.opacityNode = (
                material.opacityNode || tslFloat(material.opacity ?? 1)
            ).mul(visible);
            clone.alphaTest = Math.max(material.alphaTest || 0, 0.001);
            clone.needsUpdate = true;
        }
        clones.set(material, clone);
        return clone;
    };

    const visit = (object: any) => {
        if (!object || options.exclude?.(object)) return false;
        if (
            object.isMesh ||
            object.isPoints ||
            object.isLine ||
            object.isSprite
        ) {
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            const replaced = object.isMesh
                ? materials.map(sweepMaterial)
                : materials.map(() => null);
            box.setFromObject(object);
            if (!box.isEmpty()) {
                const far = Math.max(
                    Math.hypot(
                        box.min.x - options.anchor.x,
                        box.min.z - options.anchor.z
                    ),
                    Math.hypot(
                        box.max.x - options.anchor.x,
                        box.max.z - options.anchor.z
                    ),
                    Math.hypot(
                        box.min.x - options.anchor.x,
                        box.max.z - options.anchor.z
                    ),
                    Math.hypot(
                        box.max.x - options.anchor.x,
                        box.min.z - options.anchor.z
                    )
                );
                extent = Math.max(extent, Math.min(maxRadius, far));
            }
            if (replaced.every(Boolean)) {
                swapped.push({ mesh: object, material: object.material });
                object.material = Array.isArray(object.material)
                    ? replaced
                    : replaced[0];
            } else {
                box.getCenter(point);
                coarse.push({
                    object,
                    distance: box.isEmpty()
                        ? 0
                        : Math.hypot(
                              point.x - options.anchor.x,
                              point.z - options.anchor.z
                          ),
                    visible: object.visible,
                });
            }
        }
        return true;
    };
    // Depth-first without recursion so the walk can pause between slices.
    const pending: any[] = [...options.roots].reverse();
    let sliced = 0;
    while (pending.length) {
        const object = pending.pop();
        if (!visit(object)) continue;
        const children = object.children || [];
        for (let i = children.length - 1; i >= 0; i--)
            pending.push(children[i]);
        if (++sliced % OBJECTS_PER_SLICE === 0) yield;
    }

    const stats = {
        maxDistance: extent,
        materials: clones.size,
        meshes: swapped.length,
        coarse: coarse.length,
        cells: 0,
        skipped: coarse.length,
    };

    const setProgress = (progress: number) => {
        if (disposed || parked) return;
        const linear = Math.max(0, Math.min(1, progress));
        // Ease out: the front leaves quickly and settles at the far walls.
        const p = 1 - (1 - linear) * (1 - linear);
        // Overshoot by the band so the last cells fully settle at 1.
        const reach =
            (stats.maxDistance + BAND) * (mode === "reveal" ? p : 1 - p);
        front.value = reach;
        for (const entry of coarse)
            entry.object.visible = entry.visible && entry.distance <= reach;
    };
    setProgress(0);

    const restore = () => {
        for (const { mesh, material } of swapped) mesh.material = material;
        swapped.length = 0;
        for (const entry of coarse) entry.object.visible = entry.visible;
        coarse.length = 0;
    };

    return {
        stats,
        setProgress,
        setRevealAnchor(anchor: Point) {
            center.value.set(anchor.x, anchor.z);
        },
        /** Put the original materials back; the world stays fully shown. */
        park() {
            if (parked || disposed) return;
            parked = true;
            restore();
        },
        canReuse: () => false,
        getAddedSources: () => [] as any[],
        restart: () => false,
        dispose() {
            if (disposed) return;
            disposed = true;
            restore();
            for (const clone of clones.values()) clone?.dispose?.();
            clones.clear();
        },
    };
}

/** Stand-in for the media tile effect: the sweep already covers media roots. */
export function createNoopWorldReveal() {
    return {
        stats: { cells: 0, triangles: 0, skipped: 0, maxDistance: 0 },
        skipped: [] as unknown[],
        setProgress(_progress: number) {},
        setRevealAnchor(_anchor: Point, _extent?: number) {},
        dispose() {},
    };
}
