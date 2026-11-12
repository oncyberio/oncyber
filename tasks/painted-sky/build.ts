/**
 * Builds the Starry Night skydome's brush-stroke file.
 *
 *   cd tasks/painted-sky && npm ci && npm run build
 *
 * Reads the destination's 360° sky image (inputs/sky-envmap-2048x1024.jpg,
 * the equirect the dome shows today) and paints it again as strokes, coarse
 * to fine: dark ground under the horizon, big underpaint, a body layer,
 * linework where the picture changes, hard yellow cores in the stars and
 * moon, and accents in their halos and the swirls. Each stroke runs along the paint's flow (the smoothed structure
 * tensor of the image), stops where the colour changes, bends with the flow
 * and takes the image's colour there. Positions come from a jittered grid the
 * runtime derives from the same cell indices, so the file stores only which
 * cells hold a stroke plus three bytes per stroke (strokeFormat.ts).
 *
 * Writes frontend/public/textures/painted-sky/starry-night-sky.<hash>.bin
 * (gzipped) and frontend/features/paintedSky/strokeFile.ts, which names it.
 * The output depends only on the inputs: run it twice, get the same file.
 */
import sharp from "sharp";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
    ANGLE_STEPS,
    BEND_STEPS,
    LENGTH_STEPS,
    LENGTH_SCALE_MIN,
    LENGTH_SCALE_STEP,
    MAX_BEND,
    cellCentre,
    encodeStrokes,
    hashCell,
    strokesPerLayer,
    type StrokeLayer,
} from "../../frontend/features/paintedSky/strokeFormat.ts";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const SOURCE = path.join(HERE, "inputs/sky-envmap-2048x1024.jpg");
const OUT_DIR = path.join(ROOT, "frontend/public/textures/painted-sky");
const OUT_NAME = "starry-night-sky";
const MODULE = path.join(ROOT, "frontend/features/paintedSky/strokeFile.ts");

const DEG = Math.PI / 180;
/** Colours the strokes share (k-means over all of them). */
const PALETTE_SIZE = 128;

type LayerPlan = {
    name: string;
    thetaMin: number;
    thetaMax: number;
    /** Cell size (radians): one stroke at most per cell. */
    spacing: number;
    length: number;
    width: number;
    /**
     * Blur (image px) of the colour the strokes take, of the colour that
     * decides how long they run, and of the flow they follow.
     */
    colourSigma: number;
    lengthSigma: number;
    flowSigma: number;
    /** How likely a cell is to hold a stroke: base, and from the detail. */
    keepBase: number;
    detailFrom?: number;
    detailTo?: number;
    /** Extra keep for stars, moon and light swirls (0–1 weight). */
    accent?: number;
    /** Keep for the yellow cores of stars and moon (0–1 weight). */
    core?: number;
    /** Colour pushed away from the layer below by this factor. */
    contrast?: number;
    /** Shortest length step (a covering layer must not leave gaps). */
    minLengthStep?: number;
    /** Half the angle, length and bend steps (fine strokes). */
    coarseShape?: boolean;
};

// Image px per radian (the same both ways in an equirect).
const W = 2048;
const H = 1024;
const PX = H / Math.PI;

