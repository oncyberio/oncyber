// tokens-ok-file: paint for a 3D room, after a painting.
//
// Three-free: what is painted inside the house, in the house's own frame
// (see layout.ts). The room is after Van Gogh's "Bedroom in Arles", kept in
// this world's night: pale violet walls, a board floor, the yellow bed with
// its red blanket, two rush chairs, the table with its jug, and a lamp.
import {
    createPainter,
    hex,
    type Colour,
    type Light,
    type Painter,
    type PaintStyle,
    type Vec3,
} from "../../../paintedSurface/painter";
import { ROOM } from "./layout";

const W = ROOM.halfWidth;
const D = ROOM.halfDepth;
const F = ROOM.floor;
const E = ROOM.eaves;
const R = ROOM.ridge;
/** A height above the floor. */
const up = (height: number) => F + height;

const colours = (...values: string[]): Colour[] => values.map(hex);

const WALL = colours(
    "#8fa6d8",
    "#9cb2e0",
    "#8094cc",
    "#a9bbe6",
    "#7c8ec6",
    "#93a0d4"
);
const BOARDS = colours(
    "#8b7446",
    "#7a6c3f",
    "#9a8050",
    "#6f6a3a",
    "#a38a5c",
    "#5f6238"
);
const ROOF = colours("#2f5560", "#35606a", "#284a55", "#3c6a6e", "#22404c");
const TIMBER = colours("#5a3b22", "#6a4628", "#4a2f1c", "#75502e");
const BED = colours("#e0a52e", "#ebb53d", "#cf8f22", "#f0c458", "#c07a1c");
const BLANKET = colours("#c0352b", "#d0442f", "#a92a26", "#dc5a3a", "#b53a52");
const LINEN = colours("#e9e4b4", "#f1edc6", "#d9dba6", "#cfd8b8", "#e2d79a");
const RUSH = colours("#b7a548", "#c6b458", "#a3963e", "#8f8b3c", "#d1c06a");
const SHUTTER = colours("#2f6e41", "#3a7f4b", "#275c38", "#4a9058");
const NIGHT = colours("#17296a", "#1f3a86", "#12205a", "#2b4a9e", "#0e1844");
const SMOCK = colours("#2c5aa6", "#3668b8", "#234a8e", "#4479c6");
const JUG = colours("#3b6fb6", "#4a80c6", "#2f5e9f");
const BASIN = colours("#dfe7ea", "#cfd9e2", "#eef2f0", "#b9c8d6");
const RUG = colours("#b5482c", "#c8603a", "#9a3a28", "#d98b3a", "#7a2f2a");
const GLASS = colours("#9fb4b0", "#b4c6c0", "#8aa3a6", "#c5d2c8");
const WHEAT = colours("#e2b53a", "#edc552", "#cf9c2a", "#d9a83a");
const SKY = colours("#5d8fd0", "#74a3dc", "#4a7cc0", "#8db6e6");
const FLAME = colours("#fff3a8", "#ffe26a", "#fff8cc");

const DARK = hex("#1c1830");
const UMBER = hex("#4a2412");
const STAR = hex("#f6d94a");
const STAR_CORE = hex("#fff3a0");

/** Where the lamp's flame is: the light of the room comes from here. */
export const LAMP: Vec3 = [0, up(4.9), 0.6];

/**
 * The lamp's light, painted into every colour: warm and bright near the
 * flame, cool and dim in the corners, a little more on what faces it.
 */
export const lampLight: Light = (at, facing) => {
    const to: Vec3 = [LAMP[0] - at[0], LAMP[1] - at[1], LAMP[2] - at[2]];
    const far = Math.hypot(to[0], to[1], to[2]) || 1;
    const towards =
        (to[0] * facing[0] + to[1] * facing[1] + to[2] * facing[2]) / far;
    const reach = 1 / (1 + (far / 5.5) ** 2);
    const warm = reach * (0.62 + 0.38 * Math.max(0, towards));
    return [0.44 + 1.2 * warm, 0.48 + 0.98 * warm, 0.62 + 0.58 * warm];
};

/** What stands in the room and cannot be walked through: [min, max]. */
export const FURNITURE: readonly (readonly [Vec3, Vec3])[] = [
    // the bed
    [
        [1.72, F, -5.7],
        [4.3, up(1.9), -1.5],
    ],
    // the table
    [
        [-4.35, F, -5.6],
        [-2.5, up(1.75), -4.25],
    ],
    // the chair by the bed and the one under the windows
    [
        [0.05, F, -4.8],
        [1.05, up(1.1), -3.8],
    ],
    [
        [-4.2, F, 0.1],
        [-3.2, up(1.1), 1.1],
    ],
];

