import {
    readLiveSend,
    readLiveWatch,
    relayedLiveSpace,
    MAX_LIVE_WATCHES,
} from "./relayedLive";
import { hostWorldLive } from "./worldLiveHost";
import { deferred, type LiveSpace } from "@utils/liveSpace";

jest.mock("@features/worlds/worldDocument", () => ({
    worldDocument: () => null,
}));

/** Channels that record who is watching and let a test make things arrive. */
function channels() {
    const watching = new Map<string, (data: any) => void>();
    const sent: string[] = [];
    const watch = (key: string, onData: (data: any) => void) => {
        watching.set(key, onData);
        return () => void watching.delete(key);
    };
    const live: LiveSpace = {
        watchSpace: (id, onData) => watch(`space ${id}`, onData),
        watchCollection: (id, name, onData) => watch(`${name} ${id}`, onData),
        watchEvents: (id, onEvent) => watch(`events ${id}`, onEvent),
        sendEvent: (id, event) =>
            void sent.push(`${id} ${JSON.stringify(event)}`),
    };
    return { live, watching, sent };
}

/** A world and its page joined by messages, as the frame joins them. */
function joined(spaceId = "space-1") {
    const page = channels();
    // The page's channels that carry no sign-in.
    const unsigned = channels();
    const worldHears = new Set<(kind: string, data: any) => void>();
    const host = hostWorldLive({
        live: () => page.live,
        others: () => unsigned.live,
        spaceId,
        post: (kind, data) =>
            worldHears.forEach((handler) => handler(kind, data)),
    });
    const world = relayedLiveSpace({
        send: (kind, data) => host.receive(kind, data),
        listen(handler) {
            worldHears.add(handler);
            return () => void worldHears.delete(handler);
        },
    });
    return { world, host, page, unsigned };
}

describe("a space's live channels across the frame", () => {
    test("what the page's channels deliver reaches the world's watcher, each to its own", () => {
        const { world, page } = joined();
        const got: string[] = [];
        world.watchSpace("space-1", (data) => got.push(`space ${data.name}`));
        world.watchCollection("space-1", "portals", (data) =>
            got.push(`portals ${Object.keys(data)}`)
        );
        world.watchEvents("space-1", (event) =>
            got.push(`event ${event.type}`)
        );
        page.watching.get("space space-1")({ name: "Gallery" });
        page.watching.get("portals space-1")({ a: {}, b: {} });
        page.watching.get("events space-1")({ type: "EDITOR_ACTION" });
        expect(got).toEqual([
            "space Gallery",
            "portals a,b",
            "event EDITOR_ACTION",
        ]);
    });

    test("a watcher that stops is no longer watched on the page", () => {
        const { world, page } = joined();
        const stop = world.watchEvents("space-1", () => {});
        expect([...page.watching.keys()]).toEqual(["events space-1"]);
        stop();
        stop();
        expect([...page.watching.keys()]).toEqual([]);
    });

    test("another space is read with no sign-in, and written to never", () => {
        const { world, page, unsigned } = joined("space-1");
        world.watchSpace("space-1", () => {});
        world.watchSpace("space-2", () => {});
        world.watchEvents("space-2", () => {});
        // The opened space, as the page reads it; any other, as a
        // signed-out visitor would.
        expect([...page.watching.keys()]).toEqual(["space space-1"]);
        expect([...unsigned.watching.keys()]).toEqual([
            "space space-2",
            "events space-2",
        ]);
        expect(unsigned.sent).toEqual([]);
        world.sendEvent("space-2", { type: "USER_KICKED" });
        world.sendEvent("space-1", { type: "EDITOR_ACTION", action: { x: 1 } });
        expect(page.sent).toEqual([
            'space-1 {"type":"EDITOR_ACTION","action":{"x":1}}',
        ]);
    });

    test("the page stops everything when the world goes", () => {
        const { world, host, page } = joined();
        world.watchSpace("space-1", () => {});
        world.watchEvents("space-1", () => {});
        host.dispose();
        expect(page.watching.size).toBe(0);
    });

    test("a world cannot make the page hold more channels than a world has", () => {
        const { world, page, unsigned } = joined();
        for (let i = 0; i < MAX_LIVE_WATCHES + 5; i++)
            world.watchSpace(`space-${i}`, () => {});
        // Across both sets of channels: the limit is the world's.
        expect(page.watching.size + unsigned.watching.size).toBe(
            MAX_LIVE_WATCHES
        );
    });
});

describe("what the page takes from a world", () => {
    test("a watch names a channel there is and a space id that could be one", () => {
        expect(
            readLiveWatch({ n: 1, what: "space", space: "abc_DEF-1" })
        ).toEqual({ n: 1, what: "space", space: "abc_DEF-1" });
        for (const bad of [
            { n: 1, what: "users", space: "abc" },
            { n: 1, what: "space", space: "a/b" },
            { n: 1, what: "space", space: "../users" },
            { n: "1", what: "space", space: "abc" },
            { n: 1, what: "space" },
            null,
        ])
            expect(readLiveWatch(bad)).toBeNull();
    });

    test("an event is plain data and not large", () => {
        expect(
            readLiveSend({
                space: "abc",
                event: { type: "X", at: new Date(0) },
            })
        ).toEqual({
            space: "abc",
            event: { type: "X", at: "1970-01-01T00:00:00.000Z" },
        });
        expect(readLiveSend({ space: "abc", event: "text" })).toBeNull();
        expect(readLiveSend({ space: "abc", event: [1] })).toBeNull();
        expect(readLiveSend({ space: "a/b", event: {} })).toBeNull();
        expect(
            readLiveSend({ space: "abc", event: { big: "x".repeat(70_000) } })
        ).toBeNull();
        const loop: any = {};
        loop.self = loop;
        expect(readLiveSend({ space: "abc", event: loop })).toBeNull();
    });
});

describe("channels that are still loading", () => {
    test("watch once loaded, and a watcher stopped before then never starts", async () => {
        const real = channels();
        let loaded: (live: LiveSpace) => void;
        const live = deferred(new Promise((resolve) => (loaded = resolve)));
        live.watchSpace("a", () => {});
        const stop = live.watchEvents("a", () => {});
        live.sendEvent("a", { type: "X" });
        stop();
        loaded(real.live);
        await Promise.resolve();
        await Promise.resolve();
        expect([...real.watching.keys()]).toEqual(["space a"]);
        expect(real.sent).toEqual(['a {"type":"X"}']);
    });
});
