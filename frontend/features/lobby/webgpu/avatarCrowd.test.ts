/** @jest-environment jsdom */
import * as THREE from "three/webgpu";
import {
    LobbyAvatarCrowd,
    crowdClipFrames,
    crowdRevealFront,
} from "./avatarCrowd";
import { createLobbyLocomotion, type LobbyMotionInput } from "../locomotion";
import {
    createAvatar,
    type LobbyAvatar,
    type LobbyBakedClip,
} from "./avatarAdapter";

jest.mock("./avatarAdapter", () => ({
    createAvatar: jest.fn(),
    LOBBY_EMOTES: [{ name: "WAVING" }, { name: "SITTALKING" }],
}));

const URL = "/avatars/square.glb";
type Source = LobbyAvatar & { dispose: jest.Mock; bakeClip: jest.Mock };
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let crowd: LobbyAvatarCrowd;
let sources: Source[];
let contexts: Array<{
    fillRect: jest.Mock;
    drawImage: jest.Mock;
    fillStyle: string;
}>;
let images: Array<{
    src: string;
    onload: (() => void) | null;
    onerror: (() => void) | null;
    crossOrigin: string;
}>;
const originalImage = globalThis.Image;
const renderer = {
    coordinateSystem: THREE.WebGPUCoordinateSystem,
    backend: {
        isWebGPUBackend: true,
        device: { limits: { maxTextureDimension2D: 4096 } },
    },
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

function makeClip(name: string, boneCounts = [2, 1]): LobbyBakedClip {
    const frameCount = 31;
    return {
        name,
        duration: 1,
        frameCount,
        fps: 30,
        timeScale: name === "RUN" ? 1.5 : name === "JUMP" ? 0.66 : 1,
        loop: name !== "WAVING",
        parts: boneCounts.map((count) => {
            const matrices = new Float32Array(frameCount * count * 16);
            for (let frame = 0; frame < frameCount; frame++) {
                for (let bone = 0; bone < count; bone++) {
                    new THREE.Matrix4()
                        .makeTranslation(frame / 30, bone, 0)
                        .toArray(matrices, (frame * count + bone) * 16);
                }
            }
            return matrices;
        }),
    };
}

function makeSource(url = URL): Source {
    const body = new THREE.BoxGeometry(1, 2, 1);
    const vertexCount = body.getAttribute("position").count;
    body.setAttribute(
        "skinIndex",
        new THREE.Uint16BufferAttribute(new Uint16Array(vertexCount * 4), 4)
    );
    const weights = new Float32Array(vertexCount * 4);
    for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
    body.setAttribute(
        "skinWeight",
        new THREE.Float32BufferAttribute(weights, 4)
    );
    const root = new THREE.Group();
    root.scale.setScalar(0.5);
    const source: Source = {
        root,
        height: 1.8,
        sourceUrl: url,
        motionClips: Object.fromEntries(
            ["IDLE", "WALK", "RUN", "JUMP"].map((name) => [
                name,
                { duration: 1 },
            ])
        ),
        update: jest.fn(),
        playEmote: jest.fn(),
        dispose: jest.fn(),
        bakeParts: [
            {
                geometry: body,
                material: new THREE.MeshLambertNodeMaterial(),
                boneCount: 2,
                isPfp: false,
            },
            {
                geometry: new THREE.PlaneGeometry(1, 1),
                material: new THREE.MeshBasicNodeMaterial(),
                boneCount: 1,
                isPfp: true,
            },
        ],
        bakeClip: jest.fn(async (name: string) => makeClip(name)),
    };
    sources.push(source);
    return source;
}

function batches() {
    return scene.children.filter(
        (child) => (child as THREE.InstancedMesh).isInstancedMesh
    ) as THREE.InstancedMesh[];
}
function firstModel() {
    return [...(crowd as any).entries.values()][0].model;
}
function atlasTextures(): THREE.DataTexture[] {
    return firstModel().atlases.map((atlas: any) => atlas.texture);
}
function place(avatar: LobbyAvatar, x = 0, z = 0) {
    avatar.root.position.set(x, 0, z);
    scene.add(avatar.root);
}
async function settle() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
}

beforeEach(() => {
    sources = [];
    contexts = [];
    images = [];
    (createAvatar as jest.Mock)
        .mockReset()
        .mockImplementation(async (url: string) => makeSource(url));
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () => {
            const context = {
                fillRect: jest.fn(),
                drawImage: jest.fn(),
                fillStyle: "",
            };
            contexts.push(context);
            return context as any;
        }
    );
    globalThis.Image = class {
        src = "";
        crossOrigin = "";
        onload = null;
        onerror = null;
        constructor() {
            images.push(this);
        }
    } as any;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
    camera.updateProjectionMatrix();
    camera.position.set(0, 2, 10);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld(true);
    crowd = new LobbyAvatarCrowd(scene, renderer as any);
});
afterEach(async () => {
    crowd.dispose();
    await settle();
    globalThis.Image = originalImage;
    jest.restoreAllMocks();
});