const LAYERS: LayerPlan[] = [
    {
        // under the painted horizon the image is black, hidden by the
        // world's mountains: a few big dark strokes stand in for it
        name: "ground",
        thetaMin: 94 * DEG,
        thetaMax: 180 * DEG,
        spacing: 5 * DEG,
        length: 16 * DEG,
        width: 10 * DEG,
        minLengthStep: 4,
        colourSigma: 16,
        lengthSigma: 16,
        flowSigma: 12,
        keepBase: 1,
    },
    {
        name: "underpaint",
        thetaMin: 0,
        thetaMax: 99 * DEG,
        spacing: 2.2 * DEG,
        length: 5 * DEG,
        width: 2.4 * DEG,
        minLengthStep: 2,
        colourSigma: 4,
        lengthSigma: 4,
        flowSigma: 8,
        keepBase: 1,
    },
    {
        name: "body",
        thetaMin: 0,
        thetaMax: 97 * DEG,
        spacing: 0.9 * DEG,
        length: 3.2 * DEG,
        width: 0.85 * DEG,
        colourSigma: 1.2,
        lengthSigma: 2,
        flowSigma: 5,
        keepBase: 0.8,
        contrast: 1.45,
        detailFrom: 0.02,
        detailTo: 0.08,
    },
    {
        name: "linework",
        thetaMin: 0,
        thetaMax: 96 * DEG,
        spacing: 0.62 * DEG,
        length: 2.2 * DEG,
        width: 0.42 * DEG,
        colourSigma: 0.5,
        lengthSigma: 1,
        flowSigma: 5,
        keepBase: 0.62,
        contrast: 1.8,
        coarseShape: true,
        detailFrom: 0.04,
        detailTo: 0.14,
        accent: 0.9,
    },
    {
        // the stars' and moon's yellow cores: small, dense, bright strokes
        // of the yellowest paint around, so the cores stay hard and bright
        name: "cores",
        thetaMin: 0,
        thetaMax: 96 * DEG,
        spacing: 0.2 * DEG,
        length: 0.6 * DEG,
        width: 0.22 * DEG,
        colourSigma: 0.3,
        lengthSigma: 0.6,
        flowSigma: 2.5,
        keepBase: 0,
        coarseShape: true,
        core: 1,
    },
    {
        name: "accent",
        thetaMin: 0,
        thetaMax: 96 * DEG,
        spacing: 0.3 * DEG,
        length: 1.1 * DEG,
        width: 0.24 * DEG,
        colourSigma: 0.4,
        lengthSigma: 0.7,
        flowSigma: 2.5,
        keepBase: 0,
        contrast: 1.8,
        coarseShape: true,
        detailFrom: 0.2,
        detailTo: 0.42,
        accent: 1,
    },
];

// ---- image helpers (planes of W × H floats, x wraps, y clamps) ----

type Plane = Float32Array;

function boxBlur(src: Plane, radius: number): Plane {
    if (radius < 1) return src.slice();
    const tmp = new Float32Array(W * H);
    const out = new Float32Array(W * H);
    const n = 2 * radius + 1;
    for (let y = 0; y < H; y++) {
        const row = y * W;
        let sum = 0;
        for (let x = -radius; x <= radius; x++) sum += src[row + ((x + W) % W)];
        for (let x = 0; x < W; x++) {
            tmp[row + x] = sum / n;
            sum +=
                src[row + ((x + radius + 1) % W)] -
                src[row + ((x - radius + W) % W)];
        }
    }
    for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let y = -radius; y <= radius; y++)
            sum += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
        for (let y = 0; y < H; y++) {
            out[y * W + x] = sum / n;
            sum +=
                tmp[Math.min(H - 1, y + radius + 1) * W + x] -
                tmp[Math.max(0, y - radius) * W + x];
        }
    }
    return out;
}

/** Three box passes: close to a Gaussian of this sigma (px). */
function blur(src: Plane, sigma: number): Plane {
    if (sigma <= 0.3) return src.slice();
    const r = Math.max(
        1,
        Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2)
    );
    return boxBlur(boxBlur(boxBlur(src, r), r), r);
}

