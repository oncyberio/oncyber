import {
    isSpawnInsideSpace,
    pickSpawnInsideSpace,
} from "./spaceBounds";

// The "Evolucion de sonic" white cube room.
const room = {
    min: { x: -41.1, y: -0.02, z: -16.4 },
    max: { x: 13.4, y: 12.4, z: 13.4 },
};

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
