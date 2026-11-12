jest.mock(
    "@3loader",
    () => ({ __esModule: true, default: { loadGLTFAsset: jest.fn() } }),
    { virtual: true }
);
jest.mock("@3utils/three", () => ({ disposeObject3D: jest.fn() }), {
    virtual: true,
});
import Loader from "@3loader";
import { disposeObject3D } from "@3utils/three";
import { ModelFactoryManager } from "./index";

const opts = { exhibit: { id: "test-world" }, fromEdit: true };
beforeEach(() => jest.clearAllMocks());

test("warm, drag and insertion share one request and retain VRM metadata", async () => {
    const manager = new ModelFactoryManager();
    const model = {
        scene: {},
        animations: [],
        userData: { vrm: { humanoid: {} } },
    };
    Loader.loadGLTFAsset.mockResolvedValue(model);
    const warm = manager.preload("avatar.glb", opts);
    const drag = manager.load("avatar.glb", opts);
    const insertion = manager.load("avatar.glb", opts);
    expect(await warm).toBe(model);
    expect(await drag).toBe(model);
    expect(await insertion).toBe(model);
    expect(Loader.loadGLTFAsset).toHaveBeenCalledTimes(1);
    manager.dispose({}, "avatar.glb", opts);
    expect(disposeObject3D).not.toHaveBeenCalled();
    manager.dispose({}, "avatar.glb", opts);
    expect(disposeObject3D).toHaveBeenCalledTimes(1);
});

test("failed requests reject and can be retried", async () => {
    const manager = new ModelFactoryManager();
    Loader.loadGLTFAsset
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({ scene: {}, animations: [] });
    await expect(manager.preload("avatar.glb", opts)).rejects.toThrow(
        "offline"
    );
    await expect(manager.load("avatar.glb", opts)).resolves.toBeDefined();
    expect(Loader.loadGLTFAsset).toHaveBeenCalledTimes(2);
});

test("unused warm models are bounded while live instances are retained", async () => {
    const manager = new ModelFactoryManager();
    Loader.loadGLTFAsset.mockImplementation(async () => ({
        scene: {},
        animations: [],
    }));
    await manager.load("live.glb", opts);
    for (let index = 0; index < 6; index++)
        await manager.preload(`${index}.glb`, opts);
    expect(Object.keys(manager.map.get("test-world"))).toHaveLength(4);
    expect(manager.map.get("test-world")["live.glb"].count).toBe(1);
});
