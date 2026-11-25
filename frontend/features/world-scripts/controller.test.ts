import { createController, MAX_ATTEMPTS } from "./controller";
import type { RunResult, WorldScriptRuntime } from "./runtime";
import {
    getWorldScripts,
    resetWorldScripts,
    savedScript,
    setWorldScripts,
} from "./store";
import { NEUTRAL_STYLE } from "./style";

jest.mock("@api/worldScripts/_api", () => ({ __esModule: true, default: {} }));

function world(
    runs: (source: string) => boolean | RunResult | Promise<RunResult> = () =>
        true
) {
    const calls: string[] = [];
    let ready = true;
    const runtime: WorldScriptRuntime = {
        ready: () => ready,
        async run(source, mode, style) {
            calls.push(
                `run ${mode} ${source}${style ? ` in ${style.look}` : ""}`
            );
            const result = await runs(source);
            return typeof result === "object"
                ? result
                : result
                ? { ok: true }
                : {
                      ok: false,
                      reason: "TypeError: x is not a function\n at 3",
                  };
        },
        restart: (source) => void calls.push(`restart ${source}`),
        stop: () => void calls.push("stop"),
        cancel: () => void calls.push("cancel"),
        setStyle: () => void calls.push("style"),
        context: async () => ({ sky: "#000011", artworks: [] }),
        dispose: () => {},
    };
    return { runtime, calls, setReady: (value: boolean) => (ready = value) };
}

function server(answers: string[], extra: object = {}) {
    const asked: any[] = [];
    const saved: any[] = [];
    let savedAt = 0;
    return {
        asked,
        saved,
        api: {
            generate: jest.fn(async (input: any) => {
                asked.push(input);
                const source = answers.shift();
                return source
                    ? {
                          ok: true,
                          source,
                          name: "Game",
                          say: "Done.",
                          change: "content",
                          remaining: 7,
                          ...extra,
                      }
                    : { ok: false, error: "No more." };
            }),
            save: jest.fn(async (input: any) => {
                saved.push(input);
                savedAt++;
                return {
                    ok: true,
                    scripts: (input.scripts || []).map((script: any) => ({
                        ...script,
                        updatedAt: savedAt,
                    })),
                };
            }),
        } as any,
    };
}

const glow = { ...NEUTRAL_STYLE, look: "glow" as const };

const space = { id: "space-1", info: { headline: "A world" } };
const lines = () =>
    getWorldScripts().transcript.map((entry) => `${entry.kind}: ${entry.text}`);

beforeEach(() => {
    resetWorldScripts();
    setWorldScripts({ canEdit: true, canAsk: true, earlyAccess: true });
});

