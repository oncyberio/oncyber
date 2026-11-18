import {
    addScaled,
    cross,
    normalize,
    perpendicular,
    scale,
    sub,
    type Vec3,
} from "./vec";

/** Linear RGB, 0..1. */
export type Rgb = [number, number, number];
/** Up to four `[bone index, weight]` pairs. */
export type Weights = [number, number][];
export type WeightFn = (point: Vec3) => Weights;

/** What the material paints on a surface, on top of its vertex colour. */
export const REGION = { plain: 0, face: 1, eye: 2 } as const;

export type VertexStyle = {
    color: Rgb;
    weights: Weights | WeightFn;
    /** 0..1 multiplier on the ink hull. Small features use less. */
    outline?: number;
    region?: number | ((point: Vec3) => number);
    /** Paint-space coordinates for `region` (face or eye space). */
    paint?: (point: Vec3) => [number, number];
};

export type Row = VertexStyle & {
    /** Closed loop, counter-clockwise seen from the direction the loft travels. */
    points: Vec3[];
    /** Paint coordinates per point, when they can't be derived from position. */
    paints?: [number, number][];
};

export type Cap = Vec3 | "center" | null;

export type ToonGeometry = {
    position: Float32Array;
    normal: Float32Array;
    color: Float32Array;
    skinIndex: Uint16Array;
    skinWeight: Float32Array;
    /** x, y: paint coordinates. z: region. w: ink hull scale. */
    paint: Float32Array;
    index: Uint32Array;
    min: Vec3;
    max: Vec3;
};

export function hexToLinear(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    const channel = (c: number) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return [
        channel((n >> 16) & 255),
        channel((n >> 8) & 255),
        channel(n & 255),
    ];
}

const sameColor = (a: Rgb, b: Rgb) =>
    a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * Collects skinned, vertex-coloured triangles for one avatar. Every part is a
 * closed shell so the ink hull (the mesh drawn again, pushed out along its
 * normals, back faces only) outlines it.
 */
export class MeshBuilder {
    private position: number[] = [];
    private color: number[] = [];
    private skinIndex: number[] = [];
    private skinWeight: number[] = [];
    private paint: number[] = [];
    private index: number[] = [];

    get vertexCount() {
        return this.position.length / 3;
    }

    get triangleCount() {
        return this.index.length / 3;
    }

    vertex(
        point: Vec3,
        style: VertexStyle,
        paintAt?: [number, number]
    ): number {
        const id = this.vertexCount;
        this.position.push(point[0], point[1], point[2]);
        this.color.push(style.color[0], style.color[1], style.color[2]);
        const weights =
            typeof style.weights === "function"
                ? style.weights(point)
                : style.weights;
        let total = 0;
        for (let i = 0; i < Math.min(4, weights.length); i++)
            total += weights[i][1];
        for (let i = 0; i < 4; i++) {
            const pair = i < weights.length ? weights[i] : null;
            this.skinIndex.push(pair ? pair[0] : 0);
            this.skinWeight.push(pair && total > 0 ? pair[1] / total : 0);
        }
        const [px, py] = paintAt || (style.paint ? style.paint(point) : [0, 0]);
        const region =
            typeof style.region === "function"
                ? style.region(point)
                : style.region ?? 0;
        this.paint.push(px, py, region, style.outline ?? 1);
        return id;
    }

    triangle(a: number, b: number, c: number) {
        this.index.push(a, b, c);
    }

    quad(a: number, b: number, c: number, d: number) {
        this.index.push(a, b, c, a, c, d);
    }

    private emitRow(row: Row, style: VertexStyle = row) {
        return row.points.map((point, i) =>
            this.vertex(point, style, row.paints?.[i])
        );
    }

    /**
     * Skins a surface over a series of loops. A row's colour covers the
     * surface from that row to the next, and rows that change colour are
     * split, so colours meet on a crisp edge instead of blending.
     */
    loft(rows: Row[], capStart: Cap = "center", capEnd: Cap = "center") {
        const n = rows[0].points.length;
        let previous: number[] | null = null;
        let first: number[] | null = null;
        for (let i = 0; i < rows.length - 1; i++) {
            const row = rows[i];
            const shared =
                previous && sameColor(rows[i - 1].color, row.color)
                    ? previous
                    : null;
            const bottom = shared || this.emitRow(row);
            // The far loop takes this segment's colour but its own skinning.
            const top = this.emitRow(rows[i + 1], {
                ...rows[i + 1],
                color: row.color,
            });
            if (!first) first = bottom;
            for (let j = 0; j < n; j++) {
                const k = (j + 1) % n;
                this.triangle(bottom[j], bottom[k], top[j]);
                this.triangle(bottom[k], top[k], top[j]);
            }
            previous = top;
        }
        if (!first || !previous) return { first: [], last: [] };
        if (capStart) {
            const row = rows[0];
            const apex = this.vertex(
                capStart === "center" ? centroid(row.points) : capStart,
                row
            );
            for (let j = 0; j < n; j++)
                this.triangle(apex, first[(j + 1) % n], first[j]);
        }
        if (capEnd) {
            const row = rows[rows.length - 1];
            const style = { ...row, color: rows[rows.length - 2].color };
            const apex = this.vertex(
                capEnd === "center" ? centroid(row.points) : capEnd,
                style
            );
            for (let j = 0; j < n; j++)
                this.triangle(apex, previous[j], previous[(j + 1) % n]);
        }
        return { first, last: previous };
    }

