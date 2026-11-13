/**
 * Frame-rate cap for the lobby and spaces.
 *
 * Both used to draw on every display refresh: 120 times a second on a
 * ProMotion MacBook, which kept the GPU half busy in a full lobby or a
 * heavy space and spun the fans. 60 frames a second looks the same for a
 * walking avatar and halves the work. `?fps=N` overrides it (0 or a value
 * above the display rate draws on every refresh, as before).
 */
export const DEFAULT_MAX_FPS = 60;

/** The cap from a `?fps=` value: a positive number, 0 for none, else the default. */
export function maxFrameRate(value: unknown): number {
    if (value === null || value === undefined || value === "")
        return DEFAULT_MAX_FPS;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MAX_FPS;
    return parsed;
}

/** Reads `?fps=` from a query string. */
export function maxFrameRateFromSearch(search: string): number {
    try {
        return maxFrameRate(new URLSearchParams(search).get("fps"));
    } catch {
        return DEFAULT_MAX_FPS;
    }
}

/**
 * Returns a function that says whether the frame at `time` (ms, the
 * requestAnimationFrame timestamp) should be drawn. On a 120 Hz display
 * with a 60 cap it draws every other refresh; on a 60 Hz display, every
 * refresh. A small tolerance absorbs refresh jitter so a 60 Hz display
 * never drops to 30.
 */
export function createFrameCap(maxFps: number) {
    const interval = maxFps > 0 ? 1000 / maxFps : 0;
    const tolerance = interval / 4;
    let last = -Infinity;
    return {
        shouldDraw(time: number): boolean {
            if (interval === 0) return true;
            if (time - last < interval - tolerance) return false;
            last = time;
            return true;
        },
        reset() {
            last = -Infinity;
        },
    };
}
