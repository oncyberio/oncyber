import { createController, MAX_ATTEMPTS } from "./controller";
import type { WorldScriptRuntime } from "./runtime";
import { getWorldScripts, resetWorldScripts, setWorldScripts } from "./store";

jest.mock("@api/worldScripts/_api", () => ({ __esModule: true, default: {} }));

function world(runs: (source: string) => boolean = () => true) {
    const calls: string[] = [];
    let ready = true;
    const runtime: WorldScriptRuntime = {
        ready: () => ready,
        async run(source, mode) {
            calls.push(`run ${mode} ${source}`);
            return runs(source)
                ? { ok: true }
                : {
                      ok: false,
                      reason: "TypeError: x is not a function\n at 3",
                  };
        },
        restart: (source) => void calls.push(`restart ${source}`),
        stop: () => void calls.push("stop"),
        setStyle: () => void calls.push("style"),
        context: async () => ({ sky: "#000011", artworks: [] }),
        dispose: () => {},
    };
    return { runtime, calls, setReady: (value: boolean) => (ready = value) };
}

function server(answers: string[]) {
    const asked: any[] = [];
    const saved: any[] = [];
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
                      }
                    : { ok: false, error: "No more." };
            }),
            save: jest.fn(async (input: any) => {
                saved.push(input);
                return {
                    ok: true,
                    scripts: (input.scripts || []).map((script: any) => ({
                        ...script,
                        updatedAt: 1,
                    })),
                };
            }),
        } as any,
    };
}

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
});
