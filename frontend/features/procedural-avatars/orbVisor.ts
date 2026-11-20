import { Color, MathUtils } from "three/webgpu";
import families from "./families.json";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";

const lensLift = 3.5;

export interface OrbVisor {
    contact?: { strength: number; width: number };
    /** Omit the band when both temples visibly continue in the orb pigment. */
    strap?: false;
    rim?: {
        columns: [number, number, number][];
        upper: string;
        lower: string;
        glyph: string;
    };
    center: number;
    span: number;
    rows: [number, number][];
    marks: [number, number, number, number][];
}

/** Three measured slopes describe the light on a closed sphere in rest space.
 * The forehead and chin dye samples anchor the two ends of the tint gradient. */
export function orbIrradiance(
    [side, vertical, forward]: [number, number, number],
    [cx, cy, cz]: Point,
    [rx, ry, rz]: Point
) {
    const forehead = -0.63,
        chin = 0.72;
    const foreheadZ = Math.sqrt(1 - forehead * forehead);
    const chinZ = Math.sqrt(1 - chin * chin);
    return (x: number, y: number, z: number) => {
        const u = (x - cx) / rx,
            v = (y - cy) / ry,
            w = (z - cz) / rz;
        const blend = MathUtils.smoothstep(v, -0.41, 0.64);
        const anchorY = MathUtils.lerp(forehead, chin, blend);
        const anchorZ = MathUtils.lerp(foreheadZ, chinZ, blend);
        // Continue a single frontal key into a soft fill on the hidden side.
        const depth = w >= 0 ? w : 0.22 * Math.tanh(w / 0.22);
        const logLight =
            side * u + vertical * (v - anchorY) + forward * (depth - anchorZ);
        return Math.exp(MathUtils.clamp(logLight, -1.18, 0.65));
    };
}

/** Encode the measured lens shadow on the closed orb in its rest frame.
 * The gradient follows its own head through a turn or a crowd instance. */
export function orbContactUV(visor: OrbVisor) {
    if (!visor.contact) return;
    const { strength, width } = visor.contact;
    if (visor.rim) {
        const cols = visor.rim.columns;
        return (x: number, y: number, z: number): [number, number] => {
            const j = cols.findIndex(([u]) => u >= x);
            if (j < 1) return [0, 1];
            const [x0, , h0] = cols[j - 1],
                [x1, , h1] = cols[j];
            const distance = Math.min(x - cols[0][0], cols.at(-1)[0] - x);
            const side = MathUtils.clamp(distance / 0.13, 0, 1);
            const front = MathUtils.clamp((z - 0.08) / 0.42, 0, 1);
            const hem = MathUtils.lerp(h0, h1, (x - x0) / (x1 - x0));
            return [strength * side * front, (y - hem) / width];
        };
    }
    const [, , rx, ry] = families.sunshine.crownRoot;
    return (x: number, y: number, z: number): [number, number] => {
        const raised = visor.strap !== false;
        const offset =
            (x / (raised ? 1 + lensLift / rx : 1) - visor.center) / visor.span;
        const knot =
            Math.max(0, Math.min(1, 0.5 + 0.5 * offset)) *
            (visor.rows.length - 1);
        const i = Math.min(Math.floor(knot), visor.rows.length - 2);
        const hem =
            visor.rows[i][1] +
            (knot - i) * (visor.rows[i + 1][1] - visor.rows[i][1]);
        const fade =
            Math.min(1, Math.max(0, (1.04 - Math.abs(offset)) / 0.18)) *
            Math.min(1, Math.max(0, (z - 0.08) / 0.42));
        return [
            strength * fade,
            (y - hem * (raised ? 1 + lensLift / ry : 1)) / width,
        ];
    };
}

/** Front artwork defines the lens hem and glyphs. All layers share the orb's
 * curvature, including the strap beyond the silhouette of a frontal drawing. */
