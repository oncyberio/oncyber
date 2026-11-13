/** @jest-environment jsdom */
import fs from "fs";
import path from "path";

// Keep lifecycle/deformation unit fixtures independent of the shipped asset pack.
jest.mock("../optionalMotionPack", () => ({
    ...jest.requireActual("../optionalMotionPack"),
    loadDefaultMotion: async (
        fetchAsset: (url: string) => Promise<ArrayBuffer>
    ) =>
        JSON.parse(
            new (require("util").TextDecoder)().decode(
                await fetchAsset("/lobby/native-avatar-motion.json")
            )
        ),
}));

const mockTravelLoad = jest.fn();
jest.mock("../travelAnimationPack", () => ({
    ...jest.requireActual("../travelAnimationPack"),
    loadTravelAnimationPack: (...args: unknown[]) => mockTravelLoad(...args),
}));

const mockFlashLoad = jest.fn();
jest.mock("../flashAnimationPack", () => ({
    ...jest.requireActual("../flashAnimationPack"),
    loadFlashAnimationPack: (...args: unknown[]) => mockFlashLoad(...args),
}));
const mockFlashPack = () => ({
    clips: {
        FLASH_POINT: {
            uuid: "test-flash",
            name: "FLASH_POINT",
            duration: 1.833333333,
            tracks: [
                {
                    name: "mixamorigHips.position",
                    type: "vector",
                    times: [0, 1, 1.833333333],
                    values: [0, 1, 0, 0, 0.8, 0, 0, 1, 0],
                },
            ],
        },
    },
    metadata: {},
});

const mockParses: any[] = [];
const mockDisposed: any[] = [];
const mockPlayed: string[] = [];
let mockAvatarKind = "rigid";
let mockClipDuration = 1;

jest.mock("@pixiv/three-vrm", () => ({
    VRMLoaderPlugin: class {
        mtoonMaterialPlugin = {};
    },
}));
jest.mock("./avatarResources", () => ({
    ...jest.requireActual("./avatarResources"),
    disposeAvatarGraph: (root: any) => {
        mockDisposed.push(root);
        jest.requireActual("./avatarResources").disposeAvatarGraph(root);
    },
}));
jest.mock("three/examples/jsm/loaders/DRACOLoader.js", () => ({
    DRACOLoader: class {
        setDecoderPath() {
            return this;
        }
        dispose() {}
    },
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
    GLTFLoader: class {
        setCrossOrigin() {
            return this;
        }
        setDRACOLoader() {
            return this;
        }
        register() {
            return this;
        }
        async parseAsync() {
            const THREE = require("three/webgpu");
            const scene = new THREE.Group();
            const geometry = new THREE.BoxGeometry(1, 2, 1);
            const hips =
                mockAvatarKind === "skinned"
                    ? new THREE.Bone()
                    : new THREE.Group();
            hips.name = "test_hips";
            hips.position.y = 1;
            let mesh: any;
            if (mockAvatarKind === "skinned") {
                const indices = new Uint16Array(
                    geometry.attributes.position.count * 4
                );
                const weights = new Float32Array(indices.length);
                for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
                geometry.setAttribute(
                    "skinIndex",
                    new THREE.Uint16BufferAttribute(indices, 4)
                );
                geometry.setAttribute(
                    "skinWeight",
                    new THREE.Float32BufferAttribute(weights, 4)
                );
                mesh = new THREE.SkinnedMesh(
                    geometry,
                    new THREE.MeshStandardMaterial()
                );
                mesh.position.set(0.3, 1, 0.2);
                mesh.rotation.z = 0.15;
                scene.add(mesh, hips);
                scene.updateMatrixWorld(true);
                mesh.bind(new THREE.Skeleton([hips]));
            } else {
                mesh = new THREE.Mesh(geometry);
                mesh.position.y = 1;
                scene.add(mesh, hips);
            }
            if (mockAvatarKind === "morph")
                geometry.morphAttributes.position = [
                    geometry.attributes.position.clone(),
                ];
            if (mockAvatarKind === "shader")
                mesh.material = new THREE.ShaderMaterial();
            if (mockAvatarKind === "array") mesh.material = [mesh.material];
            mesh.name = "Mask_pfp";
            const vrm = {
                scene,
                springBoneManager:
                    mockAvatarKind === "spring"
                        ? { joints: new Set([{}]) }
                        : undefined,
                humanoid: {
                    getNormalizedBoneNode: () => hips,
                    getNormalizedPose: () => ({}),
                    resetNormalizedPose: jest.fn(() => {
                        hips.position.set(0, 1, 0);
                        hips.quaternion.identity();
                    }),
                    setNormalizedPose: jest.fn(),
                },
                update: jest.fn(),
            };
            mockParses.push(vrm);
            return { scene, userData: { vrm } };
        }
    },
}));

