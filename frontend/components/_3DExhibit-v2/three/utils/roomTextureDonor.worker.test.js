import { Blob } from "buffer";
import { TextDecoder, TextEncoder } from "util";
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
    GLTFLoader: jest.fn(),
}));
jest.mock("./draco.js", () => ({
    DRACOLoader: jest.fn(function () {
        this.setDecoderConfig = jest.fn(() => this);
        this.setDecoderPath = jest.fn(() => this);
        this.dispose = jest.fn(() => this);
    }),
}));
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "./draco.js";
import {
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshBasicMaterial,
    Texture,
} from "three";
import {
    validateRoomTextureDonor,
    readEncodedImageDimensions,
    parseRoomTextureDonor,
} from "./roomTextureDonor.worker";
function png(width = 2048, height = 1024) {
    const bytes = new Uint8Array(24),
        view = new DataView(bytes.buffer);
    view.setUint32(0, 0x89504e47);
    view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(8, 13);
    view.setUint32(12, 0x49484452);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return new Blob([bytes], { type: "image/png" });
}
function jpeg(width = 3444, height = 1080) {
    return new Blob(
        [
            new Uint8Array([
                0xff,
                0xd8,
                0xff,
                0xe0,
                0,
                4,
                11,
                22,
                0xff,
                0xc2,
                0,
                11,
                8,
                height >> 8,
                height & 255,
                width >> 8,
                width & 255,
                1,
                1,
                0x11,
                0,
                0xff,
                0xd9,
            ]),
        ],
        { type: "image/jpeg" }
    );
}
function glb(change = () => {}) {
    const json = {
        asset: { version: "2.0" },
        buffers: [{ byteLength: 32 }],
        bufferViews: [{ buffer: 0, byteLength: 32 }],
        images: [{ bufferView: 0, mimeType: "image/png" }],
        textures: [{ source: 0 }],
        extensionsUsed: ["KHR_materials_unlit", "EXT_mesh_gpu_instancing"],
    };
    change(json);
    const text = JSON.stringify(json),
        padded = text.padEnd(Math.ceil(text.length / 4) * 4, " ");
    const data = new ArrayBuffer(28 + padded.length + 32),
        view = new DataView(data);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, data.byteLength, true);
    view.setUint32(12, padded.length, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(data, 20, padded.length).set(
        new TextEncoder().encode(padded)
    );
    view.setUint32(20 + padded.length, 32, true);
    view.setUint32(24 + padded.length, 0x004e4942, true);
    return data;
}
test("PNG and progressive JPEG dimensions need no pixel decoding", async () => {
    await expect(readEncodedImageDimensions(png())).resolves.toEqual({
        width: 2048,
        height: 1024,
    });
    await expect(readEncodedImageDimensions(jpeg())).resolves.toEqual({
        width: 3444,
        height: 1080,
    });
});
test("header read is bounded", async () => {
    const blob = png(),
        slice = jest.spyOn(blob, "slice");
    await readEncodedImageDimensions(blob);
    expect(slice).toHaveBeenCalledWith(0, 256 * 1024);
});
test.each([
    new Blob(["not an image"]),
    png(0, 12),
    png(8192, 8192),
    jpeg(0, 10),
])("bad or unsafe headers fail closed", async (image) => {
    await expect(readEncodedImageDimensions(image)).rejects.toMatchObject({
        code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
    });
});
test("embedded images and Wanimal instancing are supported", () => {
    expect(validateRoomTextureDonor(glb()).images).toHaveLength(1);
});
test.each([
    (j) => {
        j.buffers[0].uri = "https://unexpected.test/buffer.bin";
    },
    (j) => {
        j.images[0].uri = "https://unexpected.test/image.png";
    },
    (j) => {
        j.images[0].mimeType = "image/ktx2";
    },
    (j) => {
        // Draco geometry without the declaration the loader decodes by.
        j.meshes = [
            {
                primitives: [
                    { extensions: { KHR_draco_mesh_compression: {} } },
                ],
            },
        ];
    },
    (j) => {
        j.extensionsUsed.push("EXT_meshopt_compression");
    },
    (j) => {
        j.bufferViews[0].byteLength = 33;
    },
    (j) => {
        j.textures[0].extensions = { KHR_texture_basisu: { source: 0 } };
    },
    (j) => {
        j.materials = [
            {
                extensions: { KHR_materials_unlit: {} },
                emissiveTexture: { index: 1 },
                pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
            },
        ];
    },
])(
    "unsupported exports cannot trigger dependencies or ambiguous matching",
    (change) => {
        expect(() => validateRoomTextureDonor(glb(change))).toThrow();
    }
);
test("SpacePod shared unlit diffuse/emissive map stays supported", () => {
    expect(() =>
        validateRoomTextureDonor(
            glb((j) => {
                j.materials = [
                    {
                        extensions: { KHR_materials_unlit: {} },
                        emissiveTexture: { index: 0 },
                        pbrMetallicRoughness: {
                            baseColorTexture: { index: 0 },
                        },
                    },
                ];
            })
        )
    ).not.toThrow();
});
test("truncated GLB fails before parser invocation", () => {
    expect(() => validateRoomTextureDonor(glb().slice(0, 22))).toThrow();
});

