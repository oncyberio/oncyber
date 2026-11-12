import { publicExperienceHref } from "./experienceLocation";
import {
    LOBBY_ATTEMPT_PARAM,
    LOBBY_DESTINATION_PROTOCOL,
    type LobbyJourneyError,
    type LobbyDestinationEntryOptions,
    type LobbyDestinationMessage,
    type LobbyHostMessage,
    type LobbyTravelView,
    readLobbyTravelView,
} from "@features/lobby/lobbyJourneyProtocol";

import {
    LOBBY_PORTAL_PREVIEW_KEY,
    readLobbyPortalView,
    type LobbyPortalView,
} from "@features/lobby/lobbyPortalPreview";
// Visitors read the trip error in the lobby: raw exception text becomes a sentence.
import { lobbyErrorMessage } from "@features/lobby/lobbyErrors";

type EntryHandler = (options: LobbyDestinationEntryOptions) => Promise<void>;
type RevealHandler = (options: LobbyDestinationEntryOptions) => Promise<void>;
type DepartureHandler = (
    options: LobbyDestinationEntryOptions
) => Promise<LobbyTravelView | void>;
type Bridge = {
    attempt: string;
    origin: string;
    prepared: boolean;
    entered: boolean;
    admitted: boolean;
    entering: boolean;
    failed: boolean;
    enter?: EntryHandler;
    reveal?: RevealHandler;
    prepareReveal?: RevealHandler;
    depart?: DepartureHandler;
    previewPortal?: (view: LobbyPortalView) => void;
    registration?: object;
    departure?: object;
    stagingReveal?: boolean;
    stagedReveal?: boolean;
    revealOptions?: LobbyDestinationEntryOptions;
    revealing?: boolean;
    entryOptions?: LobbyDestinationEntryOptions;
    dispose?: () => void;
    release: Array<() => void>;
    entryWaiters: Set<(error?: Error) => void>;
};
let bridge: Bridge | null = null;
const heldListeners = new WeakSet<object>();
const inputEvents = [
    "keydown",
    "keyup",
    "pointerdown",
    "pointerup",
    "pointermove",
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "touchstart",
    "touchend",
    "wheel",
];

/** Only our same-origin parent and a per-navigation nonce enable this protocol.
 * Merely visiting a URL with the query string is not a preparation session.
 */