let adapter: typeof import("./avatarAdapter");
let fetchMock: jest.Mock;
const encoded = (value: unknown) =>
    new Uint8Array(Buffer.from(JSON.stringify(value))).buffer;

function rawClip(name: string) {
    return {
        name,
        duration: mockClipDuration,
        tracks:
            mockAvatarKind === "skinned"
                ? [
                      {
                          name: "mixamorigHips.position",
                          type: "vector",
                          times: [0, mockClipDuration],
                          values: [0, 1, 0, 0.4, 1.6, 0.2],
                      },
                      {
                          name: "mixamorigHips.quaternion",
                          type: "quaternion",
                          times: [0, mockClipDuration],
                          values: [
                              0,
                              0,
                              0,
                              1,
                              0,
                              0,
                              Math.sin(0.3),
                              Math.cos(0.3),
                          ],
                      },
                  ]
                : [],
    };
}

beforeEach(() => {
    jest.resetModules();
    mockFlashLoad.mockReset().mockResolvedValue(mockFlashPack());
    mockTravelLoad.mockReset().mockResolvedValue({
        clips: Object.fromEntries(
            [
                "TRAVEL_ATTACK",
                "TRAVEL_CROUCH_DOWN",
                "TRAVEL_CROUCH_IDLE",
                "TRAVEL_STAND_UP",
            ].map((name) => [
                name,
                {
                    uuid: `test-travel-${name}`,
                    name,
                    duration: 1,
                    tracks: [
                        {
                            name: "mixamorigHips.position",
                            type: "vector",
                            times: [0, 0.5, 1],
                            values:
                                name === "TRAVEL_CROUCH_DOWN"
                                    ? [0, 1, 0, 0, 0.75, 0, 0, 0.5, 0]
                                    : name === "TRAVEL_STAND_UP"
                                    ? [0, 0.5, 0, 0, 0.75, 0, 0, 1, 0]
                                    : name === "TRAVEL_CROUCH_IDLE"
                                    ? [0, 0.5, 0, 0, 0.55, 0, 0, 0.5, 0]
                                    : [0, 1, 0, 0, 1.1, 0, 0, 1, 0],
                        },
                    ],
                },
            ])
        ),
        metadata: {},
    });

    // Each test deliberately reloads one modern graph and its module caches.
    delete (window as any).__THREE__;
    mockParses.length = mockDisposed.length = mockPlayed.length = 0;
    mockAvatarKind = "rigid";
    mockClipDuration = 1;
    (globalThis as any).TextDecoder = require("util").TextDecoder;
    fetchMock = jest.fn(async (url: string) => ({
        ok: true,
        arrayBuffer: async () => {
            if (url.includes("native-avatar-motion"))
                return encoded(
                    Object.fromEntries(
                        ["IDLE", "WALK", "RUN", "JUMP", "WAVING"].map(
                            (name) => [name, rawClip(name)]
                        )
                    )
                );
            if (url.includes("native-avatar-emotes"))
                return encoded({
                    SITTALKING: rawClip("SITTALKING"),
                    TECHNO: rawClip("TECHNO"),
                });
            return new ArrayBuffer(8);
        },
    }));
    globalThis.fetch = fetchMock;
    const THREE = require("three/webgpu");
    const play = THREE.AnimationAction.prototype.play;
    jest.spyOn(THREE.AnimationAction.prototype, "play").mockImplementation(
        function () {
            mockPlayed.push(this.getClip().name);
            return play.call(this);
        }
    );
    adapter = require("./avatarAdapter");
});
afterEach(() => jest.restoreAllMocks());

test("saved builtins and scale survive resolution; guests use Summer and accounts use their pfp", async () => {
    const guest = await adapter.resolveLobbyAvatar();
    expect(guest.id).toBe("sunshine");
    expect(guest.url).toContain("filename=sunshine.glb");
    const account = await adapter.resolveLobbyAvatar({ walletId: "owner" });
    expect(account.id).toBe("square");
    expect(account.url).toBe(adapter.DEFAULT_LOBBY_AVATAR_URL);
    const selected = await adapter.resolveLobbyAvatar({
        settings: { vrm: "pepe", default_vrm_scale: 1.3 },
    });
    expect(selected.id).toBe("pepe");
    expect(selected.url).toContain(
        "Qmf7RQDNPffqdiC47reQ3iZeAFqMmP8thwfBqyj4eyfsWr"
    );
    expect(selected.scale).toBe(1.3);
    expect(fetchMock).not.toHaveBeenCalled();
});

