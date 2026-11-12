/** Resize after layout settles, including pane changes without a window event. */
export function observeSceneSize(
    container: HTMLElement,
    onResize: (size: { w: number; h: number }) => void
) {
    if (!container) return () => {};
    let frame: number = null;
    let previousWidth = 0;
    let previousHeight = 0;
    let disposed = false;
    const measure = () => {
        frame = null;
        if (disposed || !container.isConnected) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w <= 0 || h <= 0) return;
        if (w === previousWidth && h === previousHeight) return;
        previousWidth = w;
        previousHeight = h;
        onResize({ w, h });
    };
    const schedule = () => {
        if (frame == null && !disposed) frame = requestAnimationFrame(measure);
    };
    const observer =
        typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(schedule);
    observer?.observe(container);
    window.addEventListener("resize", schedule);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    document.addEventListener("fullscreenchange", schedule);
    schedule();
    return () => {
        disposed = true;
        observer?.disconnect();
        if (frame != null) cancelAnimationFrame(frame);
        window.removeEventListener("resize", schedule);
        viewport?.removeEventListener("resize", schedule);
        document.removeEventListener("fullscreenchange", schedule);
    };
}
