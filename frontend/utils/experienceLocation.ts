import { LOBBY_ATTEMPT_PARAM } from "@features/lobby/lobbyJourneyProtocol";

/** Public, same-origin location: internal iframe admission data is never shared. */
export function publicExperienceHref(value: unknown, origin: string) {
    if (
        typeof value !== "string" ||
        !value.startsWith("/") ||
        value.startsWith("//")
    )
        return null;
    try {
        const url = new URL(value, origin);
        if (url.origin !== origin || url.username || url.password) return null;
        url.searchParams.delete(LOBBY_ATTEMPT_PARAM);
        return url.pathname + url.search + url.hash;
    } catch {
        return null;
    }
}

/** Updating position must not restart Next routing or release a travel lock. */
export function replaceExperienceLocation(href: string) {
    if (
        window.location.pathname +
            window.location.search +
            window.location.hash ===
        href
    )
        return;
    const state = window.history.state;
    window.history.replaceState(
        state?.__N ? { ...state, as: href, url: href } : state,
        "",
        href
    );
}

/** The retained lobby stays mounted while its address represents the visible world. */
export function createHostedExperienceLocation() {
    let lobby: { href: string; state: unknown } | undefined;
    return {
        update(value: unknown) {
            const href = publicExperienceHref(value, window.location.origin);
            if (!href) return;
            lobby ||= {
                href:
                    window.location.pathname +
                    window.location.search +
                    window.location.hash,
                state: window.history.state,
            };
            replaceExperienceLocation(href);
        },
        restore() {
            if (!lobby) return;
            window.history.replaceState(lobby.state, "", lobby.href);
            lobby = undefined;
        },
    };
}