test("custom avatar metadata stays outside the modern renderer graph", async () => {
    const fallback = await adapter.resolveLobbyAvatar({
        walletId: "owner",
        settings: { vrm: "custom-id" },
    });
    expect(fallback.url).toBe(adapter.DEFAULT_LOBBY_AVATAR_URL);
    const resolved = await adapter.resolveLobbyAvatar({
        vrmUrl: "/resolved-custom.vrm",
        settings: { default_vrm_scale: 1.2 },
    });
    expect(resolved).toMatchObject({ url: "/resolved-custom.vrm", scale: 1.2 });
    expect(fetchMock).not.toHaveBeenCalled();
    const source = fs.readFileSync(
        path.join(process.cwd(), "features/lobby/webgpu/avatarAdapter.ts"),
        "utf8"
    );
    expect(source).not.toMatch(/@api\/|loadmixamoanimation/);
});

test("prewarm is consumed once; peers receive independent skeletons without refetching model bytes", async () => {
    const source = await adapter.preloadLobbyAvatar();
    expect(mockParses).toHaveLength(1);
    const local = await adapter.createAvatar(source.url);
    expect(mockParses).toHaveLength(1);
    const peer = await adapter.createAvatar(source.url, { scale: 1.4 });
    expect(mockParses).toHaveLength(2);
    expect(peer.root).not.toBe(local.root);
    expect(peer.root.children[0]).not.toBe(local.root.children[0]);
    expect(peer.height).toBeCloseTo(2.52);
    expect(
        fetchMock.mock.calls.filter(([url]) => url === source.url)
    ).toHaveLength(1);
    local.dispose();
    expect(mockDisposed).toContain(local.root);
    expect(mockDisposed).not.toContain(peer.root);
    peer.update(0.016, "RUN");
    expect(mockParses[1].update).toHaveBeenLastCalledWith(0.016);
    peer.dispose();
});

test("native wire index zero waves; other emotes load only on demand and locomotion supersedes a pending emote", async () => {
    const avatar = await adapter.createAvatar();
    avatar.update(0.016, 0);
    expect(mockPlayed.at(-1)).toBe("WAVING");
    expect(fetchMock.mock.calls.some(([url]) => url.includes("emotes"))).toBe(
        false
    );
    const emote = avatar.playEmote(14);
    avatar.update(0.016, "WALK");
    await emote;
    expect(mockPlayed.at(-1)).toBe("WALK");
    expect(mockParses[0].humanoid.resetNormalizedPose).toHaveBeenCalled();
    await avatar.playEmote(14);
    expect(mockPlayed.at(-1)).toBe("SITTALKING");
    avatar.dispose();
});

test("an aborted consumer disposes a late model without poisoning a peer's cached bytes", async () => {
    const controller = new AbortController();
    const abandoned = adapter.createAvatar("/selected.vrm", {
        signal: controller.signal,
    });
    controller.abort();
    await expect(abandoned).rejects.toMatchObject({ name: "AbortError" });
    expect(mockDisposed).toHaveLength(1);
    const peer = await adapter.createAvatar("/selected.vrm");
    expect(mockDisposed).not.toContain(peer.root);
    expect(
        fetchMock.mock.calls.filter(([url]) => url === "/selected.vrm")
    ).toHaveLength(1);
    peer.dispose();
});

test("a failed selected avatar still consumes its warmed native fallback without reparsing", async () => {
    fetchMock.mockImplementation(async (url: string) => ({
        ok: url !== "/missing.vrm",
        status: 404,
        arrayBuffer: async () =>
            url.includes("motion")
                ? encoded({ IDLE: rawClip("IDLE") })
                : new ArrayBuffer(8),
    }));
    const source = await adapter.preloadLobbyAvatar("/missing.vrm");
    const avatar = await adapter.createAvatar(source.url);
    expect(avatar.sourceUrl).toBe("/models/pfp.vrm");
    expect(mockParses).toHaveLength(1);
    avatar.dispose();
});

test("delivered motion and emote data is unchanged from Oncyber's native animation library", () => {
    const native = JSON.parse(
        fs.readFileSync(
            path.join(
                process.cwd(),
                "components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/animations/compute2.json"
            ),
            "utf8"
        )
    );
    const delivered = Object.assign(
        {},
        ...["motion", "emotes"].map((kind) =>
            JSON.parse(
                fs.readFileSync(
                    path.join(
                        process.cwd(),
                        `public/lobby/native-avatar-${kind}.json`
                    ),
                    "utf8"
                )
            )
        )
    );
    for (const [name, clip] of Object.entries(delivered)) {
        expect(clip).toEqual(
            native.find((entry: any) => entry.name.toUpperCase() === name)
        );
    }
    for (const { name } of adapter.LOBBY_EMOTES)
        expect(delivered[name]).toBeDefined();
});

test("warm-cache eviction disposes unused models while leaving an already borrowed avatar alive", async () => {
    await adapter.preloadLobbyAvatar("/one.vrm");
    const live = await adapter.createAvatar("/one.vrm");
    await adapter.preloadLobbyAvatar("/two.vrm");
    const unusedRoot = mockParses[1].scene.parent;
    await adapter.preloadLobbyAvatar("/three.vrm");
    await adapter.preloadLobbyAvatar("/four.vrm");
    expect(mockDisposed).toContain(unusedRoot);
    expect(mockDisposed).not.toContain(live.root);
    live.update(0.016, "WALK");
    expect(mockParses[0].update).toHaveBeenLastCalledWith(0.016);
    live.dispose();
});

