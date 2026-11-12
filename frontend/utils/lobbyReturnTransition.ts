import {
    readLobbyTravelView,
    type LobbyTravelView,
} from "@features/lobby/lobbyJourneyProtocol";

/** Local presentation state only: never persisted or used for admission. */
export interface LobbyReturnTransition {
    startedAt: number;
    reducedMotion: boolean;
    returnView?: LobbyTravelView;
}

let pending: LobbyReturnTransition | null = null;
let cover: HTMLDivElement | null = null;

export function pendingLobbyReturn() {
    return pending;
}

export function beginLobbyReturn(view?: LobbyTravelView | void) {
    if (pending) return pending;
    let reducedMotion = false;
    try {
        reducedMotion =
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ===
            true;
    } catch {}
    pending = {
        startedAt: performance.now(),
        reducedMotion,
        returnView: readLobbyTravelView(view) ?? undefined,
    };
    // The outgoing room has dissolved. Protect the route handoff until the
    // lobby renderer has actually drawn its matched camera and idle pose.
    cover = document.createElement("div");
    cover.dataset.lobbyReturn = "";
    cover.setAttribute("role", "status");
    cover.setAttribute("aria-label", "Returning to lobby");
    Object.assign(cover.style, {
        position: "fixed",
        inset: "0",
        background: "#000",
        zIndex: "2147483000",
    });
    document.body.appendChild(cover);
    return pending;
}

export function revealLobbyReturn(transition: LobbyReturnTransition) {
    if (pending !== transition) return;
    cover?.remove();
    cover = null;
}

export function finishLobbyReturn(transition: LobbyReturnTransition) {
    if (pending !== transition) return;
    revealLobbyReturn(transition);
    pending = null;
}
