//
export const SLOW_ADDING_TIMEOUT = 3000;

export const BIG_MEDIA_SIZE = 25 * 1024 * 1024;

export const Errors = {
    UNAUTHORIZED_REPLACE: "UNAUTHORIZED_REPLACE",
    FETCH_ERROR: "FETCH_ERROR",
    MEDIA_NOT_FOUND: "MEDIA_NOT_FOUND",
    MEDIA_UNSUPPORTED: "MEDIA_UNSUPPORTED",
} as const;

export const RealtimeEvents = {
    RT_EDITOR_COMMAND: "RT_EDITOR_COMMAND" as const,
};
