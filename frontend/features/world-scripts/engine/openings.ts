/**
 * An "opening": a box-shaped hole in the world's own model, there for as
 * long as the script keeps it. Whatever of the model has its middle inside
 * the box is neither drawn nor walked into: a wall panel behind a door, the
 * strokes lining a recess. Closing it puts everything back exactly.
 *
 * Many worlds draw a building once and place copies of it. A hole in one
 * copy redraws that copy's parts on their own, without what is in the box,
 * and leaves the other copies as they are.
 */
import {
    Box3,
    Matrix4,
    Mesh,
    Sphere,
    Vector3,
    type BufferGeometry,
    type InstancedMesh,
    type Object3D,
} from "three";
import { WORLD_SCRIPT_LIMITS, type Vec3 } from "../protocol";
import type { createCollisionHoles } from "./collision";
import { worldModel } from "./facade";

type Holes = ReturnType<typeof createCollisionHoles>;

type Undo = () => void;

/**
 * `geometry` without the triangles `drop` names, given each corner in the
 * hole's frame. Null when none are dropped.
 */
export function withoutTriangles(
    geometry: BufferGeometry,
    toHole: Matrix4,
    drop: (a: Vector3, b: Vector3, c: Vector3) => boolean
) {
    const position = geometry.getAttribute("position");
    if (!position) return null;
    const index = geometry.getIndex();
    const corners = index ? index.count : position.count;
    const kept: number[] = [];
    const points = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i + 2 < corners; i += 3) {
        const a = index ? index.getX(i) : i;
        const b = index ? index.getX(i + 1) : i + 1;
        const c = index ? index.getX(i + 2) : i + 2;
        points[0].fromBufferAttribute(position, a).applyMatrix4(toHole);
        points[1].fromBufferAttribute(position, b).applyMatrix4(toHole);
        points[2].fromBufferAttribute(position, c).applyMatrix4(toHole);
        if (!drop(points[0], points[1], points[2])) kept.push(a, b, c);
    }
    if (kept.length === corners) return null;
    const result = geometry.clone();
    result.setIndex(kept);
    return result;
}

const isShown = (object: Object3D) => {
    for (let node: Object3D | null = object; node; node = node.parent)
        if (!node.visible) return false;
    return true;
};

/**
 * Hides what of `model` lies in the box and returns how to put it back.
 * The box has half-size `half` in the frame `toHole` maps the world into;
 * `bounds` is its extent in the world.
 */
