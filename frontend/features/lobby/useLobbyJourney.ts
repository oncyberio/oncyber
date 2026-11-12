import { warmDestination } from "./destinationWarmup";
import { createHostedExperienceLocation } from "@utils/experienceLocation";
import {
    getLobbyPortalPreview,
    type LobbyPortalView,
} from "./lobbyPortalPreview";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    finishLobbyReturn,
    revealLobbyReturn,
    type LobbyReturnTransition,
} from "@utils/lobbyReturnTransition";
import {
    destinationFrameUrl,
    canOpenDestinationNormally,
    isLobbyDestinationMessage,
    lobbyHostMessage,
    readLobbyTravelView,
    type LobbyTravelView,
    type LobbyDestination,
    type LobbyJourneyError,
} from "./lobbyJourneyProtocol";
import {
    initialLobbyJourney,
    isLobbyReturnDrawn,
    lobbyJourneyTransition,
    LOBBY_JOURNEY_TIMEOUT_ERRORS,
    LOBBY_JOURNEY_TIMEOUT_MS,
    type LobbyJourneyEvent,
    type LobbyJourneySnapshot,
} from "./lobbyJourneyMachine";

export type {
    LobbyDestination,
    LobbyJourneyError,
} from "./lobbyJourneyProtocol";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_CHARGE_LEAD_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_DEPARTURE_MS,
    WORLD_DISSOLVE_MS,
    WORLD_BLACK_HOLD_MS,
} from "./worldTravelTiming";
import { WORLD_TILE_REVEAL_MS } from "./worldTileMotion";
import { startLoadTimeline, type LoadTimeline } from "@utils/loadTimings";
import {
    enginePrefetchStatus,
    type EnginePrefetchStatus,
} from "./enginePrefetch";
import { startVisibleTimeout } from "./visibleTimeout";
import { lobbyErrorMessage } from "./lobbyErrors";
export const LOBBY_ISOLATE_MS = TRAVEL_ISOLATE_MS;
export const LOBBY_CHARGE_MS = TRAVEL_ISOLATE_MS + TRAVEL_CHARGE_LEAD_MS;
export const LOBBY_REVEAL_MS = WORLD_TILE_REVEAL_MS;
/**
 * When a solo animated trip mounts its hidden destination frame, measured
 * from selection: once the departure has finished. Booting the page costs the
 * lobby's main thread (scripts, a second engine and GPU device). Mounting it
 * at blackout (`TRAVEL_BLACK_AT_MS`) was measured on 10 November 2026 to add
 * long frames to the attack and crouch-down that still play against black
 * (docs/in-app-space-navigation.md, "Loading from selection").
 */
export const LOBBY_FRAME_MOUNT_MS = TRAVEL_DEPARTURE_MS;
const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** The frame stays the same document when entered. `ready` means prepared;
 * destination admission is rechecked during explicit entry, before `entered`.
 * The caller keeps the lobby visible and connected until that acknowledgement.
 *
 * Every state change goes through `lobbyJourneyTransition`; this hook owns the
 * frame, the timers, the messages and the return cover around it.
 */
