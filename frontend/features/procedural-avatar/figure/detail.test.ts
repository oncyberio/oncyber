import { coarser, collapseOrder, type DetailInput } from "./detail";
import { NEVER, affordable, decodeCost, encodeCost } from "./format";

/** A square sheet of `n` by `n` vertices, a metre across, `lift`ed. */
function sheet(n: number, lift: (x: number, y: number) => number = () => 0) {
    const position = new Float32Array(n * n * 3);
    const indices: number[] = [];
    for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
            const [x, y] = [i / (n - 1), j / (n - 1)];
            position.set([x, y, lift(x, y)], (j * n + i) * 3);
            if (i === n - 1 || j === n - 1) continue;
            const a = j * n + i;
            indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
        }
    return { position, indices: Uint32Array.from(indices) };
}

/** A ball of the given radius: `rings` round it, `sides` to a ring. */
function ball(radius: number, rings = 10, sides = 14) {
    const position: number[] = [0, 0, radius];
    for (let r = 1; r < rings; r++)
        for (let s = 0; s < sides; s++) {
            const [polar, turn] = [
                (Math.PI * r) / rings,
                (2 * Math.PI * s) / sides,
            ];
            position.push(
                radius * Math.sin(polar) * Math.cos(turn),
                radius * Math.sin(polar) * Math.sin(turn),
                radius * Math.cos(polar)
            );
        }
    position.push(0, 0, -radius);
    const last = position.length / 3 - 1;
    const at = (r: number, s: number) => 1 + (r - 1) * sides + (s % sides);
    const indices: number[] = [];
    for (let s = 0; s < sides; s++) {
        indices.push(0, at(1, s), at(1, s + 1));
        indices.push(last, at(rings - 1, s + 1), at(rings - 1, s));
        for (let r = 1; r < rings - 1; r++)
            indices.push(
                at(r, s),
                at(r + 1, s),
                at(r, s + 1),
                at(r, s + 1),
                at(r + 1, s),
                at(r + 1, s + 1)
            );
    }
    return {
        position: Float32Array.from(position),
        indices: Uint32Array.from(indices),
    };
}

/** The triangles left for a view that can show nothing under `tolerance`. */
const left = (
    mesh: { indices: ArrayLike<number> },
    order: ReturnType<typeof collapseOrder>,
    tolerance: number
) => coarser(mesh.indices, order.parent, (v) => order.cost[v] <= tolerance);