describe("the AI sidebar's requests", () => {
    test("writes, tries, swaps in and saves", async () => {
        const { runtime, calls } = world();
        const { api, asked, saved } = server(["first()"]);
        await createController(space, runtime, api).ask("make a game");
        expect(calls).toEqual(["run fresh first()"]);
        expect(asked[0]).toMatchObject({
            experienceId: "space-1",
            request: "make a game",
            world: { title: "A world", sky: "#000011" },
        });
        expect(saved[0].scripts[0]).toMatchObject({
            source: "first()",
            name: "Game",
            prompt: "make a game",
            enabled: true,
        });
        expect(getWorldScripts()).toMatchObject({
            source: "first()",
            busy: false,
            remaining: 7,
        });
    });

    test("a script that does not run goes back to the model with what failed", async () => {
        const { runtime, calls } = world((source) => source !== "broken()");
        const { api, asked, saved } = server(["broken()", "fixed()"]);
        await createController(space, runtime, api).ask("make a game");
        expect(calls).toEqual(["run fresh broken()", "run fresh fixed()"]);
        expect(asked[1].failure).toEqual({
            source: "broken()",
            reason: "TypeError: x is not a function\n at 3",
        });
        expect(saved).toHaveLength(1);
        expect(saved[0].scripts[0].source).toBe("fixed()");
        expect(lines()).toContain(
            "step: It didn't run: TypeError: x is not a function"
        );
    });

    test("after the last try the world is left as it was and nothing is saved", async () => {
        const { runtime } = world(() => false);
        const { api, saved } = server(["a()", "b()", "c()", "d()"]);
        setWorldScripts({ source: "kept()" });
        await createController(space, runtime, api).ask("change it");
        expect(api.generate).toHaveBeenCalledTimes(MAX_ATTEMPTS);
        expect(saved).toEqual([]);
        expect(getWorldScripts().source).toBe("kept()");
    });

    test("a change to a running script keeps the game going, and undo goes back", async () => {
        const { runtime, calls } = world();
        const { api, saved } = server(["second()"]);
        setWorldScripts({ source: "first()" });
        const controller = createController(space, runtime, api);
        await controller.ask("more stars");
        await controller.ask("undo");
        expect(calls).toEqual(["run keep second()", "run fresh first()"]);
        expect(saved.map((save) => save.scripts[0].source)).toEqual([
            "second()",
            "first()",
        ]);
    });

    test("nobody outside early access reaches the model", async () => {
        const { runtime } = world();
        const { api } = server(["x()"]);
        setWorldScripts({ canAsk: false, earlyAccess: false, askReason: "" });
        await createController(space, runtime, api).ask("make a game");
        expect(api.generate).not.toHaveBeenCalled();
        expect(lines()).toContain(
            "error: AI scripts are in early access for now."
        );
    });

    test("a world still loading is said so, without spending a request", async () => {
        const { runtime, setReady } = world();
        const { api } = server(["x()"]);
        setReady(false);
        await createController(space, runtime, api).ask("make a game");
        expect(api.generate).not.toHaveBeenCalled();
        expect(lines()).toContain(
            "error: The world is still loading. Try again in a moment."
        );
    });

    test("stop and restart are done without the model", async () => {
        const { runtime, calls } = world();
        const { api } = server([]);
        setWorldScripts({ source: "game()" });
        const controller = createController(space, runtime, api);
        await controller.ask("stop");
        await controller.ask("Restart.");
        expect(calls).toEqual(["stop", "restart game()"]);
        expect(api.generate).not.toHaveBeenCalled();
    });

    test("a world that could not try it is said so, and the model is not asked to fix what it did not break", async () => {
        const { runtime } = world(() => ({
            ok: false,
            reason: "The world didn't answer.",
            fault: "world",
        }));
        const { api, saved } = server(["a()", "b()", "c()"]);
        await createController(space, runtime, api).ask("make a game");
        expect(api.generate).toHaveBeenCalledTimes(1);
        expect(saved).toEqual([]);
        expect(lines()).toEqual(
            expect.arrayContaining([
                "step: It couldn't be tried: The world didn't answer.",
                "error: The world wasn't ready for it, so nothing changed. Try again in a moment.",
            ])
        );
        expect(getWorldScripts().busy).toBe(false);
    });

    test("a style the model wrote goes with the script: tried in it, saved with it", async () => {
        const { runtime, calls } = world();
        const { api, saved } = server(["neon()"], { style: glow });
        await createController(space, runtime, api).ask("make it neon");
        // Nothing was drawn or saved in the new style before the run.
        expect(calls).toEqual(["run fresh neon() in glow"]);
        expect(saved).toHaveLength(1);
        expect(saved[0].style).toEqual(glow);
        expect(saved[0].scripts[0].source).toBe("neon()");
        expect(getWorldScripts().style).toEqual(glow);
    });

    test("a script that never runs leaves the world's style alone too", async () => {
        const { runtime, calls } = world(() => false);
        const { api, saved } = server(["a()", "b()", "c()"], { style: glow });
        await createController(space, runtime, api).ask("make it neon");
        expect(saved).toEqual([]);
        expect(calls).not.toContain("style");
        expect(getWorldScripts().style).toBeNull();
        expect(lines()).not.toContain("step: Picked a style from this world");
    });

    test("undo goes back to the style the earlier version ran in", async () => {
        const { runtime, calls } = world();
        const { api, saved } = server(["neon()"], { style: glow });
        setWorldScripts({ source: "plain()", style: NEUTRAL_STYLE });
        const controller = createController(space, runtime, api);
        await controller.ask("make it neon");
        await controller.ask("undo");
        expect(calls[1]).toBe("run fresh plain() in matte");
        expect(saved[1].style).toEqual(NEUTRAL_STYLE);
        expect(getWorldScripts().style).toEqual(NEUTRAL_STYLE);
    });

    test("an undo that does not run says so and can be tried again", async () => {
        let fails = false;
        const { runtime, calls } = world(() => !fails);
        const { api, saved } = server(["second()"]);
        setWorldScripts({ source: "first()" });
        const controller = createController(space, runtime, api);
        await controller.ask("more stars");
        fails = true;
        await controller.ask("undo");
        expect(lines()).toContain(
            "error: Couldn't go back to the previous version: TypeError: x is not a function"
        );
        expect(getWorldScripts().source).toBe("second()");
        expect(saved).toHaveLength(1);
        fails = false;
        await controller.ask("undo");
        expect(calls[calls.length - 1]).toBe("run fresh first()");
        expect(getWorldScripts().source).toBe("first()");
        // Nothing earlier than that.
        await controller.ask("undo");
        expect(lines()).toContain(
            "say: There's no earlier version to go back to."
        );
    });

    test("each save says what it builds on, and one that builds on something older is not written over", async () => {
        const { runtime } = world();
        const { api, asked, saved } = server(["a()", "b()", "c()"]);
        const controller = createController(space, runtime, api);
        await controller.ask("one");
        await controller.ask("two");
        expect(saved.map((save) => save.base)).toEqual([0, 1]);
        expect(asked.map((ask) => ask.base)).toEqual([0, 1]);
        api.save.mockImplementationOnce(async () => ({
            ok: false,
            conflict: true,
            error: "Changed somewhere else.",
        }));
        await controller.ask("three");
        expect(lines()[lines().length - 1]).toMatch(
            /^error: This space's script was changed somewhere else/
        );
        // Still what this page last saved.
        expect(getWorldScripts().script).toMatchObject({ updatedAt: 2 });
    });

    test("what was saved is what the space starts with when the page shows it again", async () => {
        const { runtime } = world();
        const { api } = server(["edited()"], { style: glow });
        await createController(space, runtime, api).ask("make a game");
        // The page's own copy of the space is from when it loaded.
        const stale = { id: "space-1", worldScripts: [] as any[] };
        expect(savedScript(stale)).toMatchObject({
            source: "edited()",
            style: glow,
        });
        // A copy fetched after a later save elsewhere wins.
        const fresher = {
            id: "space-1",
            worldScripts: [
                {
                    id: "s",
                    name: "n",
                    source: "theirs()",
                    enabled: true,
                    updatedAt: 99,
                },
            ],
        };
        expect(savedScript(fresher).source).toBe("theirs()");
        expect(savedScript({ id: "another", worldScripts: [] }).source).toBe(
            ""
        );
    });

    test("a request still under way when the space goes off show writes nothing and saves nothing", async () => {
        let finish: (result: RunResult) => void = () => {};
        const { runtime } = world(
            () => new Promise<RunResult>((resolve) => (finish = resolve))
        );
        const { api, saved } = server(["late()"]);
        const controller = createController(space, runtime, api);
        const asking = controller.ask("make a game");
        await new Promise((resolve) => setTimeout(resolve, 0));
        // Another space is on show now, with a store of its own.
        controller.dispose();
        resetWorldScripts();
        setWorldScripts({ experienceId: "space-2", source: "theirs()" });
        finish({ ok: true });
        await asking;
        expect(saved).toEqual([]);
        expect(getWorldScripts()).toMatchObject({
            experienceId: "space-2",
            source: "theirs()",
            transcript: [],
        });
    });

    test("something that throws is said, and the sidebar is not left busy", async () => {
        const { runtime } = world(() => {
            throw new Error("Loading chunk 12 failed");
        });
        const { api } = server(["a()"]);
        await createController(space, runtime, api).ask("make a game");
        expect(lines()[lines().length - 1]).toBe(
            "error: That didn't work: Loading chunk 12 failed"
        );
        expect(getWorldScripts().busy).toBe(false);
    });
});
