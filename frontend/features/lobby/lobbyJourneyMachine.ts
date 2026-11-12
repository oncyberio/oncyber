import type { LobbyReturnTransition } from "@utils/lobbyReturnTransition";
import {
    readLobbyTravelView,
    type LobbyDestination,
    type LobbyDestinationMessage,
    type LobbyDestinationPhase,
    type LobbyJourneyError,
    type LobbyRevealMode,
    type LobbyTravelView,
} from "./lobbyJourneyProtocol";
import { TRAVEL_DISSOLVE_AT_MS } from "./worldTravelTiming";

/**
 * The lobby's side of one trip to a destination, as a pure state machine.
 *
 * `useLobbyJourney` owns everything that touches the outside world (the
 * iframe, timers, postMessage, the return cover). Every change to the
 * journey's state goes through `lobbyJourneyTransition`, so the legal moves
 * are listed in this one file and can be tested without React or a clock.
 *
 *   idle ─ prepare ─▶ loading ─ prepared ─▶ ready ─ enter ─▶ entering
 *                        │                                      │
 *                        └── prepared (already travelling) ─────┤
 *                                                               ▼
 *     entering: entered ▶ admitted ─ stage-requested ▶ staging ─ reveal-ready ▶ revealing
 *     revealing ─ revealed ─▶ entered ─ back ─▶ returning ─ (hook cancels) ─▶ idle
 *     any phase but idle/entered ─ error message or fail ─▶ error
 *     any phase ─ cancel ─▶ idle
 */
export interface LobbyJourneyTravel {
    phase: "isolate" | "charge" | "reveal" | "return";
    startedAt: number;
    dissolveStartedAt?: number;
    reducedMotion: boolean;
    returnView?: LobbyTravelView;
}

export interface LobbyJourneySnapshot {
    phase: LobbyDestinationPhase;
    selected: LobbyDestination | null;
    frameUrl: string | null;
    attempt: string | null;
    progress: number;
    error: LobbyJourneyError | null;
    travel: LobbyJourneyTravel | null;
    /** The destination confirmed entry; it is not visible yet. */
    admitted: boolean;
    /** A portal sent `enter` while the lobby stays visible (?travel=portal). */
    portalPreparing: boolean;
    /** The visitor walked through the portal; the destination reveals at once. */
    portalCrossing: boolean;
    revealMode: LobbyRevealMode;
    /** `stage-reveal` was sent and its `reveal-ready` has not arrived. */
    stagingReveal: boolean;
    /** The returning lobby has drawn its first matched frame. */
    returnReady: boolean;
}

export const EMPTY_LOBBY_JOURNEY: LobbyJourneySnapshot = {
    phase: "idle",
    selected: null,
    frameUrl: null,
    attempt: null,
    progress: 0,
    error: null,
    travel: null,
    admitted: false,
    portalPreparing: false,
    portalCrossing: false,
    revealMode: "immediate",
    stagingReveal: false,
    returnReady: false,
};

export function initialLobbyJourney(
    initialReturn?: LobbyReturnTransition | null
): LobbyJourneySnapshot {
    return initialReturn
        ? {
              ...EMPTY_LOBBY_JOURNEY,
              phase: "returning",
              travel: { ...initialReturn, phase: "return" },
          }
        : EMPTY_LOBBY_JOURNEY;
}

export type LobbyJourneyEvent =
    /** A destination was chosen and its frame URL validated. */
    | {
          type: "prepare";
          selected: LobbyDestination;
          attempt: string;
          frameUrl: string;
          startedAt: number;
          reducedMotion: boolean;
          /** Solo travel departs at once; group travel prepares and waits. */
          leaveImmediately: boolean;
      }
    /** The chosen destination cannot be prepared inside the lobby. */
    | {
          type: "unsupported";
          selected: LobbyDestination;
          error: LobbyJourneyError;
      }
    /** The departure animation has seated the avatar; mount the held frame. */
    | { type: "frame-mounted"; attempt: string; url: string }
    | { type: "enter"; startedAt: number; reducedMotion: boolean }
    /** A portal asked a prepared destination to admit the visitor early. */
    | { type: "portal-preparing" }
    /** The visitor walked through the portal into the admitted destination. */
    | { type: "portal-cross" }
    /** The camera isolation finished; hold the charge until admission. */
    | { type: "charge" }
    | { type: "stage-requested" }
    | { type: "return-ready"; startedAt: number }
    | { type: "fail"; error: LobbyJourneyError }
    | { type: "cancel" }
    /** A verified message from the destination frame of the current attempt. */
    | {
          type: "message";
          message: LobbyDestinationMessage;
          /** Which commands the host has already sent for this attempt. */
          requested: { entry: boolean; stage: boolean; reveal: boolean };
          now: number;
          reducedMotion: boolean;
      };

