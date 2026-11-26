/** @jest-environment node */
import { Object3D } from "three";
import { applyTransform, createGlides, places } from "./glides";

const at = (object: Object3D) =>
    object.position.toArray().map((n) => Math.round(n * 1000) / 1000);

describe("where a thing is put", () => {
    test("at once: only what is given changes", () => {
        const object = new Object3D();
        object.scale.set(2, 2, 2);
        applyTransform(object, { position: [1, 2, 3], rotation: [0, 1, 0] });
        expect(at(object)).toEqual([1, 2, 3]);
        expect(object.rotation.y).toBe(1);
        expect(object.scale.toArray()).toEqual([2, 2, 2]);
        expect(places({ scale: [1, 1, 1] })).toBe(true);
        expect(places({})).toBe(false);
    });

    test("over a moment: it eases there and is then left alone", () => {
        const glides = createGlides();
        const object = new Object3D();
        glides.start("a", object, { position: [10, 0, 0] }, 1);
        expect(at(object)).toEqual([0, 0, 0]);
        glides.update(0.5);
        expect(at(object)).toEqual([5, 0, 0]);
        glides.update(0.25);
        // Slowing down as it arrives: more than three quarters of the way.
        expect(object.position.x).toBeGreaterThan(7.5);
        glides.update(1);
        expect(at(object)).toEqual([10, 0, 0]);
        // Done: later frames and moves are not the glide's.
        object.position.set(3, 0, 0);
        glides.update(1);
        expect(at(object)).toEqual([3, 0, 0]);
        expect(glides.aim("a", { position: [0, 0, 0] })).toBe(false);
    });

    test("a glide under way is aimed, not cut short", () => {
        const glides = createGlides();
        const object = new Object3D();
        glides.start("a", object, { position: [10, 0, 0] }, 1);
        glides.update(0.5);
        expect(
            glides.aim("a", { position: [0, 10, 0], scale: [2, 2, 2] })
        ).toBe(true);
        glides.update(1);
        expect(at(object)).toEqual([0, 10, 0]);
        expect(object.scale.toArray()).toEqual([2, 2, 2]);
    });

    test("a stopped glide moves nothing more", () => {
        const glides = createGlides();
        const object = new Object3D();
        glides.start("a", object, { position: [10, 0, 0] }, 1);
        glides.stop("a");
        glides.update(1);
        expect(at(object)).toEqual([0, 0, 0]);
    });
});
