import type { Drawing } from "./drawing";
import type { Point } from "./sculpt";
import { turnContours } from "./turnContours";

/** Height, left/right extents, depth radius, depth center, fractional depth at
 * maximum width, and superellipse exponent. A regular oval uses 0.5 and 2. */
export type RoundedSection = [
    number,
    number,
    number,
    number,
    number,
    number,
    number
];

export function roundedProfileRows(
    sections: RoundedSection[],
    sides: number
): Point[][] {
    if (sections.length < 2 || !Number.isInteger(sides) || sides < 3)
        throw new Error(
            "A rounded profile needs at least two sections and three sides"
        );
    if (
        sections.some(
            (row, i) =>
                !row.every(Number.isFinite) ||
                (i > 0 && row[0] <= sections[i - 1][0]) ||
                row[1] > row[2] ||
                row[3] < 0 ||
                row[5] < 0 ||
                row[5] > 1 ||
                row[6] <= 0
        )
    )
        throw new Error(
            "Invalid rounded profile extents, height order, or curvature"
        );
    return sections.map(
        ([y, left, right, radius, center, widest, exponent]) => {
            const tangent = center + radius * (2 * widest - 1);
            return Array.from({ length: sides + 1 }, (_, i): Point => {
                const angle = ((i % sides) * 2 * Math.PI) / sides;
                const sin = Math.sin(angle),
                    cos = Math.cos(angle);
                const half =
                    cos >= 0
                        ? center + radius - tangent
                        : tangent - center + radius;
                return [
                    (left + right) / 2 +
                        ((right - left) / 2) *
                            Math.sign(sin) *
                            Math.abs(sin) ** (2 / exponent),
                    y,
                    tangent +
                        half * Math.sign(cos) * Math.abs(cos) ** (2 / exponent),
                ];
            });
        }
    );
}

/** Compile once so skin, hair and face markings sample the same triangles. */
export function drawRoundedProfile(
    d: Drawing,
    stations: RoundedSection[],
    pigment: string,
    sides = 24,
    caps: "both" | "start" | "end" | "none" = "both"
) {
    const rings = roundedProfileRows(stations, sides);
    const cap = (row: RoundedSection) =>
        rings[0].map((): Point => [(row[1] + row[2]) / 2, row[0], row[4]]);
    const previous = d.s.preserveVertex;
    const extent = Math.max(
        ...stations.map((row) => Math.max(row[2] - row[1], row[3] * 2))
    );
    const contour = turnContours(
        rings,
        extent * (d.s.detail === "crowd" ? 0.012 : 0.004)
    );
    d.s.preserveVertex = (x, y, z) => contour(x, y, z) || !!previous?.(x, y, z);
    if (caps === "both" || caps === "start") rings.unshift(cap(stations[0]));
    if (caps === "both" || caps === "end") rings.push(cap(stations.at(-1)));
    try {
        return d.s.surface(rings, pigment, true, undefined, 0.28);
    } finally {
        d.s.preserveVertex = previous;
    }
}
