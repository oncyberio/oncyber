/** @jest-environment node */
import { meshField } from "./mesher";
import { capsule, field, sphere } from "./sdf";

const options = {
    min: [-0.15, -0.15, -0.15] as const,
    max: [0.15, 0.15, 0.15] as const,
    cell: 0.01,
};

test("a meshed sphere lies on the sphere, faces outwards and has no holes", () => {
    const mesh = meshField(sphere([0, 0, 0], 0.1), options);
    expect(mesh.positions.length).toBeGreaterThan(300);
    for (let i = 0; i < mesh.positions.length; i += 3) {
        const [x, y, z] = [
            mesh.positions[i],
            mesh.positions[i + 1],
            mesh.positions[i + 2],
        ];
        const r = Math.hypot(x, y, z);
        expect(Math.abs(r - 0.1)).toBeLessThan(0.0005);
        // The normal is the field's gradient: straight out from the centre.
        const dot =
            (mesh.normals[i] * x +
                mesh.normals[i + 1] * y +
                mesh.normals[i + 2] * z) /
            r;
        expect(dot).toBeGreaterThan(0.999);
    }
    // Watertight: every edge is used by exactly two triangles, in opposite
    // directions, and triangles wind to face outwards.
    const edges = new Map<string, number>();
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const t = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
        const p = t.map((v) => [
            mesh.positions[v * 3],
            mesh.positions[v * 3 + 1],
            mesh.positions[v * 3 + 2],
        ]);
        const u = p[1].map((v, k) => v - p[0][k]);
        const w = p[2].map((v, k) => v - p[0][k]);
        const n = [
            u[1] * w[2] - u[2] * w[1],
            u[2] * w[0] - u[0] * w[2],
            u[0] * w[1] - u[1] * w[0],
        ];
        expect(
            n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2]
        ).toBeGreaterThan(0);
        for (let k = 0; k < 3; k++) {
            const key = `${t[k]}>${t[(k + 1) % 3]}`;
            edges.set(key, (edges.get(key) || 0) + 1);
        }
    }
    for (const [key, count] of edges) {
        expect(count).toBe(1);
        const [a, b] = key.split(">");
        expect(edges.get(`${b}>${a}`)).toBe(1);
    }
});

test("pruning a field for a region never changes the surface it meshes", () => {
    // Many far-apart parts: most are pruned away in any one block.
    const shape = field();
    for (let i = 0; i < 12; i++)
        shape.add(
            capsule(
                [-0.1 + i * 0.018, -0.08, 0],
                [-0.1 + i * 0.018, 0.08, 0.02],
                0.012
            ),
            0.008
        );
    shape.carve(sphere([0, 0, 0.03], 0.03), 0.004);
    const unpruned = { eval: shape.eval };
    const a = meshField(shape, { ...options, cell: 0.006 });
    const b = meshField(unpruned, { ...options, cell: 0.006 });
    expect(a.indices.length).toBe(b.indices.length);
    expect(a.positions.length).toBe(b.positions.length);
    for (let i = 0; i < a.positions.length; i++)
        expect(a.positions[i]).toBeCloseTo(b.positions[i], 6);
});

test("keep leaves an open edge where another part takes over", () => {
    const whole = meshField(sphere([0, 0, 0], 0.1), options);
    const upper = meshField(sphere([0, 0, 0], 0.1), {
        ...options,
        keep: (_x, y) => y > 0,
    });
    expect(upper.indices.length).toBeLessThan(whole.indices.length * 0.6);
    for (let i = 1; i < upper.positions.length; i += 3)
        expect(upper.positions[i]).toBeGreaterThan(-0.011);
});

describe("shapes for sculpted hair and mirrored bodies", () => {
    const {
        ribbonCone,
        symmetric,
        torus,
        sphere: ball,
    } = jest.requireActual("./sdf") as typeof import("./sdf");

    it("flattens a ribbon along its thin direction only", () => {
        const ribbon = ribbonCone(
            [0, 0, 0],
            [0, 0, 0.1],
            0.02,
            0.02,
            [0, 1, 0],
            0.5
        );
        // Full width across, half of it through.
        expect(ribbon.eval(0.02, 0, 0.05)).toBeCloseTo(0, 6);
        expect(ribbon.eval(0, 0.01, 0.05)).toBeCloseTo(0, 6);
        expect(ribbon.eval(0, 0, 0.05)).toBeLessThan(0);
        // Away from it, the true gap along either axis: shadows and
        // occlusion rely on that.
        expect(ribbon.eval(0.05, 0, 0.05)).toBeCloseTo(0.03, 6);
        expect(ribbon.eval(0, 0.05, 0.05)).toBeCloseTo(0.04, 6);
        // Off the axes it is an estimate, within a few millimetres.
        const d = ribbon.eval(0.03, 0.03, 0.05);
        expect(d).toBeGreaterThan(0.02);
        expect(d).toBeLessThan(0.035);
    });

    it("twists a ribbon from one end to the other", () => {
        const ribbon = ribbonCone(
            [0, 0, 0],
            [0, 0, 0.1],
            0.02,
            0.02,
            [0, 1, 0],
            0.5,
            [1, 0, 0]
        );
        expect(ribbon.eval(0, 0.01, 0)).toBeCloseTo(0, 6);
        expect(ribbon.eval(0.01, 0, 0.1)).toBeCloseTo(0, 6);
    });

    it("mirrors a left half and rings a torus", () => {
        const pair = symmetric(ball([0.1, 0, 0], 0.02));
        expect(pair.eval(-0.1, 0, 0)).toBeCloseTo(-0.02, 9);
        expect(pair.eval(0.1, 0, 0)).toBeCloseTo(-0.02, 9);
        const ring = torus([0, 0, 0], 0.1, 0.01);
        expect(ring.eval(0.1, 0, 0)).toBeCloseTo(-0.01, 9);
        expect(ring.eval(0, 0, 0)).toBeCloseTo(0.09, 9);
        expect(ring.desc).toBeDefined();
    });
});
