/** @jest-environment node */
import { Color, Object3D, Vector3 } from "three";

// The engine cannot be loaded in a test; these stand where its modules
// are, with only what the facade is said to use (./facade.contract.test.ts
// holds the real engine to the same names).
const mockScene: any = { add: jest.fn(), remove: jest.fn() };
const mockCamera: any = {};
const mockPlayers: any = {};
const mockRoot: any = {};
const mockGltf: any = {};
const mockEmitter: any = { on: jest.fn(), off: jest.fn() };
const mockConstants: any = {
    CANVAS: null,
    CURRENT_SPACE: null,
    DEFAULT_PLAYER_AVATAR_PICTURE: "picture.png",
    IS_MOBILE: false,
    APP_STATES: { INTRO: "INTRO", IDLE: "IDLE" },
    CURRENT_STATE: "INTRO",
};
const mockDemand = { setContinuous: jest.fn() };

jest.mock("@3/three/scene", () => mockScene, { virtual: true });
jest.mock("@3/three/camera", () => mockCamera, { virtual: true });
jest.mock("@3/three/factory/player", () => mockPlayers, { virtual: true });
jest.mock("@3/three/root", () => mockRoot, { virtual: true });
jest.mock("@3/three/gltf", () => mockGltf, { virtual: true });
jest.mock(
    "@3/three/factory/player/vrms.json",
    () => ({ sunshine: { url: "sunshine.vrm" } }),
    { virtual: true }
);
jest.mock("@3/three/events/emitter", () => mockEmitter, { virtual: true });
jest.mock("@3/three/events/events", () => ({ UPDATE: "update" }), {
    virtual: true,
});
jest.mock("@3/three/constants", () => mockConstants, { virtual: true });
jest.mock(
    "@3/three/factory/player/constants",
    () => ({ UPDATE_CHAT: "CHAT", UPDATE_USERNAME: "NAME" }),
    { virtual: true }
);
jest.mock("@3/three/utils/renderDemand", () => ({ RenderDemand: mockDemand }), {
    virtual: true,
});

// Loaded after the stand-ins above exist (an import would come first).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const engine: typeof import("./facade") = require("./facade");

const clear = (object: Record<string, unknown>) =>
    Object.keys(object).forEach((key) => delete object[key]);

beforeEach(() => {
    jest.clearAllMocks();
    for (const object of [mockCamera, mockPlayers, mockRoot, mockGltf])
        clear(object);
    clear(mockScene);
    Object.assign(mockScene, { add: jest.fn(), remove: jest.fn() });
    Object.assign(mockConstants, { CANVAS: null, CURRENT_SPACE: null });
});

describe("whether the world is showing", () => {
    test("a scene on the page is a world; none is not", () => {
        expect(engine.worldHasScene({ scene: {} })).toBe(true);
        expect(engine.worldHasScene({})).toBe(false);
        expect(engine.worldHasScene(undefined)).toBe(false);
    });

    test("ready takes a player, a camera, a canvas and the end of the loading animation", () => {
        expect(engine.engineReady()).toBe(false);
        mockPlayers.main = {};
        mockCamera.current = {};
        expect(engine.engineReady()).toBe(false);
        mockConstants.CANVAS = {};
        // Everything is in place, but the world is still loading behind
        // its stars: a script would build its things on that thread.
        expect(engine.engineReady()).toBe(false);
        mockConstants.CURRENT_STATE = "IDLE";
        expect(engine.engineReady()).toBe(true);
    });
});

describe("the scene, the camera and the visitor", () => {
    test("things are put in and taken out of the one scene", () => {
        const object = new Object3D();
        engine.addToScene(object);
        engine.removeFromScene(object);
        expect(mockScene.add).toHaveBeenCalledWith(object);
        expect(mockScene.remove).toHaveBeenCalledWith(object);
    });

    test("sky and fog are told as colours, where the world has them", () => {
        expect(engine.sceneColors()).toEqual({
            sky: undefined,
            fog: undefined,
        });
        mockScene.background = new Color("#102030");
        mockScene.fog = { color: new Color("#ffffff") };
        expect(engine.sceneColors()).toEqual({
            sky: "#102030",
            fog: "#ffffff",
        });
        // A sky that is a texture is not a colour.
        mockScene.background = { isTexture: true };
        expect(engine.sceneColors().sky).toBeUndefined();
    });

    test("no camera, canvas or player yet is null, not an error", () => {
        expect(engine.currentCamera()).toBeNull();
        expect(engine.worldCanvas()).toBeNull();
        expect(engine.mainPlayer()).toBeNull();
    });

    test("the visitor is put where asked; a refusal is not an error", () => {
        mockRoot.teleport = jest.fn();
        engine.teleport([1, 2, 3]);
        expect(mockRoot.teleport).toHaveBeenCalledWith({
            position: { x: 1, y: 2, z: 3 },
        });
        mockRoot.teleport = () => {
            throw new Error("travelling");
        };
        expect(() => engine.teleport([0, 0, 0])).not.toThrow();
    });
});