test("256 independently owned visitors share one source and two draw batches; the next page stays bounded", async () => {
    const visitors = await Promise.all(
        Array.from({ length: 256 }, () => crowd.create(URL))
    );
    visitors.forEach((visitor) => place(visitor));
    crowd.flush(camera);
    expect(createAvatar).toHaveBeenCalledTimes(1);
    expect(sources[0].bakeClip).toHaveBeenCalledTimes(1);
    expect(crowd.stats).toMatchObject({
        instances: 256,
        visible: 256,
        batches: 2,
        models: 1,
    });
    expect(batches().map((mesh) => mesh.count)).toEqual([256, 256]);
    expect(new Set(visitors.map((visitor) => visitor.root)).size).toBe(256);
    const extra = await crowd.create(URL);
    place(extra);
    crowd.flush(camera);
    expect(crowd.stats).toMatchObject({
        instances: 257,
        visible: 257,
        batches: 4,
        models: 1,
    });
    expect(batches().map((mesh) => mesh.count)).toEqual([256, 256, 1, 1]);
    expect(createAvatar).toHaveBeenCalledTimes(1);
});

test("portraits occupy separate inset tiles and survive visible-instance compaction", async () => {
    const a = await crowd.create(URL, { profilePhoto: "/alice.png" });
    const b = await crowd.create(URL, { profilePhoto: "/bob.png" });
    place(a);
    place(b, 1);
    images[0].onload!();
    images[1].onload!();
    expect(
        contexts[0].drawImage.mock.calls.map((call) => call.slice(1))
    ).toEqual([
        [1, 1, 126, 126],
        [129, 1, 126, 126],
    ]);
    crowd.flush(camera);
    const attribute = batches()[0].geometry.getAttribute("lobbyPortrait");
    const bobTile = [
        attribute.getX(1),
        attribute.getY(1),
        attribute.getZ(1),
        attribute.getW(1),
    ];
    expect(attribute.getX(0)).toBeGreaterThan(0);
    expect(bobTile[0] - attribute.getX(0)).toBeCloseTo(1 / 2);
    expect(attribute.getZ(0)).toBeLessThan(1 / 2);
    a.root.position.x = 10000;
    crowd.flush(camera);
    expect(batches()[0].count).toBe(1);
    expect([
        attribute.getX(0),
        attribute.getY(0),
        attribute.getZ(0),
        attribute.getW(0),
    ]).toEqual(bobTile);
});

test("animation timing and crossfades are per visitor while clip matrices are shared", async () => {
    const a = await crowd.create(URL);
    const b = await crowd.create(URL);
    place(a);
    place(b, 1);
    a.update(0.1, "WALK");
    b.update(0.02, "IDLE");
    await settle();
    a.update(0.05, "WALK");
    b.update(0.02, "IDLE");
    crowd.flush(camera);
    const geometry = batches()[0].geometry;
    const current = geometry.getAttribute("lobbyFrameB");
    const prior = geometry.getAttribute("lobbyFrameA");
    const blend = geometry.getAttribute("lobbyBlend");
    expect(current.getX(0)).toBeGreaterThanOrEqual(31);
    expect(current.getX(1)).toBeLessThan(31);
    expect(prior.getX(0)).toBeLessThan(31);
    expect(blend.getX(0)).toBeCloseTo(0.05 / 0.18);
    expect(blend.getX(1)).toBe(1);
    expect(
        sources[0].bakeClip.mock.calls.filter((call) => call[0] === "WALK")
    ).toHaveLength(1);
    expect(sources[0].update).not.toHaveBeenCalled();
    a.update(0.1);
    a.update(0.1);
    crowd.flush(camera);
    expect(blend.getX(0)).toBe(1);
});

test("native emote index zero selects waving and concurrent requests bake it only once", async () => {
    const a = await crowd.create(URL);
    const b = await crowd.create(URL);
    await Promise.all([a.playEmote(0), b.playEmote(0)]);
    expect(
        sources[0].bakeClip.mock.calls.filter((call) => call[0] === "WAVING")
    ).toHaveLength(1);
    a.update(0.1);
    b.update(0.03);
    place(a);
    place(b);
    crowd.flush(camera);
    const frames = batches()[0].geometry.getAttribute("lobbyFrameB");
    expect(frames.getX(0)).toBeGreaterThan(frames.getX(1));
});

test("animation frames and new visitors never re-upload the baked bone texture", async () => {
    const a = await crowd.create(URL);
    place(a);
    const textures = atlasTextures();
    const versions = textures.map((texture) => texture.version);
    const bytes = textures.map((texture) => texture.image.data.slice());
    for (let i = 0; i < 60; i++) {
        a.update(1 / 60);
        crowd.flush(camera);
    }
    const b = await crowd.create(URL);
    place(b);
    crowd.flush(camera);
    expect(atlasTextures()).toEqual(textures);
    expect(textures.map((texture) => texture.version)).toEqual(versions);
    expect(textures.map((texture) => texture.image.data)).toEqual(bytes);
    expect(crowd.stats.textureBytes).toBeLessThan(32 * 1024 * 1024);
});

