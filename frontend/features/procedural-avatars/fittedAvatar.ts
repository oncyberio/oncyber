import * as T from "three/webgpu";
import { drawMarkedShirt, type ShirtMark } from "./shirtMark";
import { Drawing, frontOfLoft, type XY } from "./drawing";
import families from "./families.json";

import { drawDigit } from "./humanoidParts";
import { fitCoatRow } from "./coatPanels";
import { prepareCoatShadow } from "./garmentPrint";
import { finish } from "./surfaces";
import type { Point } from "./sculpt";
import type { AvatarRecipe } from "./recipes";

type Loft = {
    name: string;
    axis: number;
    paint: string;
    bone: string;
    rows: number[][];
    hem?: number[][];
    pair?: boolean;
    half?: boolean;
    skin?: (string | number)[];
};
export interface FittedAvatar {
    mirror: number;
    lofts: Loft[];
    fingers: { name: string; path: number[][]; radii: number[] }[];
    hair: { center: number[]; sections: number[][] };
    collar: { join: number; shirt: number[][][]; neck: number[][][] };
    shoulderPanel: number[][][];
    teeth: { center: number[]; depth: number[]; contour: number[][] }[];
    mouth: { start: number; end: number; span: number; rings: number[][][] };
}

/** Sampled contours share their knot order at every section. Counterparts
 * reuse the measurements and have separate joints and grip sockets. */
