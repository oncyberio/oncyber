import { Blob as NodeBlob } from "buffer";
import { cacheStorages } from "./utils/cachestorage";
import { disposeObject3D } from "./utils/three";
import { isBrave } from "@utils/js";

jest.mock(
    "@3utils/draco.js",
    () => ({
        DRACOLoader: class {
            setDecoderConfig() {
                return this;
            }
            setDecoderPath() {
                return this;
            }
        },
    }),
    { virtual: true }
);
jest.mock("three/examples/jsm/loaders/HDRLoader", () => ({
    HDRLoader: class {},
}));
jest.mock("three/examples/jsm/exporters/GLTFExporter", () => {
    mockOptionalImports.exporter();
    return { GLTFExporter: mockGLTFExporter };
});
jest.mock("./loader/GLTFLoader", () => ({
    GLTFLoader: class {
        parse = jest.fn();
        loadAsync = jest.fn();
        setCrossOrigin() {
            return this;
        }
        register() {}
        setDRACOLoader() {}
    },
}));
jest.mock("./constants", () => ({}));
jest.mock("@3utils/patchedvideotexture", () => ({}), { virtual: true });
jest.mock("./utils/cachestorage", () => ({
    cacheStorages: { room: { fetch: jest.fn() } },
}));
jest.mock("./utils/three", () => ({ disposeObject3D: jest.fn() }));
jest.mock("@3mediator", () => ({}), { virtual: true });
jest.mock(
    "@3constants",
    () => ({
        CURRENT_SPACE: {
            roomParameters: {
                uPath: { fileURL: "https://example.com/original.glb" },
            },
        },
    }),
    { virtual: true }
);
jest.mock("@pixiv/three-vrm", () => ({ VRMLoaderPlugin: class {} }));
jest.mock("@3whitelist", () => ({}), { virtual: true });
jest.mock("@utils/urlUtils", () => ({}));
jest.mock("env", () => ({}), { virtual: true });
jest.mock("@3gl/utils/workerpool.js", () => ({}), { virtual: true });
jest.mock("@utils/js", () => ({
    isBrave: jest.fn(async () => false),
    isInIFrame: () => false,
}));
jest.mock("@3scene", () => ({}), { virtual: true });
jest.mock(
    "@3modules/optimiser",
    () => {
        mockOptionalImports.optimiser();
        return { transformRoughness: mockTransformRoughness };
    },
    { virtual: true }
);
jest.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({}));
jest.mock("@3gl/utils/image.worker.js", () => ({}), { virtual: true });
jest.mock("@utils/media/alternatives", () => ({}));

const mockOptionalImports = { optimiser: jest.fn(), exporter: jest.fn() };
const mockTransformRoughness = jest.fn();
const mockExporterParse = jest.fn();
const mockGLTFExporter = jest.fn(() => ({ parse: mockExporterParse }));
// Require after installing the import probes so an accidental eager dependency
// is observed during module initialization, before any user action.
const engine = require("./loader").default;
const optionalImportsOnInit = {
    optimiser: mockOptionalImports.optimiser.mock.calls.length,
    exporter: mockOptionalImports.exporter.mock.calls.length,
};
const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};
const donor = () => ({
    scene: { traverse: jest.fn(), traverseVisible: jest.fn() },
});
let session: AbortController;
let parsed: ReturnType<typeof donor>;
let bytes: jest.Mock;
const originalWindow = (globalThis as any).window;
const originalFetch = globalThis.fetch;
const originalBlob = globalThis.Blob;
beforeEach(() => {
    jest.clearAllMocks();
    globalThis.Blob = NodeBlob as any;
    session = new AbortController();
    engine.sessionSignal = session.signal;
    engine.pendingLoads.clear();
    engine.gltfExporter = null;
    parsed = donor();
    bytes = jest.fn(async () => new ArrayBuffer(4));
    (cacheStorages.room.fetch as jest.Mock).mockImplementation(async () => ({
        ok: true,
        arrayBuffer: bytes,
    }));
    globalThis.fetch = jest.fn(async () => ({
        ok: true,
        arrayBuffer: bytes,
    })) as any;
    (globalThis as any).window = {
        location: { href: "https://oncyber.io/gallery" },
    };
    engine.gltfLoader.parse.mockImplementation((_data, _base, resolve) =>
        resolve(parsed)
    );
    engine.gltfLoader.loadAsync.mockResolvedValue(parsed);
    (isBrave as jest.Mock).mockResolvedValue(false);
});
afterAll(() => {
    globalThis.fetch = originalFetch;
    globalThis.Blob = originalBlob;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
});

