/**
 * Keeps a framed world's frames coming.
 *
 * A browser slows the animation frames of a frame from another origin
 * whenever it judges the frame unseen: to about two a second in Chrome
 * while something opaque covers it (the page's loading cover does), or
 * while it is transparent (as the lobby holds a world it is preparing). The
 * engine paces its loading by frames, so a world loaded several times
 * slower inside the frame than in the page (measured: 134 s against 51 s
 * for a 25 MB world).
 *
 * So each frame the world asks for is also promised by a timer. Whichever
 * comes first runs it. While the browser gives frames freely (about 16 ms
 * apart) the timer never wins and nothing changes. While it holds them
 * back, the world still gets about twenty a second. In a tab that is not
 * showing, nothing is forced: the world rests as any page does.
 */
export const FRAME_PROMISED_MS = 50;

export function keepFramesComing(win: Window, promised = FRAME_PROMISED_MS) {
    const own = {
        request: win.requestAnimationFrame,
        cancel: win.cancelAnimationFrame,
    };
    if (!own.request || !own.cancel) return () => {};
    const request = own.request.bind(win);
    const cancel = own.cancel.bind(win);
    let next = 0;
    const waiting = new Map<number, { frame: number; timer: number }>();
    const settle = (id: number) => {
        const held = waiting.get(id);
        if (!held) return false;
        waiting.delete(id);
        cancel(held.frame);
        win.clearTimeout(held.timer);
        return true;
    };
    win.requestAnimationFrame = (callback: FrameRequestCallback) => {
        const id = ++next;
        const run = (time: number) => {
            if (settle(id)) callback(time);
        };
        waiting.set(id, {
            frame: request(run),
            timer: win.setTimeout(() => {
                if (win.document.visibilityState === "visible")
                    run(win.performance.now());
            }, promised) as unknown as number,
        });
        return id;
    };
    win.cancelAnimationFrame = (id: number) => void settle(id);
    return () => {
        win.requestAnimationFrame = own.request;
        win.cancelAnimationFrame = own.cancel;
    };
}
