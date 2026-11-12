import { isLobbyIdle } from "../idleVariants";
import { LOBBY_MOTION_CLIPS } from "../motionNames";
import { LOBBY_TRANSITIONS } from "../advancedMotion";
import { createCrowdPosture } from "../proceduralRig";
import * as THREE from "three/webgpu";
import {
    Fn,
    If,
    attribute,
    float as tslFloat,
    mat4,
    max,
    normalLocal,
    positionLocal,
    positionView,
    positionWorld,
    step,
    tangentLocal,
    texture as textureBinding,
    uint,
    uvec2,
    uv,
    vec4,
} from "three/tsl";
import { cloneNativeAvatarMaterial } from "./avatarMaterials";
import {
    createAvatar,
    LOBBY_EMOTES,
    type LobbyAvatar,
    type LobbyBakedClip,
} from "./avatarAdapter";
import { createLobbyLocomotion } from "../locomotion";
import { LOBBY_GUEST_PORTRAIT } from "../lobbyIdentity";

export const CROWD_PAGE_CAPACITY = 256;
const CAPACITY = CROWD_PAGE_CAPACITY;
const ATLAS_WIDTH = 1024;
const PORTRAIT_TILE_SIZE = 128;
const FADE_SECONDS = 0.18;
const MAX_ATLAS_BYTES = 32 * 1024 * 1024;
const toHalfFloat = THREE.DataUtils.toHalfFloat;
/** Per-visitor floats: frames A/B, blend, portrait tile, reveal front/band. */
const INSTANCE_STRIDE = 13;
/** Reveal front far above anyone: the avatar draws in full. */
const REVEAL_DONE = 1e5;

interface Options {
    signal?: AbortSignal;
    scale?: number;
    profilePhoto?: string;
}
interface Clip extends Omit<LobbyBakedClip, "parts"> {
    offset: number;
}
interface Instance {
    root: THREE.Group;
    page: Page;
    slot: number;
    portraitSlot: number;
    portraitUrl: string;
    current: Clip;
    previous: Clip;
    currentTime: number;
    previousTime: number;
    fade: number;
    requested: string;
    /** Build-up from the feet, 0 hidden to 1 whole; same look as the local arrival. */
    reveal: number;
    height: number;
    disposed: boolean;
}
interface Portrait {
    slot: number;
    refs: number;
    loaded: boolean;
}
interface Page {
    instances: Set<Instance>;
    slots: Set<number>;
    meshes: THREE.InstancedMesh[];
    matrices: THREE.InstancedBufferAttribute;
    data: THREE.InstancedInterleavedBuffer;
    a: THREE.InterleavedBufferAttribute;
    b: THREE.InterleavedBufferAttribute;
    blend: THREE.InterleavedBufferAttribute;
    portrait: THREE.InterleavedBufferAttribute;
    reveal: THREE.InterleavedBufferAttribute;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
    portraitNode: ReturnType<typeof textureBinding>;
    portraitColumns: number;
    portraits: Map<string, Portrait>;
    portraitSlots: Set<number>;
    portraitLoads: Map<number, HTMLImageElement>;
    disposed: boolean;
}
interface PartAtlas {
    data: Uint16Array;
    texture: THREE.DataTexture;
    /** All textureLoad nodes share this binding when the atlas grows. */
    node: ReturnType<typeof textureBinding>;
}
interface Model {
    source: LobbyAvatar;
    clips: Map<string, Clip>;
    pending: Map<string, Promise<Clip>>;
    failedMotionClips: Set<string>;
    pages: Page[];
    atlases: PartAtlas[];
    frameCount: number;
    disposed: boolean;
}
interface Entry {
    model?: Model;
    refs: number;
    promise: Promise<Model>;
}

function animationName(value: string | number) {
    return typeof value === "number"
        ? LOBBY_EMOTES[value]?.name || "IDLE"
        : value.toUpperCase();
}
function cancelled() {
    return new DOMException("Avatar loading cancelled", "AbortError");
}

/** Frame interpolation includes the terminal sample, including one-shot emotes. */
export function crowdClipFrames(clip: Clip, elapsed: number) {
    const time = Math.max(0, elapsed * clip.timeScale);
    const progress =
        clip.duration > 0
            ? (clip.loop
                  ? time % clip.duration
                  : Math.min(time, clip.duration)) / clip.duration
            : 0;
    const frame = progress * Math.max(0, clip.frameCount - 1);
    const first = Math.floor(frame);
    return [
        clip.offset + first,
        clip.offset + Math.min(first + 1, clip.frameCount - 1),
        frame - first,
    ];
}

/**
 * A baked matrix atlas expressed in TSL. Integer texel loads work on WebGPU
 * without float-texture filtering or GLSL patches. Skinning happens before the
 * renderer's instance transform, just as it does for a normal SkinnedMesh.
 */
