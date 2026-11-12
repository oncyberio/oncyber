/**
 * The painted sky's stroke file: what the offline builder
 * (tasks/painted-sky/build.ts) writes and the runtime reads.
 *
 * The sky is painted in layers, coarse to fine. Each layer lays a grid of
 * cells over a band of the dome (rows of equal height, each row cut into as
 * many cells as fit around it, so cells have about the same size anywhere on
 * the sphere). A cell holds at most one stroke, placed at a jittered point
 * that both sides derive from the cell's indices, so the file only says
 * which cells hold a stroke and, for each stroke, its angle, shape and
 * colour: about three bytes before compression.
 *
 * Kept free of imports so the builder (plain Node) can load it as is.
 *
 * Body layout (the file on disk is this, gzipped), little endian:
 *   "OCPS", version u8, layer count u8, palette size u16
 *   palette: size × sRGB u8×3
 *   per layer: thetaMin, thetaMax, length, width (f32, radians), row count u16
 *   per layer: cells in each row (u16 × row count)
 *   occupancy: one bit per cell, layers and rows in order (LSB first)
 *   angle: u8 per stroke, delta from the previous stroke (mod 64 steps)
 *   shape: u8 per stroke, high nibble length step, low nibble bend step
 *   colour: u8 per stroke, palette index
 */

export const STROKE_FILE_VERSION = 1;
const MAGIC = [0x4f, 0x43, 0x50, 0x53]; // "OCPS"

/** Angles: steps over a half turn (a stroke's line, either way round). */
export const ANGLE_STEPS = 64;
/** Length: the high nibble (0–7) picks base × (MIN + step × STEP). */
export const LENGTH_STEPS = 8;
export const LENGTH_SCALE_MIN = 0.55;
export const LENGTH_SCALE_STEP = 0.12;
/** Bend: the low nibble (0–6) picks a turn of −MAX_BEND to MAX_BEND. */
export const MAX_BEND = 1.2;
export const BEND_STEPS = 6;

export type StrokeLayer = {
    /** Polar band the layer covers, radians from straight up. */
    thetaMin: number;
    thetaMax: number;
    /** Base stroke length and width, radians of arc. */
    length: number;
    width: number;
    /** How many cells each row holds. */
    rowCells: number[];
};

export type StrokeSet = {
    /** sRGB colours, three bytes each. */
    palette: Uint8Array;
    layers: StrokeLayer[];
    /** One bit per cell over all layers' rows: whether it holds a stroke. */
    occupancy: Uint8Array;
    /** Per stroke: angle in the local east/south frame, steps over π. */
    angle: Uint8Array;
    /** Per stroke: length step (high nibble), bend step (low nibble). */
    shape: Uint8Array;
    /** Per stroke: palette index. */
    colour: Uint8Array;
};

/** A 32-bit integer hash: the same on every engine (no floats, no trig). */
export function hashCell(a: number, b: number, c: number): number {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 16) ^ c, 0x27d4eb2f);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    return h >>> 0;
}

export function layerCellCount(layer: StrokeLayer): number {
    let n = 0;
    for (const cells of layer.rowCells) n += cells;
    return n;
}

/**
 * Where the stroke of cell (row, column) of a layer sits: polar angle theta
 * from straight up and azimuth phi, so that the dome shows image pixel
 * (phi / 2π × width, theta / π × height) there.
 */
export function cellCentre(
    layer: StrokeLayer,
    layerIndex: number,
    row: number,
    column: number,
    out: { theta: number; phi: number }
) {
    const rows = layer.rowCells.length;
    const height = (layer.thetaMax - layer.thetaMin) / rows;
    const cells = layer.rowCells[row];
    const h = hashCell(layerIndex + 1, row, column);
    const jitterU = (h & 0xffff) / 65536 - 0.5;
    const jitterV = (h >>> 16) / 65536 - 0.5;
    // each row starts at its own offset, so cells never line up in columns
    const phase = hashCell(layerIndex + 1, row, 0xffff) / 4294967296;
    out.theta = layer.thetaMin + (row + 0.5 + jitterV * 0.9) * height;
    out.phi = ((column + 0.5 + phase + jitterU * 0.9) / cells) * Math.PI * 2;
    return out;
}

