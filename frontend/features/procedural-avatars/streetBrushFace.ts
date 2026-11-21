import * as T from "three/webgpu";
import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import type { StreetPattern } from "./streetwearPattern";
import { inkPart } from "./streetInk";
import { prepareStreetBrushes } from "./garmentPrint";
import { streetPaintUV, margin } from "./streetBrush";
import { streetHeadForm, faceColumns, eyeColumns } from "./streetHeadForm";

const { lerp, smoothstep } = T.MathUtils;

/** Lay the topology along the drawing: the lids and the eyes use the same
 * two boundary curves. Their shared rim stays closed in both levels of detail. */
export function drawStreetBrushFace(d: Drawing, p: StreetPattern) {
    d.s.markInkPart(inkPart.head);
    prepareStreetBrushes();
    const form = streetHeadForm(p),
        { width, depth, chin } = p.head;
    const chart = new Map<string, [number, number]>();
    const key = (x: number, y: number) => Math.fround(x) + "," + Math.fround(y);
    const rawSkin = parseInt(p.colors.skin.slice(1), 16);
    const base = new T.Color(rawSkin),
        color = new T.Color();
    const fringe = p.hair.fringe.map(([x, y]) => [x, y]);
    const vertex = (col: number, y: number) => {
        const v = form.at(col, y);
        chart.set(key(v[0], v[1]), [form.lateral(col, y), y]);
        return v;
    };
    const author = (x: number, y: number) =>
        chart.get(key(x, y)) ?? [
            (x * 48) / width,
            51 + ((y - 51) * 133) / (chin - 51),
        ];
    d.s.sourcePaint = false;
    d.s.sculptedCartoon = false;
    d.s.thinSkinOutline = false;
    const complexion = (x: number, y: number, z: number) => {
        // The jaw turns away from the key light under the cheek. Carry
        // the same wash across the side seam and onto the submental plane.
        const underJaw = smoothstep(
            y + 0.48 * Math.abs(x) - 0.24 * (z - 40),
            167,
            184
        );
        const temple =
            0.11 *
            smoothstep(Math.abs(x), 25, 45) *
            (1 - smoothstep(Math.abs(y - 142), 5, 28));
        const shadow = 0.32 * underJaw + temple;
        const contact =
            (1 - smoothstep(y - margin(fringe, x), -2, 9)) *
            smoothstep(y, 89, 108);
        return color
            .setRGB(
                base.r * (1 - 0.12 * contact - 0.38 * shadow),
                base.g * (1 - 0.29 * contact - 0.69 * shadow),
                base.b * (1 - 0.38 * contact - 0.83 * shadow)
            )
            .getHex();
    };
    d.s.vertexPaint = (px, py, pz) => {
        const [x, y] = author(px, py);
        return complexion(x, y, (pz * 54) / depth);
    };
    d.s.printUV = (x, y) => {
        const [u, v] = author(x, y);
        return streetPaintUV("skin", u, v);
    };
    const seamNormal = (y: number, sign: number) => {
        const a = form.at(44, y - 0.55),
            b = form.at(44, y + 0.55);
        return new T.Vector3(sign * (b[1] - a[1]), a[0] - b[0], 0).normalize();
    };
    const normalOf =
        (field: typeof form.surface, joinTemple = false) =>
        (px: number, py: number): Point => {
            const [x, y] = author(px, py);
            const width = form.section(y)[0],
                u = x / width;
            // Average the broad cheek over its local control spacing. A
            // one-pixel derivative follows quantization in the drawing and
            // produces bands when those normals span a reduced triangle.
            const broad = joinTemple ? smoothstep(y, 137, 145) : 0;
            const radius =
                0.75 + broad * (1.3 + 3.0 * smoothstep(Math.abs(x), 5, 16));
            const point = (a: number, b: number) =>
                new T.Vector3(...form.position(a, b, field(a, b)));
            const across = point(Math.min(width, x + radius), y).sub(
                point(Math.max(-width, x - radius), y)
            );
            // Follow the same longitude down the taper. Sampling fixed x
            // beyond the jaw gives a normal from outside the head surface.
            const longitudinal = (h: number) =>
                point(u * form.section(h)[0], h);
            const down = longitudinal(Math.min(184, y + radius)).sub(
                longitudinal(Math.max(51, y - radius))
            );
            const n = across.cross(down).normalize();
            const edge = smoothstep(Math.abs(u), 0.9, 0.995);
            if (joinTemple && edge > 0)
                n.lerp(seamNormal(y, Math.sign(px)), edge).normalize();
            return n.toArray();
        };
    const fineDetail = d.s.fineDetail;
    d.s.fineDetail = true;
    d.s.surfaceNormal = normalOf(form.surface, true);
    // These interior meridians become the silhouette as the camera turns.
    // Keep the nose tip, philtrum, lip and chin after edge collapse.
    d.s.preserveVertex = (px, py) => {
        const [x, y] = author(px, py);
        const bridge = Math.abs(x) <= (form.section(y)[0] * 3.01) / 44;
        const radius = Math.abs(x) / form.section(y)[0];
        const cheekTurn =
            [149, 156, 165, 174, 181].includes(y) &&
            (Math.abs(radius - 0.705) < 0.009 ||
                Math.abs(radius - 0.41) < 0.009);
        return (
            y >= 139 &&
            (Math.abs(x) < 0.02 || (y <= 175 && bridge) || cheekTurn)
        );
    };
    // Use the same meridian on both sides of each lid. The two curves
    // coincide outside the eyes, closing the bridge and temples as well.
    const upper = [51, 64, 86, 104, 115, 121, 124, 126, 128, 130, 131.5];
    const lower = [
        131.5, 133.6, 136, 139, 143, 147, 149, 152, 156, 161, 165, 168, 171,
        174, 177, 181, 184,
    ];
    const ring = (y: number, above: boolean) =>
        faceColumns.map((col) => {
            const marginY = form.limits(col)[above ? 0 : 1];
            const t = above
                ? smoothstep(y, 116, 131.5)
                : 1 - smoothstep(y, 131.5, 145);
            return vertex(col, y + t * (marginY - 131.5));
        });
    const top = upper.map((y) => ring(y, true)),
        jaw = lower.map((y) => ring(y, false));
    d.s.surface(top, p.colors.skin, false, "perimeter");
    d.s.surface(jaw, p.colors.skin, false, "perimeter");
    d.s.surfaceNormal = undefined;
    const frontRings = [...top, ...jaw.slice(1)];
    const backPoint = (angle: number, y: number): Point => {
        const side = form.at(44, y),
            back = (form.section(y)[2] * depth) / 54;
        // The mandibular angle sits behind and below the cheek. Fill its
        // corners without changing the front width or the midline profile.
        const jaw =
            0.36 * Math.exp(-(((y - 164) / 9) ** 2)) * Math.sin(2 * angle) ** 2;
        return [
            side[0] * Math.cos(angle),
            side[1],
            lerp(lerp(side[2], back, Math.sin(angle)), back, jaw),
        ];
    };
    const rearChart = new Map<string, [number, number]>();
    const rear = frontRings.map((row) => {
        const right = row.at(-1),
            [, y] = author(right[0], right[1]);
        // Sample the ellipse where it turns into silhouette. These two
        // longitudes normally fall between the side and quarter-circle rows.
        const back = (form.section(y)[2] * depth) / 54;
        const tangent = Math.atan2(
            Math.max(0, right[2] - back) * Math.tan(Math.PI / 5),
            right[0]
        );
        const middle = (tangent + Math.PI / 2) / 2;
        const angles = [
            0,
            tangent,
            middle,
            Math.PI / 2,
            Math.PI - middle,
            Math.PI - tangent,
            Math.PI,
        ];
        return angles.map((angle, i) => {
            const v =
                i === 0
                    ? right
                    : i === angles.length - 1
                    ? row[0]
                    : backPoint(angle, y);
            rearChart.set(key(v[0], v[1]), [angle, y]);
            return v;
        });
    });
    d.s.preserveVertex = (px, py) => {
        const [a, y] = rearChart.get(key(px, py));
        return (
            [149, 156, 161, 168, 174, 177, 181].includes(y) && a !== Math.PI / 2
        );
    };
    d.s.surfaceNormal = (px, py) => {
        const [angle, y] = rearChart.get(key(px, py));
        if (angle === 0 || angle === Math.PI)
            return seamNormal(y, Math.sign(px)).toArray();
        const point = (a: number, h: number) =>
            new T.Vector3(...backPoint(a, h));
        const across = point(angle + 0.01, y).sub(point(angle - 0.01, y));
        return across
            .cross(point(angle, y + 0.55).sub(point(angle, y - 0.55)))
            .normalize()
            .toArray();
    };
    d.s.printUV = (px, py) => {
        const [angle, y] = rearChart.get(key(px, py));
        return streetPaintUV(
            "skin",
            Math.sign(Math.cos(angle)) * form.section(y)[0],
            y
        );
    };
    d.s.vertexPaint = (x, y, z) =>
        complexion(
            (x * 48) / width,
            rearChart.get(key(x, y))[1],
            (z * 54) / depth
        );
    d.s.surface(rear, p.colors.skin, false, "perimeter");
    d.s.preserveVertex = undefined;
    d.s.vertexPaint = () => rawSkin;
    d.s.surfaceNormal = undefined;
    d.s.printUV = () => streetPaintUV("skin", 37, 155);
    for (const j of [0, rear.length - 1]) {
        const loop = [...frontRings[j], ...rear[j].slice(1, -1)];
        const center: Point = [
            0,
            loop[0][1] + (j === 0 ? -0.2 : 0.26),
            loop.reduce((s, v) => s + v[2], 0) / loop.length,
        ];
        d.s.triangles(
            loop.flatMap((point, i) => [
                center,
                point,
                loop[(i + 1) % loop.length],
            ]),
            p.colors.skin
        );
    }
    const iris = new T.Color(p.colors.iris);
    iris.r = Math.max(0.0022, iris.r);
    iris.g = Math.max(0.0022, iris.g);
    iris.b = Math.max(0.0022, iris.b);
    const pigment = iris.getHex();
    d.s.surfaceNormal = normalOf(form.cornea);
    for (const side of [-1, 1]) {
        const cols =
            side === 1
                ? eyeColumns
                : eyeColumns
                      .slice()
                      .reverse()
                      .map((x) => -x);
        const eye = [0, 0.22, 0.5, 0.78, 1].map((t) =>
            cols.map((x) => {
                const [a, b] = form.limits(x);
                return vertex(x, lerp(a, b, t));
            })
        );
        d.s.printUV = (x, y) => {
            const [u, v] = author(x, y);
            return streetPaintUV("eye", Math.abs(u), v);
        };
        d.s.vertexPaint = () => pigment;
        d.s.surface(eye, p.colors.iris, false, "perimeter");
    }
    d.s.fineDetail = fineDetail;
    d.s.printUV = undefined;
    d.s.vertexPaint = undefined;
    d.s.surfaceNormal = undefined;
}
