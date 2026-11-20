import { looks } from "./streetwearRecipes";
import classic from "./rick-classic.json";
import sunshineJoints from "./sunshine-rig.json";
import type { Character } from "./catalog";
import type { Point } from "./sculpt";

/** x/y are landmarks on the 850 × 730 drawing; depth is inferred in the same
 * pixel units, positive toward the viewer. Keep FoV out of the recipes. */
export const cmPerPixel = 0.28;
export const composition = {
    lux: looks.lux.origin,
    remy: looks.remy.origin,
    vale: looks.vale.origin,
    morty: { x: 153, floor: 709 },
    summer: { x: 381, floor: 697 },
    "rick-classic": { x: classic.mirror, floor: 717 },
    rick: { x: 683, floor: 704 },
    sunshine: { x: 350, floor: 690 },
};
/** Knuckle x/y, fingertip x/y and optional observed radius in the drawing. */
export type OpenHand = [number, number, number, number, number?][];
export type Chain = [Point, Point, Point];
export type Landmarks = {
    restJoints?: Record<string, number[]>;
    handScale?: number;
    palmRoll?: number;
    openHands?: [OpenHand | null, OpenHand | null];
    hip: Point;
    neck: Point;
    jaw: Point;
    headYaw: number;
    headPitch?: number;
    headRoll?: number;
    torsoYaw: number;
    arms: [Chain, Chain];
    legs: [Chain, Chain];
    feet: [Point, Point];
    fingers: [Point, Point];
    grip: [boolean, boolean];
};
export const landmarks: Record<Character, Landmarks> = {
    lux: looks.lux.landmarks,
    remy: looks.remy.landmarks,
    vale: looks.vale.landmarks,
    "rick-classic": {
        restJoints: classic.joints,
        hip: classic.joints.hips as Point,
        neck: classic.joints.neck as Point,
        jaw: classic.joints.head as Point,
        headYaw: 0,
        torsoYaw: 0,
        arms: ["right", "left"].map((s) =>
            ["UpperArm", "LowerArm", "Hand"].map((n) => classic.joints[s + n])
        ) as [Chain, Chain],
        legs: ["right", "left"].map((s) =>
            ["UpperLeg", "LowerLeg", "Foot"].map((n) => classic.joints[s + n])
        ) as [Chain, Chain],
        feet: [classic.joints.rightToes, classic.joints.leftToes] as [
            Point,
            Point
        ],
        fingers: [
            [-1, 0, 0],
            [1, 0, 0],
        ],
        grip: [false, false],
    },
    sunshine: {
        restJoints: sunshineJoints,
        hip: [350, 358, 0],
        neck: [350, 194, 0],
        jaw: [350, 148, 4],
        headYaw: 0,
        torsoYaw: 0,
        arms: [
            [
                [253, 211, 0],
                [155, 211, 0],
                [65, 211, 0],
            ],
            [
                [447, 211, 0],
                [545, 211, 0],
                [635, 211, 0],
            ],
        ],
        legs: [
            [
                [312, 376, 0],
                [311, 529, -3],
                [312, 658, -9],
            ],
            [
                [388, 376, 0],
                [389, 529, -3],
                [388, 658, -9],
            ],
        ],
        feet: [
            [312, 689, 40],
            [388, 689, 40],
        ],
        fingers: [
            [-1, 0, 0],
            [1, 0, 0],
        ],
        grip: [false, false],
    },
    morty: {
        hip: [151, 482, 0],
        neck: [145, 333, 1],
        jaw: [143, 319, 7],
        headYaw: -0.41,
        torsoYaw: -0.36,
        arms: [
            [
                [124, 338, -18],
                [90, 420, -3],
                [78, 503, 52],
            ],
            [
                [177, 337, 10],
                [152, 402, 32],
                [93, 498, 47],
            ],
        ],
        legs: [
            [
                [133, 486, -5],
                [122, 579, -9],
                [132, 674, -17],
            ],
            [
                [174, 484, 5],
                [170, 581, 8],
                [187, 674, 16],
            ],
        ],
        feet: [
            [100, 692, -9],
            [198, 699, 33],
        ],
        fingers: [
            [-0.38, 0.91, 0.13],
            [-0.56, 0.81, 0.11],
        ],
        grip: [true, true],
    },
    summer: {
        hip: [378, 435, 0],
        neck: [381, 277, 0],
        jaw: [382, 260, 2],
        headYaw: 0.1,
        torsoYaw: 0.07,
        arms: [
            [
                [349, 288, 0],
                [328, 378, -1],
                [319, 460, 2],
            ],
            [
                [413, 286, -2],
                [433, 373, 1],
                [438, 458, 3],
            ],
        ],
        legs: [
            [
                [355, 444, -3],
                [363, 546, -7],
                [369, 639, -9],
            ],
            [
                [399, 443, 3],
                [392, 548, 5],
                [387, 642, 10],
            ],
        ],
        feet: [
            [370, 686, -3],
            [397, 692, 35],
        ],
        fingers: [
            [-0.13, 0.98, 0.12],
            [0.22, 0.96, 0.12],
        ],
        grip: [false, false],
    },
    rick: {
        hip: [683, 346, 0],
        neck: [673, 156, 10],
        jaw: [666, 151, 19],
        headYaw: -0.29,
        torsoYaw: -0.27,
        arms: [
            [
                [642, 154, -13],
                [606, 211, 49],
                [629, 186, 99],
            ],
            [
                [713, 154, 30],
                [683, 212, 64],
                [657, 195, 123],
            ],
        ],
        legs: [
            [
                [653, 360, -7],
                [645, 502, -10],
                [679, 649, -27],
            ],
            [
                [708, 358, 8],
                [713, 493, 34],
                [723, 633, 53],
            ],
        ],
        feet: [
            [626, 695, -15],
            [727, 680, 82],
        ],
        fingers: [
            [0.19, -0.91, 0.35],
            [-0.92, 0.24, 0.32],
        ],
        grip: [true, true],
    },
};
