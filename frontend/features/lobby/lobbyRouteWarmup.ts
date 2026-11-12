/**
 * Starts loading the lobby page the moment the visitor asks to go back to it
 * from a world they opened directly (not from the lobby).
 *
 * The world first plays its ~3.2s dissolve, then the router opens /?lobby=1.
 * The router's first step is the page's server data, which took 0.5–0.7s
 * warm (2s and more cold), and the screen stays black meanwhile. Requesting
 * it at the click lets it arrive during the dissolve (see routeDataSeed).
 */
import Router from "next/router";
import { offerRouteData, seedRouteData } from "./routeDataSeed";

export const LOBBY_HREF = "/?lobby=1";

/** /_next/data URL the pages router requests for the lobby route. */
export function lobbyDataUrl(origin: string, buildId: string, locale?: string) {
    if (!buildId) return null;
    const page = locale ? `/${encodeURIComponent(locale)}` : "/index";
    return `${origin}/_next/data/${encodeURIComponent(
        buildId
    )}${page}.json?lobby=1`;
}

export function warmLobbyRoute() {
    if (typeof window === "undefined") return false;
    const next = (window as any).__NEXT_DATA__;
    const dataUrl = lobbyDataUrl(
        window.location.origin,
        next?.buildId,
        next?.locale
    );
    if (!dataUrl) return false;
    void seedRouteData(dataUrl);
    try {
        void Router.prefetch(LOBBY_HREF)
            .then(() => offerRouteData(dataUrl))
            .catch(() => {});
    } catch {
        return false;
    }
    return true;
}
