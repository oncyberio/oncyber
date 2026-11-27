/** @jest-environment node */
import {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    Sprite,
    SpriteMaterial,
} from "three";

// The surfaces themselves are ../looks.ts's; here, which one a thing gets.
jest.mock("../looks", () => ({
    resolveLook: jest.fn((props: any, style: any, flat: boolean) => ({
        key: `${props.color || "none"}/${style.look}${flat ? "/flat" : ""}`,
    })),
    createOutlineMaterial: jest.fn(() => ({ dispose: jest.fn() })),
}));
jest.mock("./text", () => ({
    drawText: jest.fn((_props: any, texture: any) => ({
        texture: texture || { made: true },
        aspect: 4,
    })),
}));

import { createOutlineMaterial } from "../looks";
import { NEUTRAL_STYLE } from "../style";
import { drawText } from "./text";
import { createThingLooks } from "./thingLooks";
import type { Thing } from "./things";

function cache() {
    const held = new Map<string, number>();
    return {
        held,
        take(spec: any) {
            held.set(spec.key, (held.get(spec.key) || 0) + 1);
            return { key: spec.key, material: { look: spec.key } };
        },
        release(key: string) {
            held.set(key, held.get(key) - 1);
        },
    } as any;
}

const shape = (props: Thing["props"]): Thing => {
    const geometry = new BoxGeometry();
    return { object: new Mesh(geometry), props, material: null, geometry };
};
const outlined = { ...NEUTRAL_STYLE, outline: true };

describe("how a thing is drawn", () => {
    test("a shape takes the shared look its properties and the style give", () => {
        const looks = cache();
        const drawn = createThingLooks(looks);
        const thing = shape({ shape: "box", color: "#ff0000" });
        drawn.apply(thing, NEUTRAL_STYLE);
        expect(thing.lookKey).toBe("#ff0000/matte");
        expect((thing.object as Mesh).material).toEqual({
            look: "#ff0000/matte",
        });
        // Drawn again in another colour, it gives the old one back.
        thing.props = { ...thing.props, color: "#00ff00" };
        drawn.apply(thing, NEUTRAL_STYLE);
        expect([...looks.held]).toEqual([
            ["#ff0000/matte", 0],
            ["#00ff00/matte", 1],
        ]);
    });

    test("a flat shape is said to be flat", () => {
        const drawn = createThingLooks(cache());
        const thing = shape({ shape: "plane" });
        drawn.apply(thing, NEUTRAL_STYLE);
        expect(thing.lookKey).toBe("none/matte/flat");
    });

    test("a style with outlines gives solid shapes one; see-through and flat ones have none", () => {
        const drawn = createThingLooks(cache());
        const thing = shape({ shape: "box" });
        drawn.apply(thing, outlined);
        expect(thing.outline?.parent).toBe(thing.object);
        expect(thing.outline.visible).toBe(true);
        thing.props = { ...thing.props, opacity: 0.5 };
        drawn.apply(thing, outlined);
        expect(thing.outline.visible).toBe(false);
        const flat = shape({ shape: "ring" });
        drawn.apply(flat, outlined);
        expect(flat.outline).toBeUndefined();
        // A style without them takes it away again.
        drawn.apply(thing, NEUTRAL_STYLE);
        expect(thing.outline).toBeUndefined();
        expect(thing.object.children).toHaveLength(0);
        // One outline material for all of them, let go at the end.
        expect(createOutlineMaterial).toHaveBeenCalledTimes(1);
        const material = (createOutlineMaterial as jest.Mock).mock.results[0]
            .value;
        drawn.dispose();
        expect(material.dispose).toHaveBeenCalled();
    });

    test("text is drawn into its own material, as tall as its size says", () => {
        const drawn = createThingLooks(cache());
        const material = new SpriteMaterial();
        const thing: Thing = {
            object: new Sprite(material),
            props: {
                shape: "text",
                text: "Hi",
                size: [1, 0.5, 1],
                scale: [2, 2, 1],
                opacity: 0.8,
            },
            material,
        };
        drawn.apply(thing, NEUTRAL_STYLE);
        expect(material.map).toEqual({ made: true });
        expect(material.opacity).toBe(0.8);
        // Height 0.5, four times as wide, times the script's own scale.
        expect(thing.object.scale.toArray()).toEqual([4, 1, 1]);
        expect(thing.lookKey).toBeUndefined();
        // Drawn again into the texture it has.
        drawn.apply(thing, NEUTRAL_STYLE);
        expect((drawText as jest.Mock).mock.calls[1][1]).toBe(thing.texture);
    });

    test("what is more than a shape draws itself: it is told, and shown or hidden", () => {
        const drawn = createThingLooks(cache());
        const update = jest.fn();
        const thing: Thing = {
            object: new Mesh(),
            props: { shape: "avatar", visible: false },
            material: new MeshBasicMaterial(),
            special: { update, dispose() {} },
        };
        drawn.apply(thing, NEUTRAL_STYLE);
        expect(update).toHaveBeenCalledWith(thing.props);
        expect(thing.object.visible).toBe(false);
        expect(thing.lookKey).toBeUndefined();
    });

    test("a hidden thing is hidden", () => {
        const drawn = createThingLooks(cache());
        const thing = shape({ shape: "box", visible: false });
        drawn.apply(thing, NEUTRAL_STYLE);
        expect(thing.object.visible).toBe(false);
    });
});