test("world transforms and clamped account scale are applied once, including parent transforms", async () => {
    const avatar = await crowd.create(URL, { scale: 1.5 });
    const parent = new THREE.Group();
    parent.position.set(2, 0, 0);
    parent.rotation.y = Math.PI / 4;
    parent.scale.setScalar(1.2);
    avatar.root.position.set(1, 0, 0);
    parent.add(avatar.root);
    scene.add(parent);
    crowd.flush(camera);
    const matrix = new THREE.Matrix4();
    batches()[0].getMatrixAt(0, matrix);
    matrix.elements.forEach((value, i) =>
        expect(value).toBeCloseTo(avatar.root.matrixWorld.elements[i], 5)
    );
    expect(avatar.root.scale.x).toBeCloseTo(0.75);
    expect(avatar.height).toBeCloseTo(2.7);
    const huge = await crowd.create(URL, { scale: 100 });
    const invalid = await crowd.create(URL, { scale: NaN });
    expect(huge.root.scale.x).toBe(2);
    expect(invalid.root.scale.x).toBe(0.5);
});

test("culling removes distant visitors from draws without dropping their animation state", async () => {
    const a = await crowd.create(URL);
    const b = await crowd.create(URL);
    place(a);
    place(b, 10000);
    crowd.flush(camera);
    expect(crowd.stats).toMatchObject({ instances: 2, visible: 1, batches: 2 });
    b.update(0.1);
    b.root.position.x = 1;
    crowd.flush(camera);
    expect(crowd.stats.visible).toBe(2);
    const frame = batches()[0].geometry.getAttribute("lobbyFrameB");
    expect(frame.getX(1)).toBeGreaterThan(frame.getX(0));
    a.root.position.x = b.root.position.x = 10000;
    crowd.flush(camera);
    expect(crowd.stats).toMatchObject({ instances: 2, visible: 0, batches: 0 });
    expect(batches().map((mesh) => mesh.count)).toEqual([0, 0]);
});

test("leaving keeps a shared model alive until its final visitor leaves and releases it exactly once", async () => {
    const a = await crowd.create(URL, { profilePhoto: "/alice.png" });
    const b = await crowd.create(URL, { profilePhoto: "/bob.png" });
    const textures = atlasTextures();
    const releases = textures.map((texture) => jest.fn());
    textures.forEach((texture, i) =>
        texture.addEventListener("dispose", releases[i])
    );
    a.dispose();
    a.dispose();
    await settle();
    expect(sources[0].dispose).not.toHaveBeenCalled();
    expect(images[0].onload).toBeNull();
    b.dispose();
    b.dispose();
    await settle();
    crowd.flush(camera);
    expect(sources[0].dispose).toHaveBeenCalledTimes(1);
    releases.forEach((release) => expect(release).toHaveBeenCalledTimes(1));
    expect(batches()).toHaveLength(0);
    expect(crowd.stats).toMatchObject({
        instances: 0,
        models: 0,
        textureBytes: 0,
    });
    expect(images[1].onload).toBeNull();
    crowd.dispose();
    await settle();
    expect(sources[0].dispose).toHaveBeenCalledTimes(1);
});

test("a late portrait from a removed visitor cannot overwrite a reused tile", async () => {
    const a = await crowd.create(URL, { profilePhoto: "/alice.png" });
    const keep = await crowd.create(URL);
    const staleLoad = images[0].onload!;
    a.dispose();
    const b = await crowd.create(URL, { profilePhoto: "/bob.png" });
    staleLoad();
    expect(contexts[0].drawImage).not.toHaveBeenCalled();
    images[1].onload!();
    expect(contexts[0].drawImage).toHaveBeenCalledTimes(1);
    expect(contexts[0].drawImage.mock.calls[0].slice(1)).toEqual([
        1, 1, 126, 126,
    ]);
    b.dispose();
    keep.dispose();
});

test("disposing a crowd during preparation rejects arrivals and releases the pending source", async () => {
    const pending = deferred<LobbyAvatar>();
    (createAvatar as jest.Mock).mockImplementationOnce(() => pending.promise);
    const request = crowd.create(URL);
    const result = expect(request).rejects.toMatchObject({
        name: "AbortError",
    });
    crowd.dispose();
    const source = makeSource();
    pending.resolve(source);
    await result;
    await settle();
    expect(source.dispose).toHaveBeenCalledTimes(1);
    expect(batches()).toHaveLength(0);
    expect(createAvatar).toHaveBeenCalledTimes(1);
});

test("one cancelled arrival does not cancel the shared source needed by another visitor", async () => {
    const pending = deferred<LobbyAvatar>();
    (createAvatar as jest.Mock).mockImplementationOnce(() => pending.promise);
    const controller = new AbortController();
    const first = crowd.create(URL, { signal: controller.signal });
    const rejected = expect(first).rejects.toMatchObject({
        name: "AbortError",
    });
    const second = crowd.create(URL);
    controller.abort();
    const source = makeSource();
    pending.resolve(source);
    await rejected;
    const visitor = await second;
    place(visitor);
    crowd.flush(camera);
    expect(crowd.stats.instances).toBe(1);
    expect(source.dispose).not.toHaveBeenCalled();
    expect(createAvatar).toHaveBeenCalledTimes(1);
    visitor.dispose();
    await settle();
    expect(source.dispose).toHaveBeenCalledTimes(1);
});