describe("frames", () => {
    test("a listener is on the engine's update, and comes off", () => {
        const run = jest.fn();
        const stop = engine.onUpdate(run);
        expect(mockEmitter.on).toHaveBeenCalledWith("update", run);
        stop();
        expect(mockEmitter.off).toHaveBeenCalledWith("update", run);
    });

    test("drawing every frame is asked for by name", () => {
        engine.drawEveryFrame("world-scripts", true);
        expect(mockDemand.setContinuous).toHaveBeenCalledWith(
            "world-scripts",
            true
        );
    });
});

describe("artworks", () => {
    test("the space's artworks, or none when there is no world to ask", () => {
        expect(engine.liveArtworks()).toEqual([]);
        const artwork = new Object3D();
        mockRoot.getArtworks = () => [artwork];
        expect(engine.liveArtworks()).toEqual([artwork]);
        mockRoot.getArtworks = () => {
            throw new Error("between spaces");
        };
        expect(engine.liveArtworks()).toEqual([]);
    });

    test("an artwork goes by its saved id, then its item's, then the object's", () => {
        expect(engine.artworkId({ data: { id: "a" }, uuid: "u" })).toBe("a");
        expect(engine.artworkId({ item: { id: 7 }, uuid: "u" })).toBe("7");
        expect(engine.artworkId({ uuid: "u" })).toBe("u");
        expect(engine.artworkId(undefined)).toBe("");
        expect(engine.artworkName({ data: { name: "Stars" } })).toBe("Stars");
        expect(engine.artworkName({})).toBe("");
        expect(engine.artworkType({ mediaType: "video" })).toBe("video");
        expect(engine.artworkType({ data: { type: "image" } })).toBe("image");
    });
});

describe("the world's model and what is walked on", () => {
    test("the model on show, or null between spaces", () => {
        expect(engine.worldModel()).toBeNull();
        const model = new Object3D();
        mockRoot.currentSpace = { scene: { spaceScene: model } };
        expect(engine.worldModel()).toBe(model);
    });

    test("the collision world is the visitor's controls' own", () => {
        expect(engine.collisionWorld()).toBeNull();
        const worldOctree = {};
        mockCamera.currentControls = { world: { collisions: { worldOctree } } };
        expect(engine.collisionWorld()).toBe(worldOctree);
        // Controls that walk on nothing (a fixed camera).
        mockCamera.currentControls = { world: {} };
        expect(engine.collisionWorld()).toBeNull();
    });

    test("a mesh's collider is forgotten where the engine keeps it", () => {
        const mesh: any = { userData: { _collider: {} } };
        engine.forgetCollider(mesh);
        expect(mesh.userData._collider).toBeNull();
    });
});

describe("doors and portals", () => {
    test("a door is a group named by its number", () => {
        expect(engine.DOOR_MESH_NAME.test("Portal_Door_12")).toBe(true);
        expect(engine.DOOR_MESH_NAME.test("Portal_Mesh_12")).toBe(false);
        expect(engine.DOOR_MESH_NAME.test("Portal_Door_12_frame")).toBe(false);
    });

    test("placeholders and the portals the space made of them", () => {
        expect(engine.portalPlaceholders()).toEqual([]);
        expect(engine.assignedPortalIds().size).toBe(0);
        const door = new Object3D();
        const preview = new Object3D();
        mockRoot.currentSpace = {
            portalPlaceholders: [
                {
                    portalId: "p1",
                    meshes: { portalDoor: door, previewMesh: preview },
                },
                { portalId: "p2" },
            ],
        };
        mockConstants.CURRENT_SPACE = {
            exhibit: { portals: { a: { id: "p1" }, b: null } },
        };
        expect(engine.portalPlaceholders()).toEqual([
            { portalId: "p1", door, preview },
            { portalId: "p2", door: null, preview: null },
        ]);
        expect(engine.assignedPortalIds().has("p1")).toBe(true);
    });
});

