import type { WorldCubeRevealOptions } from "./worldCubeReveal";

type FitSettings = Pick<
    WorldCubeRevealOptions,
    | "cellSize"
    | "radius"
    | "coverage"
    | "refinement"
    | "rigidProps"
    | "maxCells"
    | "maxTriangles"
    | "maxFragments"
    | "maxClipTests"
    | "maxBatches"
    | "maxInstances"
>;
type Hint = { signature: string; cellSize: number };
type SavedHint = Hint & { destination: string; updatedAt: number };
const memory = new WeakMap<object, Hint>();
const STORAGE_KEY = "oncyber:world-reveal-fit:v2";
const MAX_HINTS = 24;
const MAX_AGE = 6 * 60 * 60 * 1000;
const baseSize = (settings: FitSettings) =>
    Number.isFinite(settings.cellSize)
        ? Math.max(0.3, Math.min(8, settings.cellSize))
        : 0.55;
const signature = (settings: FitSettings) =>
    JSON.stringify([
        "camera-detail-rigid-v4",
        baseSize(settings),
        settings.coverage ?? "nearby",
        Number.isFinite(settings.radius) ? settings.radius : "unbounded",
        settings.maxCells ?? 12000,
        settings.maxTriangles ?? 120000,
        settings.maxFragments ?? 20000,
        settings.maxClipTests ?? 250000,
        settings.maxBatches ?? 128,
        settings.maxInstances ?? 4096,
        settings.refinement?.minCellSize ?? null,
        settings.refinement?.maxCellSize ?? null,
        settings.refinement?.detailRadius ?? 8,
        settings.rigidProps?.minTriangles ?? null,
        settings.rigidProps?.maxExtent ?? null,
        settings.rigidProps?.maxSources ?? null,
        settings.rigidProps?.maxTriangles ?? null,
    ]);
const validDestination = (key?: string) =>
    typeof key === "string" && key.length > 0 && key.length <= 256;
function savedHints(): SavedHint[] {
    try {
        if (typeof window === "undefined") return [];
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (!stored || stored.length > 16384) return [];
        const values = JSON.parse(stored);
        if (!Array.isArray(values)) return [];
        const now = Date.now();
        return values
            .filter(
                (value) =>
                    value &&
                    validDestination(value.destination) &&
                    typeof value.signature === "string" &&
                    value.signature.length <= 512 &&
                    Number.isFinite(value.cellSize) &&
                    value.cellSize >= 0.3 &&
                    value.cellSize <= 8 &&
                    Number.isFinite(value.updatedAt) &&
                    value.updatedAt <= now &&
                    now - value.updatedAt < MAX_AGE
            )
            .slice(-MAX_HINTS);
    } catch {
        return [];
    }
}
/** A hint only chooses the first trial; the live geometry still runs every limit.
 * Scene identity covers arrival-to-departure. Optional destination keys retain a
 * bounded numeric hint across same-tab iframe visits, never geometry or assets. */
export function readWorldRevealFitHint(
    scene: object,
    settings: FitSettings,
    destinationKey?: string
): number {
    const key = signature(settings),
        minimum = baseSize(settings);
    let hint = memory.get(scene);
    if (hint?.signature !== key && validDestination(destinationKey)) {
        hint = savedHints().find(
            (entry) =>
                entry.destination === destinationKey && entry.signature === key
        );
        if (hint) memory.set(scene, hint);
    }
    return hint?.signature === key ? Math.max(minimum, hint.cellSize) : minimum;
}
/** Remember only a complete bounded fit; a failed last trial is not evidence. */
export function rememberWorldRevealFitHint(
    scene: object,
    settings: FitSettings,
    result: { cellSize: number; budgetLimited: boolean },
    destinationKey?: string
) {
    if (
        result.budgetLimited ||
        !Number.isFinite(result.cellSize) ||
        result.cellSize < baseSize(settings) ||
        result.cellSize > 8
    )
        return;
    const hint = { signature: signature(settings), cellSize: result.cellSize };
    memory.set(scene, hint);
    if (!validDestination(destinationKey)) return;
    try {
        if (typeof window === "undefined") return;
        const saved = savedHints().filter(
            (entry) => entry.destination !== destinationKey
        );
        saved.push({
            ...hint,
            destination: destinationKey,
            updatedAt: Date.now(),
        });
        window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(saved.slice(-MAX_HINTS))
        );
    } catch {
        /* Private/storage-restricted browsers still reuse the scene hint. */
    }
}
