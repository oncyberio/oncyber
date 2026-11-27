import { WORLD_SCRIPT_BRIEF } from "./brief";
import { THING_LOOKS } from "./basics";
import {
    AVATAR_MOTIONS,
    cleanOps,
    cleanThingProps,
    GIVEN_KEYS,
    HUD_CORNERS,
    LIVE_KEYS,
    SOUND_NAMES,
    THING_PATTERNS,
    THING_PROP_KEYS,
    THING_PROPS,
    THING_SHAPES,
    type ThingPropKey,
} from "./protocol";
import {
    SCRIPT_API,
    SCRIPT_GLOBALS,
    SHAPES_NOT_OFFERED,
    type ScriptApiOwner,
} from "./scriptApi";
import { runScript } from "./scriptSandbox.jest";
import { wrapUserSource } from "./sdk";

/**
 * The script API is defined in two tables: the names a script can use
 * (./scriptApi.ts) and a thing's properties (THING_PROPS in ./protocol.ts).
 * The cleaner, the engine's lists and the SDK's lists are made from them.
 * What cannot be made from a table (the SDK's own code, the brief's prose)
 * is held to them here, in both directions.
 */

const ARTWORK = {
    id: "art-1",
    name: "Stars",
    type: "image",
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
};
const DOOR = {
    id: "Portal_Door_1",
    position: [4, 0, 0],
    yaw: 0,
    width: 1,
    height: 2,
    portal: false,
    open: 0,
    building: null as null,
};

/** One of everything, made by the real SDK. */
const made = runScript(
    `self.__made = {
        world, input, ui, sound, console,
        player: world.player,
        camera: world.camera,
        thing: world.add({ id: "thing" }),
        model: world.build({ id: "model" }),
        avatar: world.avatar({ id: "avatar" }),
        artwork: world.artworks[0],
        door: world.doors[0],
        handed: { world, input, ui, sound, keep, wait, every, random, distance, console },
    };`,
    { artworks: [ARTWORK], doors: [DOOR] }
).scope.__made;

const names = (object: object) =>
    Object.keys(object)
        .filter((name) => !name.startsWith("_"))
        .sort();
const listed = (owner: ScriptApiOwner) => Object.keys(SCRIPT_API[owner]).sort();
const told = (owner: ScriptApiOwner) =>
    Object.entries(SCRIPT_API[owner]) as Array<[string, boolean]>;

/** A thing carries the properties the SDK sends for it, besides its own names. */
const THING_HELD = [...LIVE_KEYS, "shape", "parent", "parts", "lamp"];

describe("the names a script can use are the SDK's, no more and no fewer", () => {
    test.each(["world", "input", "ui", "sound", "console"] as const)(
        "%s",
        (owner) => {
            expect(names(made[owner])).toEqual(listed(owner));
        }
    );

    test.each(["player", "camera", "artwork", "door"] as const)(
        "%s",
        (owner) => {
            expect(names(made[owner])).toEqual(listed(owner));
        }
    );

    test("a thing: its own names, and the properties it keeps", () => {
        expect(names(made.thing)).toEqual(
            [...listed("thing"), ...THING_HELD].sort()
        );
    });

    test("a model and an avatar are things with more", () => {
        const plain = names(made.thing);
        const more = (thing: object) =>
            names(thing).filter((name) => !plain.includes(name));
        expect(more(made.model)).toEqual(listed("model"));
        expect(more(made.avatar)).toEqual(listed("avatar"));
    });

    test("the script is handed exactly what its wrapper names, in that order", () => {
        expect(names(made.handed)).toEqual([...SCRIPT_GLOBALS].sort());
        expect(wrapUserSource("")).toContain(
            `function (${SCRIPT_GLOBALS.join(", ")})`
        );
        // And each name is the thing it says: swapped, this would not hold.
        const order = runScript(
            `self.__order = [world.add, input.isDown, ui.hud, sound.play, keep, wait, every, random, distance, console.log]
                .map((value) => typeof value);`
        ).scope.__order;
        expect(order).toEqual(SCRIPT_GLOBALS.map(() => "function"));
    });
});