export function initializeLobbyDestinationBridge(): Bridge | null {
    if (bridge) return bridge;
    if (typeof window === "undefined" || window.parent === window) return null;
    const attempt = new URLSearchParams(window.location.search).get(
        LOBBY_ATTEMPT_PARAM
    );
    if (!attempt || !/^[a-z0-9-]{20,80}$/i.test(attempt)) return null;
    try {
        if (window.parent.location.origin !== window.location.origin)
            return null;
    } catch {
        return null;
    }
    bridge = {
        attempt,
        origin: window.location.origin,
        prepared: false,
        entered: false,
        admitted: false,
        entering: false,
        failed: false,
        release: [],
        entryWaiters: new Set(),
    };
    const session = bridge;
    const wasInert = !!document.documentElement.inert;
    document.documentElement.inert = true;
    const blockInput = (event: Event) => {
        if (session.entered) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    inputEvents.forEach((name) =>
        window.addEventListener(name, blockInput, {
            capture: true,
            passive: false,
        })
    );
    session.release.push(() => {
        document.documentElement.inert = wasInert;
        inputEvents.forEach((name) =>
            window.removeEventListener(name, blockInput, true)
        );
    });

    // Legacy native audio/video media can prepare their buffers while silent.
    // Three's shared listener is held separately by Scene3D before space loading.
    const muted = new Map<HTMLMediaElement, boolean>();
    const hold = (media: HTMLMediaElement) => {
        if (!muted.has(media)) muted.set(media, media.muted);
        media.muted = true;
    };
    const originalPlay = HTMLMediaElement.prototype.play;
    const heldPlay = function (this: HTMLMediaElement) {
        if (!session.entered) hold(this);
        return originalPlay.call(this);
    };
    HTMLMediaElement.prototype.play = heldPlay;
    const onPlay = (event: Event) => {
        if (!session.entered && event.target instanceof HTMLMediaElement)
            hold(event.target);
    };
    document.addEventListener("play", onPlay, true);
    session.release.push(() => {
        if (HTMLMediaElement.prototype.play === heldPlay)
            HTMLMediaElement.prototype.play = originalPlay;
        document.removeEventListener("play", onPlay, true);
        muted.forEach((value, media) => {
            media.muted = value;
        });
        muted.clear();
    });
    window.addEventListener("message", async (event) => {
        if (
            event.source !== window.parent ||
            event.origin !== session.origin ||
            event.data?.protocol !== LOBBY_DESTINATION_PROTOCOL ||
            event.data.attempt !== session.attempt
        )
            return;
        const command: LobbyHostMessage = event.data;
        if (command.type === "dispose") {
            if (session.failed) return;
            session.failed = true;
            settleEntryWaiters(session, entryCancelled());
            session.dispose?.();
            return;
        }
        if (
            command.type === "stage-reveal" &&
            session.admitted &&
            !session.failed &&
            !session.entered &&
            !session.stagingReveal &&
            !session.stagedReveal
        ) {
            session.stagingReveal = true;
            const prepare = session.prepareReveal,
                enter = session.enter;
            const view = readLobbyTravelView(command.travelView);
            session.revealOptions = {
                ...session.entryOptions,
                reducedMotion:
                    session.entryOptions?.reducedMotion === true ||
                    command.reducedMotion === true,
                ...(view ? { travelView: view } : {}),
            };
            try {
                await prepare?.(session.revealOptions);
                if (
                    session.failed ||
                    session.prepareReveal !== prepare ||
                    session.enter !== enter
                )
                    return;
                session.stagedReveal = true;
                send("reveal-ready");
            } catch (error) {
                if (
                    session.failed ||
                    session.prepareReveal !== prepare ||
                    session.enter !== enter
                )
                    return;
                session.dispose?.();
                failLobbyDestination(
                    lobbyErrorMessage(
                        error,
                        "The world could not prepare its entrance."
                    ),
                    "reveal-preparation-failed"
                );
            }
            return;
        }
        if (
            command.type === "reveal" &&
            session.admitted &&
            !session.failed &&
            !session.entered &&
            !session.revealing &&
            (!session.prepareReveal ||
                session.stagedReveal ||
                (event.data.portal === true &&
                    !!session.entryOptions?.portalView))
        ) {
            session.revealing = true;
            const reveal = session.reveal;
            const enter = session.enter;
            try {
                await reveal?.({
                    ...(session.revealOptions || session.entryOptions),
                    reducedMotion:
                        session.revealOptions?.reducedMotion === true ||
                        session.entryOptions?.reducedMotion === true ||
                        command.reducedMotion === true,
                });
                if (
                    session.failed ||
                    session.reveal !== reveal ||
                    session.enter !== enter
                )
                    return;
                session.entered = true;
                session.release.splice(0).forEach((release) => release());
                send("revealed", { href: currentExperienceHref() });
                settleEntryWaiters(session);
            } catch (error) {
                if (
                    session.failed ||
                    session.reveal !== reveal ||
                    session.enter !== enter
                )
                    return;
                session.dispose?.();
                failLobbyDestination(
                    lobbyErrorMessage(
                        error,
                        "The world could not finish its entrance."
                    ),
                    "reveal-failed"
                );
            }
            return;
        }
        if (
            command.type !== "enter" ||
            !session.prepared ||
            !session.enter ||
            session.entering ||
            session.entered ||
            session.failed
        )
            return;
        session.entering = true;
        const enter = session.enter;
        const view = readLobbyTravelView(command.travelView);
        const portalView = readLobbyPortalView(command.portalView);
        session.entryOptions = {
            ...(portalView ? { portalView } : {}),
            reducedMotion: command.reducedMotion === true,
            ...(view ? { travelView: view } : {}),
        };
        try {
            await enter(session.entryOptions);
            if (session.failed || session.enter !== enter) return;
            session.admitted = true;
            // New lobby parents hold input and media until the destination renderer completes.
            // Older parents retain their immediate-entry contract.
            if (command.awaitReveal !== true) {
                session.entered = true;
                session.release.splice(0).forEach((release) => release());
                settleEntryWaiters(session);
            }
            send("entered");
        } catch (error) {
            if (session.failed || session.enter !== enter) return;
            session.dispose?.();
            failLobbyDestination(
                lobbyErrorMessage(error, "The world could not confirm entry."),
                "admission-failed"
            );
        }
    });
    return session;
}

function send(
    type: LobbyDestinationMessage["type"],
    values: Record<string, unknown> = {}
) {
    const session = initializeLobbyDestinationBridge();
    if (!session) return;
    window.parent.postMessage(
        {
            protocol: LOBBY_DESTINATION_PROTOCOL,
            attempt: session.attempt,
            type,
            ...values,
        },
        session.origin
    );
}
function currentExperienceHref() {
    return publicExperienceHref(
        window.location.pathname +
            window.location.search +
            window.location.hash,
        window.location.origin
    );
}
export function publishLobbyDestinationLocation() {
    if (bridge?.entered && !bridge.failed)
        send("location", { href: currentExperienceHref() });
}
export function isLobbyDestination() {
    return !!initializeLobbyDestinationBridge();
}
export function isLobbyDestinationEntering() {
    return !!bridge?.entering && !bridge?.entered && !bridge?.failed;
}
export function isLobbyDestinationPreparing() {
    const session = initializeLobbyDestinationBridge();
    return !!session && !session.entered;
}
function entryCancelled() {
    const error = new Error("Lobby entry was cancelled");
    error.name = "AbortError";
    return error;
}
function settleEntryWaiters(session: Bridge, error?: Error) {
    for (const settle of session.entryWaiters) settle(error);
}
/** Delay nonessential remote work until the destination actually becomes visible.
 * This does not admit a visitor or initiate entry. A failed/cancelled entry rejects
 * every waiter; an individual abort only cancels that consumer.
 */
export function waitForLobbyDestinationEntry(
    signal?: AbortSignal
): Promise<void> {
    const session = initializeLobbyDestinationBridge();
    if (signal?.aborted || session?.failed)
        return Promise.reject(entryCancelled());
    if (!session || session.entered) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const onAbort = () => settle(entryCancelled());
        const settle = (error?: Error) => {
            session.entryWaiters.delete(settle);
            signal?.removeEventListener("abort", onAbort);
            if (error) reject(error);
            else resolve();
        };
        session.entryWaiters.add(settle);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
export function lobbyDestinationProgress(progress: number) {
    if (isLobbyDestinationPreparing()) send("progress", { progress });
}
export function failLobbyDestination(
    message: string,
    code = "load-failed",
    canOpenNormally = true
) {
    const session = initializeLobbyDestinationBridge();
    if (!session || session.entered || session.failed) return;
    session.failed = true;
    settleEntryWaiters(session, entryCancelled());
    const error: LobbyJourneyError = { code, message, canOpenNormally };
    send("error", { error });
}
export function holdLobbyDestinationAudio(listener: {
    getMasterVolume(): number;
    setMasterVolume(value: number): void;
}) {
    const session = initializeLobbyDestinationBridge();
    if (!session || session.entered || heldListeners.has(listener)) return;
    heldListeners.add(listener);
    const volume = listener.getMasterVolume();
    listener.setMasterVolume(0);
    session.release.push(() => listener.setMasterVolume(volume));
}
export function registerLobbyDestinationEntry(
    enter: EntryHandler,
    dispose: () => void,
    options: {
        reveal?: RevealHandler;
        prepareReveal?: RevealHandler;
        depart?: DepartureHandler;
        previewPortal?: (view: LobbyPortalView) => void;
    } = {}
) {
    const session = initializeLobbyDestinationBridge();
    if (!session) return () => {};
    const registration = {};
    session.registration = registration;
    session.departure = undefined;
    session.enter = enter;
    session.dispose = dispose;
    session.reveal = options.reveal;
    session.prepareReveal = options.prepareReveal;
    session.depart = options.depart;
    session.previewPortal = options.previewPortal;
    const preview = {
        attempt: session.attempt,
        render(value: LobbyPortalView) {
            const view = readLobbyPortalView(value);
            if (
                !view ||
                session.failed ||
                !session.admitted ||
                session.registration !== registration ||
                !session.entryOptions?.portalView ||
                !session.previewPortal
            )
                return false;
            // The parent may paint one final frame after the entered message.
            // Keep its aperture transparent; never flash the loading capture.
            if (session.entered || session.revealing) return true;
            // Stage/reveal must use the crossing pose, not the pose captured
            // when Enter first opened the portal several seconds earlier.
            session.entryOptions = {
                ...session.entryOptions,
                portalView: view,
            };
            if (session.revealOptions)
                session.revealOptions = {
                    ...session.revealOptions,
                    portalView: view,
                };
            session.previewPortal(view);
            return true;
        },
    };
    window[LOBBY_PORTAL_PREVIEW_KEY] = preview;
    if (session.prepared && !session.failed)
        send("prepared", { reveal: session.reveal ? "native" : "immediate" });
    return () => {
        if (session.registration === registration) {
            settleEntryWaiters(session, entryCancelled());
            session.registration = undefined;
            session.departure = undefined;
            session.depart = undefined;
            session.previewPortal = undefined;
            if (window[LOBBY_PORTAL_PREVIEW_KEY] === preview)
                delete window[LOBBY_PORTAL_PREVIEW_KEY];
            session.enter = undefined;
            session.dispose = undefined;
            session.reveal = undefined;
            session.prepareReveal = undefined;
        }
    };
}
/** Call only after destination assets, scene initialization and a rendered frame. */
export function lobbyDestinationPrepared() {
    const session = initializeLobbyDestinationBridge();
    if (!session || session.failed || session.entered) return;
    session.prepared = true;
    if (session.enter)
        send("prepared", { reveal: session.reveal ? "native" : "immediate" });
}

initializeLobbyDestinationBridge();

/** The back arrow returns only after this renderer has finished departing.
 * Keep the session entered: a departure must not restart preparation hooks. */
export function requestLobbyDestinationBack(): boolean {
    const session = bridge;
    if (!session?.entered || session.failed || typeof window === "undefined")
        return false;
    if (session.departure) return true;
    const departure = {};
    session.departure = departure;
    const registration = session.registration,
        depart = session.depart,
        dispose = session.dispose;
    const current = () =>
        bridge === session &&
        !session.failed &&
        session.entered &&
        session.registration === registration &&
        session.departure === departure;
    const finish = (travelView?: LobbyTravelView) => {
        if (!current()) return;
        try {
            window.parent.postMessage(
                {
                    protocol: LOBBY_DESTINATION_PROTOCOL,
                    attempt: session.attempt,
                    type: "back",
                    ...(travelView ? { travelView } : {}),
                },
                session.origin
            );
        } catch {
            // A disappearing parent cannot leave an unhandled animation promise.
            // Release the local guard so another deliberate Back can retry.
            if (current()) session.departure = undefined;
        }
    };
    if (!depart) {
        finish();
        return true;
    }
    let reducedMotion = session.entryOptions?.reducedMotion === true;
    try {
        if (typeof window.matchMedia === "function")
            reducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;
    } catch {
        // Older embedded browsers may not expose a usable media query API.
    }
    void (async () => {
        let travelView: LobbyTravelView | undefined;
        try {
            travelView =
                readLobbyTravelView(await depart({ reducedMotion })) ??
                undefined;
        } catch {
            if (!current()) return;
            // Restore the failed renderer before falling back to a plain return.
            // Cleanup failures must not trap the visitor in a half-dissolved space.
            try {
                dispose?.();
            } catch {}
        }
        finish(travelView);
    })();
    return true;
}