/** The world direction the dome shows at (theta, phi) (the sharp sphere's). */
export function skyDirection(theta: number, phi: number, out: number[]) {
    const s = Math.sin(theta);
    out[0] = -s * Math.cos(phi);
    out[1] = Math.cos(theta);
    out[2] = -s * Math.sin(phi);
    return out;
}

export function lengthScale(shape: number) {
    const step = Math.min(LENGTH_STEPS - 1, shape >>> 4);
    return LENGTH_SCALE_MIN + step * LENGTH_SCALE_STEP;
}

export function bendOf(shape: number) {
    const step = Math.min(BEND_STEPS, shape & 15);
    return ((step - BEND_STEPS / 2) / (BEND_STEPS / 2)) * MAX_BEND;
}

export function encodeStrokes(set: StrokeSet): Uint8Array {
    const count = set.angle.length;
    if (set.shape.length !== count || set.colour.length !== count)
        throw new Error("stroke columns differ in length");
    const rows = set.layers.reduce((n, l) => n + l.rowCells.length, 0);
    const size =
        8 +
        set.palette.length +
        set.layers.length * 18 +
        rows * 2 +
        set.occupancy.length +
        count * 3;
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    let at = 0;
    MAGIC.forEach((b) => (bytes[at++] = b));
    bytes[at++] = STROKE_FILE_VERSION;
    bytes[at++] = set.layers.length;
    view.setUint16(at, set.palette.length / 3, true);
    at += 2;
    bytes.set(set.palette, at);
    at += set.palette.length;
    for (const layer of set.layers) {
        view.setFloat32(at, layer.thetaMin, true);
        view.setFloat32(at + 4, layer.thetaMax, true);
        view.setFloat32(at + 8, layer.length, true);
        view.setFloat32(at + 12, layer.width, true);
        view.setUint16(at + 16, layer.rowCells.length, true);
        at += 18;
    }
    for (const layer of set.layers)
        for (const cells of layer.rowCells) {
            view.setUint16(at, cells, true);
            at += 2;
        }
    bytes.set(set.occupancy, at);
    at += set.occupancy.length;
    // neighbouring strokes follow the same flow: small deltas pack well
    let previous = 0;
    for (let i = 0; i < count; i++) {
        bytes[at++] = (set.angle[i] - previous) & (ANGLE_STEPS - 1);
        previous = set.angle[i];
    }
    bytes.set(set.shape, at);
    at += count;
    bytes.set(set.colour, at);
    return bytes;
}

function popcount(bytes: Uint8Array, bits: number) {
    let n = 0;
    for (let i = 0; i < bits; i++) if (bytes[i >>> 3] & (1 << (i & 7))) n++;
    return n;
}