/** How long each waiting phase may last before the journey fails back to the lobby. */
export const LOBBY_JOURNEY_TIMEOUT_MS = {
    loading: 90_000,
    entering: 35_000,
    staging: 15_000,
    revealing: 15_000,
    returning: 10_000,
} as const;

export const LOBBY_JOURNEY_TIMEOUT_ERRORS: Record<
    "loading" | "entering" | "staging" | "revealing",
    LobbyJourneyError
> = {
    loading: {
        code: "timeout",
        canOpenNormally: true,
        message:
            "This world is taking too long to prepare. Try again or open it directly.",
    },
    entering: {
        code: "timeout",
        canOpenNormally: true,
        message:
            "The world could not confirm entry. You're still in the lobby.",
    },
    staging: {
        code: "reveal-preparation-timeout",
        canOpenNormally: true,
        message:
            "The world could not prepare its entrance. You're still in the lobby.",
    },
    revealing: {
        code: "reveal-timeout",
        canOpenNormally: true,
        message:
            "The world could not finish its entrance. You're still in the lobby.",
    },
};

const departure = (
    phase: "isolate" | "charge",
    startedAt: number,
    reducedMotion: boolean
): LobbyJourneyTravel => ({
    phase,
    startedAt,
    reducedMotion,
    dissolveStartedAt: startedAt + (reducedMotion ? 0 : TRAVEL_DISSOLVE_AT_MS),
});

function failed(
    snapshot: LobbyJourneySnapshot,
    error: LobbyJourneyError
): LobbyJourneySnapshot {
    return {
        ...snapshot,
        phase: "error",
        frameUrl: null,
        attempt: null,
        error,
        travel: null,
        admitted: false,
        portalPreparing: false,
        stagingReveal: false,
    };
}

function receive(
    snapshot: LobbyJourneySnapshot,
    event: Extract<LobbyJourneyEvent, { type: "message" }>
): LobbyJourneySnapshot {
    const { message, requested } = event;
    if (message.type === "back" && snapshot.phase === "entered")
        return {
            ...snapshot,
            phase: "returning",
            returnReady: false,
            travel: {
                phase: "return",
                startedAt: event.now,
                returnView:
                    readLobbyTravelView(message.travelView) ?? undefined,
                reducedMotion: event.reducedMotion,
            },
        };
    if (
        message.type === "progress" &&
        snapshot.phase === "loading" &&
        Number.isFinite(message.progress)
    ) {
        const progress = Math.max(
            snapshot.progress,
            Math.min(0.99, Math.max(0, message.progress))
        );
        // Duplicate and regressing loader messages need no React work.
        return progress > snapshot.progress
            ? { ...snapshot, progress }
            : snapshot;
    }
    if (message.type === "prepared" && snapshot.phase === "loading")
        return {
            ...snapshot,
            phase: snapshot.travel ? "entering" : "ready",
            progress: 1,
            revealMode: message.reveal === "native" ? "native" : "immediate",
        };
    if (
        message.type === "entered" &&
        // "ready": a portal requested entry before the visitor crossed it.
        (snapshot.phase === "entering" || snapshot.phase === "ready") &&
        requested.entry
    )
        return { ...snapshot, admitted: true, portalPreparing: false };
    if (
        message.type === "reveal-ready" &&
        snapshot.phase === "entering" &&
        snapshot.admitted &&
        snapshot.stagingReveal &&
        requested.stage
    )
        return {
            ...snapshot,
            phase: "revealing",
            stagingReveal: false,
            travel: { ...snapshot.travel, phase: "reveal" },
        };
    if (
        message.type === "revealed" &&
        snapshot.phase === "revealing" &&
        snapshot.admitted &&
        requested.reveal
    )
        return { ...snapshot, phase: "entered", travel: null };
    if (
        message.type === "error" &&
        snapshot.phase !== "entered" &&
        snapshot.phase !== "idle"
    )
        return failed(snapshot, {
            code:
                typeof message.error?.code === "string"
                    ? message.error.code
                    : "load-failed",
            message:
                typeof message.error?.message === "string"
                    ? message.error.message
                    : "This world could not load. Try another world.",
            canOpenNormally: message.error?.canOpenNormally === true,
        });
    return snapshot;
}