test("a profile texture that finishes after its avatar leaves is disposed", async () => {
    const THREE = require("three/webgpu");
    const texture = new THREE.Texture();
    const dispose = jest.spyOn(texture, "dispose");
    let finish: (texture: any) => void;
    jest.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const avatar = await adapter.createAvatar("/profile.vrm", {
        profilePhoto: "/picture.png",
    });
    avatar.dispose();
    finish(texture);
    // The load now includes the portrait-recovery catch before cancellation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dispose).toHaveBeenCalledTimes(1);
});

test("baked skin matrices reproduce native deformation in root-local space, including terminal frames", async () => {
    const THREE = require("three/webgpu");
    mockAvatarKind = "skinned";
    const source = await adapter.createAvatar("/skin.vrm", { scale: 1.4 });
    const reference = await adapter.createAvatar("/skin.vrm", { scale: 1.4 });
    source.root.position.set(12, 3, -7);
    source.root.rotation.y = 0.8;
    reference.root.position.copy(source.root.position);
    reference.root.rotation.copy(source.root.rotation);
    const clip = await source.bakeClip("IDLE", 4);
    expect(source.bakeParts[0]).toMatchObject({ boneCount: 1, isPfp: true });
    expect(clip).toMatchObject({
        name: "IDLE",
        frameCount: 5,
        fps: 4,
        duration: 1,
        loop: true,
        timeScale: 1,
    });
    for (let i = 0; i < 5; i++) reference.update(0.1, "IDLE");
    reference.root.updateMatrixWorld(true);
    const mesh = mockParses[1].scene.getObjectByName("Mask_pfp");
    const vertex = new THREE.Vector3().fromBufferAttribute(
        mesh.geometry.attributes.position,
        0
    );
    const expected = mesh
        .applyBoneTransform(0, vertex.clone())
        .applyMatrix4(mesh.matrixWorld);
    reference.root.worldToLocal(expected);
    const matrix = new THREE.Matrix4().fromArray(clip.parts[0], 2 * 16);
    const actual = vertex.clone().applyMatrix4(matrix);
    expect(actual.distanceTo(expected)).toBeLessThan(0.00001);
    // A repeat animation still needs its real last pose for GPU frame interpolation.
    expect(Array.from(clip.parts[0].slice(0, 16))).not.toEqual(
        Array.from(clip.parts[0].slice(-16))
    );
    expect(source.bakeParts[0].geometry).toBe(
        mockParses[0].scene.getObjectByName("Mask_pfp").geometry
    );
    source.dispose();
    reference.dispose();
});

test("concurrent clip bakes cache results and restore the source's live animation without accumulating scale", async () => {
    mockAvatarKind = "skinned";
    const source = await adapter.createAvatar("/skin.vrm", { scale: 1.7 });
    const reference = await adapter.createAvatar("/skin.vrm", { scale: 1.7 });
    for (let i = 0; i < 3; i++) {
        source.update(0.1, "IDLE");
        reference.update(0.1, "IDLE");
    }
    const hips = mockParses[0].humanoid.getNormalizedBoneNode();
    const beforePosition = hips.position.clone();
    const beforeRotation = hips.quaternion.clone();
    const beforeScale = source.root.scale.clone();
    const idle = source.bakeClip("IDLE", 8);
    expect(source.bakeClip("IDLE", 8)).toBe(idle);
    const jump = source.bakeClip("JUMP", 8);
    const [a, b] = await Promise.all([idle, jump]);
    expect(b.timeScale).toBe(0.5);
    expect(Array.from(a.parts[0])).toEqual(Array.from(b.parts[0]));
    expect(hips.position.distanceTo(beforePosition)).toBeLessThan(0.00001);
    expect(hips.quaternion.angleTo(beforeRotation)).toBeLessThan(0.00001);
    expect(source.root.scale.equals(beforeScale)).toBe(true);
    source.update(0.1, "IDLE");
    reference.update(0.1, "IDLE");
    expect(
        hips.position.distanceTo(
            mockParses[1].humanoid.getNormalizedBoneNode().position
        )
    ).toBeLessThan(0.00001);
    source.dispose();
    reference.dispose();
});

test.each(["morph", "spring", "shader", "array"])(
    "%s avatars retain ordinary playback instead of entering the instancing path",
    async (kind) => {
        mockAvatarKind = kind;
        const avatar = await adapter.createAvatar();
        expect(avatar.bakeParts).toBeUndefined();
        expect(avatar.bakeClip).toBeUndefined();
        avatar.update(0.016, "RUN");
        expect(mockPlayed.at(-1)).toBe("RUN");
        avatar.dispose();
    }
);

