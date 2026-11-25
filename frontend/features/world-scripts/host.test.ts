import { WorldScriptHost, TRIAL_TICKS, type WorldScriptSink } from "./host";
import { WORLD_SCRIPT_LIMITS } from "./basics";
import { arrive, ManualVersion, SandboxVersion } from "./scriptSandbox.jest";
import { TRIAL_FLOOD, TRIAL_REPLACED, TRIAL_SILENT } from "./trial";
import type { ScriptVersion } from "./version";

// A trial left waiting at the end of a test would keep its watch alive.
const hosts: WorldScriptHost[] = [];
afterEach(() => {
    hosts.splice(0).forEach((host) => host.dispose());
});

/** A world that writes down what it is asked to do. */
function world(version: (source: string) => ScriptVersion) {
    const calls: string[] = [];
    const things = new Map<string, any>();
    const hud = new Map<string, string>();
    const artworks = [
        {
            id: "art-1",
            name: "Stars",
            type: "image",
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            visible: true,
        },
    ];
    const sink: WorldScriptSink = {
        view: () => ({
            player: { position: [0, 0, 0], forward: [0, 0, 1], yaw: 0 },
            camera: { position: [0, 1.6, 0], forward: [0, 0, 1] },
        }),
        artworks: () => artworks as any,
        addThing(id, props) {
            calls.push(`add ${id} ${props.shape}`);
            things.set(id, { ...props });
        },
        setThing(id, props) {
            things.set(id, { ...things.get(id), ...props });
        },
        removeThing(id) {
            calls.push(`remove ${id}`);
            things.delete(id);
        },
        setArtwork: (id) => void calls.push(`artwork ${id}`),
        resetArtworks: () => void calls.push("reset artworks"),
        doors: () => [],
        setDoor: () => {},
        resetDoors: () => {},
        movePlayer: () => void calls.push("move player"),
        hud(key, text) {
            if (text == null) hud.delete(key);
            else hud.set(key, text);
        },
        clearHud: () => hud.clear(),
        toast: () => {},
        banner: () => {},
        sound: () => {},
    };
    const status: string[] = [];
    const logs: string[] = [];
    const styles: unknown[] = [];
    const opened: ScriptVersion[] = [];
    const host = new WorldScriptHost(
        null,
        sink,
        {
            onStatus: (next) =>
                status.push(
                    next.state === "stopped"
                        ? `stopped: ${next.reason}`
                        : next.state
                ),
            onLog: (level, text) => logs.push(`${level}: ${text}`),
            onStyle: (style) => styles.push(style),
        },
        (source) => {
            const next = version(source);
            opened.push(next);
            return next;
        }
    );
    hosts.push(host);
    /** The world draws `count` frames, and what scripts answer arrives. */
    async function frames(count = TRIAL_TICKS + 3) {
        await arrive();
        for (let i = 0; i < count; i++) {
            host.frame(1 / 60);
            await arrive();
        }
    }
    return { host, calls, things, hud, status, logs, styles, opened, frames };
}

const scripted = () => world((source) => new SandboxVersion(source));
const byHand = () => world((source) => new ManualVersion(source));
const last = (w: ReturnType<typeof world>) =>
    w.opened[w.opened.length - 1] as ManualVersion;

/** Speaks a manual version through a clean start and its trial. */
async function land(w: ReturnType<typeof world>, ops: object[] = []) {
    await arrive();
    const version = last(w);
    version.says({ t: "ops", seq: -1, ops });
    version.says({ t: "started" });
    for (let i = 0; i < TRIAL_TICKS; i++) {
        w.host.frame(1 / 60);
        version.says({ t: "ops", seq: i + 1, ops: [] });
    }
    await arrive();
    return version;
}

