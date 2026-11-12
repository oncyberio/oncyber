/** A click-owned visual bridge that survives the landing page unmount. */
export type SpaceEntrance = {
    title: string;
    image?: string;
    source?: () => HTMLElement | null;
};
let active: { finish: () => void; cancel: () => void } | null = null;
export function finishSpaceEntrance() {
    active?.finish();
}

export function beginSpaceEntrance(
    anchor: HTMLElement,
    preview: SpaceEntrance,
    onCancel: () => void
) {
    active?.cancel();
    const source = preview.source?.() || anchor;
    const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;
    const duration = reduced ? 0 : 160;
    const overlay = document.createElement("div");
    overlay.dataset.spaceEntrance = "fading";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-label", `Entering ${preview.title}`);
    overlay.tabIndex = -1;
    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483000",
        isolation: "isolate",
        outline: "none",
    });
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
        position: "absolute",
        inset: "0",
        background: "#000",
        opacity: "1",
    });
    overlay.append(backdrop);
    document.body.append(overlay);
    overlay.focus({ preventScroll: true });
    const animations: Animation[] = [];
    const animate = (
        element: HTMLElement,
        frames: Keyframe[],
        options: KeyframeAnimationOptions
    ) => {
        if (element.animate)
            animations.push(
                element.animate(frames, { fill: "forwards", ...options })
            );
    };
    animate(backdrop, [{ opacity: 0 }, { opacity: 1 }], {
        duration,
    });
    let ended = false,
        ready = false,
        black = false,
        frame = 0;
    let finishTimer: ReturnType<typeof setTimeout>;
    let slowTimer: ReturnType<typeof setTimeout>;
    let draw: (() => void) | undefined;
    let tunnel: HTMLCanvasElement | undefined;
    let logo: { remove: () => void } | undefined;
    const paint = () => {
        frame = 0;
        if (ended || document.hidden || reduced || !draw) return;
        draw();
        frame = requestAnimationFrame(paint);
    };
    const visibility = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (!document.hidden) paint();
    };
    const resize = () => {
        if (tunnel) void startTunnel().catch(() => {});
    };
    const tunnelModule = reduced
        ? null
        : import("@components/_3DExhibit-v2/ui/LoaderVideoContainer").catch(
              () => null
          );
    async function startTunnel() {
        const module = await tunnelModule;
        if (!module) return;
        const { drawStarfield } = module;
        if (ended || ready || reduced) return;
        if (!tunnel) {
            tunnel = document.createElement("canvas");
            Object.assign(tunnel.style, {
                position: "absolute",
                inset: "0",
                width: "100%",
                height: "100%",
                opacity: "1",
            });
            overlay.append(tunnel);
            logo = module.startLoadingLogo?.(overlay);
            animate(tunnel, [{ opacity: 0 }, { opacity: 1 }], {
                duration: 160,
            });
        }
        draw = drawStarfield(tunnel, innerWidth, innerHeight);
        if (!frame) paint();
    }
    const remove = () => {
        if (ended) return;
        ended = true;
        clearTimeout(blackTimer);
        clearTimeout(finishTimer);
        clearTimeout(slowTimer);
        cancelAnimationFrame(frame);
        animations.forEach((animation) => animation.cancel());
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("resize", resize);
        window.removeEventListener("popstate", cancel);
        window.removeEventListener("keydown", keydown, true);
        overlay.remove();
        if (active === handle) active = null;
        draw = undefined;
        tunnel = undefined;
        logo?.remove();
        logo = undefined;
    };
    const reveal = () => {
        if (!black || !ready || ended) return;
        overlay.dataset.spaceEntrance = "revealing";
        animate(overlay, [{ opacity: 1 }, { opacity: 0 }], {
            duration: reduced ? 0 : 160,
        });
        finishTimer = setTimeout(remove, reduced ? 0 : 160);
    };
    const cancel = () => {
        remove();
        if (source.isConnected) source.focus({ preventScroll: true });
    };
    const keydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel();
            onCancel();
        } else if (event.key === "Tab") {
            event.preventDefault();
            overlay.focus();
        }
    };
    const handle = {
        finish: () => {
            if (ready) return;
            ready = true;
            reveal();
        },
        cancel,
    };
    active = handle;
    const blackTimer = setTimeout(() => {
        black = true;
        backdrop.style.opacity = "1";
        overlay.dataset.spaceEntrance = "loading";
        reveal();
        if (!ready) void startTunnel().catch(() => {});
    }, duration);
    slowTimer = setTimeout(() => {
        if (ended || ready) return;
        const label = document.createElement("span");
        label.textContent = "Opening world… · Esc to go back";
        Object.assign(label.style, {
            position: "absolute",
            bottom: "32px",
            left: "0",
            right: "0",
            textAlign: "center",
            color: "#c2c2bd",
            font: "12px sans-serif",
            zIndex: "1",
        });
        overlay.append(label);
    }, 5000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("resize", resize);
    window.addEventListener("popstate", cancel);
    window.addEventListener("keydown", keydown, true);
    return handle;
}
