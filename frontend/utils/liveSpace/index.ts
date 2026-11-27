/**
 * A space's live channels: what changes while someone is in it.
 *
 * - its saved document, portals and kitbash pieces, each time they change
 *   (an editor saving while visitors watch);
 * - its event feed: editor actions as they happen, and events the server
 *   sends (an artwork's media finished compressing, a visitor was removed).
 *
 * They are Firebase's, and Firebase is a large library that belongs with
 * the account. So nothing here imports it. In the space's own page it is
 * loaded on first use, as a chunk of its own (./firebase.ts). In a framed
 * world it is never loaded: the page around the world holds the channels
 * and passes them down (features/worlds/relayedLive.ts).
 */
import { worldDocument } from "@features/worlds/worldDocument";
import { relayedLiveSpace } from "@features/worlds/relayedLive";
import { hasFirebaseSession } from "./firebaseSession";

export type LiveCollection = "portals" | "kitbash";

export interface LiveSpace {
    /** The saved document as plain data; not called while it is missing. */
    watchSpace(id: string, onData: (data: any) => void): () => void;
    /** Every piece of a collection under the space, by id. */
    watchCollection(
        id: string,
        collection: LiveCollection,
        onData: (pieces: Record<string, any>) => void
    ): () => void;
    /** The newest event on the space's feed, with its key as `id`. */
    watchEvents(id: string, onEvent: (event: any) => void): () => void;
    sendEvent(id: string, event: object): void;
}

/** The same interface over an implementation that is still loading. */
export function deferred(loading: Promise<LiveSpace>): LiveSpace {
    const later =
        (start: (live: LiveSpace) => () => void) => (): (() => void) => {
            let stop = () => {};
            let stopped = false;
            void loading.then(
                (live) => {
                    if (!stopped) stop = start(live);
                },
                (error) => console.error("[live space]", error)
            );
            return () => {
                stopped = true;
                stop();
            };
        };
    return {
        watchSpace: (id, onData) =>
            later((live) => live.watchSpace(id, onData))(),
        watchCollection: (id, collection, onData) =>
            later((live) => live.watchCollection(id, collection, onData))(),
        watchEvents: (id, onEvent) =>
            later((live) => live.watchEvents(id, onEvent))(),
        sendEvent: (id, event) =>
            void loading.then(
                (live) => live.sendEvent(id, event),
                (error) => console.error("[live space]", error)
            ),
    };
}

/**
 * Firebase's channels, with its sign-in library first for a visitor who
 * has a sign-in saved (so their reads and writes carry it, as they always
 * did) and without it for everyone else (./firebaseSession.ts).
 */
async function loadFirebase(): Promise<LiveSpace> {
    if (await hasFirebaseSession()) await import("@utils/firebase");
    return (await import("./firebase")).default;
}

let unsigned: LiveSpace | undefined;
/**
 * Channels that carry no sign-in, whatever the page holds: for what a
 * framed world reads, through the page, of a space the page did not open.
 * Never loads the sign-in library.
 */
export function signedOutLiveSpace(): LiveSpace {
    return (unsigned ||= deferred(
        import("./firebase").then((firebase) => firebase.signedOutChannels())
    ));
}

let live: LiveSpace | undefined;

/** This document's live channels. */
export function liveSpace(): LiveSpace {
    if (live) return live;
    const page = worldDocument();
    if (page) return (live = relayedLiveSpace(page));
    const loading = loadFirebase();
    const channels = (live = deferred(loading));
    // A load that failed (a dropped connection while the code was fetched)
    // is tried again by whoever asks next, not remembered for the page.
    loading.catch(() => {
        if (live === channels) live = undefined;
    });
    return channels;
}
