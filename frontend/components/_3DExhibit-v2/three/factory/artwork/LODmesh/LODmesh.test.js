jest.mock(
    "@3emitter",
    () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }),
    { virtual: true }
);
jest.mock(
    "@3events",
    () => ({ __esModule: true, default: { POST_UPDATE: "post" } }),
    { virtual: true }
);
jest.mock(
    "@3camera",
    () => ({
        __esModule: true,
        default: { current: { position: { x: 0, y: 0, z: 0 } } },
    }),
    { virtual: true }
);
jest.mock(
    "@3constants",
    () => ({ MAX_PLAY_DISTANCE_SQ: 100, MAX_HI_IMAGE_DISTANCE_SQ: 100 }),
    { virtual: true }
);
jest.mock("@3utils/abort", () => jest.requireActual("../../../utils/abort"), {
    virtual: true,
});
jest.mock(
    "@3utils/three",
    () => ({ disposeMaterial: jest.fn((material) => material?.dispose?.()) }),
    { virtual: true }
);
jest.mock("./artworkmesh", () => {
    const { Mesh } = require("three");
    return {
        ArtworkMesh: class extends Mesh {
            constructor(opts) {
                super(opts.geometry, opts.material);
            }
            dispose() {
                this.wasDisposed = true;
            }
        },
    };
});
jest.mock("./materials", () => ({
    __esModule: true,
    default: { loadMaterial: jest.fn() },
}));
jest.mock("./materials/loadingmaterial", () => {
    const { MeshBasicMaterial } = require("three");
    return {
        LoadingMaterial: class extends MeshBasicMaterial {
            constructor() {
                super();
                this.dimensions = { width: 1600, height: 900 };
                this.isLoadingMaterial = true;
            }
        },
    };
});
jest.mock("@utils/media/upgrades", () => ({
    queueMediaUpgrade: jest.fn((load, signal) => load(signal)),
}));
jest.mock("@utils/metadata/reformatAsset", () => ({
    getMediaDimensions: ({ width, height }) => ({
        width: 2,
        height: (2 * height) / width,
        depth: 0.1,
    }),
}));

import { MeshBasicMaterial, PlaneGeometry, Group } from "three";
import Loader from "./materials";
import { LODMesh } from "./LODmesh";
import { disposeMaterial } from "@3utils/three";

function makeMesh(lo = null, type = "VIDEO_MEDIA") {
    return new LODMesh({
        geometry: new PlaneGeometry(),
        material: new MeshBasicMaterial(),
        materialParams: {},
        item: {
            data: { dimensions: [1600, 900] },
            position: { x: 0, y: 0, z: 0 },
        },
        roomParameters: {},
        lod: { hi: { type, urls: ["movie"] }, lo },
    });
}
function media(width = 1600, height = 900) {
    const value = new MeshBasicMaterial();
    value.dimensions = { width, height };
    return value;
}
function pending() {
    let resolve;
    return {
        promise: new Promise((r) => {
            resolve = r;
        }),
        resolve: (value) => resolve(value),
    };
}
beforeEach(() => jest.clearAllMocks());

test("posterless videos show the Oncyber loader without waiting for video bytes", async () => {
    const mesh = makeMesh();
    await mesh.init();
    expect(Loader.loadMaterial).not.toHaveBeenCalled();
    expect(mesh.material.isLoadingMaterial).toBe(true);
    expect(mesh.enabled).toBe(true);
    await mesh.updateLODFromPosition({ x: 100, y: 0, z: 100 });
    expect(Loader.loadMaterial).not.toHaveBeenCalled();
    mesh.dispose();
});

test("a broken poster leaves an immediate loader instead of fetching the movie in the initial slot", async () => {
    Loader.loadMaterial.mockRejectedValueOnce(new Error("poster missing"));
    const mesh = makeMesh({ type: "IMAGE_MEDIA", urls: ["poster"] });
    await mesh.init();
    expect(Loader.loadMaterial).toHaveBeenCalledTimes(1);
    expect(mesh.material.isLoadingMaterial).toBe(true);
    mesh.dispose();
});

