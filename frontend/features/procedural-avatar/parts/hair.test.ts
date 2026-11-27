/** @jest-environment node */
import { field, sphere } from "../kernel/sdf";
import { Groom, P3, scatter } from "./hair";

const palette = { base: "#1d1a1b", sheen: "#6d7385", tip: "#3a2c28" };
const skull = () => field().add(sphere([0, 1.6, 0], 0.09));

function comb(seed: number) {
    const g = new Groom(skull(), palette, seed);
    const tie: P3 = [0, 1.55, -0.1];
    for (const direction of scatter(40, g.random)) {
        const root = g.cast([0, 1.6, 0], direction, 0.001);
        g.lock(
            g.flow(root, tie, () => 0.004, { wander: 0.3, over: true }),
            {
                width: 0.005,
                thickness: 0.002,
            }
        );
    }
    g.strays(20, [0.02, 0.05]);
    return g;
}

test("a groom is repeatable: the same seed grows the same hair", () => {
    const a = comb(7);
    const b = comb(7);
    const c = comb(8);
    expect(a.out.positions).toEqual(b.out.positions);
    expect(a.out.colors).toEqual(b.out.colors);
    expect(a.out.positions).not.toEqual(c.out.positions);
});

test("combed hair rides over the head and never dips inside it", () => {
    const g = comb(3);
    expect(g.paths.length).toBeGreaterThan(30);
    const head = skull();
    for (const path of g.paths)
        for (const p of path)
            expect(head.eval(p[0], p[1], p[2])).toBeGreaterThan(0.0015);
    // Roots at the front go over the top to the back, not down the face.
    const front = g.paths.filter((path) => path[0][2] > 0.06);
    expect(front.length).toBeGreaterThan(0);
    for (const path of front) {
        const lowestInFront = Math.min(
            ...path.filter((p) => p[2] > 0.03).map((p) => p[1])
        );
        expect(lowestInFront).toBeGreaterThan(path[0][1] - 0.02);
    }
});

test("locks taper to a point and carry unit normals", () => {
    const g = comb(5);
    const { positions, normals } = g.out;
    for (let i = 0; i < normals.length; i += 3) {
        const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
        expect(Math.abs(l - 1)).toBeLessThan(0.02);
        expect(Number.isFinite(positions[i])).toBe(true);
    }
});
