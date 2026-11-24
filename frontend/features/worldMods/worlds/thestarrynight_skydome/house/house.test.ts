/** @jest-environment node */
import { insideRoom, roomColliderPositions, standsInRoom } from "./colliders";
import { FURNITURE, LAMP, lampLight, paintInterior } from "./interior";
import { DOOR, HOUSE, ROOM, SHELL, houseToWorld, worldToHouse } from "./layout";

describe("the house's frame", () => {
    test("its origin is where the house stands", () => {
        expect(houseToWorld([0, 0, 0])).toEqual(HOUSE.at);
    });

    test("the door the visitor's link points at is out the front (+z)", () => {
        // ?coords=44.72x-19.91x-53.85: standing on the porch, facing the door
        const [x, , z] = worldToHouse([44.72, -19.91, -53.85]);
        expect(Math.abs(x)).toBeLessThan(1.5);
        expect(z).toBeGreaterThan(SHELL.halfDepth);
        expect(z).toBeLessThan(SHELL.halfDepth + 5);
    });

    test("there and back again", () => {
        const back = worldToHouse(houseToWorld([1.5, 2, -3]));
        expect(back[0]).toBeCloseTo(1.5);
        expect(back[1]).toBeCloseTo(2);
        expect(back[2]).toBeCloseTo(-3);
    });

    test("the room fits inside the shell", () => {
        expect(ROOM.halfWidth).toBeLessThan(SHELL.halfWidth);
        expect(ROOM.halfDepth).toBeLessThan(SHELL.halfDepth);
        expect(ROOM.ridge).toBeLessThan(SHELL.ridge);
        // the way in through the collision is no wider than the painted doorway
        expect(SHELL.passage.left).toBeGreaterThan(ROOM.door.left);
        expect(SHELL.passage.right).toBeLessThan(ROOM.door.right);
        expect(DOOR.threshold[2]).toBe(SHELL.halfDepth);
    });
});

describe("the painted room", () => {
    const painted = paintInterior();

    test("is a few thousand strokes, all inside the house", () => {
        expect(painted.strokes.count).toBeGreaterThan(8000);
        expect(painted.strokes.count).toBeLessThan(25000);
        const { min, max } = painted.bounds;
        expect(min[0]).toBeGreaterThan(-SHELL.halfWidth - 1);
        expect(max[0]).toBeLessThan(SHELL.halfWidth + 1);
        expect(min[2]).toBeGreaterThan(-SHELL.halfDepth - 1);
        // the threshold reaches out under the door, no further
        expect(max[2]).toBeLessThan(SHELL.halfDepth + 1.5);
        expect(max[1]).toBeLessThan(SHELL.ridge + 1);
    });

    test("has only numbers in it", () => {
        for (const array of [
            painted.base.position,
            painted.base.colour,
            ...Object.values(painted.strokes).filter(
                (value): value is Float32Array => value instanceof Float32Array
            ),
        ])
            expect(array.every(Number.isFinite)).toBe(true);
    });

    test("is the same room every visit", () => {
        expect(paintInterior().strokes.centre).toEqual(painted.strokes.centre);
    });

    test("is lighter on phones", () => {
        const phone = paintInterior({ density: 0.6 });
        expect(phone.strokes.count).toBeLessThan(painted.strokes.count * 0.85);
    });

    test("is brightest and warmest by the lamp", () => {
        const under: [number, number, number] = [LAMP[0], LAMP[1] - 1, LAMP[2]];
        const near = lampLight(under, [0, 1, 0]);
        const corner = lampLight(
            [ROOM.halfWidth, ROOM.floor, -ROOM.halfDepth],
            [0, 1, 0]
        );
        expect(near[0]).toBeGreaterThan(corner[0]);
        // warm near the flame, cool away from it
        expect(near[0]).toBeGreaterThan(near[2]);
        expect(corner[2]).toBeGreaterThan(corner[0]);
    });
});

describe("what a visitor collides with", () => {
    const positions = roomColliderPositions();
    const triangles: number[][][] = [];
    for (let i = 0; i < positions.length; i += 9)
        triangles.push(
            [0, 3, 6].map((k) => [...positions.subarray(i + k, i + k + 3)])
        );
    const normal = ([a, b, c]: number[][]) => {
        const u = b.map((v, i) => v - a[i]);
        const v = c.map((w, i) => w - a[i]);
        return [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
        ];
    };

    test("walls face into the room: they stop a visitor inside", () => {
        const walls = [-ROOM.halfWidth, ROOM.halfWidth].flatMap((x) =>
            triangles.filter((t) => t.every((p) => Math.abs(p[0] - x) < 1e-6))
        );
        expect(walls).toHaveLength(4);
        for (const wall of walls)
            expect(Math.sign(normal(wall)[0])).toBe(-Math.sign(wall[0][0]));
    });

    test("the front wall leaves the doorway open", () => {
        const { left, right, top } = SHELL.passage;
        const front = triangles.filter((t) =>
            t.every((p) => Math.abs(p[2] - ROOM.halfDepth) < 1e-6)
        );
        expect(front.length).toBeGreaterThan(0);
        for (const triangle of front) {
            expect(normal(triangle)[2]).toBeLessThan(0);
            const inDoorway = triangle.every(
                (p) => p[0] > left - 1e-6 && p[0] < right + 1e-6
            );
            // only the piece above the door spans it
            if (inDoorway)
                for (const p of triangle)
                    expect(p[1]).toBeGreaterThan(top - 1e-4);
        }
    });

    test("there is a floor to stand on, at the painted boards", () => {
        const floor = triangles.filter((t) =>
            t.every((p) => Math.abs(p[1] - ROOM.floor) < 1e-6)
        );
        expect(floor.length).toBeGreaterThanOrEqual(2);
        for (const triangle of floor)
            expect(normal(triangle)[1]).toBeGreaterThan(0);
    });

    test("every piece of furniture is boxed in", () => {
        // walls 6 quads, floor and ramp 2, five sides per piece
        expect(triangles).toHaveLength((6 + 2 + FURNITURE.length * 5) * 2);
        for (const [lo, hi] of FURNITURE) {
            expect(insideRoom(...lo)).toBe(true);
            expect(insideRoom(...hi)).toBe(true);
        }
    });

    test("inside the room is inside its walls, under its roof", () => {
        expect(insideRoom(0, 1, 0)).toBe(true);
        expect(insideRoom(0, 1, ROOM.halfDepth + 2)).toBe(false);
        expect(insideRoom(ROOM.halfWidth + 1, 1, 0)).toBe(false);
        expect(insideRoom(0, 30, 0)).toBe(false);
    });

    test("nothing of the outside shell stands in the room", () => {
        // the panel behind the door did; the walls and the roof do not
        expect(standsInRoom(0, 2.4, 4.4)).toBe(true);
        expect(standsInRoom(SHELL.halfWidth, 3, 0)).toBe(false);
        expect(standsInRoom(0, 3, SHELL.halfDepth)).toBe(false);
        expect(standsInRoom(0, 8, 0)).toBe(false);
    });
});