export function decodeStrokes(bytes: Uint8Array): StrokeSet {
    const fail = (why: string): never => {
        throw new Error(`painted sky stroke file: ${why}`);
    };
    if (bytes.length < 8) fail("too short");
    for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) fail("not one");
    if (bytes[4] !== STROKE_FILE_VERSION) fail(`version ${bytes[4]}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const need = (end: number) => {
        if (end > bytes.length) fail("truncated");
    };
    const layerCount = bytes[5];
    const paletteSize = view.getUint16(6, true);
    let at = 8;
    need(at + paletteSize * 3);
    const palette = bytes.slice(at, at + paletteSize * 3);
    at += paletteSize * 3;
    need(at + layerCount * 18);
    const layers: StrokeLayer[] = [];
    const rowCounts: number[] = [];
    for (let l = 0; l < layerCount; l++) {
        layers.push({
            thetaMin: view.getFloat32(at, true),
            thetaMax: view.getFloat32(at + 4, true),
            length: view.getFloat32(at + 8, true),
            width: view.getFloat32(at + 12, true),
            rowCells: [],
        });
        rowCounts.push(view.getUint16(at + 16, true));
        at += 18;
    }
    let cells = 0;
    layers.forEach((layer, l) => {
        need(at + rowCounts[l] * 2);
        for (let r = 0; r < rowCounts[l]; r++) {
            const n = view.getUint16(at, true);
            if (n === 0) fail("empty row");
            layer.rowCells.push(n);
            cells += n;
            at += 2;
        }
    });
    const occupancyBytes = Math.ceil(cells / 8);
    need(at + occupancyBytes);
    const occupancy = bytes.slice(at, at + occupancyBytes);
    at += occupancyBytes;
    const count = popcount(occupancy, cells);
    need(at + count * 3);
    const angle = new Uint8Array(count);
    let previous = 0;
    for (let i = 0; i < count; i++) {
        previous = (previous + bytes[at++]) & (ANGLE_STEPS - 1);
        angle[i] = previous;
    }
    const shape = bytes.slice(at, at + count);
    at += count;
    const colour = bytes.slice(at, at + count);
    for (let i = 0; i < count; i++)
        if (colour[i] >= paletteSize) fail("colour outside the palette");
    return { palette, layers, occupancy, angle, shape, colour };
}

/** How many strokes each layer holds. */
export function strokesPerLayer(set: StrokeSet): number[] {
    const counts: number[] = [];
    let bit = 0;
    for (const layer of set.layers) {
        const cells = layerCellCount(layer);
        let n = 0;
        for (let i = 0; i < cells; i++, bit++)
            if (set.occupancy[bit >>> 3] & (1 << (bit & 7))) n++;
        counts.push(n);
    }
    return counts;
}

const srgbToLinear = (byte: number) => {
    const c = byte / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export type StrokeInstances = {
    count: number;
    /** xyz: unit direction of the stroke's centre; w: length (radians). */
    centre: Float32Array;
    /** xyz: unit tangent from head to tail; w: width (radians). */
    axis: Float32Array;
    /** rgb: linear colour; w: bend (radians turned from head to tail). */
    colour: Float32Array;
};

/**
 * The per-instance data the GPU draws, for the first `layers` layers (all by
 * default). Strokes come out coarse to fine, so later ones paint over.
 */
export function strokeInstances(
    set: StrokeSet,
    layers = set.layers.length
): StrokeInstances {
    const perLayer = strokesPerLayer(set);
    const count = perLayer.slice(0, layers).reduce((a, b) => a + b, 0);
    const centre = new Float32Array(count * 4);
    const axis = new Float32Array(count * 4);
    const colour = new Float32Array(count * 4);
    const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i));
    const at = { theta: 0, phi: 0 };
    const d = [0, 0, 0];
    let bit = 0;
    let stroke = 0;
    for (let l = 0; l < layers; l++) {
        const layer = set.layers[l];
        for (let row = 0; row < layer.rowCells.length; row++)
            for (let column = 0; column < layer.rowCells[row]; column++) {
                const filled = set.occupancy[bit >>> 3] & (1 << (bit & 7));
                bit++;
                if (!filled) continue;
                cellCentre(layer, l, row, column, at);
                skyDirection(at.theta, at.phi, d);
                const h = hashCell(l + 101, row, column);
                // which end is the head is the brush's choice, not the image's
                const flip = h & 1 ? -1 : 1;
                // within its step at random, so the angles never band
                const alpha =
                    ((set.angle[stroke] + (h >>> 24) / 256 - 0.5) /
                        ANGLE_STEPS) *
                    Math.PI;
                const ca = Math.cos(alpha) * flip;
                const sa = Math.sin(alpha) * flip;
                // east (image +x) and south (image +y) at the centre
                const sp = Math.sin(at.phi);
                const cp = Math.cos(at.phi);
                const ct = Math.cos(at.theta);
                const st = Math.sin(at.theta);
                const shape = set.shape[stroke];
                const width = 0.85 + ((h >>> 8) & 255) / 850;
                const i = stroke * 4;
                centre[i] = d[0];
                centre[i + 1] = d[1];
                centre[i + 2] = d[2];
                centre[i + 3] = layer.length * lengthScale(shape);
                axis[i] = sp * ca - ct * cp * sa;
                axis[i + 1] = -st * sa;
                axis[i + 2] = -cp * ca - ct * sp * sa;
                axis[i + 3] = layer.width * width;
                const c = set.colour[stroke] * 3;
                colour[i] = linear[set.palette[c]];
                colour[i + 1] = linear[set.palette[c + 1]];
                colour[i + 2] = linear[set.palette[c + 2]];
                colour[i + 3] = bendOf(shape) * flip;
                stroke++;
            }
    }
    return { count, centre, axis, colour };
}

/**
 * Colours for a low-resolution sphere drawn under the strokes, so a pixel
 * no stroke happens to cover shows the sky's colour there, not the clear
 * colour: the average of the first `count` strokes (the coarse layers) in
 * each cell of a columns × rows grid, gaps filled from their neighbours.
 * One rgb per vertex, in SphereGeometry(r, columns, rows) vertex order.
 */
export function backstopColours(
    instances: StrokeInstances,
    count: number,
    columns: number,
    rows: number
) {
    const sum = new Float32Array(columns * rows * 4);
    for (let i = 0; i < count; i++) {
        const x = instances.centre[i * 4];
        const y = instances.centre[i * 4 + 1];
        const z = instances.centre[i * 4 + 2];
        const u = Math.atan2(-z, -x) / (2 * Math.PI) + 1;
        const column = Math.floor(u * columns) % columns;
        const row = Math.min(
            rows - 1,
            Math.floor(
                (Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI) * rows
            )
        );
        const cell = (row * columns + column) * 4;
        for (let k = 0; k < 3; k++)
            sum[cell + k] += instances.colour[i * 4 + k];
        sum[cell + 3]++;
    }
    // empty cells take their filled neighbours' average, until none is left
    for (let pass = 0; pass < rows + columns; pass++) {
        let empty = 0;
        const next = sum.slice();
        for (let row = 0; row < rows; row++)
            for (let column = 0; column < columns; column++) {
                const cell = (row * columns + column) * 4;
                if (sum[cell + 3] > 0) continue;
                empty++;
                const around = [
                    [row, column - 1],
                    [row, column + 1],
                    [row - 1, column],
                    [row + 1, column],
                ];
                for (const [r, c] of around) {
                    if (r < 0 || r >= rows) continue;
                    const n = (r * columns + ((c + columns) % columns)) * 4;
                    if (sum[n + 3] <= 0) continue;
                    for (let k = 0; k < 3; k++)
                        next[cell + k] += sum[n + k] / sum[n + 3];
                    next[cell + 3]++;
                }
            }
        sum.set(next);
        if (!empty) break;
    }
    const mean = (row: number, column: number, k: number) => {
        const cell =
            (Math.min(rows - 1, Math.max(0, row)) * columns +
                ((column + columns) % columns)) *
            4;
        return sum[cell + 3] > 0 ? sum[cell + k] / sum[cell + 3] : 0;
    };
    const colours = new Float32Array((columns + 1) * (rows + 1) * 3);
    for (let row = 0; row <= rows; row++)
        for (let column = 0; column <= columns; column++)
            for (let k = 0; k < 3; k++)
                colours[(row * (columns + 1) + column) * 3 + k] =
                    (mean(row - 1, column - 1, k) +
                        mean(row - 1, column, k) +
                        mean(row, column - 1, k) +
                        mean(row, column, k)) /
                    4;
    return colours;
}