    /**
     * A thick open sheet (coat, hair curtain): each row gives the outer and
     * inner edge of a C-shaped cross-section, both running the same way.
     * The rims at both ends are closed so the ink hull wraps the sheet.
     */
    shell(rows: (VertexStyle & { outer: Vec3[]; inner: Vec3[] })[]) {
        const n = rows[0].outer.length;
        const { first, last } = this.loft(
            rows.map((row) => ({
                ...row,
                points: [...row.outer, ...row.inner.slice().reverse()],
            })),
            null,
            null
        );
        for (let j = 0; j < n - 1; j++) {
            const inner = 2 * n - 1 - j;
            this.quad(last[j], last[j + 1], last[inner - 1], last[inner]);
            this.quad(first[j], first[inner], first[inner - 1], first[j + 1]);
        }
    }

    /**
     * Finishes the mesh. Normals are averaged over every vertex that shares a
     * position, so the ink hull stays closed across colour splits.
     */
    build(): ToonGeometry {
        const count = this.vertexCount;
        const position = new Float32Array(this.position);
        const normal = new Float32Array(count * 3);
        const index = new Uint32Array(this.index);

        const welded = new Uint32Array(count);
        const seen = new Map<string, number>();
        for (let i = 0; i < count; i++) {
            const key =
                Math.round(position[i * 3] * 2e4) +
                "," +
                Math.round(position[i * 3 + 1] * 2e4) +
                "," +
                Math.round(position[i * 3 + 2] * 2e4);
            const found = seen.get(key);
            if (found === undefined) {
                seen.set(key, i);
                welded[i] = i;
            } else welded[i] = found;
        }

        const sum = new Float64Array(count * 3);
        for (let t = 0; t < index.length; t += 3) {
            const a = index[t] * 3;
            const b = index[t + 1] * 3;
            const c = index[t + 2] * 3;
            const abx = position[b] - position[a];
            const aby = position[b + 1] - position[a + 1];
            const abz = position[b + 2] - position[a + 2];
            const acx = position[c] - position[a];
            const acy = position[c + 1] - position[a + 1];
            const acz = position[c + 2] - position[a + 2];
            // Cross product length is twice the area: area-weighted normals.
            const nx = aby * acz - abz * acy;
            const ny = abz * acx - abx * acz;
            const nz = abx * acy - aby * acx;
            for (const corner of [index[t], index[t + 1], index[t + 2]]) {
                const w = welded[corner] * 3;
                sum[w] += nx;
                sum[w + 1] += ny;
                sum[w + 2] += nz;
            }
        }
        const min: Vec3 = [Infinity, Infinity, Infinity];
        const max: Vec3 = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < count; i++) {
            const w = welded[i] * 3;
            const l = Math.hypot(sum[w], sum[w + 1], sum[w + 2]) || 1;
            normal[i * 3] = sum[w] / l;
            normal[i * 3 + 1] = sum[w + 1] / l;
            normal[i * 3 + 2] = sum[w + 2] / l;
            for (let k = 0; k < 3; k++) {
                min[k] = Math.min(min[k], position[i * 3 + k]);
                max[k] = Math.max(max[k], position[i * 3 + k]);
            }
        }
        return {
            position,
            normal,
            color: new Float32Array(this.color),
            skinIndex: new Uint16Array(this.skinIndex),
            skinWeight: new Float32Array(this.skinWeight),
            paint: new Float32Array(this.paint),
            index,
            min,
            max,
        };
    }
}

function centroid(points: Vec3[]): Vec3 {
    const c: Vec3 = [0, 0, 0];
    for (const p of points) {
        c[0] += p[0];
        c[1] += p[1];
        c[2] += p[2];
    }
    return scale(c, 1 / points.length);
}

/**
 * Points of an ellipse (or squarer superellipse) around `center`. `u` cross `v`
 * must point the way the loft travels. `shape` scales the radius per angle.
 */
export function ellipse(
    center: Vec3,
    u: Vec3,
    v: Vec3,
    ru: number,
    rv: number,
    segments: number,
    power = 2,
    shape?: (angle: number) => number
): Vec3[] {
    const points: Vec3[] = [];
    for (let j = 0; j < segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        let c = Math.cos(angle);
        let s = Math.sin(angle);
        if (power !== 2) {
            const e = 2 / power;
            c = Math.sign(c) * Math.pow(Math.abs(c), e);
            s = Math.sign(s) * Math.pow(Math.abs(s), e);
        }
        const k = shape ? shape(angle) : 1;
        points.push(addScaled(addScaled(center, u, c * ru * k), v, s * rv * k));
    }
    return points;
}