export function useLobbyJourney(initialReturn?: LobbyReturnTransition | null) {
    const localReturn = useRef(initialReturn);
    const [snapshot, setSnapshot] = useState<LobbyJourneySnapshot>(() =>
        initialLobbyJourney(initialReturn)
    );
    const current = useRef(snapshot);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const pendingDestination = useRef<{
        attempt: string;
        url: string;
        startedAt: number;
    } | null>(null);
    const travelView = useRef<LobbyTravelView | null>(null);
    /** The current attempt's load timeline. */
    const trip = useRef<{
        attempt: string;
        load: LoadTimeline;
        held: boolean;
        /** Whether the engine was prefetched before the selection. */
        engine: EnginePrefetchStatus;
    } | null>(null);
    const entryRequested = useRef<string | null>(null);
    const revealRequested = useRef<string | null>(null);
    const stageRequested = useRef<string | null>(null);
    const hostedLocation = useRef(createHostedExperienceLocation());
    const setTravelView = useCallback((view: LobbyTravelView) => {
        travelView.current = readLobbyTravelView(view);
    }, []);
    const commit = useCallback((next: LobbyJourneySnapshot) => {
        current.current = next;
        setSnapshot(next);
    }, []);
    /** Apply one event to the journey; false when it did not apply. */
    const send = useCallback(
        (event: LobbyJourneyEvent) => {
            const next = lobbyJourneyTransition(current.current, event);
            if (next === current.current) return false;
            // A failed journey has no destination left to mount.
            if (next.phase === "error") pendingDestination.current = null;
            commit(next);
            return true;
        },
        [commit]
    );
    const fail = useCallback(
        (error: LobbyJourneyError) => {
            send({ type: "fail", error });
        },
        [send]
    );
    /** End the current trip's timeline, or abandon it. */
    const closeTrip = useCallback(
        (stage?: string, details?: Record<string, unknown>) => {
            const active = trip.current;
            if (!active) return;
            trip.current = null;
            if (stage) active.load.end(stage, details);
            else active.load.cancel();
        },
        []
    );
    const cancel = useCallback(() => {
        hostedLocation.current.restore();
        if (localReturn.current) {
            finishLobbyReturn(localReturn.current);
            localReturn.current = null;
        }
        pendingDestination.current = null;
        travelView.current = null;
        const active = current.current;
        frameRef.current?.contentWindow?.postMessage(
            lobbyHostMessage(active.attempt, { type: "dispose" }),
            window.location.origin
        );
        send({ type: "cancel" });
    }, [send]);
    const prepareDestination = useCallback(
        (
            selected: LobbyDestination,
            leaveImmediately: boolean,
            instant = false
        ) => {
            pendingDestination.current = null;
            travelView.current = null;
            // A replaced trip records nothing.
            closeTrip();
            try {
                const attempt = window.crypto.randomUUID();
                const frameUrl = destinationFrameUrl(
                    selected.href,
                    window.location.origin,
                    attempt
                );
                // Downloads run off the main thread, so they start now even
                // though the frame itself waits for the avatar to be seated.
                warmDestination(selected.href);
                const startedAt = performance.now();
                const next = lobbyJourneyTransition(current.current, {
                    type: "prepare",
                    selected,
                    attempt,
                    frameUrl,
                    startedAt,
                    // `instant`: entered through the portal, so skip the crouch
                    // and the destination's reveal like reduced motion does.
                    reducedMotion: instant || prefersReducedMotion(),
                    leaveImmediately,
                });
                // The machine holds the frame back while the avatar departs.
                const held = !next.frameUrl;
                if (held)
                    pendingDestination.current = {
                        attempt,
                        url: frameUrl,
                        startedAt,
                    };
                const load = startLoadTimeline("lobby-trip");
                load.mark("selection");
                trip.current = {
                    attempt,
                    load,
                    held,
                    engine: enginePrefetchStatus(),
                };
                commit(next);
                return true;
            } catch (error) {
                send({
                    type: "unsupported",
                    selected,
                    error: {
                        code: "unsupported",
                        message: lobbyErrorMessage(
                            error,
                            "This world needs to open in its own page."
                        ),
                        canOpenNormally: canOpenDestinationNormally(
                            selected.href,
                            window.location.origin
                        ),
                    },
                });
                return false;
            }
        },
        [commit, send, closeTrip]
    );
    // Stages of the current trip's load timeline, from its committed state.
    useEffect(() => {
        const active = trip.current;
        if (!active) return;
        if (snapshot.phase === "error") {
            closeTrip("failed", {
                outcome: "failed",
                code: snapshot.error?.code,
                held: active.held,
                enginePrefetch: active.engine,
            });
            return;
        }
        if (snapshot.attempt !== active.attempt) {
            closeTrip();
            return;
        }
        if (snapshot.frameUrl) active.load.mark("frame-mounted");
        if (snapshot.phase !== "loading") active.load.mark("prepared");
        if (snapshot.admitted) active.load.mark("entered");
        if (snapshot.phase === "entered")
            closeTrip("revealed", {
                outcome: "entered",
                held: active.held,
                enginePrefetch: active.engine,
            });
    }, [
        snapshot.phase,
        snapshot.attempt,
        snapshot.frameUrl,
        snapshot.admitted,
        snapshot.error,
        closeTrip,
    ]);
    useEffect(() => () => closeTrip(), [closeTrip]);
    useEffect(() => {
        const pending = pendingDestination.current;
        if (
            !pending ||
            pending.attempt !== snapshot.attempt ||
            snapshot.frameUrl
        )
            return;
        // No document prefetch while the avatar jumps: world pages are
        // rendered per request and sent `Cache-Control: no-store` (Next's
        // default for getServerSideProps), so the browser could not keep a
        // prefetched copy and the frame would cost the server a second render.
        // The engine's scripts are prefetched at lobby idle instead
        // (enginePrefetch.ts).
        let frame = 0;
        const stillPending = () =>
            pendingDestination.current === pending &&
            current.current.attempt === pending.attempt &&
            current.current.phase === "loading" &&
            !current.current.frameUrl;
        const timer = window.setTimeout(() => {
            if (!stillPending()) return;
            // Booting the page stalls the main thread, which the jump must never
            // show. Mount it once the avatar is seated, after two paints.
            frame = window.requestAnimationFrame(() => {
                if (!stillPending()) return;
                frame = window.requestAnimationFrame(() => {
                    if (!stillPending()) return;
                    pendingDestination.current = null;
                    // The choreography may have advanced while this fence waited.
                    // Preserve that live state and the original attempt/start time.
                    send({
                        type: "frame-mounted",
                        attempt: pending.attempt,
                        url: pending.url,
                    });
                });
            });
        }, Math.max(0, pending.startedAt + LOBBY_FRAME_MOUNT_MS - performance.now()));
        return () => {
            window.clearTimeout(timer);
            window.cancelAnimationFrame(frame);
            // Retain pending intent across an effect replay. Cancel, failure,
            // replacement and the successful mount own its invalidation.
        };
    }, [snapshot.attempt, snapshot.frameUrl, send]);

    // Group travel still prepares ahead of its server-coordinated departure.
    const select = useCallback(
        (selected: LobbyDestination) => prepareDestination(selected, false),
        [prepareDestination]
    );
    const go = useCallback(
        (selected: LobbyDestination, options?: { instant?: boolean }) => {
            if (current.current.travel) return false;
            return prepareDestination(selected, true, !!options?.instant);
        },
        [prepareDestination]
    );
    const enter = useCallback(
        (options?: { instant?: boolean }) => {
            if (
                current.current.phase !== "ready" ||
                !frameRef.current?.contentWindow
            )
                return false;
            // Update the synchronous guard before posting, including repeated keydowns.
            // `instant`: walking through a portal into an already loaded room.
            return send({
                type: "enter",
                startedAt: performance.now(),
                reducedMotion: !!options?.instant || prefersReducedMotion(),
            });
        },
        [send]
    );

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            const active = current.current;
            if (
                !isLobbyDestinationMessage(
                    event,
                    frameRef.current?.contentWindow,
                    window.location.origin,
                    active.attempt
                )
            )
                return;
            const data = event.data;
            // The entered world mirrors its address (space and coordinates).
            if (data.type === "location") {
                if (active.phase === "entered")
                    hostedLocation.current.update(data.href);
                return;
            }
            if (
                data.type === "revealed" &&
                active.phase === "revealing" &&
                active.admitted &&
                revealRequested.current === active.attempt
            )
                hostedLocation.current.update(data.href);
            send({
                type: "message",
                message: event.data,
                requested: {
                    entry: entryRequested.current === active.attempt,
                    stage: stageRequested.current === active.attempt,
                    reveal: revealRequested.current === active.attempt,
                },
                now: performance.now(),
                reducedMotion: prefersReducedMotion(),
            });
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [send]);

    useEffect(() => {
        if (snapshot.phase !== "entering" || !snapshot.travel) return;
        const { attempt, travel } = snapshot;
        if (entryRequested.current === attempt) return;
        let frame = 0;
        const delay = travel.reducedMotion
            ? 0
            : Math.max(
                  0,
                  (travel.dissolveStartedAt ??
                      travel.startedAt + TRAVEL_DISSOLVE_AT_MS) +
                      WORLD_DISSOLVE_MS +
                      WORLD_BLACK_HOLD_MS -
                      performance.now()
              );
        const timer = window.setTimeout(() => {
            // The first callback lets the lobby draw its black frame; the
            // second starts native work only after that frame could be painted.
            // The attack and crouch keep playing while native preparation runs.
            frame = window.requestAnimationFrame(() => {
                frame = window.requestAnimationFrame(() => {
                    const active = current.current;
                    if (
                        active.attempt !== attempt ||
                        active.phase !== "entering" ||
                        entryRequested.current === attempt
                    )
                        return;
                    const destination = frameRef.current?.contentWindow;
                    if (!destination) return;
                    entryRequested.current = attempt;
                    destination.postMessage(
                        lobbyHostMessage(attempt, {
                            type: "enter",
                            awaitReveal: true,
                            reducedMotion: travel.reducedMotion,
                            travelView: travelView.current ?? undefined,
                        }),
                        window.location.origin
                    );
                });
            });
        }, delay);
        return () => {
            window.clearTimeout(timer);
            window.cancelAnimationFrame(frame);
        };
    }, [snapshot.phase, snapshot.attempt, snapshot.travel?.startedAt]);

    // Loading overlaps the outgoing animation. Only an admitted, staged
    // destination can become visible after the full attack and crouch have played.
    useEffect(() => {
        if (
            (snapshot.phase !== "entering" && snapshot.phase !== "loading") ||
            !snapshot.travel ||
            snapshot.stagingReveal
        )
            return;
        const { attempt, travel, admitted, phase } = snapshot;
        const elapsed = performance.now() - travel.startedAt;
        const delay = travel.reducedMotion
            ? 0
            : Math.max(
                  0,
                  (travel.phase === "isolate"
                      ? LOBBY_ISOLATE_MS
                      : TRAVEL_DEPARTURE_MS) - elapsed
              );
        if (!admitted && travel.phase === "charge") return;
        let stageFrame = 0;
        const timer = window.setTimeout(() => {
            const active = current.current;
            if (active.attempt !== attempt || active.phase !== phase) return;
            if (
                active.admitted &&
                (travel.phase === "charge" || travel.reducedMotion)
            ) {
                // Let the lobby renderer publish its final pose first, including
                // reduced-motion entry that finishes before the next paint.
                stageFrame = window.requestAnimationFrame(() => {
                    const ready = current.current;
                    if (
                        ready.attempt !== attempt ||
                        ready.phase !== "entering" ||
                        !ready.admitted ||
                        stageRequested.current === attempt
                    )
                        return;
                    const destination = frameRef.current?.contentWindow;
                    if (!destination) return;
                    stageRequested.current = attempt;
                    send({ type: "stage-requested" });
                    destination.postMessage(
                        lobbyHostMessage(attempt, {
                            type: "stage-reveal",
                            reducedMotion: ready.travel.reducedMotion,
                            travelView: travelView.current ?? undefined,
                        }),
                        window.location.origin
                    );
                });
            } else {
                send({ type: "charge" });
            }
        }, delay);
        return () => {
            window.clearTimeout(timer);
            window.cancelAnimationFrame(stageFrame);
        };
    }, [
        snapshot.attempt,
        snapshot.phase,
        snapshot.travel,
        snapshot.admitted,
        snapshot.stagingReveal,
        send,
    ]);

    useEffect(() => {
        if (!snapshot.stagingReveal) return;
        const attempt = snapshot.attempt;
        return startVisibleTimeout(() => {
            const active = current.current;
            if (active.attempt !== attempt || !active.stagingReveal) return;
            fail(LOBBY_JOURNEY_TIMEOUT_ERRORS.staging);
        }, LOBBY_JOURNEY_TIMEOUT_MS.staging);
    }, [snapshot.attempt, snapshot.stagingReveal, fail]);

    // This command starts the destination renderer. Only its matching completion
    // acknowledges success; a timer or an old compositor callback cannot do so.
    const finishReveal = useCallback(() => {
        const active = current.current;
        if (
            active.attempt !== snapshot.attempt ||
            active.phase !== "revealing" ||
            !active.admitted ||
            revealRequested.current === active.attempt
        )
            return;
        const destination = frameRef.current?.contentWindow;
        if (!destination) return;
        revealRequested.current = active.attempt;
        destination.postMessage(
            lobbyHostMessage(active.attempt, {
                type: "reveal",
                reducedMotion: active.travel?.reducedMotion === true,
            }),
            window.location.origin
        );
    }, [snapshot.attempt]);
    useEffect(() => {
        if (snapshot.phase !== "revealing") return;
        finishReveal();
        const attempt = snapshot.attempt;
        // A stalled renderer fails back to the lobby; elapsed time never grants
        // input or claims that a native scene has finished drawing its reveal.
        return startVisibleTimeout(() => {
            const active = current.current;
            if (active.attempt !== attempt || active.phase !== "revealing")
                return;
            fail(LOBBY_JOURNEY_TIMEOUT_ERRORS.revealing);
        }, LOBBY_JOURNEY_TIMEOUT_MS.revealing);
    }, [snapshot.phase, snapshot.attempt, finishReveal, fail]);

    useEffect(() => {
        if (
            snapshot.phase !== "loading" &&
            snapshot.phase !== "entering" &&
            !snapshot.portalPreparing
        )
            return;
        const { attempt } = snapshot;
        // A portal's early entry waits like an ordinary one.
        const phase = snapshot.phase === "loading" ? "loading" : "entering";
        // A hidden tab neither paints nor grants loading work, so the
        // watchdogs count visible time only.
        return startVisibleTimeout(() => {
            if (
                current.current.attempt !== attempt ||
                current.current.phase !== snapshot.phase ||
                current.current.portalPreparing !== snapshot.portalPreparing
            )
                return;
            fail(LOBBY_JOURNEY_TIMEOUT_ERRORS[phase]);
        }, LOBBY_JOURNEY_TIMEOUT_MS[phase]);
    }, [snapshot.attempt, snapshot.phase, snapshot.portalPreparing, fail]);

    const markReturnReady = useCallback(
        (startedAt: number) => {
            const next = lobbyJourneyTransition(current.current, {
                type: "return-ready",
                startedAt,
            });
            if (next === current.current) return;
            if (localReturn.current) revealLobbyReturn(localReturn.current);
            commit(next);
        },
        [commit]
    );
    const finishReturn = useCallback(
        (startedAt: number) => {
            if (isLobbyReturnDrawn(current.current, startedAt)) cancel();
        },
        [cancel]
    );
    useEffect(() => {
        if (snapshot.phase !== "returning") return;
        const token = snapshot.travel?.startedAt;
        const timer = window.setTimeout(() => {
            const active = current.current;
            if (
                active.phase === "returning" &&
                active.travel?.startedAt === token
            )
                cancel();
        }, LOBBY_JOURNEY_TIMEOUT_MS.returning);
        return () => window.clearTimeout(timer);
    }, [snapshot.phase, snapshot.travel?.startedAt, cancel]);

    const crossPortal = useCallback(() => {
        const active = current.current;
        const target = frameRef.current?.contentWindow;
        if (!target || !send({ type: "portal-cross" })) return false;
        revealRequested.current = active.attempt;
        target.postMessage(
            lobbyHostMessage(active.attempt, {
                type: "reveal",
                reducedMotion: true,
                portal: true,
            }),
            window.location.origin
        );
        return true;
    }, [send]);

    const renderPortal = useCallback(
        (view: LobbyPortalView): boolean => {
            const active = current.current;
            const target = frameRef.current?.contentWindow;
            if (!target || !active.attempt) return false;
            if (
                active.phase === "ready" &&
                entryRequested.current !== active.attempt
            ) {
                entryRequested.current = active.attempt;
                send({ type: "portal-preparing" });
                target.postMessage(
                    lobbyHostMessage(active.attempt, {
                        type: "enter",
                        awaitReveal: true,
                        reducedMotion: true,
                        portalView: view,
                    }),
                    window.location.origin
                );
            }
            if (!active.admitted) return false;
            try {
                return (
                    getLobbyPortalPreview(target, active.attempt)?.render(
                        view
                    ) === true
                );
            } catch {
                fail({
                    code: "portal-render-failed",
                    message:
                        "The portal could not draw this space. Close it and try again.",
                    canOpenNormally: true,
                });
                return false;
            }
        },
        [send, fail]
    );

    return {
        ...snapshot,
        renderPortal,
        crossPortal,
        state: snapshot.phase,
        frameRef,
        canOpenNormally: snapshot.error?.canOpenNormally === true,
        select,
        go,
        cancel,
        enter,
        finishReveal,
        finishReturn,
        markReturnReady,
        setTravelView,
    };
}
export default useLobbyJourney;
