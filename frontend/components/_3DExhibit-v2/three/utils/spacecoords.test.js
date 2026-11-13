import { headToFeet } from "./spacecoords";

describe("headToFeet", () => {
    test("turns a saved head height into the feet height", () => {
        expect(headToFeet({ x: -5.69, y: -1.06, z: -5 })).toEqual({
            x: -5.69,
            y: expect.closeTo(-3.86, 5),
            z: -5,
        });
    });

    test("a spawn without a height stands on the floor at 0", () => {
        expect(headToFeet({ x: 1, z: 2 })).toEqual({ x: 1, y: 0, z: 2 });
        expect(headToFeet(undefined)).toEqual({ x: 0, y: 0, z: 0 });
    });
});
