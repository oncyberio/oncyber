/** @jest-environment jsdom */
import { Group, Object3D } from "three";

const mockScene = new (jest.requireActual("three").Group)();
jest.mock("./engine/facade", () => ({
    engineReady: () => true,
    addToScene: (object: any) => mockScene.add(object),
    removeFromScene: (object: any) => mockScene.remove(object),
    sceneColors: () => ({ sky: "#102030" }),
    currentCamera: () => null,
    worldCanvas: () => null,
    mainPlayer: () => null,
    teleport: jest.fn(),
    onMobile: () => false,
    onUpdate: jest.fn(),
    drawEveryFrame: jest.fn(),
    liveArtworks: () => [],
    artworkId: () => "",
    artworkName: () => "",
    artworkType: () => "",
    worldModel: () => null,
    collisionWorld: () => null,
    forgetCollider: () => {},
    DOOR_MESH_NAME: /^Portal_Door_(\d+)$/i,
    portalPlaceholders: () => [],
    assignedPortalIds: () => new Set(),
}));
// The surfaces and the things that are more than a shape have their own
// tests; here, that the parts are put together.
jest.mock("./looks", () => ({
    createLookCache: () => ({
        take: (spec: any) => ({ key: "look", material: { spec } }),
        release: jest.fn(),
        dispose: jest.fn(),
    }),
    resolveLook: (_props: any, style: any) => ({ look: style.look }),
    createOutlineMaterial: () => ({ dispose() {} }),
}));
jest.mock("./engine/models", () => ({ createModel: jest.fn() }));
jest.mock("./engine/avatars", () => ({ createAvatar: jest.fn() }));
jest.mock("./sounds", () => ({ playSound: jest.fn() }));

import { createEngineSink, engineReady } from "./engineAdapter";
import { drawEveryFrame, onUpdate, teleport } from "./engine/facade";
import { playSound } from "./sounds";
import { NEUTRAL_STYLE } from "./style";

function bridge() {
    const stop = jest.fn();
    let frame: (delta: number) => void = () => {};
    (onUpdate as jest.Mock).mockImplementation((run) => {
        frame = run;
        return stop;
    });
    const ui = {
        hud: jest.fn(),
        clearHud: jest.fn(),
        toast: jest.fn(),
        banner: jest.fn(),
    };
    const engine = createEngineSink(ui);
    const group = mockScene.getObjectByName("world-scripts") as Group;
    return { engine, ui, group, stop, frame: (delta: number) => frame(delta) };
}

afterEach(() => {
    mockScene.clear();
    jest.clearAllMocks();
});

describe("the bridge to the engine", () => {
    test("the engine's readiness is the facade's", () => {
        expect(engineReady()).toBe(true);
    });

    test("a script's things are drawn in a group of the real scene", () => {
        const { engine, group } = bridge();
        expect(group.parent).toBe(mockScene);
        engine.sink.addThing("coin", { shape: "sphere", position: [1, 0, 0] });
        engine.sink.setThing("coin", { position: [2, 0, 0] });
        const coin = group.getObjectByName("world-script:coin") as Object3D;
        expect(coin.position.x).toBe(2);
        engine.sink.removeThing("coin");
        expect(group.children).toHaveLength(0);
    });

    test("every frame: glides move, then the script is told", () => {
        const { engine, group, frame } = bridge();
        const seen: number[] = [];
        engine.bind({
            frame: (dt) => {
                const coin = group.getObjectByName("world-script:coin");
                seen.push(coin.position.x, dt);
            },
            key: () => {},
            click: () => {},
        });
        engine.sink.addThing("coin", { shape: "sphere", position: [10, 0, 0] });
        engine.sink.setThing("coin", { position: [0, 0, 0] }, 1);
        frame(2);
        // Already where the glide ends when the script hears of the frame.
        expect(seen).toEqual([0, 2]);
    });

    test("a new style draws what is there again", () => {
        const { engine, group } = bridge();
        engine.sink.addThing("coin", { shape: "sphere" });
        const material = () =>
            (group.getObjectByName("world-script:coin") as any).material;
        expect(material().spec.look).toBe(NEUTRAL_STYLE.look);
        engine.setStyle({ ...NEUTRAL_STYLE, look: "glow" });
        expect(material().spec.look).toBe("glow");
    });

    test("what a script shows and plays goes to the interface and the speakers", () => {
        const { engine, ui } = bridge();
        engine.sink.hud("score", "3", "top");
        engine.sink.toast("Hi", 2);
        engine.sink.banner(null, 0);
        engine.sink.clearHud();
        engine.sink.sound("coin", 0.5);
        engine.sink.movePlayer([1, 2, 3]);
        expect(ui.hud).toHaveBeenCalledWith("score", "3", "top");
        expect(ui.toast).toHaveBeenCalledWith("Hi", 2);
        expect(ui.banner).toHaveBeenCalledWith(null, 0);
        expect(ui.clearHud).toHaveBeenCalled();
        expect(playSound).toHaveBeenCalledWith("coin", 0.5);
        expect(teleport).toHaveBeenCalledWith([1, 2, 3]);
    });

    test("a world with no doors or artworks answers with none, not an error", () => {
        const { engine } = bridge();
        expect(engine.sink.doors()).toEqual([]);
        expect(engine.sink.artworks()).toEqual([]);
        expect(() => engine.sink.setDoor("Portal_Door_1", 1)).not.toThrow();
        expect(() => engine.sink.resetDoors()).not.toThrow();
        expect(engine.colors()).toEqual({ sky: "#102030" });
        expect(engine.sink.view().camera.forward).toEqual([0, 0, -1]);
    });

    test("it draws every frame only while told to, and lets go of everything", () => {
        const { engine, group, stop } = bridge();
        engine.setActive(true);
        expect(drawEveryFrame).toHaveBeenLastCalledWith("world-scripts", true);
        engine.sink.addThing("coin", { shape: "sphere" });
        engine.dispose();
        expect(stop).toHaveBeenCalled();
        expect(drawEveryFrame).toHaveBeenLastCalledWith("world-scripts", false);
        expect(group.parent).toBeNull();
        expect(group.children).toHaveLength(0);
    });
});
