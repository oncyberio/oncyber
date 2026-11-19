import { MathUtils } from "three/webgpu";
import type { CartoonDesign } from "./cartoonCast";
import type { Depth, Drawing, XY } from "./drawing";
import { coveredSmileWidth } from "./fittedHead";
import type { Point } from "./sculpt";
import { creaseUVBase, frontalCreaseUVBase } from "./surfaces";

/** Lay both edges of the brush against the emitted cheek triangles. Sampling
 * just the centre cuts a straight chord through a convex nose or smiling cheek. */
export function skinCrease(
    d: Drawing,
    skin: string,
    face: Depth,
    points: (Point | XY)[],
    radius: number,
    inkCoordinate: (x: number) => number = () => 0.5,
    frontal = false
) {
    d.s.hasSkinCreases = true;
    const strip = points.map(([x, y], i) => {
        const a = points[Math.max(0, i - 1)],
            b = points[Math.min(i + 1, points.length - 1)];
        const dx = b[0] - a[0],
            dy = b[1] - a[1];
        const fx = face(x + 0.5, y) - face(x - 0.5, y),
            fy = face(x, y + 0.5) - face(x, y - 0.5);
        const dz = fx * dx + fy * dy;
        // Cross the 3D tangent with the surface normal. A drawing-plane
        // width alone stretches across the steep wing of a nose in profile.
        const bx = -fy * dz - dy,
            by = dx + fx * dz,
            bz = fy * dx - fx * dy;
        const scale = radius / Math.max(0.001, Math.hypot(bx, by, bz));
        return [-1, 1].map((side): Point => {
            const xx = x + side * bx * scale,
                yy = y + side * by * scale;
            return [xx, yy, face(xx, yy) + 0.89];
        });
    });
    const oldUV = d.s.printUV,
        oldNormal = d.s.surfaceNormal;
    d.s.surfaceNormal = (x, y) => [
        face(x - 0.5, y) - face(x + 0.5, y),
        face(x, y - 0.5) - face(x, y + 0.5),
        1,
    ];
    d.s.printUV = (x, _y, v) => [
        (frontal ? frontalCreaseUVBase : creaseUVBase) - 32 + inkCoordinate(x),
        v,
    ];
    d.s.surface(strip, skin, true, undefined, 0.13);
    d.s.printUV = oldUV;
    d.s.surfaceNormal = oldNormal;
}

function ordinate(points: XY[], x: number) {
    const hi = points.findIndex(([v]) => v >= x);
    if (hi < 0) return points.at(-1)[1];
    if (hi === 0) return points[0][1];
    const a = points[hi - 1],
        b = points[hi];
    return MathUtils.lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}

export function drawFittedSmile(
    d: Drawing,
    g: CartoonDesign,
    face: Depth,
    seam: Point[]
) {
    const { mouth, sideGuide: guide } = g.fit.sections;
    const profile = guide.mouthProfile,
        turn = guide.turnedMouth;
    const [left] = mouth.rows[0],
        [right] = mouth.rows.at(-1),
        mid = (left + right) / 2;
    if (!turn && guide.mouthCorner) {
        const half = (right - left) / 2;
        const widths = [
            coveredSmileWidth(g, -1, half),
            coveredSmileWidth(g, 1, half),
        ];
        for (const p of seam) {
            const dx = p[0] - mid;
            p[0] +=
                Math.sign(dx) *
                (widths[dx < 0 ? 0 : 1] - half) *
                MathUtils.smoothstep(Math.abs(dx) / half, 0, 1);
        }
    }
    if (profile) {
        for (const p of seam) p[1] = ordinate(profile, face(p[0], p[1]));
        if (turn) {
            const angle = MathUtils.degToRad(35),
                c = Math.cos(angle),
                s = Math.sin(angle);
            // Solve on the near cheek, where the frontal coordinate and depth
            // of the lip increase together toward the middle of the face.
            let lo = left - g.head[0] * 0.16,
                hi = mid;
            for (let i = 0; i < 14; i++) {
                const x = (lo + hi) / 2;
                if (c * x + s * face(x, profile[0][1]) < turn[0][0]) lo = x;
                else hi = x;
            }
            const shift = (hi + lo) / 2 - left;
            for (const p of seam) {
                p[0] += MathUtils.smoothstep(mid - p[0], 0, mid - left) * shift;
                const z = face(p[0], p[1]);
                // The far commissure is occluded in the turned drawing. Its
                // sagittal trace still describes the opposite half of the lip.
                const visible =
                    1 - MathUtils.smoothstep(p[0] - mid, 0, g.head[0] * 0.12);
                p[1] = MathUtils.lerp(
                    ordinate(profile, z),
                    ordinate(turn, c * p[0] + s * z),
                    0.75 * visible
                );
            }
        }
    } else if (guide.mouthCorner) {
        const lowest = Math.max(...seam.map((p) => p[1]));
        for (const p of seam) {
            const radius = p[0] < mid ? mid - seam[0][0] : seam.at(-1)[0] - mid;
            const u = Math.abs(p[0] - mid) / Math.max(1, radius);
            p[1] =
                lowest -
                guide.mouthCorner[1] * MathUtils.smoothstep(u, 0.24, 1);
        }
    }
    const start = seam[0][0],
        stop = seam.at(-1)[0];
    const coverage = (x: number) => {
        const u = MathUtils.clamp((x - left) / (right - left), 0, 1);
        // The source may ink the near lobe of the smile only. The portion past
        // its drawn endpoint becomes visible as that side turns toward the eye.
        const extent =
            x < left
                ? -MathUtils.smoothstep(
                      left - x,
                      0,
                      Math.max(2, left - start) * 0.8
                  )
                : MathUtils.smoothstep(
                      x - right,
                      0,
                      Math.max(2, stop - right) * 0.8
                  );
        return 0.22 + 0.56 * u + 0.212 * extent;
    };
    skinCrease(d, g.skin, face, seam, mouth.radius * 1.53, coverage);
    if (guide.mouthTick && profile) {
        const [dz, dy] = guide.mouthTick;
        for (const direction of [-1, 1]) {
            const p = direction < 0 ? seam[0] : seam.at(-1);
            const dx = Math.min(-dz, g.head[1] * 0.025) * direction;
            skinCrease(
                d,
                g.skin,
                face,
                [[p[0] + dx, p[1] + dy], p],
                mouth.radius * 1.1,
                coverage
            );
        }
    }
}

