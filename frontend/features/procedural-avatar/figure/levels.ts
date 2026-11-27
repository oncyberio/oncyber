import * as THREE from "three/webgpu";
import { coarser } from "./detail";
import { DETAIL_ATTRIBUTE, affordable } from "./format";

/**
 * A figure at the detail a view can show.
 *
 * A figure's file says, for every vertex, what a view loses by drawing the
 * figure without it (see detail.ts): a length, in metres. A view cannot
 * show anything much smaller than one of its pixels, so a figure far off
 * can be drawn with every vertex that costs less than a part of a pixel
 * left out, and the picture is the same to within that part of a pixel.
 * Close to, nothing costs that little and the whole mesh is drawn.
 *
 * The meshes come in steps, the levels below, so that a figure moving
 * off changes mesh now and then and not all the time.
 */

/** The meshes a figure is made of. */
export type FigureMesh = "body" | "face" | "ink";

/**
 * The steps: level 0 is the whole mesh; level `n` leaves out what costs
 * no more than `LEVEL_BASE` times `LEVEL_RATIO` to the power `n - 1`
 * metres. The last is for a figure a few pixels tall.
 */
export const LEVEL_BASE = 0.00025;
export const LEVEL_RATIO = Math.SQRT2;
export const LEVEL_COUNT = 18;

/** What a level leaves out: anything costing this much or less, metres. */
export const levelTolerance = (level: number) =>
    level <= 0 ? 0 : LEVEL_BASE * LEVEL_RATIO ** (level - 1);

/** The coarsest level that leaves out nothing costing more than this. */
export function levelFor(tolerance: number) {
    if (!(tolerance >= LEVEL_BASE)) return 0;
    return Math.min(
        LEVEL_COUNT - 1,
        // A hair over, so that a level's own tolerance finds that level.
        Math.floor(
            Math.log(tolerance / LEVEL_BASE) / Math.log(LEVEL_RATIO) + 1e-9
        ) + 1
    );
}

/**
 * How much of a figure a pixel of a view covers, metres, at a distance
 * from the camera: what a view "can show" is counted in these. `height`
 * is the height of the picture, pixels.
 */
export function pixelSize(
    camera: THREE.Camera,
    distance: number,
    height: number
) {
    const lens = camera as THREE.PerspectiveCamera;
    if (lens.isPerspectiveCamera)
        return (
            (2 * distance * Math.tan(THREE.MathUtils.degToRad(lens.fov) / 2)) /
            lens.zoom /
            height
        );
    const flat = camera as THREE.OrthographicCamera;
    return (flat.top - flat.bottom) / flat.zoom / height;
}

/** A figure's meshes at each level. */
export interface FigureLevels {
    /** Whether the figure's file says anything about detail. */
    known: boolean;
    /**
     * The triangles of one mesh at a level. The same list each time it
     * is asked for; level 0 is the mesh's own.
     */
    index(mesh: FigureMesh, level: number): THREE.BufferAttribute;
    /** Triangles in the whole figure at a level. */
    triangles(level: number): number;
}

/**
 * Read what a figure's meshes say about detail, and take it off them: it
 * is for choosing triangles, not for drawing.
 */
export function createFigureLevels(
    meshes: Record<FigureMesh, THREE.Mesh>
): FigureLevels {
    const name = DETAIL_ATTRIBUTE.toLowerCase();
    let known = true;
    const read = (mesh: THREE.Mesh) => {
        const { geometry } = mesh;
        const stored = geometry.getAttribute(name);
        const whole = geometry.index;
        if (!stored) {
            known = false;
            return { whole, parent: null, cost: null };
        }
        const parent = new Uint16Array(stored.count);
        const cost = new Uint16Array(stored.count);
        for (let v = 0; v < stored.count; v++) {
            parent[v] = stored.getX(v);
            cost[v] = stored.getY(v);
        }
        geometry.deleteAttribute(name);
        return { whole, parent, cost };
    };
    const of = {
        body: read(meshes.body),
        face: read(meshes.face),
        ink: read(meshes.ink),
    };
    const made = new Map<string, THREE.BufferAttribute>();
    const index = (mesh: FigureMesh, level: number) => {
        const { whole, parent, cost } = of[mesh];
        const at = Math.max(0, Math.min(LEVEL_COUNT - 1, Math.floor(level)));
        if (!at || !parent) return whole;
        const key = `${mesh} ${at}`;
        let list = made.get(key);
        if (!list) {
            const most = affordable(levelTolerance(at));
            const kept = coarser(whole.array, parent, (v) => cost[v] <= most);
            list = new THREE.BufferAttribute(Uint16Array.from(kept), 1);
            made.set(key, list);
        }
        return list;
    };
    return {
        get known() {
            return known;
        },
        index,
        triangles: (level) =>
            (index("body", level).count +
                index("face", level).count +
                index("ink", level).count) /
            3,
    };
}