export function configureCrowdSkinning(
    material: THREE.NodeMaterial,
    geometry: THREE.BufferGeometry,
    atlas: PartAtlas,
    boneCount: number
) {
    const indices = attribute("skinIndex", "uvec4");
    const weights = attribute("skinWeight", "vec4");
    const a = attribute("lobbyFrameA", "vec3");
    const b = attribute("lobbyFrameB", "vec3");
    const blend = attribute("lobbyBlend", "float");
    const texel = (index) => {
        const node = atlas.node.load(
            uvec2(index.mod(uint(ATLAS_WIDTH)), index.div(uint(ATLAS_WIDTH)))
        ) as unknown as ReturnType<typeof textureBinding>;
        // load() clones the base node and defaults to normalized UV transforms.
        // Bone matrices use integer pixel addresses and require neither UV work
        // nor a per-frame node update.
        node.updateMatrix = false;
        node.updateType = "none";
        return node;
    };
    // r180's runtime accepts four vector columns; the isolated type package only
    // declares the numeric overload. Keep this one conversion narrowly typed.
    const matrixFromColumns = mat4 as unknown as (
        a: ReturnType<typeof textureBinding>,
        b: ReturnType<typeof textureBinding>,
        c: ReturnType<typeof textureBinding>,
        d: ReturnType<typeof textureBinding>
    ) => ReturnType<typeof mat4>;
    const voidFn = Fn as unknown as (
        fn: () => void,
        type: "void"
    ) => () => void;
    const bone = (index, frame) => {
        const start = uint(frame).mul(uint(boneCount)).add(index).mul(uint(4));
        return matrixFromColumns(
            texel(start),
            texel(start.add(uint(1))),
            texel(start.add(uint(2))),
            texel(start.add(uint(3)))
        );
    };
    const pose = (frame) =>
        bone(indices.x, frame)
            .mul(weights.x)
            .add(bone(indices.y, frame).mul(weights.y))
            .add(bone(indices.z, frame).mul(weights.z))
            .add(bone(indices.w, frame).mul(weights.w));
    const interpolate = (frame) =>
        pose(frame.x)
            .mul(tslFloat(1).sub(frame.z))
            .add(pose(frame.y).mul(frame.z));
    const skin = voidFn(() => {
        const matrix = interpolate(b).toVar();
        If(blend.lessThan(1), () => {
            matrix.assign(
                interpolate(a)
                    .mul(tslFloat(1).sub(blend))
                    .add(matrix.mul(blend))
            );
        });
        positionLocal.assign(matrix.mul(vec4(positionLocal, 1)).xyz);
        if (geometry.hasAttribute("normal"))
            normalLocal.assign(matrix.mul(vec4(normalLocal, 0)).xyz);
        if (geometry.hasAttribute("tangent"))
            tangentLocal.assign(matrix.mul(vec4(tangentLocal, 0)).xyz);
    }, "void");
    const baseSetup = material.setupPosition;
    material.setupPosition = function (builder) {
        skin();
        return baseSetup.call(this, builder);
    };
    const baseKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () =>
        `lobby-webgpu-baked-v1-${boneCount}-${geometry.hasAttribute(
            "normal"
        )}-${geometry.hasAttribute("tangent")}-${baseKey()}`;
}

/**
 * The local avatar's arrival build-up (see createAvatarReveal in backend.ts),
 * per instance: a front rising from the feet, dithered by the same 0.016-unit
 * cell pattern. Returns the front's world height and the dither band.
 */
export function crowdRevealFront(amount: number, base: number, height: number) {
    if (!(amount < 0.9999)) return [REVEAL_DONE, 0];
    const size = Number.isFinite(height) && height > 0 ? Math.max(0.6, height) : 1.8;
    const band = size * 0.22;
    return [base + amount * (size + band * 2) - band, band];
}

function configureCrowdReveal(material: THREE.NodeMaterial) {
    const reveal = attribute("lobbyReveal", "vec2");
    const cell = positionView.negate().mod(0.016).sub(0.008).abs().div(0.008);
    const threshold = max(max(cell.x, cell.y), cell.z);
    const hidden = step(reveal.x.sub(reveal.y.mul(threshold)), positionWorld.y);
    material.opacityNode = tslFloat(1)
        .sub(hidden)
        .mul(material.opacityNode || tslFloat(material.opacity));
    material.alphaTest = Math.max(material.alphaTest, 0.001);
}

