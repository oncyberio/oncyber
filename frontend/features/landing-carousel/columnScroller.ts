type Options = {
    read: () => number;
    write: (position: number) => void;
    stride: () => number;
    maxColumn: () => number;
    reducedMotion: () => boolean;
    requestFrame: (callback: (time: number) => void) => number;
    cancelFrame: (id: number) => void;
    onTarget: (column: number | null) => void;
    now: () => number;
};

/** Wheel and drag input remain pixel-based; only explicit navigation animates. */
export function createColumnScroller(options: Options) {
    let frame = 0;
    let disposed = false;
    const clamp = (position: number) =>
        Math.max(0, Math.min(options.maxColumn() * options.stride(), position));
    function cancel() {
        if (frame) options.cancelFrame(frame);
        frame = 0;
        options.onTarget(null);
    }
    return {
        wheel(delta: number) {
            if (disposed || !Number.isFinite(delta) || delta === 0) return;
            cancel();
            options.write(clamp(options.read() + delta));
        },
        endWheel() {},
        settle() {},
        beginDrag() {
            if (!disposed) cancel();
        },
        dragTo(position: number) {
            if (disposed || !Number.isFinite(position)) return;
            cancel();
            options.write(clamp(position));
        },
        goTo(column: number) {
            if (disposed || !Number.isFinite(column)) return;
            cancel();
            const start = options.read();
            const target = clamp(column * options.stride());
            options.onTarget(target / options.stride());
            if (options.reducedMotion()) {
                options.write(target);
                return;
            }
            const started = options.now();
            function tick(time: number) {
                frame = 0;
                if (disposed) return;
                const progress = Math.min(
                    1,
                    Math.max(0, (time - started) / 240)
                );
                options.write(
                    clamp(
                        start +
                            (target - start) * (1 - Math.pow(1 - progress, 3))
                    )
                );
                if (progress < 1) frame = options.requestFrame(tick);
            }
            frame = options.requestFrame(tick);
        },
        cancel,
        dispose() {
            cancel();
            disposed = true;
        },
    };
}