export type Station = VertexStyle & {
    at: Vec3;
    /** Radius along the frame's side axis and its other axis. */
    ru: number;
    rv?: number;
    power?: number;
    shape?: (angle: number) => number;
};

export type TubeOptions = {
    segments?: number;
    /** Side axis hint for the cross-section; kept perpendicular to the path. */
    side?: Vec3;
    /** "round" adds a dome, "flat" a disc, "open" nothing. */
    start?: "round" | "flat" | "open";
    end?: "round" | "flat" | "open";
    /** Dome length as a multiple of the end radius. */
    bulge?: number;
};

/**
 * A tube through `stations`, with the cross-section carried along the path
 * without twisting. Limbs, fingers, hair strands and spikes are all tubes.
 */
export function tube(
    builder: MeshBuilder,
    stations: Station[],
    options: TubeOptions = {}
) {
    const {
        segments = 12,
        start = "round",
        end = "round",
        bulge = 1,
    } = options;
    const count = stations.length;
    const tangents: Vec3[] = stations.map((_, i) =>
        normalize(
            sub(
                stations[Math.min(count - 1, i + 1)].at,
                stations[Math.max(0, i - 1)].at
            )
        )
    );
    let side = options.side
        ? normalize(options.side)
        : perpendicular(tangents[0]);
    const rows: Row[] = [];
    const frames: { u: Vec3; v: Vec3 }[] = [];
    for (let i = 0; i < count; i++) {
        const t = tangents[i];
        // Re-project the side axis onto this station's cross-section plane.
        let v = cross(t, side);
        v = normalize(v);
        side = normalize(cross(v, t));
        // side x v = t, so loops run counter-clockwise seen from ahead.
        frames.push({ u: side, v });
    }
    const dome = (i: number, direction: 1 | -1) => {
        const station = stations[i];
        const { u, v } = frames[i];
        const reach = Math.min(station.ru, station.rv ?? station.ru) * bulge;
        const steps = [0.5, 0.86];
        const out: Row[] = steps.map((sine) => {
            const shrink = Math.sqrt(1 - sine * sine);
            return {
                ...station,
                points: ellipse(
                    addScaled(
                        station.at,
                        tangents[i],
                        direction * reach * sine
                    ),
                    u,
                    v,
                    station.ru * shrink,
                    (station.rv ?? station.ru) * shrink,
                    segments,
                    station.power,
                    station.shape
                ),
            };
        });
        const apex = addScaled(station.at, tangents[i], direction * reach);
        return { rows: direction === 1 ? out : out.reverse(), apex };
    };

    let capStart: Cap = start === "open" ? null : "center";
    let capEnd: Cap = end === "open" ? null : "center";
    if (start === "round") {
        const { rows: domeRows, apex } = dome(0, -1);
        rows.push(...domeRows);
        capStart = apex;
    }
    for (let i = 0; i < count; i++) {
        const station = stations[i];
        const { u, v } = frames[i];
        rows.push({
            ...station,
            points: ellipse(
                station.at,
                u,
                v,
                station.ru,
                station.rv ?? station.ru,
                segments,
                station.power,
                station.shape
            ),
        });
    }
    if (end === "round") {
        const { rows: domeRows, apex } = dome(count - 1, 1);
        // Dome rows continue the last station's colour.
        const last = stations[count - 1];
        if (count >= 2) rows[rows.length - 1].color = last.color;
        rows.push(...domeRows);
        capEnd = apex;
    }
    builder.loft(rows, capStart, capEnd);
}

export type BlobOptions = VertexStyle & {
    center: Vec3;
    radii: Vec3;
    /** Local axes; default world axes. */
    axes?: [Vec3, Vec3, Vec3];
    rings?: number;
    segments?: number;
    /** Reshapes each unit direction (in local axes) before scaling. */
    deform?: (direction: Vec3) => Vec3;
};

/** A deformable ellipsoid: heads of hair, hands, shoes, noses, buns. */
export function blob(builder: MeshBuilder, options: BlobOptions) {
    const {
        center,
        radii,
        axes = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
        rings = 8,
        segments = 12,
        deform,
    } = options;
    const place = (direction: Vec3): Vec3 => {
        const d = deform ? deform(direction) : direction;
        let p = center;
        for (let k = 0; k < 3; k++) p = addScaled(p, axes[k], d[k] * radii[k]);
        return p;
    };
    const rows: Row[] = [];
    for (let i = 1; i < rings; i++) {
        const latitude = -Math.PI / 2 + (i / rings) * Math.PI;
        const y = Math.sin(latitude);
        const r = Math.cos(latitude);
        const points: Vec3[] = [];
        for (let j = 0; j < segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            // z cross x = y: counter-clockwise seen from above.
            points.push(place([Math.sin(angle) * r, y, Math.cos(angle) * r]));
        }
        rows.push({ ...options, points });
    }
    builder.loft(rows, place([0, -1, 0]), place([0, 1, 0]));
}
