/**
 * Ends the current task so input, rendering and network callbacks can run
 * before the next heavy loading step (collider build, environment capture).
 * Uses scheduler.yield where available, otherwise a zero-delay timer.
 *
 * @returns { Promise<void> }
 */
export function yieldTask() {

    const scheduler = /** @type {any} */ (globalThis).scheduler

    if (typeof scheduler?.yield === "function") return scheduler.yield()

    return new Promise(resolve => setTimeout(resolve, 0))
}
