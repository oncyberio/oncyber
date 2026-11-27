/** @jest-environment node */
import { Box3, Vector3 } from "three";
import { THING_SHAPES } from "../protocol";
import { geometryFor } from "./geometry";

const size = (geometry: ReturnType<typeof geometryFor>) => {
    geometry.computeBoundingBox();
    return (geometry.boundingBox as Box3)
        .getSize(new Vector3())
        .toArray()
        .map((n) => Math.round(n * 100) / 100);
};

describe("the geometry of a plain shape", () => {
    test("every plain shape a script may ask for has one", () => {
        const special = ["text", "model", "solid", "opening", "avatar"];
        for (const shape of THING_SHAPES.filter((s) => !special.includes(s))) {
            const geometry = geometryFor({ shape });
            expect(geometry.getAttribute("position").count).toBeGreaterThan(2);
        }
    });

    test("size is the box it fills: a diameter for round shapes", () => {
        expect(size(geometryFor({ shape: "box", size: [2, 3, 4] }))).toEqual([
            2, 3, 4,
        ]);
        expect(size(geometryFor({ shape: "sphere", size: [2, 2, 2] }))).toEqual(
            [2, 2, 2]
        );
        expect(
            size(geometryFor({ shape: "cylinder", size: [2, 5, 2] }))
        ).toEqual([2, 5, 2]);
        // A capsule's height includes its round ends.
        expect(
            size(geometryFor({ shape: "capsule", size: [1, 3, 1] }))[1]
        ).toBe(3);
    });

    test("no size is one metre, and no shape is a box", () => {
        expect(size(geometryFor({}))).toEqual([1, 1, 1]);
    });

    test("a lathe spins its profile; without one it is a plain cylinder", () => {
        expect(size(geometryFor({ shape: "lathe" }))).toEqual([1, 1, 1]);
        const vase = geometryFor({
            shape: "lathe",
            profile: [
                [0.1, 0],
                [0.4, 1],
            ],
        });
        expect(size(vase)).toEqual([0.8, 1, 0.8]);
    });

    test("an extrude gives its outline depth, centred; a star is one with points", () => {
        const slab = geometryFor({
            shape: "extrude",
            outline: [
                [0, 0],
                [2, 0],
                [2, 1],
                [0, 1],
            ],
            depth: 0.5,
            bevel: 0,
        });
        expect(size(slab)).toEqual([2, 1, 0.5]);
        slab.computeBoundingBox();
        expect(slab.boundingBox.min.z).toBeCloseTo(-0.25);
        const five = geometryFor({ shape: "star", bevel: 0 });
        const eight = geometryFor({ shape: "star", points: 8, bevel: 0 });
        expect(eight.getAttribute("position").count).toBeGreaterThan(
            five.getAttribute("position").count
        );
        // A star ignores an outline: it has its own.
        expect(
            size(geometryFor({ shape: "star", outline: [[9, 9]], bevel: 0 }))[0]
        ).toBeLessThan(1.01);
    });
});