describe("the order a mesh's vertices can go in", () => {
    it("lets a flat sheet go down to its corners for nothing", () => {
        const mesh = sheet(7);
        const order = collapseOrder(mesh);
        // Its corners hold its outline; nothing else is needed.
        const kept = left(mesh, order, 1e-7);
        expect(kept.length / 3).toBe(2);
        expect(new Set(kept)).toEqual(new Set([0, 6, 42, 48]));
        for (const corner of [0, 6, 42, 48])
            expect(order.cost[corner]).toBeGreaterThan(0.1);
    });

    it("keeps a bump until a view cannot show it", () => {
        // One vertex stands a centimetre off the sheet.
        const mesh = sheet(7);
        const peak = 3 * 7 + 3;
        mesh.position[peak * 3 + 2] = 0.01;
        const order = collapseOrder(mesh);
        expect(order.cost[peak]).toBeGreaterThan(0.004);
        expect(order.cost[peak]).toBeLessThan(0.0101);
        expect(left(mesh, order, 0.001)).toContain(peak);
        expect(left(mesh, order, 0.011)).not.toContain(peak);
    });

    it("never prices a vertex under one that went before it", () => {
        const mesh = ball(0.1);
        const order = collapseOrder(mesh);
        const count = mesh.position.length / 3;
        for (let v = 0; v < count; v++) {
            const into = order.parent[v];
            if (into === v) {
                expect(order.cost[v]).toBe(Infinity);
                continue;
            }
            // What it is folded into goes later, so costs no less.
            expect(order.cost[into]).toBeGreaterThanOrEqual(order.cost[v]);
        }
    });

    it("leaves a sound surface at every tolerance", () => {
        const mesh = ball(0.1);
        const order = collapseOrder(mesh);
        let before = Infinity;
        for (const tolerance of [0, 0.0005, 0.002, 0.005, 0.02, 0.05, 1]) {
            const kept = left(mesh, order, tolerance);
            expect(kept.length).toBeLessThanOrEqual(before);
            before = kept.length;
            const edges = new Map<string, number>();
            for (let t = 0; t < kept.length; t += 3) {
                const [a, b, c] = [kept[t], kept[t + 1], kept[t + 2]];
                // Only vertices that stay, three different ones.
                for (const v of [a, b, c])
                    expect(order.cost[v]).toBeGreaterThan(tolerance);
                expect(new Set([a, b, c]).size).toBe(3);
                // Still facing outwards.
                const p = (v: number, k: number) => mesh.position[v * 3 + k];
                const u = [0, 1, 2].map((k) => p(b, k) - p(a, k));
                const w = [0, 1, 2].map((k) => p(c, k) - p(a, k));
                const n = [
                    u[1] * w[2] - u[2] * w[1],
                    u[2] * w[0] - u[0] * w[2],
                    u[0] * w[1] - u[1] * w[0],
                ];
                expect(
                    n[0] * p(a, 0) + n[1] * p(a, 1) + n[2] * p(a, 2)
                ).toBeGreaterThan(0);
                for (const [from, to] of [
                    [a, b],
                    [b, c],
                    [c, a],
                ])
                    edges.set(
                        `${from} ${to}`,
                        (edges.get(`${from} ${to}`) || 0) + 1
                    );
            }
            // Closed: every edge is used once each way.
            for (const [edge, uses] of edges) {
                expect(uses).toBe(1);
                const [from, to] = edge.split(" ");
                expect(edges.get(`${to} ${from}`)).toBe(1);
            }
        }
        // The whole ball at first, and something of it to the last.
        expect(left(mesh, order, 0).length).toBe(mesh.indices.length);
        expect(before).toBeGreaterThanOrEqual(12);
        expect(before).toBeLessThan(mesh.indices.length / 8);
    });

    it("costs about what the surface moves by", () => {
        // Folding a ring of a ball away leaves chords for arcs: no vertex
        // goes for much less than a chord's sag, and half are gone by a
        // few times that.
        const radius = 0.1;
        const mesh = ball(radius, 16, 24);
        const order = collapseOrder(mesh);
        const sag = radius * (1 - Math.cos(Math.PI / 24));
        const costs = Array.from(order.cost).filter((c) => c < Infinity);
        expect(Math.min(...costs)).toBeGreaterThan(sag * 0.2);
        costs.sort((a, b) => a - b);
        expect(costs[Math.floor(costs.length / 2)]).toBeLessThan(sag * 12);
    });

    it("keeps what it is told to, and holds an outline", () => {
        const mesh = sheet(7);
        const middle = 3 * 7 + 3;
        const locked = new Uint8Array(49);
        locked[middle] = 1;
        const order = collapseOrder({ ...mesh, locked });
        expect(order.cost[middle]).toBe(Infinity);
        expect(order.parent[middle]).toBe(middle);
        expect(left(mesh, order, 1)).toContain(middle);
        // A notch in the outline: its vertex goes only along the edge,
        // and for what the outline then loses.
        const notched = sheet(7);
        notched.position[3 * 3 + 1] = 0.05;
        const outline = collapseOrder(notched);
        expect(outline.parent[3]).toBeLessThan(7);
        expect(outline.cost[3]).toBeGreaterThan(0.04);
    });

    it("counts a floor and a doubt for a vertex", () => {
        const mesh = sheet(7);
        mesh.position[(3 * 7 + 3) * 3 + 2] = 0.01;
        const plain = collapseOrder(mesh);
        const least = new Float32Array(49);
        least[10] = 0.02;
        const doubt = new Float32Array(49).fill(1);
        doubt[3 * 7 + 3] = 3;
        const order = collapseOrder({ ...mesh, least, doubt });
        expect(order.cost[10]).toBeGreaterThanOrEqual(Math.fround(0.02));
        expect(order.cost[3 * 7 + 3]).toBeGreaterThan(
            plain.cost[3 * 7 + 3] * 2
        );
    });

    it("counts what an expression would move apart", () => {
        // Flat at rest; one expression lifts a single vertex by 2 cm.
        const mesh = sheet(7);
        const lifted = 2 * 7 + 4;
        const morph = new Float32Array(49 * 3);
        morph[lifted * 3 + 2] = 0.02;
        const order = collapseOrder({ ...mesh, morphs: [morph] });
        expect(order.cost[lifted]).toBeGreaterThan(0.015);
        // Its neighbours can go, but not for nothing: the lift would
        // then spread over what they held.
        expect(order.cost[lifted + 1]).toBeGreaterThan(0.001);
        expect(collapseOrder(mesh).cost[lifted]).toBeLessThan(1e-6);
    });

    it("counts what a bending joint would move apart", () => {
        // A flat strip on two bones: the right half follows the second,
        // which turns about the strip's middle.
        const mesh = sheet(7);
        const input = (weightOf: (x: number) => number): DetailInput => ({
            ...mesh,
            skin: {
                joints: Float32Array.from({ length: 49 * 4 }, (_, i) =>
                    i % 4 === 1 ? 1 : 0
                ),
                weights: Float32Array.from({ length: 49 * 4 }, (_, i) => {
                    const second = weightOf(
                        mesh.position[Math.floor(i / 4) * 3]
                    );
                    return i % 4 === 0 ? 1 - second : i % 4 === 1 ? second : 0;
                }),
                parent: [-1, 0],
                pivot: [0, 0.5, 0, 0.5, 0.5, 0],
            },
        });
        // Weights that run evenly across cost nothing to thin out: the
        // sheet goes down to its corners.
        const even = collapseOrder(input((x) => x));
        expect(left(mesh, even, 1e-6).length / 3).toBe(2);
        // Weights that change all at once in the middle do. Along the
        // line of the change vertices can still go for nothing, but its
        // two ends on either edge are what keep the bend where it is.
        const sharp = collapseOrder(input((x) => (x > 0.55 ? 1 : 0)));
        const kept = new Set(left(mesh, sharp, 1e-6));
        for (const end of [3, 4, 6 * 7 + 3, 6 * 7 + 4]) {
            expect(kept.has(end)).toBe(true);
            expect(sharp.cost[end]).toBeGreaterThan(0.01);
        }
        expect(kept.size).toBe(8);
    });

    it("counts a change of shade over the patch it changes", () => {
        const mesh = sheet(7);
        const light = new Float32Array(49).fill(1);
        const dark = 3 * 7 + 3;
        light[dark] = 0;
        const order = collapseOrder({
            ...mesh,
            fields: [{ data: light, width: 1, shade: 1 }],
        });
        // Black to white over the patch round it, and that patch is
        // most of the sheet by the time it is the dark one's turn.
        expect(order.cost[dark]).toBeGreaterThan(0.2);
        expect(order.cost[dark]).toBeLessThan(0.75);
        // Without it the sheet is of one shade and goes for nothing.
        expect(collapseOrder(mesh).cost[dark]).toBeLessThan(1e-6);
        // Something drawn in another place counts as that distance.
        const placed = collapseOrder({
            ...mesh,
            fields: [{ data: light, width: 1, place: 0.003 }],
        });
        expect(placed.cost[dark]).toBeCloseTo(0.003, 4);
    });
});

describe("a cost as a file stores it", () => {
    it("is never stored as less than it is, and close above", () => {
        for (const metres of [1e-7, 2.5e-6, 0.00025, 0.001, 0.0123, 0.5, 30]) {
            const back = decodeCost(encodeCost(metres));
            expect(back).toBeGreaterThanOrEqual(metres * (1 - 1e-12));
            expect(back).toBeLessThan(metres * 1.0005);
        }
        expect(encodeCost(0)).toBe(0);
        expect(encodeCost(Infinity)).toBe(NEVER);
        expect(decodeCost(NEVER)).toBe(Infinity);
        // However dear, a vertex that can go is not mistaken for one
        // that never does.
        expect(encodeCost(1e9)).toBe(NEVER - 1);
    });

    it("is affordable to exactly the views that can do without it", () => {
        for (const metres of [3e-6, 0.0004, 0.002, 0.07]) {
            const stored = encodeCost(metres);
            expect(stored).toBeLessThanOrEqual(affordable(metres * 1.001));
            expect(stored).toBeGreaterThan(affordable(metres * 0.999));
        }
        expect(affordable(0)).toBe(-1);
        expect(affordable(1e12)).toBe(NEVER - 1);
    });
});