function shell(paint: Painter) {
    const wall: PaintStyle = {
        palette: WALL,
        under: hex("#56679e"),
        // near upright, leaning one way then the other along the wall
        flow: (along, across) =>
            Math.PI / 2 + 0.45 * Math.sin(along * 0.55 + across * 0.3),
        length: 0.85,
        width: 0.24,
        wobble: 0.3,
    };
    const { left, right, top } = ROOM.door;

    // back wall and its gable
    paint.poly(
        [
            [-W, F, -D],
            [W, F, -D],
            [W, E, -D],
            [-W, E, -D],
        ],
        wall
    );
    paint.poly(
        [
            [-W, E, -D],
            [W, E, -D],
            [0, R, -D],
        ],
        wall
    );
    // front wall around the doorway, and its gable
    paint.poly(
        [
            [W, F, D],
            [right, F, D],
            [right, E, D],
            [W, E, D],
        ],
        wall
    );
    paint.poly(
        [
            [left, F, D],
            [-W, F, D],
            [-W, E, D],
            [left, E, D],
        ],
        wall
    );
    paint.poly(
        [
            [right, top, D],
            [left, top, D],
            [left, E, D],
            [right, E, D],
        ],
        wall
    );
    paint.poly(
        [
            [W, E, D],
            [-W, E, D],
            [0, R, D],
        ],
        wall
    );
    // left and right walls
    paint.poly(
        [
            [-W, F, D],
            [-W, F, -D],
            [-W, E, -D],
            [-W, E, D],
        ],
        wall
    );
    paint.poly(
        [
            [W, F, -D],
            [W, F, D],
            [W, E, D],
            [W, E, -D],
        ],
        wall
    );

    // the floor: boards running to the door
    paint.poly(
        [
            [-W, F, -D],
            [-W, F, D],
            [W, F, D],
            [W, F, -D],
        ],
        {
            palette: BOARDS,
            under: hex("#3a3524"),
            length: 1.25,
            width: 0.26,
            wobble: 0.07,
        }
    );
    for (let x = -W + 0.66; x < W - 0.2; x += 0.74)
        paint.line([x, F, -D], [x, F, D], [0, 1, 0], {
            colour: hex("#2b2416"),
            width: 0.055,
            reach: 2.4,
        });

    // the roof from below, with the paint pulled down each slope
    const roof: PaintStyle = {
        palette: ROOF,
        under: hex("#16272e"),
        flow: Math.PI / 2,
        length: 1.1,
        width: 0.28,
        wobble: 0.16,
    };
    paint.poly(
        [
            [-W, E, D],
            [-W, E, -D],
            [0, R, -D],
            [0, R, D],
        ],
        roof
    );
    paint.poly(
        [
            [W, E, -D],
            [W, E, D],
            [0, R, D],
            [0, R, -D],
        ],
        roof
    );

    // timbers: rafters up each slope, a ridge beam, ties across the room
    const timber: PaintStyle = {
        palette: TIMBER,
        under: hex("#2a1a10"),
        length: 1.0,
        width: 0.2,
        wobble: 0.08,
    };
    const rise = R - E;
    const slope = Math.hypot(rise, W);
    for (let z = -D + 0.9; z < D; z += 2.0) {
        paint.beam(
            [-W, E, z],
            [0, R - 0.02, z],
            [rise / slope, -W / slope, 0],
            0.24,
            0.26,
            timber
        );
        paint.beam(
            [W, E, z],
            [0, R - 0.02, z],
            [-rise / slope, -W / slope, 0],
            0.24,
            0.26,
            timber
        );
    }
    paint.beam([0, R - 0.1, -D], [0, R - 0.1, D], [0, -1, 0], 0.3, 0.3, timber);
    for (const z of [-3.1, 0.6, 4.3])
        paint.beam(
            [-W, E + 0.12, z],
            [W, E + 0.12, z],
            [0, -1, 0],
            0.32,
            0.36,
            timber
        );

    // where wall meets floor, wall and roof: the dark line he draws there
    const skirting = { colour: hex("#243a4a"), width: 0.2, reach: 1.6 };
    const edge = { colour: DARK, width: 0.1, reach: 1.5 };
    paint.line([-W, F + 0.1, -D], [W, F + 0.1, -D], [0, 0, 1], skirting);
    paint.line([-W, F + 0.1, D], [-W, F + 0.1, -D], [1, 0, 0], skirting);
    paint.line([W, F + 0.1, -D], [W, F + 0.1, D], [-1, 0, 0], skirting);
    paint.line([W, F + 0.1, D], [right, F + 0.1, D], [0, 0, -1], skirting);
    paint.line([left, F + 0.1, D], [-W, F + 0.1, D], [0, 0, -1], skirting);
    paint.line([-W, F, -D], [-W, E, -D], [0.7, 0, 0.7], edge);
    paint.line([W, F, -D], [W, E, -D], [-0.7, 0, 0.7], edge);
    paint.line([-W, F, D], [-W, E, D], [0.7, 0, -0.7], edge);
    paint.line([W, F, D], [W, E, D], [-0.7, 0, -0.7], edge);

    // the doorway: its reveal, a board across the threshold, and trim
    const reveal: PaintStyle = {
        palette: colours("#2a2440", "#342c4e", "#221d36"),
        length: 0.7,
        width: 0.12,
        flow: 0,
    };
    const out = D + 0.17;
    paint.poly(
        [
            [left, F, out],
            [left, F, D],
            [left, top, D],
            [left, top, out],
        ],
        { ...reveal, flow: Math.PI / 2 }
    );
    paint.poly(
        [
            [right, F, D],
            [right, F, out],
            [right, top, out],
            [right, top, D],
        ],
        { ...reveal, flow: Math.PI / 2 }
    );
    paint.poly(
        [
            [left, top, D],
            [right, top, D],
            [right, top, out],
            [left, top, out],
        ],
        reveal
    );
    paint.poly(
        [
            [left, F, out + 0.1],
            [right, F, out + 0.1],
            [right, F, D],
            [left, F, D],
        ],
        {
            palette: BOARDS,
            under: hex("#3a3524"),
            length: 0.9,
            width: 0.14,
        }
    );
    const trim: PaintStyle = {
        palette: colours("#27506a", "#2f5f78", "#1f4258"),
        under: hex("#122530"),
        length: 0.9,
        width: 0.2,
        wobble: 0.06,
    };
    paint.beam(
        [left - 0.12, F, D],
        [left - 0.12, top + 0.24, D],
        [0, 0, -1],
        0.24,
        0.07,
        trim
    );
    paint.beam(
        [right + 0.12, F, D],
        [right + 0.12, top + 0.24, D],
        [0, 0, -1],
        0.24,
        0.07,
        trim
    );
    paint.beam(
        [left - 0.24, top + 0.12, D],
        [right + 0.24, top + 0.12, D],
        [0, 0, -1],
        0.24,
        0.08,
        trim
    );
}

