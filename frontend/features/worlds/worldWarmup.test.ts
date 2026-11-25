/** @jest-environment jsdom */
import {
    createWorldWarmer,
    readWarmup,
    serveWorldWarmup,
    WARMUP_MESSAGE,
    warmupPath,
} from "./worldWarmup";

const frame = { site: "https://site.example", world: "https://world.example" };

describe("what the site may ask the world host to warm", () => {
    test("a world's address on this app, as a path", () => {
        expect(warmupPath("/980madison", frame.world)).toBe("/980madison");
        expect(warmupPath("/spaces/Em8Sj1?x=1#y", frame.world)).toBe(
            "/spaces/Em8Sj1"
        );
        expect(
            warmupPath("https://world.example/mints/drop", frame.world)
        ).toBe("/mints/drop");
    });

    test("nothing else: another site, an API route, a deeper path, not a string", () => {
        for (const href of [
            "https://evil.example/980madison",
            "//evil.example/980madison",
            "/api/user/update",
            "/spaces/a/b",
            "/studio/abc",
            "javascript:alert(1)",
            42,
            null,
        ])
            expect(warmupPath(href, frame.world)).toBeNull();
    });

    test("a request is read by shape, and how the visitor gets there is one of two", () => {
        expect(
            readWarmup(
                { type: WARMUP_MESSAGE, href: "/ding", kind: "direct" },
                frame.world
            )
        ).toEqual({ href: "/ding", kind: "direct" });
        expect(
            readWarmup(
                { type: WARMUP_MESSAGE, href: "/ding", kind: "anything" },
                frame.world
            )
        ).toEqual({ href: "/ding", kind: "lobby" });
        expect(readWarmup({ type: "other", href: "/ding" }, frame.world)).toBe(
            null
        );
    });
});

/** A window standing where `origin` says, inside `parent` (or at the top). */
function fakeWindow(origin: string, parent?: any) {
    const heard = new Set<(event: any) => void>();
    const win: any = {
        location: { origin },
        addEventListener: (_: string, handler: any) => heard.add(handler),
        removeEventListener: (_: string, handler: any) => heard.delete(handler),
        deliver: (event: any) =>
            [...heard].forEach((handler) => handler(event)),
        posted: [] as any[],
    };
    win.parent = parent ?? win;
    win.postMessage = (data: any, target: string) =>
        win.posted.push({ data, target });
    return win;
}

describe("the world host's warm-up frame", () => {
    function inFrame() {
        const site = fakeWindow(frame.site);
        const win = fakeWindow(frame.world, site);
        const done: string[] = [];
        const stop = serveWorldWarmup(
            {
                engine: () => done.push("engine"),
                warm: (href, kind) => done.push(`${kind} ${href}`),
            },
            win,
            frame
        );
        return { site, win, done, stop };
    }

    test("downloads the engine and tells the site it is ready", () => {
        const { site, done } = inFrame();
        expect(done).toEqual(["engine"]);
        expect(site.posted).toEqual([
            { data: { type: WARMUP_MESSAGE, ready: true }, target: frame.site },
        ]);
    });

    test("warms what the site asks for, and listens to the site alone", () => {
        const { site, win, done } = inFrame();
        const ask = {
            type: WARMUP_MESSAGE,
            href: "/980madison",
            kind: "lobby",
        };
        win.deliver({ source: site, origin: frame.site, data: ask });
        win.deliver({ source: {}, origin: frame.site, data: ask });
        win.deliver({
            source: site,
            origin: "https://evil.example",
            data: ask,
        });
        win.deliver({
            source: site,
            origin: frame.site,
            data: { ...ask, href: "/api/user/update" },
        });
        expect(done).toEqual(["engine", "lobby /980madison"]);
    });

    test("does nothing on the site's own host, at the top, or where worlds are not framed", () => {
        const done: string[] = [];
        const does = {
            engine: () => done.push("engine"),
            warm: () => done.push("warm"),
        };
        serveWorldWarmup(
            does,
            fakeWindow(frame.site, fakeWindow(frame.site)),
            frame
        );
        serveWorldWarmup(does, fakeWindow(frame.world), frame);
        serveWorldWarmup(
            does,
            fakeWindow(frame.world, fakeWindow(frame.site)),
            null
        );
        expect(done).toEqual([]);
    });
});

describe("the site's side", () => {
    afterEach(() => (document.body.innerHTML = ""));
    const messages = (element: HTMLIFrameElement) => {
        const sent: any[] = [];
        Object.defineProperty(element, "contentWindow", {
            value: {
                postMessage: (data: any, target: string) =>
                    sent.push({ data, target }),
            },
        });
        return sent;
    };

    test("keeps one hidden frame on the world host, started on first use", () => {
        const warmer = createWorldWarmer(window, {
            site: window.location.origin,
            world: frame.world,
        });
        expect(document.querySelector("iframe")).toBeNull();
        warmer.warm("/980madison", "lobby");
        warmer.warm("/ding", "lobby");
        const frames = document.querySelectorAll("iframe");
        expect(frames).toHaveLength(1);
        expect(frames[0].src).toBe("https://world.example/world-warmup");
        expect(frames[0].hidden).toBe(true);
        expect(frames[0].getAttribute("sandbox")).toBe(
            "allow-scripts allow-same-origin"
        );
        warmer.dispose();
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("what is asked before the frame is ready is sent once it says so, to the world host only", () => {
        const world = { site: window.location.origin, world: frame.world };
        const warmer = createWorldWarmer(window, world);
        warmer.warm("/980madison", "lobby");
        warmer.warm("/980madison", "lobby");
        warmer.warm("https://evil.example/x", "lobby");
        const element = document.querySelector("iframe")!;
        const sent = messages(element);
        expect(sent).toEqual([]);
        // ready, said by something that is not the frame: not believed
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { type: WARMUP_MESSAGE, ready: true },
                origin: frame.world,
                source: window,
            })
        );
        expect(sent).toEqual([]);
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { type: WARMUP_MESSAGE, ready: true },
                origin: frame.world,
                source: element.contentWindow as any,
            })
        );
        expect(sent).toEqual([
            {
                data: {
                    type: WARMUP_MESSAGE,
                    href: "/980madison",
                    kind: "lobby",
                },
                target: frame.world,
            },
        ]);
        warmer.warm("/ding", "direct");
        expect(sent).toHaveLength(2);
        expect(sent[1].data).toEqual({
            type: WARMUP_MESSAGE,
            href: "/ding",
            kind: "direct",
        });
        warmer.dispose();
    });
});
