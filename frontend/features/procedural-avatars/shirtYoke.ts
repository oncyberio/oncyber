import * as T from "three/webgpu";
import { fittedArmX, type CartoonDesign } from "./cartoonCast";
import {
    Drawing,
    frontOfLoft,
    sectionPoint,
    type Depth,
    type XY,
    type Section,
} from "./drawing";
import type { Point } from "./sculpt";

type ArmRow = [number, number, number];

/** The sleeve and shoulder use the same socket in drawing coordinates. */
export function sleeveRing(
    d: Drawing,
    g: CartoonDesign,
    side: string,
    row: ArmRow,
    sides = 12
): Point[] {
    const sign = side === "right" ? -1 : 1;
    const x = fittedArmX(g, sign, row[0]);
    const joints = [side + "UpperArm", side + "LowerArm", side + "Hand"].map(
        (name) => d.sourceJoints.get(name).point
    );
    const i =
        sign * x <= sign * joints[0][0]
            ? 0
            : sign * x <= sign * joints[1][0]
            ? 1
            : 2;
    const start: Point = i ? joints[i - 1] : [0, 0, 0],
        end = joints[i];
    const z = T.MathUtils.lerp(
        start[2],
        end[2],
        T.MathUtils.clamp((x - start[0]) / (end[0] - start[0] || 1), 0, 1)
    );
    return Array.from({ length: sides + 1 }, (_, i) => {
        const a = ((i % sides) * 2 * Math.PI) / sides;
        return [
            x,
            row[1] + row[2] * Math.sin(a),
            z + row[2] * 0.94 * Math.cos(a),
        ];
    });
}

/** A shoulder has three openings: neck, sleeve and chest. Each quadrant of
 * the yoke meets the corresponding rings on all three without a buried cap. */
export function drawShirtYoke(
    d: Drawing,
    g: CartoonDesign,
    rows: Section[],
    segments: number,
    station: ArmRow,
    neckline: (angle: number) => Point
) {
    const cloth = g.outfit.color;
    const joinY = (a: number) =>
        Math.max(station[1] + station[2], neckline(a)[1] + 3);
    const depths: Depth[] = [];
    for (const side of ["right", "left"]) {
        const sign = side === "right" ? -1 : 1;
        const socket = sleeveRing(d, g, side, station, 8);
        for (const face of [1, -1]) {
            const angles = Array.from({ length: segments / 4 + 1 }, (_, i) =>
                face === 1
                    ? (sign * i * 2 * Math.PI) / segments
                    : sign * (Math.PI - (i * 2 * Math.PI) / segments)
            );
            const middle = angles[0];
            const neckCenter = neckline(middle)[0];
            const chestCenter = sectionPoint(rows, middle, joinY(middle))[0];
            const patch = Array.from({ length: 5 }, (_, j) => {
                const t = j / 4;
                const axis = T.MathUtils.lerp(neckCenter, chestCenter, t);
                return angles.map((a, i) => {
                    const top = neckline(a),
                        bottom = sectionPoint(rows, a, joinY(a));
                    const w = Math.sin(Math.PI * t),
                        u = Math.abs(Math.sin(a)),
                        linear = i / (angles.length - 1);
                    const x = T.MathUtils.lerp(top[0], bottom[0], t);
                    const midZ = T.MathUtils.lerp(top[2], bottom[2], t);
                    return [
                        axis +
                            (x - axis) *
                                T.MathUtils.lerp(
                                    1,
                                    u > 1e-6 ? linear / u : 1,
                                    w
                                ),
                        T.MathUtils.lerp(top[1], bottom[1], t),
                        midZ * (1 - w * u * u) +
                            face *
                                w *
                                T.MathUtils.smoothstep(linear, 0, 1) *
                                station[2] *
                                0.94,
                    ] as Point;
                });
            });
            // Keep the shirt side and its sleeve in a single continuous panel.
            // The inner vertices use the same spine weights as the lower fabric.
            const start = patch[0].at(-1),
                end = patch.at(-1).at(-1);
            patch.forEach((row, j) => {
                const q = socket[(6 + face * j) % 8],
                    inner = row.at(-1);
                const mid = inner.map((v, i) =>
                    T.MathUtils.lerp(v, q[i], 0.55)
                ) as Point;
                if (j < 2)
                    mid[1] +=
                        (g.fit.sections.shirtCut.shoulderTop - mid[1]) *
                        (1 - j / 2) ** 2;
                row.push(mid, q);
            });
            const panel = sign * face > 0 ? patch : patch.reverse();
            if (face === 1) depths.push(frontOfLoft(panel));
            d.torso();
            d.s.drape = {
                name: side + "UpperArm",
                matrix: d.matrixFor(side + "UpperArm"),
                start: 0,
                end: 1,
                fromTorso: true,
                weight: (x, y) => {
                    const t = T.MathUtils.clamp(
                        (y - start[1]) / (end[1] - start[1] || 1),
                        0,
                        1
                    );
                    const inner = T.MathUtils.lerp(start[0], end[0], t);
                    return T.MathUtils.smoothstep(
                        sign * x,
                        sign * inner,
                        sign * socket[0][0]
                    );
                },
            };
            d.s.surface(panel, cloth, false, "perimeter");
        }
    }
    d.torso();
    return {
        joinY,
        front: (x: number, y: number) =>
            Math.max(...depths.map((z) => z(x, y))),
    };
}

/** Turn the traced collar back onto the chest and follow the visible crease. */
export function drawCollarWing(
    d: Drawing,
    cut: CartoonDesign["fit"]["sections"]["shirtCut"],
    sign: number,
    openingPoint: (angle: number) => Point,
    front: Depth,
    dye: string,
    foldColor: string
) {
    const opening = cut.opening;
    const si = sign < 0 ? 1 : 2;
    const boundary = opening.map(([y, l, r], i): Point => {
        const a = (sign * (1 - i / (opening.length - 1)) * Math.PI) / 2;
        return [si === 1 ? l : r, y, openingPoint(a)[2] + 0.65];
    });
    d.s.ribbon(boundary, 0.91, dye);
    const wing = cut.wings?.[sign < 0 ? 0 : 1];
    if (wing) {
        const raised = (x: number, y: number) =>
            Math.max(0, front(x, y)) + 1.15;
        const tailY = wing.at(-1)[1];
        const k = opening.findIndex((row) => row[0] >= tailY);
        if (k > 0) {
            const a = opening[k - 1],
                b = opening[k];
            const edgeX = T.MathUtils.lerp(
                a[si],
                b[si],
                (tailY - a[0]) / (b[0] - a[0])
            );
            const border: XY[] = [
                ...wing,
                [edgeX, tailY],
                ...opening
                    .slice(1, k)
                    .reverse()
                    .map((row): XY => [row[si], row[0]]),
            ];
            d.decal(border, raised, foldColor);
        }
        const fold: Point[] = [];
        for (let i = 1; i < wing.length; i++) {
            const p = wing[i - 1],
                q = wing[i],
                steps = Math.max(
                    1,
                    Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 3)
                );
            for (let j = i === 1 ? 0 : 1; j <= steps; j++) {
                const x = T.MathUtils.lerp(p[0], q[0], j / steps),
                    y = T.MathUtils.lerp(p[1], q[1], j / steps);
                fold.push([x, y, raised(x, y) + 0.8]);
            }
        }
        if (fold.length > 1) d.s.ribbon(fold, 1.15, dye);
    }
}