describe("the brief tells the model of what is offered, and of nothing else", () => {
    const brief = WORLD_SCRIPT_BRIEF;
    const between = (from: string, to: string) =>
        brief.slice(brief.indexOf(from), brief.indexOf(to));
    const line = (start: string) =>
        brief.split("\n").find((text) => text.startsWith(start)) || "";
    /** Offered names it leaves out, and names not offered it mentions. */
    const strays = (
        owner: ScriptApiOwner,
        mentions: (name: string) => boolean
    ) =>
        told(owner)
            .filter(([name, offered]) => mentions(name) !== offered)
            .map(([name, offered]) =>
                offered ? `${name} is missing` : `${name} is not offered`
            );
    const word = (text: string, name: string) =>
        new RegExp(`\\b${name}\\b`).test(text);

    test.each(["world", "input", "ui", "sound", "console"] as const)(
        "%s.name",
        (owner) => {
            expect(
                strays(owner, (name) => word(brief, `${owner}\\.${name}`))
            ).toEqual([]);
        }
    );

    test("the player and the camera", () => {
        const player = line("world.player:");
        expect(strays("player", (name) => word(player, name))).toEqual([]);
        const camera = line("world.camera:");
        expect(strays("camera", (name) => word(camera, name))).toEqual([]);
    });

    test("a thing's own names", () => {
        expect(
            strays(
                "thing",
                (name) =>
                    word(brief, `thing\\.${name}`) ||
                    brief.includes(`{ ${name},`)
            )
        ).toEqual([]);
    });

    test("an artwork's names", () => {
        const artworks = line("world.artworks:");
        expect(strays("artwork", (name) => word(artworks, name))).toEqual([]);
    });

    test("nothing of models, avatars or doors", () => {
        // A name the model is offered on something else (ui.clear) is not
        // a mention of the model's own (model.clear).
        const offeredSomewhere = new Set(
            (Object.keys(SCRIPT_API) as ScriptApiOwner[]).flatMap((owner) =>
                told(owner)
                    .filter(([, offered]) => offered)
                    .map(([name]) => name)
            )
        );
        for (const owner of ["model", "avatar", "door"] as const)
            for (const [name, offered] of told(owner)) {
                expect(offered).toBe(false);
                if (!offeredSomewhere.has(name))
                    expect(brief).not.toContain(`.${name}(`);
            }
        expect(brief).not.toMatch(/\bdoors?\b/i);
    });

    test("a thing's properties: the offered ones where things are described", () => {
        const section = between("world.add(spec) -> thing", "world.player:");
        expect(section.length).toBeGreaterThan(500);
        const strayed = THING_PROP_KEYS.filter((key) =>
            THING_PROPS[key].briefed
                ? !word(section, key)
                : // never as something to set
                  new RegExp(`\\b${key}:`).test(brief)
        );
        expect(strayed).toEqual([]);
    });

    test("the lists to choose from are the host's own", () => {
        const quoted = (name: string) => `"${name}"`;
        for (const shape of THING_SHAPES)
            expect([shape, brief.includes(quoted(shape))]).toEqual([
                shape,
                !SHAPES_NOT_OFFERED.includes(shape),
            ]);
        for (const name of [
            ...THING_LOOKS,
            ...THING_PATTERNS.filter((pattern) => pattern !== "none"),
            ...SOUND_NAMES,
            ...HUD_CORNERS,
        ])
            expect([name, brief.includes(quoted(name))]).toEqual([name, true]);
        // Avatars are not offered, so neither is what they do.
        for (const motion of AVATAR_MOTIONS.filter((name) => name !== "idle"))
            expect(brief).not.toContain(quoted(motion));
    });

    test("what the script is handed", () => {
        for (const name of ["keep", "wait", "every", "random", "distance"])
            expect(brief).toContain(`${name}(`);
    });
});

/** A value of each property that passes its check as it is. */
const SAMPLES: Record<ThingPropKey, unknown> = {
    shape: "sphere",
    position: [1, 2, 3],
    rotation: [0, 1, 0],
    scale: [2, 2, 2],
    size: [2, 3, 4],
    color: "#ff0000",
    opacity: 0.5,
    glow: true,
    visible: false,
    text: "Hi",
    textColor: "#00ff00",
    background: "#0000ff",
    billboard: false,
    look: "toon",
    pattern: "dots",
    color2: "#123456",
    wobble: 0.25,
    parent: "other",
    profile: [
        [0, 0],
        [1, 1],
    ],
    outline: [
        [0, 0],
        [1, 0],
        [0, 1],
    ],
    depth: 0.5,
    bevel: 0.25,
    points: 7,
    shader: { color: ["mix", "palette0", "#ffcc00", 0.5] },
    solid: true,
    parts: [["box", [0, 0, 0], [1, 1, 1], { color: "#ff0000" }]],
    lamp: {
        at: [0, 2, 0],
        reach: 4,
        warm: [1, 1, 0.5],
        cool: [0.5, 0.5, 0.5],
    },
    boxes: [
        [
            [0, 0, 0],
            [1, 1, 1],
        ],
    ],
    walls: [
        [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
        ],
    ],
    avatar: "sunshine",
    name: "Ada",
    say: "Hello",
    motion: "wave",
};