test("initializing the engine and loading regular models do not import editing dependencies", async () => {
    expect(optionalImportsOnInit).toEqual({ optimiser: 0, exporter: 0 });
    await expect(engine.loadGLTF("https://example.com/room.glb")).resolves.toBe(
        parsed
    );
    // Even callers requesting legacy conversion should not fetch the optimizer
    // when the parsed asset already uses current materials.
    await expect(
        engine.loadGLTF("https://example.com/room.glb", false, false, true)
    ).resolves.toBe(parsed);
    expect(mockOptionalImports.optimiser).not.toHaveBeenCalled();
    expect(mockOptionalImports.exporter).not.toHaveBeenCalled();
});

test("request signal uses abortable fetch and is unlinked on successful completion", async () => {
    const request = new AbortController();
    const removeRequest = jest.spyOn(request.signal, "removeEventListener");
    const removeSession = jest.spyOn(session.signal, "removeEventListener");
    await expect(
        engine.loadGLTF("https://example.com/room.gltf", false, false, false, {
            signal: request.signal,
        })
    ).resolves.toBe(parsed);
    expect(cacheStorages.room.fetch).toHaveBeenCalledTimes(1);
    expect(engine.gltfLoader.loadAsync).not.toHaveBeenCalled();
    expect(engine.gltfLoader.parse).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        "https://example.com/",
        expect.any(Function),
        expect.any(Function)
    );
    const linked = (cacheStorages.room.fetch as jest.Mock).mock.calls[0][1]
        .signal;
    expect(removeRequest).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(removeSession).toHaveBeenCalledWith("abort", expect.any(Function));
    request.abort();
    session.abort();
    expect(linked.aborted).toBe(false);
    expect(engine.pendingLoads.size).toBe(0);
    expect(disposeObject3D).not.toHaveBeenCalled();
});

test("legacy four-argument non-GLB loading keeps its existing loadAsync path", async () => {
    await expect(
        engine.loadGLTF("https://example.com/room.gltf", false, false, false)
    ).resolves.toBe(parsed);
    expect(engine.gltfLoader.loadAsync).toHaveBeenCalledWith(
        "https://example.com/room.gltf"
    );
    expect(cacheStorages.room.fetch).not.toHaveBeenCalled();
});

test.each(["request", "session"])(
    "%s cancellation aborts the request and detaches both source listeners",
    async (source) => {
        const request = new AbortController();
        const removeRequest = jest.spyOn(request.signal, "removeEventListener");
        const removeSession = jest.spyOn(session.signal, "removeEventListener");
        (cacheStorages.room.fetch as jest.Mock).mockImplementation(
            (_url, { signal }) =>
                new Promise((_resolve, reject) => {
                    signal.addEventListener(
                        "abort",
                        () => reject(new Error("fetch cancelled")),
                        { once: true }
                    );
                })
        );
        const pending = engine.loadGLTF(
            "https://example.com/room.glb",
            false,
            false,
            false,
            { signal: request.signal }
        );
        await flush();
        (source === "request" ? request : session).abort();
        await expect(pending).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
        expect(engine.gltfLoader.parse).not.toHaveBeenCalled();
        expect(removeRequest).toHaveBeenCalledWith(
            "abort",
            expect.any(Function)
        );
        expect(removeSession).toHaveBeenCalledWith(
            "abort",
            expect.any(Function)
        );
        expect(engine.pendingLoads.size).toBe(0);
    }
);

test("cancel after reading bytes does not begin nonabortable decoding", async () => {
    const request = new AbortController();
    bytes.mockImplementation(async () => {
        request.abort();
        return new ArrayBuffer(4);
    });
    await expect(
        engine.loadGLTF("https://example.com/room.glb", false, true, false, {
            signal: request.signal,
        })
    ).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(engine.gltfLoader.parse).not.toHaveBeenCalled();
    expect(disposeObject3D).not.toHaveBeenCalled();
});

