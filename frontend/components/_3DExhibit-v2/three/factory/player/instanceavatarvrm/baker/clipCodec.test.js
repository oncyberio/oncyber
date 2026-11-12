import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import { Blob } from "buffer";
import * as THREE from "three";
import {
    AVATAR_CLIPS_VERSION,
    decodeAvatarClips,
    encodeAvatarClips,
    isAvatarClipContainer,
    readAvatarClipHeader,
} from "./clipCodec";

// The worker's bake, run here on the CPU: the real packer, no lobby clips
// (they do not come from compute2.json), the worker's glTF loader.
jest.mock(
    "@3utils/packer.js",
    () => jest.requireActual("../../../../utils/packer.js"),
    { virtual: true }
);
jest.mock("../lobbyMotionClips", () => ({
    prepareNativeLobbyClips: async () => undefined,
}));

const SOURCE = path.join(__dirname, "animations/compute2.json");
const PACKED = path.join(__dirname, "animations/compute2.bin");
const json = fs.readFileSync(SOURCE);
const JSON_CLIPS = JSON.parse(json.toString("utf8"));
const container = gunzipSync(fs.readFileSync(PACKED));

const float32Hex = (values) =>
    Buffer.from(Float32Array.from(values).buffer).toString("hex");

test("the shipped file is packed from the current compute2.json", () => {
    const { header } = readAvatarClipHeader(container);
    expect(header.version).toBe(AVATAR_CLIPS_VERSION);
    // If this fails: node frontend/scripts/pack-avatar-clips.mjs
    expect(header.source.sha256).toBe(
        createHash("sha256").update(json).digest("hex")
    );
    expect(
        Buffer.from(encodeAvatarClips(JSON_CLIPS, { source: header.source }))
    ).toEqual(container);
});

test("decoding gives three exactly the numbers it reads from the JSON", () => {
    const decoded = decodeAvatarClips(container);
    expect(decoded).toHaveLength(JSON_CLIPS.length);
    decoded.forEach((clip, c) => {
        const source = JSON_CLIPS[c];
        expect(clip.name).toBe(source.name);
        expect(Object.is(clip.duration, source.duration)).toBe(true);
        expect(clip.uuid).toBe(source.uuid);
        expect(clip.blendMode).toBe(source.blendMode);
        expect(clip.tracks.map((t) => [t.name, t.type])).toEqual(
            source.tracks.map((t) => [t.name, t.type])
        );
        clip.tracks.forEach((track, t) => {
            expect(float32Hex(track.times)).toBe(
                float32Hex(source.tracks[t].times)
            );
            expect(float32Hex(track.values)).toBe(
                float32Hex(source.tracks[t].values)
            );
        });
        // And through three's own parser, as the bakers use them.
        const ours = THREE.AnimationClip.parse(clip);
        const theirs = THREE.AnimationClip.parse(source);
        expect(ours.duration).toBe(theirs.duration);
        ours.tracks.forEach((track, t) => {
            expect(track.constructor).toBe(theirs.tracks[t].constructor);
            expect(float32Hex(track.times)).toBe(
                float32Hex(theirs.tracks[t].times)
            );
            expect(float32Hex(track.values)).toBe(
                float32Hex(theirs.tracks[t].values)
            );
        });
    });
});

test("decoding works from an unaligned view, and rejects other data", () => {
    const shifted = new Uint8Array(container.byteLength + 1);
    shifted.set(container, 1);
    const view = shifted.subarray(1);
    expect(isAvatarClipContainer(view)).toBe(true);
    expect(float32Hex(decodeAvatarClips(view)[3].tracks[2].values)).toBe(
        float32Hex(JSON_CLIPS[3].tracks[2].values)
    );
    expect(isAvatarClipContainer(new Uint8Array(32))).toBe(false);
    expect(() => decodeAvatarClips(new Uint8Array(32))).toThrow();
    expect(() =>
        decodeAvatarClips(container.subarray(0, container.byteLength - 2))
    ).toThrow(/truncated/);
    const future = Uint8Array.from(container);
    future[4] = AVATAR_CLIPS_VERSION + 1;
    expect(() => decodeAvatarClips(future)).toThrow(/version/);
});

