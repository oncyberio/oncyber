import {
    createRemoteRuntime,
    readContext,
    readLog,
    readRunResult,
    readStatus,
    serveRuntime,
    type PageLink,
} from "./runtimeRelay";
import type { WorldScriptRuntime } from "./runtime";
import { NEUTRAL_STYLE } from "./style";

/** A page and a world joined by messages, as the frame joins them. */
function joined(space = "space-1", worldSpace = space) {
    const worldHears = new Set<(kind: string, data: any) => void>();
    const calls: string[] = [];
    let ready = true;
    const runtime: WorldScriptRuntime = {
        ready: () => ready,
        run: jest.fn(async (source: string, mode) => {
            calls.push(`run ${mode} ${source}`);
            return source.includes("bad")
                ? { ok: false, reason: "ReferenceError: nope" }
                : { ok: true };
        }),
        restart: (source) => void calls.push(`restart ${source}`),
        stop: () => void calls.push("stop"),
        setStyle: (style) => void calls.push(`style ${style.look}`),
        context: async () => ({
            sky: "#102030",
            artworks: [{ id: "a1", name: "Stars" }],
        }),
        dispose: () => {},
    };
    const events: string[] = [];
    const page = createRemoteRuntime(
        space,
        (kind, data) =>
            // The frame delivers later, never inside the call.
            void Promise.resolve().then(() =>
                [...worldHears].forEach((handler) => handler(kind, data))
            ),
        {
            onReady: (failed) => events.push(`ready ${failed ?? ""}`.trim()),
            onStatus: (status) => events.push(`status ${status.state}`),
            onLog: (level, text) => events.push(`${level} ${text}`),
        }
    );
    const link: PageLink = {
        send: (kind, data) =>
            void Promise.resolve().then(() => page.receive(kind, data)),
        listen(handler) {
            worldHears.add(handler);
            return () => void worldHears.delete(handler);
        },
    };
    const panel: boolean[] = [];
    const served = serveRuntime(
        worldSpace,
        link,
        () => runtime,
        (open) => panel.push(open)
    );
    return {
        page,
        served,
        calls,
        events,
        panel,
        link,
        setReady: (value: boolean) => (ready = value),
    };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("a world script's runtime across the frame", () => {
    test("the page cannot run anything until the world says it is ready", async () => {
        const { page, served, calls, setReady } = joined();
        setReady(false);
        await settle();
        expect(page.ready()).toBe(false);
        expect(await page.run("tick()", "fresh")).toEqual({
            ok: false,
            reason: "The world is still loading.",
        });
        expect(calls).toEqual([]);
        setReady(true);
        served.events.onReady();
        await settle();
        expect(page.ready()).toBe(true);
    });

    test("a page that starts listening late asks, and a ready world answers", async () => {
        const { page } = joined();
        await settle();
        expect(page.ready()).toBe(true);
    });

    test("a run is carried out in the world and its result comes back", async () => {
        const { page, calls } = joined();
        await settle();
        expect(await page.run("good()", "keep")).toEqual({ ok: true });
        expect(await page.run("bad()", "fresh")).toEqual({
            ok: false,
            reason: "ReferenceError: nope",
        });
        expect(calls).toEqual(["run keep good()", "run fresh bad()"]);
    });

    test("restart, stop and the panel reach the world; a style that is not one is not drawn", async () => {
        const { page, calls, panel, served } = joined();
        await settle();
        page.restart("again()");
        page.stop();
        page.setStyle({ summary: 4 } as any);
        page.setStyle(NEUTRAL_STYLE);
        await settle();
        expect(calls).toEqual(["restart again()", "stop", "style matte"]);
        served.dispose();
        expect(panel).toEqual([]);
    });

    test("the page's sidebar opening is heard by the world", () => {
        const heard: ((kind: string, data: any) => void)[] = [];
        const panel: boolean[] = [];
        serveRuntime(
            "s",
            {
                send: () => {},
                listen: (handler) => (heard.push(handler), () => {}),
            },
            () => null,
            (open) => panel.push(open)
        );
        heard[0]("script-panel", { space: "s", open: true });
        heard[0]("script-panel", { space: "other", open: false });
        heard[0]("dock-press", { space: "s", open: false });
        expect(panel).toEqual([true]);
    });

    test("the world's colours and artworks are read for the model", async () => {
        const { page } = joined();
        await settle();
        expect(await page.context()).toEqual({
            sky: "#102030",
            artworks: [{ id: "a1", name: "Stars" }],
        });
    });

    test("status and logs come up; the saved script's failure is said once", async () => {
        const { served, events } = joined();
        await settle();
        served.events.onStatus({ state: "running", version: 2 });
        served.events.onLog("warn", "careful");
        served.events.onReady("SyntaxError: line 3");
        await settle();
        expect(events).toEqual([
            "ready",
            "status running",
            "warn careful",
            "ready SyntaxError: line 3",
        ]);
    });

    test("a world that walked into another space is not driven by this page", async () => {
        const { page, calls, events } = joined("space-1", "space-2");
        await settle();
        // The other space's world says it is ready: not this page's world.
        expect(page.ready()).toBe(false);
        expect(events).toEqual([]);
        page.stop();
        page.restart("mine()");
        await settle();
        expect(calls).toEqual([]);
    });

    test("a world that goes elsewhere after being ready is no longer ready", async () => {
        const { page } = joined();
        await settle();
        expect(page.ready()).toBe(true);
        page.receive("script-ready", { space: "another" });
        expect(page.ready()).toBe(false);
    });

    test("a world that never answers a run is reported, not waited on", async () => {
        jest.useFakeTimers();
        try {
            const sent: string[] = [];
            const page = createRemoteRuntime("s", (kind) => sent.push(kind));
            page.receive("script-ready", { space: "s" });
            const result = page.run("x()", "fresh");
            jest.advanceTimersByTime(60_000);
            expect(await result).toEqual({
                ok: false,
                reason: "The world didn't answer.",
            });
            expect(sent).toEqual(["script-hello", "script-run"]);
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("what the page takes from a world's word", () => {
    test("a run result is ok only when it says so", () => {
        expect(readRunResult({ ok: true, reason: "ignored" })).toEqual({
            ok: true,
        });
        expect(readRunResult({ ok: "yes" })).toEqual({
            ok: false,
            reason: "It didn't run.",
        });
        expect(readRunResult({ reason: "x".repeat(9000) }).reason).toHaveLength(
            4000
        );
    });

    test("context is cut to what the model call accepts", () => {
        const context = readContext({
            sky: "#AABBCC",
            fog: "url(javascript:1)",
            artworks: [
                { id: "a".repeat(300), name: "n".repeat(300) },
                { id: 4, name: "no" },
                ...Array.from({ length: 300 }, (_, n) => ({
                    id: `i${n}`,
                    name: "x",
                })),
            ],
        });
        expect(context.sky).toBe("#AABBCC");
        expect(context.fog).toBeUndefined();
        expect(context.artworks).toHaveLength(200);
        expect(context.artworks[0].id).toHaveLength(200);
        expect(context.artworks[0].name).toHaveLength(120);
        expect(readContext(null)).toEqual({ artworks: [] });
    });

    test("status and log lines are read by shape", () => {
        expect(
            readStatus({ status: { state: "running", version: "3" } })
        ).toEqual({ state: "running", version: 3 });
        expect(readStatus({ status: { state: "weird" } })).toBeNull();
        expect(readLog({ level: "error", text: "boom" })).toEqual({
            level: "error",
            text: "boom",
        });
        expect(readLog({ level: "shout", text: "boom" })).toBeNull();
    });
});
