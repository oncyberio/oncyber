import { MathUtils } from "three/webgpu";
import type { Point } from "./sculpt";
import { lowerLid, margin, upperLid } from "./streetBrush";
import type { StreetPattern } from "./streetwearPattern";

const { clamp, lerp, smoothstep } = MathUtils;
const inner = upperLid[0][0],
    outer = upperLid.at(-1)[0];
export const eyeColumns = [inner, 14.5, 18, 21, 24, 27.4, 31, 34, 36.5, outer];
const halfFront = [0, 3, 6.8, 9, ...eyeColumns, 42, 44];
export const faceColumns = [
    ...halfFront
        .slice(1)
        .reverse()
        .map((x) => -x),
    ...halfFront,
];

/** Polynomial smooth union of two upper envelopes, with a blend width in drawing units. */
function union(a: number, b: number, width: number) {
    const h = Math.max(width - Math.abs(a - b), 0) / width;
    return Math.max(a, b) + 0.25 * width * h * h;
}

/** Work in front-view drawing units. Sample the construction once into the
 * rigged mesh. Each horizontal slice has a rounded cranium, two malar pads,
 * the muzzle and the nose. Eyelid margins belong to the socket and cornea. */
export function streetHeadForm(p: StreetPattern) {
    const { width, depth, chin, eyeGap, eyeLine } = p.head,
        fit = p.faceFit;
    const paths = ([1, 2, 3] as const).map((i) =>
        fit.sections.map((row) => [row[0], row[i]])
    );
    const cache = new Map<number, number[]>();
    function section(y: number) {
        const cached = cache.get(y);
        if (cached) return cached;
        const row = paths.map((path) => margin(path, y));
        cache.set(y, row);
        return row;
    }
    const height = (y: number) => 51 + ((y - 51) * (chin - 51)) / 133;
    const facialX = (x: number, y: number) =>
        ((x +
            Math.sign(x) *
                (eyeGap - 48) *
                0.5 *
                smoothstep(Math.abs(x), 0, inner) *
                (1 - smoothstep(Math.abs(y - 132), 8, 22))) *
            width) /
        48;
    const position = (x: number, y: number, z: number): Point => [
        facialX(x, y),
        height(y) +
            (eyeLine - 132) * (1 - smoothstep(Math.abs(y - 132), 8, 22)),
        (z * depth) / 54,
    ];
    // Preserve the measured eye opening at the eye line. Let the surrounding
    // meridians taper together toward the underside of the chin.
    function lateral(col: number, y: number) {
        const w = section(y)[0],
            a = Math.abs(col);
        const anchored =
            a <= outer ? a : lerp(outer, w, (a - outer) / (44 - outer));
        const band =
            (1 - smoothstep(Math.abs(y - 131), 7, 19)) *
            smoothstep(w, outer, outer + 1.5);
        return Math.sign(col) * lerp((w * a) / 44, anchored, band);
    }
    const center =
        fit.orbit.reduce((sum, row) => sum + row[1], 0) / fit.orbit.length -
        1.8;
    const span = 26;
    const arc = (x: number) =>
        Math.sqrt(Math.max(0.018, 1 - ((x - center) / span) ** 2));
    const station = fit.orbit.reduce((a, b) =>
        Math.abs(b[0] - 131) < Math.abs(a[0] - 131) ? b : a
    );
    const sag = clamp(
        (station[3] - station[4]) /
            Math.max(0.02, arc(station[1]) - arc(station[2])),
        16,
        43
    );
    function cornea(x: number, y: number) {
        const a = Math.abs(x);
        // The cornea sits in front of the sclera. Beyond the iris the eye
        // turns back towards the temple, exposing white on the side camera.
        const limbus = station[2] - 1.5;
        const roll = union(a - limbus, 0, 2.5);
        const recession = roll * 0.74;
        return (
            station[3] +
            sag * (arc(a) - arc(station[1])) -
            recession -
            0.026 * (y - 131.3) ** 2
        );
    }
    function limits(x: number) {
        const a = clamp(Math.abs(x), inner, outer);
        return [margin(upperLid, a), margin(lowerLid, a)];
    }
    function relief(x: number, y: number) {
        const [w, fore, back] = section(y),
            a = Math.abs(x),
            u = clamp(a / w, 0, 1);
        const side = lerp(fore, back, 0.52 + 0.25 * smoothstep(y, 159, 175));
        const nose =
            13.5 * Math.exp(-(((y - 149) / 9.6) ** 2)) +
            3.5 * Math.exp(-(((y - 137) / 15) ** 2));
        const forehead = fore - nose;
        const cranium =
            side + (forehead - side) * Math.max(0, 1 - u * u) ** 0.84;
        // Start each pad inside the skull. Only its outermost few units
        // emerge, leaving the temple and underside of the jaw rounded.
        const cheek =
            forehead -
            5.8 -
            13 * ((a - 20) / 13) ** 2 -
            10 * ((y - 147) / 14) ** 2;
        const muzzle =
            fore - 0.95 - 6 * (x / 11) ** 2 - 8 * ((y - 166) / 8.8) ** 2;
        const ball =
            cranium +
            nose *
                Math.exp(-((x / (5.8 + 1.8 * smoothstep(y, 140, 151))) ** 2));
        const z = union(union(ball, cheek, 3.4), muzzle, 1.8);
        // The brow and cheek turn around the entire socket. Interpolating
        // from a narrow aperture straight into the skull creates deep dimples.
        const orbital = Math.min(
            z,
            cornea(x, 131) + 1.0 + 0.18 * Math.max(0, inner - a) ** 2
        );
        const band =
            (1 - smoothstep(Math.abs(y - 131.5), 1, 19)) *
            smoothstep(a, 5, 15) *
            (1 - smoothstep(u, 0.87, 1));
        return lerp(Math.min(fore, z), orbital, band);
    }
    function surface(x: number, y: number) {
        const [top, bottom] = limits(x),
            a = Math.abs(x);
        const horizontal = Math.max(inner - a, a - outer, 0);
        const vertical = Math.max(top - y, y - bottom, 0);
        const d = Math.hypot(horizontal, vertical);
        let base = relief(x, y);
        const eyeball = cornea(x, y);
        if (d <= 0) return eyeball;
        // Continue the outside edge as one orbital rim. A cheek that comes
        // forward again immediately behind the outer canthus hides the white.
        const temple =
            smoothstep(a, 28, 35) * (1 - smoothstep(Math.abs(y - 131), 6, 14));
        base = lerp(base, Math.min(base, eyeball + 0.45 * d), temple);
        // A shallow raised lid surrounds the cut. At its margin the skin
        // and the eye share exactly the same point and skinning weights.
        const extent = y < top ? 11.5 : 10.2;
        const ledge = 0.65 * Math.sin(Math.PI * clamp(d / extent, 0, 1));
        const arch =
            smoothstep(a, inner, inner + 4) *
            (1 - smoothstep(a, outer - 4, outer));
        const roll = d / 1.52;
        const lid = (y < top ? 1.2 : 0.62) * roll * Math.exp(1 - roll) * arch;
        return lerp(eyeball + ledge, base, smoothstep(d, 0, extent)) + lid;
    }
    function at(col: number, y: number) {
        const x = lateral(col, y);
        return position(x, y, surface(x, y));
    }
    return { section, lateral, position, limits, surface, cornea, at };
}