/** A window of the left wall: the night in its panes, a green frame, shutters. */
function windowAt(paint: Painter, from: number, to: number) {
    const sill = ROOM.windowSill;
    const head = ROOM.windowTop;
    const x = -W + 0.03;
    const wide = to - from;
    const middle = (from + to) / 2;
    const centreY = (sill + head) / 2;

    // the sky outside, turning as the sky does
    paint.poly(
        [
            [x, sill, to],
            [x, sill, from],
            [x, head, from],
            [x, head, to],
        ],
        {
            palette: NIGHT,
            under: hex("#0a1030"),
            flow: (along, across) =>
                Math.atan2(across - (head - sill) * 0.55, along - wide * 0.45) +
                Math.PI / 2,
            length: 0.5,
            width: 0.13,
            wobble: 0.12,
            density: 1.8,
        }
    );
    // a star and its ring
    const star: Vec3 = [x, centreY + 0.75, middle - wide * 0.2];
    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const ring: Vec3 = [0, Math.sin(angle), Math.cos(angle)];
        const tangent: Vec3 = [0, Math.cos(angle), -Math.sin(angle)];
        paint.dab(
            [star[0], star[1] + ring[1] * 0.24, star[2] + ring[2] * 0.24],
            tangent,
            [1, 0, 0],
            0.2,
            0.07,
            STAR,
            { glow: true, lift: 0.03 }
        );
    }
    paint.dab(star, [0, 0, 1], [1, 0, 0], 0.2, 0.16, STAR_CORE, {
        glow: true,
        lift: 0.034,
    });
    paint.dab(
        [x, centreY - 0.5, middle + wide * 0.25],
        [0, 0.3, 1],
        [1, 0, 0],
        0.16,
        0.1,
        STAR,
        { glow: true, lift: 0.03 }
    );

    const frame: PaintStyle = {
        palette: SHUTTER,
        under: hex("#143020"),
        length: 0.8,
        width: 0.16,
        wobble: 0.05,
    };
    const face: Vec3 = [1, 0, 0];
    const wall = -W + 0.01;
    paint.beam(
        [wall, sill - 0.08, to + 0.2],
        [wall, sill - 0.08, from - 0.2],
        face,
        0.2,
        0.2,
        frame
    );
    paint.beam(
        [wall, head + 0.07, to + 0.1],
        [wall, head + 0.07, from - 0.1],
        face,
        0.16,
        0.1,
        frame
    );
    paint.beam(
        [wall, sill, to + 0.06],
        [wall, head, to + 0.06],
        face,
        0.16,
        0.1,
        frame
    );
    paint.beam(
        [wall, sill, from - 0.06],
        [wall, head, from - 0.06],
        face,
        0.16,
        0.1,
        frame
    );
    paint.beam(
        [wall, sill, middle],
        [wall, head, middle],
        face,
        0.09,
        0.08,
        frame
    );
    paint.beam(
        [wall, sill + (head - sill) * 0.6, to],
        [wall, sill + (head - sill) * 0.6, from],
        face,
        0.08,
        0.07,
        frame
    );

    // shutters folded back against the wall, slats drawn across
    const leaf = wide / 2 - 0.04;
    for (const [near, far] of [
        [to + 0.16, to + 0.16 + leaf],
        [from - 0.16 - leaf, from - 0.16],
    ]) {
        const lo = Math.min(near, far);
        const hi = Math.max(near, far);
        const at = -W + 0.05;
        paint.poly(
            [
                [at, sill, hi],
                [at, sill, lo],
                [at, head, lo],
                [at, head, hi],
            ],
            {
                palette: SHUTTER,
                under: hex("#143020"),
                length: 0.6,
                width: 0.16,
                wobble: 0.08,
            }
        );
        for (let y = sill + 0.3; y < head - 0.1; y += 0.42)
            paint.line([at, y, hi - 0.06], [at, y, lo + 0.06], face, {
                colour: hex("#102618"),
                width: 0.05,
            });
        for (const z of [lo, hi])
            paint.line([at, sill, z], [at, head, z], face, {
                colour: hex("#102618"),
                width: 0.07,
            });
    }
}