export function cutModel(
    model: Object3D,
    bounds: Box3,
    toHole: Matrix4,
    half: Vector3
): Undo {
    const undo: Undo[] = [];
    const middle = new Vector3();
    const inside = (a: Vector3, b: Vector3, c: Vector3) => {
        middle.copy(a).add(b).add(c).divideScalar(3);
        return (
            Math.abs(middle.x) <= half.x &&
            Math.abs(middle.y) <= half.y &&
            Math.abs(middle.z) <= half.z
        );
    };
    const sphere = new Sphere();
    const place = new Matrix4();
    const nothing = new Matrix4().makeScale(0, 0, 0);
    const meshes: Mesh[] = [];
    model.updateMatrixWorld(true);
    model.traverse((node) => {
        const mesh = node as Mesh;
        if (mesh.isMesh && mesh.geometry && !(mesh as any).isSkinnedMesh)
            meshes.push(mesh);
    });

    for (const mesh of meshes) {
        if (!isShown(mesh)) continue;
        const geometry = mesh.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        const instanced = mesh as unknown as InstancedMesh;
        if (instanced.isInstancedMesh) {
            for (let copy = 0; copy < instanced.count; copy++) {
                instanced.getMatrixAt(copy, place);
                const original = place.clone();
                place.premultiply(instanced.matrixWorld);
                sphere.copy(geometry.boundingSphere).applyMatrix4(place);
                if (!bounds.intersectsSphere(sphere)) continue;
                const open = withoutTriangles(
                    geometry,
                    place.clone().premultiply(toHole),
                    inside
                );
                if (!open) continue;
                // this copy is drawn on its own; the shared draw skips it
                const own = new Mesh(open, instanced.material);
                own.name = "world-script:opening";
                own.renderOrder = instanced.renderOrder;
                own.matrix.copy(instanced.matrix).multiply(original);
                own.matrixAutoUpdate = false;
                (instanced.parent || model).add(own);
                instanced.setMatrixAt(copy, nothing);
                instanced.instanceMatrix.needsUpdate = true;
                undo.push(() => {
                    own.removeFromParent();
                    open.dispose();
                    instanced.setMatrixAt(copy, original);
                    instanced.instanceMatrix.needsUpdate = true;
                });
            }
            continue;
        }
        sphere.copy(geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
        if (!bounds.intersectsSphere(sphere)) continue;
        const open = withoutTriangles(
            geometry,
            place.copy(mesh.matrixWorld).premultiply(toHole),
            inside
        );
        if (!open) continue;
        mesh.geometry = open;
        undo.push(() => {
            mesh.geometry = geometry;
            open.dispose();
        });
    }
    return () => undo.reverse().forEach((step) => step());
}

/** The openings scripts hold, in what is drawn and in what is walked into. */
export function createOpenings(holes: Holes) {
    type Opening = {
        holder: Object3D;
        size: Vec3;
        model: Object3D | null;
        undo: Undo | null;
        /** The collision was cut too (it is built a little after the model). */
        cut: boolean;
    };
    const openings = new Map<string, Opening>();
    const corner = new Vector3();

    function box(opening: Opening) {
        const limit = WORLD_SCRIPT_LIMITS.maxOpeningSize / 2;
        const half = new Vector3(
            Math.min(limit, opening.size[0] / 2),
            Math.min(limit, opening.size[1] / 2),
            Math.min(limit, opening.size[2] / 2)
        );
        opening.holder.updateWorldMatrix(true, false);
        const toHole = opening.holder.matrixWorld.clone().invert();
        const bounds = new Box3();
        for (const x of [-1, 1])
            for (const y of [-1, 1])
                for (const z of [-1, 1])
                    bounds.expandByPoint(
                        corner
                            .set(x * half.x, y * half.y, z * half.z)
                            .applyMatrix4(opening.holder.matrixWorld)
                    );
        return { half, toHole, bounds };
    }

    function shut(opening: Opening, id: string) {
        try {
            // a model that has gone took its changes with it
            if (opening.model === worldModel()) opening.undo?.();
        } catch {
            /* the scene was disposed under us: nothing left to restore */
        }
        opening.undo = null;
        opening.model = null;
        holes.close(id);
        opening.cut = false;
    }

    function cut(opening: Opening, id: string) {
        const model = worldModel();
        if (!model) return;
        const { half, toHole, bounds } = box(opening);
        if (opening.model !== model) {
            opening.model = model;
            opening.undo = cutModel(model, bounds, toHole, half);
        }
        opening.cut = holes.open(id, bounds, toHole, half);
    }

    return {
        /** An opening of `size` in its holder's frame. Null closes it. */
        set(id: string, holder: Object3D, size: Vec3 | null) {
            const old = openings.get(id);
            if (old) shut(old, id);
            openings.delete(id);
            if (!size) return;
            const opening: Opening = {
                holder,
                size,
                model: null,
                undo: null,
                cut: false,
            };
            openings.set(id, opening);
            cut(opening, id);
        },
        /** Once a frame: a world or a collision built since gets its holes. */
        sync() {
            openings.forEach((opening, id) => {
                if (
                    opening.model !== worldModel() ||
                    !opening.cut ||
                    holes.stale(id)
                )
                    cut(opening, id);
            });
        },
        dispose() {
            openings.forEach(shut);
            openings.clear();
        },
    };
}
