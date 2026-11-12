import type { createWorldCubeReveal } from "./worldCubeReveal";
import type { WorldCubeRevealOptions } from "./worldCubeReveal";

type Effect = ReturnType<typeof createWorldCubeReveal>;
export type WorldTransitionCacheDetails = {
    cellSize: number;
    triangleBudget: number;
    refinement: WorldCubeRevealOptions["refinement"];
};
type Entry = {
    scene: object;
    effect: Effect;
    details: WorldTransitionCacheDetails;
};

// One live native space owns these buffers. Reuse the arrival allocation rather
// than retaining copies across URLs/iframes or compiling again while walking.
let cached: Entry | undefined;

export function clearWorldTransitionCache() {
    const previous = cached;
    cached = undefined;
    previous?.effect.dispose();
}

/** Ownership transfers only when parking succeeded; the caller still owns a miss. */
export function rememberWorldTransition(
    scene: object,
    effect: Effect,
    details: WorldTransitionCacheDetails
): boolean {
    if (!scene || !effect.park?.()) return false;
    if (cached?.effect !== effect) clearWorldTransitionCache();
    cached = { scene, effect, details };
    return true;
}

/** Take ownership once. Scene or source changes safely fall back to a fresh build. */
export function takeWorldTransition(
    scene: object,
    onMiss?: (reason: string) => void
): Entry | undefined {
    const entry = cached;
    cached = undefined;
    if (!entry) {
        onMiss?.("empty");
        return undefined;
    }
    try {
        if (entry.scene === scene && entry.effect.canReuse()) return entry;
        onMiss?.(
            entry.scene !== scene
                ? "scene-changed"
                : entry.effect.stats.reuseMiss || "source-changed"
        );
    } catch {
        // A disposed or custom source cannot strand the departure.
        onMiss?.("validation-error");
    }
    entry.effect.dispose();
    return undefined;
}
