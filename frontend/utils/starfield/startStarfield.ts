/**
 * Starts the loading stars (./stars.ts) on a canvas the caller has put in
 * the page, and keeps them the size of that canvas.
 *
 * Where the browser can hand a canvas to a worker, the stars are drawn
 * there: the page's own main thread is at its busiest exactly while
 * something loads (starting up, changing route), and stars drawn on it
 * stall with it. Otherwise they are drawn here, by the same clock.
 *
 * A canvas can be handed over once, so give this a canvas of its own and
 * throw it away after `stop()`.
 */
import { pacing, paintStars, starClock, type StarPacing } from "./stars";
import { createStarfieldWorker } from "./starfieldWorkerFactory";

export interface RunningStars {
    /** Stops drawing. Resolves with how evenly the frames came. */
    stop(): Promise<StarPacing & { thread: "worker" | "page" }>;
}

/** Sharp enough, without drawing four times the pixels on a dense screen. */
const MAX_PIXELS = 2;

export function startStarfield(canvas: HTMLCanvasElement): RunningStars {
    const measure = () => measureOf(canvas);

    let worker: Worker | null = null;
    try {
        if (
            typeof canvas.transferControlToOffscreen === "function" &&
            typeof Worker === "function"
        )
            worker = createStarfieldWorker();
    } catch {
        worker = null;
    }

    if (worker) {
        const offscreen = canvas.transferControlToOffscreen();
        const running = worker;
        running.postMessage(
            { type: "start", canvas: offscreen, ...measure() },
            [offscreen]
        );
        const resize = () =>
            running.postMessage({ type: "size", ...measure() });
        window.addEventListener("resize", resize);
        // A worker that cannot load draws nothing, and the canvas it was
        // given cannot be taken back: the stars carry on here, on a canvas
        // put in its place.
        let here: RunningStars | null = null;
        let spare: HTMLCanvasElement | null = null;
        let stopped = false;
        running.onerror = () => {
            if (stopped || here) return;
            window.removeEventListener("resize", resize);
            running.terminate();
            spare = canvas.cloneNode(false) as HTMLCanvasElement;
            canvas.replaceWith(spare);
            here = onPage(spare);
        };
        return {
            stop() {
                stopped = true;
                window.removeEventListener("resize", resize);
                if (here) {
                    const stopping = here.stop();
                    spare?.remove();
                    return stopping;
                }
                return new Promise((resolve) => {
                    const done = (read?: StarPacing) => {
                        clearTimeout(timer);
                        running.terminate();
                        resolve({
                            ...(read || { frames: 0, worstGap: 0, hitches: 0 }),
                            thread: "worker",
                        });
                    };
                    // A worker that does not answer is stopped all the same.
                    const timer = setTimeout(() => done(), 500);
                    running.onmessage = (event) =>
                        event.data?.type === "pacing" &&
                        done(event.data.pacing);
                    running.postMessage({ type: "stop" });
                });
            },
        };
    }

    return onPage(canvas);

    function measureOf(target: HTMLCanvasElement) {
        return {
            width: Math.max(1, target.clientWidth || window.innerWidth),
            height: Math.max(1, target.clientHeight || window.innerHeight),
            pixels: Math.min(MAX_PIXELS, window.devicePixelRatio || 1),
        };
    }

    /** The same stars, drawn on this thread. */
    function onPage(target: HTMLCanvasElement): RunningStars {
        const context = target.getContext("2d");
        const paced = pacing();
        let frame = 0;
        let ended = false;
        let view = measureOf(target);
        const fit = () => {
            view = measureOf(target);
            target.width = Math.round(view.width * view.pixels);
            target.height = Math.round(view.height * view.pixels);
        };
        const paint = () => {
            frame = 0;
            if (ended || !context) return;
            if (!document.hidden) {
                paced.frame(performance.now());
                paintStars(
                    context,
                    view.width,
                    view.height,
                    view.pixels,
                    starClock()
                );
            }
            frame = requestAnimationFrame(paint);
        };
        fit();
        window.addEventListener("resize", fit);
        paint();
        return {
            stop() {
                ended = true;
                cancelAnimationFrame(frame);
                window.removeEventListener("resize", fit);
                return Promise.resolve({ ...paced.read(), thread: "page" });
            },
        };
    }
}
