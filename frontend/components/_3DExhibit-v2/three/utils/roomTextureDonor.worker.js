import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "./draco.js";
import { captureRoomTextureRecords } from "./roomTextureUpgrade";

const MAX_DONOR_BYTES = 128 * 1024 * 1024;
const MAX_HEADER_BYTES = 256 * 1024;
const DRACO = "KHR_draco_mesh_compression";
/** The same decoder files the engine's room loader uses (public/draco). */
export const DONOR_DRACO_DECODER_PATH = "/draco/";
const supportedExtensions = new Set([
    // Uploaded worlds compress geometry. Decoding it here, with the engine's
    // own decoder, gives the same vertices the room was matched with.
    DRACO,
    "KHR_materials_unlit",
    "KHR_texture_transform",
    "KHR_mesh_quantization",
    "EXT_mesh_gpu_instancing",
    "KHR_materials_clearcoat",
    "KHR_materials_sheen",
    "KHR_materials_transmission",
    "KHR_materials_volume",
    "KHR_materials_ior",
    "KHR_materials_emissive_strength",
    "KHR_materials_specular",
    "KHR_materials_iridescence",
    "KHR_materials_anisotropy",
]);
const unsupported = () =>
    Object.assign(new Error("Room texture donor export is unsupported"), {
        code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
    });

/** Validate before GLTFLoader can request any external dependency. The only
 * decoder it may load is the site's own Draco decoder, for Draco exports. */
export function validateRoomTextureDonor(data) {
    if (
        !(data instanceof ArrayBuffer) ||
        data.byteLength < 20 ||
        data.byteLength > MAX_DONOR_BYTES
    )
        throw unsupported();
    const header = new DataView(data);
    const jsonBytes = header.getUint32(12, true);
    if (
        header.getUint32(0, true) !== 0x46546c67 ||
        header.getUint32(4, true) !== 2 ||
        header.getUint32(8, true) !== data.byteLength ||
        header.getUint32(16, true) !== 0x4e4f534a ||
        jsonBytes > data.byteLength - 28 ||
        jsonBytes % 4 !== 0
    )
        throw unsupported();
    const json = JSON.parse(
        new TextDecoder().decode(new Uint8Array(data, 20, jsonBytes))
    );
    const binaryOffset = 20 + jsonBytes;
    if (
        header.getUint32(binaryOffset + 4, true) !== 0x004e4942 ||
        header.getUint32(binaryOffset, true) !==
            data.byteLength - binaryOffset - 8 ||
        json.asset?.version !== "2.0" ||
        json.buffers?.length !== 1 ||
        json.buffers[0].uri ||
        !Number.isInteger(json.buffers[0].byteLength) ||
        json.buffers[0].byteLength > data.byteLength - binaryOffset - 8
    )
        throw unsupported();
    for (const name of [
        ...(json.extensionsUsed || []),
        ...(json.extensionsRequired || []),
    ])
        if (!supportedExtensions.has(name)) throw unsupported();
    for (const view of json.bufferViews || []) {
        const offset = view.byteOffset || 0;
        if (
            view.buffer !== 0 ||
            !Number.isInteger(offset) ||
            offset < 0 ||
            !Number.isInteger(view.byteLength) ||
            view.byteLength < 0 ||
            offset + view.byteLength > json.buffers[0].byteLength ||
            view.extensions?.EXT_meshopt_compression
        )
            throw unsupported();
    }
    for (const image of json.images || [])
        if (
            image.uri ||
            !Number.isInteger(image.bufferView) ||
            !json.bufferViews?.[image.bufferView] ||
            !["image/png", "image/jpeg"].includes(image.mimeType)
        )
            throw unsupported();
    const declaresDraco = json.extensionsUsed?.includes(DRACO);
    for (const mesh of json.meshes || [])
        for (const primitive of mesh.primitives || [])
            if (primitive.extensions?.[DRACO] && !declaresDraco)
                throw unsupported();
    for (const texture of json.textures || [])
        if (
            !Number.isInteger(texture.source) ||
            !json.images?.[texture.source] ||
            texture.extensions
        )
            throw unsupported();
    // Native loader uses an unlit emissive map as its diffuse map. The audited
    // exports either omit it or use exactly the same diffuse texture/UV state.
    for (const material of json.materials || [])
        if (
            material.extensions?.KHR_materials_unlit &&
            material.emissiveTexture &&
            JSON.stringify(material.emissiveTexture) !==
                JSON.stringify(material.pbrMetallicRoughness?.baseColorTexture)
        )
            throw unsupported();
    return json;
}

