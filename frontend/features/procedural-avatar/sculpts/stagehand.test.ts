import { Field, Shape } from "../kernel/sdf";
import { buildHumanoid } from "../humanoid/build";
import { STAGEHAND, stagehandSculpt } from "./stagehand";

/** Every primitive a shape is built from. */
function leaves(shape: Shape, out: Shape[] = []): Shape[] {
    if (shape instanceof Field) {
        for (const step of shape.steps) leaves(step.shape, out);
        return out;
    }
    const desc = shape.desc;
    if (desc && "source" in desc) return leaves(desc.source, out);
    out.push(shape);
    return out;
}

describe("the Stagehand sculpt", () => {
    const sculpt = stagehandSculpt();

    it("is made only of shapes a shader can rebuild", () => {
        for (const layer of sculpt.layers)
            for (const leaf of leaves(layer.shape))
                expect(leaf.desc).toBeDefined();
        for (const leaf of leaves(sculpt.hair.cap))
            expect(leaf.desc).toBeDefined();
    });

    it("keeps every layer inside the box the tracer skips to", () => {
        let seed = 7;
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (const layer of sculpt.layers) {
            let inside = 0;
            for (let i = 0; i < 40000; i++) {
                // Sample a margin round the box, where a leak would show.
                const p = [0, 1, 2].map(
                    (k) =>
                        layer.min[k] -
                        0.04 +
                        random() * (layer.max[k] - layer.min[k] + 0.08)
                );
                if (layer.shape.eval(p[0], p[1], p[2]) >= 0) continue;
                inside++;
                const escaped = [0, 1, 2].some(
                    (k) => p[k] < layer.min[k] || p[k] > layer.max[k]
                );
                if (escaped)
                    throw new Error(
                        `${layer.material} reaches ${p
                            .map((v) => v.toFixed(3))
                            .join(", ")}, outside its box`
                    );
            }
            expect(inside).toBeGreaterThan(0);
        }
    });

    it("stands on the floor at its stated height", () => {
        const solid = (y: number) => {
            for (let x = -0.24; x <= 0.24; x += 0.02)
                for (let z = -0.14; z <= 0.2; z += 0.02)
                    if (sculpt.layers.some((l) => l.shape.eval(x, y, z) < 0))
                        return true;
            return false;
        };
        expect(solid(-0.004)).toBe(false);
        expect(solid(0.006)).toBe(true);
        expect(solid(sculpt.height - 0.03)).toBe(true);
        expect(solid(sculpt.height + 0.01)).toBe(false);
    });

    it("lays hair in ribbons with a frame the strands can follow", () => {
        const length = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);
        const dot = (a: readonly number[], b: readonly number[]) =>
            a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        expect(sculpt.hair.segments.length).toBeGreaterThan(100);
        const locks = new Set<number>();
        sculpt.hair.segments.forEach((seg, i) => {
            locks.add(seg.lock);
            const axis = [0, 1, 2].map((k) => seg.b[k] - seg.a[k]);
            expect(length(axis)).toBeGreaterThan(0.001);
            for (const v of [
                seg.out,
                seg.outEnd,
                seg.ta,
                seg.tb,
                seg.sa,
                seg.sb,
            ])
                expect(length(v)).toBeCloseTo(1, 5);
            // The thin direction is square to the lock at both ends.
            for (const out of [seg.out, seg.outEnd])
                expect(Math.abs(dot(out, axis)) / length(axis)).toBeLessThan(
                    1e-6
                );
            expect(seg.flat).toBeGreaterThan(0);
            expect(seg.flat).toBeLessThanOrEqual(1);
            const next = sculpt.hair.segments[i + 1];
            if (next && next.lock === seg.lock) {
                // Pieces of a lock share their joint and its frame.
                for (let k = 0; k < 3; k++) {
                    expect(next.a[k]).toBeCloseTo(seg.b[k], 9);
                    expect(next.sa[k]).toBeCloseTo(seg.sb[k], 9);
                }
                // ...and lie flat the same way there, give or take the bend.
                expect(dot(next.out, seg.outEnd)).toBeGreaterThan(0.5);
            }
        });
        expect(locks.size).toBeGreaterThan(25);
    });

    it("is symmetrical where the character is", () => {
        const skin = sculpt.layers.find((l) => l.material === "skin");
        for (const [x, y, z] of [
            [0.03, 1.6, 0.09],
            [0.07, 1.63, 0.0],
            [0.8, 1.4, 0.0],
        ])
            expect(skin.shape.eval(-x, y, z)).toBeCloseTo(
                skin.shape.eval(x, y, z),
                6
            );
    });

    it("is whole under its clothes, and wears underwear without them", () => {
        const bare = stagehandSculpt({ dressed: false });
        expect(bare.layers.map((l) => l.material)).toEqual([
            "skin",
            "eye",
            "hair",
            "underwear",
        ]);
        const body = bare.layers[0].shape;
        // Chest, thigh, shin and the ball of the foot are all there...
        for (const [x, y, z] of [
            [0, 1.3, 0],
            [0.1, 0.75, 0],
            [0.125, 0.3, 0],
            [0.137, 0.02, 0.05],
        ])
            expect(body.eval(x, y, z)).toBeLessThan(0);
        // ...and it stands on the floor.
        expect(body.eval(0.137, -0.01, 0.0)).toBeGreaterThan(0);
        // The shorts cover the hips and stop above the knee.
        const shorts = bare.layers[3].shape;
        expect(shorts.eval(0.13, 0.95, 0.03)).toBeLessThan(0.004);
        expect(shorts.eval(0.115, 0.6, 0)).toBeGreaterThan(0.05);
        // Dressed, what the clothes hide is not there at all.
        const clothed = sculpt.layers[0].shape;
        expect(clothed.eval(0, 1.3, 0)).toBeGreaterThan(0);
        expect(clothed.eval(0.1, 0.75, 0)).toBeGreaterThan(0);
        // The neck and the hands still are.
        expect(clothed.eval(0, 1.5, 0)).toBeLessThan(0);
        expect(clothed.eval(0.76, 1.399, 0.003)).toBeLessThan(0);
    });

    it("builds a different figure from different measurements", () => {
        const taller = buildHumanoid({
            ...STAGEHAND,
            proportions: {
                ...STAGEHAND.proportions,
                lowerArm: [0.47, 1.404, -0.002],
                hand: [0.75, 1.399, 0.003],
            },
            build: { ...STAGEHAND.build, chest: [0.17, 0.11] },
        });
        const skin = taller.layers[0].shape;
        // The longer arm reaches where the reference one does not.
        expect(skin.eval(0.93, 1.399, 0.003)).toBeLessThan(0.01);
        expect(sculpt.layers[0].shape.eval(0.93, 1.399, 0.003)).toBeGreaterThan(
            0.02
        );
    });
});
