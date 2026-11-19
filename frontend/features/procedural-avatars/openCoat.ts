import { MathUtils } from "three/webgpu";
import type { OpenCoat } from "./cartoonCast";
import type { Drawing, Section, Depth } from "./drawing";
import classic from "./rick-classic.json";
import type { Point } from "./sculpt";

// The fitted coat and shirt share a shoulder plane. Sample their measured
// sagittal envelopes independently so the open lip can clear the underlayer.
function clothEnvelope(name: string) {
    return classic.lofts
        .find((loft) => loft.name === name)
        .rows.map(([y, ...pairs]) => {
            const x = pairs.filter((_, i) => i % 2 === 0);
            const z = pairs.filter((_, i) => i % 2 === 1);
            const lateral = x.indexOf(Math.max(...x));
            return [y, Math.min(...z), Math.max(...z), z[lateral]];
        });
}
const shirt = clothEnvelope("shirt"),
    shell = clothEnvelope("coat");
const shoulderSpan = classic.joints.leftUpperArm[0] - classic.joints.neck[0];

function envelope(rows: number[][], y: number, scale: number) {
    const i = rows.findIndex(([at]) => at >= y);
    const end = i < 0 ? rows.length - 1 : Math.max(1, i);
    const a = rows[end - 1],
        b = rows[end];
    const t = MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    return [1, 2, 3].map((j) => scale * MathUtils.lerp(a[j], b[j], t));
}

// Use the visible shirt hem as the waist landmark. The final tucked closure
// in the source loft is inside the trousers and is not an exterior section.
const shirtHem = shirt.at(-2)[0];
export function coatShirtSection(
    row: Section,
    neck: number,
    hip: number,
    shoulder: number
): Section {
    const y = MathUtils.lerp(
        shirt[0][0],
        shirtHem,
        (row[0] - neck) / (hip - neck)
    );
    const [back, front] = envelope(shirt, y, shoulder / shoulderSpan);
    return [row[0], row[1], row[2], (front - back) / 2, (front + back) / 2];
}

/** Sew a pair of open front panels to a continuous back on the torso weights. */
export function drawOpenCoat(
    d: Drawing,
    coat: OpenCoat,
    neck: number,
    hip: number,
    shoulder: number,
    depth: number,
    shirtFront: Depth
) {
    const first = coat.rows[0],
        hem = coat.rows.at(-1)[0];
    const rows: OpenCoat["rows"] = [
        [
            Math.min(neck - 1, first[0] - 1),
            first[1] * 0.66,
            Math.max(first[1] * 0.59, first[2]),
            Math.min(first[4] * 0.59, first[3]),
            first[4] * 0.66,
        ],
        ...coat.rows,
    ];
    const thickness = Math.max(0.65, shoulder * 0.042);
    function ring(row: OpenCoat["rows"][number], inner: boolean) {
        const [y, left, a, b, right] = row;
        const fall = MathUtils.smoothstep(y, hip - shoulder * 0.8, hem);
        const level =
            y < hip
                ? MathUtils.lerp(
                      shell[0][0],
                      shirtHem,
                      (y - neck) / (hip - neck)
                  )
                : MathUtils.lerp(
                      shirtHem,
                      shell.at(-1)[0],
                      (y - hip) / (hem - hip)
                  );
        const [back, lipDepth, middle] = envelope(
            shell,
            level,
            shoulder / shoulderSpan
        );
        // The upper lip covers the shirt. Below the hips, the open tails
        // progressively hang behind the thighs, exposing their lining in front.
        function half(side: number, opening: number, radius: number): Point[] {
            const lip = MathUtils.lerp(opening, radius * 0.94, fall);
            const front =
                y <= hip
                    ? Math.max(lipDepth, shirtFront(side * lip, y) + thickness)
                    : lipDepth;
            const rim: [number, number][] = [
                [lip, front],
                [
                    MathUtils.lerp(lip, radius, 0.58),
                    MathUtils.lerp(front, middle, 0.27),
                ],
                [radius * 0.98, MathUtils.lerp(front, middle, 0.65)],
                [radius, middle],
                [radius * 0.9, MathUtils.lerp(middle, back, 0.64)],
                [radius * 0.57, MathUtils.lerp(middle, back, 0.94)],
                [radius * 0.25, MathUtils.lerp(middle, back, 0.988)],
                [0, back],
            ];
            return rim.map(([x, z], i) => {
                const t = i / (rim.length - 1);
                const end = y === hem ? shoulder * 0.2 * Math.pow(t, 1.6) : 0;
                return [
                    side * (inner ? x * (1 - thickness / radius) : x),
                    y - end,
                    inner ? MathUtils.lerp(z, middle, thickness / depth) : z,
                ];
            });
        }
        return [
            ...half(-1, -a, -left),
            ...half(1, b, right).reverse().slice(1),
        ];
    }
    const outside = rows.map((row) => ring(row, false));
    const inside = rows.map((row) => ring(row, true));
    d.s.tone = (x, y, z) =>
        0.98 -
        0.09 * Math.exp(-((Math.abs(x) / shoulder - 0.91) ** 2) / 0.14) -
        0.07 * MathUtils.smoothstep(-z, 0, depth);
    function panels(outer: Point[][], inner: Point[][], edges: number[]) {
        // One opaque cloth sheet shades its reverse as lining. A second,
        // independently triangulated wall can cross it when the thighs flex.
        d.s.lined = true;
        d.s.surface(
            outer.map((row) => [...row].reverse()),
            coat.color,
            true,
            "perimeter"
        );
        d.s.lined = false;
        for (const i of edges)
            d.s.surface(
                outer.map((row, j) => [row[i], inner[j][i]]),
                coat.color,
                true,
                "perimeter"
            );
    }
    const last = outside[0].length - 1;
    const split = Math.min(
        rows.length - 2,
        Math.max(
            1,
            rows.findIndex((row) => row[0] >= hip)
        )
    );
    panels(outside.slice(0, split + 1), inside.slice(0, split + 1), [0, last]);
    d.s.surface([outside[0], inside[0]], coat.color, true, "perimeter");
    // The tails share the torso's exact waist ring. Each follows its thigh
    // below the waist; both weights reach zero along the common centre back.
    d.s.endTorso();
    const waist = rows[split][0];
    const center = last / 2;
    for (const side of ["right", "left"]) {
        const negative = side === "right";
        const half = (ring: Point[]) =>
            negative ? ring.slice(0, center + 1) : ring.slice(center);
        const outer = outside.slice(split).map(half),
            inner = inside.slice(split).map(half);
        d.drape("hips", side + "UpperLeg", waist, hem);
        d.s.drape.weight = (x, y, z) =>
            MathUtils.lerp(
                0.48,
                0.84,
                MathUtils.smoothstep(z, -depth, depth * 0.3)
            ) *
            MathUtils.smoothstep(y, waist, waist + (hem - waist) * 0.76) *
            MathUtils.smoothstep(Math.abs(x), 0, shoulder * 1.1);
        panels(outer, inner, [negative ? 0 : center]);
        d.s.surface(
            [outer.at(-1), inner.at(-1)],
            coat.color,
            true,
            "perimeter"
        );
    }
}
