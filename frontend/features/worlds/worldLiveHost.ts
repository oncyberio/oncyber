/**
 * The page's side of a framed world's live channels (./relayedLive.ts).
 * The page holds the connections, with whatever sign-in it has, and passes
 * what arrives down to the world.
 */
import type { LiveSpace } from "@utils/liveSpace";
import {
    LIVE_MESSAGE,
    MAX_LIVE_WATCHES,
    readLiveSend,
    readLiveWatch,
} from "./relayedLive";

export function hostWorldLive({
    live,
    post,
    spaceId,
}: {
    /** The page's own channels (utils/liveSpace). */
    live: () => LiveSpace;
    post(kind: string, data: object): void;
    /** The space this page opened: the only feed it writes to. */
    spaceId: string;
}) {
    const watches = new Map<number, () => void>();
    return {
        receive(kind: string, data: unknown) {
            switch (kind.slice(LIVE_MESSAGE.length)) {
                case "watch": {
                    const asked = readLiveWatch(data);
                    if (
                        !asked ||
                        watches.has(asked.n) ||
                        watches.size >= MAX_LIVE_WATCHES
                    )
                        return;
                    const down = (value: unknown) =>
                        post(LIVE_MESSAGE + "data", {
                            n: asked.n,
                            data: value,
                        });
                    const channels = live();
                    watches.set(
                        asked.n,
                        asked.what === "space"
                            ? channels.watchSpace(asked.space, down)
                            : asked.what === "events"
                            ? channels.watchEvents(asked.space, down)
                            : channels.watchCollection(
                                  asked.space,
                                  asked.what,
                                  down
                              )
                    );
                    return;
                }
                case "unwatch": {
                    const n = (data as any)?.n;
                    watches.get(n)?.();
                    watches.delete(n);
                    return;
                }
                case "send": {
                    const asked = readLiveSend(data);
                    if (asked && asked.space === spaceId)
                        live().sendEvent(asked.space, asked.event);
                    return;
                }
            }
        },
        dispose() {
            watches.forEach((stop) => stop());
            watches.clear();
        },
    };
}