/** Shared GPU animation for the crowd; the local player can stay immediate/live. */
export class LobbyAvatarCrowd {
    private entries = new Map<string, Entry>();
    private disposed = false;
    private enabled: boolean;
    private maxTextureSize: number;
    private coordinateSystem: THREE.CoordinateSystem;
    private frustum = new THREE.Frustum();
    private projection = new THREE.Matrix4();
    private sphere = new THREE.Sphere();
    private worldScale = new THREE.Vector3();
    readonly stats = {
        instances: 0,
        visible: 0,
        batches: 0,
        models: 0,
        textureBytes: 0,
        crowdPages: 0,
        portraitBytes: 0,
        transformUploads: 0,
        animationUploads: 0,
    };

    constructor(
        private scene: THREE.Scene,
        renderer: THREE.WebGPURenderer,
        enabled = true
    ) {
        // The scene awaits renderer.init() before constructing the crowd.
        const backend = renderer.backend as THREE.WebGPURenderer["backend"] & {
            isWebGPUBackend?: boolean;
            isWebGLBackend?: boolean;
            device?: { limits: { maxTextureDimension2D: number } };
            gl?: WebGL2RenderingContext;
        };
        const limits = backend?.device?.limits;
        const gl = backend?.isWebGLBackend ? backend.gl : undefined;
        this.maxTextureSize =
            limits?.maxTextureDimension2D ||
            gl?.getParameter(gl.MAX_TEXTURE_SIZE) ||
            0;
        const hasVertexTextures =
            backend?.isWebGPUBackend ||
            (gl &&
                gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0 &&
                gl.getParameter(gl.MAX_VERTEX_ATTRIBS) >= 14);
        this.enabled =
            enabled &&
            !!hasVertexTextures &&
            this.maxTextureSize >= ATLAS_WIDTH;
        this.coordinateSystem =
            renderer.coordinateSystem ?? THREE.WebGPUCoordinateSystem;
    }

    private async createLiveAvatar(url: string, options: Options) {
        const avatar = await createAvatar(url, options);
        avatar.root.userData.lobbyNativeAvatar = true;
        return avatar;
    }

    async create(url: string, options: Options = {}): Promise<LobbyAvatar> {
        if (this.disposed || options.signal?.aborted) throw cancelled();
        if (!this.enabled) return this.createLiveAvatar(url, options);
        let entry = this.entries.get(url);
        if (!entry) {
            const owned: Entry = { refs: 0, promise: undefined };
            entry = owned;
            owned.promise = this.prepare(url, (model) => {
                owned.model = model;
                if (this.disposed || !owned.refs) this.disposeModel(model);
            });
            this.entries.set(url, entry);
        }
        entry.refs++;
        const release = () => {
            if (--entry.refs !== 0) return;
            if (this.entries.get(url) === entry) this.entries.delete(url);
            if (entry.model) this.disposeModel(entry.model);
            void entry.promise
                .then((model) => this.disposeModel(model))
                .catch(() => undefined);
        };
        let model: Model;
        try {
            model = await entry.promise;
            if (this.disposed || options.signal?.aborted) throw cancelled();
            const handle = this.addInstance(model, options);
            const dispose = handle.dispose;
            handle.dispose = () => {
                if (handle.root.userData.lobbyDisposed) return;
                handle.root.userData.lobbyDisposed = true;
                dispose();
                release();
            };
            return handle;
        } catch (error) {
            release();
            if (this.disposed || options.signal?.aborted) throw cancelled();
            // Morphs, spring bones and nonstandard materials keep native behavior.
            return this.createLiveAvatar(url, options);
        }
    }

    private async prepare(
        url: string,
        onModel: (model: Model) => void
    ): Promise<Model> {
        const source = await createAvatar(url);
        if (this.disposed || !source.bakeParts?.length || !source.bakeClip) {
            source.dispose();
            throw new Error("Avatar needs live animation");
        }
        const model: Model = {
            source,
            clips: new Map(),
            pending: new Map(),
            failedMotionClips: new Set(),
            pages: [],
            atlases: [],
            frameCount: 0,
            disposed: false,
        };
        onModel(model);
        try {
            if (model.disposed) throw cancelled();
            await this.ensureClip(model, "IDLE");
            if (this.disposed) throw cancelled();
            // Start drawing idle immediately; warm a bounded motion set once per
            // shared model, yielding between bakes. No per-visitor assets.
            if (source.motionClips?.START_L)
                void (async () => {
                    for (const name of [
                        ...LOBBY_MOTION_CLIPS.filter(
                            (name) =>
                                name !== "IDLE" &&
                                model.source.motionClips?.[name]
                        ),
                        ...LOBBY_TRANSITIONS,
                    ]) {
                        if (this.disposed || model.disposed) return;
                        try {
                            await this.ensureClip(model, name);
                        } catch {
                            model.failedMotionClips.add(name);
                        }
                    }
                })();
            return model;
        } catch (error) {
            this.disposeModel(model);
            throw error;
        }
    }