function bed(paint: Painter) {
    const wood: PaintStyle = {
        palette: BED,
        under: hex("#7a4a12"),
        length: 0.8,
        width: 0.17,
        wobble: 0.08,
    };
    const outline = { colour: UMBER, width: 0.075 };
    // posts: tall at the head, shorter at the foot
    for (const x of [1.72, 4.02]) {
        paint.box([x, F, -5.7], [x + 0.28, up(3.0), -5.42], {
            ...wood,
            grain: "y",
        });
        paint.box([x, F, -1.78], [x + 0.28, up(2.05), -1.5], {
            ...wood,
            grain: "y",
        });
    }
    // head and foot boards, the rail down the open side
    paint.box([2.0, up(0.95), -5.62], [4.02, up(2.75), -5.5], {
        ...wood,
        grain: "x",
        faces: "ZY",
    });
    paint.box([2.0, up(0.7), -1.7], [4.02, up(1.85), -1.58], {
        ...wood,
        grain: "x",
        faces: "zZY",
    });
    paint.box([1.76, up(0.72), -5.42], [1.9, up(1.16), -1.78], {
        ...wood,
        grain: "z",
        faces: "xY",
    });
    // the blanket, pulled across the bed
    paint.box([1.9, up(0.95), -5.45], [4.3, up(1.55), -1.72], {
        palette: BLANKET,
        under: hex("#5e1616"),
        grain: "x",
        faces: "xYZ",
        length: 0.95,
        width: 0.24,
        wobble: 0.2,
    });
    // the sheet turned down, and two pillows
    const linen: PaintStyle = {
        palette: LINEN,
        under: hex("#8f9070"),
        length: 0.6,
        width: 0.2,
        wobble: 0.25,
    };
    paint.poly(
        [
            [1.9, up(1.565), -4.0],
            [4.3, up(1.565), -4.0],
            [4.3, up(1.565), -4.6],
            [1.9, up(1.565), -4.6],
        ],
        linen
    );
    paint.box([2.0, up(1.52), -5.42], [3.08, up(1.9), -4.62], {
        ...linen,
        grain: "x",
        faces: "xXYZ",
    });
    paint.box([3.14, up(1.52), -5.42], [4.22, up(1.9), -4.62], {
        ...linen,
        grain: "x",
        faces: "xXYZ",
    });

    // drawn round in umber, as he outlines his furniture
    paint.line(
        [2.0, up(2.75), -5.49],
        [4.02, up(2.75), -5.49],
        [0, 0, 1],
        outline
    );
    paint.line(
        [2.0, up(0.95), -5.49],
        [4.02, up(0.95), -5.49],
        [0, 0, 1],
        outline
    );
    paint.line(
        [2.0, up(1.85), -1.57],
        [4.02, up(1.85), -1.57],
        [0, 0, 1],
        outline
    );
    paint.line(
        [2.0, up(0.7), -1.57],
        [4.02, up(0.7), -1.57],
        [0, 0, 1],
        outline
    );
    paint.line(
        [1.75, up(1.16), -5.42],
        [1.75, up(1.16), -1.78],
        [-1, 0, 0],
        outline
    );
    paint.line(
        [1.75, up(0.72), -5.42],
        [1.75, up(0.72), -1.78],
        [-1, 0, 0],
        outline
    );
    for (const [x, z, height] of [
        [1.72, -1.49, 2.05],
        [2.0, -1.49, 2.05],
        [4.02, -1.49, 2.05],
        [4.3, -1.49, 2.05],
        [1.72, -5.41, 3.0],
        [2.0, -5.41, 3.0],
        [4.02, -5.41, 3.0],
    ] as const)
        paint.line([x, F, z], [x, up(height), z], [0, 0, 1], outline);
    paint.line([1.71, F, -1.78], [1.71, up(2.05), -1.78], [-1, 0, 0], outline);
    paint.line([1.71, F, -1.5], [1.71, up(2.05), -1.5], [-1, 0, 0], outline);
    paint.line([1.71, F, -5.42], [1.71, up(3.0), -5.42], [-1, 0, 0], outline);
    paint.line([1.89, up(1.55), -5.4], [1.89, up(1.55), -1.74], [-1, 0, 0], {
        colour: hex("#4a1010"),
        width: 0.07,
    });
}

