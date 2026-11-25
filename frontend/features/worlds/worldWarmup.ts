/**
 * Warming a framed world from the site (docs/plans/framed-worlds.md).
 *
 * The lobby and the landing page start a world's downloads before the
 * visitor goes there: the engine's scripts, and the room model, kept in
 * the browser's caches. A framed world is served from another host and a
 * browser keeps each host's caches apart, so what the site downloads the
 * world never finds; a trip to a big world then downloads all of it again,
 * cold.
 *
 * So the downloads are made where the world will look for them. The site
 * keeps one small hidden frame on the world host (`/world-warmup`) and tells
 * it which address to warm; that frame runs the same warm-up the site
 * always ran, in the world host's own caches.
 *
 * The site may ask for an address to be warmed and nothing else, and the
 * frame listens to the site alone.
 */
import { WORLD_FRAME, type WorldFrame } from "./worldFrame";

export const WARMUP_PATH = "/world-warmup";
export const WARMUP_MESSAGE = "oncyber:world-warmup";

/** How the visitor will get there: prepared by the lobby, or by a link. */
export type WarmupKind = "lobby" | "direct";

export interface WarmupRequest {
    href: string;
    kind: WarmupKind;
}

const WORLD_PATH = /^\/(?:spaces\/|mints\/)?[a-z0-9@_-]+\/?$/i;

/** A world's address on this app, as a path; null for anything else. */
export function warmupPath(href: unknown, origin: string): string | null {
    if (typeof href !== "string" || href.length > 400) return null;
    try {
        const url = new URL(href, origin);
        return url.origin === origin && WORLD_PATH.test(url.pathname)
            ? url.pathname
            : null;
    } catch {
        return null;
    }
}

/** What the site asked for, as far as the world host takes its word. */
export function readWarmup(data: any, origin: string): WarmupRequest | null {
    if (data?.type !== WARMUP_MESSAGE) return null;
    const href = warmupPath(data.href, origin);
    if (!href) return null;
    return { href, kind: data.kind === "direct" ? "direct" : "lobby" };
}

export interface WorldWarmer {
    /** Start the frame now (the engine's scripts download there). */
    open(): void;
    warm(href: string, kind: WarmupKind): void;
    dispose(): void;
}

/**
 * The site's side: one hidden frame on the world host, started on first
 * use, and a queue for what is asked before it has loaded.
 */
export function createWorldWarmer(win: Window, frame: WorldFrame): WorldWarmer {
    let element: HTMLIFrameElement | null = null;
    let ready = false;
    const queued: WarmupRequest[] = [];
    const send = (request: WarmupRequest) =>
        element?.contentWindow?.postMessage(
            { type: WARMUP_MESSAGE, ...request },
            frame.world
        );
    const receive = (event: MessageEvent) => {
        if (
            !element ||
            event.source !== element.contentWindow ||
            event.origin !== frame.world ||
            event.data?.type !== WARMUP_MESSAGE ||
            event.data.ready !== true
        )
            return;
        ready = true;
        queued.splice(0).forEach(send);
    };
    const open = () => {
        if (element) return;
        element = win.document.createElement("iframe");
        element.src = frame.world + WARMUP_PATH;
        element.title = "World warm-up";
        element.hidden = true;
        element.tabIndex = -1;
        element.setAttribute("aria-hidden", "true");
        // Its own origin, for that origin's caches; nothing else.
        element.setAttribute("sandbox", "allow-scripts allow-same-origin");
        element.setAttribute("referrerpolicy", "no-referrer");
        element.style.display = "none";
        win.addEventListener("message", receive);
        win.document.body.appendChild(element);
    };
    return {
        open,
        warm(href, kind) {
            const path = warmupPath(href, win.location.origin);
            if (!path) return;
            open();
            const request = { href: path, kind };
            if (ready) send(request);
            else if (!queued.some((item) => item.href === path))
                queued.push(request);
        },
        dispose() {
            win.removeEventListener("message", receive);
            element?.remove();
            element = null;
            ready = false;
            queued.length = 0;
        },
    };
}

let warmer: WorldWarmer | null | undefined;

/** This page's warmer; null where worlds are not framed, or off the site. */
function siteWarmer(): WorldWarmer | null {
    if (warmer !== undefined) return warmer;
    warmer =
        typeof window !== "undefined" &&
        WORLD_FRAME &&
        window.location.origin === WORLD_FRAME.site &&
        window.parent === window
            ? createWorldWarmer(window, WORLD_FRAME)
            : null;
    return warmer;
}

/**
 * Warms a world where it will run. False where worlds are not framed: the
 * caller then warms it here, as it always has.
 */
export function warmOnWorldHost(href: string, kind: WarmupKind): boolean {
    const site = siteWarmer();
    site?.warm(href, kind);
    return !!site;
}

/** Starts the world host's own downloads of the engine. False as above. */
export function openWorldWarmup(): boolean {
    const site = siteWarmer();
    site?.open();
    return !!site;
}

/** Tests only. */
export function resetWorldWarmup() {
    warmer?.dispose();
    warmer = undefined;
}

/**
 * The world host's side, in the warm-up frame: says it is ready, then
 * warms what the site asks for.
 */
export function serveWorldWarmup(
    does: {
        /** Download the engine's scripts into this host's cache. */
        engine(): void;
        warm(href: string, kind: WarmupKind): void;
    },
    win: Window = window,
    frame: WorldFrame | null = WORLD_FRAME
): () => void {
    if (!frame || win.location.origin !== frame.world || win.parent === win)
        return () => {};
    const receive = (event: MessageEvent) => {
        if (event.source !== win.parent || event.origin !== frame.site) return;
        const request = readWarmup(event.data, win.location.origin);
        if (request) does.warm(request.href, request.kind);
    };
    win.addEventListener("message", receive);
    does.engine();
    win.parent.postMessage({ type: WARMUP_MESSAGE, ready: true }, frame.site);
    return () => win.removeEventListener("message", receive);
}