function sample(plane: Plane, x: number, y: number) {
    x = ((x % W) + W) % W;
    y = Math.min(H - 1, Math.max(0, y));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = (x0 + 1) % W;
    const y1 = Math.min(H - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;
    const a = plane[y0 * W + x0] * (1 - fx) + plane[y0 * W + x1] * fx;
    const b = plane[y1 * W + x0] * (1 - fx) + plane[y1 * W + x1] * fx;
    return a * (1 - fy) + b * fy;
}

type Rgb = [Plane, Plane, Plane];

const blurRgb = (rgb: Rgb, sigma: number): Rgb =>
    rgb.map((p) => blur(p, sigma)) as Rgb;

const sampleRgb = (
    rgb: Rgb,
    x: number,
    y: number
): [number, number, number] => [
    sample(rgb[0], x, y),
    sample(rgb[1], x, y),
    sample(rgb[2], x, y),
];

const colourDistance = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The paint's flow: the way strokes run (along the edges, across the gradient). */
function flowField(lum: Plane, sigma: number) {
    const xx = new Float32Array(W * H);
    const yy = new Float32Array(W * H);
    const xy = new Float32Array(W * H);
    const at = (x: number, y: number) =>
        lum[Math.min(H - 1, Math.max(0, y)) * W + ((x + W) % W)];
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const gx =
                at(x + 1, y - 1) +
                2 * at(x + 1, y) +
                at(x + 1, y + 1) -
                at(x - 1, y - 1) -
                2 * at(x - 1, y) -
                at(x - 1, y + 1);
            const gy =
                at(x - 1, y + 1) +
                2 * at(x, y + 1) +
                at(x + 1, y + 1) -
                at(x - 1, y - 1) -
                2 * at(x, y - 1) -
                at(x + 1, y - 1);
            const i = y * W + x;
            xx[i] = gx * gx;
            yy[i] = gy * gy;
            xy[i] = gx * gy;
        }
    const sxx = blur(xx, sigma);
    const syy = blur(yy, sigma);
    const sxy = blur(xy, sigma);
    return {
        /** Image-space angle of the flow at (x, y), radians (mod π). */
        angle(x: number, y: number) {
            const a = sample(sxx, x, y);
            const b = sample(syy, x, y);
            const c = sample(sxy, x, y);
            return 0.5 * Math.atan2(2 * c, a - b) + Math.PI / 2;
        },
        /** 0 (no direction) to 1 (one clear direction). */
        coherence(x: number, y: number) {
            const a = sample(sxx, x, y);
            const b = sample(syy, x, y);
            const c = sample(sxy, x, y);
            const root = Math.sqrt((a - b) ** 2 + 4 * c * c);
            return a + b > 1e-6 ? root / (a + b) : 0;
        },
    };
}

/** Wraps an orientation difference into (−π/2, π/2]. */
const wrapHalfTurn = (a: number) => {
    a = (a + Math.PI / 2) % Math.PI;
    if (a < 0) a += Math.PI;
    return a - Math.PI / 2;
};

// ---- palette (k-means in sRGB, deterministic start) ----

function palette(colours: number[][], size: number) {
    const centres: number[][] = [];
    // start from colours spread through the sorted-by-luma list
    const sorted = colours
        .map((c, i) => [0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], i])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (let k = 0; k < size; k++)
        centres.push(
            colours[
                sorted[Math.floor(((k + 0.5) / size) * sorted.length)][1]
            ].slice()
        );
    const assign = new Uint16Array(colours.length);
    for (let iteration = 0; iteration < 16; iteration++) {
        const sums = centres.map(() => [0, 0, 0, 0]);
        colours.forEach((c, i) => {
            let best = 0;
            let bestD = Infinity;
            for (let k = 0; k < size; k++) {
                const e = centres[k];
                const d =
                    (c[0] - e[0]) ** 2 +
                    (c[1] - e[1]) ** 2 +
                    (c[2] - e[2]) ** 2;
                if (d < bestD) {
                    bestD = d;
                    best = k;
                }
            }
            assign[i] = best;
            const s = sums[best];
            s[0] += c[0];
            s[1] += c[1];
            s[2] += c[2];
            s[3]++;
        });
        sums.forEach((s, k) => {
            if (s[3]) centres[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
        });
    }
    return { centres, assign };
}

// ---- build ----

