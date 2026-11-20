import { SNAP_DISTANCE, poseBuffers, smoothPoses } from "./smoothing";

const pose = (x: number, y: number, z: number, q = [0, 0, 0, 1]) =>
    Float32Array.from([x, y, z, ...q]);

describe("smoothPoses", () => {
    it("shows a body where it is the first time it is heard about", () => {
        const shown = pose(0, 0, 0),
            known = Uint8Array.from([1]);
        smoothPoses(shown, pose(3, 1, -2), known, 1 / 60);
        expect(Array.from(shown.subarray(0, 3))).toEqual([3, 1, -2]);
        expect(known[0]).toBe(2);
    });

    it("leaves bodies it has never heard about alone", () => {
        const shown = pose(5, 5, 5);
        smoothPoses(shown, pose(0, 0, 0), Uint8Array.from([0]), 1);
        expect(Array.from(shown.subarray(0, 3))).toEqual([5, 5, 5]);
    });

    it("closes most of the gap within a tenth of a second, without overshooting", () => {
        const shown = pose(0, 0, 0),
            target = pose(1, 0, 0),
            known = Uint8Array.from([2]);
        let previous = 0;
        for (let frame = 0; frame < 6; frame++) {
            smoothPoses(shown, target, known, 1 / 60);
            expect(shown[0]).toBeGreaterThan(previous);
            expect(shown[0]).toBeLessThan(1);
            previous = shown[0];
        }
        expect(shown[0]).toBeGreaterThan(0.8);
    });

    it("jumps when the body was served somewhere else", () => {
        const shown = pose(0, 0, 0),
            known = Uint8Array.from([2]);
        smoothPoses(shown, pose(SNAP_DISTANCE + 0.5, 0, 0), known, 1 / 60);
        expect(shown[0]).toBeCloseTo(SNAP_DISTANCE + 0.5);
    });

    it("follows even a long move during a rewind", () => {
        const shown = pose(0, 0, 0),
            known = Uint8Array.from([2]);
        smoothPoses(shown, pose(10, 0, 0), known, 1 / 60, Infinity);
        expect(shown[0]).toBeGreaterThan(0);
        expect(shown[0]).toBeLessThan(5);
    });

    it("turns the short way and stays a unit rotation", () => {
        const s = Math.SQRT1_2;
        // The target is the same quarter turn, written with the opposite sign.
        const shown = pose(0, 0, 0, [0, s, 0, s]),
            target = pose(0, 0, 0, [0, -s, 0, -s]);
        smoothPoses(shown, target, Uint8Array.from([2]), 1 / 60);
        expect(shown[4]).toBeCloseTo(s);
        expect(shown[6]).toBeCloseTo(s);
        const quarter = pose(0, 0, 0);
        const known = Uint8Array.from([2]);
        for (let frame = 0; frame < 30; frame++)
            smoothPoses(quarter, pose(0, 0, 0, [0, s, 0, s]), known, 1 / 60);
        const length = Math.hypot(...Array.from(quarter.subarray(3, 7)));
        expect(length).toBeCloseTo(1);
        expect(quarter[4]).toBeCloseTo(s, 2);
    });
});

describe("poseBuffers", () => {
    it("starts empty for a new round", () => {
        const buffers = poseBuffers(3);
        expect(buffers.target.length).toBe(21);
        expect(Array.from(buffers.known)).toEqual([0, 0, 0]);
    });

    it("keeps shared things where they are drawn when the recipe changes", () => {
        const before = poseBuffers(2);
        before.shown.set([1, 2, 3, 0, 0, 0, 1], 0);
        before.target.set([1.1, 2, 3, 0, 0, 0, 1], 0);
        before.shown.set([4, 5, 6, 0, 0, 0, 1], 7);
        before.known.set([2, 2]);
        // One more thing: the first two stay, the third waits to be heard about.
        const grown = poseBuffers(3, before);
        expect(Array.from(grown.shown.subarray(0, 3))).toEqual([1, 2, 3]);
        expect(grown.target[0]).toBeCloseTo(1.1);
        expect(Array.from(grown.shown.subarray(7, 10))).toEqual([4, 5, 6]);
        expect(Array.from(grown.known)).toEqual([2, 2, 0]);
        // One fewer: the first is untouched.
        const shrunk = poseBuffers(1, before);
        expect(Array.from(shrunk.shown.subarray(0, 3))).toEqual([1, 2, 3]);
        expect(Array.from(shrunk.known)).toEqual([2]);
    });
});