test("worker parses headers and hashes geometry without decoding images, then disposes scene", async () => {
    const originalFetch = global.fetch;
    const originalBitmap = global.createImageBitmap;
    global.createImageBitmap = jest.fn(() => {
        throw Error("Pixel decode must stay lazy");
    });
    global.fetch = jest.fn(async () => ({ ok: true, blob: async () => png() }));
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
    );
    geometry.setAttribute(
        "uv",
        new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)
    );
    const disposeGeometry = jest.spyOn(geometry, "dispose");
    let plugin;
    GLTFLoader.mockImplementation(() => ({
        register(callback) {
            plugin = callback;
        },
        async parseAsync() {
            const parser = {};
            plugin(parser).beforeRoot();
            const image = await new Promise((resolve, reject) =>
                parser.textureLoader.load(
                    "blob:embedded",
                    resolve,
                    null,
                    reject
                )
            );
            const map = new Texture(image);
            map.flipY = false;
            const material = new MeshBasicMaterial({ map });
            material.name = "wall";
            const mesh = new Mesh(geometry, material);
            mesh.name = "wall";
            const scene = new Group();
            scene.add(mesh);
            return { scene, scenes: [scene] };
        },
    }));
    try {
        const result = await parseRoomTextureDonor(glb());
        expect(result.textures).toHaveLength(1);
        expect(result.textures[0].image.encodedBlob).toBeInstanceOf(Blob);
        expect(result.records[0]).toMatchObject({
            path: "/wall",
            slot: "map",
            textureId: 0,
        });
        expect(result.records[0].geometry).toMatch(/^3:/);
        expect(global.createImageBitmap).not.toHaveBeenCalled();
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
    } finally {
        global.fetch = originalFetch;
        global.createImageBitmap = originalBitmap;
    }
});

describe("Draco exports (every uploaded world)", () => {
    const draco = (j) => {
        j.extensionsUsed.push("KHR_draco_mesh_compression");
        j.extensionsRequired = ["KHR_draco_mesh_compression"];
        j.meshes = [
            {
                primitives: [
                    {
                        attributes: {},
                        extensions: { KHR_draco_mesh_compression: {} },
                    },
                ],
            },
        ];
    };
    const originalWorker = global.Worker;
    afterEach(() => {
        global.Worker = originalWorker;
    });

    test("are accepted when they declare the extension", () => {
        expect(() => validateRoomTextureDonor(glb(draco))).not.toThrow();
    });

    test("are decoded with the site's own decoder, which is then released", async () => {
        global.Worker = function () {};
        let setDRACOLoader;
        GLTFLoader.mockImplementation(() => ({
            register() {},
            setDRACOLoader: (setDRACOLoader = jest.fn()),
            async parseAsync() {
                const scene = new Group();
                return { scene, scenes: [scene] };
            },
        }));
        await expect(parseRoomTextureDonor(glb(draco))).resolves.toEqual({
            records: [],
            textures: [],
        });
        const decoder = DRACOLoader.mock.instances.at(-1);
        expect(setDRACOLoader).toHaveBeenCalledWith(decoder);
        expect(decoder.setDecoderPath).toHaveBeenCalledWith("/draco/");
        expect(decoder.dispose).toHaveBeenCalledTimes(1);
    });

    test("without workers in the worker, the room keeps its maps", async () => {
        delete global.Worker;
        GLTFLoader.mockImplementation(() => ({ register() {} }));
        await expect(parseRoomTextureDonor(glb(draco))).rejects.toMatchObject({
            code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
        });
    });

    test("files without Draco never load the decoder", async () => {
        DRACOLoader.mockClear();
        GLTFLoader.mockImplementation(() => ({
            register() {},
            async parseAsync() {
                const scene = new Group();
                return { scene, scenes: [scene] };
            },
        }));
        await parseRoomTextureDonor(glb());
        expect(DRACOLoader).not.toHaveBeenCalled();
    });
});
