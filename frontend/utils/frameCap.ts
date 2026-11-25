/**
 * Frame-rate cap for spaces.
 *
 * Spaces used to draw on every display refresh: 120 times a second on a
 * ProMotion MacBook, which keeps the GPU busy and spins the fans for no
 * visible gain. The cap draws at most 60 frames a second.
 *
 * Devices that can't hold 60 are left to the resolution governor
 * (components/_3DExhibit-v2/three/utils/frameBudget.js), which lowers the
 * resolution instead of the frame rate.
 *
 * `?fps=N` sets another cap (`?fps=30` to compare); `?fps=0` draws on every
 * refresh, as before.
 */
export const DEFAULT_MAX_FPS = 60;

/** Refreshes this early are still drawn (display timing jitter). */
const JITTER_MS = 4;

/** The cap from a `?fps=` value: a number of 0 or more, else the default. */
export function maxFrameRate(value: unknown): number {
    if (value === null || value === undefined || value === "")
        return DEFAULT_MAX_FPS;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MAX_FPS;
    return parsed;
}

/**
 * Returns a gate that says whether the frame at `time` (ms, same clock as
 * requestAnimationFrame) should be drawn. A 60 cap draws every other
 * refresh on a 120 Hz display and every refresh on a 60 Hz one; a few
 * milliseconds of tolerance absorb refresh jitter so a 60 Hz display never
 * halves.
 */
export function createFrameCap(maxFps: number) {
    let next = -Infinity;
    return {
        shouldDraw(time: number): boolean {
            if (!(maxFps > 0)) return true;
            const interval = 1000 / maxFps;
            if (time < next - Math.min(interval / 4, JITTER_MS)) return false;
            // Keep the beat (so 60 on a 144 Hz display still averages 60),
            // but start over after a pause or a slow frame.
            next = next + interval < time ? time + interval : next + interval;
            return true;
        },
    };
}
