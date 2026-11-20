import type { Point } from "./sculpt";

export const kitDigits = [
    "Thumb",
    "Index",
    "Middle",
    "Ring",
    "Little",
] as const;

/** Knuckle, tip and shaft radius in outward-facing wrist-to-tip lengths. */
export interface FingerSpread {
    length: number; // Fraction of the half-span of the entire drawn T-pose.
    wrist: number; // Radius of the exposed wrist in wrist-to-tip lengths.
    digits: [number, number, number, number, number][];
}

export function spreadKitJoints(
    rest: Record<string, number[]>,
    spread: FingerSpread
) {
    const joints: Record<string, Point> = {};
    for (const side of ["left", "right"]) {
        const sign = side === "left" ? 1 : -1;
        const chest = rest.upperChest[0],
            wrist = rest[side + "Hand"];
        const distal = rest[side + "MiddleDistal"][0],
            intermediate = rest[side + "MiddleIntermediate"][0];
        const halfSpan = Math.abs(2 * distal - intermediate - chest);
        const length = halfSpan * spread.length;
        const x = chest + sign * (halfSpan - length);
        joints[side + "Hand"] = [x, wrist[1], wrist[2]];
        kitDigits.forEach((name, i) => {
            const [ax, ay, bx, by, radius] = spread.digits[i];
            const chain = i
                ? ["Proximal", "Intermediate", "Distal"]
                : ["Metacarpal", "Proximal", "Distal"];
            // The drawn palm faces out. Keep a rounded knuckle arch and
            // bring the opposed thumb forward of the palm in profile.
            const depth = i ? 0.035 * (1 - ((i - 2.5) / 1.5) ** 2) : 0.1;
            chain.forEach((joint, j) => {
                const t = j / 3;
                joints[side + name + joint] = [
                    x + sign * length * (ax + (bx - ax) * t),
                    wrist[1] + length * (ay + (by - ay) * t),
                    wrist[2] + length * (depth + radius * t * (i ? 0.42 : 1)),
                ];
            });
        });
    }
    return joints;
}
