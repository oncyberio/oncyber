/** Keep free-cursor artwork hover working beneath the HTML interaction layer. */
export function bindArtworkHover(overlay: HTMLElement, canvas: HTMLElement) {
    if (!overlay || !canvas) return () => {};
    const move = (event: MouseEvent) => {
        // Embedded HTML owns its input. Only forward the empty scene backdrop,
        // and never synthesize dragging or clicks for the camera controls.
        if (event.target !== overlay || event.buttons) return;
        canvas.dispatchEvent(
            new MouseEvent("mousemove", {
                clientX: event.clientX,
                clientY: event.clientY,
            })
        );
    };
    overlay.addEventListener("mousemove", move);
    return () => overlay.removeEventListener("mousemove", move);
}
