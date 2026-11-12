/** World-space wave measured from the player's anchored feet. */
export type RevealPoint = { x: number; y: number; z: number };
export type WorldRevealDirection = "outward" | "inward";
export interface RadialRevealCell {
    key: string;
    center: RevealPoint;
}
export interface RadialRevealStep {
    key: string;
    /** Normalized start time along the chosen spatial direction. */
    fraction: number;
    seed: number;
    distance: number;
}
const pointIsFinite = (p: RevealPoint) =>
    p && [p.x, p.y, p.z].every(Number.isFinite);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function spatialSeed(center: RevealPoint) {
    const text = `${center.x.toFixed(6)}:${center.y.toFixed(
        6
    )}:${center.z.toFixed(6)}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++)
        hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0) / 4294967296;
}
export function buildRadialCellSchedule(
    cells: readonly RadialRevealCell[],
    anchor: RevealPoint,
    options: {
        radius?: number;
        fullRange?: boolean;
        /** Minimum full-range extent, shared by separately prepared surfaces. */
        extent?: number;
        direction?: WorldRevealDirection;
    } = {}
): RadialRevealStep[] {
    if (!pointIsFinite(anchor))
        throw new Error("Reveal anchor needs finite coordinates.");
    const entries = cells.map(({ key, center }) => {
        if (!pointIsFinite(center))
            throw new Error("Reveal cells need finite coordinates.");
        return {
            key,
            seed: spatialSeed(center),
            distance: Math.hypot(
                center.x - anchor.x,
                center.y - anchor.y,
                center.z - anchor.z
            ),
        };
    });
    const distances = entries
        .map((entry) => entry.distance)
        .sort((a, b) => a - b);
    // A little headroom lets the typical outer ring finish naturally. A lone
    // distant asset cannot compress all nearby architecture into the first frame.
    const typical =
        distances[Math.floor(Math.max(0, distances.length - 1) * 0.9)] ?? 1;
    const radius =
        Number.isFinite(options.radius) && options.radius > 0
            ? options.radius
            : Math.max(1, Math.min(18, typical * 1.15));
    const extent = Math.max(
        distances[distances.length - 1] ?? radius,
        Number.isFinite(options.extent) && options.extent > 0
            ? options.extent
            : 0
    );
    return entries
        .map((entry) => {
            // Full galleries retain a detailed local wave while upper and distant
            // architecture continues in sequence instead of sharing one final delay.
            const base = clamp(
                options.fullRange
                    ? Math.log1p(entry.distance / radius) /
                          Math.max(1e-9, Math.log1p(extent / radius))
                    : entry.distance / radius
            );
            const jitter =
                (entry.seed - 0.5) * 0.06 * (1 - Math.abs(base * 2 - 1));
            const outward = clamp(base + jitter);
            return {
                ...entry,
                fraction:
                    options.direction === "inward" ? 1 - outward : outward,
            };
        })
        .sort((a, b) => a.key.localeCompare(b.key));
}