type PaintedLook = {
    swatches: Record<string, string>;
    lining: string;
    cheek: {
        offset: number;
        y: number;
        rx: number;
        ry: number;
        strength: number;
    };
    contact: { offset: number[]; radii: number[]; opacity: number }[];
};
export function drawFittedAvatar(
    d: Drawing,
    recipe: FittedAvatar,
    look: PaintedLook,
    shirtMark?: ShirtMark,
    crownOutline?: XY[],
    eyeInk?: string,
    lapels?: AvatarRecipe["lapels"],
    panels?: AvatarRecipe["coatPanels"],
    sleeveCut?: AvatarRecipe["sleeveCut"]
) {
    if (d.s.detail === "full")
        d.s.simplification = { error: 0.055, relative: 0.29, fraction: 0.18 };
    d.s.sourcePaint = true;
    const mirror = recipe.mirror;
    const outlined = d.s.penOutline;
    const opposite = (x: number) => 2 * mirror - x;
    // The classic keeps its MRGB swatches as its reference palette. The game
    // look warms exposed skin and shades cloth and contact points in vertices.
    const colorOf = (swatch: string) => look.swatches[swatch] ?? swatch;
    const pigment = Object.fromEntries(
        recipe.lofts.map((p) => [colorOf(p.paint), finish.cloth])
    );
    const skin = colorOf(recipe.lofts.find((p) => p.name === "skull").paint);
    const hand = colorOf(recipe.lofts.find((p) => p.name === "palm").paint);
    const hairSwatch = recipe.lofts.find((p) => p.name === "brow").paint;
    const hair = colorOf(hairSwatch);
    d.s.palette({
        ...pigment,
        [skin]: finish.skin,
        [hand]: finish.skin,
        [colorOf("#d5c9bd")]: finish.skin,
        [hair]: finish.fiber,
        "#ffffff": finish.enamel,
        "#222222": finish.enamel,
    });
    d.s.ambientByPaint = {
        ...Object.fromEntries(Object.keys(pigment).map((c) => [c, 0.81])),
        [skin]: 0.78,
        [hand]: 0.76,
        [hair]: 0.86,
        "#ffffff": 0.97,
    };
    d.s.skinShadows = look.contact.map(
        ({ offset: [x, y, z], radii, opacity }) => ({
            center: [mirror + x, y, z],
            radii: radii as Point,
            opacity,
        })
    );
    const { offset, ...cheek } = look.cheek;
    d.s.cheeks = [-1, 1].map((sign) => ({
        x: mirror + sign * offset,
        ...cheek,
    }));
    const skull = recipe.lofts.find((p) => p.name === "skull").rows;
    const buried = (x: number, y: number, z: number) => {
        if (y <= skull[0][0] + 2 || y >= skull.at(-1)[0] - 2) return false;
        let i = 1;
        while (i < skull.length - 1 && skull[i][0] < y) i++;
        const a = skull[i - 1],
            b = skull[i],
            t = (y - a[0]) / (b[0] - a[0]);
        // Require a margin inside the surface to allow for decimation and face morphs.
        const px = Math.abs(x - mirror) * 1.09 + 0.15,
            pz = 9 + (z - 9) * 1.09;
        let hits = 0;
        let lastX = T.MathUtils.lerp(a.at(-2), b.at(-2), t);
        let lastZ = T.MathUtils.lerp(a.at(-1), b.at(-1), t);
        for (let k = 1; k < a.length; k += 2) {
            const nextX = T.MathUtils.lerp(a[k], b[k], t),
                nextZ = T.MathUtils.lerp(a[k + 1], b[k + 1], t);
            if (
                nextZ > pz !== lastZ > pz &&
                px < lastX + ((pz - lastZ) / (nextZ - lastZ)) * (nextX - lastX)
            )
                hits++;
            lastX = nextX;
            lastZ = nextZ;
        }
        return (hits & 1) !== 0;
    };
    for (const section of recipe.lofts) {
        if (panels && lapels && section.name === "lapels") continue;
        d.s.penOutline =
            outlined && ["skull", "ear", "brow"].includes(section.name);
        const paint = colorOf(section.paint);
        d.s.referenceSwatch = section.paint;
        d.s.familyPart = section.name === "coat" ? "coat" : undefined;
        if (section.name === "coat") {
            // In each half-ring the path runs along the lining to the lapel,
            // turns at its front edge and returns along the outer coat.
            const turn = section.rows.map((row) => {
                const z = row.slice(2).filter((_, i) => i % 2 === 0);
                return [
                    row[0],
                    panels ? 0.5 : z.indexOf(Math.max(...z)) / (z.length - 1),
                ];
            });
            d.s.paintMix = {
                color: panels?.lining ?? look.lining,
                amount: (x, y, z, u) => {
                    let i = 1;
                    while (i < turn.length - 1 && turn[i][0] < y) i++;
                    const a = turn[i - 1],
                        b = turn[i],
                        t = T.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
                    const lip = T.MathUtils.lerp(a[1], b[1], t),
                        along = 2 * Math.min(u, 1 - u);
                    return (
                        (1 -
                            T.MathUtils.smoothstep(
                                along,
                                lip - 0.038,
                                lip + 0.027
                            )) *
                        (0.18 +
                            0.58 * T.MathUtils.smoothstep(y, 193, 283) +
                            0.19 *
                                Math.exp(-(((y - 284) / 134) ** 2)) *
                                Math.exp(-(((x - mirror) / 62) ** 2)))
                    );
                },
            };
            d.s.tone = (x, y, z) =>
                0.99 -
                0.062 *
                    Math.exp(
                        -(((Math.abs(x - mirror) - 38 - y * 0.021) / 8) ** 2)
                    ) +
                0.026 * Math.sin(0.051 * x + 0.009 * y);
        } else if (section.name === "shirt") {
            d.s.tone = (x, y) =>
                0.99 -
                0.19 * Math.exp(-(((Math.abs(x - mirror) - 31) / 8) ** 2)) -
                0.13 * Math.exp(-(((y - 367) / 10) ** 2));
        } else if (section.name === "neck") {
            d.s.tone = (_, y) =>
                0.78 + 0.21 * T.MathUtils.smoothstep(y, 168, 199);
        }
        for (let side = 0; side < (section.pair ? 2 : 1); side++) {
            const joint = (name: string) =>
                side ? name.replace("left", "right") : name;
            if (section.bone === "torso") d.torso();
            else d.bind(joint(section.bone));
            if (section.skin) {
                const [other, start, end] = section.skin as [
                    string,
                    number,
                    number
                ];
                d.drape(joint(section.bone), joint(other), 0, 1);
                d.s.drape.weight = (x, y) =>
                    T.MathUtils.smoothstep(
                        ((section.axis === 0 ? (side ? opposite(x) : x) : y) -
                            start) /
                            (end - start),
                        0,
                        1
                    );
            }
            if (section.name === "eyes" || section.name === "pupils") {
                const ys = section.rows.map((row) => row[0]);
                const xs = section.rows.flatMap((row) =>
                    row.slice(1).filter((_, i) => i % 2 === 0)
                );
                const zs = section.rows.flatMap((row) =>
                    row.slice(1).filter((_, i) => i % 2 === 1)
                );
                const extents = [xs, ys, zs].map((samples) => [
                    Math.min(...samples),
                    Math.max(...samples),
                ]);
                const center = extents.map(
                    ([lo, hi]) => (lo + hi) / 2
                ) as Point;
                const radii = extents.map(([lo, hi]) => (hi - lo) / 2) as Point;
                if (side) center[0] = opposite(center[0]);
                d.s.eyes = true;
                d.s.pupil = section.name === "pupils";
                d.s.eyeStroke = !!eyeInk && !d.s.pupil;
                d.s.oval(
                    center,
                    radii,
                    d.s.eyeStroke ? eyeInk : paint,
                    0,
                    section.name === "eyes" ? 18 : 8
                );
                d.s.eyeStroke = false;
                d.s.eyes = false;
                d.s.pupil = false;
                continue;
            }
            const rows = section.rows.map(([level, ...points]) => {
                let ring: Point[] = [];
                for (let j = 0; j < points.length; j += 2) {
                    const a = points[j],
                        b = points[j + 1];
                    ring.push(
                        section.axis === 0
                            ? [level, a, b]
                            : [a + (section.half ? mirror : 0), level, b]
                    );
                }
                if (sleeveCut && section.name === "sleeve") {
                    const ys = ring.map((p) => p[1]),
                        zs = ring.map((p) => p[2]);
                    const cy = (Math.min(...ys) + Math.max(...ys)) * 0.5;
                    const cz = (Math.min(...zs) + Math.max(...zs)) * 0.5;
                    for (const p of ring) {
                        p[1] =
                            cy +
                            (p[1] - cy) * sleeveCut.radius +
                            sleeveCut.lift;
                        p[2] = cz + (p[2] - cz) * sleeveCut.radius;
                    }
                }
                if (panels && section.name === "coat")
                    ring = fitCoatRow(ring, level, mirror, panels.opening);
                if (section.half)
                    ring = ring.concat(
                        ring
                            .slice(1, -1)
                            .reverse()
                            .map(([x, y, z]) => [opposite(x), y, z])
                    );
                if (section.name === "brow") {
                    // Keep the thin brow clear of the coarse forehead at the temples.
                    const at = Math.min(1, Math.abs(level - mirror) / 29);
                    for (const point of ring) point[2] += 0.95 + at * 1.2;
                }
                if (side)
                    ring = ring
                        .reverse()
                        .map(([x, y, z]) => [opposite(x), y, z]);
                // Sampling wraps opposite directions around horizontal and vertical axes.
                if (section.axis === 0 || !section.half) ring.reverse();
                return [...ring, ring[0]];
            });
            if (section.hem && !panels) {
                const edge = section.hem.map(
                    ([x, y, z]): Point => [x + mirror, y, z]
                );
                rows.push([
                    ...edge,
                    ...edge
                        .slice(1, -1)
                        .reverse()
                        .map(([x, y, z]): Point => [opposite(x), y, z]),
                    edge[0],
                ]);
            }
            if (section.name === "shirt" || section.name === "neck") {
                const half = recipe.collar[section.name] as Point[][];
                const collarRows = half.map((row) => [
                    ...row,
                    ...row
                        .slice(1, -1)
                        .reverse()
                        .map(([x, y, z]): Point => [opposite(x), y, z]),
                    row[0],
                ]);
                if (section.name === "neck") {
                    rows.splice(0, rows.length, ...collarRows);
                    d.drape("neck", "upperChest", 0, 1);
                    d.s.drape.weight = (_, y) =>
                        T.MathUtils.smoothstep(y, 172, 188);
                } else {
                    rows.splice(
                        0,
                        rows.length,
                        ...collarRows,
                        ...rows.filter((r) => r[0][1] > recipe.collar.join)
                    );
                    for (const row of rows)
                        for (let i = 0; i < row.length; i++) {
                            const [x, y, z] = row[i];
                            const lateral = T.MathUtils.smoothstep(
                                Math.abs(x - mirror),
                                14,
                                34
                            );
                            const back = 1 - T.MathUtils.smoothstep(z, -12, -1);
                            const upper =
                                1 - T.MathUtils.smoothstep(y, 206, 270);
                            const ease = T.MathUtils.smoothstep(
                                Math.hypot(x - mirror, z + 2),
                                15,
                                26
                            );
                            row[i] = [
                                mirror +
                                    (x - mirror) *
                                        (1 - 0.14 * lateral * upper * ease),
                                y + upper * ease * (3.3 * back + 3.5 * lateral),
                                z +
                                    ease *
                                        (back * (3.5 + upper * 2.4) -
                                            (1 - back) * lateral * upper * 5),
                            ];
                        }
                }
                // A continuous neckline bounds two independently animated materials.
                const rim = new Set(
                    collarRows[
                        section.name === "neck" ? collarRows.length - 1 : 0
                    ].map(([x, y, z]) =>
                        [x, y, z].map((v) => v.toFixed(2)).join(",")
                    )
                );
                d.s.preserveVertex = (x, y, z) =>
                    rim.has([x, y, z].map((v) => v.toFixed(2)).join(","));
            }
            const cap = (row: Point[]) => {
                const polygon = row
                    .slice(0, -1)
                    .filter(
                        (p, j) => !j || p.some((v, k) => v !== row[j - 1][k])
                    );
                if (polygon.length < 3) return;
                const plane = polygon.map(
                    ([x, y, z]) => new T.Vector2(section.axis === 0 ? y : x, z)
                );
                const tris = T.ShapeUtils.triangulateShape(plane, []);
                if (tris.length)
                    d.s.triangles(
                        tris.flatMap((t) => t.map((i) => polygon[i])),
                        paint
                    );
            };
            d.s.fineDetail = ["skull", "thigh", "shin"].includes(section.name);
            if (section.name === "skull") {
                const { start, end, span, rings } = recipe.mouth;
                const n = rows[0].length - 1;
                const face = rows.map((r) => [
                    ...r.slice(n - span, n),
                    ...r.slice(0, span + 1),
                ]);
                d.s.surface(face.slice(0, start + 1), paint);
                d.s.surface(face.slice(end), paint);
                // Hair covers most of the rear skull. Give curved facial
                // features the finer budget and simplify the rear shell normally.
                d.s.fineDetail = false;
                d.s.surface(
                    rows.map((r) => r.slice(span, n - span + 1)),
                    paint
                );
                d.s.fineDetail = true;
                // Each measured ray runs from the back of the mouth around the
                // overhanging lip to a vertex on the surrounding skull.
                d.ringPatch(rings.slice(4), paint);
                d.s.referenceSwatch = "#682324";
                d.ringPatch(rings.slice(0, 5), "#682324");
                d.s.referenceSwatch = section.paint;
            } else if (section.name === "shirt") {
                // The enclosed hems follow the same bones as the fabric. Shared
                // poles keep them solid when a clip moves the coat away.
                const pole = (row: Point[]) => {
                    const mid = new T.Vector3();
                    for (const p of row.slice(0, -1))
                        mid.add(new T.Vector3(...p));
                    mid.divideScalar(row.length - 1);
                    return row.map(() => mid.toArray() as Point);
                };
                const garment = () =>
                    d.s.surface(
                        [pole(rows[0]), ...rows, pole(rows.at(-1))],
                        paint,
                        true
                    );
                if (shirtMark) drawMarkedShirt(d, shirtMark, garment);
                else garment();
                if (outlined && lapels) {
                    // The collar follows its shared neck seam through animation.
                    d.s.line(rows[0], 0.53, lapels.color);
                }
            } else {
                d.s.coatShadow = section.name === "coat";
                if (d.s.coatShadow) prepareCoatShadow();
                d.s.surface(rows, paint);
                d.s.coatShadow = false;
                if (outlined && lapels && section.name === "sleeve") {
                    // Meridians on the actual cuff-to-shoulder surface carry
                    // the two long pen strokes of an illustrated sleeve.
                    const sleeve = frontOfLoft(rows);
                    for (const sign of [-1, 1]) {
                        const strip: Point[][] = [];
                        for (const row of rows) {
                            const x = row[0][0];
                            const ys = row.map((p) => p[1]);
                            const max = Math.max(...ys),
                                min = Math.min(...ys);
                            const border = sign === 1 ? max : min;
                            const edge = [0.035, 0.11].map((t) => {
                                const y = border - sign * (max - min) * t;
                                const z = sleeve(x, y);
                                return [x, y, z + 0.72] as Point;
                            });
                            if (edge.every((p) => Number.isFinite(p[2])))
                                strip.push(edge);
                        }
                        if (strip.length > 1)
                            d.s.surface(strip, lapels.color, true);
                    }
                }
                if (section.name === "coat" && lapels) {
                    const front = frontOfLoft(rows);
                    const mix = d.s.paintMix;
                    d.s.paintMix = undefined;
                    if (panels) {
                        // The foremost points of both halves are the closed
                        // front hems. Their stroke bends with the garment.
                        for (const i of [8, 24]) {
                            const seam = rows.map((row) => {
                                const [x, y, z] = row[i];
                                return [x, y, z + 0.8] as Point;
                            });
                            d.s.ribbon(seam, 0.62, lapels.color);
                        }
                    }
                    for (const path of lapels.paths) {
                        let ridge: Point[] = [];
                        for (let i = 1; i < path.length; i++) {
                            const [x0, y0] = path[i - 1],
                                [x1, y1] = path[i];
                            const n = Math.max(
                                1,
                                Math.ceil(
                                    Math.hypot(
                                        (x1 - x0) * 85,
                                        (y1 - y0) * 330
                                    ) / 6
                                )
                            );
                            for (let j = i === 1 ? 0 : 1; j <= n; j++) {
                                const x =
                                    mirror + (x0 + ((x1 - x0) * j) / n) * 85;
                                const y =
                                    184 + (y0 + ((y1 - y0) * j) / n) * 330;
                                const z = front(x, y);
                                if (Number.isFinite(z))
                                    ridge.push([x, y, z + 1.2]);
                                else {
                                    if (ridge.length > 1)
                                        d.s.ribbon(ridge, 0.54, lapels.color);
                                    ridge = [];
                                }
                            }
                        }
                        if (ridge.length > 1)
                            d.s.ribbon(ridge, 0.54, lapels.color);
                    }
                    d.s.paintMix = mix;
                }
            }
            if (!["skull", "neck", "shirt"].includes(section.name)) {
                cap(rows[0]);
                if (!section.hem || panels) cap(rows.at(-1));
            }
            d.s.fineDetail = false;
            d.s.preserveVertex = undefined;
            d.s.eyes = false;
            if (section.bone === "torso") d.s.endTorso();
        }
        d.s.familyPart = undefined;
        d.s.tone = undefined;
        d.s.paintMix = undefined;
    }
    d.torso();
    const coatSwatch = recipe.lofts.find((p) => p.name === "coat").paint;
    d.s.referenceSwatch = coatSwatch;
    const shoulder = recipe.shoulderPanel as Point[][];
    d.s.surface(shoulder, colorOf(coatSwatch), true);
    d.s.surface(
        shoulder.map((row) =>
            row.map(([x, y, z]): Point => [opposite(x), y, z]).reverse()
        ),
        colorOf(coatSwatch),
        true
    );
    d.s.endTorso();
    d.bind("head");
    d.s.referenceSwatch = "#dacc9c";
    d.s.fineDetail = true;
    for (const tooth of recipe.teeth) {
        d.crown(
            tooth.center as XY,
            tooth.contour.map(([x, y]): XY => [x, y]),
            [0, 1],
            (i, row, front) =>
                row === 0 ? tooth.depth[front ? 0 : 1] : tooth.contour[i][2],
            "#dacc9c"
        );
    }
    d.s.fineDetail = false;
    d.s.referenceSwatch = hairSwatch;
    const { center, sections } = recipe.hair;
    const halfCrown = sections.map(([degrees, ...pairs]) => {
        const a = (degrees * Math.PI) / 180;
        const row: Point[] = [];
        for (let i = 0; i < pairs.length; i += 2)
            row.push([
                center[0] + Math.cos(a) * pairs[i],
                center[1] + Math.sin(a) * pairs[i],
                pairs[i + 1],
            ]);
        return [...row, row[0]];
    });
    const back = halfCrown
        .slice(1, -1)
        .reverse()
        .map((row) => row.map(([x, y, z]): Point => [opposite(x), y, z]));
    d.s.occluded = buried;
    d.s.crown = true;
    d.s.penOutline = outlined;
    const original = [...halfCrown, ...back];
    const crown = crownOutline
        ? fitHairRim(original, center, crownOutline)
        : original;
    d.s.surface([...crown, crown[0]], hair, true);
    d.s.crown = false;
    d.s.penOutline = false;
    d.s.occluded = undefined;
    d.s.referenceSwatch = recipe.lofts.find((p) => p.name === "palm").paint;
    for (const side of ["left", "right"]) {
        for (const finger of recipe.fingers) {
            const path = finger.path.map(
                ([x, y, z]): Point => [side === "right" ? opposite(x) : x, y, z]
            );
            drawDigit(d, side, finger.name, path, finger.radii, hand, 1.4);
        }
    }
}

