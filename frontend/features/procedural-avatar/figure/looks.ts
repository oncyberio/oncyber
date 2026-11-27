import * as THREE from "three/webgpu";
import type { FigureFrames } from "./shading";
import type { FigureStyle } from "./style";

/**
 * A figure's look: everything of a style that is drawn on the figure and
 * that no mesh depends on. Its colours, how heavy its lines are, its
 * irises and catchlights, its underwear. The rest of a style is its shape:
 * what is done to the mesh.
 *
 * Looks are kept in a table the shaders read, one row a look. Figures that
 * share a shape can then be drawn together, each with a look of its own: a
 * figure only says which row is its.
 */

/**
 * A row's cells. Each holds three numbers, often a colour, and one more
 * number. Cells that are read together sit together: the body reads the
 * first five.
 */
export const LOOK_CELLS = [
    ["tone", "flush"],
    ["scatter", "sheen"],
    ["blush", "eyeShade"],
    ["cloth", "waist"],
    ["band", "hem"],
    ["lid", "lipTint"],
    ["lidUpper", "wingLength"],
    ["lidLower", "wingLift"],
    ["lip", "creaseHeight"],
    ["mouthLine", "creaseWidth"],
    ["white", "mouthWidth"],
    ["iris", "irisRadius"],
    ["irisLight", "pupilSize"],
    ["pupil", "browShadow"],
    ["brow", "glintGlow"],
    ["glint0", ""],
    ["glint1", ""],
] as const;

type Cell = (typeof LOOK_CELLS)[number];
/** What a row holds as three numbers, and what as one. */
export type LookTriple = Cell[0];
export type LookNumber = Exclude<Cell[1], "">;

/** Numbers in a row: four to a cell. */
export const LOOK_SIZE = LOOK_CELLS.length * 4;

const linear = (hex: string) => {
    const colour = new THREE.Color(hex);
    return [colour.r, colour.g, colour.b];
};

/**
 * The look of a style on a figure of a given shape, as a row of the table.
 * Lengths a style gives in eye widths, mouth widths or parts of the hips'
 * height are in metres here, so a row belongs to that shape.
 */
export function lookOf(style: FigureStyle, frames: FigureFrames) {
    const eye = frames.eyeWidth;
    // Only the colour of the light inside the skin counts, not how
    // bright it is.
    const scatter = linear(style.skin.scatter);
    const brightest = Math.max(...scatter, 1e-6);
    const glint = (index: number) => {
        const g = style.eyes.glints[index];
        return g ? [g[0] * frames.forwardZ, g[1], g[2]] : [0, 0, 0];
    };
    const triples: Record<LookTriple, number[]> = {
        tone: linear(style.skin.tone),
        scatter: scatter.map((c) => c / brightest),
        blush: linear(style.skin.blush),
        cloth: linear(style.underwear.colour),
        band: linear(style.underwear.band),
        lid: linear(style.lids.colour),
        lidUpper: style.lids.upper.map((w) => w * eye),
        lidLower: style.lids.lower.map((w) => w * eye),
        lip: linear(style.mouth.lip),
        mouthLine: linear(style.mouth.line),
        white: linear(style.eyes.white),
        iris: linear(style.eyes.iris),
        irisLight: linear(style.eyes.irisLight),
        pupil: linear(style.eyes.pupil),
        brow: linear(style.brows.colour),
        glint0: glint(0),
        glint1: glint(1),
    };
    const numbers: Record<LookNumber, number> = {
        flush: style.skin.flush,
        sheen: style.skin.sheen,
        eyeShade: style.eyes.shade,
        waist: style.underwear.waist * frames.hips,
        hem: style.underwear.hem * frames.hips,
        lipTint: style.mouth.lipTint,
        wingLength: style.lids.wing[0] * eye,
        wingLift: style.lids.wing[1] * eye,
        creaseHeight: style.lids.crease[0] * eye,
        creaseWidth: style.lids.crease[1] * eye,
        mouthWidth: style.mouth.lineWidth * frames.mouthWidth,
        irisRadius: style.eyes.radius * eye,
        pupilSize: style.eyes.pupilSize,
        browShadow: style.brows.shadow ?? 0.4,
        glintGlow: style.eyes.glow,
    };
    const row = new Float32Array(LOOK_SIZE);
    LOOK_CELLS.forEach(([triple, number], cell) => {
        row.set(triples[triple], cell * 4);
        if (number) row[cell * 4 + 3] = numbers[number];
    });
    return row;
}

/** A table of looks for figures of one shape. */
export interface FigureLooks {
    /** One row a look, `LOOK_CELLS.length` across. */
    texture: THREE.DataTexture;
    /** How many looks it has room for. */
    capacity: number;
    /** Give a row the look of a style. */
    set(row: number, style: FigureStyle): void;
    dispose(): void;
}

/**
 * A table of looks for figures of the shape these measurements were
 * taken from, with room for `capacity` of them.
 */
export function createFigureLooks(
    frames: FigureFrames,
    capacity = 1
): FigureLooks {
    if (!Number.isInteger(capacity) || capacity < 1)
        throw new RangeError("A table of looks holds one look or more");
    // Kept as the 32-bit numbers a uniform would hold, so nothing is
    // rounded on the way to the shader.
    const data = new Float32Array(LOOK_SIZE * capacity);
    const texture = new THREE.DataTexture(
        data,
        LOOK_CELLS.length,
        capacity,
        THREE.RGBAFormat,
        THREE.FloatType
    );
    texture.name = "figure-looks";
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return {
        texture,
        capacity,
        set(row, style) {
            if (!Number.isInteger(row) || row < 0 || row >= capacity)
                throw new RangeError(`The table has no row ${row}`);
            data.set(lookOf(style, frames), row * LOOK_SIZE);
            texture.needsUpdate = true;
        },
        dispose() {
            texture.dispose();
        },
    };
}