/**
 * The next journey state for an event. Returns the same object when the event
 * does not apply in the current state, so callers can skip a React commit.
 */
export function lobbyJourneyTransition(
    snapshot: LobbyJourneySnapshot,
    event: LobbyJourneyEvent
): LobbyJourneySnapshot {
    switch (event.type) {
        case "prepare": {
            // A navigation boots Next and other page modules before the
            // native engine gate. Keep that work out of camera isolation.
            const holdFrame = event.leaveImmediately && !event.reducedMotion;
            return {
                ...EMPTY_LOBBY_JOURNEY,
                phase: "loading",
                selected: event.selected,
                frameUrl: holdFrame ? null : event.frameUrl,
                attempt: event.attempt,
                travel: event.leaveImmediately
                    ? // Turn toward the avatar, then dim the source while
                      // the hidden destination loads in parallel.
                      departure(
                          event.reducedMotion ? "charge" : "isolate",
                          event.startedAt,
                          event.reducedMotion
                      )
                    : null,
            };
        }
        case "unsupported":
            return {
                ...EMPTY_LOBBY_JOURNEY,
                selected: event.selected,
                phase: "error",
                error: event.error,
            };
        case "frame-mounted":
            return snapshot.attempt === event.attempt &&
                snapshot.phase === "loading" &&
                !snapshot.frameUrl
                ? { ...snapshot, frameUrl: event.url }
                : snapshot;
        case "enter":
            return snapshot.phase === "ready"
                ? {
                      ...snapshot,
                      phase: "entering",
                      // A portal may already have been admitted while ready.
                      admitted: snapshot.admitted,
                      travel: departure(
                          "isolate",
                          event.startedAt,
                          event.reducedMotion
                      ),
                  }
                : snapshot;
        case "portal-preparing":
            return snapshot.phase === "ready" && !snapshot.portalPreparing
                ? { ...snapshot, portalPreparing: true }
                : snapshot;
        case "portal-cross":
            return snapshot.phase === "ready" && snapshot.admitted
                ? {
                      ...snapshot,
                      phase: "revealing",
                      portalCrossing: true,
                      travel: null,
                  }
                : snapshot;
        case "charge":
            return snapshot.travel
                ? {
                      ...snapshot,
                      travel: { ...snapshot.travel, phase: "charge" },
                  }
                : snapshot;
        case "stage-requested":
            return { ...snapshot, stagingReveal: true };
        case "return-ready":
            return snapshot.phase === "returning" &&
                snapshot.travel?.startedAt === event.startedAt &&
                !snapshot.returnReady
                ? { ...snapshot, returnReady: true }
                : snapshot;
        case "fail":
            return failed(snapshot, event.error);
        case "cancel":
            return EMPTY_LOBBY_JOURNEY;
        case "message":
            return receive(snapshot, event);
    }
}

/** True once the return identified by `startedAt` has been drawn and may end. */
export function isLobbyReturnDrawn(
    snapshot: LobbyJourneySnapshot,
    startedAt: number
) {
    return (
        snapshot.phase === "returning" &&
        snapshot.returnReady &&
        snapshot.travel?.startedAt === startedAt
    );
}

/** The handful of yes/no questions the lobby UI asks about a journey. */
export function lobbyJourneyView(
    journey: Pick<LobbyJourneySnapshot, "phase" | "travel" | "returnReady">
) {
    const entered = journey.phase === "entered";
    const returning = journey.phase === "returning";
    const revealing = journey.phase === "revealing";
    return {
        /** The visitor is inside the destination. */
        entered,
        returning,
        revealing,
        /** Returning, and the lobby has not drawn its matched frame yet. */
        preparingReturn: returning && !journey.returnReady,
        /** Any moment between leaving the lobby floor and arriving somewhere. */
        travelling:
            (journey.phase === "loading" && !!journey.travel) ||
            journey.phase === "entering" ||
            revealing ||
            returning,
    };
}