const started = Date.now();
const { data, info } = await sharp(SOURCE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
if (info.width !== W || info.height !== H)
    throw new Error(`expected ${W}×${H}, got ${info.width}×${info.height}`);
const rgb: Rgb = [0, 1, 2].map((c) => {
    const p = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) p[i] = data[i * 3 + c] / 255;
    return p;
}) as Rgb;
const lumRaw = new Float32Array(W * H);
for (let i = 0; i < W * H; i++)
    lumRaw[i] = 0.3 * rgb[0][i] + 0.59 * rgb[1][i] + 0.11 * rgb[2][i];
const lum = blur(lumRaw, 0.8);

/** Stars, moon and the pale swirls: bright, or yellow. */
const accentRaw = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
    const r = rgb[0][i];
    const g = rgb[1][i];
    const b = rgb[2][i];
    const yellow = Math.max(0, (r + g) / 2 - b - 0.05) * 3;
    const bright = Math.max(0, lumRaw[i] - 0.55) * 3;
    accentRaw[i] = Math.min(1, yellow + bright);
}
const accent = blur(accentRaw, 2);
/** Strongly yellow: the cores of stars and moon. */
const yellowness = (c: number[]) => Math.max(0, (c[0] + c[1]) / 2 - c[2]);
const coreRaw = new Float32Array(W * H);
for (let i = 0; i < W * H; i++)
    coreRaw[i] = Math.min(
        1,
        Math.max(0, yellowness([rgb[0][i], rgb[1][i], rgb[2][i]]) - 0.18) * 4
    );
const core = blur(coreRaw, 1);

const references = new Map<number, Rgb>();
const reference = (sigma: number) => {
    if (!references.has(sigma)) references.set(sigma, blurRgb(rgb, sigma));
    return references.get(sigma);
};

type Stroke = {
    angle: number;
    shape: number;
    colour: number[];
};

const layers: StrokeLayer[] = [];
const occupancyBits: number[] = [];
const strokes: Stroke[] = [];