test("unsupported models and devices use the native avatar path with identity options preserved", async () => {
    const unsupported = makeSource();
    unsupported.bakeParts = undefined;
    (createAvatar as jest.Mock).mockResolvedValueOnce(unsupported);
    const options = { scale: 1.4, profilePhoto: "/alice.png" };
    const avatar = await crowd.create(URL, options);
    expect(unsupported.dispose).toHaveBeenCalledTimes(1);
    expect(createAvatar).toHaveBeenLastCalledWith(URL, options);
    expect(avatar).toBe(sources[1]);
    const oldDevice = new LobbyAvatarCrowd(scene, {
        backend: { isWebGPUBackend: false },
    } as any);
    const live = await oldDevice.create(URL, options);
    expect(createAvatar).toHaveBeenLastCalledWith(URL, options);
    expect(live).toBe(sources[2]);
    expect(batches()).toHaveLength(0);
    oldDevice.dispose();
});

test("clip frame sampling preserves terminal one-shot poses and loops at exact duration", () => {
    const oneShot = { ...makeClip("WAVING"), offset: 40 };
    expect(crowdClipFrames(oneShot, 100)).toEqual([70, 70, 0]);
    expect(crowdClipFrames(oneShot, -1)).toEqual([40, 41, 0]);
    expect(crowdClipFrames(oneShot, 0.25)).toEqual([47, 48, 0.5]);
    const loop = { ...makeClip("RUN"), offset: 80 };
    expect(crowdClipFrames(loop, 1 / 1.5)).toEqual([80, 81, 0]);
    expect(
        crowdClipFrames({ ...oneShot, duration: 0, frameCount: 1 }, 100)
    ).toEqual([40, 40, 0]);
});

test("an oversized animation is rejected before replacing the working bounded atlas", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    const textures = atlasTextures();
    const versions = textures.map((texture) => texture.version);
    sources[0].bakeClip.mockImplementationOnce(async () => ({
        ...makeClip("WAVING"),
        frameCount: 1_000_000,
    }));
    await expect(avatar.playEmote(0)).rejects.toThrow("atlas is full");
    avatar.update(0.1, "IDLE");
    crowd.flush(camera);
    expect(atlasTextures()).toEqual(textures);
    expect(textures.map((texture) => texture.version)).toEqual(versions);
    expect(crowd.stats).toMatchObject({ instances: 1, visible: 1, batches: 2 });
    expect(crowd.stats.textureBytes).toBeLessThan(32 * 1024 * 1024);
});

test("a clip finishing after the last visitor leaves cannot resurrect textures or draw batches", async () => {
    const avatar = await crowd.create(URL);
    const pending = deferred<LobbyBakedClip>();
    sources[0].bakeClip.mockImplementationOnce(() => pending.promise);
    const motion = avatar.playEmote(0);
    const rejected = expect(motion).rejects.toMatchObject({
        name: "AbortError",
    });
    avatar.dispose();
    await settle();
    pending.resolve(makeClip("WAVING"));
    await rejected;
    crowd.flush(camera);
    expect(crowd.stats).toMatchObject({
        instances: 0,
        models: 0,
        textureBytes: 0,
    });
    expect(batches()).toHaveLength(0);
    expect(sources[0].dispose).toHaveBeenCalledTimes(1);
});

test("growing an atlas retargets every TSL texture binding and releases the old GPU texture", async () => {
    const avatar = await crowd.create(URL);
    const atlas = firstModel().atlases[0];
    const binding = atlas.node;
    const original = atlas.texture;
    const released = jest.fn();
    original.addEventListener("dispose", released);
    await avatar.playEmote(0);
    expect(atlas.node).toBe(binding);
    expect(binding.value).toBe(atlas.texture);
    expect(atlas.texture).not.toBe(original);
    expect(released).toHaveBeenCalledTimes(1);
    expect(atlas.texture.type).toBe(THREE.HalfFloatType);
    expect(atlas.texture.colorSpace).toBe(THREE.NoColorSpace);
});