    private ensureClip(model: Model, name: string): Promise<Clip> {
        const ready = model.clips.get(name);
        if (ready) return Promise.resolve(ready);
        const pending = model.pending.get(name);
        if (pending) return pending;
        const work = model.source
            .bakeClip(name, 30)
            .then((baked) => {
                if (this.disposed || model.disposed) throw cancelled();
                // Grow on clip changes, never on animation frames or player arrival.
                const totalFrames = model.frameCount + baked.frameCount;
                const shapes = model.source.bakeParts.map((part) => {
                    const pixels = totalFrames * part.boneCount * 4;
                    const height = THREE.MathUtils.ceilPowerOfTwo(
                        Math.max(1, Math.ceil(pixels / ATLAS_WIDTH))
                    );
                    return { height, length: ATLAS_WIDTH * height * 4 };
                });
                if (
                    shapes.some(
                        (shape) => shape.height > this.maxTextureSize
                    ) ||
                    shapes.reduce((n, s) => n + s.length * 2, 0) >
                        MAX_ATLAS_BYTES
                ) {
                    throw new Error("Avatar animation atlas is full");
                }
                model.source.bakeParts.forEach((part, index) => {
                    const shape = shapes[index];
                    let atlas = model.atlases[index];
                    const data = new Uint16Array(shape.length);
                    if (atlas) data.set(atlas.data);
                    const start = model.frameCount * part.boneCount * 16;
                    const matrices = baked.parts[index];
                    for (let i = 0; i < matrices.length; i++)
                        data[start + i] = toHalfFloat(matrices[i]);
                    const texture = new THREE.DataTexture(
                        data,
                        ATLAS_WIDTH,
                        shape.height,
                        THREE.RGBAFormat,
                        THREE.HalfFloatType
                    );
                    texture.minFilter = texture.magFilter = THREE.NearestFilter;
                    texture.generateMipmaps = false;
                    texture.needsUpdate = true;
                    if (atlas) {
                        atlas.texture.dispose();
                        atlas.data = data;
                        atlas.texture = texture;
                        atlas.node.value = texture;
                    } else {
                        model.atlases[index] = {
                            data,
                            texture,
                            node: textureBinding(texture),
                        };
                    }
                });
                const { parts: _parts, ...metadata } = baked;
                const clip = { ...metadata, offset: model.frameCount };
                model.frameCount = totalFrames;
                model.clips.set(name, clip);
                return clip;
            })
            .finally(() => {
                model.source.releaseBakedClip?.(name, 30);
                model.pending.delete(name);
            });
        model.pending.set(name, work);
        return work;
    }

    private newPage(model: Model): Page {
        // WebGPU guarantees eight vertex buffers. Pack all per-visitor fields
        // together so avatar geometry and the portrait tile fit that baseline.
        const data = new THREE.InstancedInterleavedBuffer(
            new Float32Array(CAPACITY * INSTANCE_STRIDE),
            INSTANCE_STRIDE
        ).setUsage(THREE.DynamicDrawUsage);
        const instanceAttribute = (size: number, offset: number) =>
            new THREE.InterleavedBufferAttribute(data, size, offset);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = PORTRAIT_TILE_SIZE;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Portrait atlas unavailable");
        context.fillStyle = "#dce9ef";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        // Mipmapped: unfiltered portraits shimmer on distant head screens.
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        const page: Page = {
            instances: new Set(),
            slots: new Set(),
            meshes: [],
            matrices: new THREE.InstancedBufferAttribute(
                new Float32Array(CAPACITY * 16),
                16
            ).setUsage(THREE.DynamicDrawUsage),
            data,
            a: instanceAttribute(3, 0),
            b: instanceAttribute(3, 3),
            blend: instanceAttribute(1, 6),
            portrait: instanceAttribute(4, 7),
            reveal: instanceAttribute(2, 11),
            canvas,
            context,
            texture,
            portraitNode: textureBinding(texture),
            portraitColumns: 1,
            portraits: new Map(),
            portraitSlots: new Set(),
            portraitLoads: new Map(),
            disposed: false,
        };
        try {
            model.source.bakeParts.forEach((part, index) => {
                const geometry = part.geometry.clone();
                if (!geometry.getAttribute("skinIndex")) {
                    geometry.setAttribute(
                        "skinIndex",
                        new THREE.Float32BufferAttribute(
                            new Float32Array(
                                geometry.getAttribute("position").count * 4
                            ),
                            4
                        )
                    );
                    const weights = new Float32Array(
                        geometry.getAttribute("position").count * 4
                    );
                    for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
                    geometry.setAttribute(
                        "skinWeight",
                        new THREE.Float32BufferAttribute(weights, 4)
                    );
                }
                geometry.setAttribute("lobbyFrameA", page.a);
                geometry.setAttribute("lobbyFrameB", page.b);
                geometry.setAttribute("lobbyBlend", page.blend);
                geometry.setAttribute("lobbyPortrait", page.portrait);
                geometry.setAttribute("lobbyReveal", page.reveal);
                const material = (
                    part.isPfp
                        ? new THREE.MeshBasicNodeMaterial({
                              map: texture,
                              side: THREE.DoubleSide,
                          })
                        : cloneNativeAvatarMaterial(part.material)
                ) as THREE.NodeMaterial;
                if (!material.isNodeMaterial)
                    throw new Error(
                        "Crowd avatar requires a modern node material"
                    );
                if (part.isPfp) {
                    const portrait = attribute("lobbyPortrait", "vec4");
                    material.colorNode = page.portraitNode.sample(
                        portrait.xy.add(uv().mul(portrait.zw))
                    );
                }
                configureCrowdSkinning(
                    material,
                    geometry,
                    model.atlases[index],
                    part.boneCount
                );
                configureCrowdReveal(material);
                const mesh = new THREE.InstancedMesh(
                    geometry,
                    material,
                    CAPACITY
                );
                mesh.name = "lobby-instanced-avatar";
                mesh.instanceMatrix = page.matrices;
                mesh.userData.lobbyPortraitPart = part.isPfp;
                mesh.count = 0;
                // Per-visitor CPU culling below; Three cannot bound baked animation.
                mesh.frustumCulled = false;
                mesh.userData.lobbyCrowd = true;
                this.scene.add(mesh);
                page.meshes.push(mesh);
            });
            model.pages.push(page);
            return page;
        } catch (error) {
            this.disposePage(page);
            throw error;
        }
    }

