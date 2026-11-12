import { LODMesh } from "../../components/_3DExhibit-v2/three/factory/artwork/LODmesh/LODmesh";
import materials from "../../components/_3DExhibit-v2/three/factory/artwork/LODmesh/materials";

jest.mock("@utils/media/upgrades", () => ({
    queueMediaUpgrade: (load, signal) =>
        load(signal || new AbortController().signal),
}));

jest.mock("@3emitter", () => ({}), { virtual: true });
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3camera", () => ({}), { virtual: true });
jest.mock("@3constants", () => ({}), { virtual: true });
jest.mock(
    "@3utils/abort",
    () => ({
        IS_ABORT_ERROR: (e) => e?.name === "AbortError",
        CHECK_ABORT_SIGNAL: jest.fn(),
        combineAbortSignals: (signals) => signals[0],
    }),
    { virtual: true }
);
jest.mock("@3utils/three", () => ({ disposeMaterial: jest.fn() }), {
    virtual: true,
});
jest.mock(
    "../../components/_3DExhibit-v2/three/factory/artwork/LODmesh/artworkmesh",
    () => ({ ArtworkMesh: class {} })
);
jest.mock(
    "../../components/_3DExhibit-v2/three/factory/artwork/LODmesh/materials",
    () => ({ loadMaterial: jest.fn() })
);
jest.mock(
    "../../components/_3DExhibit-v2/three/factory/artwork/LODmesh/materials/loadingmaterial",
    () => ({ LoadingMaterial: class {} })
);
jest.mock("@utils/metadata/reformatAsset", () => ({
    getMediaDimensions: () => ({ width: 2, height: 1, depth: 0.01 }),
}));
function mesh() {
    const m = Object.create(LODMesh.prototype);
    m.lod = {
        hi: { type: "VIDEO_MEDIA", urls: ["movie"] },
        lo: { type: "IMAGE_MEDIA", urls: ["poster"] },
    };
    m.setMaterial = jest.fn();
    m.opts = { item: { data: {} }, roomParameters: {} };
    m.item = m.opts.item;
    m.userData = {};
    return m;
}
beforeEach(() => (materials.loadMaterial as jest.Mock).mockReset());
test("failed video retains its poster without requesting it again every frame", async () => {
    const m = mesh();
    const poster = {};
    (materials.loadMaterial as jest.Mock)
        .mockRejectedValueOnce(new Error("gone"))
        .mockResolvedValueOnce(poster);
    await m.useHiMaterial();
    await m.useHiMaterial();
    expect(m.setMaterial).toHaveBeenCalledWith(poster);
    expect(materials.loadMaterial).toHaveBeenCalledTimes(2);
});
test("broken image thumbnail falls back to a usable high-resolution image", async () => {
    const m = mesh();
    m.lod.hi.type = "IMAGE_MEDIA";
    const original = {};
    (materials.loadMaterial as jest.Mock)
        .mockRejectedValueOnce(new Error("thumbnail gone"))
        .mockResolvedValueOnce(original);
    await m.useLoMaterial();
    expect(m.setMaterial).toHaveBeenCalledWith(original);
    expect(m.lod.lo).toBeNull();
});
test("two broken image sources settle as one artwork failure", async () => {
    const m = mesh();
    m.lod.hi.type = "IMAGE_MEDIA";
    (materials.loadMaterial as jest.Mock).mockRejectedValue(new Error("gone"));
    await expect(m.useHiMaterial()).rejects.toThrow("gone");
    expect(materials.loadMaterial).toHaveBeenCalledTimes(3);
});
test("leaving the space does not start a fallback download", async () => {
    const m = mesh();
    (materials.loadMaterial as jest.Mock).mockRejectedValue(
        Object.assign(new Error("cancel"), { name: "AbortError" })
    );
    await expect(m.useHiMaterial()).rejects.toMatchObject({
        name: "AbortError",
    });
    expect(materials.loadMaterial).toHaveBeenCalledTimes(1);
});

test("initial load displays a preview before starting nearby high-resolution media", async () => {
    const m = mesh();
    m.opts = { item: { data: {} }, roomParameters: {} };
    m.item = m.opts.item;
    m.position = { z: 0 };
    m.useLoMaterial = jest.fn(async () => {
        m.material = { dimensions: { width: 256, height: 128 } };
    });
    m.updateLODFromPosition = jest.fn();
    m.addEvents = jest.fn();
    await m.init();
    expect(m.useLoMaterial).toHaveBeenCalledTimes(1);
    expect(m.updateLODFromPosition).not.toHaveBeenCalled();
    expect(m.addEvents).toHaveBeenCalledTimes(1);
});