test("baking yields to the browser and rejects cleanly if its source is disposed", async () => {
    const avatar = await adapter.createAvatar();
    const pending = avatar.bakeClip("IDLE", 30);
    setTimeout(() => avatar.dispose(), 0);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(avatar.bakeClip("WALK")).rejects.toMatchObject({
        name: "AbortError",
    });
    expect(mockDisposed.filter((root) => root === avatar.root)).toHaveLength(1);
});

test("custom clips cannot allocate beyond the bounded crowd sampling budget", async () => {
    mockClipDuration = 1000;
    const avatar = await adapter.createAvatar();
    await expect(avatar.bakeClip("IDLE")).rejects.toThrow("bake budget");
    avatar.update(0.016, "RUN");
    expect(mockPlayed.at(-1)).toBe("RUN");
    avatar.dispose();
});

test("a packed crowd clip can release its CPU cache without invalidating the owned sample", async () => {
    const source = await adapter.createAvatar("/release-bake.vrm");
    const first = await source.bakeClip("IDLE", 4);
    const sample = first.parts[0].slice();
    source.releaseBakedClip("IDLE", 4);
    const second = await source.bakeClip("IDLE", 4);
    expect(second).not.toBe(first);
    expect(first.parts[0]).toEqual(sample);
    expect(second.parts[0]).toEqual(sample);
    source.dispose();
});

test("the native diffuse material is shared by local playback and its crowd bake source", async () => {
    mockAvatarKind = "skinned";
    const avatar = await adapter.createAvatar("/native-shading.vrm");
    const mesh = mockParses[0].scene.getObjectByName("Mask_pfp");
    expect(mesh.material.type).toBe("MeshLambertNodeMaterial");
    expect(avatar.bakeParts[0].material).toBe(mesh.material);
    expect(mesh.material.envMap).toBeNull();
    avatar.update(0.016, "WALK");
    expect(mockPlayed.at(-1)).toBe("WALK");
    avatar.dispose();
});

test("semantic locomotion samples shared gait times without resetting actions, and explicit emotes can resume it", async () => {
    const THREE = require("three/webgpu");
    mockAvatarKind = "skinned";
    const clipAction = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction");
    const resets = jest.spyOn(THREE.AnimationAction.prototype, "reset");
    const avatar = await adapter.createAvatar("/semantic.vrm");
    const action = (name: string) =>
        clipAction.mock.results[
            clipAction.mock.calls.findIndex(([clip]: any) => clip.name === name)
        ].value;
    const motion = { speed: 3.2, grounded: true };
    avatar.update(0.016, undefined, motion);
    const resetCount = resets.mock.calls.length;
    for (let i = 0; i < 30; i++) avatar.update(0.016, undefined, motion);
    expect(resets).toHaveBeenCalledTimes(resetCount);
    expect(action("WALK").time).toBeCloseTo(action("RUN").time, 7);
    expect(action("WALK").getEffectiveWeight()).toBeGreaterThan(0);
    expect(action("RUN").getEffectiveWeight()).toBeGreaterThan(0);
    expect(avatar.motionClips.WALK.duration).toBe(1);
    avatar.update(0.1, 0, motion);
    avatar.update(0.1, 0, motion);
    expect(action("WAVING").getEffectiveWeight()).toBeCloseTo(1);
    const pendingEmote = avatar.playEmote(14);
    for (let i = 0; i < 30; i++) avatar.update(0.016, undefined, motion);
    await pendingEmote;
    expect(action("WAVING").getEffectiveWeight()).toBe(0);
    expect(action("SITTALKING").isScheduled()).toBe(false);
    expect(action("RUN").getEffectiveWeight()).toBeGreaterThan(0);
    avatar.dispose();
});

test("baking preserves semantic pose and a semantic request cancels an emote arriving during sampling", async () => {
    mockAvatarKind = "skinned";
    const avatar = await adapter.createAvatar("/semantic-bake.vrm");
    const motion = { speed: 3.2, grounded: true };
    for (let i = 0; i < 20; i++) avatar.update(0.016, undefined, motion);
    const hips = mockParses[0].humanoid.getNormalizedBoneNode();
    const before = hips.position.clone();
    const rotation = hips.quaternion.clone();
    await avatar.bakeClip("RUN", 30);
    expect(hips.position.distanceTo(before)).toBeLessThan(0.00001);
    expect(hips.quaternion.angleTo(rotation)).toBeLessThan(0.00001);
    const baking = avatar.bakeClip("WALK", 30);
    const emote = avatar.playEmote(14);
    avatar.update(0.016, undefined, motion);
    await Promise.all([baking, emote]);
    avatar.update(0.016, undefined, motion);
    expect(mockPlayed.at(-1)).not.toBe("SITTALKING");
    expect(hips.position.toArray().every(Number.isFinite)).toBe(true);
    avatar.dispose();
});