LAYERS.forEach((plan, layerIndex) => {
    const rows = Math.max(
        1,
        Math.round((plan.thetaMax - plan.thetaMin) / plan.spacing)
    );
    const rowHeight = (plan.thetaMax - plan.thetaMin) / rows;
    const rowCells: number[] = [];
    for (let r = 0; r < rows; r++) {
        const theta = plan.thetaMin + (r + 0.5) * rowHeight;
        rowCells.push(
            Math.max(
                3,
                Math.round((2 * Math.PI * Math.sin(theta)) / plan.spacing)
            )
        );
    }
    const layer: StrokeLayer = {
        thetaMin: plan.thetaMin,
        thetaMax: plan.thetaMax,
        length: plan.length,
        width: plan.width,
        rowCells,
    };
    // the file stores f32: plan with what the runtime will read back
    layer.thetaMin = Math.fround(layer.thetaMin);
    layer.thetaMax = Math.fround(layer.thetaMax);
    layer.length = Math.fround(layer.length);
    layer.width = Math.fround(layer.width);
    layers.push(layer);

    const ref = reference(plan.colourSigma);
    const lengthRef = reference(plan.lengthSigma);
    // what the layer below already shows: detail is what this one adds
    const below =
        layerIndex > 0 ? reference(LAYERS[layerIndex - 1].colourSigma) : null;
    const flow = flowField(lum, plan.flowSigma);
    const at = { theta: 0, phi: 0 };
    let kept = 0;
    for (let row = 0; row < rows; row++)
        for (let column = 0; column < rowCells[row]; column++) {
            cellCentre(layer, layerIndex, row, column, at);
            const x = (at.phi / (2 * Math.PI)) * W;
            const y = (at.theta / Math.PI) * H;
            const centre = sampleRgb(lengthRef, x, y);
            let keep = plan.keepBase;
            if (below && plan.detailTo) {
                const detail = colourDistance(centre, sampleRgb(below, x, y));
                keep +=
                    (1 - plan.keepBase) *
                    Math.min(
                        1,
                        Math.max(
                            0,
                            (detail - plan.detailFrom) /
                                (plan.detailTo - plan.detailFrom)
                        )
                    );
            }
            if (plan.accent)
                keep = Math.max(
                    keep,
                    // the cores have their own layer below
                    plan.accent *
                        sample(accent, x, y) *
                        (1 - sample(core, x, y))
                );
            if (plan.core)
                keep = Math.max(keep, plan.core * sample(core, x, y));
            const roll = hashCell(layerIndex + 1001, row, column) / 4294967296;
            const filled = roll < keep;
            occupancyBits.push(filled ? 1 : 0);
            if (!filled) continue;
            kept++;

            // the stroke runs along the flow; on the sphere, image x shrinks
            // by sin(theta), so convert the angle to the local east/south frame
            const sinTheta = Math.max(0.02, Math.sin(at.theta));
            const psi = flow.angle(x, y);
            const alpha = Math.atan2(Math.sin(psi), Math.cos(psi) * sinTheta);
            // image px for an arc of `arc` radians along the stroke
            const step = (arc: number, a: number) => [
                (Math.cos(a) * arc * PX) / sinTheta,
                Math.sin(a) * arc * PX,
            ];
            // longest stroke whose ends still have the colour of its middle
            const coherence = flow.coherence(x, y);
            let lengthStep = LENGTH_STEPS - 1;
            for (; lengthStep > (plan.minLengthStep ?? 0); lengthStep--) {
                const scale = LENGTH_SCALE_MIN + lengthStep * LENGTH_SCALE_STEP;
                // a stroke with no clear direction stays short
                if (scale > 0.75 + coherence * 1.2) continue;
                const [dx, dy] = step((plan.length * scale) / 2, alpha);
                const a = sampleRgb(lengthRef, x + dx, y + dy);
                const b = sampleRgb(lengthRef, x - dx, y - dy);
                const limit = 0.09 + 0.06 * (1 - layerIndex / LAYERS.length);
                if (
                    colourDistance(a, centre) < limit &&
                    colourDistance(b, centre) < limit
                )
                    break;
            }
            const scale = LENGTH_SCALE_MIN + lengthStep * LENGTH_SCALE_STEP;
            // bend: how far the flow turns between the stroke's two ends
            const [dx, dy] = step((plan.length * scale) / 2, alpha);
            const turn = (px: number, py: number) => {
                const s = Math.max(
                    0.02,
                    Math.sin((Math.min(H - 1, Math.max(0, py)) / H) * Math.PI)
                );
                const p = flow.angle(px, py);
                return wrapHalfTurn(
                    Math.atan2(Math.sin(p), Math.cos(p) * s) - alpha
                );
            };
            const bend = turn(x + dx, y + dy) - turn(x - dx, y - dy);
            // the paint the stroke carries: the image along its middle
            let colour = sampleRgb(ref, x, y);
            if (plan.core)
                for (const [ox, oy] of [
                    [-1.5, 0],
                    [1.5, 0],
                    [0, -1.5],
                    [0, 1.5],
                ]) {
                    const c = sampleRgb(ref, x + ox, y + oy);
                    if (yellowness(c) > yellowness(colour)) colour = c;
                }
            // blurring dulls the paint: give back the contrast it had
            // against the underpaint
            if (plan.contrast) {
                const under = sampleRgb(reference(LAYERS[1].colourSigma), x, y);
                for (let k = 0; k < 3; k++)
                    colour[k] = Math.min(
                        1,
                        Math.max(
                            0,
                            under[k] + (colour[k] - under[k]) * plan.contrast
                        )
                    );
            }
            let bendStep = Math.round(
                Math.min(1, Math.max(-1, bend / MAX_BEND)) * (BEND_STEPS / 2) +
                    BEND_STEPS / 2
            );
            // fine strokes are short: half the steps of length and bend
            // look the same there and cost fewer bits
            if (plan.coarseShape) {
                lengthStep |= 1;
                bendStep = Math.min(BEND_STEPS - 1, Math.max(1, bendStep | 1));
            }
            const halfTurns =
                (((alpha % Math.PI) + Math.PI) % Math.PI) / Math.PI;
            // fine strokes: every other angle step is enough as well
            const angleStep = plan.coarseShape ? 2 : 1;
            const quantised =
                (Math.round((halfTurns * ANGLE_STEPS) / angleStep) *
                    angleStep) %
                ANGLE_STEPS;
            strokes.push({
                angle: quantised,
                shape: (lengthStep << 4) | bendStep,
                colour,
            });
        }
    console.log(
        `${plan.name}: ${kept} strokes in ${occupancyBits.length} cells so far`
    );
});

