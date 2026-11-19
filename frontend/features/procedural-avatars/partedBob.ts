import { MathUtils } from "three/webgpu";
import type { Depth, Drawing } from "./drawing";
import type { Point } from "./sculpt";

type Row = [number, number, number, number, number];

/** Registered left and right photographs can give different sagittal widths.
 * Both the lock and its supporting forehead share this depth estimate. */
export const forelockDepth = (tip: number, forehead: number) =>
    MathUtils.lerp(tip, forehead, 0.36);

type TempleRoll = [height: number, innerDepth: number, outerDepth: number];

/** Fit a closed, tapered forelock at the side of the drawn part. Its underside
 * meets the temple so background cannot show through on an oblique turn. */
export function drawMeasuredForelock(
    d: Drawing,
    roll: TempleRoll[],
    side: number,
    contour: Row[],
    width: number,
    height: number,
    top: number,
    eyeHeight: number,
    foreheadDepth: (y: number) => number,
    skinSurface: Depth,
    hairColor: string,
    skinColor: string,
    supportTemple = true
) {
    const eye = 12 + height * eyeHeight;
    const root = roll[0][0],
        tip = roll.at(-1)[0];
    const locks: Point[][] = [],
        scalp: Point[][] = [],
        returns: Point[][] = [];
    const stations = roll.filter(
        (_, i) => i % 3 === 0 || i === roll.length - 1
    );
    for (const [level, inner, outer] of stations) {
        const y = top + ((eye - top) * level) / eyeHeight;
        const next = contour.findIndex((row) => row[0] >= y);
        const hi = next < 0 ? contour.length - 1 : Math.max(1, next);
        const a = contour[hi - 1],
            b = contour[hi];
        const t = MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
        const edge = side < 0 ? 3 : 4;
        const edgeX = MathUtils.lerp(a[edge], b[edge], t);
        const progress = (level - root) / (tip - root);
        const radiusX =
            width * 0.058 * Math.sqrt(Math.max(0, 1 - progress * progress));
        const front = forelockDepth(outer, foreheadDepth(y));
        const back = Math.min(inner, front);
        const centerX = edgeX + side * radiusX * 0.12;
        const centerZ = (back + front) / 2;
        locks.push(
            Array.from({ length: 9 }, (_, i): Point => {
                const angle = ((i % 8) * Math.PI) / 4;
                return [
                    centerX + radiusX * Math.sin(angle),
                    y,
                    centerZ + (front - back) * 0.5 * Math.cos(angle),
                ];
            })
        );
        const skin: Point = [edgeX, y, skinSurface(edgeX, y) - 0.5];
        const hair: Point = [
            centerX - side * radiusX * 0.48,
            y,
            back + (front - back) * 0.18,
        ];
        const seam = skin.map((v, k) =>
            MathUtils.lerp(v, hair[k], 0.62)
        ) as Point;
        scalp.push([skin, seam]);
        returns.push([seam, hair]);
    }
    const pole = (ring: Point[], dy: number) =>
        ring.map(
            (): Point => [
                (ring[0][0] + ring[4][0]) / 2,
                ring[0][1] + dy,
                (ring[0][2] + ring[4][2]) / 2,
            ]
        );
    const last = locks.at(-1);
    locks.unshift(
        locks[0].map(
            ([x, y, z]): Point => [x, y - height * 0.04, z - height * 0.025]
        )
    );
    locks.unshift(pole(locks[0], -height * 0.045));
    locks.push(pole(last, height * 0.016));
    const tone = d.s.tone;
    d.s.tone = undefined;
    if (supportTemple) d.s.surface(scalp, skinColor, true, undefined, 0.35);
    d.s.tone = tone;
    if (supportTemple) d.s.surface(returns, hairColor, true, undefined, 0.35);
    d.s.surface(locks, hairColor, true, undefined, 0.3);
}