test("priming return in semantic rest preserves its idle clock and bones when controls release", async () => {
    const THREE = require("three/webgpu");
    mockAvatarKind = "skinned";
    // Keep the semantic clock away from the raw clip's loop boundary.
    jest.spyOn(Math, "random").mockReturnValue(0.37);
    const originalFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url: string) =>
        url.includes("native-avatar-emotes")
            ? {
                  ok: true,
                  arrayBuffer: async () =>
                      encoded({ PRAYING: rawClip("PRAYING") }),
              }
            : originalFetch(url)
    );
    const clipAction = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction");
    const resets = jest.spyOn(THREE.AnimationAction.prototype, "reset");
    const rest = {
        speed: 0,
        grounded: true,
        height: 0,
        verticalVelocity: 0,
        stopping: true,
        restConfirmed: true,
        procedural: false,
    };
    async function returnToLobby(semanticReturn: boolean) {
        const avatar = await adapter.createAvatar(
            semanticReturn ? "/return-semantic.vrm" : "/return-forced-idle.vrm"
        );
        const rig = mockParses.at(-1);
        await avatar.playEmote(9); // PRAYING is the departure meditation.
        avatar.update(0.1, 9, rest);
        avatar.update(0.1, 9, rest);
        const animation = semanticReturn ? undefined : "IDLE";
        // These are the hidden priming frames, before the retained lobby is shown.
        avatar.update(0.1, animation, rest);
        avatar.update(0.1, animation, rest);
        for (let frame = 0; frame < 66; frame++)
            avatar.update(1 / 60, animation, rest);
        const hips = rig.humanoid.getNormalizedBoneNode();
        const before = hips.position.clone();
        const rotation = hips.quaternion.clone();
        const idle = clipAction.mock.results
            .filter((result: any) => result.value?.getClip().name === "IDLE")
            .at(-1).value;
        const priorTime = idle.time;
        const resetCount = resets.mock.calls.length;
        const playCount = mockPlayed.length;
        // Travel presentation is now removed; normal controls feed the same rest input.
        avatar.update(1 / 60, undefined, rest);
        const result = {
            distance: hips.position.distanceTo(before),
            angle: hips.quaternion.angleTo(rotation),
            clockStep: idle.time - priorTime,
        };
        if (semanticReturn) {
            expect(resets).toHaveBeenCalledTimes(resetCount);
            expect(mockPlayed).toHaveLength(playCount);
            expect(idle.getEffectiveWeight()).toBeCloseTo(1);
        }
        avatar.dispose();
        return result;
    }
    const continuous = await returnToLobby(true);
    expect(continuous.clockStep).toBeCloseTo(1 / 60, 6);
    expect(continuous.distance).toBeLessThan(0.025);
    expect(continuous.angle).toBeLessThan(0.025);
    // Guard the fixture itself: forcing IDLE until release resumes a different
    // retained semantic clock and visibly jumps, even though both clips are idle.
    const forced = await returnToLobby(false);
    expect(forced.distance).toBeGreaterThan(continuous.distance * 3);
    expect(Math.abs(forced.clockStep - 1 / 60)).toBeGreaterThan(0.05);
});

test("travel prepares once, preserves crouch height and samples one-shots without frame-rate drift", async () => {
    const avatar = await adapter.createAvatar("/travel-samples.vrm");
    const hips = mockParses[0].humanoid.getNormalizedBoneNode();
    expect(mockTravelLoad).not.toHaveBeenCalled();
    expect(avatar.sampleTravelPose({ name: "TRAVEL_ATTACK", time: 0.4 })).toBe(
        false
    );
    await Promise.all([avatar.prepareTravel(), avatar.prepareTravel()]);
    expect(mockTravelLoad).toHaveBeenCalledTimes(1);
    expect(avatar.motionClips.TRAVEL_ATTACK.loop).toBe(false);
    expect(avatar.motionClips.TRAVEL_CROUCH_DOWN.loop).toBe(false);
    expect(avatar.motionClips.TRAVEL_CROUCH_IDLE.loop).toBe(true);
    expect(avatar.motionClips.TRAVEL_STAND_UP.loop).toBe(false);
    avatar.sampleTravelPose({ name: "TRAVEL_CROUCH_DOWN", time: 0 });
    const standing = hips.position.y;
    avatar.sampleTravelPose({ name: "TRAVEL_CROUCH_DOWN", time: 1 });
    const crouched = hips.position.y;
    expect(crouched).toBeCloseTo(standing * 0.5, 6);
    avatar.sampleTravelPose({ name: "TRAVEL_CROUCH_IDLE", time: 0.25 });
    const hold = hips.position.clone();
    avatar.sampleTravelPose({ name: "TRAVEL_CROUCH_IDLE", time: 120.25 });
    expect(hips.position.distanceTo(hold)).toBeLessThan(0.000001);
    avatar.sampleTravelPose({ name: "TRAVEL_STAND_UP", time: 0.5 });
    expect(hips.position.y).toBeCloseTo((standing + crouched) / 2, 6);
    avatar.sampleTravelPose({ name: "TRAVEL_STAND_UP", time: 90 });
    expect(hips.position.y).toBeCloseTo(standing, 6);
    avatar.sampleTravelPose({ name: "TRAVEL_STAND_UP", time: 0.5 });
    expect(hips.position.y).toBeCloseTo((standing + crouched) / 2, 6);
    expect(
        fetchMock.mock.calls.some(([url]) =>
            url.includes("native-avatar-emotes")
        )
    ).toBe(false);
    avatar.dispose();
});

