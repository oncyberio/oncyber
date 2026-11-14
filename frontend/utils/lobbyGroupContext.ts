import { initializeLobbyDestinationBridge } from "./lobbyDestinationBridge";

export const LOBBY_GROUP_COHORT_PARAM = "lobbyGroupCohort";
const cohort = (value: unknown): value is string =>
    typeof value === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(value);

/** A matchmaking hint, never an access credential. Host entry gates still apply. */
export function groupDestinationHref(
    href: string,
    travelId: string,
    origin: string
): string {
    if (!cohort(travelId)) throw new Error("Invalid party travel context.");
    const url = new URL(href, origin);
    if (url.origin !== origin)
        throw new Error("Party travel needs a same-origin world.");
    url.searchParams.set(LOBBY_GROUP_COHORT_PARAM, travelId);
    return `${url.pathname}${url.search}${url.hash}`;
}

/** Ordinary top-level visits cannot opt into the prepared-frame cohort hint. */
export function readLobbyGroupCohort(): string | undefined {
    if (!initializeLobbyDestinationBridge()) return;
    // Recording: the party is staged in this browser (?crowd=N), so no room
    // knows its trip. Join the world as an ordinary visitor.
    try {
        if (
            window.parent !== window &&
            Array.isArray((window.parent as any).__oncyberRecordingParty)
        )
            return;
    } catch {
        // A cross-origin parent is never a recording.
    }
    const value = new URLSearchParams(window.location.search).get(
        LOBBY_GROUP_COHORT_PARAM
    );
    return cohort(value) ? value : undefined;
}
