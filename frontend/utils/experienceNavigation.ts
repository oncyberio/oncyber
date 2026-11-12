import { beginWorldTravel, finishWorldTravel } from "./nativeWorldTravel";
import { requestLobbyDestinationBack } from "./lobbyDestinationBridge";
import type {
    LobbyDestinationEntryOptions,
    LobbyTravelView,
} from "@features/lobby/lobbyJourneyProtocol";
import {
    beginLobbyReturn,
    finishLobbyReturn,
    pendingLobbyReturn,
} from "./lobbyReturnTransition";

type Entry = { href: string; key?: string };
const pathOf = (href: string) => href.split(/[?#]/)[0];
/** Tracks actual Next history entries, including browser Back/Forward and replace. */
export function createExperienceHistory() {
    let entries: Entry[] = [];
    let index = -1;
    let returningTo = -1;
    return {
        visit(href: string, key?: string) {
            if (returningTo >= 0) {
                const target = returningTo;
                returningTo = -1;
                if (
                    entries[target]?.key === key &&
                    pathOf(entries[target].href) === pathOf(href)
                ) {
                    index = target;
                    entries[index] = { href, key };
                    return;
                }
            }
            const sameEntry = key && entries[index]?.key === key;
            const known = sameEntry
                ? pathOf(entries[index].href) === pathOf(href)
                    ? index
                    : -1
                : key
                ? entries.findIndex(
                      (entry) =>
                          entry.key === key &&
                          pathOf(entry.href) === pathOf(href)
                  )
                : -1;
            if (known >= 0) {
                index = known;
                entries[index] = { href, key };
                return;
            }
            if (entries[index]?.href === href) return;
            // History state keys are supplied by Next; the path fallback keeps
            // older routers and shallow navigation from creating a return loop.
            if (!key && entries[index - 1]?.href === href) {
                index--;
                return;
            }
            entries = entries.slice(0, index + 1);
            entries.push({ href, key });
            if (entries.length > 64) entries.shift();
            index = entries.length - 1;
        },
        canGoBack() {
            return index > 0;
        },
        beginBack() {
            returningTo = index - 1;
        },
        previous() {
            if (index <= 0) return null;
            return {
                href: entries[index - 1].href,
                replace:
                    !!entries[index].key &&
                    entries[index].key === entries[index - 1].key,
            };
        },
    };
}
const history = createExperienceHistory();
let replacePrevious: ((href: string) => unknown) | undefined;
let openLobby: (() => unknown) | undefined;
export function trackExperienceNavigation(router: {
    replace(href: string): unknown;
    push?(href: string): unknown;
    events: {
        on(name: string, fn: () => void): void;
        off(name: string, fn: () => void): void;
    };
}) {
    let currentPath = window.location.pathname;
    const record = () => {
        // Portal navigation may reuse DisplayScene; release its transition state
        // after a route change even without an unmount.
        if (window.location.pathname !== currentPath) releaseDeparture();
        currentPath = window.location.pathname;
        const returning = pendingLobbyReturn();
        if (
            returning &&
            (window.location.pathname !== "/" ||
                new URLSearchParams(window.location.search).get("lobby") !==
                    "1")
        )
            finishLobbyReturn(returning);
        history.visit(
            window.location.pathname +
                window.location.search +
                window.location.hash,
            window.history.state?.key
        );
    };
    replacePrevious = (href) => router.replace(href);
    const navigateToLobby = router.push
        ? () => router.push("/?lobby=1")
        : undefined;
    openLobby = navigateToLobby;
    record();
    router.events.on("routeChangeComplete", record);
    router.events.on("routeChangeError", releaseDeparture);
    return () => {
        if (openLobby === navigateToLobby) openLobby = undefined;
        router.events.off("routeChangeComplete", record);
        router.events.off("routeChangeError", releaseDeparture);
    };
}
type DepartureRegistration = {
    depart: (
        options: LobbyDestinationEntryOptions
    ) => Promise<LobbyTravelView | void>;
    restore?: () => void;
};
let departureRegistration: DepartureRegistration | undefined;
let pendingDeparture: { restore(): void } | undefined;
function releaseDeparture() {
    const departure = pendingDeparture;
    pendingDeparture = undefined;
    departure?.restore();
}
/** Register the scene dissolve and transition-only cleanup for in-frame Back.
 * Cleanup runs on failure or route completion; it must not stop the new space. */
export function registerExperienceDeparture(
    depart: DepartureRegistration["depart"],
    restore?: () => void
) {
    const registration = { depart, restore };
    departureRegistration = registration;
    pendingDeparture = undefined;
    return () => {
        if (departureRegistration !== registration) return;
        departureRegistration = undefined;
        pendingDeparture = undefined;
    };
}
function departBeforeNavigation(
    navigate: (view?: LobbyTravelView | void) => unknown
) {
    if (pendingDeparture) return;
    // Coordinates update without routing; retain the latest shareable position.
    history.visit(
        window.location.pathname +
            window.location.search +
            window.location.hash,
        window.history.state?.key
    );
    const registration = departureRegistration;
    if (!registration) {
        navigate();
        return;
    }
    let restored = false;
    const departure = {
        restore() {
            if (restored) return;
            restored = true;
            try {
                registration.restore?.();
            } catch {}
        },
    };
    pendingDeparture = departure;
    const current = () =>
        departureRegistration === registration &&
        pendingDeparture === departure;
    let reducedMotion = false;
    try {
        reducedMotion =
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ===
            true;
    } catch {}
    void (async () => {
        let view: LobbyTravelView | void;
        try {
            view = await registration.depart({ reducedMotion });
        } catch {
            if (!current()) return;
            departure.restore();
        }
        if (!current()) return;
        try {
            const navigated = await navigate(view);
            if (navigated === false && current()) releaseDeparture();
        } catch {
            // Failed/cancelled routes must restore the source and release Back.
            if (current()) releaseDeparture();
        }
    })();
}

/** Search travel uses the same cube exit/entrance as lobby travel. */
export function goToExperience(
    href: string,
    navigate: (href: string) => Promise<boolean>
) {
    if (pathOf(href) === window.location.pathname) return;
    departBeforeNavigation(async (view) => {
        // Unsupported/non-native sources keep their ordinary navigation behavior.
        if (!view) return navigate(href);
        const travel = beginWorldTravel(view);
        try {
            const result = await navigate(href);
            if (result === false) finishWorldTravel(travel);
            return result;
        } catch (error) {
            finishWorldTravel(travel);
            throw error;
        }
    });
}

/** Return to the 3D lobby even when this world was opened from the 2D grid. */
export function goToLobby(fallback: () => void) {
    // An entered destination already has a retained lobby and owns its return.
    if (requestLobbyDestinationBack()) return;
    if (pendingLobbyReturn()) return;
    const navigate = openLobby;
    if (!navigate) {
        fallback();
        return;
    }
    departBeforeNavigation(async (view) => {
        const transition = beginLobbyReturn(view);
        try {
            const navigated = await navigate();
            if (navigated === false) finishLobbyReturn(transition);
            return navigated;
        } catch {
            finishLobbyReturn(transition);
            return false;
        }
    });
}

/** Keep the back arrow separate from the home action. Never assume a long
 * browser history belongs to Oncyber, or navigate out of an unentered frame. */
export function goToPreviousExperience(fallback: () => void) {
    const previous = history.previous();
    if (previous) {
        if (["/", "/landing-carousel"].includes(pathOf(previous.href))) {
            fallback();
            return;
        }
        departBeforeNavigation((view) => {
            if (view) beginWorldTravel(view);
            history.beginBack();
            // Native portals replace the URL while retaining their live renderer.
            // Return to that space through the router instead of skipping to lobby.
            if (previous.replace && replacePrevious)
                return Promise.resolve(replacePrevious(previous.href)).then(
                    (result) => {
                        if (result === false) finishWorldTravel();
                        return result;
                    },
                    (error) => {
                        finishWorldTravel();
                        throw error;
                    }
                );
            return window.history.back();
        });
        return;
    }
    if (requestLobbyDestinationBack()) return;
    if (
        window.parent === window &&
        window.history.length > 1 &&
        document.referrer
    ) {
        try {
            const previous = new URL(document.referrer);
            if (
                previous.origin === window.location.origin &&
                previous.href !== window.location.href
            ) {
                if (["/", "/landing-carousel"].includes(previous.pathname)) {
                    fallback();
                    return;
                }
                departBeforeNavigation(() => window.history.back());
                return;
            }
        } catch {
            /* An invalid referrer is not a navigation target. */
        }
    }
    fallback();
}