    private growPortraitAtlas(page: Page, slot: number) {
        const columns = THREE.MathUtils.ceilPowerOfTwo(
            Math.ceil(Math.sqrt(slot + 1))
        );
        if (columns <= page.portraitColumns) return;
        const oldColumns = page.portraitColumns;
        let previous: HTMLCanvasElement;
        if ([...page.portraits.values()].some((portrait) => portrait.loaded)) {
            previous = document.createElement("canvas");
            previous.width = previous.height = page.canvas.width;
            previous.getContext("2d")?.drawImage(page.canvas, 0, 0);
        }
        page.canvas.width = page.canvas.height = columns * PORTRAIT_TILE_SIZE;
        page.context.fillStyle = "#dce9ef";
        page.context.fillRect(0, 0, page.canvas.width, page.canvas.height);
        page.portraitColumns = columns;
        if (previous)
            for (const portrait of page.portraits.values()) {
                if (!portrait.loaded) continue;
                page.context.drawImage(
                    previous,
                    (portrait.slot % oldColumns) * PORTRAIT_TILE_SIZE,
                    Math.floor(portrait.slot / oldColumns) * PORTRAIT_TILE_SIZE,
                    PORTRAIT_TILE_SIZE,
                    PORTRAIT_TILE_SIZE,
                    (portrait.slot % columns) * PORTRAIT_TILE_SIZE,
                    Math.floor(portrait.slot / columns) * PORTRAIT_TILE_SIZE,
                    PORTRAIT_TILE_SIZE,
                    PORTRAIT_TILE_SIZE
                );
            }
        // Texture dimensions are immutable after upload; replace the shared binding.
        const oldTexture = page.texture;
        const next = new THREE.CanvasTexture(page.canvas);
        next.flipY = false;
        next.colorSpace = THREE.SRGBColorSpace;
        // Mipmapped: unfiltered portraits shimmer on distant head screens.
        next.generateMipmaps = true;
        next.minFilter = THREE.LinearMipmapLinearFilter;
        page.texture = next;
        page.portraitNode.value = next;
        for (const mesh of page.meshes)
            if (mesh.userData.lobbyPortraitPart)
                (mesh.material as THREE.MeshBasicNodeMaterial).map = next;
        oldTexture.dispose();
    }

