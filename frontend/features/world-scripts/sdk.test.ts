import { WORLD_SCRIPT_BRIEF } from "./brief";
import { cleanOps } from "./protocol";
import { runScript } from "./scriptSandbox.jest";

const of = (ops: any[], op: string) => ops.filter((item) => item.op === op);

describe("the SDK a world script runs on", () => {
    test("a thing is added once, then only what changed is sent", () => {
        const script = runScript(`
            const coin = world.add({ id: "coin", shape: "sphere", color: "gold" });
            world.onUpdate((dt) => { coin.position.y += 1; });
        `);
        expect(of(script.ops(), "add")).toHaveLength(1);
        const first = script.tick();
        expect(first).toEqual([
            { op: "set", id: "coin", props: { position: [0, 1, 0] } },
        ]);
        // Nothing about its colour, text or opacity: the host would draw
        // its look again for each of those.
        expect(Object.keys(script.tick()[0].props)).toEqual(["position"]);
    });

    test("a thing that did not change sends nothing", () => {
        const script = runScript(`world.add({ id: "rock" });`);
        expect(script.tick()).toEqual([]);
        expect(script.tick()).toEqual([]);
    });

    test("a HUD line is sent when it says something new, not every frame", () => {
        const script = runScript(`
            let score = 0;
            world.onUpdate(() => { ui.hud("score", "Score " + score, "top"); });
            input.onKeyDown(() => { score++; });
        `);
        expect(of(script.tick(), "hud")).toHaveLength(1);
        expect(of(script.tick(), "hud")).toHaveLength(0);
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
        expect(of(script.tick(), "hud")).toEqual([
            { op: "hud", key: "score", text: "Score 1", corner: "top" },
        ]);
        expect(of(script.tick(), "hud")).toHaveLength(0);
    });

    test("a cleared HUD shows a line again when asked", () => {
        const script = runScript(`
            world.onUpdate(() => { ui.hud("goal", "Go", "top"); });
            input.onKeyDown(() => { ui.clear(); });
        `);
        script.tick();
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
        const ops = script.tick();
        expect(ops.map((item) => item.op)).toEqual(["hud-clear", "hud"]);
    });

    test("a part is removed with the thing it belongs to", () => {
        const script = runScript(`
            const npc = world.add({ id: "npc", shape: "capsule" });
            npc.add({ id: "head", shape: "sphere" });
            input.onKeyDown(() => npc.remove());
        `);
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
        expect(of(script.tick(), "remove").map((item) => item.id)).toEqual([
            "head",
            "npc",
        ]);
        expect(script.errors()).toEqual([]);
    });

    test("a model is built from parts, takes things as parts, and is removed", () => {
        const script = runScript(`
            const stall = world.build({ id: "stall" });
            stall.box([0, 0, 0], [2, 1, 1]);
            const sign = stall.add({ id: "sign", text: "Open" });
            stall.box([0, 1, 0], [2, 1.2, 1]);
            input.onKeyDown(() => stall.remove());
        `);
        expect(script.errors()).toEqual([]);
        // The model's parts are what it is made of; the sign is a thing of
        // its own that hangs from it, and is not sent among them.
        const made = of(script.ops(), "set").find((item) => item.props.parts);
        expect(made.props.parts.map((part: any[]) => part[0])).toEqual([
            "box",
            "box",
        ]);
        expect(cleanOps([made]).ops[0]).toMatchObject({ op: "set" });
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
        expect(of(script.tick(), "remove").map((item) => item.id)).toEqual([
            "sign",
            "stall",
        ]);
        expect(script.errors()).toEqual([]);
    });

    test("a model's parts travel only when they change", () => {
        const script = runScript(`
            const wall = world.build({ id: "wall" });
            wall.box([0, 0, 0], [1, 1, 1]);
            world.onUpdate(() => { wall.position.x += 1; });
            input.onKeyDown(() => wall.box([1, 0, 0], [2, 1, 1]));
        `);
        expect(script.tick()[0].props.parts).toBeUndefined();
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
        expect(script.tick()[0].props.parts).toHaveLength(2);
    });

    test("a live edit that keeps the game hands over places and keep() values", () => {
        const script = runScript(
            `const game = keep("game", { score: 0 });
             const npc = world.add({ id: "npc", position: [1, 0, 1] });
             ui.hud("score", "Score " + game.score, "top");`,
            {
                mode: "keep",
                kept: { game: { score: 4 } },
                things: { npc: { position: [9, 0, 9], rotation: [0, 2, 0] } },
            }
        );
        expect(script.errors()).toEqual([]);
        const ops = script.ops();
        expect(of(ops, "add")[0].props).toMatchObject({
            position: [9, 0, 9],
            rotation: [0, 2, 0],
        });
        expect(of(ops, "hud")[0].text).toBe("Score 4");
    });

    test("an error in a script's own code is reported, and the frame is still answered", () => {
        const script = runScript(`world.onUpdate(() => { nothing.here(); });`);
        script.tick();
        expect(script.errors()[0]).toContain("nothing is not defined");
        expect(script.posted[script.posted.length - 1].t).toBe("ops");
    });

    test("nothing in the sandbox reaches the network or starts another worker", () => {
        const { scope } = runScript("");
        for (const name of ["fetch", "Worker", "importScripts"]) {
            expect(scope[name]).toBeUndefined();
            // And it cannot be put back.
            expect(Object.getOwnPropertyDescriptor(scope, name)).toMatchObject({
                configurable: false,
                writable: false,
            });
        }
    });
});

describe("what the model is told a script can use", () => {
    // One of everything the brief names, made by the real SDK.
    const probe = runScript(`
        const thing = world.add({ id: "thing" });
        self.__probe = {
            world, input, ui, sound, thing,
            names: { keep, wait, every, random, distance },
            log: console.log,
        };
    `).scope.__probe;

    const named = (owner: string) =>
        [
            ...new Set(
                [
                    ...WORLD_SCRIPT_BRIEF.matchAll(
                        new RegExp(`\\b${owner}\\.([a-zA-Z]+)`, "g")
                    ),
                ].map((match) => match[1])
            ),
        ].sort();

    test.each(["world", "input", "ui", "sound", "thing"])(
        "every %s.name in the brief is in the SDK",
        (owner) => {
            const names = named(owner);
            expect(names.length).toBeGreaterThan(0);
            const missing = names.filter((name) => !(name in probe[owner]));
            expect(missing).toEqual([]);
        }
    );

    test("the brief's own functions are handed to the script", () => {
        for (const name of ["keep", "wait", "every", "random", "distance"]) {
            expect(WORLD_SCRIPT_BRIEF).toContain(`${name}(`);
            expect(typeof probe.names[name]).toBe("function");
        }
        expect(typeof probe.log).toBe("function");
        expect(typeof probe.world.player.moveTo).toBe("function");
    });

    test("the brief's example runs as written", () => {
        const example = WORLD_SCRIPT_BRIEF.split(
            "Example: collect the coins\n"
        )[1];
        const script = runScript(example, {
            style: {
                summary: "",
                palette: ["#111111", "#eeee00"],
                look: "matte",
            },
        });
        script.tick();
        expect(script.errors()).toEqual([]);
        expect(of(script.ops(), "add").length).toBeGreaterThan(12);
    });
});
