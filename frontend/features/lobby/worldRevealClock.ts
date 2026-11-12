/** A reveal advances through presented frames, never through shader/upload stalls.
 * Start at zero on the first visible frame. Hidden tabs do not consume motion.
 */
export function createWorldRevealClock(durationMs: number) {
    let previous: number | undefined;
    let elapsed = 0;
    return {
        sample(now: number, visible = true) {
            if (!visible) {
                previous = undefined;
                return elapsed / durationMs;
            }
            if (previous !== undefined && Number.isFinite(now))
                elapsed = Math.min(durationMs, elapsed + Math.min(50, Math.max(0, now - previous)));
            previous = Number.isFinite(now) ? now : undefined;
            return elapsed / durationMs;
        },
    };
}
