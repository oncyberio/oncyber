import * as T from "three/webgpu";
import { crewOpening, type CrewNeck } from "./styles";
import type { AvatarRecipe } from "./recipes";
import type { Character } from "./catalog";
import { cmPerPixel, drawingRig } from "./referenceProportions";
import { Sculpt, type Point } from "./sculpt";

export type XY = [number, number];
/** y, left and right silhouette, depth radius, depth of center. */
export type Section = [number, number, number, number, number?];
export type Depth = (x: number, y: number) => number;
export const level =
    (depth: number): Depth =>
    () =>
        depth;
export const lift =
    (surface: Depth, amount: number): Depth =>
    (x, y) =>
        surface(x, y) + amount;
/** Project pigment onto either side of a set of elliptical cross-sections. */
// Exponents of (1 - x²) and rear/front depth ratios measured at horizontal
// sections of the classic OBJ. Keep the illustration's own width, chin and eyes.
const cranialProfile = [
    [0, 0.5, 1.1],
    [0.1, 0.46, 1.23],
    [0.2, 0.39, 1.3],
    [0.28, 0.35, 1.36],
    [0.42, 0.72, 1.4],
    [0.6, 0.72, 1.22],
    [0.75, 0.49, 1.14],
    [0.89, 0.37, 1.32],
    [1, 0.53, 1.12],
];
export function headDepth(
    y: number,
    sections: Section[],
    side: number,
    cosSquared: number
) {
    const t = T.MathUtils.clamp(
        (y - sections[0][0]) / (sections.at(-1)[0] - sections[0][0]),
        0,
        1
    );
    let i = 1;
    while (i < cranialProfile.length - 1 && cranialProfile[i][0] < t) i++;
    const a = cranialProfile[i - 1],
        b = cranialProfile[i],
        w = (t - a[0]) / (b[0] - a[0]);
    const exponent = side > 0 ? T.MathUtils.lerp(a[1], b[1], w) : 0.5;
    const depth = side > 0 ? 1 : -T.MathUtils.lerp(a[2], b[2], w);
    return depth * Math.max(0, cosSquared) ** exponent;
}
/** Sample the same elliptical panel for fabric, edge binding and a sewn-on collar. */
export function sectionPoint(
    sections: Section[],
    angle: number,
    y: number,
    offset = 0
): Point {
    let k = 1;
    while (k < sections.length - 1 && y > sections[k][0]) k++;
    const lo = sections[k - 1],
        hi = sections[k],
        t = T.MathUtils.clamp((y - lo[0]) / (hi[0] - lo[0]), 0, 1);
    const read = (column: number) =>
        T.MathUtils.lerp(lo[column] ?? 0, hi[column] ?? 0, t);
    const left = read(1),
        right = read(2);
    return [
        (left + right) / 2 + ((right - left) / 2 + offset) * Math.sin(angle),
        y,
        read(4) + (read(3) + offset) * Math.cos(angle),
    ];
}

/** Front depth on the generated triangles, including non-elliptical cloth
 * and overlapping locks. A point outside the drawn panel has no hit. */
