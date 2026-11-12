import { loadMainPlayerAvatars as prepareAvatars } from "./loadMainPlayerAvatars";
import GLTF from "@3gltf";
import InstanceAvatar3D from "../factory/player/instanceavatarvrm";
import { SET_DEFAULT_VRM } from "../constants";
import { markNativeStartup } from "@utils/nativeStartupDiagnostics";
jest.mock("@3gltf", () => ({ loadOnce: jest.fn(), requestPool: jest.fn() }), {
    virtual: true,
});
jest.mock("../factory/player/instanceavatarvrm", () => ({
    getMesh: jest.fn(),
}));
jest.mock("../factory/player/vrms.json", () => ({
    square: { url: "square.vrm" },
}));
jest.mock("../constants", () => ({
    LOD_VRM: "lod.vrm",
    SET_DEFAULT_VRM: jest.fn(),
}));
jest.mock("@utils/nativeStartupDiagnostics", () => ({
    markNativeStartup: jest.fn(),
}));
const loadMainPlayerAvatars = (opts) =>
    prepareAvatars(opts, {
        models: GLTF,
        avatars: InstanceAvatar3D,
        lodUrl: "lod.vrm",
        fallbackUrl: "square.vrm",
        setDefaultVrm: SET_DEFAULT_VRM,
    });
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
beforeEach(() => {
    jest.clearAllMocks();
    for (const key of ["lod.vrm", "selected.vrm", "square.vrm"])
        delete GLTF[key];
    GLTF.loadOnce.mockReset();
    GLTF.requestPool.mockReset();
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});
test("required LOD and full avatar overlap, readiness takes the longer branch", async () => {
    jest.useFakeTimers();
    GLTF.loadOnce.mockImplementation(
        ({ url }) =>
            new Promise((resolve) => {
                setTimeout(
                    () => {
                        GLTF[url] = {};
                        resolve();
                    },
                    url === "lod.vrm" ? 100 : 200
                );
            })
    );
    let ready = false;
    const pending = loadMainPlayerAvatars({
        userData: { VRM: "selected.vrm" },
    }).then(() => {
        ready = true;
    });
    expect(GLTF.loadOnce.mock.calls.map(([asset]) => asset.url)).toEqual([
        "lod.vrm",
        "selected.vrm",
    ]);
    jest.advanceTimersByTime(100);
    await flush();
    expect(InstanceAvatar3D.getMesh).toHaveBeenCalledWith({
        userData: { VRM: "lod.vrm" },
    });
    expect(ready).toBe(false);
    jest.advanceTimersByTime(100);
    await pending;
    expect(ready).toBe(true);
    expect(markNativeStartup).toHaveBeenCalledWith("avatar-assets-ready");
});
test("cached LOD is reused and a full-quality pooled avatar is reserved before readiness", async () => {
    GLTF["lod.vrm"] = {};
    GLTF.loadOnce.mockImplementation(async ({ url }) => {
        GLTF[url] = { isHighQuality: true };
    });
    const pool = { scene: { poolUsed: false } };
    GLTF.requestPool.mockResolvedValue(pool);
    const opts = { userData: { VRM: "selected.vrm" } };
    await loadMainPlayerAvatars(opts);
    expect(GLTF.loadOnce).toHaveBeenCalledTimes(1);
    expect(InstanceAvatar3D.getMesh).not.toHaveBeenCalled();
    expect(opts.userData.VRMMeshes).toBe(pool);
    expect(pool.scene.poolUsed).toBe(true);
});
test("a broken selected avatar uses the existing square fallback while LOD completes", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    GLTF.loadOnce.mockImplementation(async ({ url }) => {
        if (url === "selected.vrm") throw Error("bad VRM");
        GLTF[url] = {};
    });
    const opts = { userData: { VRM: "selected.vrm" } };
    await loadMainPlayerAvatars(opts);
    expect(opts.userData.VRM).toBe("square.vrm");
    expect(SET_DEFAULT_VRM).toHaveBeenCalledWith("square.vrm");
    expect(GLTF.loadOnce.mock.calls.map(([asset]) => asset.url)).toEqual([
        "lod.vrm",
        "selected.vrm",
        "square.vrm",
    ]);
});
test("fatal failure waits for the other allocation before session cleanup can begin", async () => {
    let finishLod;
    GLTF.loadOnce.mockImplementation(({ url }) => {
        if (url === "square.vrm") return Promise.reject(Error("bad default"));
        return new Promise((resolve) => {
            finishLod = resolve;
        });
    });
    let failed = false;
    const pending = loadMainPlayerAvatars({
        userData: { VRM: "square.vrm" },
    }).catch((error) => {
        failed = true;
        return error;
    });
    await flush();
    expect(failed).toBe(false);
    finishLod();
    expect((await pending).message).toBe("bad default");
    expect(InstanceAvatar3D.getMesh).toHaveBeenCalledTimes(1);
    expect(markNativeStartup).not.toHaveBeenCalledWith("avatar-assets-ready");
});

test("selecting the LOD model reuses its pending load, including failure settlement", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    GLTF.loadOnce.mockImplementation(async ({ url }) => {
        if (url === "lod.vrm") throw Error("bad LOD");
    });
    await expect(
        loadMainPlayerAvatars({ userData: { VRM: "lod.vrm" } })
    ).rejects.toThrow("bad LOD");
    expect(
        GLTF.loadOnce.mock.calls.filter(([asset]) => asset.url === "lod.vrm")
    ).toHaveLength(1);
});
