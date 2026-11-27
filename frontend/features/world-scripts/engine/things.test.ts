/** @jest-environment node */
import { Group, Mesh, Object3D, Sprite } from "three";

jest.mock("./facade", () => ({
    collisionWorld: () => null,
    forgetCollider: () => {},
}));
// What is more than a shape has tests of its own (./specials.test.ts).
jest.mock("./specials", () => ({
    SPECIAL_SHAPES: ["model", "solid", "opening", "avatar"],
}));

import { createGlides } from "./glides";
import { createThings, type Thing } from "./things";

function scene() {
    const group = new Group();
    const calls: string[] = [];
    const solid = new Map<string, number>();
    const solids: any = {
        set(id: string, _holder: Object3D, positions: Float32Array | null) {
            if (positions) solid.set(id, positions.length);
            else solid.delete(id);
        },
        moved: (id: string) => void calls.push(`solid moved ${id}`),
    };
    const glides = createGlides();
    const things = createThings({
        group,
        solids,
        glides,
        draw(thing: Thing) {
            calls.push(`draw ${thing.object.name}`);
            // As the looks do: a shared material the thing does not own.
            if (!thing.special) thing.lookKey = "look";
        },
        releaseLook: (key) => void calls.push(`release ${key}`),
        special(id, _holder, shape) {
            calls.push(`special ${id} ${shape}`);
            return {
                update: () => {},
                moved: () => void calls.push(`special moved ${id}`),
                frame: () => void calls.push(`special frame ${id}`),
                dispose: () => void calls.push(`special gone ${id}`),
            };
        },
    });
    const named = (id: string) => group.getObjectByName(`world-script:${id}`);
    return { group, calls, solid, glides, things, named };
}

