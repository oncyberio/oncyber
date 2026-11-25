/**
 * The walking collision of the world on show, as world scripts reach it:
 * things a visitor cannot walk through ("solid") and holes in the world's
 * own collision ("opening"). Everything here is undone when the script
 * lets go, and nothing is ever saved.
 */
import {
    BufferAttribute,
    BufferGeometry,
    Mesh,
    MeshBasicMaterial,
    Vector3,
    type Box3,
    type Matrix4,
    type Object3D,
} from "three";
import Camera from "@3/three/camera";
import type { SolidWall, Vec3 } from "../protocol";

/** The engine's collision world: a static tree and colliders that can move. */
type Octree = {
    staticOctree: {
        traverseTriangles(visit: (triangle: Triangle) => void): void;
    };
    addCollider(mesh: Object3D): unknown;
    removeCollider(mesh: Object3D): void;
    updateDynOctree(): void;
};
type Triangle = { a: Vector3; b: Vector3; c: Vector3 };

/** The collision world of the space on show, or null between spaces. */
export function currentOctree(): Octree | null {
    try {
        const controls = (Camera as any).currentControls;
        return controls?.world?.collisions?.worldOctree ?? null;
    } catch {
        return null;
    }
}

/**
 * The triangles of boxes (five sides: no underside) and one-sided walls,
 * as positions, nine numbers per triangle. A wall stops a visitor on the
 * side its corners run counter-clockwise from.
 */
export function solidPositions(
    boxes: Array<[Vec3, Vec3]> = [],
    walls: SolidWall[] = []
): Float32Array {
    const out: number[] = [];
    const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) =>
        out.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (const [lo, hi] of boxes) {
        const x0 = Math.min(lo[0], hi[0]);
        const y0 = Math.min(lo[1], hi[1]);
        const z0 = Math.min(lo[2], hi[2]);
        const x1 = Math.max(lo[0], hi[0]);
        const y1 = Math.max(lo[1], hi[1]);
        const z1 = Math.max(lo[2], hi[2]);
        quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
        quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
        quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
        quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
        quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    }
    for (const [a, b, c, d] of walls) quad(a, b, c, d);
    return new Float32Array(out);
}

/**
 * Colliders the scripts own. The collision world is rebuilt when a visitor
 * travels, so what is registered is checked every frame and put back.
 */
export function createSolids() {
    const meshes = new Map<string, Mesh>();
    let octree: Octree | null = null;

    function register(mesh: Mesh) {
        mesh.updateWorldMatrix(true, false);
        // the engine keeps its collider on the mesh: a new world needs a new one
        mesh.userData._collider = null;
        octree?.addCollider(mesh);
    }

    return {
        /** A solid's shape, in its holder's frame. Null takes it away. */
        set(id: string, holder: Object3D, positions: Float32Array | null) {
            const old = meshes.get(id);
            if (old) {
                octree?.removeCollider(old);
                old.geometry.dispose();
                old.removeFromParent();
                meshes.delete(id);
            }
            if (positions?.length) {
                const geometry = new BufferGeometry();
                geometry.setAttribute(
                    "position",
                    new BufferAttribute(positions, 3)
                );
                const mesh = new Mesh(geometry, new MeshBasicMaterial());
                mesh.name = `world-script:${id}:solid`;
                // never drawn, never clicked: only walked into
                mesh.visible = false;
                mesh.raycast = () => undefined;
                holder.add(mesh);
                meshes.set(id, mesh);
                if (octree) register(mesh);
            }
            octree?.updateDynOctree();
        },
        /** The solid moved with its holder. */
        moved(id: string) {
            const mesh = meshes.get(id);
            if (!mesh || !octree) return;
            octree.removeCollider(mesh);
            register(mesh);
            octree.updateDynOctree();
        },
        /** Once a frame: a new collision world gets every solid again. */
        sync() {
            const now = currentOctree();
            if (now === octree) return;
            octree = now;
            if (!octree) return;
            meshes.forEach(register);
            octree.updateDynOctree();
        },
        dispose() {
            meshes.forEach((mesh) => {
                octree?.removeCollider(mesh);
                mesh.geometry.dispose();
                mesh.removeFromParent();
            });
            meshes.clear();
            octree?.updateDynOctree();
        },
    };
}

/** Far enough that nothing near the world ever reaches it. */
const AWAY = new Vector3(4.1e6, -7.3e6, 5.9e6);

/**
 * Takes the world's own collision out of a box and puts it back: the
 * triangles whose middle is inside are moved far away, not deleted, so
 * closing the hole is exact.
 */
export function createCollisionHoles() {
    const holes = new Map<string, { octree: Octree; moved: Triangle[] }>();
    const middle = new Vector3();

    function close(id: string) {
        const hole = holes.get(id);
        if (!hole) return;
        holes.delete(id);
        // a new collision world was built from the model again: nothing to undo
        if (hole.octree !== currentOctree()) return;
        for (const triangle of hole.moved) {
            triangle.a.sub(AWAY);
            triangle.b.sub(AWAY);
            triangle.c.sub(AWAY);
        }
    }

    return {
        /**
         * Cuts the hole: a box of half-size `half` in the frame `toHole`
         * maps the world into; `bounds` is that box's extent in the world.
         */
        open(id: string, bounds: Box3, toHole: Matrix4, half: Vector3) {
            close(id);
            const octree = currentOctree();
            if (!octree) return false;
            // a triangle sits in every cell it crosses: move each one once
            const found = new Set<Triangle>();
            octree.staticOctree.traverseTriangles((triangle) => {
                if (found.has(triangle)) return;
                middle
                    .copy(triangle.a)
                    .add(triangle.b)
                    .add(triangle.c)
                    .divideScalar(3);
                if (!bounds.containsPoint(middle)) return;
                middle.applyMatrix4(toHole);
                if (
                    Math.abs(middle.x) > half.x ||
                    Math.abs(middle.y) > half.y ||
                    Math.abs(middle.z) > half.z
                )
                    return;
                found.add(triangle);
            });
            const moved = [...found];
            for (const triangle of moved) {
                triangle.a.add(AWAY);
                triangle.b.add(AWAY);
                triangle.c.add(AWAY);
            }
            holes.set(id, { octree, moved });
            return true;
        },
        /** True when the hole was cut in a collision world that is gone. */
        stale(id: string) {
            const hole = holes.get(id);
            return !!hole && hole.octree !== currentOctree();
        },
        close,
        dispose() {
            [...holes.keys()].forEach(close);
        },
    };
}
