import {
    isOutsideSpace,
    isSpawnInsideSpace,
    pickSpawnInsideSpace,
    OUTSIDE_MARGIN,
    isRunawayStep,
} from "./spaceBounds";

// The "Evolucion de sonic" white cube room.
const room = {
    min: { x: -41.1, y: -0.02, z: -16.4 },
    max: { x: 13.4, y: 12.4, z: 13.4 },
};

describe("isOutsideSpace", () => {
    test("a player walking in the room is inside", () => {
        expect(isOutsideSpace({ x: 0, y: 0, z: 0 }, room, 2.3)).toBe(false);
        expect(isOutsideSpace({ x: 11.6, y: 0, z: -1.7 }, room, 2.3)).toBe(false);
    });

    test("a short hop past a wall or the roof is still inside", () => {
        expect(
            isOutsideSpace({ x: 13.4 + OUTSIDE_MARGIN - 1, y: 0, z: 0 }, room, 2.3)
        ).toBe(false);
        expect(isOutsideSpace({ x: 0, y: 20, z: 0 }, room, 2.3)).toBe(false);
    });

    test("a player kilometres behind the room is outside", () => {
        expect(isOutsideSpace({ x: 0, y: 18, z: 3040 }, room, 2.3)).toBe(true);
    });

    test("falling under the floor is outside, as before", () => {
        expect(isOutsideSpace({ x: 0, y: -12, z: 0 }, room, 2.3)).toBe(true);
        expect(isOutsideSpace({ x: 0, y: -10, z: 0 }, room, 2.3)).toBe(false);
    });

    test("a broken position is outside", () => {
        expect(isOutsideSpace({ x: NaN, y: 0, z: 0 }, room, 2.3)).toBe(true);
    });

    test("no bounds yet means no verdict", () => {
        expect(isOutsideSpace({ x: 0, y: 0, z: 3040 }, null, 2.3)).toBe(false);
        const empty = {
            min: { x: Infinity, y: Infinity, z: Infinity },
            max: { x: -Infinity, y: -Infinity, z: -Infinity },
        };
        expect(isOutsideSpace({ x: 0, y: 0, z: 3040 }, empty, 2.3)).toBe(false);
    });
});

describe("pickSpawnInsideSpace", () => {
    const link = { x: 0, y: 20.82, z: 3040.11, reference: "head" };
    const roomSpawn = { x: 2, y: 0, z: 4, reference: "head" };

    test("keeps link coords that are inside the room", () => {
        const inside = { x: -3.76, y: 2.7, z: 1.86, reference: "head" };
        expect(pickSpawnInsideSpace([inside, roomSpawn], room)).toBe(inside);
    });

    test("drops link coords outside the room for the room's spawn", () => {
        expect(isSpawnInsideSpace(link, room)).toBe(false);
        expect(pickSpawnInsideSpace([link, roomSpawn], room)).toBe(roomSpawn);
    });

    test("drops link coords floating far above the room", () => {
        const high = { x: 0, y: 40, z: 0, reference: "head" };
        expect(pickSpawnInsideSpace([high, roomSpawn], room)).toBe(roomSpawn);
    });

    test("falls back to the origin when nothing else fits", () => {
        expect(pickSpawnInsideSpace([link, undefined], room)).toEqual({
            x: 0,
            y: 0,
            z: 0,
            reference: "head",
        });
    });

    test("falls back to the middle of a space that does not cover the origin", () => {
        const away = {
            min: { x: 100, y: 0, z: 100 },
            max: { x: 120, y: 10, z: 140 },
        };
        expect(pickSpawnInsideSpace([link], away)).toEqual({
            x: 110,
            y: 0,
            z: 120,
            reference: "head",
        });
    });
});

describe("isRunawayStep", () => {
    const at = { x: 3, y: 0, z: -10 };

    test("walking, sprinting and collision pushes are real steps", () => {
        expect(isRunawayStep(at, { x: 3.4, y: 0, z: -10 }, 2.7)).toBe(false);
        expect(isRunawayStep(at, { x: 3, y: 2, z: -12.5 }, 2.7)).toBe(false);
    });

    test("a throw of tens of metres in one frame is not", () => {
        expect(isRunawayStep(at, { x: 40, y: 3, z: -30 }, 2.7)).toBe(true);
    });

    test("a tall avatar gets a longer allowance", () => {
        expect(isRunawayStep(at, { x: 10, y: 0, z: -10 }, 1.8)).toBe(true);
        expect(isRunawayStep(at, { x: 10, y: 0, z: -10 }, 4)).toBe(false);
    });

    test("a broken position is a runaway", () => {
        expect(isRunawayStep(at, { x: NaN, y: 0, z: 0 }, 2.7)).toBe(true);
    });
});