describe("a thing's properties are one table", () => {
    const of = (ops: any[], op: string) => ops.filter((item) => item.op === op);
    const literal = (value: unknown) => JSON.stringify(value);

    test("every property has a sample here, and its check keeps it", () => {
        expect(Object.keys(SAMPLES).sort()).toEqual(
            [...THING_PROP_KEYS].sort()
        );
        for (const key of THING_PROP_KEYS)
            expect([
                key,
                cleanThingProps({ [key]: SAMPLES[key] })[key],
            ]).toEqual([key, SAMPLES[key]]);
    });

    test("a check refuses what is not its kind, and nothing else gets through", () => {
        // Words are made of whatever is given (a number, a score).
        const words = ["text", "name", "say"];
        for (const key of THING_PROP_KEYS)
            expect([key, cleanThingProps({ [key]: { not: "this" } })]).toEqual([
                key,
                words.includes(key) ? { [key]: "[object Object]" } : {},
            ]);
        expect(
            cleanThingProps({ onclick: "x", constructor: "y", material: {} })
        ).toEqual({});
    });

    test.each(LIVE_KEYS)("%s travels whenever the script changes it", (key) => {
        const script = runScript(
            `const thing = world.add({ id: "t" });
                 input.onKeyDown(() => thing.set({ ${key}: ${literal(
                SAMPLES[key]
            )} }));`
        );
        expect(script.tick()).toEqual([]);
        script.send({ t: "key", down: true, key: "e", code: "KeyE" });
        const [set] = of(script.tick(), "set");
        expect(Object.keys(set.props)).toEqual([key]);
        expect(cleanOps([set]).ops[0]).toEqual({
            op: "set",
            id: "t",
            props: { [key]: SAMPLES[key] },
        });
    });

    test.each(GIVEN_KEYS)(
        "%s travels once, with what the thing was made from",
        (key) => {
            const script = runScript(
                `const thing = world.add({ id: "t", ${key}: ${literal(
                    SAMPLES[key]
                )} });
                 input.onKeyDown(() => { thing.${key} = 1; });`
            );
            const [add] = cleanOps(of(script.ops(), "add")).ops as any[];
            expect(add.props[key]).toEqual(SAMPLES[key]);
            script.send({ t: "key", down: true, key: "e", code: "KeyE" });
            expect(script.tick()).toEqual([]);
        }
    );

    test("the rest travel their own way: the shape, the parent, a model's parts", () => {
        const own = THING_PROP_KEYS.filter(
            (key) => THING_PROPS[key].travels === "own"
        );
        expect(own.sort()).toEqual(["lamp", "parent", "parts", "shape"]);
        const script = runScript(
            `const other = world.add({ id: "other", shape: "sphere" });
             other.add({ id: "part" });
             const model = world.build({ id: "model", lamp: ${literal(
                 SAMPLES.lamp
             )} });
             model.box([0, 0, 0], [1, 1, 1], { color: "#ff0000" });`
        );
        const ops = cleanOps(script.ops()).ops as any[];
        const added = (id: string) =>
            ops.find((op) => op.op === "add" && op.id === id).props;
        expect(added("other").shape).toBe("sphere");
        expect(added("part").parent).toBe("other");
        expect(added("model").shape).toBe("model");
        const built = ops.find((op) => op.op === "set" && op.id === "model");
        expect(built.props.parts).toEqual(SAMPLES.parts);
        expect(built.props.lamp).toEqual(SAMPLES.lamp);
    });

    test("what the SDK sends when a thing is made is all known to the host", () => {
        const script = runScript(
            `world.add(${literal({ id: "t", ...SAMPLES, parent: null })});`
        );
        const [raw] = of(script.ops(), "add");
        const unknown = Object.keys(raw.props).filter(
            (key) => !(key in THING_PROPS)
        );
        expect(unknown).toEqual([]);
    });
});

describe("every request the SDK sends is one the host takes", () => {
    test("each kind of request, sent and accepted", () => {
        const script = runScript(
            `const thing = world.add({ id: "a" });
             world.onUpdate(() => { thing.position.x += 1; });
             thing.add({ id: "b" }).remove();
             world.artworks[0].visible = false;
             world.doors[0].open = 1;
             ui.hud("score", "1", "top");
             ui.clear();
             ui.toast("Hi", 2);
             ui.banner("Go!", 2);
             sound.play("coin", 0.5);
             world.player.moveTo([1, 0, 1]);
             console.log("hello");`,
            { artworks: [ARTWORK], doors: [DOOR] }
        );
        script.tick();
        const sent = script.ops();
        const { ops, dropped } = cleanOps(sent);
        expect(dropped).toBe(0);
        expect([...new Set(ops.map((op) => op.op))].sort()).toEqual([
            "add",
            "artwork",
            "banner",
            "door",
            "hud",
            "hud-clear",
            "log",
            "player",
            "remove",
            "set",
            "sound",
            "toast",
        ]);
    });
});
