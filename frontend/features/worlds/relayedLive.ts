/**
 * A space's live channels in a framed world (utils/liveSpace): the page
 * around the world holds them and passes them down, so the world loads no
 * Firebase and opens no connection of its own.
 *
 * Up, world to page: `live-watch` (a number, what to watch, which space),
 * `live-unwatch`, `live-send` (an event for the space's feed).
 * Down, page to world: `live-data` (the number, and what arrived).
 *
 * The page reads for whichever space it is asked about: these are the
 * reads any visitor's browser already makes. It writes only to the feed
 * of the space it opened (./worldLiveHost.ts).
 */
import type { FrameLink } from "./frameLink";
import type { LiveCollection, LiveSpace } from "@utils/liveSpace";

export const LIVE_MESSAGE = "live-";
export type LiveWatch = "space" | "events" | LiveCollection;
export const LIVE_WATCHES: readonly LiveWatch[] = [
    "space",
    "events",
    "portals",
    "kitbash",
];
/** A world watches a handful of channels; more than this is not a world. */
export const MAX_LIVE_WATCHES = 12;
export const MAX_LIVE_EVENT_BYTES = 64_000;

const SPACE_ID = /^[A-Za-z0-9_-]{1,160}$/;

export function readLiveWatch(
    data: any
): { n: number; what: LiveWatch; space: string } | null {
    if (
        !Number.isSafeInteger(data?.n) ||
        !LIVE_WATCHES.includes(data.what) ||
        typeof data.space !== "string" ||
        !SPACE_ID.test(data.space)
    )
        return null;
    return { n: data.n, what: data.what, space: data.space };
}

/** An event a world asks to put on a space's feed: plain data, not large. */
export function readLiveSend(
    data: any
): { space: string; event: Record<string, unknown> } | null {
    const event = data?.event;
    if (
        typeof data?.space !== "string" ||
        !SPACE_ID.test(data.space) ||
        !event ||
        typeof event !== "object" ||
        Array.isArray(event)
    )
        return null;
    try {
        const text = JSON.stringify(event);
        if (text.length > MAX_LIVE_EVENT_BYTES) return null;
        return { space: data.space, event: JSON.parse(text) };
    } catch {
        return null;
    }
}

/** The link a framed world has to its page (./worldDocument). */
type PageLink = FrameLink;

/** The world's side: each watch is a number the page answers under. */
export function relayedLiveSpace(page: PageLink): LiveSpace {
    let count = 0;
    const watching = new Map<number, (data: any) => void>();
    page.listen((kind, data) => {
        if (kind === LIVE_MESSAGE + "data") watching.get(data?.n)?.(data.data);
    });
    const watch = (
        what: LiveWatch,
        space: string,
        onData: (data: any) => void
    ) => {
        const n = ++count;
        watching.set(n, onData);
        page.send(LIVE_MESSAGE + "watch", { n, what, space });
        return () => {
            if (!watching.delete(n)) return;
            page.send(LIVE_MESSAGE + "unwatch", { n });
        };
    };
    return {
        watchSpace: (id, onData) => watch("space", id, onData),
        watchCollection: (id, collection, onData) =>
            watch(collection, id, onData),
        watchEvents: (id, onEvent) => watch("events", id, onEvent),
        sendEvent: (id, event) =>
            page.send(LIVE_MESSAGE + "send", { space: id, event }),
    };
}
