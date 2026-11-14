/**
 * Loading, for the game side of the page bridge: progress while the game
 * prepares, one "first frame" signal the page waits for before it shows the
 * game, and a redraw on every resize so the page never shows a cleared
 * canvas. No DOM or renderer imports; `redrawOnResize` takes the window it
 * listens on. See docs/games/loading-and-pausing.md.
 *
 * Messages (the game's host adds its `<id>:` prefix in `post`):
 *
 *   progress     { value, label }          0..1, never goes down
 *   first-frame  { ms, width, height }     once, after a real frame is drawn
 *   frame        { width, height }         after each redraw at a new size
 */

export interface FrameSize {
    /** The game's viewport in CSS pixels (`innerWidth` x `innerHeight`). */
    width: number;
    height: number;
}
export interface LoadingOptions {
    /** Sends one bridge message to the page. */
    post(
        kind: "progress" | "first-frame" | "frame",
        data: Record<string, number | string>
    ): void;
    /** Milliseconds since the game's document started loading. */
    now?: () => number;
    /** At most one progress message per this many milliseconds (default 100). */
    minIntervalMs?: number;
}
export interface LoadingReport {
    /** Last progress value sent, 0..1. */
    progress: number;
    /** How many progress messages reached the page. */
    progressMessages: number;
    /** Milliseconds from document start to the first frame; null before it. */
    firstFrameMs: number | null;
    /** Redraws announced after the first frame. */
    redraws: number;
    size: FrameSize | null;
}
export interface Loading {
    /** Call during prepare. `value` is 0..1; lower values than the last are ignored. */
    progress(value: number, label?: string): void;
    /** Call once, right after the first real frame is drawn. Later calls do nothing. */
    firstFrame(size: FrameSize): void;
    /** Call after a redraw at a new size (see `redrawOnResize`). */
    redrawn(size: FrameSize): void;
    report(): LoadingReport;
}

const readSize = (size: FrameSize): FrameSize => {
    const side = (value: number) =>
        Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return { width: side(size?.width), height: side(size?.height) };
};

export function createLoading(options: LoadingOptions): Loading {
    const now =
        options.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
    const interval = options.minIntervalMs ?? 100;
    let progress = 0,
        sentAt = -Infinity,
        sentValue = -1,
        sentLabel = "",
        messages = 0;
    let firstFrameMs: number | null = null,
        redraws = 0,
        size: FrameSize | null = null;
    const loading: Loading = {
        progress(value, label = "") {
            // After the first frame there is nothing left to wait for.
            if (firstFrameMs !== null || !Number.isFinite(value)) return;
            progress = Math.max(progress, Math.min(1, Math.max(0, value)));
            const text = typeof label === "string" ? label.slice(0, 80) : "";
            const at = now();
            if (progress === sentValue && text === sentLabel) return;
            // The last step always gets through; the rest are rate limited.
            if (progress < 1 && at - sentAt < interval) return;
            sentAt = at;
            sentValue = progress;
            sentLabel = text;
            messages++;
            options.post("progress", { value: progress, label: text });
        },
        firstFrame(frame) {
            if (firstFrameMs !== null) return;
            firstFrameMs = Math.max(0, Math.round(now()));
            size = readSize(frame);
            progress = 1;
            options.post("first-frame", { ms: firstFrameMs, ...size });
        },
        redrawn(frame) {
            const next = readSize(frame);
            // Before the first frame there is nothing on screen to keep current.
            if (firstFrameMs === null) return;
            if (
                size &&
                size.width === next.width &&
                size.height === next.height
            )
                return;
            size = next;
            redraws++;
            options.post("frame", { ...next });
        },
        report: () => ({
            progress,
            progressMessages: messages,
            firstFrameMs,
            redraws,
            size: size && { ...size },
        }),
    };
    expose("loading", loading.report);
    return loading;
}

/**
 * The resize rule: a resize clears the canvas, so draw again in the same
 * task instead of leaving an empty canvas until the next animation frame (a
 * hidden or paused game may not get one). `draw` must resize the renderer
 * and render once; it runs even while the game is paused.
 */
export function redrawOnResize(
    loading: Loading,
    draw: () => void,
    target: {
        innerWidth: number;
        innerHeight: number;
        addEventListener(type: "resize", listener: () => void): void;
        removeEventListener(type: "resize", listener: () => void): void;
    }
): () => void {
    const resize = () => {
        draw();
        loading.redrawn({
            width: target.innerWidth,
            height: target.innerHeight,
        });
    };
    target.addEventListener("resize", resize);
    return () => target.removeEventListener("resize", resize);
}

/**
 * What `pnpm games:check` reads from inside the frame: read-only reports,
 * no game state. Shared with pausing.ts.
 */
export function expose(name: string, report: () => unknown) {
    const scope = globalThis as {
        __oncyberGame?: Record<string, () => unknown>;
    };
    (scope.__oncyberGame ??= {})[name] = report;
}
