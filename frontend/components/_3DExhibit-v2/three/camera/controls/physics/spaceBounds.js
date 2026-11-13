// @ts-check

// Picks a respawn spot inside the space. A shared link's coords can point
// outside the space; respawning there after a fall would drop the player
// again and again, so physics falls back to the room's own spawn.

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