const { centres, assign } = palette(
    strokes.map((s) => s.colour),
    PALETTE_SIZE
);
const occupancy = new Uint8Array(Math.ceil(occupancyBits.length / 8));
occupancyBits.forEach((bit, i) => {
    if (bit) occupancy[i >>> 3] |= 1 << (i & 7);
});
const set = {
    palette: Uint8Array.from(
        centres.flatMap((c) =>
            c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))
        )
    ),
    layers,
    occupancy,
    angle: Uint8Array.from(strokes.map((s) => s.angle)),
    shape: Uint8Array.from(strokes.map((s) => s.shape)),
    colour: Uint8Array.from(assign),
};
const body = encodeStrokes(set);
const file = gzipSync(body, { level: 9, mtime: 0 } as never);
// gzip's header carries no time with mtime 0; force it for older zlibs too
file[4] = file[5] = file[6] = file[7] = 0;
const hash = createHash("sha256").update(file).digest("hex").slice(0, 12);
const name = `${OUT_NAME}.${hash}.bin`;

mkdirSync(OUT_DIR, { recursive: true });
for (const old of readdirSync(OUT_DIR))
    if (old.startsWith(`${OUT_NAME}.`) && old !== name)
        rmSync(path.join(OUT_DIR, old));
writeFileSync(path.join(OUT_DIR, name), file);

const perLayer = strokesPerLayer(set);
if (process.argv.includes("--sizes")) {
    const deltas = set.angle.map(
        (a, i) => (a - (i ? set.angle[i - 1] : 0)) & (ANGLE_STEPS - 1)
    );
    const parts = {
        occupancy: set.occupancy,
        angle: deltas,
        shape: set.shape,
        colour: set.colour,
    };
    const spread = new Array(ANGLE_STEPS).fill(0);
    deltas.forEach((d) => spread[Math.min(d, ANGLE_STEPS - d)]++);
    console.log(
        `  angle delta spread: ${spread
            .slice(0, 12)
            .map((n) => (n / deltas.length).toFixed(2))
            .join(" ")}`
    );
    for (const [part, bytes] of Object.entries(parts))
        console.log(
            `  ${part}: ${bytes.length} B raw, ${
                gzipSync(bytes, { level: 9 }).length
            } B gzipped alone`
        );
}
writeFileSync(
    MODULE,
    `// Written by tasks/painted-sky/build.ts. Do not edit; run the builder.
export const STARRY_NIGHT_STROKES = {
    url: "/textures/painted-sky/${name}",
    /** Bytes over the wire (the file is gzipped already). */
    bytes: ${file.length},
    strokes: ${strokes.length},
    /** Strokes per layer: ${LAYERS.map((l) => l.name).join(", ")}. */
    perLayer: [${perLayer.join(", ")}],
};
`
);
console.log(
    `${strokes.length} strokes (${perLayer.join(" + ")}), body ${
        body.length
    } B, file ${file.length} B: ${name} in ${(
        (Date.now() - started) /
        1000
    ).toFixed(1)} s`
);