/** A rush-seated chair, standing at the origin and facing +z. */
function chair(paint: Painter) {
    const wood: PaintStyle = {
        palette: BED,
        under: hex("#7a4a12"),
        length: 0.5,
        width: 0.1,
        wobble: 0.06,
    };
    const outline = { colour: UMBER, width: 0.05 };
    const leg = 0.06;
    for (const x of [-0.42, 0.42]) {
        paint.box([x - leg, 0, 0.42 - leg], [x + leg, 1.04, 0.42 + leg], {
            ...wood,
            grain: "y",
            faces: "xXzZ",
        });
        paint.box([x - leg, 0, -0.42 - leg], [x + leg, 2.3, -0.42 + leg], {
            ...wood,
            grain: "y",
            faces: "xXzZY",
        });
        // stretchers between the legs on each side
        paint.box([x - 0.035, 0.42, -0.42], [x + 0.035, 0.5, 0.42], {
            ...wood,
            grain: "z",
            faces: "xXY",
        });
        paint.line(
            [x - leg, 0, 0.42 + leg + 0.005],
            [x - leg, 1.04, 0.42 + leg + 0.005],
            [0, 0, 1],
            outline
        );
        paint.line(
            [x + leg, 0, 0.42 + leg + 0.005],
            [x + leg, 1.04, 0.42 + leg + 0.005],
            [0, 0, 1],
            outline
        );
        paint.line(
            [x - leg, 1.1, -0.42 + leg + 0.005],
            [x - leg, 2.3, -0.42 + leg + 0.005],
            [0, 0, 1],
            outline
        );
        paint.line(
            [x + leg, 1.1, -0.42 + leg + 0.005],
            [x + leg, 2.3, -0.42 + leg + 0.005],
            [0, 0, 1],
            outline
        );
    }
    paint.box([-0.42, 0.5, 0.385], [0.42, 0.58, 0.455], {
        ...wood,
        grain: "x",
        faces: "ZY",
    });
    paint.box([-0.42, 0.34, -0.455], [0.42, 0.42, -0.385], {
        ...wood,
        grain: "x",
        faces: "zZY",
    });
    // back slats
    for (const [lo, hi] of [
        [1.48, 1.68],
        [1.95, 2.18],
    ]) {
        paint.box([-0.42, lo, -0.46], [0.42, hi, -0.39], {
            ...wood,
            grain: "x",
            faces: "zZY",
        });
        paint.line([-0.4, hi, -0.385], [0.4, hi, -0.385], [0, 0, 1], outline);
        paint.line([-0.4, lo, -0.385], [0.4, lo, -0.385], [0, 0, 1], outline);
    }
    // the rush seat
    paint.box([-0.5, 0.98, -0.5], [0.5, 1.1, 0.5], {
        palette: RUSH,
        under: hex("#5c5626"),
        grain: "x",
        faces: "xXYzZ",
        length: 0.45,
        width: 0.1,
        wobble: 0.1,
        density: 1.8,
    });
    paint.line([-0.5, 1.1, 0.505], [0.5, 1.1, 0.505], [0, 0, 1], outline);
    paint.line([-0.5, 0.98, 0.505], [0.5, 0.98, 0.505], [0, 0, 1], outline);
    paint.line([-0.505, 1.1, -0.5], [-0.505, 1.1, 0.5], [-1, 0, 0], outline);
    paint.line([0.505, 1.1, 0.5], [0.505, 1.1, -0.5], [1, 0, 0], outline);
}

function table(paint: Painter) {
    const wood: PaintStyle = {
        palette: colours("#b8792a", "#c98a36", "#a4681f", "#d49a48"),
        under: hex("#5c3610"),
        length: 0.7,
        width: 0.15,
        wobble: 0.08,
    };
    const outline = { colour: UMBER, width: 0.06 };
    const x0 = -4.3;
    const x1 = -2.55;
    const z0 = -5.55;
    const z1 = -4.3;
    for (const [x, z] of [
        [x0 + 0.08, z0 + 0.08],
        [x1 - 0.22, z0 + 0.08],
        [x0 + 0.08, z1 - 0.22],
        [x1 - 0.22, z1 - 0.22],
    ])
        paint.box([x, F, z], [x + 0.14, up(1.34), z + 0.14], {
            ...wood,
            grain: "y",
            faces: "xXzZ",
        });
    // the apron with its drawer, then the top
    paint.box([x0 + 0.1, up(1.3), z0 + 0.1], [x1 - 0.1, up(1.6), z1 - 0.1], {
        ...wood,
        grain: "x",
        faces: "XZ",
    });
    paint.box([x0, up(1.6), z0], [x1, up(1.72), z1], {
        ...wood,
        grain: "x",
        faces: "XYZ",
    });
    paint.line(
        [x0, up(1.72), z1 + 0.005],
        [x1, up(1.72), z1 + 0.005],
        [0, 0, 1],
        outline
    );
    paint.line(
        [x0, up(1.6), z1 + 0.005],
        [x1, up(1.6), z1 + 0.005],
        [0, 0, 1],
        outline
    );
    paint.line(
        [x1 + 0.005, up(1.72), z1],
        [x1 + 0.005, up(1.72), z0],
        [1, 0, 0],
        outline
    );
    paint.line(
        [x0 + 0.5, up(1.34), z1 - 0.095],
        [x1 - 0.5, up(1.34), z1 - 0.095],
        [0, 0, 1],
        outline
    );
    paint.dab(
        [(x0 + x1) / 2, up(1.46), z1 - 0.09],
        [1, 0, 0],
        [0, 0, 1],
        0.14,
        0.1,
        UMBER
    );

    // the basin with the jug standing in it, a bottle and a glass
    const top = up(1.72);
    paint.prism([-3.55, -4.95], 0.34, top, top + 0.2, {
        palette: BASIN,
        under: hex("#7c8a98"),
        topRadius: 0.5,
        top: false,
        length: 0.3,
        width: 0.1,
        flow: Math.PI / 2,
    });
    paint.prism([-3.55, -4.95], 0.3, top + 0.03, top + 0.06, {
        palette: BASIN,
        under: hex("#7c8a98"),
        length: 0.3,
        width: 0.12,
    });
    paint.prism([-3.55, -4.95], 0.2, top + 0.06, top + 0.5, {
        palette: JUG,
        under: hex("#182f58"),
        topRadius: 0.24,
        top: false,
        length: 0.34,
        width: 0.1,
    });
    paint.prism([-3.55, -4.95], 0.24, top + 0.5, top + 0.78, {
        palette: JUG,
        under: hex("#182f58"),
        topRadius: 0.13,
        length: 0.3,
        width: 0.09,
    });
    paint.prism([-2.9, -4.75], 0.09, top, top + 0.42, {
        palette: colours("#2f6e41", "#3a7f4b", "#275c38"),
        sides: 6,
        topRadius: 0.07,
        length: 0.3,
        width: 0.07,
    });
    paint.prism([-2.9, -4.75], 0.035, top + 0.42, top + 0.6, {
        palette: colours("#2f6e41", "#275c38"),
        sides: 6,
        length: 0.16,
        width: 0.05,
    });
    paint.prism([-3.05, -5.2], 0.08, top, top + 0.2, {
        palette: GLASS,
        sides: 6,
        length: 0.16,
        width: 0.06,
    });
    paint.prism([-4.0, -4.6], 0.1, top, top + 0.07, {
        palette: colours("#c9a23a", "#e0b84a"),
        sides: 6,
        length: 0.12,
        width: 0.06,
    });

    // the mirror above it
    paint.box([-3.95, up(2.75), -D], [-2.95, up(4.0), -D + 0.07], {
        palette: colours("#2a2018", "#3a2a1c", "#1f1812"),
        grain: "y",
        faces: "Z",
        length: 0.5,
        width: 0.14,
    });
    paint.poly(
        [
            [-3.82, up(2.88), -D + 0.09],
            [-3.08, up(2.88), -D + 0.09],
            [-3.08, up(3.87), -D + 0.09],
            [-3.82, up(3.87), -D + 0.09],
        ],
        {
            palette: GLASS,
            under: hex("#5a6e70"),
            flow: 0.9,
            length: 0.45,
            width: 0.12,
            wobble: 0.1,
        }
    );
}

