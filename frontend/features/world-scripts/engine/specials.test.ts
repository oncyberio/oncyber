/** @jest-environment node */
import { Object3D } from "three";

const mockModel = { update: jest.fn(), dispose: jest.fn() };
const mockAvatar = { update: jest.fn(), frame: jest.fn(), dispose: jest.fn() };
jest.mock("./models", () => ({ createModel: jest.fn(() => mockModel) }));
jest.mock("./avatars", () => ({ createAvatar: jest.fn(() => mockAvatar) }));
jest.mock("./facade", () => ({
    collisionWorld: () => null,
    forgetCollider: () => {},
    worldModel: () => null,
}));

import { NEUTRAL_STYLE } from "../style";
import { createModel } from "./models";
import { createSpecials, SPECIAL_SHAPES } from "./specials";

function world() {
    const solid: Array<[string, number | null]> = [];
    const opened: Array<[string, unknown]> = [];
    let style = NEUTRAL_STYLE;
    const special = createSpecials({
        looks: { name: "looks" } as any,
        solids: {
            set: (id: string, _holder: Object3D, positions: Float32Array) =>
                void solid.push([id, positions ? positions.length : null]),
            moved: (id: string) => void solid.push([id, -1]),
        } as any,
        openings: {
            set: (id: string, _holder: Object3D, size: unknown) =>
                void opened.push([id, size]),
        } as any,
        style: () => style,
    });
    return { special, solid, opened, restyle: (next: any) => (style = next) };
}

beforeEach(() => jest.clearAllMocks());

describe("things that are more than a shape", () => {
    test("there are four, and anything else is not one", () => {
        expect(SPECIAL_SHAPES).toEqual(["model", "solid", "opening", "avatar"]);
    });

    test("a model is built in the style the world has when it is told", () => {
        const { special, restyle } = world();
        const holder = new Object3D();
        const model = special("stall", holder, "model");
        expect(createModel).toHaveBeenCalledWith("stall", holder, {
            name: "looks",
        });
        const props = { parts: [] };
        model.update(props);
        expect(mockModel.update).toHaveBeenLastCalledWith(props, NEUTRAL_STYLE);
        const neon = { ...NEUTRAL_STYLE, look: "glow" };
        restyle(neon);
        model.update(props);
        expect(mockModel.update).toHaveBeenLastCalledWith(props, neon);
        model.dispose();
        expect(mockModel.dispose).toHaveBeenCalled();
    });

    test("a solid's boxes and walls become what a visitor walks into", () => {
        const { special, solid } = world();
        const fence = special("fence", new Object3D(), "solid");
        fence.update({
            boxes: [
                [
                    [0, 0, 0],
                    [1, 1, 1],
                ],
            ],
        });
        // Five sides of two triangles of three corners of three numbers.
        expect(solid).toEqual([["fence", 5 * 2 * 3 * 3]]);
        fence.moved();
        fence.dispose();
        expect(solid.slice(1)).toEqual([
            ["fence", -1],
            ["fence", null],
        ]);
    });

    test("an opening is cut again when it is resized or moved, not when anything else changes", () => {
        const { special, opened } = world();
        const door = special("door", new Object3D(), "opening");
        door.update({ size: [1, 2, 1] });
        door.update({ size: [1, 2, 1], visible: false });
        expect(opened).toEqual([["door", [1, 2, 1]]]);
        door.update({ size: [2, 2, 1] });
        door.moved();
        expect(opened.slice(1)).toEqual([
            ["door", [2, 2, 1]],
            ["door", [2, 2, 1]],
        ]);
        // No size is a metre each way.
        const hatch = special("hatch", new Object3D(), "opening");
        hatch.update({});
        expect(opened[opened.length - 1]).toEqual(["hatch", [1, 1, 1]]);
        door.dispose();
        expect(opened[opened.length - 1]).toEqual(["door", null]);
    });

    test("an avatar is the engine's own, told and followed each frame", () => {
        const { special } = world();
        const guide = special("guide", new Object3D(), "avatar");
        guide.update({ name: "Ada" });
        guide.frame();
        guide.dispose();
        expect(mockAvatar.update).toHaveBeenCalledWith({ name: "Ada" });
        expect(mockAvatar.frame).toHaveBeenCalled();
        expect(mockAvatar.dispose).toHaveBeenCalled();
    });
});
