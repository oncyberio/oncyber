/** Long synchronous builds written as generators: `yield` marks a safe pause. */
export type SlicedWork<T> = Generator<void, T, void>;

export function finishNow<T>(work: SlicedWork<T>): T {
    for (;;) {
        const step = work.next();
        if (step.done) return step.value;
    }
}

/** Keep background construction below the visible animation's frame budget.
 * A slow frame is never permission to spend more time on loading next frame. */
const SLICE_MS = 3;

export async function finishInSlices<T>(
    work: SlicedWork<T>,
    pause: () => Promise<void>,
    now: () => number = () => performance.now()
): Promise<T> {
    let sliceStart = now();
    for (;;) {
        const step = work.next();
        if (step.done) return step.value;
        if (now() - sliceStart < SLICE_MS) continue;
        await pause();
        sliceStart = now();
    }
}