/** The row of pegs on the back wall: his smock and his straw hat. */
function pegs(paint: Painter) {
    const z = -D;
    paint.box([-2.1, up(3.5), z], [1.1, up(3.63), z + 0.08], {
        palette: TIMBER,
        grain: "x",
        faces: "ZY",
        length: 0.7,
        width: 0.12,
    });
    for (const x of [-1.85, -1.1, -0.35, 0.4, 0.95])
        paint.dab(
            [x, up(3.56), z + 0.1],
            [0, 1, 0],
            [0, 0, 1],
            0.12,
            0.09,
            DARK
        );
    // the smock, hanging from its collar
    const cloth = z + 0.12;
    paint.poly(
        [
            [-2.0, up(1.75), cloth],
            [-0.95, up(1.75), cloth],
            [-1.12, up(3.5), cloth],
            [-1.78, up(3.5), cloth],
        ],
        {
            palette: SMOCK,
            under: hex("#142850"),
            flow: Math.PI / 2,
            length: 0.75,
            width: 0.18,
            wobble: 0.18,
        }
    );
    paint.line(
        [-2.0, up(1.75), cloth + 0.01],
        [-1.78, up(3.5), cloth + 0.01],
        [0, 0, 1],
        { colour: DARK, width: 0.06 }
    );
    paint.line(
        [-0.95, up(1.75), cloth + 0.01],
        [-1.12, up(3.5), cloth + 0.01],
        [0, 0, 1],
        { colour: DARK, width: 0.06 }
    );
    paint.line(
        [-1.47, up(1.8), cloth + 0.01],
        [-1.45, up(3.4), cloth + 0.01],
        [0, 0, 1],
        { colour: hex("#122246"), width: 0.045 }
    );
    // the hat: a brim and a crown, seen from the front
    const round = (
        cx: number,
        cy: number,
        radius: number,
        depth: number
    ): Vec3[] =>
        Array.from({ length: 9 }, (_, i) => {
            const angle = (i / 9) * Math.PI * 2;
            return [
                cx + Math.cos(angle) * radius,
                cy + Math.sin(angle) * radius * 0.92,
                depth,
            ] as Vec3;
        });
    paint.poly(round(0.2, up(3.05), 0.62, z + 0.11), {
        palette: colours("#d9b648", "#e6c75c", "#c7a23a", "#b8922e"),
        under: hex("#6a531c"),
        flow: (along, across) => Math.atan2(across, along - 0.3) + Math.PI / 2,
        length: 0.4,
        width: 0.1,
        wobble: 0.1,
        density: 1.8,
    });
    paint.poly(round(0.2, up(3.08), 0.3, z + 0.2), {
        palette: colours("#e6c75c", "#f0d674", "#d9b648"),
        under: hex("#8a6c24"),
        length: 0.3,
        width: 0.09,
        density: 1.8,
    });
    for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2;
        paint.dab(
            [
                0.2 + Math.cos(angle) * 0.31,
                up(3.08) + Math.sin(angle) * 0.285,
                z + 0.2,
            ],
            [-Math.sin(angle), Math.cos(angle), 0],
            [0, 0, 1],
            0.24,
            0.06,
            hex("#3a2a5a"),
            { lift: 0.03 }
        );
    }
}

