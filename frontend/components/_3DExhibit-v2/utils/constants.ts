import { ruumfordsSpaces } from "@utils/partnerships/ruumfords/constants";

export type WorldState =
    | { type: "LOADING_START" }
    | { type: "LOADING_END" }
    | { type: "INTRO" }
    | { type: "SPACE_IDLE" }
    | { type: "SPACE_PLAYING" }
    | {
          type: "ERROR";
          /** The plain sentence shown to the visitor. */
          error: string;
          kind?: WorldErrorKind;
          title?: string;
          /** The technical text behind "Show details". */
          details?: WorldErrorDetails;
      };

/**
 * Why a space failed to load; the error screen picks its copy from this.
 * `utils/worldLoadError.ts` chooses the kind for a thrown error.
 */
export type WorldErrorKind =
    | "destination-unavailable"
    | "connection"
    | "world-model"
    | "avatar"
    | "graphics"
    | "memory"
    | "load-failed";

/** A short title and one sentence per kind: what happened, what to do. */
export const WORLD_ERROR_COPY: Record<
    WorldErrorKind,
    { title: string; message: string }
> = {
    "destination-unavailable": {
        title: "This world didn’t load",
        message: "Check your connection and try again.",
    },
    connection: {
        title: "The connection dropped",
        message: "Check that you’re online, then try again.",
    },
    "world-model": {
        title: "This world’s 3D model didn’t load",
        message:
            "Try again in a moment, or tell the world’s creator if it keeps happening.",
    },
    avatar: {
        title: "Your avatar didn’t load",
        message: "Try again, or choose a different avatar in your settings.",
    },
    graphics: {
        title: "3D graphics couldn’t start",
        message:
            "Close other tabs that use 3D, then try again or use another browser.",
    },
    memory: {
        title: "This device ran out of memory",
        message: "Close other tabs and apps, then try again.",
    },
    "load-failed": {
        title: "This world didn’t open",
        message: "Try again in a moment.",
    },
};

/** Shown when the destination is missing or could not be reached. */
export const DESTINATION_UNAVAILABLE_ERROR =
    WORLD_ERROR_COPY["destination-unavailable"];

/**
 * What "Show details" reveals and copies, for a visitor to send us. Never a
 * token, a cookie or a user id: the address has no query string.
 */
export type WorldErrorDetails = {
    name: string;
    message: string;
    code?: string;
    /** The loading step that failed, as named in `WorldLoadStage`. */
    step?: string;
    address: string;
    time: string;
    browser: string;
    graphics?: string;
};

export const LoadingStartState: WorldState = { type: "LOADING_START" };

export const SpaceIdleState: WorldState = { type: "SPACE_IDLE" };

export const SpacePlayingState: WorldState = { type: "SPACE_PLAYING" };

export const LoadingEndState: WorldState = { type: "LOADING_END" };

export const IntroState: WorldState = { type: "INTRO" };

export const ErrorState = (
    error: string,
    extra: {
        kind?: WorldErrorKind;
        title?: string;
        details?: WorldErrorDetails;
    } = {}
): WorldState => ({
    type: "ERROR",
    error,
    ...extra,
});

export const soloDefaultSpaces = [
    "macysthanksgivingdayvirtualparade",
    ...ruumfordsSpaces,
];