/** Sample both shoulders and the bottom of a real notch in the drawn crown. */
export function partStations(profile: Row[], part: Point) {
    const [, y, depth] = part;
    const extra = [y - depth * 0.8, y, y + depth * 0.7].flatMap((height) => {
        const i = profile.findIndex((row) => row[0] > height);
        if (i <= 0 || profile.some((row) => Math.abs(row[0] - height) < 0.35))
            return [];
        const a = profile[i - 1],
            b = profile[i],
            u = (height - a[0]) / (b[0] - a[0]);
        return [a.map((v, k) => MathUtils.lerp(v, b[k], u)) as Row];
    });
    return [...profile, ...extra].sort((a, b) => a[0] - b[0]);
}

/** A rounded vault opens rapidly just below the pole. Interpolate its area
 * between the first measured heights so the side view doesn't form a cone. */
export function crownStations(profile: Row[]) {
    const [a, b] = profile;
    if (!b || b[0] - a[0] < 2) return profile;
    const extra = [0.22, 0.56].map((u) => {
        const row = a.map((v, j) => MathUtils.lerp(v, b[j], u)) as Row;
        const mid = (row[1] + row[2]) / 2;
        const radius = Math.sqrt(
            MathUtils.lerp(
                ((a[2] - a[1]) / 2) ** 2,
                ((b[2] - b[1]) / 2) ** 2,
                u
            )
        );
        row[1] = mid - radius;
        row[2] = mid + radius;
        return row;
    });
    return [a, ...extra, ...profile.slice(1)];
}

/** Follow the side part over the vault. Both layers of the existing shell
 * share the fold and its roots. */
export function partBob(
    profile: Row[],
    outer: Point[][],
    inner: Point[][],
    part: Point,
    templeColumn: number,
    headWidth: number
) {
    const [notchX, notchY, measuredDepth] = part;
    const open = profile.find((row) => row[4] - row[3] > headWidth * 0.02);
    if (!open) return;
    const side = Math.sign(notchX - (open[3] + open[4]) / 2);
    const top = profile[0][0];
    const end = Math.min(
        profile.at(-1)[0],
        Math.max(open[0], notchY) + headWidth * 0.24
    );
    if (!side || notchY <= top + 1 || notchY >= end - 1) return;
    const depth = Math.min(measuredDepth, headWidth * 0.075);
    const rimIndex = profile.findIndex((row) => row[0] >= notchY - 0.35);
    if (rimIndex < 0) return;
    const border = side > 0 ? profile[rimIndex][2] : profile[rimIndex][1];
    const indent = MathUtils.clamp(
        side * (border - notchX),
        depth * 0.45,
        depth * 1.35
    );
    const pigment = new Map<string, number>();
    const stamp = (p: Point) => p.map(Math.fround).join("/");
    for (const sheet of [outer, inner]) {
        const source = sheet.map((row) => row.map((p) => [...p] as Point));
        sheet.forEach((row, i) => {
            const y = profile[i][0];
            if (y <= top || y >= end) return;
            row.forEach((p, j) => {
                const steps = side > 0 ? j : row.length - 1 - j;
                const u = steps / templeColumn;
                const weight =
                    MathUtils.smoothstep(u, 0, 0.35) *
                    (1 - MathUtils.smoothstep(u, 1.04, 1.86));
                if (!weight) return;
                const progress = Math.min(1, u);
                const path =
                    MathUtils.lerp(open[0], notchY, progress) -
                    depth * 1.6 * Math.sin(progress * Math.PI);
                const blend =
                    y < notchY
                        ? (y - top) / (notchY - top)
                        : (end - y) / (end - notchY);
                const level = y + (path - notchY) * blend * weight;
                const hi = profile.findIndex((r) => r[0] >= level);
                if (hi < 1) return;
                const a = source[hi - 1][j],
                    b = source[hi][j];
                const t = (level - a[1]) / (b[1] - a[1]);
                const distance = (y - notchY) / depth;
                const valley = Math.exp(
                    -((distance / (distance < 0 ? 0.56 : 0.88)) ** 2)
                );
                p[0] =
                    MathUtils.lerp(a[0], b[0], t) -
                    side * weight * valley * indent;
                p[1] = level;
                p[2] = MathUtils.lerp(a[2], b[2], t);
                if (sheet === outer && valley * weight > 0.015)
                    pigment.set(stamp(p), 1 - 0.45 * weight * valley);
            });
        });
    }
    return (x: number, y: number, z: number) =>
        pigment.get([x, y, z].join("/")) ?? 1;
}