    private acquirePortrait(page: Page, url: string): number {
        const existing = page.portraits.get(url);
        if (existing) {
            existing.refs++;
            return existing.slot;
        }
        let slot = 0;
        while (page.portraitSlots.has(slot)) slot++;
        const portrait: Portrait = { slot, refs: 1, loaded: false };
        page.portraits.set(url, portrait);
        page.portraitSlots.add(slot);
        this.growPortraitAtlas(page, slot);
        const draw = () => ({
            x: (slot % page.portraitColumns) * PORTRAIT_TILE_SIZE,
            y: Math.floor(slot / page.portraitColumns) * PORTRAIT_TILE_SIZE,
        });
        const { x, y } = draw();
        page.context.fillStyle = "#dce9ef";
        page.context.fillRect(x, y, PORTRAIT_TILE_SIZE, PORTRAIT_TILE_SIZE);
        page.texture.needsUpdate = true;
        if (!url) return slot;
        const image = new Image();
        image.crossOrigin = "anonymous";
        page.portraitLoads.set(slot, image);
        image.onload = () => {
            if (
                page.portraitLoads.get(slot) !== image ||
                this.disposed ||
                page.disposed
            )
                return;
            try {
                const { x, y } = draw();
                page.context.drawImage(
                    image,
                    x + 1,
                    y + 1,
                    PORTRAIT_TILE_SIZE - 2,
                    PORTRAIT_TILE_SIZE - 2
                );
                portrait.loaded = true;
                page.texture.needsUpdate = true;
            } catch {
                /* Keep the neutral tile when the picture is unavailable. */
            }
            page.portraitLoads.delete(slot);
        };
        image.onerror = () => {
            if (page.portraitLoads.get(slot) !== image) return;
            // A dead or blocked picture shows the guest portrait, as spaces do.
            if (image.src !== LOBBY_GUEST_PORTRAIT) {
                image.src = LOBBY_GUEST_PORTRAIT;
                return;
            }
            page.portraitLoads.delete(slot);
        };
        image.src = url;
        return slot;
    }

    private releasePortrait(page: Page, url: string) {
        const portrait = page.portraits.get(url);
        if (!portrait || --portrait.refs) return;
        page.portraits.delete(url);
        page.portraitSlots.delete(portrait.slot);
        const image = page.portraitLoads.get(portrait.slot);
        if (image) image.onload = image.onerror = null;
        page.portraitLoads.delete(portrait.slot);
    }