test("generated WGSL skins positions before applying the visitor transform and samples portraits", async () => {
    // Node cache keys use generated UUIDs; deterministic phase randomness must not
    // accidentally make every shader node share the same identity in this test.
    (Math.random as jest.Mock).mockRestore();
    const avatar = await crowd.create(URL, { profilePhoto: "/alice.png" });
    place(avatar);
    crowd.flush(camera);
    const gpu = new THREE.WebGPURenderer({
        canvas: document.createElement("canvas"),
    });
    gpu.hasFeature = () => false;
    const backend = gpu.backend as any;
    backend.utils.getTextureSampleData = () => ({ primarySamples: 1 });
    for (const mesh of batches()) {
        const builder = backend.createNodeBuilder(mesh, gpu);
        builder.camera = camera;
        builder.scene = scene;
        builder.build();
        expect(builder.vertexShader).toContain("textureLoad(");
        expect(builder.vertexShader).toContain("mat4x4<f32>");
        expect(builder.vertexShader).toContain("lobbyFrameA");
        expect(builder.vertexShader).toContain("lobbyBlend");
        expect(builder.vertexShader).not.toContain("boneMatrices");
        // Bone texels are integer addresses, never transformed as normalized UVs.
        expect(builder.vertexShader).not.toMatch(
            /textureLoad\([^\n]+object\.nodeUniform/
        );
        const positions = builder.vertexShader
            .split("\n")
            .filter((line) => line.trim().startsWith("positionLocal ="));
        expect(positions).toHaveLength(3);
        expect(positions[0]).toContain("positionLocal = position;");
        expect(positions[1]).toContain("vec4<f32>( positionLocal, 1.0 )");
        expect(positions[2]).toContain("NodeBuffer_");
        if (
            (mesh.material as THREE.MeshBasicNodeMaterial)
                .isMeshBasicNodeMaterial
        ) {
            expect(builder.fragmentShader).toContain("textureSample(");
            expect(builder.vertexShader).toContain("lobbyPortrait");
        }
    }
});

test("the modern WebGL fallback retains the same crowd batching and coordinate system", async () => {
    crowd.dispose();
    const gl = {
        MAX_TEXTURE_SIZE: 1,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 2,
        MAX_VERTEX_ATTRIBS: 3,
        getParameter: (key: number) => (key === 1 ? 4096 : 16),
    };
    crowd = new LobbyAvatarCrowd(scene, {
        coordinateSystem: THREE.WebGLCoordinateSystem,
        backend: { isWebGLBackend: true, gl },
    } as any);
    camera.coordinateSystem = THREE.WebGLCoordinateSystem;
    camera.updateProjectionMatrix();
    const a = await crowd.create(URL);
    const b = await crowd.create(URL);
    place(a);
    place(b, 10000);
    crowd.flush(camera);
    expect(crowd.stats).toMatchObject({ instances: 2, visible: 1, batches: 2 });
    expect(createAvatar).toHaveBeenCalledTimes(1);
});

test("all per-visitor shader fields share one vertex buffer within WebGPU's portable limit", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    const geometry = batches()[0].geometry;
    const fields = [
        "lobbyFrameA",
        "lobbyFrameB",
        "lobbyBlend",
        "lobbyPortrait",
    ].map(
        (name) =>
            geometry.getAttribute(name) as THREE.InterleavedBufferAttribute
    );
    expect(new Set(fields.map((field) => field.data)).size).toBe(1);
    expect(fields.map((field) => field.offset)).toEqual([0, 3, 6, 7]);
    expect(fields[0].data.stride).toBe(11);
    expect(fields[0].data).toBeInstanceOf(THREE.InstancedInterleavedBuffer);
    expect(
        (fields[0].data as THREE.InstancedInterleavedBuffer).meshPerAttribute
    ).toBe(1);
    const before = fields[0].data.version;
    crowd.flush(camera);
    expect(fields[0].data.version).toBe(before + 1);
    expect(fields[2].getX(0)).toBe(1);
});

test("the GPU batch preserves its source avatar's authored body texture and color", async () => {
    const source = makeSource();
    const material = source.bakeParts[0]
        .material as THREE.MeshLambertNodeMaterial;
    material.map = new THREE.Texture();
    material.color.setHex(0x3279ad);
    material.emissive.setHex(0x142536);
    (createAvatar as jest.Mock).mockResolvedValueOnce(source);
    await crowd.create(URL);
    const rendered = batches()[0].material as THREE.MeshLambertNodeMaterial;
    expect(rendered.map).toBe(material.map);
    expect(rendered.color.equals(material.color)).toBe(true);
    expect(rendered.color).not.toBe(material.color);
    expect(rendered.emissive.equals(material.emissive)).toBe(true);
    expect(rendered.setupPosition).not.toBe(material.setupPosition);
});

test("a full page of visitors sharing one portrait keeps one 128px tile and one image request", async () => {
    const visitors = await Promise.all(
        Array.from({ length: 256 }, () =>
            crowd.create(URL, { profilePhoto: "/same.png" })
        )
    );
    visitors.forEach((visitor) => place(visitor));
    crowd.flush(camera);
    expect(images).toHaveLength(1);
    expect(crowd.stats).toMatchObject({
        instances: 256,
        crowdPages: 1,
        batches: 2,
        portraitBytes: 128 * 128 * 4,
    });
    const pictureLoad = images[0].onload;
    visitors[0].dispose();
    expect(images[0].onload).toBe(pictureLoad);
    visitors.slice(1).forEach((visitor) => visitor.dispose());
    expect(images[0].onload).toBeNull();
});

test("portrait atlas growth preserves loaded 128px tiles and updates the shader texture binding", async () => {
    const a = await crowd.create(URL, { profilePhoto: "/one.png" });
    images[0].onload();
    const page = firstModel().pages[0];
    const original = page.texture;
    const retired = jest.fn();
    original.addEventListener("dispose", retired);
    const b = await crowd.create(URL, { profilePhoto: "/two.png" });
    expect(page.canvas.width).toBe(256);
    expect(page.portraitNode.value).toBe(page.texture);
    expect(page.texture).not.toBe(original);
    expect(retired).toHaveBeenCalledTimes(1);
    expect(
        contexts[0].drawImage.mock.calls.some(
            (call) => call.length === 9 && call[3] === 128 && call[7] === 128
        )
    ).toBe(true);
    place(a);
    place(b, 1);
    crowd.flush(camera);
    const uv = batches()[0].geometry.getAttribute("lobbyPortrait");
    expect(uv.getZ(0) * page.canvas.width).toBeCloseTo(125);
    expect(uv.getX(1) - uv.getX(0)).toBeCloseTo(0.5);
});

