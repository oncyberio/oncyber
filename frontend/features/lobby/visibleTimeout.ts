/**
 * A timeout that counts only time the page is visible.
 *
 * A hidden tab gets no animation frames and the shared loading scheduler
 * (`utils/lobbyLoadingBudget.ts`) grants no work, so a trip cannot progress
 * while the visitor is in another tab. Its watchdogs must not count that time
 * either, or a trip left loading in the background fails for nothing.
 */
export function startVisibleTimeout(
    run: () => void,
    milliseconds: number,
    page: Pick<
        Document,
        "hidden" | "addEventListener" | "removeEventListener"
    > = document
) {
    let remaining = Math.max(0, milliseconds);
    let startedAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const start = () => {
        startedAt = performance.now();
        timer = setTimeout(() => {
            timer = null;
            done = true;
            page.removeEventListener("visibilitychange", change);
            run();
        }, remaining);
    };
    const pause = () => {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
    };
    const change = () => {
        if (done) return;
        if (page.hidden) pause();
        else if (timer === null) start();
    };
    page.addEventListener("visibilitychange", change);
    if (!page.hidden) start();
    return () => {
        done = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        page.removeEventListener("visibilitychange", change);
    };
}