test("a small poster precedes the queued movie and stays visible until it loads", async () => {
    const poster = media(),
        movie = media();
    const waiting = pending();
    Loader.loadMaterial
        .mockResolvedValueOnce(poster)
        .mockReturnValueOnce(waiting.promise);
    const mesh = makeMesh({ type: "IMAGE_MEDIA", urls: ["poster"] });
    await mesh.init();
    expect(mesh.material).toBe(poster);
    const loading = mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    expect(mesh.material).toBe(poster);
    waiting.resolve(movie);
    await loading;
    expect(mesh.material).toBe(movie);
    mesh.dispose();
});

test("moving out and back while a movie loads does not enqueue duplicate decoders", async () => {
    const waiting = pending(),
        movie = media();
    Loader.loadMaterial.mockReturnValue(waiting.promise);
    const mesh = makeMesh();
    await mesh.init();
    const first = mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    await mesh.updateLODFromPosition({ x: 100, y: 0, z: 100 });
    const second = mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    expect(Loader.loadMaterial).toHaveBeenCalledTimes(1);
    waiting.resolve(movie);
    await Promise.all([first, second]);
    expect(mesh.material).toBe(movie);
    mesh.dispose();
});

test("late video completion after leaving disposes the decoded material", async () => {
    const waiting = pending(),
        movie = media();
    Loader.loadMaterial.mockReturnValue(waiting.promise);
    const mesh = makeMesh();
    await mesh.init();
    const loading = mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    mesh.dispose();
    waiting.resolve(movie);
    await expect(loading).rejects.toThrow();
    expect(disposeMaterial).toHaveBeenCalledWith(movie);
    expect(mesh.hiMaterial).toBeNull();
});

test("decoded dimensions resize an unknown-ratio movie and its existing border", async () => {
    const mesh = makeMesh();
    await mesh.init();
    const artwork = new Group();
    artwork.mesh = mesh;
    artwork.setBorder = jest.fn();
    artwork.updateBorderInstance = jest.fn();
    artwork.add(mesh);
    Loader.loadMaterial.mockResolvedValue(media(900, 1600));
    await mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    expect(mesh.geometry.parameters.height).toBeCloseTo((2 * 1600) / 900);
    expect(artwork.setBorder).toHaveBeenCalledTimes(1);
    expect(artwork.updateBorderInstance).toHaveBeenCalledTimes(1);
    mesh.dispose();
});

test("failed movies retain their placeholder without a request on every frame", async () => {
    Loader.loadMaterial.mockRejectedValue(new Error("movie missing"));
    const mesh = makeMesh();
    await mesh.init();
    await mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    await mesh.updateLODFromPosition({ x: 0, y: 0, z: 0 });
    expect(mesh.material.isLoadingMaterial).toBe(true);
    expect(Loader.loadMaterial).toHaveBeenCalledTimes(1);
    mesh.dispose();
});

test("a settled artwork does no async work per frame; crossing the distance switches it", async () => {
    const poster = media(),
        image = media();
    Loader.loadMaterial
        .mockResolvedValueOnce(poster)
        .mockResolvedValueOnce(image);
    const mesh = makeMesh(
        { type: "IMAGE_MEDIA", urls: ["poster"] },
        "IMAGE_MEDIA"
    );
    mesh.position.set(1000, 0, 1000);
    mesh.updateMatrixWorld();
    await mesh.init();
    expect(mesh.state).toBe("lo");
    const update = jest.spyOn(mesh, "updateLODFromPosition");

    // far away, already on the small image, nothing to release
    for (let frame = 0; frame < 60; frame++) mesh.postUpdate();
    expect(update).not.toHaveBeenCalled();

    // the visitor walks up to it
    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld();
    mesh.postUpdate();
    expect(update).toHaveBeenCalledTimes(1);
    await update.mock.results[0].value;
    expect(mesh.material).toBe(image);
    for (let frame = 0; frame < 60; frame++) mesh.postUpdate();
    expect(update).toHaveBeenCalledTimes(1);

    // walking far away again releases the full-size image once
    mesh.position.set(1000, 0, 1000);
    mesh.updateMatrixWorld();
    mesh.postUpdate();
    await update.mock.results[1].value;
    expect(mesh.material).toBe(poster);
    expect(mesh.hiMaterial).toBeNull();
    for (let frame = 0; frame < 60; frame++) mesh.postUpdate();
    expect(update).toHaveBeenCalledTimes(2);
    mesh.dispose();
});