test("stationary visitors share transform storage and never dirty it just to animate", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    crowd.flush(camera);
    const [body, portrait] = batches();
    expect(body.instanceMatrix).toBe(portrait.instanceMatrix);
    const matricesVersion = body.instanceMatrix.version;
    const data = (
        body.geometry.getAttribute(
            "lobbyFrameA"
        ) as THREE.InterleavedBufferAttribute
    ).data;
    const animationVersion = data.version;
    avatar.update(1 / 60);
    crowd.flush(camera);
    expect(body.instanceMatrix.version).toBe(matricesVersion);
    expect(data.version).toBe(animationVersion + 1);
    expect(crowd.stats).toMatchObject({
        transformUploads: 0,
        animationUploads: 1,
    });
    crowd.flush(camera);
    expect(crowd.stats).toMatchObject({
        transformUploads: 0,
        animationUploads: 0,
    });
    avatar.root.position.x = 1;
    crowd.flush(camera);
    expect(crowd.stats.transformUploads).toBe(1);
});

test("a completed one-shot emote stops uploading frame data without changing its final pose", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    await avatar.playEmote(0);
    for (let i = 0; i < 20; i++) avatar.update(0.1);
    crowd.flush(camera);
    const geometry = batches()[0].geometry;
    const frame = geometry.getAttribute("lobbyFrameB");
    const terminal = [frame.getX(0), frame.getY(0), frame.getZ(0)];
    avatar.update(0.1);
    crowd.flush(camera);
    expect(crowd.stats.animationUploads).toBe(0);
    expect([frame.getX(0), frame.getY(0), frame.getZ(0)]).toEqual(terminal);
});

test("4096 identical visitors use sixteen pages and one shared native source", async () => {
    const visitors = await Promise.all(
        Array.from({ length: 4096 }, () =>
            crowd.create(URL, { profilePhoto: "/same.png" })
        )
    );
    visitors.forEach((visitor) => place(visitor));
    crowd.flush(camera);
    expect(createAvatar).toHaveBeenCalledTimes(1);
    expect(crowd.stats).toMatchObject({
        instances: 4096,
        visible: 4096,
        crowdPages: 16,
        batches: 32,
        portraitBytes: 16 * 128 * 128 * 4,
    });
    expect(images).toHaveLength(16);
    visitors.forEach((visitor) => visitor.dispose());
    await settle();
    expect(sources[0].dispose).toHaveBeenCalledTimes(1);
});

test("semantic movement shares controller phases and native-rate-independent samples without adding batches", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    const model = firstModel();
    for (const name of ["WALK", "RUN", "JUMP"])
        await (crowd as any).ensureClip(model, name);
    const textures = atlasTextures();
    const versions = textures.map((texture) => texture.version);
    const expected = createLobbyLocomotion(
        sources[0].motionClips!,
        Math.random()
    );
    const motion: LobbyMotionInput = {
        speed: 4.5,
        grounded: true,
        quality: "full",
    };
    let pose: ReturnType<typeof expected.update>;
    for (let frame = 0; frame < 90; frame++) {
        pose = expected.update(1 / 60, motion);
        avatar.update(1 / 60, undefined, motion);
    }
    crowd.flush(camera);
    const geometry = batches()[0].geometry;
    const checkSample = (
        attribute: string,
        sample: { name: string; time: number }
    ) => {
        const clip = model.clips.get(sample.name);
        const frames = geometry.getAttribute(attribute);
        const sampledFrame = frames.getX(0) - clip.offset + frames.getZ(0);
        // Authored seconds must not receive RUN's native 1.5x rate a second time.
        expect(sampledFrame).toBeCloseTo((sample.time % clip.duration) * 30, 4);
    };
    if (pose!.blend > 0 && pose!.primary.name !== pose!.secondary.name) {
        checkSample("lobbyFrameA", pose!.primary);
        checkSample("lobbyFrameB", pose!.secondary);
        expect(geometry.getAttribute("lobbyBlend").getX(0)).toBeCloseTo(
            pose!.blend
        );
    } else {
        checkSample("lobbyFrameB", pose!.primary);
        expect(geometry.getAttribute("lobbyBlend").getX(0)).toBe(1);
    }
    const airborne: LobbyMotionInput = {
        ...motion,
        grounded: false,
        height: 0.8,
        verticalVelocity: 0,
    };
    for (let frame = 0; frame < 15; frame++) {
        pose = expected.update(1 / 60, airborne);
        avatar.update(1 / 60, undefined, airborne);
    }
    crowd.flush(camera);
    expect(pose!.primary.name).toBe("JUMP");
    // The baked JUMP's slower native 0.66x playback must not distort physics time.
    checkSample("lobbyFrameB", pose!.primary);
    expect(crowd.stats).toMatchObject({ instances: 1, visible: 1, batches: 2 });
    expect(atlasTextures()).toEqual(textures);
    expect(textures.map((texture) => texture.version)).toEqual(versions);
    expect(sources[0].update).not.toHaveBeenCalled();
});