/** A framed picture on the right wall: `picture` paints inside the frame. */
function framed(
    paint: Painter,
    from: number,
    to: number,
    low: number,
    high: number,
    picture: (x: number, z0: number, z1: number, y0: number, y1: number) => void
) {
    paint.box([W - 0.08, low, from], [W, high, to], {
        palette: colours("#b8862a", "#caa040", "#9a6c1e"),
        under: hex("#4a3410"),
        grain: "y",
        faces: "xzZY",
        length: 0.5,
        width: 0.12,
    });
    picture(W - 0.1, from + 0.13, to - 0.13, low + 0.13, high - 0.13);
}

function pictures(paint: Painter) {
    // wheat under a blue sky
    framed(paint, -4.95, -3.65, up(3.3), up(4.5), (x, z0, z1, y0, y1) => {
        const horizon = y0 + (y1 - y0) * 0.55;
        paint.poly(
            [
                [x, y0, z0],
                [x, y0, z1],
                [x, horizon, z1],
                [x, horizon, z0],
            ],
            {
                palette: WHEAT,
                flow: 0.5,
                length: 0.3,
                width: 0.08,
                wobble: 0.5,
                density: 1.8,
            }
        );
        paint.poly(
            [
                [x, horizon, z0],
                [x, horizon, z1],
                [x, y1, z1],
                [x, y1, z0],
            ],
            {
                palette: SKY,
                flow: 0.1,
                length: 0.3,
                width: 0.08,
                wobble: 0.3,
                density: 1.8,
            }
        );
        paint.dab(
            [x, y1 - 0.16, z1 - 0.2],
            [0, 0, 1],
            [-1, 0, 0],
            0.16,
            0.14,
            STAR_CORE,
            { lift: 0.03 }
        );
    });
    // a cypress against the evening
    framed(paint, -3.3, -2.1, up(3.3), up(4.5), (x, z0, z1, y0, y1) => {
        paint.poly(
            [
                [x, y0, z0],
                [x, y0, z1],
                [x, y1, z1],
                [x, y1, z0],
            ],
            {
                palette: colours("#3f7fae", "#5596c0", "#2f6a9a", "#e0b54a"),
                flow: (along, across) => 0.6 * Math.sin(across * 6 + along * 3),
                length: 0.3,
                width: 0.08,
                wobble: 0.3,
                density: 1.8,
            }
        );
        const middle = (z0 + z1) / 2;
        paint.poly(
            [
                [x - 0.012, y0, middle - 0.16],
                [x - 0.012, y0, middle + 0.16],
                [x - 0.012, y1 - 0.08, middle],
            ],
            {
                palette: colours("#173d2a", "#1f4e34", "#0f2a1c"),
                flow: Math.PI / 2,
                length: 0.3,
                width: 0.07,
                wobble: 0.35,
                density: 2,
            }
        );
    });
}

/** The sky of this very world, hung over the bed head. */
function starryNight(paint: Painter) {
    const z = -D;
    const x0 = 2.05;
    const x1 = 4.0;
    const y0 = up(3.5);
    const y1 = up(5.05);
    paint.box([x0 - 0.13, y0 - 0.13, z], [x1 + 0.13, y1 + 0.13, z + 0.08], {
        palette: colours("#b8862a", "#caa040", "#9a6c1e"),
        under: hex("#4a3410"),
        grain: "x",
        faces: "ZxXY",
        length: 0.5,
        width: 0.12,
    });
    const canvas = z + 0.1;
    const wide = x1 - x0;
    const tall = y1 - y0;
    // the hills, then the sky turning about its swirl
    paint.poly(
        [
            [x0, y0, canvas],
            [x1, y0, canvas],
            [x1, y0 + tall * 0.3, canvas],
            [x0, y0 + tall * 0.22, canvas],
        ],
        {
            palette: colours("#1c3a7a", "#24509a", "#16306a", "#2f6a8a"),
            flow: 0.15,
            length: 0.32,
            width: 0.08,
            wobble: 0.3,
            density: 1.9,
        }
    );
    paint.poly(
        [
            [x0, y0 + tall * 0.22, canvas],
            [x1, y0 + tall * 0.3, canvas],
            [x1, y1, canvas],
            [x0, y1, canvas],
        ],
        {
            palette: colours(
                "#27489c",
                "#3560b6",
                "#1d3a86",
                "#5b8fd0",
                "#16296a"
            ),
            flow: (along, across) =>
                Math.atan2(across - tall * 0.33, along - wide * 0.5) +
                Math.PI / 2,
            length: 0.34,
            width: 0.08,
            wobble: 0.12,
            density: 2,
        }
    );
    // the moon, the stars, and the cypress in front
    const glow = (cx: number, cy: number, radius: number, core: Colour) => {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            paint.dab(
                [
                    cx + Math.cos(angle) * radius,
                    cy + Math.sin(angle) * radius,
                    canvas,
                ],
                [-Math.sin(angle), Math.cos(angle), 0],
                [0, 0, 1],
                radius * 0.9,
                radius * 0.32,
                STAR,
                { glow: true, lift: 0.028 }
            );
        }
        paint.dab(
            [cx, cy, canvas],
            [1, 0, 0],
            [0, 0, 1],
            radius * 0.9,
            radius * 0.8,
            core,
            { glow: true, lift: 0.032 }
        );
    };
    glow(x1 - 0.3, y1 - 0.3, 0.17, hex("#f4b23a"));
    glow(x0 + 0.75, y1 - 0.28, 0.09, STAR_CORE);
    glow(x0 + 1.15, y1 - 0.62, 0.08, STAR_CORE);
    glow(x0 + 0.42, y1 - 0.7, 0.07, STAR_CORE);
    paint.poly(
        [
            [x0 + 0.18, y0, canvas + 0.012],
            [x0 + 0.62, y0, canvas + 0.012],
            [x0 + 0.38, y1 - 0.12, canvas + 0.012],
        ],
        {
            palette: colours("#12261c", "#1a3626", "#0c1a14"),
            flow: Math.PI / 2,
            length: 0.32,
            width: 0.08,
            wobble: 0.3,
            density: 2,
        }
    );
}

