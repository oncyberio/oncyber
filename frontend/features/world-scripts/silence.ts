/**
 * A limit on how long something may say nothing, in place of a limit on
 * how long it may take. A script's first frames are counted in the world's
 * frames, and a slow device or a tab in the background draws few or none:
 * a fixed time limit there fails a script for the device's pace. What a
 * broken script does is go quiet while it owes an answer, and that is what
 * this watches for.
 */
export interface SilenceWatch {
    /** It said something: the wait starts again. */
    heard(): void;
    stop(): void;
}

interface Timers {
    setTimeout(run: () => void, ms: number): unknown;
    clearTimeout(timer: any): void;
}

/**
 * Calls `onSilent` once nothing has been heard for `ms` while `owed()` is
 * true: while an answer is due. Silence with nothing owed (no frame was
 * drawn, so nothing was asked) is not the script's and is waited out.
 */
export function watchSilence(
    ms: number,
    onSilent: () => void,
    owed: () => boolean = () => true,
    timers: Timers = globalThis
): SilenceWatch {
    let timer: unknown;
    let stopped = false;
    const arm = () => {
        timers.clearTimeout(timer);
        if (stopped) return;
        timer = timers.setTimeout(() => {
            if (stopped) return;
            if (owed()) {
                stopped = true;
                onSilent();
            } else arm();
        }, ms);
    };
    arm();
    return {
        heard: arm,
        stop() {
            stopped = true;
            timers.clearTimeout(timer);
        },
    };
}