test("travel blends authored poses, retries preparation and restores ordinary playback after cancellation", async () => {
    const avatar = await adapter.createAvatar("/travel-cancel.vrm");
    mockTravelLoad.mockRejectedValueOnce(new Error("temporary failure"));
    await expect(avatar.prepareTravel()).rejects.toThrow("temporary failure");
    await avatar.prepareTravel();
    const hips = mockParses[0].humanoid.getNormalizedBoneNode();
    avatar.sampleTravelPose({ name: "TRAVEL_CROUCH_DOWN", time: 0 });
    const standing = hips.position.y;
    avatar.sampleTravelPose({
        name: "TRAVEL_STAND_UP",
        time: 1,
        previous: { name: "TRAVEL_CROUCH_IDLE", time: 0 },
        blend: 0.25,
    });
    expect(hips.position.y).toBeCloseTo(standing * 0.625, 6);
    avatar.update(0.1, "IDLE");
    avatar.update(0.1, "IDLE");
    expect(mockPlayed.at(-1)).toBe("IDLE");
    avatar.update(0.1, "TRAVEL_ATTACK");
    avatar.update(0.1, "TRAVEL_ATTACK");
    const first = hips.position.y;
    avatar.update(0.1, "TRAVEL_ATTACK");
    expect(hips.position.y).not.toBeCloseTo(first, 8);
    avatar.dispose();
    expect(avatar.sampleTravelPose({ name: "TRAVEL_ATTACK", time: 0.5 })).toBe(
        false
    );
});

test("Flash prepares lazily, plays the supplied rise once and breathes in its hold until movement", async () => {
    const THREE = require("three/webgpu");
    const actionSpy = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction");
    const avatar = await adapter.createAvatar("/flash-hold.vrm");
    expect(mockFlashLoad).not.toHaveBeenCalled();
    await Promise.all([avatar.prepareFlash(), avatar.prepareFlash()]);
    expect(mockFlashLoad).toHaveBeenCalledTimes(1);
    expect(mockPlayed).not.toContain("FLASH_POINT");
    await avatar.playFlash();
    const action = actionSpy.mock.results.find(
        (result: any) => result.value.getClip().name === "FLASH_POINT"
    ).value;
    const rest = { speed: 0, grounded: true, procedural: false };
    avatar.update(0.1, undefined, rest);
    expect(action.time).toBeCloseTo(0.1, 6);
    const samples: number[] = [];
    for (let frame = 0; frame < 40; frame++) {
        avatar.update(0.1, undefined, rest);
        if (frame >= 10) samples.push(action.time);
    }
    // The hold sways a few frames back along the gesture instead of freezing.
    expect(Math.max(...samples)).toBeLessThanOrEqual(13 / 30);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(13 / 30 - 0.008);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.002);
    expect(action.getEffectiveWeight()).toBe(1);
    expect(action.loop).toBe(THREE.LoopOnce);
    expect(avatar.motionClips.FLASH_POINT.loop).toBe(false);
    const held = action.time;
    avatar.update(0.1, undefined, { ...rest, speed: 2 });
    const firstWeight = action.getEffectiveWeight();
    expect(firstWeight).toBeGreaterThan(0);
    expect(firstWeight).toBeLessThan(1);
    expect(action.time).toBeGreaterThan(held);
    avatar.update(0.1, undefined, { ...rest, speed: 2 });
    expect(action.getEffectiveWeight()).toBeGreaterThan(0);
    expect(action.getEffectiveWeight()).toBeLessThan(firstWeight);
    avatar.update(0.1, undefined, { ...rest, speed: 2 });
    expect(action.getEffectiveWeight()).toBeGreaterThan(0);
    avatar.update(0.02, undefined, { ...rest, speed: 2 });
    expect(action.getEffectiveWeight()).toBe(0);
    avatar.dispose();
});

