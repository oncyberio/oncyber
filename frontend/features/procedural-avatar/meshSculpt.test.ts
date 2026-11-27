import { SCULPT_CELL, meshSculpt } from "./meshSculpt";
import { stagehandSculpt } from "./sculpts/stagehand";

describe("a sculpt cut into meshes", () => {
    // Coarse, to keep the test quick; the shapes are the same.
    const sculpt = stagehandSculpt();
    const layers = meshSculpt(sculpt, { coarseness: 4 });

    it("makes a closed, sensible mesh of every layer", () => {
        expect(layers.map((l) => l.material)).toEqual(
            sculpt.layers.map((l) => l.material)
        );
        for (const layer of layers) {
            const vertices = layer.positions.length / 3;
            expect(layer.indices.length).toBeGreaterThan(0);
            expect(layer.indices.length % 3).toBe(0);
            expect(layer.normals.length).toBe(layer.positions.length);
            for (const index of layer.indices)
                expect(index).toBeLessThan(vertices);
            for (let v = 0; v < vertices; v++) {
                const length = Math.hypot(
                    layer.normals[v * 3],
                    layer.normals[v * 3 + 1],
                    layer.normals[v * 3 + 2]
                );
                expect(length).toBeGreaterThan(0.99);
                expect(length).toBeLessThan(1.01);
            }
        }
    });

    it("keeps each mesh on the surface it was cut from", () => {
        layers.forEach((layer, i) => {
            const shape = sculpt.layers[i].shape;
            let worst = 0;
            for (let v = 0; v < layer.positions.length / 3; v++)
                worst = Math.max(
                    worst,
                    Math.abs(
                        shape.eval(
                            layer.positions[v * 3],
                            layer.positions[v * 3 + 1],
                            layer.positions[v * 3 + 2]
                        )
                    )
                );
            // Within a cell (and these are coarse cells) of the true
            // surface, even where a thin part is thinner than a cell.
            expect(worst).toBeLessThan(SCULPT_CELL[layer.material] * 4);
        });
    });

    it("stores how open each vertex is, darker in creases", () => {
        for (const layer of layers) {
            expect(layer.open.length).toBe(layer.positions.length / 3);
            let min = 1;
            let max = 0;
            for (const value of layer.open) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
            // Big surfaces have parts in the open and parts in creases;
            // an eye in its socket or a badge on a shirt may have neither.
            if (["skin", "cotton", "wool"].includes(layer.material))
                expect(max).toBeGreaterThan(0.9);
            if (layer.material === "skin" || layer.material === "hair")
                expect(min).toBeLessThan(0.6);
        }
    });

    it("tells each vertex of the hair which way its lock runs", () => {
        const hair = layers.find((l) => l.material === "hair");
        expect(hair.hair.length).toBe((hair.positions.length / 3) * 4);
        for (let v = 0; v < hair.positions.length / 3; v++) {
            const x = hair.hair[v * 4];
            const y = hair.hair[v * 4 + 1];
            // A unit direction with z folded away: x and y fit inside it.
            expect(x * x + y * y).toBeLessThanOrEqual(1.0001);
            const run = hair.hair[v * 4 + 3];
            const along = run >= 2 ? run - 2 : run;
            expect(along).toBeGreaterThanOrEqual(0);
            expect(along).toBeLessThanOrEqual(1);
        }
        for (const layer of layers)
            if (layer.material !== "hair") expect(layer.hair).toBeUndefined();
    });

    it("has fewer triangles the coarser it is asked for", () => {
        const count = (list: typeof layers) =>
            list.reduce((sum, l) => sum + l.indices.length / 3, 0);
        const coarser = meshSculpt(sculpt, { coarseness: 6 });
        expect(count(coarser)).toBeLessThan(count(layers) * 0.7);
    });
});