test("a decoder completing after cancellation releases its donor scene", async () => {
    const request = new AbortController();
    let complete: (value: unknown) => void;
    engine.gltfLoader.parse.mockImplementation((_data, _base, resolve) => {
        complete = resolve;
    });
    const pending = engine.loadGLTF(
        "https://example.com/room.glb",
        false,
        false,
        false,
        { signal: request.signal }
    );
    await flush();
    expect(complete).toBeDefined();
    request.abort();
    complete(parsed);
    await expect(pending).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
    expect(disposeObject3D).toHaveBeenCalledTimes(1);
    expect(disposeObject3D).toHaveBeenCalledWith(parsed.scene);
});

test("cancellation during async browser detection cannot start a download", async () => {
    const request = new AbortController();
    (isBrave as jest.Mock).mockImplementation(async () => {
        request.abort();
        return false;
    });
    await expect(
        engine.loadGLTF("https://example.com/room.glb", false, false, false, {
            signal: request.signal,
        })
    ).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
    expect(cacheStorages.room.fetch).not.toHaveBeenCalled();
    expect(engine.gltfLoader.parse).not.toHaveBeenCalled();
});

test("a late transformed donor is disposed once and its object URL is revoked", async () => {
    const request = new AbortController();
    const transformed = donor();
    parsed.scene.traverse.mockImplementation((visit) =>
        visit({
            material: {
                userData: {
                    gltfExtensions: { KHR_materials_pbrSpecularGlossiness: {} },
                },
            },
        })
    );
    mockTransformRoughness.mockResolvedValue({});
    let complete: (value: unknown) => void;
    engine.gltfLoader.loadAsync.mockImplementation(
        () =>
            new Promise((resolve) => {
                complete = resolve;
            })
    );
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:donor");
    const revoke = jest.fn();
    URL.revokeObjectURL = revoke;
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
        const pending = engine.loadGLTF(
            "https://example.com/room.glb",
            false,
            false,
            true,
            { signal: request.signal }
        );
        await flush();
        request.abort();
        complete(transformed);
        await expect(pending).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
        expect(disposeObject3D).toHaveBeenCalledTimes(2);
        expect(disposeObject3D).toHaveBeenNthCalledWith(1, parsed.scene);
        expect(disposeObject3D).toHaveBeenNthCalledWith(2, transformed.scene);
        expect(revoke).toHaveBeenCalledWith("blob:donor");
    } finally {
        URL.createObjectURL = previousCreate;
        URL.revokeObjectURL = previousRevoke;
        log.mockRestore();
    }
});

test("requested legacy conversion imports the optimizer and returns the converted model", async () => {
    const transformed = donor();
    const blob = new Blob(["converted model"]);
    parsed.scene.traverse.mockImplementation((visit) =>
        visit({
            material: {
                userData: {
                    gltfExtensions: { KHR_materials_pbrSpecularGlossiness: {} },
                },
            },
        })
    );
    mockTransformRoughness.mockResolvedValue(blob);
    engine.gltfLoader.loadAsync.mockResolvedValue(transformed);
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:converted");
    URL.revokeObjectURL = jest.fn();
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
        await expect(
            engine.loadGLTF(
                "https://example.com/legacy.glb",
                false,
                false,
                true
            )
        ).resolves.toBe(transformed);
        expect(mockTransformRoughness).toHaveBeenCalledWith(
            "https://example.com/legacy.glb"
        );
        expect(engine.gltfLoader.loadAsync).toHaveBeenCalledWith(
            "blob:converted"
        );
        expect(transformed).toHaveProperty("transformedBlob", blob);
        expect(disposeObject3D).toHaveBeenCalledTimes(1);
        expect(disposeObject3D).toHaveBeenCalledWith(parsed.scene);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:converted");
    } finally {
        URL.createObjectURL = previousCreate;
        URL.revokeObjectURL = previousRevoke;
        log.mockRestore();
    }
});