export function frontOfLoft(rows: Point[][]): Depth {
    const faces = rows
        .slice(1)
        .flatMap((row, i) =>
            row.slice(1).flatMap((e, j) => {
                const a = rows[i][j],
                    b = rows[i][j + 1],
                    c = row[j];
                return [
                    [a, b, c],
                    [b, c, e],
                ].map(([p, q, r]) => {
                    const ux = q[0] - p[0],
                        uy = q[1] - p[1],
                        vx = r[0] - p[0],
                        vy = r[1] - p[1];
                    return {
                        p,
                        ux,
                        uy,
                        vx,
                        vy,
                        det: ux * vy - uy * vx,
                        dz1: q[2] - p[2],
                        dz2: r[2] - p[2],
                        left: Math.min(p[0], q[0], r[0]),
                        right: Math.max(p[0], q[0], r[0]),
                        low: Math.min(p[1], q[1], r[1]),
                        high: Math.max(p[1], q[1], r[1]),
                    };
                });
            })
        )
        .filter((f) => Math.abs(f.det) > 1e-6);
    if (!faces.length) return () => -Infinity;
    // Most portrait features sample the same narrow horizontal strip. Keep
    // every overlapping triangle in that strip, including folded surfaces.
    const low = faces.reduce((v, f) => Math.min(v, f.low), Infinity);
    const high = faces.reduce((v, f) => Math.max(v, f.high), -Infinity);
    const count = Math.min(64, Math.ceil(Math.sqrt(faces.length)));
    const bin = (y: number) =>
        Math.max(
            0,
            Math.min(count - 1, Math.floor(((y - low) / (high - low)) * count))
        );
    const strips = Array.from({ length: count }, () => [] as typeof faces);
    for (const f of faces)
        for (let k = bin(f.low); k <= bin(f.high); k++) strips[k].push(f);
    return (x, y) => {
        if (y < low || y > high) return -Infinity;
        let best = -Infinity;
        for (const f of strips[bin(y)]) {
            if (x < f.left || x > f.right || y < f.low || y > f.high) continue;
            const { p, ux, uy, vx, vy, det, dz1, dz2 } = f;
            const dx = x - p[0],
                dy = y - p[1],
                u = (dx * vy - dy * vx) / det,
                v = (dy * ux - dx * uy) / det;
            if (u >= 0 && v >= 0 && u + v <= 1)
                best = Math.max(best, p[2] + u * dz1 + v * dz2);
        }
        return best;
    };
}
export function profileDepth(
    sections: Section[],
    direction = 1,
    skull = false
): Depth {
    return (x, y) => {
        let i = 1;
        while (i < sections.length - 1 && y > sections[i][0]) i++;
        const a = sections[i - 1],
            b = sections[i];
        const t = T.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
        const sample = (k: number) => T.MathUtils.lerp(a[k] ?? 0, b[k] ?? 0, t);
        const left = sample(1),
            right = sample(2);
        const nx = (2 * x - left - right) / Math.max(0.2, right - left);
        return (
            sample(4) +
            sample(3) *
                (skull
                    ? headDepth(y, sections, direction, 1 - nx * nx)
                    : direction * Math.sqrt(Math.max(0, 1 - nx * nx)))
        );
    };
}
export const ink = "#5d3b37";
export function ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    tilt = 0
): XY[] {
    return Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8,
            dx = rx * Math.cos(a),
            dy = ry * Math.sin(a);
        return [
            x + dx * Math.cos(tilt) - dy * Math.sin(tilt),
            y + dx * Math.sin(tilt) + dy * Math.cos(tilt),
        ];
    });
}
export function curve(
    points: XY[],
    closed: boolean,
    sharp: boolean,
    segments = Math.min(72, Math.max(6, points.length * 2))
) {
    if (sharp) return closed ? [...points, points[0]] : points;
    const spline = new T.CatmullRomCurve3(
        points.map(([x, y]) => new T.Vector3(x, y, 0)),
        closed,
        "catmullrom",
        0.34
    );
    return spline.getPoints(segments).map((v) => [v.x, v.y] as XY);
}