describe("starting a script", () => {
    test("it is tried out of sight, then shown all at once", async () => {
        const w = scripted();
        const result = w.host.start(`
            world.add({ id: "coin", shape: "sphere" });
            ui.hud("goal", "Collect", "top");
        `);
        await w.frames(TRIAL_TICKS - 5);
        // Still on trial: nothing of it is in the world.
        expect(w.things.size).toBe(0);
        expect(w.hud.size).toBe(0);
        expect(w.host.running).toBe(false);
        await w.frames(10);
        expect(await result).toMatchObject({ ok: true, mode: "fresh" });
        expect([...w.things.keys()]).toEqual(["coin"]);
        expect(w.hud.get("goal")).toBe("Collect");
        expect(w.status).toEqual(["idle", "starting", "running"]);
    });

    test("one that throws while starting is refused as the script's fault", async () => {
        const w = scripted();
        const result = w.host.start(`world.add({ id: "a" }); nope();`);
        await w.frames(3);
        expect(await result).toMatchObject({
            ok: false,
            fault: "script",
            reason: expect.stringContaining("nope is not defined"),
        });
        expect(w.things.size).toBe(0);
        expect(w.status[w.status.length - 1]).toMatch(/^stopped: /);
    });

    test("one too long is not opened at all", async () => {
        const w = byHand();
        const source = "x".repeat(WORLD_SCRIPT_LIMITS.maxSourceBytes + 1);
        expect(await w.host.start(source)).toMatchObject({
            ok: false,
            fault: "script",
            reason: "The script is too long.",
        });
        expect(w.opened).toHaveLength(0);
    });

    test("a frame that never opens is the world's fault, not the script's", async () => {
        const w = world((source) => {
            const version = new ManualVersion(source);
            version.opens = false;
            return version;
        });
        expect(await w.host.start("fine()")).toMatchObject({
            ok: false,
            fault: "world",
            reason: "The script frame did not open.",
        });
    });

    test("one that goes quiet while it owes a frame is given up on; one that is owed nothing is waited for", async () => {
        jest.useFakeTimers();
        try {
            const w = byHand();
            let result: any;
            void w.host.start("quiet()").then((value) => (result = value));
            await arrive();
            const version = last(w);
            version.says({ t: "ops", seq: -1, ops: [] });
            version.says({ t: "started" });
            // No frame is drawn (a tab in the background): nothing is owed.
            jest.advanceTimersByTime(600_000);
            await arrive();
            expect(result).toBeUndefined();
            // A frame is sent and never answered.
            w.host.frame(1 / 60);
            jest.advanceTimersByTime(10_000);
            await arrive();
            expect(result).toMatchObject({
                ok: false,
                fault: "world",
                reason: TRIAL_SILENT,
            });
            expect(version.closed).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("a live edit", () => {
    test("a version that fails leaves the running one as it was", async () => {
        const w = scripted();
        const first = w.host.start(`world.add({ id: "coin" });`);
        await w.frames();
        await first;
        const edit = w.host.swap(`world.add({ id: "bad" }); boom();`, "keep");
        await w.frames(5);
        expect(await edit).toMatchObject({ ok: false, fault: "script" });
        expect([...w.things.keys()]).toEqual(["coin"]);
        expect(w.host.running).toBe(true);
        // What runs was never said to have stopped.
        expect(w.status).toEqual(["idle", "starting", "running"]);
    });

    test("keeping the game: same ids stay, what is no longer made or shown goes", async () => {
        const w = scripted();
        const first = w.host.start(`
            const game = keep("game", { score: 0 });
            const npc = world.add({ id: "npc", shape: "capsule" });
            world.add({ id: "old-prop" });
            ui.hud("timer", "60s", "top");
            ui.hud("score", "Score " + game.score, "top-left");
            world.onUpdate(() => { npc.position.x = 5; game.score = 3; });
        `);
        await w.frames();
        await first;
        w.calls.length = 0;
        const edit = w.host.swap(
            `const game = keep("game", { score: 0 });
             world.add({ id: "npc", shape: "capsule", color: "red" });
             world.add({ id: "new-prop" });
             ui.hud("score", "Score " + game.score, "top-left");`,
            "keep"
        );
        await w.frames();
        expect(await edit).toMatchObject({ ok: true, mode: "keep" });
        // The npc was not made again, and is where the game had put it.
        expect(w.calls).toEqual(["add new-prop box", "remove old-prop"]);
        expect(w.things.get("npc")).toMatchObject({
            position: [5, 0, 0],
            color: "#ff3b30",
        });
        // The timer line the new version does not show is gone; the score
        // carried over.
        expect([...w.hud]).toEqual([["score", "Score 3"]]);
    });

    test("a rewind puts artworks and the player back", async () => {
        const w = scripted();
        const first = w.host.start(`world.add({ id: "a" });`);
        await w.frames();
        await first;
        w.calls.length = 0;
        const edit = w.host.swap(`world.add({ id: "a" });`, "fresh");
        await w.frames();
        expect(await edit).toMatchObject({ ok: true, mode: "fresh" });
        expect(w.calls).toEqual(["reset artworks", "move player"]);
    });

    test("an id made again as another shape is built anew, and still counts", async () => {
        const w = scripted();
        const few = WORLD_SCRIPT_LIMITS.maxAvatars;
        const first = w.host.start(`
            for (let i = 0; i < ${few}; i++) world.avatar({ id: "npc-" + i });
            world.add({ id: "coin", shape: "box" });
            world.add({ id: "extra", shape: "box" });
        `);
        await w.frames();
        await first;
        w.calls.length = 0;
        const edit = w.host.swap(
            `for (let i = 0; i < ${few}; i++) world.avatar({ id: "npc-" + i });
             world.add({ id: "coin", shape: "sphere" });
             world.avatar({ id: "extra" });`,
            "keep"
        );
        await w.frames();
        await edit;
        // The coin is a sphere now: taken away and made, not restyled.
        expect(w.calls).toContain("remove coin");
        expect(w.calls).toContain("add coin sphere");
        expect(w.things.get("coin").shape).toBe("sphere");
        // A box turned avatar is one avatar too many, as a new one would be.
        expect(w.calls).not.toContain("add extra avatar");
        expect(w.things.has("extra")).toBe(false);
        expect(w.logs).toContain(
            `warn: A script can have ${few} of "avatar" at once.`
        );
    });

    test("a thing no longer built from what it was is built anew", async () => {
        const w = scripted();
        const first = w.host.start(
            `world.add({ id: "vase", shape: "lathe", profile: [[0, 0], [1, 1]] });`
        );
        await w.frames();
        await first;
        w.calls.length = 0;
        const edit = w.host.swap(
            `world.add({ id: "vase", shape: "lathe" });`,
            "keep"
        );
        await w.frames();
        await edit;
        expect(w.calls).toEqual(["remove vase", "add vase lathe"]);
        expect(w.things.get("vase").profile).toBeUndefined();
    });

    test("a style that comes with a version is the world's only once it lands", async () => {
        const w = scripted();
        w.host.style = { look: "matte" };
        const failing = w.host.start(`boom();`, { look: "glow" });
        await w.frames(3);
        await failing;
        expect(w.styles).toEqual([]);
        expect(w.host.style).toEqual({ look: "matte" });
        const landing = w.host.start(
            `ui.hud("look", world.style.look, "top");`,
            { look: "glow" }
        );
        await w.frames();
        await landing;
        expect(w.styles).toEqual([{ look: "glow" }]);
        expect(w.host.style).toEqual({ look: "glow" });
        // And the version was tried in it.
        expect(w.hud.get("look")).toBe("glow");
    });
});

describe("one version taking another's place", () => {
    test("a trial that is replaced ends at once, quietly", async () => {
        const w = byHand();
        const first = w.host.start("one()");
        await arrive();
        const one = last(w);
        one.says({ t: "ops", seq: -1, ops: [] });
        one.says({ t: "started" });
        w.host.frame(1 / 60);
        one.says({ t: "ops", seq: 1, ops: [] });
        // Started, and owing nothing: before, this one was never heard of
        // again and whoever waited for it waited for good.
        const second = w.host.swap("two()", "fresh");
        expect(await first).toEqual({
            ok: false,
            reason: TRIAL_REPLACED,
            fault: "world",
        });
        expect(one.closed).toBe(true);
        await land(w);
        expect(await second).toMatchObject({ ok: true });
        expect(w.status).toEqual(["idle", "starting", "starting", "running"]);
        expect(w.logs).toEqual([]);
    });

    test("stopping during a trial ends it, and the world is idle", async () => {
        const w = byHand();
        const pending = w.host.start("one()");
        await arrive();
        w.host.stop();
        expect(await pending).toMatchObject({ ok: false, fault: "world" });
        expect(w.status).toEqual(["idle", "starting", "idle"]);
    });

    test("a trial can be given up on without touching what runs", async () => {
        const w = byHand();
        const first = w.host.start("one()");
        await land(w, [{ op: "add", id: "a", props: {} }]);
        await first;
        const edit = w.host.swap("two()", "fresh");
        await arrive();
        w.host.abandon();
        expect(await edit).toMatchObject({ ok: false, fault: "world" });
        expect(w.host.running).toBe(true);
        expect([...w.things.keys()]).toEqual(["a"]);
        expect(w.status[w.status.length - 1]).toBe("running");
    });

    test("of two edits asked for at once, the later one lands", async () => {
        const w = byHand();
        const first = w.host.start("one()");
        const running = await land(w);
        await first;
        // Both wait for the running version's keep() values.
        const a = w.host.swap("a()", "keep");
        const b = w.host.swap("b()", "keep");
        await arrive();
        running.says({ t: "kept", kept: {} });
        expect(await a).toMatchObject({ ok: false, fault: "world" });
        const landed = await land(w);
        expect(await b).toMatchObject({ ok: true });
        expect(landed.source).toBe("b()");
        expect(w.opened.map((version) => version.source)).toEqual([
            "one()",
            "b()",
        ]);
    });

    test("a script that asks to restart on every frame restarts once", async () => {
        const w = scripted();
        const first = w.host.start(`
            const game = keep("game", { over: false });
            world.add({ id: "a" });
            let frames = 0;
            world.onUpdate(() => { if (++frames > 3) world.restart(); });
        `);
        await w.frames();
        await first;
        const before = w.opened.length;
        // Long enough for the rewind to land, asked for all the while.
        await w.frames(TRIAL_TICKS + 2);
        expect(w.opened.length - before).toBe(1);
        expect(w.status.filter((state) => state === "running").length).toBe(2);
    });

    test("a script's own restart does not take an edit's place", async () => {
        const w = byHand();
        const first = w.host.start("one()");
        const running = await land(w);
        await first;
        const edit = w.host.swap("edit()", "fresh");
        await arrive();
        running.says({ t: "restart" });
        await arrive();
        expect(w.opened.map((version) => version.source)).toEqual([
            "one()",
            "edit()",
        ]);
        await land(w);
        expect(await edit).toMatchObject({ ok: true });
    });
});

describe("limits", () => {
    const adds = (count: number, from = 0) =>
        Array.from({ length: count }, (_, i) => ({
            op: "add",
            id: `t${from + i}`,
            props: {},
        }));

    test("a script has so many objects, and no more", async () => {
        const w = byHand();
        const start = w.host.start("many()");
        await land(w, adds(WORLD_SCRIPT_LIMITS.maxThings + 20));
        await start;
        expect(w.things.size).toBe(WORLD_SCRIPT_LIMITS.maxThings);
        expect(w.logs).toContain(
            `warn: A script can have ${WORLD_SCRIPT_LIMITS.maxThings} objects at once.`
        );
    });

    test("requests are counted by the frame, however many messages carry them", async () => {
        const w = byHand();
        const start = w.host.start("one()");
        const version = await land(w);
        await start;
        const per = WORLD_SCRIPT_LIMITS.maxOpsPerTick;
        const sets = (count: number) =>
            Array.from({ length: count }, () => ({
                op: "toast",
                text: "hi",
                seconds: 1,
            }));
        const toasts: number[] = [];
        (w.host as any).sink.toast = () => toasts.push(1);
        w.host.frame(1 / 60);
        version.says({ t: "ops", seq: 99, ops: sets(per - 10) });
        version.says({ t: "ops", seq: 99, ops: sets(per) });
        version.says({ t: "ops", seq: 99, ops: sets(per) });
        expect(toasts).toHaveLength(per);
        // The next frame brings a new allowance.
        w.host.frame(1 / 60);
        version.says({ t: "ops", seq: 100, ops: sets(5) });
        expect(toasts).toHaveLength(per + 5);
    });

    test("a script that floods the page with messages is stopped, and what it made is cleared", async () => {
        const w = byHand();
        const start = w.host.start("flood()");
        const version = await land(w, adds(3));
        await start;
        w.host.frame(1 / 60);
        for (let i = 0; i <= WORLD_SCRIPT_LIMITS.maxMessagesPerFrame; i++)
            version.says({ t: "ops", seq: 1, ops: [] });
        expect(version.closed).toBe(true);
        expect(w.host.running).toBe(false);
        expect(w.things.size).toBe(0);
        expect(w.status[w.status.length - 1]).toBe(`stopped: ${TRIAL_FLOOD}`);
    });

    test("a flood during the trial fails the trial", async () => {
        const w = byHand();
        const start = w.host.start("flood()");
        await arrive();
        const version = last(w);
        for (let i = 0; i <= WORLD_SCRIPT_LIMITS.maxMessagesPerFrame; i++)
            version.says({ t: "ops", seq: -1, ops: [] });
        expect(await start).toMatchObject({
            ok: false,
            fault: "script",
            reason: TRIAL_FLOOD,
        });
    });
});

describe("a script that is over", () => {
    test("one that keeps failing is stopped, and takes what it made with it", async () => {
        const w = scripted();
        const start = w.host.start(`
            world.add({ id: "a" });
            ui.hud("goal", "Go", "top");
            let frames = 0;
            world.onUpdate(() => { if (++frames > ${
                TRIAL_TICKS + 2
            }) broken(); });
        `);
        await w.frames();
        await start;
        expect(w.things.size).toBe(1);
        await w.frames(WORLD_SCRIPT_LIMITS.maxErrors + 5);
        expect(w.host.running).toBe(false);
        expect(w.things.size).toBe(0);
        expect(w.hud.size).toBe(0);
        expect(w.status[w.status.length - 1]).toBe(
            "stopped: The script kept failing, so it was stopped."
        );
        expect(w.calls).toContain("reset artworks");
    });

    test("stop takes everything back and closes the version", async () => {
        const w = scripted();
        const start = w.host.start(`world.add({ id: "a" });`);
        await w.frames();
        await start;
        const version = w.opened[0];
        w.host.stop();
        expect(version.closed).toBe(true);
        expect(w.things.size).toBe(0);
        expect(w.status[w.status.length - 1]).toBe("idle");
        // And frames are no longer sent anywhere.
        expect(() => w.host.frame(1 / 60)).not.toThrow();
    });

    test("after dispose nothing is opened", async () => {
        const w = byHand();
        w.host.dispose();
        expect(await w.host.start("late()")).toMatchObject({
            ok: false,
            fault: "world",
        });
        expect(w.opened).toHaveLength(0);
    });
});

describe("frames", () => {
    test("a version still busy with a frame is sent the time it missed with the next", async () => {
        const w = byHand();
        const start = w.host.start("slow()");
        const version = await land(w);
        await start;
        const before = version.ticks().length;
        w.host.frame(0.016);
        // Not answered: two frames go by without it.
        w.host.frame(0.016);
        w.host.frame(0.016);
        expect(version.ticks().length - before).toBe(1);
        version.says({ t: "ops", seq: 1, ops: [] });
        w.host.frame(0.016);
        const ticks = version.ticks();
        expect(ticks.length - before).toBe(2);
        expect(ticks[ticks.length - 1].dt).toBeCloseTo(0.048);
    });

    test("the time carried is no more than a frame may be", async () => {
        const w = byHand();
        const start = w.host.start("slow()");
        const version = await land(w);
        await start;
        w.host.frame(0.016);
        for (let i = 0; i < 100; i++) w.host.frame(0.016);
        version.says({ t: "ops", seq: 1, ops: [] });
        w.host.frame(0.016);
        const ticks = version.ticks();
        expect(ticks[ticks.length - 1].dt).toBe(0.1);
    });
});
