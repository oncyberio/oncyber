import type { MeshBuilder, Rgb } from "./build";
import type { Vec3 } from "./sdf";

export interface SheetPoint {
    p: Vec3;
    colour: Rgb;
    /** Colour of the underside; defaults to a darker `colour`. */
    under?: Rgb;
    uv?: [number, number];
}

/**
 * A thin solid from a parametric surface: collars, ties, pockets, tabs.
 * `point(u, v)` is sampled on a `nu` by `nv` grid over [0, 1] squared; the
 * sheet gets a top face, an underside and a rim, `thickness` metres apart.
 * Pass `flip` if the surface's u-cross-v normal points the wrong way.
 */
export function sheet(
    out: MeshBuilder,
    nu: number,
    nv: number,
    point: (u: number, v: number) => SheetPoint,
    thickness: number,
    flip = false
) {
    const points: SheetPoint[] = [];
    for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++)
            points.push(point(i / (nu - 1), j / (nv - 1)));
    const at = (i: number, j: number) =>
        points[
            Math.min(nu - 1, Math.max(0, i)) +
                Math.min(nv - 1, Math.max(0, j)) * nu
        ].p;
    const normals: Vec3[] = [];
    for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++) {
            const a = at(i - 1, j);
            const b = at(i + 1, j);
            const c = at(i, j - 1);
            const d = at(i, j + 1);
            const ux = b[0] - a[0];
            const uy = b[1] - a[1];
            const uz = b[2] - a[2];
            const vx = d[0] - c[0];
            const vy = d[1] - c[1];
            const vz = d[2] - c[2];
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            const l = (Math.hypot(nx, ny, nz) || 1) * (flip ? -1 : 1);
            nx /= l;
            ny /= l;
            nz /= l;
            normals.push([nx, ny, nz]);
        }
    const half = thickness / 2;
    const top = out.count;
    points.forEach((pt, k) => {
        const n = normals[k];
        out.vertex(
            [
                pt.p[0] + n[0] * half,
                pt.p[1] + n[1] * half,
                pt.p[2] + n[2] * half,
            ],
            n,
            pt.colour,
            pt.uv ? pt.uv[0] : 0,
            pt.uv ? pt.uv[1] : 0
        );
    });
    const bottom = out.count;
    points.forEach((pt, k) => {
        const n = normals[k];
        const c = pt.under || [
            pt.colour[0] * 0.6,
            pt.colour[1] * 0.6,
            pt.colour[2] * 0.6,
        ];
        out.vertex(
            [
                pt.p[0] - n[0] * half,
                pt.p[1] - n[1] * half,
                pt.p[2] - n[2] * half,
            ],
            [-n[0], -n[1], -n[2]],
            c as Rgb,
            pt.uv ? pt.uv[0] : 0,
            pt.uv ? pt.uv[1] : 0
        );
    });
    const face = (base: number, reversed: boolean) => {
        for (let j = 0; j + 1 < nv; j++)
            for (let i = 0; i + 1 < nu; i++) {
                const a = base + i + j * nu;
                const b = a + 1;
                const c = a + nu + 1;
                const d = a + nu;
                if (reversed) out.quad(a, d, c, b);
                else out.quad(a, b, c, d);
            }
    };
    face(top, flip);
    face(bottom, !flip);
    // Rim: a strip joining the two faces along each border, with its own
    // vertices so the edge shades as an edge.
    const border: number[] = [];
    for (let i = 0; i < nu; i++) border.push(i);
    for (let j = 1; j < nv; j++) border.push(nu - 1 + j * nu);
    for (let i = nu - 2; i >= 0; i--) border.push(i + (nv - 1) * nu);
    for (let j = nv - 2; j >= 1; j--) border.push(j * nu);
    const rim = out.count;
    const m = border.length;
    border.forEach((k, e) => {
        const prev = points[border[(e + m - 1) % m]].p;
        const next = points[border[(e + 1) % m]].p;
        const n = normals[k];
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        const tz = next[2] - prev[2];
        // Outward: along the edge crossed with the face normal.
        let ox = ty * n[2] - tz * n[1];
        let oy = tz * n[0] - tx * n[2];
        let oz = tx * n[1] - ty * n[0];
        const l = (Math.hypot(ox, oy, oz) || 1) * (flip ? -1 : 1);
        ox /= l;
        oy /= l;
        oz /= l;
        const pt = points[k];
        const edge: Rgb = [
            pt.colour[0] * 0.8,
            pt.colour[1] * 0.8,
            pt.colour[2] * 0.8,
        ];
        const uv = pt.uv || [0, 0];
        out.vertex(
            [
                pt.p[0] + n[0] * half,
                pt.p[1] + n[1] * half,
                pt.p[2] + n[2] * half,
            ],
            [ox, oy, oz],
            edge,
            uv[0],
            uv[1]
        );
        out.vertex(
            [
                pt.p[0] - n[0] * half,
                pt.p[1] - n[1] * half,
                pt.p[2] - n[2] * half,
            ],
            [ox, oy, oz],
            edge,
            uv[0],
            uv[1]
        );
    });
    for (let e = 0; e < m; e++) {
        const a = rim + e * 2;
        const b = rim + ((e + 1) % m) * 2;
        if (flip) out.quad(a, b, b + 1, a + 1);
        else out.quad(a, a + 1, b + 1, b);
    }
}