/** A short, swept lock emerges from the crown and turns across the forehead.
 * Limit its depth against the emitted face and the adjacent oblique silhouette
 * so it never becomes a detached blade beside the head. */
export function sweptForelock(
    profile: Row[],
    outer: Point[][],
    part: Point,
    head: [number, number],
    eyeHeight: number,
    evidence: "turned" | "covered-brow" | "front",
    depthScale: number,
    face: Depth
) {
    const [w, h] = head;
    // A fitted oblique silhouette bounds a small overhang. With only an
    // estimated hull the lock tucks into the forehead at its far edge.
    const clearance = w * (evidence === "turned" ? 0.048 : -0.016);
    const split = profile.find((row) => row[4] - row[3] > w * 0.02);
    if (!split) return;
    const side = Math.sign(part[0] - (split[3] + split[4]) / 2);
    const start = Math.min(part[1], split[0]) - h * 0.065;
    const end = 12 + h * (eyeHeight - 0.11);
    const stations = profile
        .map((row, i) => ({ row, ring: outer[i] }))
        .filter(({ row }) => row[0] >= start && row[0] <= end)
        .filter(
            (_, i, rows) => i === 0 || i === rows.length - 1 || i % 2 === 1
        );
    if (!side || stations.length < 4) return;
    const top = stations[0].row[0],
        length = stations.at(-1).row[0] - top;
    const angle = MathUtils.degToRad(35),
        c = Math.cos(angle),
        s = Math.sin(angle);
    const rings: Point[][] = [];
    const obliqueSupports: number[] = [];
    for (const { row, ring } of stations) {
        const [y, , , left, right] = row;
        const t = (y - top) / length;
        const root = side > 0 ? ring[0] : ring.at(-1);
        const forehead = Array.from({ length: 17 }, (_, i) => {
            const x = MathUtils.lerp(left, right, i / 16);
            return [x, face(x, y)];
        }).filter(([, z]) => Number.isFinite(z));
        const front = Math.max(...forehead.map(([, z]) => z));
        const support = Math.max(
            ...ring.map(([x, , z]) => side * x * c + z * s),
            ...forehead.map(([x, z]) => side * x * c + z * s)
        );
        if (!Number.isFinite(front)) return;
        obliqueSupports.push(support);
        const taper = Math.sin(Math.PI * t);
        const width = w * 0.045 * taper ** 0.68;
        const thickness = w * 0.044 * taper ** 0.85;
        // The T-pose records which side of the hairline is bare skin.
        // Place its bulk on the hair side, leaving a small return over the seam.
        const center =
            root[0] + side * width * (evidence === "covered-brow" ? 1 : 0.8);
        const crest = Math.max(...ring.map((point) => point[2]));
        const centerZ = Math.max(crest - thickness, front + w * 0.025);

        rings.push(
            Array.from({ length: 5 }, (_, j): Point => {
                const phi = (j * Math.PI) / 2;
                const x = center + width * Math.sin(phi);
                // Measure depth at the rolled-under side of the section.
                const insideX = side * x - width * 0.85;
                const tangent = (support - insideX * c) / s;
                const edge = Math.min(
                    Math.max(crest, front + taper * clearance),
                    centerZ + thickness,
                    tangent + thickness * 3.1
                );
                const back = Math.min(
                    edge - 2 * thickness,
                    tangent - thickness * 0.62
                );
                const backEdge = MathUtils.lerp(
                    root[2],
                    back,
                    MathUtils.smoothstep(t, 0.08, 0.58)
                );
                const z = MathUtils.lerp(
                    backEdge,
                    edge,
                    (1 + Math.cos(phi)) / 2
                );
                return [
                    x,
                    y,
                    MathUtils.lerp(
                        root[2],
                        z,
                        MathUtils.smoothstep(t, 0, 0.12)
                    ),
                ];
            })
        );
    }
    // The foreground of a rounded lock is convex in profile. Bounds from two
    // different projections can switch halfway along it and leave a V-shaped
    // bite in the surface. Join the outer supports over that interval, keeping
    // its rear lip in contact with the existing head.
    const outline: Point[] = [];
    for (const [tip] of rings) {
        while (outline.length >= 2) {
            const a = outline.at(-2),
                b = outline.at(-1);
            if (
                (b[2] - a[2]) * (tip[1] - b[1]) >
                (tip[2] - b[2]) * (b[1] - a[1])
            )
                break;
            outline.pop();
        }
        outline.push([...tip] as Point);
    }
    const slope = (a: Point, b: Point) => (b[2] - a[2]) / (b[1] - a[1]);
    const tangent = outline.map((p, i) => {
        if (!i) return slope(p, outline[1]);
        if (i === outline.length - 1) return slope(outline[i - 1], p);
        const previous = slope(outline[i - 1], p),
            next = slope(p, outline[i + 1]);
        return previous * next <= 0
            ? 0
            : (2 * previous * next) / (previous + next);
    });
    for (const ring of rings) {
        const y = ring[0][1],
            i = outline.findIndex((p) => p[1] >= y);
        if (i < 1) continue;
        const a = outline[i - 1],
            b = outline[i],
            span = b[1] - a[1],
            t = (y - a[1]) / span;
        const curve =
            MathUtils.lerp(a[2], b[2], t * t * (3 - 2 * t)) +
            span * t * (1 - t) * ((1 - t) * tangent[i - 1] - t * tangent[i]);
        const fill = Math.max(0, curve - ring[0][2]);
        ring.forEach(
            (p, j) => (p[2] += (fill * (1 + Math.cos((j * Math.PI) / 2))) / 2)
        );
    }
    // Round the bend where the tip turns back towards the temple.
    const last = rings.at(-1);
    const nearTip = rings.at(-2);
    const tipDepth = MathUtils.lerp(last[0][2], nearTip[0][2], 0.68);
    for (const point of last) point[2] = tipDepth;
    if (depthScale !== 1)
        rings.forEach((row, i) => {
            const shell = stations[i].ring;
            const pivot = (side > 0 ? shell[0] : shell.at(-1))[2];
            for (const p of row) p[2] = MathUtils.lerp(pivot, p[2], depthScale);
        });
    // Seat each section after smoothing and applying the author's depth edit.
    // The inner third of the lock overlaps the head's oblique tangent. This
    // closes the window at the temple while retaining the rolled outer lip.
    rings.forEach((ring, i) => {
        const projections = ring.map(([x, , z]) => side * x * c + z * s);
        const contact = MathUtils.lerp(
            Math.min(...projections),
            Math.max(...projections),
            1 / 3
        );
        const inset = Math.max(0, contact - obliqueSupports[i] + w * 0.003) / c;
        for (const p of ring) {
            // A fringe covering the brow has a visible lateral edge down to
            // the eye. Preserve that trace when inferring the hidden depth.
            if (evidence === "covered-brow") p[2] -= (inset * c) / s;
            else p[0] -= side * inset;
        }
    });
    const softened: Point[][] = [rings[0]];
    for (let i = 1; i < rings.length; i++) {
        for (const t of [0.25, 0.75]) {
            softened.push(
                rings[i - 1].map(
                    (p, j) =>
                        p.map((v, k) =>
                            MathUtils.lerp(v, rings[i][j][k], t)
                        ) as Point
                )
            );
        }
    }
    return [...softened, last];
}
