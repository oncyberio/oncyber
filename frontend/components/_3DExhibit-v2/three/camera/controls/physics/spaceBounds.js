// @ts-check

// Keeps the player inside the space. A player who ends up far outside the
// space's geometry (launched by a bad collision, or loaded from a shared link
// whose coords point outside) sees only the background colour, so physics
// sends them back to a spawn that is actually inside the space.

/** How far past the space's bounds, in metres, a player may wander. */
export const OUTSIDE_MARGIN = 20;

/** Pure: no three.js, so it runs in tests without a renderer. */

/**
 * @typedef {{ x: number, y: number, z: number }} XYZ
 * @typedef {{ min: XYZ, max: XYZ }} Bounds
 * @typedef {XYZ & { reference?: string }} SpawnPosition
 */

/** @param {Bounds | null | undefined} bounds */
function usable(bounds) {
    return (
        bounds != null &&
        [bounds.min?.x, bounds.min?.z, bounds.max?.x, bounds.max?.z].every(
            Number.isFinite
        ) &&
        bounds.min.x <= bounds.max.x &&
        bounds.min.z <= bounds.max.z
    );
}

/**
 * True when the player has left the space: fallen well below it, or gone
 * far past its sides or its top.
 *
 * @param {XYZ} position player feet (or camera, in first person)
 * @param {Bounds | null | undefined} bounds the space's bounding box
 * @param {number} userHeight
 */
export function isOutsideSpace(position, bounds, userHeight) {
    if (!usable(bounds)) return false;

    const { x, y, z } = position;

    if (![x, y, z].every(Number.isFinite)) return true;

    if (y < bounds.min.y - userHeight * 5) return true;

    return (
        x < bounds.min.x - OUTSIDE_MARGIN ||
        x > bounds.max.x + OUTSIDE_MARGIN ||
        z < bounds.min.z - OUTSIDE_MARGIN ||
        z > bounds.max.z + OUTSIDE_MARGIN ||
        y > bounds.max.y + OUTSIDE_MARGIN
    );
}

/**
 * True when a spawn stands over the space's footprint and not absurdly high
 * above it. Spawn heights are usually relative to the head, so only a
 * generous ceiling check applies.
 *
 * @param {SpawnPosition | null | undefined} spawn
 * @param {Bounds | null | undefined} bounds
 */
export function isSpawnInsideSpace(spawn, bounds) {
    if (spawn == null) return false;

    const x = spawn.x || 0;
    const y = spawn.y || 0;
    const z = spawn.z || 0;

    if (![x, y, z].every(Number.isFinite)) return false;

    if (!usable(bounds)) return true;

    const above = spawn.reference === "absolute" ? y : y + bounds.min.y;

    return (
        x >= bounds.min.x - 1 &&
        x <= bounds.max.x + 1 &&
        z >= bounds.min.z - 1 &&
        z <= bounds.max.z + 1 &&
        above <= (Number.isFinite(bounds.max.y) ? bounds.max.y : Infinity) + 1
    );
}

/**
 * The first spawn that is inside the space. Falls back to the space's
 * origin, the default spawn of every space, and then to the middle of the
 * space's footprint.
 *
 * @param {Array<SpawnPosition | null | undefined>} candidates best first
 * @param {Bounds | null | undefined} bounds
 * @returns {SpawnPosition}
 */
export function pickSpawnInsideSpace(candidates, bounds) {
    for (const spawn of candidates) {
        if (isSpawnInsideSpace(spawn, bounds)) return spawn;
    }

    const origin = { x: 0, y: 0, z: 0, reference: "head" };

    if (!usable(bounds) || isSpawnInsideSpace(origin, bounds)) return origin;

    return {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: 0,
        z: (bounds.min.z + bounds.max.z) / 2,
        reference: "head",
    };
}