test("ending a Flash lowers the arms through the rest of the take, then returns to idle", async () => {
    const THREE = require("three/webgpu");
    const actionSpy = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction");
    const avatar = await adapter.createAvatar("/flash-ending.vrm");
    await avatar.playFlash();
    const action = actionSpy.mock.results.find(
        (result: any) => result.value.getClip().name === "FLASH_POINT"
    ).value;
    const rest = { speed: 0, grounded: true, procedural: false };
    for (let frame = 0; frame < 20; frame++)
        avatar.update(0.1, undefined, rest);
    avatar.endFlash();
    avatar.update(0.1, undefined, rest);
    expect(action.time).toBeGreaterThan(13 / 30);
    for (let frame = 0; frame < 15; frame++)
        avatar.update(0.1, undefined, rest);
    expect(action.time).toBeCloseTo(action.getClip().duration, 6);
    for (let frame = 0; frame < 10; frame++)
        avatar.update(0.1, undefined, rest);
    expect(action.getEffectiveWeight()).toBe(0);
    avatar.dispose();
});

test("reduced-motion Flash presents the hold pose immediately and travel supersedes it", async () => {
    const THREE = require("three/webgpu");
    const actionSpy = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction");
    const avatar = await adapter.createAvatar("/flash-reduced.vrm");
    await avatar.playFlash({ reducedMotion: true });
    const action = actionSpy.mock.results.find(
        (result: any) => result.value.getClip().name === "FLASH_POINT"
    ).value;
    expect(action.time).toBeCloseTo(13 / 30, 6);
    expect(action.getEffectiveWeight()).toBe(1);
    await avatar.prepareTravel();
    expect(avatar.sampleTravelPose({ name: "TRAVEL_ATTACK", time: 0.25 })).toBe(
        true
    );
    expect(action.getEffectiveWeight()).toBe(0);
    avatar.dispose();
});

test.each(["stop", "move", "emote", "dispose"])(
    "%s invalidates a Flash while its asset is still loading",
    async (dismissal) => {
        let resolvePack: (value: unknown) => void;
        const pack = mockFlashPack();
        mockFlashLoad.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolvePack = resolve;
                })
        );
        const avatar = await adapter.createAvatar(
            `/flash-pending-${dismissal}.vrm`
        );
        const playing = avatar.playFlash();
        for (let tick = 0; tick < 6; tick++) await Promise.resolve();
        expect(mockFlashLoad).toHaveBeenCalledTimes(1);
        let emote: Promise<void> | undefined;
        if (dismissal === "stop") avatar.stopFlash();
        if (dismissal === "move")
            avatar.update(0.016, undefined, { speed: 1, grounded: true });
        if (dismissal === "emote") emote = avatar.playEmote(14);
        if (dismissal === "dispose") avatar.dispose();
        resolvePack(pack);
        await playing;
        await emote;
        expect(mockPlayed).not.toContain("FLASH_POINT");
        if (dismissal !== "dispose") avatar.dispose();
    }
);

test("Flash preparation retries after a failed asset without interrupting normal animation", async () => {
    mockFlashLoad.mockRejectedValueOnce(new Error("offline"));
    const avatar = await adapter.createAvatar("/flash-retry.vrm");
    await expect(avatar.playFlash()).rejects.toThrow("offline");
    avatar.update(0.016, undefined, { speed: 0, grounded: true });
    await avatar.playFlash();
    expect(mockFlashLoad).toHaveBeenCalledTimes(2);
    expect(mockPlayed).toContain("FLASH_POINT");
    avatar.stopFlash();
    avatar.dispose();
});

test("Techno plays at authored speed after locomotion instead of using its legacy blend factor", async () => {
    const THREE = require("three/webgpu");
    const spy = jest.spyOn(THREE.AnimationMixer.prototype, "clipAction");
    const avatar = await adapter.createAvatar();
    avatar.update(0.1, undefined, { speed: 0, grounded: true });
    const techno = adapter.LOBBY_EMOTES.find(
        (emote) => emote.name === "TECHNO"
    );
    await avatar.playEmote(techno.index);
    const action = spy.mock.results.find(
        (result: any) => result.value.getClip().name === "TECHNO"
    ).value;
    expect(action.getEffectiveTimeScale()).toBe(1);
    const before = action.time;
    avatar.update(0.1, "TECHNO");
    expect(action.time - before).toBeCloseTo(0.1, 6);
    avatar.dispose();
});

test("avatar replacement closes decoded bitmap sources, including retired profile materials", async () => {
    const THREE = require("three/webgpu");
    const avatar = await adapter.createAvatar("/bitmap-avatar.vrm");
    const bitmap = { width: 16, height: 16, close: jest.fn() };
    const color = new THREE.Texture(bitmap);
    const normal = new THREE.Texture(bitmap);
    const material = new THREE.MeshStandardMaterial({
        map: color,
        normalMap: normal,
    });
    avatar.root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const retiredBitmap = { width: 8, height: 8, close: jest.fn() };
    avatar.root.userData.lobbyRetiredMaterials = new Set([
        new THREE.MeshBasicMaterial({ map: new THREE.Texture(retiredBitmap) }),
    ]);
    avatar.dispose();
    avatar.dispose();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(retiredBitmap.close).toHaveBeenCalledTimes(1);
});
