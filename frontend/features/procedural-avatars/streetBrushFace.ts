import * as T from "three/webgpu";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import type { StreetPattern } from "./streetwearPattern";
import { silhouetteTile } from "./surfaces";
import { prepareStreetBrushes } from "./garmentPrint";
import { streetPaintUV, margin, upperLid, lowerLid } from "./streetBrush";

const mix = T.MathUtils.lerp;
type Front = (unitWidth: number, y: number) => Point;
type Section = (y: number) => number[];
type SideDepth = (fore: number, back: number, y: number) => number;

/** The front and profile drawings share a closed skin surface. The eye margins,
 * pigment and jaw line follow that surface at intermediate camera angles. */
export function drawStreetBrushFace(
    d: Drawing,
    p: StreetPattern,
    front: Front,
    section: Section,
    height: (y: number) => number,
    sideDepth: SideDepth
) {
    const { width, depth, chin } = p.head,
        fit = p.faceFit;
    prepareStreetBrushes();
    d.s.sourcePaint = false;
    d.s.sculptedCartoon = false;
    d.s.thinSkinOutline = false;
    const rawSkin = parseInt(p.colors.skin.slice(1), 16);
    const fromHeight = (y: number) => 184 - ((chin - y) * 133) / (chin - 51);
    const ux = (x: number, y: number) => x / Math.max(0.01, section(y)[1]);
    // The eye opening is a raised, convex patch on a recessed orbit. It
    // wraps around the temple, with both margins meeting at each canthus.
    const skull = (u: number, y: number): Point => {
        const v = front(u, y),
            x = u * section(y)[1];
        v[2] -=
            2.1 *
            Math.exp(
                -(((Math.abs(x) - 24.5) / 14) ** 4 + ((y - 131.4) / 6.2) ** 4)
            );
        return v;
    };
    const skinRows = [
        ...new Set([
            ...fit.sections.map((s) => s[0]),
            120,
            128,
            134,
            141,
            146,
            151,
            159,
            164,
            170,
            176,
            179,
            183,
        ]),
    ].sort((a, b) => a - b);
    const meridians = d.s.detail === "full" ? 32 : 24;
    const rows = skinRows.map((y) =>
        Array.from({ length: meridians + 1 }, (_, i) =>
            skull(Math.sin(-Math.PI / 2 + (Math.PI * i) / meridians), y)
        )
    );
    const chart = new Map<string, [number, number]>();
    const key = (x: number, y: number) => Math.fround(x) + "," + Math.fround(y);
    rows.forEach((row, j) =>
        row.forEach(([x, y], i) =>
            chart.set(
                key(x, y),
                streetPaintUV(
                    "skin",
                    Math.sin(-Math.PI / 2 + (Math.PI * i) / meridians) *
                        section(skinRows[j])[1],
                    skinRows[j]
                )
            )
        )
    );
    const skinBase = new T.Color(rawSkin),
        tintedSkin = new T.Color();
    const fringe = p.hair.fringe.map(([x, y]) => [x, y]);
    d.s.vertexPaint = (x, v) => {
        const y = fromHeight(v),
            lateral = (x * 48) / width;
        if (y > 140) return rawSkin;
        const fringeY = margin(fringe, lateral);
        const contact =
            (1 - T.MathUtils.smoothstep(y - fringeY, -2, 9)) *
            T.MathUtils.smoothstep(y, 89, 108);
        return tintedSkin
            .setRGB(
                skinBase.r * (1 - 0.12 * contact),
                skinBase.g * (1 - 0.29 * contact),
                skinBase.b * (1 - 0.38 * contact)
            )
            .getHex();
    };
    d.s.printUV = (x, y) =>
        chart.get(key(x, y)) ??
        streetPaintUV("skin", (x * 48) / width, fromHeight(y));
    d.s.surfaceNormal = (x, y) => {
        const h = fromHeight(y),
            u = T.MathUtils.clamp(ux((x * 48) / width, h), -0.999, 0.999);
        const dx = new T.Vector3(...skull(Math.min(1, u + 0.04), h)).sub(
            new T.Vector3(...skull(Math.max(-1, u - 0.04), h))
        );
        const dy = new T.Vector3(...skull(u, Math.min(184, h + 1.7))).sub(
            new T.Vector3(...skull(u, Math.max(51, h - 1.7)))
        );
        return dx.cross(dy).normalize().toArray() as Point;
    };
    // The distance to the actual sagittal outline interpolates in drawing
    // units across the triangles, even where the nose or chin turns sharply.
    d.s.vertexAlpha = (_x, y, z) => {
        const h = fromHeight(y);
        if (h < 124) return 1;
        return T.MathUtils.clamp(
            (front(0, h)[2] - z) / (depth / 54) / 64,
            0,
            1
        );
    };
    d.s.surface(rows, p.colors.skin, false, "perimeter");
    d.s.vertexAlpha = undefined;
    d.s.surfaceNormal = undefined;
    d.s.printUV = () => streetPaintUV("skin", 37, 155);
    d.s.vertexPaint = () => rawSkin;
    const rear = skinRows.map((y) => {
        const [, w, fore, back] = section(y),
            side = sideDepth(fore, back, y);
        return Array.from({ length: 9 }, (_, i): Point => {
            const a = (Math.PI * i) / 8;
            if (i === 0 || i === 8) return skull(i === 0 ? 1 : -1, y);
            return [
                (width / 48) * w * Math.cos(a),
                height(y),
                ((side + (back - side) * Math.sin(a)) * depth) / 54,
            ];
        });
    });
    d.s.surface(rear, p.colors.skin, false, "perimeter");
    for (const j of [0, skinRows.length - 1]) {
        const ring = [...rows[j], ...rear[j].slice(1, -1)];
        const center: Point = [
            0,
            height(skinRows[j]) + (j === 0 ? -0.25 : 0.32),
            ring.reduce((s, v) => s + v[2], 0) / ring.length,
        ];
        d.s.triangles(
            ring.flatMap((v, k) => [center, v, ring[(k + 1) % ring.length]]),
            p.colors.skin
        );
    }
    // The shell follows the mandibular edge through a head turn. Tuck its
    // anterior wall inside the cheeks. The skin carries the nose profile.
    d.s.hasIllustratedHull = true;
    d.s.printUV = () => [silhouetteTile + 0.5, 0.5];
    d.s.vertexPaint = () => 0x483027;
    const edgeRows = fit.sections
        .filter(([y]) => y >= 144)
        .map(([y, w, fore, back]) => {
            const side = sideDepth(fore, back, y);
            return Array.from({ length: 25 }, (_, i): Point => {
                const a = -Math.PI / 2 + (Math.PI * 2 * (i % 24)) / 24,
                    c = Math.cos(a),
                    u = Math.sin(a);
                const v: Point =
                    c >= -1e-8
                        ? skull(u, y)
                        : [
                              (width / 48) * w * u,
                              height(y),
                              ((side + (back - side) * -c) * depth) / 54,
                          ];
                const tuck =
                    9.5 *
                    Math.max(0, c) ** 2 *
                    (1 - T.MathUtils.smoothstep(y, 157, 173));
                return [
                    v[0] + 1.18 * u,
                    v[1] + 1.44 * T.MathUtils.smoothstep(y, 143, 181),
                    v[2] +
                        (0.35 + 0.79 * T.MathUtils.smoothstep(y, 151, 162)) *
                            c -
                        tuck,
                ];
            });
        });
    d.s.surface(edgeRows, "#483027", false, "perimeter");
    const bottom = edgeRows.at(-1);
    d.s.surface(
        [
            bottom,
            bottom.map(
                ([, y]): Point => [
                    0,
                    y + 0.18,
                    ((fit.sections.at(-1)[2] + fit.sections.at(-1)[3]) *
                        0.5 *
                        depth) /
                        54,
                ]
            ),
        ],
        "#483027",
        false,
        "both"
    );
    for (const sign of [-1, 1]) {
        chart.clear();
        const columns = [
            11.1, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 35.5, 37.3,
            39.6,
        ];
        const eye = columns.map((x) => {
            const top = margin(upperLid, x),
                low = margin(lowerLid, x);
            return [0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = mix(top, low, f),
                    v = front(ux(sign * x, y), y);
                v[2] += 0.9 + 0.65 * Math.sin(f * Math.PI);
                chart.set(key(v[0], v[1]), streetPaintUV("eye", x, y));
                return v;
            });
        });
        d.s.printUV = (x, y) =>
            chart.get(key(x, y)) ?? streetPaintUV("eye", 24, 131);
        // Absolute highlights and sclera must survive a dye with a zero channel.
        const iris = parseInt(p.colors.iris.slice(1), 16);
        const pigment =
            (Math.max(7, iris >> 16) << 16) |
            (Math.max(7, (iris >> 8) & 255) << 8) |
            Math.max(7, iris & 255);
        d.s.vertexPaint = () => pigment;
        d.s.surface(eye, p.colors.iris, false, "perimeter");
    }
    d.s.vertexPaint = undefined;
    d.s.printUV = undefined;
}