test("the encoder refuses numbers it cannot give back exactly", () => {
    const clip = (values) => [
        {
            name: "x",
            duration: 1,
            uuid: "u",
            blendMode: 2500,
            tracks: [
                { name: "a.position", type: "vector", times: [0], values },
            ],
        },
    ];
    expect(() => encodeAvatarClips(clip([Math.PI, 0, 0]))).toThrow(/decimals/);
    expect(() => encodeAvatarClips(clip([-0, 0, 0]))).toThrow(/decimals/);
    // Deltas beyond int16 are stored as int32.
    const wide = clip([123456.789, -98765.432, 0.5]);
    expect(
        decodeAvatarClips(encodeAvatarClips(wide))[0].tracks[0].values
    ).toEqual(Float32Array.from(wide[0].tracks[0].values));
});

/** A sample avatar as the bake worker loads it. */
async function loadAvatar(file) {
    const { GLTFLoader } = require("./bakergltfworkerloader.js");
    const { VRMLoaderPlugin } = require("@pixiv/three-vrm");
    const loader = new GLTFLoader();
    loader.register((parser) => {
        const plugin = new VRMLoaderPlugin(parser, {
            autoUpdateHumanBones: true,
        });
        plugin.mtoonMaterialPlugin.getMaterialType = () => null;
        return plugin;
    });
    // No image decoding in Node: every texture is an empty one.
    loader.register((parser) => {
        parser.textureLoader = {
            load: (_url, onLoad) => onLoad(new THREE.Texture()),
        };
        return { name: "test_textures" };
    });
    const bytes = fs.readFileSync(
        path.join(process.cwd(), "public/models", file)
    );
    const gltf = await loader.parseAsync(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        ),
        ""
    );
    return gltf.userData.vrm;
}

async function bake(file, clips) {
    const Baker = require("./indexworker.js").default;
    const baker = new Baker();
    baker.setAnimationJson(clips);
    const result = await baker.prepare(await loadAvatar(file));
    return {
        texture: Buffer.from(result.texture.source.data.data.buffer).toString(
            "base64"
        ),
        size: [
            result.texture.source.data.width,
            result.texture.source.data.height,
        ],
        metadata: Buffer.from(result.metaDataArray.buffer).toString("hex"),
        additional: Buffer.from(
            result.additionalMeta.image.source.data.data.buffer
        ).toString("hex"),
        ids: result.ids,
        extras: result.extras,
        boneMap: [...result.boneMap],
    };
}

describe("bake textures are byte for byte the same as from the JSON", () => {
    const realSelf = global.self;
    const realBlob = global.Blob;
    beforeAll(() => {
        global.self = global; // the loader reads self.URL
        global.Blob = Blob;
        jest.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterAll(() => {
        global.self = realSelf;
        global.Blob = realBlob;
        jest.restoreAllMocks();
    });

    test.each([
        ["a VRM 0 avatar", "OCman_01.vrm"],
        ["a VRM 1 avatar", "cyber_pepe.vrm"],
    ])(
        "%s",
        async (_, file) => {
            const fromJson = await bake(file, JSON_CLIPS);
            const decoded = decodeAvatarClips(container);
            const fromPacked = await bake(file, decoded);
            expect(fromPacked.ids.length).toBeGreaterThan(10);
            expect(fromPacked).toEqual(fromJson);
            // Clips are decoded once per worker and reused for every avatar:
            // a second bake from the same decoded clips must not differ.
            expect(await bake(file, decoded)).toEqual(fromJson);
            // The comparison is sensitive: one rotation key a little off
            // changes the texture.
            const idle = decoded.find((clip) => clip.name === "idle");
            const rotation = idle.tracks.find((t) => t.type === "quaternion");
            rotation.values[0] += 0.01;
            expect((await bake(file, decoded)).texture).not.toBe(
                fromJson.texture
            );
        },
        60000
    );
});
