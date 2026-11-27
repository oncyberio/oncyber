import {
    TriangleTree,
    bakeCurvature,
    bakeDepth,
    bakeOpenness,
    bakeSkylight,
    boundaryLoops,
    hemisphere,
    neighbours,
    smoothOver,
    weld,
    type BakeSurface,
} from "./bake";

/** A flat square of `cells` by `cells` quads at height `y`, facing up or down. */
function sheet(
    size: number,
    cells: number,
    y: number,
    up = 1,
    hole?: (x: number, z: number) => boolean
): BakeSurface {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const row = cells + 1;
    for (let i = 0; i <= cells; i++)
        for (let j = 0; j <= cells; j++) {
            positions.push(
                (i / cells - 0.5) * size,
                y,
                (j / cells - 0.5) * size
            );
            normals.push(0, up, 0);
        }
    for (let i = 0; i < cells; i++)
        for (let j = 0; j < cells; j++) {
            const x = ((i + 0.5) / cells - 0.5) * size;
            const z = ((j + 0.5) / cells - 0.5) * size;
            if (hole?.(x, z)) continue;
            const a = i * row + j;
            indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
        }
    return {
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        indices: Uint32Array.from(indices),
    };
}

function join(...surfaces: BakeSurface[]): BakeSurface {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    for (const s of surfaces) {
        const base = positions.length / 3;
        positions.push(...s.positions);
        normals.push(...s.normals);
        for (const i of s.indices) indices.push(i + base);
    }
    return {
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        indices: Uint32Array.from(indices),
    };
}

/** A ball of triangles, its normals pointing out. */
function ball(radius: number, rings = 16): BakeSurface {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const around = rings * 2;
    for (let i = 0; i <= rings; i++)
        for (let j = 0; j < around; j++) {
            const polar = (i / rings) * Math.PI;
            const turn = (j / around) * Math.PI * 2;
            const n = [
                Math.sin(polar) * Math.cos(turn),
                Math.cos(polar),
                Math.sin(polar) * Math.sin(turn),
            ];
            positions.push(n[0] * radius, n[1] * radius, n[2] * radius);
            normals.push(...n);
        }
    for (let i = 0; i < rings; i++)
        for (let j = 0; j < around; j++) {
            const a = i * around + j;
            const b = i * around + ((j + 1) % around);
            indices.push(a, b, a + around, b, b + around, a + around);
        }
    return {
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        indices: Uint32Array.from(indices),
    };
}

/** The vertex of a sheet nearest its middle. */
const middle = (cells: number) => (cells / 2) * (cells + 1) + cells / 2;

describe("finding vertices that share a place", () => {
    it("joins vertices closer than the tolerance, whatever cell they fall in", () => {
        // 0.00004 and 0.00006 sit either side of a multiple of the tolerance.
        const welded = weld(
            Float32Array.from([0.00004, 0, 0, 0.00006, 0, 0, 0.001, 0, 0]),
            5e-5
        );
        expect(welded.count).toBe(2);
        expect(welded.of[0]).toBe(welded.of[1]);
        expect(welded.of[2]).not.toBe(welded.of[0]);
    });

    it("finds the rim of a hole and the outer edge, and nothing on a closed ball", () => {
        const holed = sheet(1, 6, 0, 1, (x, z) => Math.hypot(x, z) < 0.15);
        const loops = boundaryLoops(holed.indices, weld(holed.positions));
        expect(loops.map((l) => l.length).sort((a, b) => a - b)).toEqual([
            8, 24,
        ]);
        const round = ball(0.1, 8);
        expect(boundaryLoops(round.indices, weld(round.positions))).toEqual([]);
    });
});

describe("casting rays at triangles", () => {
    const floor = sheet(1, 8, 0);
    const tree = new TriangleTree(floor.positions, floor.indices);

    it("finds how far off the nearest triangle is, from either side", () => {
        expect(tree.cast(0.1, 0.3, 0.1, 0, -1, 0, 10)).toBeCloseTo(0.3, 6);
        expect(tree.cast(0.1, -0.2, -0.3, 0, 1, 0, 10)).toBeCloseTo(0.2, 6);
        const slant = Math.SQRT1_2;
        expect(tree.cast(0, 0.1, 0, slant, -slant, 0, 10)).toBeCloseTo(
            0.1 * Math.SQRT2,
            6
        );
    });

    it("hits along a ray that runs along an axis from the edge of a box", () => {
        // Straight down the seam between two rows of triangles.
        expect(tree.cast(0, 0.25, 0, 0, -1, 0, 10)).toBeCloseTo(0.25, 6);
        expect(tree.cast(0.125, 0.25, -0.125, 0, -1, 0, 10)).toBeCloseTo(
            0.25,
            6
        );
    });

    it("returns the limit when nothing is hit within it", () => {
        expect(tree.cast(0, 0.3, 0, 0, 1, 0, 10)).toBe(10);
        expect(tree.cast(2, 0.3, 0, 0, -1, 0, 10)).toBe(10);
        expect(tree.cast(0, 0.3, 0, 0, -1, 0, 0.2)).toBe(0.2);
    });
});

