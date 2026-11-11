/**
 * Warms a space's downloads while the visitor is still in the lobby.
 *
 * A trip mounts the destination frame only once the avatar is seated (see
 * LOBBY_FRAME_MOUNT_MS), because booting a page on the main thread would make
 * the jump stutter. Downloads don't need the main thread, so they start much
 * earlier: when a world is picked, or when the pointer rests on its card.
 *
 * A worker reads the page's server data, picks the room model the frame will
 * pick, and stores it in the engine's room cache (Cache Storage "room-v1").
 * The frame's loader then reads those bytes instead of downloading them. The
 * route's scripts are prefetched with Next's own link hints. None of this
 * evaluates code from the space, so the lobby keeps every frame.
 */
import Router from "next/router";
import {
    destinationDataUrl,
    LOBBY_ENTRY,
    WARM_AGAIN_AFTER_MS,
    type WarmEntry,
    type WarmRequest,
    type WarmResult,
} from "./destinationWarmupSource";
import { createDestinationWarmupWorker } from "./destinationWarmupWorkerFactory";
import { resetRouteDataSeeds, seedRouteData } from "./routeDataSeed";

let worker: Worker | null | undefined;
const warmed = new Map<string, number>();

function saveData() {
    const connection = (navigator as any).connection;
    return connection?.saveData === true;
}

function prefetchRoute(href: string) {
    // Next's link hints download the route's scripts without running them.
    try {
        void Router.prefetch(href).catch(() => {});
    } catch {}
}

/**
 * Starts warming a destination's downloads. Safe to call often: each
 * destination is warmed once per WARM_AGAIN_AFTER_MS. Returns whether a warm
 * is (or was recently) under way.
 */
export function warmDestination(href: string, entry: WarmEntry = LOBBY_ENTRY) {
    if (typeof window === "undefined" || typeof Worker === "undefined")
        return false;
    if (saveData()) return false;
    const next = (window as any).__NEXT_DATA__;
    const dataUrl = destinationDataUrl(
        href,
        window.location.origin,
        next?.buildId,
        next?.locale
    );
    if (!dataUrl) return false;
    // A link opens the page in place: the router's own data request is the
    // first thing it waits for, so start it now and hand it over on click.
    const pageData =
        entry.kind === "direct" ? seedRouteData(dataUrl) : undefined;
    const now = performance.now();
    const key = `${entry.kind}:${dataUrl}`;
    const last = warmed.get(key);
    if (last != null && now - last < WARM_AGAIN_AFTER_MS) return true;
    warmed.set(key, now);
    prefetchRoute(href);
    if (worker === null) return true;
    const request: WarmRequest = {
        type: "warm",
        dataUrl,
        origin: window.location.origin,
        buildId: next.buildId,
        locale: next.locale,
        entry,
    };
    if (!pageData) post(request);
    else
        void pageData.then((json) => {
            // A redirect (__N_REDIRECT) is followed by the worker itself.
            const props = json?.pageProps;
            post(
                props && !props.__N_REDIRECT
                    ? { ...request, pageProps: props }
                    : request
            );
        });
    return true;
}

function post(request: WarmRequest) {
    if (worker === null) return;
    try {
        if (!worker) {
            worker = createDestinationWarmupWorker();
            worker.onmessage = (event: MessageEvent<WarmResult>) => {
                if (process.env.NODE_ENV === "development")
                    console.info("[Destination warmup]", event.data);
            };
            worker.onerror = () => {
                worker?.terminate();
                worker = null;
            };
        }
        worker.postMessage(request);
    } catch {
        worker = null;
    }
}

/** Test seam: forget warmed destinations and the worker. */
export function resetDestinationWarmup() {
    warmed.clear();
    resetRouteDataSeeds();
    worker?.terminate?.();
    worker = undefined;
}