test("a lazily baked gait joins the advanced phase through a fade instead of restarting", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    const pending = deferred<LobbyBakedClip>();
    sources[0].bakeClip.mockImplementation((name: string) =>
        name === "WALK" ? pending.promise : Promise.resolve(makeClip(name))
    );
    const expected = createLobbyLocomotion(
        sources[0].motionClips!,
        Math.random()
    );
    const motion: LobbyMotionInput = {
        speed: 2,
        grounded: true,
        quality: "crowd",
    };
    for (let frame = 0; frame < 30; frame++) {
        expected.update(1 / 60, motion);
        avatar.update(1 / 60, undefined, motion);
    }
    expect(
        sources[0].bakeClip.mock.calls.filter((call) => call[0] === "WALK")
    ).toHaveLength(1);
    crowd.flush(camera);
    expect(
        batches()[0].geometry.getAttribute("lobbyFrameB").getX(0)
    ).toBeLessThan(31);
    pending.resolve(makeClip("WALK"));
    await settle();
    const pose = expected.update(0.01, motion);
    avatar.update(0.01, undefined, motion);
    crowd.flush(camera);
    const instance = firstModel().pages[0].instances.values().next().value;
    expect(instance.previous.name).toBe("IDLE");
    expect(instance.current.name).toBe(pose.primary.name);
    expect(instance.currentTime * instance.current.timeScale).toBeCloseTo(
        pose.primary.time
    );
    expect(instance.fade / 0.18).toBeCloseTo(0.01 / 0.18);
});

test("late motion and emote bakes cannot replace the newer animation intent", async () => {
    const avatar = await crowd.create(URL);
    const walk = deferred<LobbyBakedClip>();
    sources[0].bakeClip.mockImplementation((name: string) =>
        name === "WALK" ? walk.promise : Promise.resolve(makeClip(name))
    );
    const motion: LobbyMotionInput = {
        speed: 2,
        grounded: true,
        quality: "crowd",
    };
    for (let frame = 0; frame < 30; frame++)
        avatar.update(1 / 60, undefined, motion);
    await avatar.playEmote(0);
    walk.resolve(makeClip("WALK"));
    await settle();
    avatar.update(0.05);
    const instance = firstModel().pages[0].instances.values().next().value;
    expect(instance.current.name).toBe("WAVING");
    expect(instance.requested).toBe("WAVING");

    const sit = deferred<LobbyBakedClip>();
    sources[0].bakeClip.mockImplementationOnce(() => sit.promise);
    const olderEmote = avatar.playEmote(1);
    for (let frame = 0; frame < 30; frame++)
        avatar.update(1 / 60, undefined, motion);
    expect(instance.requested).toBe("@locomotion");
    sit.resolve(makeClip("SITTALKING"));
    await olderEmote;
    expect(instance.current.name).toBe("WALK");
    expect(instance.requested).toBe("@locomotion");
});

test("an emote fades from the dominant semantic pose instead of promoting its minor layer", async () => {
    const avatar = await crowd.create(URL);
    await (crowd as any).ensureClip(firstModel(), "WALK");
    await (crowd as any).ensureClip(firstModel(), "RUN");
    const motion: LobbyMotionInput = {
        speed: 2.4,
        grounded: true,
        quality: "full",
    };
    for (let frame = 0; frame < 60; frame++)
        avatar.update(1 / 60, undefined, motion);
    const instance = firstModel().pages[0].instances.values().next().value;
    expect(instance.previous.name).toBe("WALK");
    expect(instance.current.name).toBe("RUN");
    expect(instance.fade).toBeLessThan(0.09);
    await avatar.playEmote(0);
    expect(instance.previous.name).toBe("WALK");
    expect(instance.current.name).toBe("WAVING");
});

test("a rejected secondary gait degrades to loaded motion without retrying each frame", async () => {
    const avatar = await crowd.create(URL);
    await (crowd as any).ensureClip(firstModel(), "WALK");
    sources[0].bakeClip.mockImplementation(async (name: string) => {
        if (name === "RUN") throw new Error("Atlas full");
        return makeClip(name);
    });
    const motion: LobbyMotionInput = {
        speed: 3,
        grounded: true,
        quality: "full",
    };
    for (let frame = 0; frame < 90; frame++) {
        avatar.update(1 / 60, undefined, motion);
        await settle();
    }
    const instance = firstModel().pages[0].instances.values().next().value;
    expect(instance.current.name).toBe("WALK");
    expect(instance.fade).toBe(0.18);
    expect(
        sources[0].bakeClip.mock.calls.filter((call) => call[0] === "RUN")
    ).toHaveLength(1);
    const time = instance.currentTime;
    avatar.update(0.01, undefined, motion);
    expect(instance.currentTime).not.toBe(time);
});