/** Invert an orthographic drawing onto the visible front triangles. Several
 * points on a projecting nose can coincide on screen. Keep the nearest hit. */
function projectNoseStroke(
    guide: XY[],
    face: Depth,
    center: (y: number) => number,
    width: number
) {
    const sin = Math.sin((35 * Math.PI) / 180),
        cos = Math.cos((35 * Math.PI) / 180);
    return guide.map(([u, y]): XY => {
        const x0 = center(y) - width * 2.7;
        const step = (width * 5.4) / 48;
        let result = center(y),
            nearest = -Infinity;
        let x = x0,
            z = face(x, y),
            prev = cos * x + sin * z;
        for (let j = 1; j <= 48; j++) {
            const next = x0 + step * j,
                nz = face(next, y);
            const current = cos * next + sin * nz;
            if ((u - prev) * (u - current) <= 0 && current !== prev) {
                const t = (u - prev) / (current - prev);
                const hit = MathUtils.lerp(x, next, t);
                const distance = cos * MathUtils.lerp(z, nz, t) - sin * hit;
                if (distance > nearest) {
                    nearest = distance;
                    result = hit;
                }
            }
            x = next;
            z = nz;
            prev = current;
        }
        return [result, y];
    });
}

export function drawNoseCrease(
    d: Drawing,
    g: CartoonDesign,
    face: Depth,
    stroke: XY[],
    radius: number,
    center: (y: number) => number,
    width: number
) {
    const guide = g.fit.sections.sideGuide;
    // A U-shaped underside seen from the front doesn't change handedness.
    const root = stroke[0],
        end = stroke.at(-1);
    const side = Math.sign(
        stroke.reduce((sum, [x]) => sum + x - (root[0] + end[0]) / 2, 0)
    );
    const height =
        Math.max(...stroke.map((p) => p[1])) -
        Math.min(...stroke.map((p) => p[1]));
    if (
        !side ||
        Math.abs(end[1] - root[1]) < height * 0.48 ||
        (!guide.inferred && !guide.frontalNoseInk)
    ) {
        skinCrease(
            d,
            g.skin,
            face,
            stroke,
            radius,
            undefined,
            guide.frontalNoseInk
        );
        return;
    }
    const alternate =
        guide.turnedNose && side < 0
            ? projectNoseStroke(guide.turnedNose, face, center, width)
            : stroke.map(([x, y]): XY => [2 * center(y) - x, y]);
    skinCrease(d, g.skin, face, stroke, radius, () => 0.5 + side * 0.34, true);
    skinCrease(
        d,
        g.skin,
        face,
        alternate,
        radius,
        () => 0.5 - side * 0.19,
        true
    );
}