    private addInstance(model: Model, options: Options): LobbyAvatar {
        const page =
            model.pages.find(
                (candidate) => candidate.instances.size < CAPACITY
            ) || this.newPage(model);
        let slot = 0;
        while (page.slots.has(slot)) slot++;
        page.slots.add(slot);
        const root = new THREE.Group();
        root.name = "oncyber-lobby-avatar-instance";
        root.position.copy(model.source.root.position);
        root.quaternion.copy(model.source.root.quaternion);
        const scale =
            Number.isFinite(options.scale) && options.scale > 0
                ? THREE.MathUtils.clamp(options.scale, 0.2, 4)
                : 1;
        root.scale.copy(model.source.root.scale).multiplyScalar(scale);
        const updatePosture = createCrowdPosture(
            THREE as unknown as Parameters<typeof createCrowdPosture>[0],
            root as unknown as Parameters<typeof createCrowdPosture>[1]
        );
        const idle = model.clips.get("IDLE");
        const seed = Math.random();
        const phase = seed * idle.duration;
        const locomotion = createLobbyLocomotion(
            model.source.motionClips || {},
            seed,
            (name) => {
                warmMotionClip(name);
                return model.clips.has(name);
            }
        );
        const instance: Instance = {
            root,
            page,
            slot,
            portraitSlot: this.acquirePortrait(
                page,
                options.profilePhoto || ""
            ),
            portraitUrl: options.profilePhoto || "",
            current: idle,
            previous: idle,
            currentTime: phase,
            previousTime: phase,
            fade: FADE_SECONDS,
            requested: "IDLE",
            reveal: 1,
            height: model.source.height * scale,
            disposed: false,
        };
        page.instances.add(instance);
        let usingMotion = false;
        let recovery = 0;
        let recoveryClip = idle;
        let recoveryTime = phase;
        const holdMotionPose = () => {
            // Two existing shader slots also bound recovery from lazy clips/emotes.
            // Retain the dominant displayed pose until the requested samples exist.
            const useCurrent = instance.fade >= FADE_SECONDS / 2;
            recoveryClip = useCurrent ? instance.current : instance.previous;
            recoveryTime = useCurrent
                ? instance.currentTime
                : instance.previousTime;
            recovery = 0;
        };
        const warmMotionClip = (name: string) => {
            if (
                model.clips.has(name) ||
                model.pending.has(name) ||
                model.failedMotionClips.has(name)
            )
                return;
            // A completion only populates the shared cache. It never selects an
            // instance pose, so a late bake cannot interrupt a newer emote.
            void this.ensureClip(model, name).catch(() => {
                model.failedMotionClips.add(name);
            });
        };
        const select = async (name: string) => {
            usingMotion = false;
            instance.requested = name;
            const clip = await this.ensureClip(model, name);
            if (
                instance.disposed ||
                instance.requested !== name ||
                clip === instance.current
            )
                return;
            // Semantic motion may keep a low-weight secondary in current.
            // Fade from the displayed dominant pose, not that secondary slot.
            const useCurrent = instance.fade >= FADE_SECONDS / 2;
            instance.previous = useCurrent
                ? instance.current
                : instance.previous;
            instance.previousTime = useCurrent
                ? instance.currentTime
                : instance.previousTime;
            instance.current = clip;
            instance.currentTime = 0;
            instance.fade = 0;
        };
        return {
            root,
            height: model.source.height * scale,
            sourceUrl: model.source.sourceUrl,
            update: (dt, animation, motion) => {
                if (instance.disposed) return;
                const step = Math.max(
                    0,
                    Math.min(Number.isFinite(dt) ? dt : 0, 0.1)
                );
                instance.currentTime += step;
                if (instance.fade < FADE_SECONDS) instance.previousTime += step;
                instance.fade = Math.min(FADE_SECONDS, instance.fade + step);
                if (motion && animation === undefined) {
                    if (!usingMotion) holdMotionPose();
                    usingMotion = true;
                    instance.requested = "@locomotion";
                    const pose = locomotion.update(step, motion);
                    updatePosture(step, motion, pose);
                    warmMotionClip(pose.primary.name);
                    if (pose.blend > 0) warmMotionClip(pose.secondary.name);
                    const requestedPrimary = model.clips.get(pose.primary.name);
                    let primary = requestedPrimary;
                    let secondary =
                        pose.blend > 0
                            ? model.clips.get(pose.secondary.name)
                            : primary;
                    // A full atlas or rejected bake degrades to an available gait;
                    // only a genuinely pending clip should hold the previous pose.
                    if (
                        !primary &&
                        model.failedMotionClips.has(pose.primary.name)
                    )
                        primary = isLobbyIdle(pose.primary.name)
                            ? idle
                            : secondary || model.clips.get("WALK") || idle;
                    if (
                        !secondary &&
                        (pose.blend === 0 ||
                            model.failedMotionClips.has(pose.secondary.name))
                    )
                        secondary = primary;
                    if (!primary || !secondary) {
                        holdMotionPose();
                        return;
                    }
                    // The controller supplies authored seconds; baked metadata
                    // still applies native timeScale at frame lookup.
                    const primaryTime =
                        primary === requestedPrimary
                            ? pose.primary.time / (primary.timeScale || 1)
                            : primary.name === pose.secondary.name
                            ? pose.secondary.time / (primary.timeScale || 1)
                            : primary === instance.current
                            ? instance.currentTime
                            : primary === instance.previous
                            ? instance.previousTime
                            : 0;
                    const secondaryTime =
                        secondary === primary
                            ? primaryTime
                            : pose.secondary.time / (secondary.timeScale || 1);
                    recovery += step;
                    if (recovery < FADE_SECONDS) {
                        recoveryTime += step;
                        instance.previous = recoveryClip;
                        instance.previousTime = recoveryTime;
                        instance.current = primary;
                        instance.currentTime = primaryTime;
                        instance.fade = recovery;
                    } else if (pose.blend > 0 && secondary !== primary) {
                        instance.previous = primary;
                        instance.previousTime = primaryTime;
                        instance.current = secondary;
                        instance.currentTime = secondaryTime;
                        // Introduce the second semantic pose after the held pose
                        // has faded out, without requiring a third shader layer.
                        instance.fade =
                            FADE_SECONDS *
                            pose.blend *
                            Math.min(
                                1,
                                (recovery - FADE_SECONDS) / FADE_SECONDS
                            );
                    } else {
                        instance.previous = instance.current = primary;
                        instance.previousTime = instance.currentTime =
                            primaryTime;
                        instance.fade = FADE_SECONDS;
                    }
                    return;
                }
                updatePosture(step);
                usingMotion = false;
                const name =
                    animation === undefined
                        ? instance.requested
                        : animationName(animation);
                if (name !== instance.requested)
                    void select(name).catch(() => undefined);
            },
            playEmote: (animation) => select(animationName(animation)),
            setReveal: (amount) => {
                instance.reveal = Math.max(0, Math.min(1, amount));
            },
            dispose: () => {
                if (instance.disposed) return;
                instance.disposed = true;
                root.removeFromParent();
                page.instances.delete(instance);
                page.slots.delete(slot);
                this.releasePortrait(page, instance.portraitUrl);
                if (!page.instances.size) {
                    this.disposePage(page);
                    model.pages.splice(model.pages.indexOf(page), 1);
                }
            },
        };
    }

