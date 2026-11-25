/** @jest-environment node */
import { createWorldDocument, isWorldDocument } from "./worldDocument";
import { readWorldFrame } from "./worldFrame";

const frame = readWorldFrame(
    "https://worlds.example",
    "https://www.oncyber.com"
);

/** A window as the world sees it: its own address, a parent, a clock. */
function fakeWindow({ origin = frame.world, framed = true } = {}) {
    const posted: { message: any; target: string }[] = [];
    const listeners = new Set<(event: any) => void>();
    let now = 0;
    const timers: { every: number; next: number; run: () => void }[] = [];
    const parent = {
        postMessage: (message: any, target: string) =>
            posted.push({ message, target }),
    };
    const win: any = {
        location: { origin },
        innerWidth: 1280,
        innerHeight: 720,
        performance: { now: () => now },
        setInterval: (run: () => void, every: number) => {
            timers.push({ every, next: now + every, run });
            return timers.length;
        },
        clearInterval: (id: number) => {
            if (timers[id - 1]) timers[id - 1].next = Infinity;
        },
        addEventListener: (_: string, listener: any) => listeners.add(listener),
        removeEventListener: (_: string, listener: any) =>
            listeners.delete(listener),
    };
    win.parent = framed ? parent : win;
    return {
        win: win as Window,
        posted,
        kinds: () => posted.map(({ message }) => message.type),
        listeners,
        advance(ms: number) {
            const end = now + ms;
            for (;;) {
                const due = timers
                    .filter((timer) => timer.next <= end)
                    .sort((a, b) => a.next - b.next)[0];
                if (!due) break;
                now = due.next;
                due.next += due.every;
                due.run();
            }
            now = end;
        },
        fromPage(data: object, origin = frame.site, source: any = parent) {
            listeners.forEach((listener) => listener({ data, origin, source }));
        },
    };
}

describe("isWorldDocument", () => {
    test("only on the world host, inside a frame", () => {
        expect(isWorldDocument(fakeWindow().win, frame)).toBe(true);
        expect(isWorldDocument(fakeWindow({ framed: false }).win, frame)).toBe(
            false
        );
        expect(
            isWorldDocument(fakeWindow({ origin: frame.site }).win, frame)
        ).toBe(false);
        expect(isWorldDocument(fakeWindow().win, null)).toBe(false);
        expect(isWorldDocument(undefined, frame)).toBe(false);
    });
});