/** Only inspect bounded encoded headers; never decode image pixels here. */
export async function readEncodedImageDimensions(blob) {
    const bytes = new Uint8Array(
        await blob.slice(0, MAX_HEADER_BYTES).arrayBuffer()
    );
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width, height;
    if (
        bytes.length >= 24 &&
        view.getUint32(0) === 0x89504e47 &&
        view.getUint32(4) === 0x0d0a1a0a &&
        view.getUint32(12) === 0x49484452
    ) {
        width = view.getUint32(16);
        height = view.getUint32(20);
    } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 3 < bytes.length) {
            if (bytes[offset++] !== 0xff) throw unsupported();
            while (bytes[offset] === 0xff) offset++;
            const marker = bytes[offset++];
            if (marker === 0xd9 || marker === 0xda) break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
            if (offset + 2 > bytes.length) break;
            const length = view.getUint16(offset);
            if (length < 2 || offset + length > bytes.length) break;
            if (
                [
                    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb,
                    0xcd, 0xce, 0xcf,
                ].includes(marker)
            ) {
                if (length < 8) throw unsupported();
                height = view.getUint16(offset + 3);
                width = view.getUint16(offset + 5);
                break;
            }
            offset += length;
        }
    }
    // Bound the eventual one-image decode, independently of its encoded size.
    if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > 8192 ||
        height > 8192 ||
        width * height > 4096 * 4096
    )
        throw unsupported();
    return { width, height };
}

const textureScalars = [
    "name",
    "mapping",
    "channel",
    "wrapS",
    "wrapT",
    "magFilter",
    "minFilter",
    "anisotropy",
    "rotation",
    "matrixAutoUpdate",
    "premultiplyAlpha",
    "flipY",
    "unpackAlignment",
    "colorSpace",
    "format",
    "type",
    "internalFormat",
    "generateMipmaps",
];
function serializeTexture(texture) {
    const state = {};
    for (const key of textureScalars) state[key] = texture[key];
    for (const key of ["offset", "repeat", "center", "matrix"])
        state[key] = texture[key].toArray();
    const image = texture.source?.data || texture.image;
    if (!image?.encodedBlob) throw unsupported();
    return { state, image };
}

/** The entire high scene parse and geometry signature pass stays in this worker. */
export async function parseRoomTextureDonor(data) {
    const json = validateRoomTextureDonor(data);
    const loader = new GLTFLoader();
    const images = [];
    let imageError, gltf, dracoLoader;
    if (json.extensionsUsed?.includes(DRACO)) {
        // The decoder runs in workers of its own; a browser without nested
        // workers keeps the room's current maps.
        if (typeof Worker === "undefined") throw unsupported();
        dracoLoader = new DRACOLoader()
            .setDecoderConfig({})
            .setDecoderPath(DONOR_DRACO_DECODER_PATH);
        loader.setDRACOLoader(dracoLoader);
    }
    loader.register((parser) => ({
        name: "ONCYBER_lazy_room_texture_images",
        beforeRoot() {
            parser.textureLoader = {
                isImageBitmapLoader: true,
                load(url, onLoad, _progress, onError) {
                    const pending = (async () => {
                        // All images were validated as embedded bufferViews.
                        if (!url.startsWith("blob:")) throw unsupported();
                        const response = await fetch(url);
                        if (!response.ok) throw unsupported();
                        const encodedBlob = await response.blob();
                        const size = await readEncodedImageDimensions(
                            encodedBlob
                        );
                        onLoad({ ...size, encodedBlob });
                    })().catch((error) => {
                        imageError = error;
                        onError(error);
                    });
                    images.push(pending);
                },
            };
        },
    }));
    try {
        gltf = await loader.parseAsync(data, "");
        await Promise.all(images);
        if (imageError) throw imageError;
        const textureIds = new Map(),
            textures = [];
        const records = captureRoomTextureRecords(gltf.scene).map(
            ({ texture, ...record }) => {
                if (!textureIds.has(texture)) {
                    textureIds.set(texture, textures.length);
                    textures.push(serializeTexture(texture));
                }
                return { ...record, textureId: textureIds.get(texture) };
            }
        );
        return { records, textures };
    } finally {
        const materials = new Set(),
            textures = new Set(),
            geometries = new Set();
        for (const scene of gltf?.scenes || [])
            scene.traverse((node) => {
                if (node.geometry) geometries.add(node.geometry);
                const list = Array.isArray(node.material)
                    ? node.material
                    : [node.material];
                for (const material of list)
                    if (material) {
                        materials.add(material);
                        for (const value of Object.values(material))
                            if (value?.isTexture) textures.add(value);
                    }
            });
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        for (const texture of textures) texture.dispose();
        dracoLoader?.dispose();
    }
}

if (typeof self !== "undefined" && typeof document === "undefined") {
    self.onmessage = async ({ data }) => {
        try {
            const result = await parseRoomTextureDonor(data.buffer);
            self.postMessage({ type: "ready", ...result });
        } catch (_) {
            self.postMessage({
                type: "error",
                code: "ROOM_TEXTURE_DONOR_UNSUPPORTED",
            });
        }
    };
}