test("moving turns bake once on demand without freezing gait playback or adding batches", async () => {
    const avatar = await crowd.create(URL);
    place(avatar);
    const model = firstModel();
    for (const name of ["WALK", "RUN"])
        await (crowd as any).ensureClip(model, name);
    sources[0].motionClips.TURN_RUN_L = {
        duration: 1,
        loop: true,
        turn: {
            kind: "arc",
            gait: "RUN",
            direction: 1,
            angle: 0,
            entryPhase: 0,
            phaseSpan: 1,
        },
    };
    const pending = deferred<LobbyBakedClip>();
    sources[0].bakeClip.mockImplementation((name) =>
        name === "TURN_RUN_L"
            ? pending.promise
            : Promise.resolve(makeClip(name))
    );
    const motion: LobbyMotionInput = {
        speed: 4.5,
        grounded: true,
        quality: "full",
        turnRate: 0.9,
        turnIntent: 0.2,
    };
    for (let f = 0; f < 90; f++) avatar.update(1 / 60, undefined, motion);
    crowd.flush(camera);
    const geometry = batches()[0].geometry;
    const before = geometry.getAttribute("lobbyFrameB").getX(0);
    for (let f = 0; f < 6; f++) avatar.update(1 / 60, undefined, motion);
    crowd.flush(camera);
    expect(geometry.getAttribute("lobbyFrameB").getX(0)).not.toBe(before);
    expect(
        sources[0].bakeClip.mock.calls.filter((c) => c[0] === "TURN_RUN_L")
    ).toHaveLength(1);
    pending.resolve(makeClip("TURN_RUN_L"));
    await settle();
    for (let f = 0; f < 60; f++) avatar.update(1 / 60, undefined, motion);
    crowd.flush(camera);
    const turn = model.clips.get("TURN_RUN_L");
    expect(geometry.getAttribute("lobbyFrameB").getX(0)).toBeGreaterThanOrEqual(
        turn.offset
    );
    expect(geometry.getAttribute("lobbyFrameB").getX(0)).toBeLessThan(
        turn.offset + turn.frameCount
    );
    expect(crowd.stats).toMatchObject({ instances: 1, visible: 1, batches: 2 });
    expect(crowd.stats.textureBytes).toBeLessThan(32 * 1024 * 1024);
});

test("idle variants bake once per shared model and preserve the crowd draw budget", async () => {
    const first = await crowd.create(URL);
    const source = sources[0];
    source.motionClips.IDLE_ONCYBER = { duration: 1, loop: true };
    source.motionClips.IDLE_CC0 = { duration: 1, loop: true };
    let seed = 0;
    jest.spyOn(Math, "random").mockImplementation(
        () => ((seed++ % 3) + 0.1) / 3
    );
    const visitors = [
        first,
        ...(await Promise.all(
            Array.from({ length: 62 }, () => crowd.create(URL))
        )),
    ];
    visitors.forEach((v) => {
        place(v);
        v.update(1 / 60, undefined, { speed: 0, grounded: true });
    });
    await settle();
    for (let frame = 0; frame < 60; frame++)
        visitors.forEach((v) =>
            v.update(1 / 60, undefined, { speed: 0, grounded: true })
        );
    crowd.flush(camera);
    for (const name of ["IDLE", "IDLE_ONCYBER", "IDLE_CC0"])
        expect(
            source.bakeClip.mock.calls.filter((call) => call[0] === name)
        ).toHaveLength(1);
    const clips = new Set(
        [...firstModel().pages[0].instances].map(
            (instance: any) => instance.current.name
        )
    );
    expect(clips).toEqual(new Set(["IDLE", "IDLE_ONCYBER", "IDLE_CC0"]));
    expect(crowd.stats).toMatchObject({ instances: 63, models: 1, batches: 2 });
    expect(crowd.stats.textureBytes).toBeLessThan(32 * 1024 * 1024);
});

test("an unavailable idle variant falls back to idle instead of walking in place", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.8);
    const visitor = await crowd.create(URL);
    sources[0].motionClips.IDLE_CC0 = { duration: 1, loop: true };
    sources[0].bakeClip.mockImplementation((name: string) =>
        name === "IDLE_CC0"
            ? Promise.reject(new Error("atlas budget"))
            : Promise.resolve(makeClip(name))
    );
    place(visitor);
    visitor.update(1 / 60, undefined, { speed: 0, grounded: true });
    await settle();
    for (let f = 0; f < 60; f++)
        visitor.update(1 / 60, undefined, { speed: 0, grounded: true });
    const instance: any = [...firstModel().pages[0].instances][0];
    expect(instance.current.name).toBe("IDLE");
    expect(instance.previous.name).toBe("IDLE");
});

test("other people's arrival front rises from below the feet to above the head", () => {
    const [hiddenFront, band] = crowdRevealFront(0, 2, 1.8);
    expect(band).toBeCloseTo(0.396);
    // Every dithered cell sits at or above front - band, i.e. below the feet.
    expect(hiddenFront - band).toBeLessThan(2);
    const [fullFront] = crowdRevealFront(0.9998, 2, 1.8);
    expect(fullFront).toBeGreaterThan(2 + 1.8);
    expect(crowdRevealFront(1, 2, 1.8)).toEqual([1e5, 0]);
    // Unknown heights fall back to a person-sized front.
    expect(crowdRevealFront(0.5, 0, NaN)[1]).toBeCloseTo(1.8 * 0.22);
});