export function drawOrbVisor(
    d: Drawing,
    visor: OrbVisor,
    ink: string,
    white: string
) {
    const [ox, oy, rx, ry] = families.sunshine.crownRoot;
    const glyph = families.sunshine.visorGlyph;
    const point = (u: number, v: number, lift: number): Point => {
        const longitude = Math.asin(
            Math.max(-0.998, Math.min(0.998, u / Math.sqrt(1 - v * v)))
        );
        return at(longitude, v, lift);
    };
    const at = (angle: number, v: number, lift: number): Point => {
        const radial = Math.sqrt(1 - v * v);
        return [
            ox + (rx + lift) * radial * Math.sin(angle),
            oy + (ry + lift) * v,
            -5 + (60.4 + lift) * radial * Math.cos(angle),
        ];
    };
    const quads: Point[] = [];
    const quad = (a: Point, b: Point, c: Point, e: Point) =>
        quads.push(a, b, c, a, c, e);
    const measured = visor.rim;
    const columns = measured?.columns;
    const rim = columns
        ? columns.map(([, top, bottom]) => [top, bottom])
        : visor.rows;
    const band = visor.strap !== false;
    const level = (rim[0][0] + rim[rim.length - 1][0]) * 0.5 + 0.04;
    const strapTop = measured ? 0.5 * (rim[0][0] + rim.at(-1)[0]) : level;
    const strapBottom = measured
        ? Math.max(strapTop + 0.06, 0.5 * (rim[0][1] + rim.at(-1)[1]))
        : level + 0.105;
    for (let i = 0; band && i < 32; i++) {
        const a = (i * Math.PI) / 16,
            b = ((i + 1) * Math.PI) / 16;
        quad(
            at(a, strapTop, 2),
            at(b, strapTop, 2),
            at(b, strapBottom, 2),
            at(a, strapBottom, 2)
        );
    }
    const knot = (i: number, t: number, lift: number) =>
        point(
            (columns?.[i][0] ??
                visor.center + visor.span * ((2 * i) / (rim.length - 1) - 1)) /
                (band && !measured ? 1 : 1 + lensLift / rx),
            (rim[i][0] * (1 - t) + rim[i][1] * t) /
                (band && !measured ? 1 : 1 + lensLift / ry),
            lift
        );
    for (let i = 0; i < rim.length - 1; i++) {
        for (let j = 0; j < 4; j++) {
            const a = j / 4,
                b = (j + 1) / 4;
            quad(
                knot(i, a, lensLift),
                knot(i + 1, a, lensLift),
                knot(i + 1, b, lensLift),
                knot(i, b, lensLift)
            );
        }
        for (const edge of [0, 1])
            quad(
                knot(i, edge, lensLift),
                knot(i + 1, edge, lensLift),
                knot(i + 1, edge, 0.2),
                knot(i, edge, 0.2)
            );
    }
    for (const i of [0, rim.length - 1])
        quad(
            knot(i, 0, lensLift),
            knot(i, 1, lensLift),
            knot(i, 1, 0.2),
            knot(i, 0, 0.2)
        );
    d.s.fineDetail = true;
    const gradient = d.s.gradient;
    if (measured) {
        // Keep the lens paint role so the family fitter can register the eye frame.
        white = new Color(measured.glyph).getStyle();
        d.s.gradient = {
            top: oy - ry * 0.16,
            bottom: oy + ry * 0.2,
            from: new Color(measured.upper).getStyle(),
            to: new Color(measured.lower).getStyle(),
        };
    }
    d.s.triangles(quads, ink);
    d.s.gradient = gradient;
    quads.length = 0;
    for (const [cx, cy, rx, ry] of visor.marks)
        for (const sign of [-1, 1]) {
            const stroke = (t: number, w: number) =>
                point(
                    cx + rx * (t + w * glyph.stroke),
                    cy + ry * sign * (t - w * glyph.stroke),
                    glyph.lift
                );
            for (let i = 0; i < 4; i++) {
                const a = i * 0.5 - 1,
                    b = a + 0.5;
                quad(stroke(a, -1), stroke(b, -1), stroke(b, 1), stroke(a, 1));
            }
        }
    // Keep the tiny projected strokes intact even when the crowd LOD
    // simplifies the neighboring shell differently.
    d.s.preserveVertex = () => true;
    d.s.triangles(quads, white);
    d.s.preserveVertex = undefined;
    d.s.fineDetail = false;
}