describe("a script's things in the scene", () => {
    test("a shape is a mesh in the scripts' group, placed and drawn", () => {
        const { things, group, calls, named } = scene();
        things.add("coin", { shape: "sphere", position: [1, 2, 3] });
        const coin = named("coin") as Mesh;
        expect(coin.parent).toBe(group);
        expect(coin.isMesh).toBe(true);
        expect(coin.position.toArray()).toEqual([1, 2, 3]);
        expect(calls).toEqual(["draw world-script:coin"]);
        expect(things.idOf(coin)).toBe("coin");
        expect(things.size).toBe(1);
    });

    test("text faces the camera unless told not to", () => {
        const { things, named } = scene();
        things.add("label", { shape: "text", text: "Hi" });
        things.add("sign", { shape: "text", text: "Hi", billboard: false });
        expect(named("label")).toBeInstanceOf(Sprite);
        expect(named("sign")).toBeInstanceOf(Mesh);
    });

    test("a part hangs from its thing, and never from itself or its own part", () => {
        const { things, group, named } = scene();
        things.add("npc", { shape: "capsule" });
        things.add("head", { shape: "sphere", parent: "npc" });
        expect(named("head").parent).toBe(named("npc"));
        things.set("npc", { parent: "head" });
        expect(named("npc").parent).toBe(group);
        things.set("head", { parent: null });
        expect(named("head").parent).toBe(group);
        things.add("lost", { shape: "box", parent: "nobody" });
        expect(named("lost").parent).toBe(group);
    });

    test("moving a thing draws nothing again; changing its look does", () => {
        const { things, calls, named } = scene();
        things.add("coin", { shape: "sphere" });
        calls.length = 0;
        things.set("coin", { position: [5, 0, 0], rotation: [0, 1, 0] });
        expect(calls).toEqual([]);
        expect(named("coin").position.x).toBe(5);
        things.set("coin", { color: "#ff0000" });
        things.set("coin", { visible: false });
        things.set("coin", { shader: null });
        expect(calls).toEqual([
            "draw world-script:coin",
            "draw world-script:coin",
            "draw world-script:coin",
        ]);
    });

    test("a text thing is drawn again when it is resized (its scale is its size)", () => {
        const { things, calls } = scene();
        things.add("label", { shape: "text", text: "Hi" });
        calls.length = 0;
        things.set("label", { scale: [2, 2, 2] });
        expect(calls).toEqual(["draw world-script:label"]);
    });

    test("what it is built from changing builds it again, where it was, with its parts", () => {
        const { things, calls, named } = scene();
        things.add("crate", { shape: "box", position: [1, 0, 0] });
        things.add("lid", { shape: "box", parent: "crate" });
        const before = named("crate") as Mesh;
        calls.length = 0;
        things.set("crate", { size: [2, 2, 2] });
        const after = named("crate") as Mesh;
        expect(after).not.toBe(before);
        expect(after.position.toArray()).toEqual([1, 0, 0]);
        expect(named("lid").parent).toBe(after);
        expect(things.idOf(before)).toBeUndefined();
        expect(things.idOf(after)).toBe("crate");
        // The shared look it had was given back, and it was drawn anew.
        expect(calls).toEqual(["release look", "draw world-script:crate"]);
        // The same size again is not a change.
        calls.length = 0;
        things.set("crate", { size: [2, 2, 2] });
        expect(named("crate")).toBe(after);
        expect(calls).toEqual([]);
    });

    test("a rewind glides a thing back, and the script's moves aim the glide", () => {
        const { things, glides, named } = scene();
        things.add("ball", { shape: "sphere", position: [10, 0, 0] });
        things.set("ball", { position: [0, 0, 0] }, 1);
        expect(named("ball").position.x).toBe(10);
        things.set("ball", { position: [0, 4, 0] });
        expect(named("ball").position.x).toBe(10);
        glides.update(2);
        expect(named("ball").position.toArray()).toEqual([0, 4, 0]);
    });

    test("a shape made solid stops a visitor, and moves with the thing", () => {
        const { things, solid, calls } = scene();
        things.add("wall", { shape: "box", solid: true });
        things.add("ring", { shape: "torus", solid: true });
        expect([...solid.keys()]).toEqual(["wall"]);
        things.set("wall", { position: [1, 0, 0] });
        expect(calls).toContain("solid moved wall");
        things.set("wall", { solid: false });
        expect(solid.size).toBe(0);
        things.set("wall", { solid: true });
        things.remove("wall");
        expect(solid.size).toBe(0);
    });

    test("a model, a solid, an opening or an avatar is a holder for what stands behind it", () => {
        const { things, calls, named } = scene();
        things.add("guide", { shape: "avatar", position: [0, 0, 2] });
        expect(named("guide")).toBeInstanceOf(Group);
        expect(calls).toEqual([
            "special guide avatar",
            "draw world-script:guide",
        ]);
        calls.length = 0;
        things.set("guide", { say: "Hello" });
        things.set("guide", { position: [1, 0, 2] });
        // Its size is not a geometry to build again: it is told.
        things.set("guide", { size: [2, 2, 2] });
        things.frame();
        things.remove("guide");
        expect(calls).toEqual([
            "draw world-script:guide",
            "special moved guide",
            "draw world-script:guide",
            "special frame guide",
            "special gone guide",
        ]);
    });

    test("removing a thing leaves a part that outlives it in the group", () => {
        const { things, group, named, calls } = scene();
        things.add("npc", { shape: "capsule" });
        things.add("hat", { shape: "cone", parent: "npc" });
        calls.length = 0;
        things.remove("npc");
        expect(named("npc")).toBeUndefined();
        expect(named("hat").parent).toBe(group);
        expect(calls).toEqual(["release look"]);
        expect(things.size).toBe(1);
        // Changing what is gone is nothing.
        expect(() => things.set("npc", { color: "#fff" })).not.toThrow();
        expect(() => things.remove("npc")).not.toThrow();
    });

    test("a new style draws everything again; the end takes everything away", () => {
        const { things, group, calls } = scene();
        things.add("a", { shape: "box" });
        things.add("b", { shape: "avatar" });
        calls.length = 0;
        things.redraw();
        expect(calls).toEqual(["draw world-script:a", "draw world-script:b"]);
        things.dispose();
        expect(group.children).toHaveLength(0);
        expect(things.size).toBe(0);
        expect(calls).toContain("special gone b");
    });
});
