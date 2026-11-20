import * as T from "three/webgpu";
import { drawStreetBrushFace } from "./streetBrushFace";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import type { StreetPattern } from "./streetwearPattern";

const mix = T.MathUtils.lerp;

/** The same closed skull carries the facial pigment at every camera angle.
 * Coordinates across the front are fractions of the measured jaw width. */
export function drawFittedStreetFace(d: Drawing, p: StreetPattern) {
    const fit = p.faceFit;
    const sampledSections = new Map<number, number[]>();
    const sections = fit.sections.map(([y, width, front, back]) => [
        y,
        width,
        front,
        back,
    ]);
    const section = (y: number): number[] => {
        const sampled = sampledSections.get(y);
        if (sampled) return sampled;
        const i = sections.findIndex((row) => row[0] >= y);
        if (i <= 0) return i === 0 ? sections[0] : sections.at(-1);
        const lo = sections[i - 1],
            hi = sections[i],
            t = (y - lo[0]) / (hi[0] - lo[0]);
        const row = [
            y,
            mix(lo[1], hi[1], t),
            mix(lo[2], hi[2], t),
            mix(lo[3], hi[3], t),
        ];
        sampledSections.set(y, row);
        return row;
    };
    const { width, depth, chin } = p.head;
    const height = (y: number) => chin - ((184 - y) * (chin - 51)) / 133;
    const sideDepth = (fore: number, back: number, y: number) =>
        mix(fore, back, 0.52 + 0.25 * T.MathUtils.smoothstep(y, 159, 175));
    const front = (u: number, y: number): Point => {
        const [, w, fore, back] = section(y),
            x = u * w;
        const side = sideDepth(fore, back, y);
        const nose =
            13.2 * Math.exp(-(((y - 149) / 7.3) ** 2)) +
            2.5 * Math.exp(-(((y - 141) / 12) ** 2));
        const curve = Math.pow(Math.max(0, 1 - u * u), 0.92);
        const bridge = nose * Math.exp(-((x / 5.9) ** 2));
        const ocular = Math.exp(
            -(((Math.abs(x) - 24) / 12.5) ** 2 + ((y - 132) / 7.6) ** 2)
        );
        const natural =
            side +
            (fore - nose - side) * curve +
            (bridge + ocular * 3.1) * curve;
        // Each measured frontal iris edge has a matching profile depth. Tuck
        // the medial white behind the cornea as the socket turns into profile.
        const last = fit.orbit.length - 1;
        const next = fit.orbit.findIndex((row) => row[0] >= y);
        const upperRow = fit.orbit[next < 0 ? last : next],
            lowerRow = fit.orbit[next < 0 ? last : Math.max(0, next - 1)];
        const t =
            upperRow === lowerRow
                ? 0
                : T.MathUtils.clamp(
                      (y - lowerRow[0]) / (upperRow[0] - lowerRow[0]),
                      0,
                      1
                  );
        const value = (k: 1 | 2 | 3 | 4 | 5 | 6) =>
            mix(lowerRow[k], upperRow[k], t);
        const inside = value(1),
            outside = value(2),
            near = value(3),
            far = value(4),
            corner = value(5);
        const lid = T.MathUtils.smoothstep(y, 126, 130);
        const lids = [
            [0, fore],
            [10.5, mix(55.4, near - 0.4, lid)],
            [inside, near],
            [outside, far],
            [corner, value(6)],
            [37.8, 33.6],
            [42, 23],
            [46, side],
        ];
        let col = 1;
        while (col < lids.length - 1 && lids[col][0] < Math.abs(x)) col++;
        const lo = lids[col - 1],
            hi = lids[col];
        const orb = mix(
            lo[1],
            hi[1],
            T.MathUtils.clamp((Math.abs(x) - lo[0]) / (hi[0] - lo[0]), 0, 1)
        );
        const lidBand =
            Math.exp(-(((y - 131.8) / 9.3) ** 4)) *
            T.MathUtils.smoothstep(1 - Math.abs(u), 0, 0.12);
        const z = mix(natural, orb, lidBand);
        const eyeBand =
            Math.exp(-(((y - 132) / 13) ** 2)) *
            Math.min(1, (1 - Math.abs(u)) * 5);
        const lateral =
            x +
            eyeBand *
                Math.sign(x) *
                (p.head.eyeGap - 48) *
                0.5 *
                Math.min(1, Math.abs(x) / 17);
        return [
            (lateral * width) / 48,
            height(y) + eyeBand * (p.head.eyeLine - 132),
            (z * depth) / 54,
        ];
    };
    if (fit.finish === "brush") {
        drawStreetBrushFace(d, p, front, section, height, sideDepth);
        return;
    }
    d.s.thinSkinOutline = true;
    d.s.sourcePaint = true;
    d.s.sculptedCartoon = false;
    d.s.fineDetail = true;
    // Dyes act on the sampled skin or iris independently of the lashes and highlights.
    const skin = new T.Color(p.colors.skin),
        eye = new T.Color(p.colors.iris);
    const baseSkin = new T.Color("#fdd8b6"),
        baseEye = new T.Color("#407999");
    const swatch = new T.Color();
    const pigment = (hex: number) => {
        const r = hex >> 16,
            g = (hex >> 8) & 255,
            b = hex & 255;
        const iris = b > r + 10 && b > g;
        const dyed = iris
            ? p.colors.iris !== "#407999"
            : r > g + 6 && g > b + 5 && p.colors.skin !== "#fdd8b6";
        if (!dyed) return hex;
        const dye = iris ? eye : skin,
            base = iris ? baseEye : baseSkin;
        swatch.setHex(hex);
        swatch.r = Math.min(1, (swatch.r * dye.r) / base.r);
        swatch.g = Math.min(1, (swatch.g * dye.g) / base.g);
        swatch.b = Math.min(1, (swatch.b * dye.b) / base.b);
        return swatch.getHex();
    };
    const points = fit.points.map(([u, v]) => front((u - 48) / 48, v + 51));
    const tangent = (a: Point, b: Point) =>
        new T.Vector3(...a).sub(new T.Vector3(...b));
    const normals = fit.points.map(([col, row]) => {
        const u = (col - 48) / 48,
            y = 51 + row;
        const across = tangent(
            front(Math.min(1, u + 0.035), y),
            front(Math.max(-1, u - 0.035), y)
        );
        const down = tangent(
            front(u, Math.min(184, y + 1.4)),
            front(u, Math.max(51, y - 1.4))
        );
        return across.cross(down).normalize().toArray() as Point;
    });
    const stations = new Set(fit.sections.map((row) => row[0]));
    const contour = fit.points.map(
        ([u, y]) => (u === 0 || u === 48 || u === 96) && stations.has(y + 51)
    );
    const jaw = fit.sections
        .filter((r) => r[0] >= 144)
        .map(([y, w]) => new T.Vector2(w, y));
    jaw.push(new T.Vector2(0, 184.3));
    const profile = fit.sections.map(([y, , fore]) => new T.Vector2(fore, y));
    // The profile continues behind the chin until it meets the neck.
    for (const [y, , , back] of fit.sections
        .filter((row) => row[0] >= 174)
        .reverse())
        profile.push(new T.Vector2(back, y));
    const nearest = (x: number, y: number, polyline: T.Vector2[]) => {
        let distance = 128;
        for (let i = 1; i < polyline.length; i++) {
            const a = polyline[i - 1],
                b = polyline[i],
                dx = b.x - a.x,
                dy = b.y - a.y;
            const t = T.MathUtils.clamp(
                ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy),
                0,
                1
            );
            distance = Math.min(
                distance,
                Math.hypot(x - a.x - t * dx, y - a.y - t * dy)
            );
        }
        return distance;
    };
    const outline = (x: number, y: number, z: number): [number, number] => {
        const row = 184 - ((chin - y) * 133) / (chin - 51);
        return [
            nearest((Math.abs(x) * 48) / width, row, jaw),
            nearest((z * 54) / depth, row, profile),
        ];
    };
    const distances = points.flatMap(([x, y, z]) => outline(x, y, z));
    d.s.fittedFaceSurface(
        points,
        fit.indices,
        fit.points.map(([, , c]) => pigment(c)),
        p.colors.skin,
        normals,
        contour,
        distances
    );
    d.s.fineDetail = false;
    const meridians = d.s.detail === "full" ? 5 : 4;
    const rear = fit.sections.map(([y, w, fore, back]) => {
        const side = sideDepth(fore, back, y);
        return Array.from({ length: meridians + 1 }, (_, i): Point => {
            if (i === 0 || i === meridians) return front(i === 0 ? 1 : -1, y);
            const a = (Math.PI * i) / meridians;
            return [
                (width / 48) * w * Math.cos(a),
                height(y),
                ((side + (back - side) * Math.sin(a)) * depth) / 54,
            ];
        });
    });
    d.s.thinSkinOutline = false;
    d.s.tone = (_x, y) => 1 - 0.23 * T.MathUtils.smoothstep(y, 159, 180);
    d.s.faceDistances = outline;
    d.s.surface(rear, p.colors.skin, false, "perimeter");
    for (const i of [0, rear.length - 1]) {
        const y = fit.sections[i][0];
        const frontRow = fit.points.flatMap(([, row], j) =>
            row === y - 51 ? [points[j]] : []
        );
        const ring = [...frontRow, ...rear[i].slice(1, -1)];
        const center: Point = [
            0,
            height(y) + (i === 0 ? -0.25 : 0.3),
            ring.reduce((sum, v) => sum + v[2], 0) / ring.length,
        ];
        d.s.triangles(
            ring.flatMap((p, j) => [center, p, ring[(j + 1) % ring.length]]),
            p.colors.skin
        );
    }
    d.s.faceDistances = undefined;
    d.s.tone = undefined;
}