/** The hanging lamp and the rings of light he paints round a flame. */
function lamp(paint: Painter) {
    const [x, y, z] = LAMP;
    const metal: PaintStyle = {
        palette: colours("#2a3a34", "#34483e", "#1f2c28"),
        length: 0.3,
        width: 0.08,
    };
    paint.beam([x, E - 0.24, z], [x, y + 0.42, z], [0, 0, 1], 0.05, 0.05, {
        ...metal,
        back: true,
    });
    paint.prism([x, z], 0.5, y + 0.14, y + 0.42, {
        ...metal,
        topRadius: 0.07,
        top: false,
        flow: Math.PI / 2,
    });
    paint.prism([x, z], 0.15, y - 0.16, y + 0.16, {
        palette: FLAME,
        under: hex("#ffe890"),
        length: 0.2,
        width: 0.08,
    });

    const rings = [
        { radius: 0.42, count: 9, colour: hex("#fff0a0") },
        { radius: 0.68, count: 13, colour: hex("#f6d048") },
        { radius: 0.96, count: 17, colour: hex("#e8a838") },
    ];
    // the same rings on three planes, so they read from anywhere in the room
    const planes: [Vec3, Vec3, Vec3][] = [
        [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
        [
            [0, 0, 1],
            [0, 1, 0],
            [1, 0, 0],
        ],
        [
            [1, 0, 0],
            [0, 0, 1],
            [0, -1, 0],
        ],
    ];
    for (const [a, b, facing] of planes)
        for (const [ringIndex, ring] of rings.entries())
            for (let i = 0; i < ring.count; i++) {
                const angle =
                    ((i + ringIndex * 0.5) / ring.count) * Math.PI * 2;
                const c = Math.cos(angle);
                const s = Math.sin(angle);
                paint.dab(
                    [
                        x + (a[0] * c + b[0] * s) * ring.radius,
                        y + (a[1] * c + b[1] * s) * ring.radius,
                        z + (a[2] * c + b[2] * s) * ring.radius,
                    ],
                    [
                        -a[0] * s + b[0] * c,
                        -a[1] * s + b[1] * c,
                        -a[2] * s + b[2] * c,
                    ],
                    facing,
                    ((ring.radius * Math.PI * 2) / ring.count) * 0.62,
                    0.075,
                    ring.colour,
                    { glow: true, lift: 0 }
                );
            }
}

function rug(paint: Painter) {
    const y = F + 0.012;
    paint.poly(
        [
            [-1.25, y, 3.5],
            [-1.25, y, 5.25],
            [1.15, y, 5.25],
            [1.15, y, 3.5],
        ],
        {
            palette: RUG,
            under: hex("#4a1a16"),
            flow: Math.PI / 2,
            length: 0.6,
            width: 0.15,
            wobble: 0.1,
            density: 1.7,
        }
    );
    for (const z of [3.72, 5.03])
        paint.line([-1.2, y, z], [1.1, y, z], [0, 1, 0], {
            colour: hex("#e2b54a"),
            width: 0.09,
        });
}

/**
 * Paints the whole room. `density` thins the strokes on phones; the same
 * `seed` always paints the same room.
 */
export function paintInterior({ density = 1, seed = 1889 } = {}) {
    const paint = createPainter({ seed, light: lampLight, density });
    shell(paint);
    for (const { from, to } of ROOM.windows) windowAt(paint, from, to);
    bed(paint);
    paint.place([0.55, F, -4.3], 0.3, () => chair(paint));
    paint.place([-3.7, F, 0.6], Math.PI / 2 - 0.25, () => chair(paint));
    table(paint);
    pegs(paint);
    pictures(paint);
    starryNight(paint);
    lamp(paint);
    rug(paint);
    return paint.build();
}
