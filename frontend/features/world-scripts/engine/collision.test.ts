/** @jest-environment node */
import {
    Box3,
    BoxGeometry,
    Matrix4,
    Object3D,
    PlaneGeometry,
    Vector3,
} from "three";

jest.mock("./facade", () => ({
    collisionWorld: jest.fn(() => null),
    forgetCollider: jest.fn(),
}));

import {
    createCollisionHoles,
    createSolids,
    shapeBoxPositions,
    solidPositions,
} from "./collision";
import { collisionWorld, forgetCollider } from "./facade";

/** A collision world that writes down what it is given. */
function octree(triangles: Array<{ a: Vector3; b: Vector3; c: Vector3 }> = []) {
    const colliders = new Set<Object3D>();
    return {
        colliders,
        updates: 0,
        staticOctree: {
            traverseTriangles: (visit: (triangle: any) => void) =>
                // a triangle sits in every cell it crosses
                [...triangles, ...triangles].forEach(visit),
        },
        addCollider(mesh: Object3D) {
            colliders.add(mesh);
        },
        removeCollider(mesh: Object3D) {
            colliders.delete(mesh);
        },
        updateDynOctree() {
            this.updates++;
        },
    };
}
const world = collisionWorld as jest.Mock;
const BOX = solidPositions([
    [
        [0, 0, 0],
        [1, 1, 1],
    ],
]);

beforeEach(() => {
    jest.clearAllMocks();
    world.mockReturnValue(null);
});

describe("what a visitor cannot walk through", () => {
    test("a box is five sides (it has no underside), whichever corners are given", () => {
        expect(BOX).toHaveLength(5 * 2 * 9);
        const flipped = solidPositions([
            [
                [1, 1, 1],
                [0, 0, 0],
            ],
        ]);
        expect([...flipped]).toEqual([...BOX]);
        const ys = [...BOX].filter((_, i) => i % 3 === 1);
        expect(Math.min(...ys)).toBe(0);
        expect(Math.max(...ys)).toBe(1);
    });

    test("a wall is one side, as its corners run", () => {
        const wall = solidPositions(
            [],
            [
                [
                    [0, 0, 0],
                    [2, 0, 0],
                    [2, 3, 0],
                    [0, 3, 0],
                ],
            ]
        );
        expect([...wall]).toEqual([
            0, 0, 0, 2, 0, 0, 2, 3, 0, 0, 0, 0, 2, 3, 0, 0, 3, 0,
        ]);
        expect(solidPositions()).toHaveLength(0);
    });

    test("a shape's box is its own bounds; a plane is given a little thickness", () => {
        const crate = shapeBoxPositions(new BoxGeometry(2, 4, 6));
        const box = new Box3().setFromArray([...crate]);
        expect(box.getSize(new Vector3()).toArray()).toEqual([2, 4, 6]);
        const sheet = new Box3().setFromArray([
            ...shapeBoxPositions(new PlaneGeometry(2, 2)),
        ]);
        expect(sheet.getSize(new Vector3()).z).toBeCloseTo(0.1);
    });
});

describe("the colliders scripts own", () => {
    test("a solid waits for a collision world, and is put into each new one", () => {
        const solids = createSolids();
        const holder = new Object3D();
        solids.set("wall", holder, BOX);
        expect(holder.children).toHaveLength(1);
        expect(holder.children[0].visible).toBe(false);
        // The world's collision is built after its model.
        const first = octree();
        world.mockReturnValue(first);
        solids.sync();
        expect(first.colliders.size).toBe(1);
        expect(forgetCollider).toHaveBeenCalledTimes(1);
        solids.sync();
        expect(forgetCollider).toHaveBeenCalledTimes(1);
        // The visitor travels: a new collision world gets it again.
        const second = octree();
        world.mockReturnValue(second);
        solids.sync();
        expect(second.colliders.size).toBe(1);
        expect(forgetCollider).toHaveBeenCalledTimes(2);
    });

    test("moved, replaced and taken away, the collision world is kept in step", () => {
        const tree = octree();
        world.mockReturnValue(tree);
        const solids = createSolids();
        solids.sync();
        const holder = new Object3D();
        solids.set("wall", holder, BOX);
        const [mesh] = tree.colliders;
        solids.moved("wall");
        expect(tree.colliders.has(mesh)).toBe(true);
        solids.set("wall", holder, BOX);
        expect(tree.colliders.has(mesh)).toBe(false);
        expect(tree.colliders.size).toBe(1);
        solids.set("wall", holder, null);
        expect(tree.colliders.size).toBe(0);
        expect(holder.children).toHaveLength(0);
        solids.set("a", holder, BOX);
        solids.set("b", holder, BOX);
        solids.dispose();
        expect(tree.colliders.size).toBe(0);
        expect(tree.updates).toBeGreaterThan(4);
    });
});

describe("holes in the world's own collision", () => {
    const triangle = (x: number) => ({
        a: new Vector3(x, 0, 0),
        b: new Vector3(x + 0.2, 0, 0),
        c: new Vector3(x, 0.2, 0),
    });
    const around = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const half = new Vector3(1, 1, 1);

    test("triangles inside the box are moved away once each, and come back exactly", () => {
        const inside = triangle(0);
        const outside = triangle(5);
        world.mockReturnValue(octree([inside, outside]));
        const holes = createCollisionHoles();
        expect(holes.open("door", around, new Matrix4(), half)).toBe(true);
        expect(inside.a.length()).toBeGreaterThan(1e6);
        expect(outside.a.x).toBe(5);
        holes.close("door");
        expect(inside.a.toArray()).toEqual([0, 0, 0]);
        expect(inside.b.x).toBeCloseTo(0.2);
    });

    test("with no collision world there is nothing to cut", () => {
        const holes = createCollisionHoles();
        expect(holes.open("door", around, new Matrix4(), half)).toBe(false);
        expect(holes.stale("door")).toBe(false);
    });

    test("a hole cut in a collision world that is gone is stale, and is not undone in the new one", () => {
        const inside = triangle(0);
        world.mockReturnValue(octree([inside]));
        const holes = createCollisionHoles();
        holes.open("door", around, new Matrix4(), half);
        world.mockReturnValue(octree());
        expect(holes.stale("door")).toBe(true);
        const moved = inside.a.clone();
        holes.dispose();
        expect(inside.a.equals(moved)).toBe(true);
    });
});