test("export lazily constructs and reuses the exporter, preserving binary data and animations", async () => {
    const result = new ArrayBuffer(8);
    const animations = [{ name: "walk" }];
    (parsed as any).animations = animations;
    mockExporterParse.mockImplementation((_scene, resolve) => resolve(result));
    const save = jest.spyOn(engine, "save").mockImplementation(() => {});
    try {
        await expect(engine.exportGLTF()).resolves.toBe(result);
        expect(mockGLTFExporter).toHaveBeenCalledTimes(1);
        expect(mockExporterParse).toHaveBeenCalledWith(
            parsed.scene,
            expect.any(Function),
            expect.any(Function),
            { binary: true, animations }
        );
        expect(cacheStorages.room.fetch).toHaveBeenCalledWith(
            "https://example.com/original.glb",
            expect.any(Object)
        );
        expect(save).toHaveBeenCalledWith(expect.any(Blob), "whatever.glb");
        expect((save.mock.calls[0][0] as Blob).size).toBe(result.byteLength);
        expect((save.mock.calls[0][0] as Blob).type).toBe(
            "application/octet-stream"
        );
        await expect(engine.exportGLTF()).resolves.toBe(result);
        expect(mockGLTFExporter).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledTimes(2);
    } finally {
        save.mockRestore();
    }
});

test("export forwards exporter callback errors without saving a file", async () => {
    const error = new Error("cannot export material");
    mockExporterParse.mockImplementation((_scene, _resolve, reject) =>
        reject(error)
    );
    const save = jest.spyOn(engine, "save").mockImplementation(() => {});
    try {
        await expect(engine.exportGLTF()).rejects.toBe(error);
        expect(save).not.toHaveBeenCalled();
    } finally {
        save.mockRestore();
    }
});

test("export forwards model-load failures without running the exporter", async () => {
    const error = new Error("original unavailable");
    const load = jest.spyOn(engine, "loadGLTF").mockRejectedValue(error);
    const save = jest.spyOn(engine, "save").mockImplementation(() => {});
    try {
        await expect(engine.exportGLTF()).rejects.toBe(error);
        expect(mockExporterParse).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
    } finally {
        load.mockRestore();
        save.mockRestore();
    }
});

describe("room download started early", () => {
    beforeEach(() => engine.prefetchedModels.clear());

    test("the loader parses the prefetched bytes instead of fetching again", async () => {
        const early = new ArrayBuffer(8);
        bytes.mockResolvedValueOnce(early);
        expect(engine.prefetchModel(" http://example.com/room.glb")).toBe(true);
        // A second request for the same file shares the first download.
        expect(engine.prefetchModel("https://example.com/room.glb")).toBe(true);
        await flush();
        await expect(
            engine.loadGLTF("https://example.com/room.glb", false)
        ).resolves.toBe(parsed);
        expect(cacheStorages.room.fetch).toHaveBeenCalledTimes(1);
        expect(cacheStorages.room.fetch).toHaveBeenCalledWith(
            "https://example.com/room.glb",
            { signal: session.signal }
        );
        expect(engine.gltfLoader.parse.mock.calls[0][0]).toBe(early);
        // The bytes are handed over once; the next load fetches normally.
        expect(engine.prefetchedModels.size).toBe(0);
    });

    test("a failed early download is retried by the load itself", async () => {
        (cacheStorages.room.fetch as jest.Mock).mockRejectedValueOnce(
            new TypeError("Failed to fetch")
        );
        engine.prefetchModel("https://example.com/room.glb");
        await flush();
        await expect(
            engine.loadGLTF("https://example.com/room.glb", false)
        ).resolves.toBe(parsed);
        expect(cacheStorages.room.fetch).toHaveBeenCalledTimes(2);
    });

    test("nothing starts outside a session or for files parsed by URL", () => {
        expect(engine.prefetchModel("https://example.com/room.gltf")).toBe(
            false
        );
        engine.sessionSignal = null;
        expect(engine.prefetchModel("https://example.com/room.glb")).toBe(
            false
        );
        session.abort();
        engine.sessionSignal = session.signal;
        expect(engine.prefetchModel("https://example.com/room.glb")).toBe(
            false
        );
        expect(cacheStorages.room.fetch).not.toHaveBeenCalled();
    });
});

test("an avatar load can keep its downloaded bytes for the bake worker", async () => {
    const downloaded = new ArrayBuffer(16);
    bytes.mockResolvedValueOnce(downloaded);
    const avatar = await engine.loadGLTF(
        "https://example.com/avatar.vrm",
        false,
        false,
        false,
        { keepSourceBytes: true }
    );
    expect(avatar.sourceBytes).toBe(downloaded);
    parsed = donor();
    engine.gltfLoader.parse.mockImplementation((_data, _base, resolve) =>
        resolve(parsed)
    );
    const room = await engine.loadGLTF("https://example.com/room.glb");
    expect(room.sourceBytes).toBeUndefined();
});