export class Drawing {
    readonly s = new Sculpt();
    portrait?: ReturnType<typeof import("./garmentPrint").portraitInk>;
    readonly rig: ReturnType<typeof drawingRig>;
    readonly sourceJoints: ReturnType<typeof drawingRig>["joints"];
    constructor(readonly id: Character, recipe?: AvatarRecipe) {
        this.rig = drawingRig(id, recipe, recipe?.layout);
        this.s.illustrationInk = id !== "sunshine" && id !== "rick-classic";
        if (id !== "sunshine")
            this.s.simplification = {
                error: 0.052,
                relative: 0.21,
                fraction: 0.26,
            };
        else
            this.s.simplification = {
                error: 0.032,
                relative: 0.143,
                fraction: 0.28,
            };
        this.sourceJoints =
            recipe && Object.keys(recipe).length > 1
                ? drawingRig(id, undefined, recipe.layout).joints
                : this.rig.joints;
        if (recipe && Object.keys(recipe).length > 1) {
            this.s.transform = this.rig.transform;
            this.s.colorsByPaint = recipe.palette ?? {};
        }
        const marks = this.rig.landmarks;
        const [jx, jy, jz] = marks.jaw,
            [nx, ny, nz] = marks.neck;
        this.s.skinShadows.push(
            {
                center: [jx, jy + 5, jz + 5],
                radii: [27, 12, 25],
                opacity: 0.23,
            },
            { center: [nx, ny - 5, nz + 5], radii: [21, 16, 23], opacity: 0.3 }
        );
        if (id === "sunshine") {
            this.s.skinShadows.push(
                { center: [351, 122, 42], radii: [59, 15, 35], opacity: 0.29 },
                { center: [298, 96, 3], radii: [12, 6, 38], opacity: 0.18 },
                { center: [405, 96, 3], radii: [12, 6, 38], opacity: 0.18 }
            );
        }
        for (const j of this.rig.joints.values())
            this.s.bone(j.name, j.parent, j.rest.toArray() as Point);
    }
    matrixFor(name: string) {
        const j = this.rig.joints.get(name);
        const m = new T.Matrix4()
            .makeTranslation(j.rest.x, j.rest.y, j.rest.z)
            .multiply(
                new T.Matrix4().makeRotationFromQuaternion(
                    j.orientation.clone().invert()
                )
            )
            .multiply(
                new T.Matrix4().makeScale(cmPerPixel, -cmPerPixel, cmPerPixel)
            )
            .multiply(
                new T.Matrix4().makeTranslation(
                    -j.point[0],
                    -j.point[1],
                    -j.point[2]
                )
            );
        return m;
    }
    bind(name: string) {
        this.s.drawingSpace(name, this.matrixFor(name));
        return this;
    }
    drape(upper: string, lower: string, start: number, end: number) {
        this.bind(upper);
        this.s.drape = {
            name: lower,
            matrix: this.matrixFor(lower),
            start,
            end,
        };
    }
    torso() {
        this.bind("hips");
        const { joints } = this.rig;
        this.s.torso(
            joints.get("hips").rest.y,
            joints.get("neck").rest.y - joints.get("hips").rest.y
        );
    }
    /** Connect nested paint contours with independent knot counts. The angular
     * knot ID lets the two sides share a seam even when the inner ring is sparse.
     * A collapsed ring has one vertex at its pole. */
    ringPatch(rings: number[][][], paint: string) {
        const triangles: Point[] = [];
        const point = (p: number[]) => p.slice(1) as Point;
        for (let level = 1; level < rings.length; level++) {
            const inner = rings[level - 1],
                outer = rings[level];
            let i = 0,
                j = 0;
            while (i < inner.length || j < outer.length) {
                const a = inner[i % inner.length],
                    b = outer[j % outer.length];
                const nextInner =
                    i === inner.length ? Infinity : inner[i + 1]?.[0] ?? 1;
                const nextOuter =
                    j === outer.length ? Infinity : outer[j + 1]?.[0] ?? 1;
                if (nextInner <= nextOuter) {
                    i++;
                    if (inner.length > 1)
                        triangles.push(
                            point(a),
                            point(b),
                            point(inner[i % inner.length])
                        );
                } else {
                    j++;
                    triangles.push(
                        point(a),
                        point(b),
                        point(outer[j % outer.length])
                    );
                }
            }
        }
        this.s.triangles(triangles, paint);
    }
    /** Closed relief with one continuous rim. Recipes may use depths measured
     * from an OBJ or sample an ellipsoidal scalp for a single-view drawing. */
    crown(
        center: XY,
        rim: XY[],
        steps: number[],
        depths: (column: number, row: number, front: boolean) => number,
        color: string
    ) {
        const order = rim.map((_, i) => i);
        const area = rim.reduce((v, [x, y], i) => {
            const next = rim[(i + 1) % rim.length];
            return v + x * next[1] - y * next[0];
        }, 0);
        if (area > 0) order.reverse();
        order.push(order[0]);
        const surface = (j: number, front: boolean) =>
            order.map(
                (i): Point => [
                    T.MathUtils.lerp(center[0], rim[i][0], steps[j]),
                    T.MathUtils.lerp(center[1], rim[i][1], steps[j]),
                    depths(i, j, front),
                ]
            );
        const near = steps.map((_, j) => surface(j, true));
        const rear = steps
            .slice(0, -1)
            .map((_, j) => surface(j, false))
            .reverse();
        this.s.surface([...near, ...rear], color, true);
    }
    lock(
        base: Point,
        tip: Point,
        width: number,
        thickness: number,
        paint: string
    ) {
        const axis = new T.Vector3(...tip)
            .sub(new T.Vector3(...base))
            .normalize();
        const across = new T.Vector3(-axis.y, axis.x, 0);
        if (across.lengthSq() < 0.01) across.set(1, 0, 0);
        across.normalize();
        const depth = new T.Vector3().crossVectors(axis, across).normalize();
        const sections = [
            [0, 1],
            [0.34, 0.72],
            [1, 0],
        ];
        const rows = sections.map(([t, r]) =>
            Array.from({ length: 7 }, (_, i): Point => {
                const a = (i * Math.PI) / 3;
                return new T.Vector3(...base)
                    .lerp(new T.Vector3(...tip), t)
                    .addScaledVector(across, Math.cos(a) * width * r)
                    .addScaledVector(depth, Math.sin(a) * thickness * r)
                    .toArray() as Point;
            })
        );
        this.s.surface(rows, paint, true);
    }
    fingers(side: string, color: string, radius: number) {
        for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
            const names = (
                finger === "Thumb"
                    ? ["Metacarpal", "Proximal", "Distal"]
                    : ["Proximal", "Intermediate", "Distal"]
            ).map((n) => side + finger + n);
            const points = names.map((n) => this.sourceJoints.get(n).point);
            const tip = points[2].map(
                (v, i) => v + 0.98 * (v - points[1][i])
            ) as Point;
            const r = radius * (finger === "Little" ? 0.77 : 1);
            this.bind(names[0]);
            this.s.sweep(
                [...points, tip],
                [r, r * 0.93, r * 0.83, 0],
                color,
                4,
                names
            );
        }
    }
    decal(path: XY[], depth: Depth, color: string, holes: XY[][] = []) {
        const contour = path.map((p) => new T.Vector2(...p)),
            cutouts = holes.map((r) => r.map((p) => new T.Vector2(...p)));
        const indices = T.ShapeUtils.triangulateShape(contour, cutouts),
            vertices = contour.concat(...cutouts),
            points: Point[] = [];
        function triangle(
            a: T.Vector2,
            b: T.Vector2,
            c: T.Vector2,
            level: number
        ) {
            const corners = [a, b, c],
                lengths = corners.map((p, i) =>
                    p.distanceToSquared(corners[(i + 1) % 3])
                );
            const i = lengths.indexOf(Math.max(...lengths)),
                u = corners[i],
                v = corners[(i + 1) % 3],
                w = corners[(i + 2) % 3],
                mid = u.clone().lerp(v, 0.5);
            if (
                level < 6 &&
                lengths[i] > 36 &&
                Math.abs(
                    depth(mid.x, mid.y) -
                        (depth(u.x, u.y) + depth(v.x, v.y)) * 0.5
                ) > 0.5
            ) {
                triangle(u, mid, w, level + 1);
                triangle(mid, v, w, level + 1);
            } else
                for (const p of corners)
                    points.push([p.x, p.y, depth(p.x, p.y)]);
        }
        for (const [a, b, c] of indices)
            triangle(vertices[a], vertices[b], vertices[c], 0);
        if (points.length) this.s.triangles(points, color);
    }
    stroke(path: XY[], surface: Depth, r: number, color = ink, sharp = false) {
        const points = curve(path, false, sharp).map(
            ([x, y]) => [x, y, surface(x, y)] as Point
        );
        this.s.ribbon(points, r, color);
    }
    /** Closed garment or hair shell between two variable-height hems. Evaluating
     * depth at every angular sample keeps curved paint and cloth on the body. */
    wrap(
        sections: Section[],
        top: (angle: number) => number,
        bottom: (angle: number) => number,
        color: string,
        offset: number,
        edges = true,
        stitch?: "start" | "end" | "both",
        stitchedSegments = 24
    ) {
        const count = stitch ? stitchedSegments : 48;
        const rows: Point[][] = [];
        for (let j = 0; j <= 12; j++) {
            rows.push(
                Array.from({ length: count + 1 }, (_, i): Point => {
                    const a = (i * 2 * Math.PI) / count,
                        t = j / 12,
                        y = T.MathUtils.lerp(top(a), bottom(a), t);
                    return sectionPoint(sections, a, y, offset);
                })
            );
        }
        const fabric = this.s.surface(rows, color, false, stitch);
        if (edges) {
            this.s.line(rows[0], 0.6, ink);
            this.s.line(rows[rows.length - 1], 0.67, ink);
        }
        return fabric;
    }
    crewUnderlayer(
        first: Section,
        neckline: CrewNeck,
        fabric: string,
        binding: string,
        skin: string
    ) {
        const join = crewOpening(
            first,
            { kind: "crew", width: 1, depth: 1, frontDrop: 0, backDrop: 0 },
            24
        );
        const raised: Section = [
            first[0] - neckline.frontDrop,
            ...first.slice(1),
        ] as Section;
        this.crewCollar(raised, join, neckline, fabric, binding, skin);
    }
    /** A crew neck has a closed elliptical opening and a lower front edge.
     * The binding, shoulder and recessed interior follow one contour. */
    crewCollar(
        first: Section,
        join: Point[],
        neckline: CrewNeck,
        fabric: string,
        binding: string,
        interior: string,
        center?: number,
        measuredBand?: { width: number; ink?: string }
    ) {
        const rim = crewOpening(first, neckline, join.length - 1, center);
        const outer = rim.map((p, i): Point => {
            if (!measuredBand)
                return p.map((v, k) =>
                    T.MathUtils.lerp(v, join[i][k], 0.19)
                ) as Point;
            const angle = (i * 2 * Math.PI) / (rim.length - 1);
            const width = measuredBand.width;
            return [
                p[0] + Math.sin(angle) * width,
                p[1] + Math.max(0, Math.cos(angle)) * width,
                p[2] + Math.cos(angle) * width * 0.7,
            ];
        });
        const inset = rim.map(
            ([x, y, z]): Point => [
                T.MathUtils.lerp(x, center ?? (first[1] + first[2]) / 2, 0.12),
                y + 1.5,
                T.MathUtils.lerp(z, first[4] ?? 0, 0.12),
            ]
        );
        const middle: Point = [
            center ?? (first[1] + first[2]) / 2,
            first[0] + neckline.frontDrop + 2,
            first[4] ?? 0,
        ];
        // The interior closes the neckline even on a floating-head mascot.
        this.s.surface([inset.map(() => middle), inset, rim], interior, true);
        if (measuredBand?.ink) {
            const ringAt = (t: number) =>
                rim.map(
                    (p, i) =>
                        p.map((v, k) =>
                            T.MathUtils.lerp(v, outer[i][k], t)
                        ) as Point
                );
            const inside = ringAt(0.11),
                outside = ringAt(0.89);
            this.s.surface([rim, inside], measuredBand.ink, false, "both");
            this.s.surface([inside, outside], binding, false, "both");
            this.s.surface([outside, outer], measuredBand.ink, false, "both");
        } else {
            this.s.surface([rim, outer], binding, false, "both");
        }
        this.s.surface([outer, join], fabric, false, "both");
    }
    /** Elliptical cross-sections put the same curvature under the facial features as on the head.
     * Return the front surface so painted seams and raised details remain seated in profile. */
    body(
        sections: Section[],
        color: string,
        edges = false,
        n = 28,
        caps: "both" | "start" | "end" | "none" = "both",
        hemTilt = 0,
        collar?: {
            neckline: CrewNeck;
            binding: string;
            interior: string;
            center?: number;
            bandWidth?: number;
        },
        drawFabric?: (emit: () => Point[][]) => void
    ): Depth {
        const ring = (row: Section) =>
            Array.from({ length: n + 1 }, (_, i): Point => {
                const [y, l, r, d, z = 0] = row,
                    a = (i * 2 * Math.PI) / n;
                return [
                    (l + r) / 2 + (r - l) * 0.5 * Math.sin(a),
                    y +
                        hemTilt *
                            Math.sin(a) *
                            ((y - sections[0][0]) /
                                (sections.at(-1)[0] - sections[0][0])) **
                                2,
                    z + d * Math.cos(a),
                ];
            });
        const rows = sections.map(ring);
        if (collar) {
            const uv = this.s.printUV;
            this.s.printUV = undefined;
            if (collar.bandWidth) {
                // A deep scoop can descend below the first chest ring. Seat
                // the cloth below the binding along each meridian so the
                // shoulder cannot fold back over the front of the collar.
                const rim = crewOpening(
                    sections[0],
                    collar.neckline,
                    n,
                    collar.center
                );
                for (let i = 0; i <= n; i++) {
                    const front = Math.max(0, Math.cos((2 * Math.PI * i) / n));
                    const edge = rim[i][1] + front * collar.bandWidth;
                    const join = rows[1][i][1];
                    const lift = edge + 1 - join;
                    if (lift <= 0) continue;
                    const end =
                        edge +
                        Math.max(
                            3,
                            collar.neckline.frontDrop + collar.bandWidth
                        );
                    for (const row of rows.slice(1)) {
                        const point = row[i];
                        if (point[1] >= end) break;
                        point[1] += (lift * (end - point[1])) / (end - join);
                    }
                }
            }
            this.crewCollar(
                sections[0],
                rows[1],
                collar.neckline,
                color,
                collar.binding,
                collar.interior,
                collar.center,
                collar.bandWidth && { width: collar.bandWidth }
            );
            this.s.printUV = uv;
            rows.shift();
        }
        const cap = (row: Section) =>
            Array.from(
                { length: n + 1 },
                (): Point => [(row[1] + row[2]) / 2, row[0], row[4] ?? 0]
            );
        const emit = () =>
            this.s.surface(
                [
                    ...(!collar && (caps === "both" || caps === "start")
                        ? [cap(sections[0])]
                        : []),
                    ...rows,
                    ...(caps === "both" || caps === "end"
                        ? [cap(sections[sections.length - 1])]
                        : []),
                ],
                color
            );
        if (drawFabric) drawFabric(emit);
        else emit();
        if (edges)
            for (const k of [1, 2]) {
                this.s.ribbon(
                    sections.map(
                        (r) => [r[k], r[0], (r[4] ?? 0) + 0.2] as Point
                    ),
                    0.69,
                    ink
                );
            }
        return profileDepth(sections);
    }
    /** Planar portrait ink covers only the front half. Both halves use the same
     * meridian points and a blank rear, so a turned head cannot mirror its face. */
    paintedHead(sections: Section[], color: string): Depth {
        const last = sections.at(-1);
        if (!this.portrait) {
            const rings = sections.map(([y, left, right, depth, center = 0]) =>
                Array.from({ length: 33 }, (_, i): Point => {
                    const a = ((i % 32) * 2 * Math.PI) / 32,
                        c = Math.cos(a);
                    return [
                        (left + right) / 2 + ((right - left) * Math.sin(a)) / 2,
                        y,
                        center +
                            headDepth(y, sections, c >= 0 ? 1 : -1, c * c) *
                                depth,
                    ];
                })
            );
            this.s.surface(rings, color, true);
            return profileDepth(sections, 1, true);
        }
        for (const front of [true, false]) {
            this.s.printUV =
                front && this.portrait
                    ? (x, y) => {
                          const [u, v] = this.portrait.uv(x, y);
                          return [u + 1, v];
                      }
                    : undefined;
            const rows = sections.map(([y, l, r, depth, cz = 0]) =>
                Array.from({ length: 19 }, (_, i): Point => {
                    const a =
                        (front ? -0.5 : 0.5) * Math.PI + (i * Math.PI) / 18;
                    return [
                        (l + r) / 2 + (Math.sin(a) * (r - l)) / 2,
                        y,
                        cz +
                            headDepth(
                                y,
                                sections,
                                front ? 1 : -1,
                                Math.cos(a) ** 2
                            ) *
                                depth,
                    ];
                })
            );
            const cap = (r: Section) =>
                rows[0].map((): Point => [(r[1] + r[2]) / 2, r[0], r[4] ?? 0]);
            this.s.preserveVertex = (x, y, z) =>
                sections.some(
                    (row) =>
                        Math.abs(row[0] - y) < 0.01 &&
                        Math.abs((row[4] ?? 0) - z) < 0.01
                );
            this.s.surface([cap(sections[0]), ...rows, cap(last)], color);
        }
        this.s.printUV = undefined;
        this.s.preserveVertex = undefined;
        return profileDepth(sections, 1, true);
    }
    /** A raised front with optional rounded rear. Points are the visible contour,
     * not a bitmap. Outer ink and attached marks use the same surface evaluator. */
    patch(
        path: XY[],
        center: XY,
        base: Depth,
        bulge: number,
        color: string,
        options: {
            edge?: number;
            sharp?: boolean;
            back?: number;
            ink?: string;
        } = {}
    ): Depth {
        let rim = curve(path, true, !!options.sharp);
        const area = rim
            .slice(1)
            .reduce(
                (sum, p, i) => sum + rim[i][0] * p[1] - rim[i][1] * p[0],
                0
            );
        if (area > 0) rim = rim.reverse();
        const ring = (r: number, h: number): Point[] =>
            rim.map((p) => {
                const x = center[0] + r * (p[0] - center[0]),
                    y = center[1] + r * (p[1] - center[1]);
                return [
                    x,
                    y,
                    base(x, y) + h * Math.sqrt(Math.max(0, 1 - r * r)),
                ];
            });
        const radii =
            this.s.detail === "crowd"
                ? [0, 0.62, 0.92, 1]
                : [0, 0.28, 0.53, 0.73, 0.86, 0.95, 1];
        this.s.surface(
            radii.map((r) => ring(r, bulge)),
            color,
            options.sharp
        );
        if (options.back)
            this.s.surface(
                [...radii].reverse().map((r) => ring(r, -options.back)),
                color,
                options.sharp
            );
        if (options.edge)
            this.s.ribbon(
                rim.map(([x, y]) => [x, y, base(x, y) + 0.15] as Point),
                options.edge,
                options.ink ?? ink
            );
        // Distance to the boundary along the ray from the patch center.
        return (x, y) => {
            const dx = x - center[0],
                dy = y - center[1];
            let t = Infinity;
            for (let i = 1; i < rim.length; i++) {
                const a = rim[i - 1],
                    b = rim[i],
                    ex = b[0] - a[0],
                    ey = b[1] - a[1],
                    det = dx * ey - dy * ex;
                if (Math.abs(det) < 1e-8) continue;
                const ax = a[0] - center[0],
                    ay = a[1] - center[1];
                const u = (ax * dy - ay * dx) / det,
                    k = (ax * ey - ay * ex) / det;
                if (u >= 0 && u <= 1 && k > 0) t = Math.min(t, k);
            }
            return base(x, y) + bulge * Math.sqrt(Math.max(0, 1 - 1 / (t * t)));
        };
    }
}
