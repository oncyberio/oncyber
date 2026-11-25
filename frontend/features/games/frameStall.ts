/**
 * Whether what runs in a frame has stopped. A frame that has drawn says
 * `alive` about once a second from its own main thread; when that thread
 * hangs or dies the beats stop, and the page, which keeps running in its
 * own process, can say so and offer a way back. A hidden tab is slowed by
 * the browser, frame and page alike, so silence only counts while the page
 * has been in view.
 */
export const BEAT_EVERY_MS = 1_000;
export const STALLED_AFTER_MS = 8_000;

export function createStallWatch({
    now = () => Date.now(),
    stalledAfter = STALLED_AFTER_MS,
}: { now?(): number; stalledAfter?: number } = {}) {
    // Nothing is expected of a frame until it has beaten once.
    let last: number | null = null;
    let hidden = false;
    return {
        /** The frame said `alive`. */
        beat() {
            last = now();
        },
        /** The page went out of view, or came back. */
        setHidden(next: boolean) {
            // Coming back starts the wait again: the silence was the browser's.
            if (hidden && !next && last !== null) last = now();
            hidden = next;
        },
        stalled() {
            return !hidden && last !== null && now() - last > stalledAfter;
        },
    };
}