describe("createWorldDocument", () => {
    test("is nothing where the world is not framed", () => {
        expect(
            createWorldDocument(fakeWindow({ framed: false }).win, frame)
        ).toBeNull();
        expect(createWorldDocument(fakeWindow().win, null)).toBeNull();
    });

    test("says hello to the site, and only the site, until it answers", () => {
        const w = fakeWindow();
        createWorldDocument(w.win, frame);
        w.advance(600);
        expect(w.kinds()).toEqual([
            "oncyber:game:hello",
            "oncyber:game:hello",
            "oncyber:game:hello",
        ]);
        expect(w.posted[0].message).toMatchObject({ contract: 2, world: true });
        for (const { target } of w.posted) expect(target).toBe(frame.site);

        w.fromPage({ type: "oncyber:game:identity" });
        w.advance(2000);
        // one more tick notices the answer; then it is quiet
        expect(w.kinds().length).toBeLessThanOrEqual(4);
    });

    test("an answer from anyone but the page is not an answer", () => {
        const w = fakeWindow();
        createWorldDocument(w.win, frame);
        w.fromPage(
            { type: "oncyber:game:identity" },
            "https://elsewhere.example"
        );
        w.fromPage({ type: "oncyber:game:identity" }, frame.site, {});
        w.advance(1000);
        expect(w.kinds().length).toBe(5);
    });

    test("gives up asking when no page ever answers", () => {
        const w = fakeWindow();
        createWorldDocument(w.win, frame);
        w.advance(120_000);
        const asked = w.kinds().length;
        w.advance(120_000);
        expect(w.kinds().length).toBe(asked);
        expect(asked).toBeLessThan(100);
    });

    test("learns from the page who is visiting", async () => {
        const w = fakeWindow();
        const world = createWorldDocument(w.win, frame);
        const visitor = {
            type: "oncyber:game:identity",
            guest: false,
            name: "ada",
            pfp: "https://cdn.example/ada.png",
            avatarUrl: "https://cdn.example/ada.vrm",
            avatarId: "robot",
            avatarName: "Robot",
            avatarSize: 0.4,
        };
        // only the page's word counts, and only its first
        w.fromPage(
            { ...visitor, name: "mallory" },
            "https://elsewhere.example"
        );
        w.fromPage(visitor);
        w.fromPage({ ...visitor, name: "later" });
        expect(await world.visitor()).toMatchObject({
            guest: false,
            name: "ada",
            avatar: { id: "robot", url: "https://cdn.example/ada.vrm" },
            avatarSize: 0.4,
        });
    });

    test("a page that names no one, or never answers, leaves the world its own guest", async () => {
        const named = fakeWindow();
        const first = createWorldDocument(named.win, frame);
        named.fromPage({ type: "oncyber:game:identity" });
        expect(await first.visitor()).toBeNull();

        const silent = fakeWindow();
        const second = createWorldDocument(silent.win, frame);
        silent.advance(120_000);
        expect(await second.visitor()).toBeNull();
    });

    test("says where it is when that changes, and asks the page to travel", () => {
        const w = fakeWindow();
        const world = createWorldDocument(w.win, frame);
        w.posted.length = 0;
        world.location("/spaces/abc?coords=1x2x3x0");
        world.location("/spaces/abc?coords=1x2x3x0");
        world.location("/spaces/def?coords=4x5x6x0", "Second space");
        world.travel("/?lobby=1");
        expect(w.posted).toEqual([
            {
                message: {
                    type: "oncyber:game:location",
                    href: "/spaces/abc?coords=1x2x3x0",
                },
                target: frame.site,
            },
            {
                message: {
                    type: "oncyber:game:location",
                    href: "/spaces/def?coords=4x5x6x0",
                    title: "Second space",
                },
                target: frame.site,
            },
            {
                message: { type: "oncyber:game:travel", href: "/?lobby=1" },
                target: frame.site,
            },
        ]);
    });

    test("asks the page what only the page can know", async () => {
        const w = fakeWindow();
        const timers: (() => void)[] = [];
        (w.win as any).setTimeout = (run: () => void) => timers.push(run);
        (w.win as any).clearTimeout = () => {};
        const world = createWorldDocument(w.win, frame);
        w.posted.length = 0;
        const first = world.ask("moderator", { label: "starry-night" });
        const second = world.ask("moderator", { label: "elsewhere" });
        expect(w.posted.map(({ message }) => message)).toEqual([
            {
                type: "oncyber:game:ask",
                n: 1,
                name: "moderator",
                label: "starry-night",
            },
            {
                type: "oncyber:game:ask",
                n: 2,
                name: "moderator",
                label: "elsewhere",
            },
        ]);
        // answers find their questions, whatever the order; only the page's count
        w.fromPage(
            { type: "oncyber:game:answer", n: 1, value: false },
            "https://elsewhere.example"
        );
        w.fromPage({ type: "oncyber:game:answer", n: 2, value: false });
        w.fromPage({ type: "oncyber:game:answer", n: 1, value: true });
        expect(await first).toBe(true);
        expect(await second).toBe(false);

        // a page that never answers
        const third = world.ask("moderator");
        timers.at(-1)();
        expect(await third).toBeUndefined();
    });

    test("once it has drawn, says it is alive about once a second", () => {
        const w = fakeWindow();
        const world = createWorldDocument(w.win, frame);
        w.fromPage({ type: "oncyber:game:identity" });
        w.advance(5000);
        const alive = () =>
            w.kinds().filter((kind) => kind === "oncyber:game:alive").length;
        expect(alive()).toBe(0);
        world.drawn();
        w.advance(5000);
        expect(alive()).toBe(5);
        world.dispose();
        w.advance(5000);
        expect(alive()).toBe(5);
    });

    test("reports progress, then that it has drawn, once", () => {
        const w = fakeWindow();
        const world = createWorldDocument(w.win, frame);
        w.posted.length = 0;
        world.progress(0.3);
        w.advance(100);
        world.drawn();
        world.drawn();
        world.progress(0.9);
        expect(w.posted.map(({ message }) => message)).toEqual([
            { type: "oncyber:game:progress", value: 0.3, label: "" },
            {
                type: "oncyber:game:first-frame",
                ms: 100,
                width: 1280,
                height: 720,
            },
            { type: "oncyber:game:ready" },
        ]);
    });

    test("says when it could not load, and stops listening when disposed", () => {
        const w = fakeWindow();
        const world = createWorldDocument(w.win, frame);
        world.failed();
        expect(w.kinds()).toContain("oncyber:game:error");
        world.dispose();
        expect(w.listeners.size).toBe(0);
        const asked = w.kinds().length;
        w.advance(5000);
        expect(w.kinds().length).toBe(asked);
    });
});
