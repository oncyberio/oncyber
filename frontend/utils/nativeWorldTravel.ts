import { holdArtworkPresentation } from "./artworkPresentation";
import type { LobbyTravelView } from "@features/lobby/lobbyJourneyProtocol";
export const WORLD_TRAVEL_READY = "oncyber:world-travel-ready";
type Travel = {
    view?: LobbyTravelView;
    ready: boolean;
    claimed: boolean;
    finish(): void;
};
// A GPU drawing buffer may be cleared after presentation. Capture synchronously
// with the final render, before routing tears down the source canvas.
const departureFrames = new WeakMap<LobbyTravelView, HTMLCanvasElement>();
export function captureWorldTravelFrame(
    view: LobbyTravelView,
    source: HTMLCanvasElement,
    render: () => void
) {
    if (!view || !source) return;
    const frame = document.createElement("canvas");
    frame.width = source.width;
    frame.height = source.height;
    const context = frame.getContext("2d");
    if (!context) return;
    render();
    context.drawImage(source, 0, 0);
    departureFrames.set(view, frame);
}
let active: Travel | undefined;
export const pendingWorldTravel = () => active;
export function finishWorldTravel(travel = active) {
    travel?.finish();
}
export function markWorldTravelReady() {
    if (!active) return;
    active.ready = true;
    window.dispatchEvent(new Event(WORLD_TRAVEL_READY));
}
/** Keep the last presented avatar frame across a Next route replacing its canvas.
 * Reveal it only after the new room has staged and rendered its matching pose. */
export function beginWorldTravel(
    view?: LobbyTravelView | void,
    source?: HTMLCanvasElement
) {
    active?.finish();
    const releaseArtwork = holdArtworkPresentation();
    const overlay = document.createElement("div");
    overlay.dataset.worldTravel = "loading";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-label", "Travelling to space");
    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483100",
        background: "#000",
    });
    const canvas = document.createElement("canvas");
    source = (view && departureFrames.get(view)) || source;
    if (view) departureFrames.delete(view);
    source ||= Array.from(document.querySelectorAll("canvas")).sort(
        (a, b) =>
            b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight
    )[0];
    if (source) {
        canvas.width = source.width;
        canvas.height = source.height;
        Object.assign(canvas.style, {
            width: "100%",
            height: "100%",
            display: "block",
        });
        try {
            canvas.getContext("2d")?.drawImage(source, 0, 0);
            overlay.append(canvas);
        } catch {}
    }
    const label = document.createElement("span");
    label.textContent = "Opening space…";
    Object.assign(label.style, {
        position: "absolute",
        bottom: "32px",
        left: "0",
        right: "0",
        textAlign: "center",
        color: "#c2c2bd",
        font: "12px sans-serif",
    });
    overlay.append(label);
    document.body.append(overlay);
    const pulse = !window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches
        ? label.animate?.(
              [{ opacity: 0.4 }, { opacity: 1 }, { opacity: 0.4 }],
              { duration: 1600, iterations: Infinity }
          )
        : undefined;
    const travel: Travel = {
        view: view || undefined,
        ready: false,
        claimed: false,
        finish() {
            releaseArtwork();
            pulse?.cancel();
            overlay.remove();
            if (active === travel) active = undefined;
        },
    };
    active = travel;
    return travel;
}
/** Real painted frames even outside the lobby's optional loading scheduler. */
export const yieldWorldTravelWork = () =>
    new Promise<void>((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0))
    );
