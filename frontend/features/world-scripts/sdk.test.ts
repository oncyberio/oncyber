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

/**
 * What the SDK has and the model is not yet offered (scriptApi.ts marks
 * each `false`): models, solids, openings, avatars and the world's doors.
 * Each is checked here as far as the host: what it sends passes the host's
 * checks (protocol.ts) as the thing it is meant to be.
 */
describe("what is in the SDK and not yet offered to the model", () => {
    const key = (script: ReturnType<typeof runScript>) =>
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
    const cleaned = (ops: any[]) => cleanOps(ops).ops as any[];
    const PAINT = `{ color: "#aa5522" }`;

    test("world.build: a model is made of parts, in its own frame", () => {
        const script = runScript(`
            const stall = world.build({ id: "stall", position: [3, 0, 0] });
            stall.box([0, 0, 0], [2, 1, 1], ${PAINT})
                 .poly([[0, 1, 0], [2, 1, 0], [1, 2, 0]], ${PAINT})
                 .beam([0, 0, 0], [0, 2, 0], [0, 0, 1], 0.1, 0.1, ${PAINT})
                 .prism([1, 1], 0.2, 0, 2, ${PAINT})
                 .line([0, 0, 0], [1, 0, 0], [0, 0, 1], ${PAINT});
            stall.place([5, 0, 0], Math.PI / 2, (inner) => {
                inner.box([0, 0, 0], [1, 1, 1], ${PAINT});
            });
        `);
        expect(script.errors()).toEqual([]);
        const ops = cleaned(script.ops());
        expect(of(ops, "add")[0]).toMatchObject({
            id: "stall",
            props: { shape: "model", position: [3, 0, 0] },
        });
        const { parts } = of(ops, "set")[0].props;
        expect(parts.map((part: any[]) => part[0])).toEqual([
            "box",
            "poly",
            "beam",
            "prism",
            "line",
            "place",
        ]);
        // What was added inside place() is inside it.
        const placed = parts[5];
        expect(placed[1]).toEqual([5, 0, 0]);
        expect(placed[3].map((part: any[]) => part[0])).toEqual(["box"]);
    });

    test("world.build: parts given up front go with the model; a part with no colour is refused", () => {
        const script = runScript(`
            world.build({ id: "wall", parts: [["box", [0, 0, 0], [1, 1, 1], ${PAINT}]] })
                .box([1, 0, 0], [2, 1, 1]);
        `);
        const ops = cleaned(script.ops());
        expect(of(ops, "add")[0].props.parts).toHaveLength(1);
        // The second box has no look to be drawn with: the host drops it.
        expect(of(ops, "set")[0].props.parts).toHaveLength(1);
    });

    test("world.build: a model takes things as parts, starts again, and is removed", () => {
        const script = runScript(`
            const stall = world.build({ id: "stall" });
            stall.box([0, 0, 0], [2, 1, 1], ${PAINT});
            const sign = stall.add({ id: "sign", text: "Open" });
            stall.box([0, 1, 0], [2, 1.2, 1], ${PAINT});
            let presses = 0;
            input.onKeyDown(() => {
                if (++presses === 1) stall.clear().box([0, 0, 0], [1, 1, 1], ${PAINT});
                else stall.remove();
            });
        `);
        expect(script.errors()).toEqual([]);
        // The model's parts are what it is made of; the sign is a thing of
        // its own that hangs from it, and is not sent among them.
        const ops = cleaned(script.ops());
        expect(of(ops, "set")[0].props.parts).toHaveLength(2);
        expect(
            of(ops, "add").find((op) => op.id === "sign").props
        ).toMatchObject({ shape: "text", parent: "stall" });
        key(script);
        expect(cleaned(script.tick())[0].props.parts).toHaveLength(1);
        key(script);
        expect(of(script.tick(), "remove").map((item) => item.id)).toEqual([
            "sign",
            "stall",
        ]);
        expect(script.errors()).toEqual([]);
    });

    test("world.build: a model's parts travel only when they change", () => {
        const script = runScript(`
            const wall = world.build({ id: "wall" });
            wall.box([0, 0, 0], [1, 1, 1], ${PAINT});
            world.onUpdate(() => { wall.position.x += 1; });
            input.onKeyDown(() => wall.box([1, 0, 0], [2, 1, 1], ${PAINT}));
        `);
        expect(script.tick()[0].props.parts).toBeUndefined();
        key(script);
        expect(script.tick()[0].props.parts).toHaveLength(2);
    });

    test("world.solid: boxes and walls nobody walks through", () => {
        const script = runScript(`
            world.solid({
                id: "fence",
                position: [0, 0, 5],
                boxes: [[[0, 0, 0], [4, 1, 0.2]]],
                walls: [[[0, 0, 0], [4, 0, 0], [4, 3, 0], [0, 3, 0]]],
            });
        `);
        expect(cleaned(script.ops())).toEqual([
            {
                op: "add",
                id: "fence",
                props: expect.objectContaining({
                    shape: "solid",
                    position: [0, 0, 5],
                    boxes: [
                        [
                            [0, 0, 0],
                            [4, 1, 0.2],
                        ],
                    ],
                    walls: [
                        [
                            [0, 0, 0],
                            [4, 0, 0],
                            [4, 3, 0],
                            [0, 3, 0],
                        ],
                    ],
                }),
            },
        ]);
    });

    test("world.open: a hole of a size, where the thing is; moved, it moves", () => {
        const script = runScript(`
            const gap = world.open({ id: "gap", size: [2, 3, 1], position: [1, 1.5, 0] });
            input.onKeyDown(() => { gap.position.x = 4; });
        `);
        expect(cleaned(script.ops())[0]).toMatchObject({
            op: "add",
            id: "gap",
            props: { shape: "opening", size: [2, 3, 1], position: [1, 1.5, 0] },
        });
        key(script);
        expect(script.tick()).toEqual([
            { op: "set", id: "gap", props: { position: [4, 1.5, 0] } },
        ]);
    });

    test("world.avatar: one of the built-in avatars, named, with something to do", () => {
        const script = runScript(`
            const guide = world.avatar({ id: "guide", avatar: "robot", name: "Ada", motion: "wave" });
            input.onKeyDown(() => { guide.motion = "sit"; guide.lookAt([5, 0, 0]); });
        `);
        expect(cleaned(script.ops())[0]).toMatchObject({
            op: "add",
            id: "guide",
            props: {
                shape: "avatar",
                avatar: "robot",
                name: "Ada",
                motion: "wave",
            },
        });
        key(script);
        const [set] = cleaned(script.tick());
        expect(set.props.motion).toBe("sit");
        expect(set.props.rotation[1]).toBeCloseTo(Math.PI / 2);
    });

    // A wait() ends in a frame and is heard just after it, as any promise is.
    const frames = async (
        script: ReturnType<typeof runScript>,
        count: number
    ) => {
        const ops: any[] = [];
        for (let i = 0; i < count; i++) {
            ops.push(...script.tick(0.1));
            await Promise.resolve();
        }
        return ops;
    };

    test("world.avatar: what it says is said for a few seconds, then cleared", async () => {
        const script = runScript(`
            const guide = world.avatar({ id: "guide" });
            input.onKeyDown(() => guide.speak("Hello", 1));
        `);
        key(script);
        expect(cleaned(script.tick(0.1))[0].props).toEqual({ say: "Hello" });
        // The script's clock is the world's frames: not yet a second.
        expect(await frames(script, 8)).toEqual([]);
        const cleared = await frames(script, 4);
        expect(cleaned(cleared)).toEqual([
            { op: "set", id: "guide", props: { say: "" } },
        ]);
    });

    test("world.avatar: something new said keeps the old from clearing it", async () => {
        const script = runScript(`
            const guide = world.avatar({ id: "guide" });
            let said = 0;
            input.onKeyDown(() => guide.speak(++said === 1 ? "One" : "Two", said === 1 ? 0.3 : 5));
        `);
        key(script);
        script.tick(0.1);
        key(script);
        const ops = await frames(script, 10);
        expect(of(ops, "set").map((set) => set.props.say)).toEqual(["Two"]);
    });

    const DOORS = [
        {
            id: "Portal_Door_1",
            position: [10, 0, 0],
            yaw: Math.PI / 2,
            width: 1,
            height: 2,
            portal: false,
            open: 0,
            building: { position: [8, 0, 0], size: [6, 4, 6] },
        },
        {
            id: "Portal_Door_2",
            position: [0, 0, 0],
            yaw: 0,
            width: 1,
            height: 2,
            portal: true,
            open: 0,
            building: null,
        },
    ];

    test("world.doors: each door is told, and found by id", () => {
        const { scope } = runScript(
            `self.__doors = {
                ids: world.doors.map((door) => door.id),
                one: world.door("Portal_Door_1"),
                none: world.door("Portal_Door_9"),
            };`,
            { doors: DOORS }
        );
        expect(scope.__doors.ids).toEqual(["Portal_Door_1", "Portal_Door_2"]);
        expect(scope.__doors.none).toBeNull();
        expect(scope.__doors.one).toMatchObject({
            width: 1,
            height: 2,
            portal: false,
            building: { position: { x: 8, y: 0, z: 0 } },
        });
    });

    test("world.doors: a door swings between shut and open; a portal's is not the script's", () => {
        const script = runScript(
            `let step = 0;
             input.onKeyDown(() => {
                 world.doors.forEach((door) => { door.open = step === 0 ? 0.5 : 7; });
                 step++;
             });`,
            { doors: DOORS }
        );
        expect(script.tick()).toEqual([]);
        key(script);
        expect(cleaned(script.tick())).toEqual([
            { op: "door", id: "Portal_Door_1", open: 0.5 },
        ]);
        // Asked the same again, nothing is sent; too far is fully open.
        expect(script.tick()).toEqual([]);
        key(script);
        expect(cleaned(script.tick())).toEqual([
            { op: "door", id: "Portal_Door_1", open: 1 },
        ]);
    });

    test("world.doors: a point is told from the doorway and back", () => {
        const { scope } = runScript(
            `const door = world.door("Portal_Door_1");
             const out = door.toWorld([0, 1, 2]);
             self.__points = {
                 out,
                 back: door.toLocal(out),
                 far: door.distanceTo([10, 0, 3]),
             };`,
            { doors: DOORS }
        );
        const { out, back, far } = scope.__points;
        // Two metres out through a door that lets out along +x.
        expect(
            [out.x, out.y, out.z].map((n) => Math.round(n * 100) / 100)
        ).toEqual([12, 1, 0]);
        expect(
            [back.x, back.y, back.z].map((n) => Math.round(n * 100) / 100 + 0)
        ).toEqual([0, 1, 2]);
        expect(far).toBeCloseTo(3);
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