    /** Upload only transforms/frame indices. Bone textures are immutable between clip loads. */
    flush(camera: THREE.Camera) {
        this.stats.instances =
            this.stats.visible =
            this.stats.batches =
            this.stats.models =
            this.stats.textureBytes =
            this.stats.crowdPages =
            this.stats.portraitBytes =
            this.stats.transformUploads =
            this.stats.animationUploads =
                0;
        this.projection.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(
            this.projection,
            this.coordinateSystem,
            camera.reversedDepth ?? false
        );
        for (const entry of this.entries.values()) {
            // Resolved models are attached by the create promise below.
            const model = entry.model;
            if (!model || model.disposed) continue;
            this.stats.models++;
            this.stats.textureBytes += model.atlases.reduce(
                (n, atlas) => n + atlas.data.byteLength,
                0
            );
            for (const page of model.pages) {
                this.stats.crowdPages++;
                this.stats.portraitBytes +=
                    page.canvas.width * page.canvas.height * 4;
                let index = 0;
                let transformChanged = false;
                let animationChanged = false;
                const values = page.data.array;
                const matrices = page.matrices.array;
                const write = (offset: number, value: number) => {
                    value = Math.fround(value);
                    if (values[offset] === value) return;
                    values[offset] = value;
                    animationChanged = true;
                };
                const frames = (
                    clip: Clip,
                    elapsed: number,
                    offset: number
                ) => {
                    const time = Math.max(0, elapsed * clip.timeScale);
                    const progress =
                        clip.duration > 0
                            ? (clip.loop
                                  ? time % clip.duration
                                  : Math.min(time, clip.duration)) /
                              clip.duration
                            : 0;
                    const frame = progress * Math.max(0, clip.frameCount - 1);
                    const first = Math.floor(frame);
                    write(offset, clip.offset + first);
                    write(
                        offset + 1,
                        clip.offset + Math.min(first + 1, clip.frameCount - 1)
                    );
                    write(offset + 2, frame - first);
                };
                for (const instance of page.instances) {
                    this.stats.instances++;
                    instance.root.updateWorldMatrix(true, false);
                    this.worldScale.setFromMatrixScale(
                        instance.root.matrixWorld
                    );
                    this.sphere.center
                        .set(0, 0.9 / model.source.root.scale.y, 0)
                        .applyMatrix4(instance.root.matrixWorld);
                    this.sphere.radius =
                        (1.8 *
                            Math.max(
                                this.worldScale.x,
                                this.worldScale.y,
                                this.worldScale.z
                            )) /
                        model.source.root.scale.y;
                    if (
                        instance.reveal <= 0 ||
                        !this.frustum.intersectsSphere(this.sphere)
                    )
                        continue;
                    const offset = index * INSTANCE_STRIDE;
                    const blending = instance.fade < FADE_SECONDS;
                    if (blending)
                        frames(
                            instance.previous,
                            instance.previousTime,
                            offset
                        );
                    frames(instance.current, instance.currentTime, offset + 3);
                    write(
                        offset + 6,
                        Math.min(1, instance.fade / FADE_SECONDS)
                    );
                    const cell = 1 / page.portraitColumns;
                    const inset = 1.5 / page.canvas.width;
                    write(
                        offset + 7,
                        (instance.portraitSlot % page.portraitColumns) * cell +
                            inset
                    );
                    write(
                        offset + 8,
                        Math.floor(
                            instance.portraitSlot / page.portraitColumns
                        ) *
                            cell +
                            inset
                    );
                    write(offset + 9, cell - 2 * inset);
                    write(offset + 10, cell - 2 * inset);
                    const [front, band] = crowdRevealFront(
                        instance.reveal,
                        instance.root.matrixWorld.elements[13],
                        instance.height
                    );
                    write(offset + 11, front);
                    write(offset + 12, band);
                    const elements = instance.root.matrixWorld.elements;
                    for (let element = 0; element < 16; element++) {
                        const value = Math.fround(elements[element]);
                        const target = index * 16 + element;
                        if (matrices[target] !== value) {
                            matrices[target] = value;
                            transformChanged = true;
                        }
                    }
                    index++;
                }
                this.stats.visible += index;
                if (index) this.stats.batches += page.meshes.length;
                for (const mesh of page.meshes) {
                    mesh.count = index;
                }
                if (transformChanged) {
                    page.matrices.needsUpdate = true;
                    this.stats.transformUploads++;
                }
                if (animationChanged) {
                    page.data.needsUpdate = true;
                    this.stats.animationUploads++;
                }
            }
        }
    }

    private disposePage(page: Page) {
        if (page.disposed) return;
        page.disposed = true;
        for (const image of page.portraitLoads.values())
            image.onload = image.onerror = null;
        page.portraitLoads.clear();
        page.portraits.clear();
        page.portraitSlots.clear();
        for (const mesh of page.meshes) {
            mesh.removeFromParent();
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            mesh.dispose();
        }
        page.texture.dispose();
    }

    private disposeModel(model: Model) {
        if (model.disposed) return;
        model.disposed = true;
        model.pages.forEach((page) => this.disposePage(page));
        model.pages.length = 0;
        model.atlases.forEach((atlas) => atlas.texture.dispose());
        model.source.dispose();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const entry of this.entries.values()) {
            if (entry.model) this.disposeModel(entry.model);
            void entry.promise
                .then((model) => this.disposeModel(model))
                .catch(() => undefined);
        }
        this.entries.clear();
    }
}
