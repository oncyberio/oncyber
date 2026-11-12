import GLTF from "./gltf";
import Loader from "@3loader";
import VrmApi from "@api/vrm/_api";
import VRMCompressedCache from "@3utils/vrmcompressedcache.js";

jest.mock("@3loader", () => ({ loadGLTF: jest.fn() }), { virtual: true });
jest.mock("@pixiv/three-vrm", () => ({ VRMUtils: {} }));
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({}));
jest.mock("@3utils/math/mix", () => ({}), { virtual: true });
jest.mock("@api/vrm/_api", () => ({ getCompressedUrl: jest.fn() }), {
    virtual: true,
});
jest.mock(
    "@3utils/vrmcompressedcache.js",
    () => ({ get: jest.fn(), set: jest.fn() }),
    { virtual: true }
);
jest.mock("@utils/gcloud/uploader", () => ({
    BASE_URL: "https://assets.example.test",
}));
jest.mock(
    "@3constants",
    () => ({
        COMPRESSED_SUPPORT: true,
        IS_MOBILE: false,
        CURRENT_USER: { token: "test-token" },
    }),
    { virtual: true }
);

const constants = require("@3constants");
const original = "https://assets.example.test/avatar.vrm";
const compressed = "https://assets.example.test/avatar.compressed.vrm";
let savedFetch;
let savedFormData;

beforeEach(() => {
    jest.clearAllMocks();
    constants.IS_MOBILE = false;
    constants.COMPRESSED_SUPPORT = true;
    Loader.loadGLTF.mockResolvedValue(null);
    VrmApi.getCompressedUrl.mockResolvedValue(compressed);
    VRMCompressedCache.get.mockReturnValue(undefined);
    savedFetch = global.fetch;
    savedFormData = global.FormData;
    global.fetch = jest.fn().mockResolvedValue({});
    global.FormData = class {
        append() {}
    };
    jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    global.fetch = savedFetch;
    global.FormData = savedFormData;
    jest.restoreAllMocks();
});

const load = (url = original) => GLTF.load([{ name: "test-avatar", url }]);
// Avatars keep their downloaded bytes for the bake worker.
const keepBytes = [false, false, false, { keepSourceBytes: true }];

test.each(["vrm", "glb"])(
    "desktop %s reaches the original asset without any compression request",
    async (extension) => {
        // A stalled lookup must not block a desktop avatar load.
        VrmApi.getCompressedUrl.mockImplementation(() => new Promise(() => {}));
        const url = original.replace(/vrm$/, extension);
        await load(url);
        expect(Loader.loadGLTF).toHaveBeenCalledWith(url, ...keepBytes);
        expect(VRMCompressedCache.get).not.toHaveBeenCalled();
        expect(VrmApi.getCompressedUrl).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    }
);

test("desktop ignores a cached compressed URL", async () => {
    VRMCompressedCache.get.mockReturnValue(compressed);
    await load();
    expect(Loader.loadGLTF).toHaveBeenCalledWith(original, ...keepBytes);
    expect(VrmApi.getCompressedUrl).not.toHaveBeenCalled();
});

test("mobile fetches, caches, and loads the compressed avatar", async () => {
    constants.IS_MOBILE = true;
    await load();
    expect(VrmApi.getCompressedUrl).toHaveBeenCalledWith({ url: original });
    expect(VRMCompressedCache.set).toHaveBeenCalledWith(original, compressed);
    expect(Loader.loadGLTF).toHaveBeenCalledWith(compressed, ...keepBytes);
    expect(global.fetch).not.toHaveBeenCalled();
});

test("mobile reuses a compressed cache hit without a lookup", async () => {
    constants.IS_MOBILE = true;
    VRMCompressedCache.get.mockReturnValue(compressed);
    await load();
    expect(VrmApi.getCompressedUrl).not.toHaveBeenCalled();
    expect(Loader.loadGLTF).toHaveBeenCalledWith(compressed, ...keepBytes);
});

test("mobile falls back to the original and requests future compression", async () => {
    constants.IS_MOBILE = true;
    VrmApi.getCompressedUrl.mockResolvedValue(null);
    await load();
    expect(Loader.loadGLTF).toHaveBeenCalledWith(original, ...keepBytes);
    expect(global.fetch).toHaveBeenCalledWith(
        "https://assets.example.test/vrmoptization_ipfs",
        expect.objectContaining({
            method: "POST",
            headers: { "x-token": "test-token" },
        })
    );
    expect(VRMCompressedCache.set).not.toHaveBeenCalled();
});

test("unsupported compression leaves mobile on the original asset", async () => {
    constants.IS_MOBILE = true;
    constants.COMPRESSED_SUPPORT = false;
    await load();
    expect(Loader.loadGLTF).toHaveBeenCalledWith(original, ...keepBytes);
    expect(VrmApi.getCompressedUrl).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});


test("leaving native spaces releases pooled skeleton textures and shared decoded images once", () => {
    const { Group, SkinnedMesh, BoxGeometry, MeshBasicMaterial, Texture, Skeleton, Bone } = require("three");
    for (let visit = 0; visit < 20; visit++) {
        const image = { width: 16, height: 16, close: jest.fn() };
        const map = new Texture(image);
        const material = new MeshBasicMaterial({ map });
        const geometry = new BoxGeometry();
        const scenes = [new Group(), new Group()];
        const skeletonTextures = [];
        for (const scene of scenes) {
            const mesh = new SkinnedMesh(geometry, material);
            const skeleton = new Skeleton([new Bone()]);
            skeleton.computeBoneTexture();
            skeletonTextures.push(skeleton.boneTexture);
            mesh.bind(skeleton);
            scene.add(mesh);
        }
        const releases = [geometry, material, map, ...skeletonTextures].map(resource => jest.spyOn(resource, "dispose"));
        GLTF._isLoading["pooled-avatar"] = false;
        GLTF["pooled-avatar"] = { scene: scenes[0], pool: [{ scene: scenes[1] }] };
        GLTF.releaseSession();
        GLTF.releaseSession();
        releases.forEach(release => expect(release).toHaveBeenCalledTimes(1));
        expect(image.close).toHaveBeenCalledTimes(1);
        expect(GLTF["pooled-avatar"]).toBeNull();
    }
});