describe("what the skin knows about itself", () => {
    it("spreads its rays as a matte surface receives light", () => {
        const directions = hemisphere(256);
        let up = 0;
        for (let i = 0; i < 256; i++) {
            up += directions[i * 3 + 2] / 256;
            expect(
                Math.hypot(
                    directions[i * 3],
                    directions[i * 3 + 1],
                    directions[i * 3 + 2]
                )
            ).toBeCloseTo(1, 9);
        }
        expect(up).toBeCloseTo(2 / 3, 2);
    });

    it("is open on a bare floor and shut in under a low roof", () => {
        const cells = 8;
        const floor = sheet(0.4, cells, 0);
        const bare = bakeOpenness(
            floor,
            weld(floor.positions),
            new TriangleTree(floor.positions, floor.indices)
        );
        expect(bare[middle(cells)]).toBe(1);
        const roofed = join(floor, sheet(0.4, cells, 0.005, -1));
        const welded = weld(roofed.positions);
        const open = bakeOpenness(
            roofed,
            welded,
            new TriangleTree(roofed.positions, roofed.indices)
        );
        expect(open[welded.of[middle(cells)]]).toBeLessThan(0.25);
    });

    it("counts a floor as something that shades what stands on it", () => {
        const sole = sheet(0.1, 4, 0.004, -1);
        const welded = weld(sole.positions);
        const tree = new TriangleTree(sole.positions, sole.indices);
        const off = bakeOpenness(sole, welded, tree);
        const on = bakeOpenness(sole, welded, tree, { floor: 0 });
        expect(off[middle(4)]).toBe(1);
        expect(on[middle(4)]).toBeLessThan(0.2);
    });

    it("knows what stands between a place and the light from above", () => {
        const cells = 8;
        const floor = sheet(0.4, cells, 0);
        // A roof over one half only.
        const roof = sheet(0.4, cells, 0.05, -1, (x) => x > 0);
        const both = join(floor, roof);
        const welded = weld(both.positions);
        const sky = bakeSkylight(
            both,
            welded,
            new TriangleTree(both.positions, both.indices),
            [0, 1, 0]
        );
        const row = cells + 1;
        const under = welded.of[1 * row + cells / 2];
        const clear = welded.of[(cells - 1) * row + cells / 2];
        expect(sky[under]).toBeLessThan(0.15);
        expect(sky[clear]).toBeGreaterThan(0.85);
    });

    it("measures how sharply a surface turns", () => {
        const round = ball(0.05, 24);
        const welded = weld(round.positions);
        const curve = bakeCurvature(
            round,
            welded,
            neighbours(round.indices, welded)
        );
        // Away from the poles, where the triangles are even: 1 / radius.
        const equator = welded.of[12 * 48 + 5];
        expect(curve[equator]).toBeGreaterThan(18);
        expect(curve[equator]).toBeLessThan(22);
        const flat = sheet(1, 4, 0);
        const flatWeld = weld(flat.positions);
        expect(
            bakeCurvature(flat, flatWeld, neighbours(flat.indices, flatWeld))[
                middle(4)
            ]
        ).toBeCloseTo(0, 9);
    });

    it("measures how much flesh lies behind a place", () => {
        const depthOf = (thickness: number) => {
            const slab = join(sheet(1, 8, 0), sheet(1, 8, -thickness, -1));
            const welded = weld(slab.positions);
            return bakeDepth(
                slab,
                welded,
                new TriangleTree(slab.positions, slab.indices)
            )[welded.of[middle(8)]];
        };
        const thin = depthOf(0.004);
        const thick = depthOf(0.02);
        expect(thin).toBeGreaterThan(0.004);
        expect(thin).toBeLessThan(0.012);
        expect(thick).toBeGreaterThan(thin * 2.5);
    });

    it("evens a value out over the surface without changing its total much", () => {
        const flat = sheet(1, 4, 0);
        const welded = weld(flat.positions);
        const near = neighbours(flat.indices, welded);
        const spike = new Float32Array(welded.count);
        spike[middle(4)] = 1;
        const smooth = smoothOver(spike, near, 2);
        expect(smooth[middle(4)]).toBeLessThan(0.5);
        expect(smooth[middle(4) + 1]).toBeGreaterThan(0);
        expect(Math.max(...smooth)).toBe(smooth[middle(4)]);
    });
});
