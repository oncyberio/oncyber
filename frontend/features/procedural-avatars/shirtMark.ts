import { ShapeUtils, Vector2 } from "three/webgpu";
import { frontOfLoft, type Drawing, type XY } from "./drawing";
import type { Point } from "./sculpt";
import families from "./families.json";

export type ShirtMark = { outline: XY[]; islands?: XY[][]; color: string };

/** Sutherland–Hodgman clipping in the drawing plane, retaining fabric depth. */
function clipToStamp(face: Point[], corners: Vector2[]) {
    const edge = (a: Vector2, b: Vector2, x: number, y: number) =>
        (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    const sign = Math.sign(
        edge(corners[0], corners[1], corners[2].x, corners[2].y)
    );
    let polygon = face;
    for (let k = 0; k < 3 && polygon.length; k++) {
        const a = corners[k],
            b = corners[(k + 1) % 3];
        const clipped: Point[] = [];
        for (let j = 0; j < polygon.length; j++) {
            const p = polygon[j],
                q = polygon[(j + 1) % polygon.length];
            const u = sign * edge(a, b, p[0], p[1]);
            const v = sign * edge(a, b, q[0], q[1]);
            if (u >= 0) clipped.push(p);
            if (u >= 0 !== v >= 0) {
                const t = u / (u - v);
                clipped.push(
                    p.map((value, n) => value + t * (q[n] - value)) as Point
                );
            }
        }
        polygon = clipped;
    }
    return polygon;
}

/** Cut the painted polygon at the fabric's triangle boundaries. A long print
 * crossing the round shirt would otherwise disappear inside it on a turn. */
export function drawMarkedShirt(
    d: Drawing,
    mark: ShirtMark,
    emit: () => Point[][],
    box: number[] = families[d.id as keyof typeof families].shirtBox
) {
    const [left, top, right, bottom] = box;
    const paths = [mark.outline, ...(mark.islands ?? [])].map((outline) =>
        outline.map(
            ([u, v]) =>
                new Vector2(left + u * (right - left), top + v * (bottom - top))
        )
    );
    const points = paths.flat();
    const stamp = paths.flatMap((path) =>
        ShapeUtils.triangulateShape(path, []).map((indices) =>
            indices.map((i) => path[i])
        )
    );
    const preserve = d.s.preserveVertex;
    const uv = d.s.printUV;
    const x0 = Math.min(...points.map((p) => p.x)) - (right - left) * 0.4;
    const x1 = Math.max(...points.map((p) => p.x)) + (right - left) * 0.4;
    const y0 = Math.min(...points.map((p) => p.y)) - (bottom - top) * 0.2;
    const y1 = Math.max(...points.map((p) => p.y)) + (bottom - top) * 0.2;
    d.s.preserveVertex = (x, y, z) =>
        (z >= 0 && x >= x0 && x <= x1 && y >= y0 && y <= y1) ||
        !!preserve?.(x, y, z);
    try {
        const rings = emit();
        const front = frontOfLoft(rings);
        const triangles: Point[] = [];
        for (let r = 1; r < rings.length; r++) {
            for (let i = 1; i < rings[r].length; i++) {
                const a = rings[r - 1][i - 1],
                    b = rings[r - 1][i],
                    c = rings[r][i - 1],
                    e = rings[r][i];
                for (const face of [
                    [a, b, c],
                    [b, c, e],
                ]) {
                    const [x, y, z] = [0, 1, 2].map(
                        (k) => (face[0][k] + face[1][k] + face[2][k]) / 3
                    );
                    if (Math.abs(front(x, y) - z) > 0.05) continue;
                    for (const triangle of stamp) {
                        const polygon = clipToStamp(face, triangle);
                        for (let j = 1; j + 1 < polygon.length; j++) {
                            const q = [polygon[0], polygon[j], polygon[j + 1]];
                            const area =
                                (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) -
                                (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
                            if (Math.abs(area) < 1e-5) continue;
                            for (const [px, py, pz] of q)
                                triangles.push([px, py, pz + 0.65]);
                        }
                    }
                }
            }
        }
        d.s.printUV = undefined;
        d.s.preserveVertex = () => true;
        if (triangles.length) d.s.triangles(triangles, mark.color);
        return rings;
    } finally {
        d.s.preserveVertex = preserve;
        d.s.printUV = uv;
    }
}