describe("avatars", () => {
    test("a file is loaded once", async () => {
        mockGltf.loadOnce = jest.fn(async ({ name }: any) => {
            mockGltf[name] = {};
        });
        await engine.loadAvatarFile("a.vrm");
        await engine.loadAvatarFile("a.vrm");
        expect(mockGltf.loadOnce).toHaveBeenCalledTimes(1);
        expect(engine.avatarCatalogue().sunshine.url).toBe("sunshine.vrm");
    });

    test("only an avatar with moving hair and cloth is taken from the pool", async () => {
        mockGltf.requestPool = jest.fn(async () => ({ scene: {} }));
        mockGltf["plain.vrm"] = {};
        mockGltf["fine.vrm"] = { isHighQuality: true };
        expect(await engine.requestPooledAvatar("plain.vrm")).toBeUndefined();
        expect(await engine.requestPooledAvatar("fine.vrm")).toEqual({
            scene: {},
        });
        expect(mockGltf.requestPool).toHaveBeenCalledTimes(1);
    });

    function stand(pooled?: any) {
        const npc: any = {
            position: new Vector3(),
            rotation: { y: 0 },
            username: { wrapper: { position: { y: 0 } } },
            avatar3D: {},
            scaleVRM: jest.fn(),
            updatePlayer: jest.fn(),
            handleSit: jest.fn(),
            playEmote: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
        };
        mockPlayers.main = { modelScale: 1.4 };
        mockPlayers.get = jest.fn(() => npc);
        mockConstants.CURRENT_SPACE = { exhibit: { id: "space-1" } };
        const avatar = engine.standAvatar({
            url: "a.vrm",
            pooled,
            name: "Guide",
            key: "script-avatar-1",
            position: new Vector3(1, 0, 2),
            yaw: 0.5,
        });
        return { npc, avatar };
    }

    test("it stands as a player that belongs to no one, as tall as the visitors", () => {
        const pooled = { scene: { poolUsed: false } };
        const { npc } = stand(pooled);
        const made = mockPlayers.get.mock.calls[0][0];
        expect(made).toMatchObject({
            isDummy: true,
            sessionId: "script-avatar-1",
            exhibit: { id: "space-1" },
            rotation: 0.5,
            userData: {
                username: "Guide",
                VRM: "a.vrm",
                avatar: "picture.png",
                VRMMeshes: pooled,
            },
        });
        expect(made.position.toArray()).toEqual([1, 0, 2]);
        // Taken from the pool only now that it is used.
        expect(pooled.scene.poolUsed).toBe(true);
        expect(mockScene.add).toHaveBeenCalledWith(npc);
        expect(npc.visible).toBe(true);
        expect(npc.scaleVRM).toHaveBeenCalledWith(1.4);
        expect(npc.username.wrapper.ignoreLOD).toBe(true);
        expect(npc.avatar3D.ignoreLOD).toBe(true);
    });

    test("it is named, moved, shown and made to speak the engine's way", () => {
        const { npc, avatar } = stand();
        avatar.setName("Ada");
        expect(npc.updatePlayer).toHaveBeenLastCalledWith({
            type: "NAME",
            payload: "Ada",
            textOnly: true,
        });
        avatar.setMotion(true, 12);
        expect(npc.handleSit).toHaveBeenCalledWith(true);
        expect(npc.playEmote).toHaveBeenCalledWith(12);
        avatar.setShown(false);
        avatar.setShown(true);
        expect(npc.hide).toHaveBeenCalledTimes(1);
        expect(npc.show).toHaveBeenCalledTimes(1);
        avatar.place(new Vector3(4, 5, 6), 1);
        expect(npc.position.toArray()).toEqual([4, 5, 6]);
        expect(npc.rotation.y).toBe(1);
        // Its label is not placed yet: nothing is said, and it says so.
        expect(avatar.say("Hello")).toBe(false);
        npc.username.wrapper.position.y = 2;
        expect(avatar.say("Hello")).toBe(true);
        expect(npc.updatePlayer).toHaveBeenLastCalledWith({
            type: "CHAT",
            payload: { text: "Hello", date: "", acc_date: "" },
        });
    });

    test("it leaves the scene, even when the engine let its players go first", () => {
        const { npc, avatar } = stand();
        avatar.remove();
        expect(mockScene.remove).toHaveBeenCalledWith(npc);
        expect(npc.dispose).toHaveBeenCalled();
        npc.dispose = () => {
            throw new Error("gone");
        };
        expect(() => avatar.remove()).not.toThrow();
    });
});