/** Carry the OBJ's front, rear and root samples around a newly drawn rim.
 * Intermediate sections follow the straight edge between drawn corners. */
function fitHairRim(
    original: Point[][],
    center: number[],
    outline: XY[]
): Point[][] {
    const [, , rx, ry] = families["rick-classic"].crownRoot;
    const [cx, cy] = center;
    const sections = original
        .map((row) => ({
            angle: Math.atan2(row[0][1] - cy, row[0][0] - cx),
            samples: row
                .slice(0, -1)
                .map(([x, y, z]) => [Math.hypot(x - cx, y - cy), z]),
        }))
        .sort((a, b) => a.angle - b.angle);
    const turn = 2 * Math.PI;
    const edge: XY[] = [];
    outline.forEach(([u, v], i) => {
        const [u1, v1] = outline[(i + 1) % outline.length];
        const span =
            (Math.atan2(v1 * ry, u1 * rx) - Math.atan2(v * ry, u * rx) + turn) %
            turn;
        const n = Math.max(1, Math.ceil(span / (Math.PI / 16)));
        for (let j = 0; j < n; j++)
            edge.push([
                (u + ((u1 - u) * j) / n) * rx,
                (v + ((v1 - v) * j) / n) * ry,
            ]);
    });
    return edge.map(([x, y]) => {
        const angle = Math.atan2(y, x);
        const next = sections.findIndex((section) => section.angle >= angle);
        const hi = next < 0 ? 0 : next;
        const b = sections[hi],
            a = sections[(hi + sections.length - 1) % sections.length];
        const t =
            ((angle - a.angle + turn) % turn) /
            ((b.angle - a.angle + turn) % turn);
        const samples = a.samples.map(([r, z], j) => [
            r + t * (b.samples[j][0] - r),
            z + t * (b.samples[j][1] - z),
        ]);
        const tip = Math.hypot(x, y);
        const radii = samples.map(([r]) => r);
        const root = Math.min(...radii),
            extent = Math.max(...radii) - root;
        const base = Math.min(root, 0.8 * tip);
        const row = samples.map(([r, z]): Point => {
            const reach = (base + ((tip - base) * (r - root)) / extent) / tip;
            return [cx + x * reach, cy + y * reach, z];
        });
        return [...row, row[0]];
    });
}
