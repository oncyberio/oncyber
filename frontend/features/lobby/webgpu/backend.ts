import * as THREE from "three/webgpu";
import {
    cameraPosition,
    positionView,
    step,
    max,
    float as tslFloat,
    positionWorld,
    smoothstep,
    vec3,
    uniform,
    attribute,
    mix,
} from "three/tsl";
import { createAvatar, DEFAULT_LOBBY_AVATAR_URL } from "./avatarAdapter";
import { createStencilPortal } from "./stencilPortal";
import { LobbyAvatarCrowd } from "./avatarCrowd";
import { LOBBY_ENVIRONMENT } from "../lobbyEnvironment";
import { createNameTags } from "./nameTags";
import { LOBBY_FLOOR_DISSOLVE } from "../lobbyFloorDissolve";
import type { LobbySceneBackend } from "../createLobbyScene";

/** Pure rendering graph: webpack isolates all transitive Three imports here. */
export function createWebGPUBackend(forceWebGL = false): LobbySceneBackend {
    const backend = {
        three: THREE,
        createAvatar,
        createStencilPortal,
        createAvatarReveal(root) {
            // The avatar builds up from its feet: a rising front, dithered by
            // the same 0.016-unit cell pattern as the camera-collision fade.
            const amount = uniform(1);
            const base = uniform(0);
            const height = uniform(1.8);
            const box = new THREE.Box3().setFromObject(root);
            root.updateWorldMatrix(true, false);
            const rootY = root.matrixWorld.elements[13];
            const footOffset = Number.isFinite(box.min.y)
                ? box.min.y - rootY
                : 0;
            height.value = Number.isFinite(box.max.y)
                ? Math.max(0.6, box.max.y - box.min.y)
                : 1.8;
            const seen = new Set();
            root.traverse((object) => {
                for (const material of object.material
                    ? Array.isArray(object.material)
                        ? object.material
                        : [object.material]
                    : []) {
                    if (seen.has(material)) continue;
                    seen.add(material);
                    const cell = positionView
                        .negate()
                        .mod(0.016)
                        .sub(0.008)
                        .abs()
                        .div(0.008);
                    const threshold = max(max(cell.x, cell.y), cell.z);
                    const band = height.mul(0.22);
                    // amount 0: front below the feet; amount 1: above the head.
                    const front = base.add(
                        amount.mul(height.add(band.mul(2))).sub(band)
                    );
                    const hidden = step(
                        front.sub(band.mul(threshold)),
                        positionWorld.y
                    );
                    const visible = amount
                        .greaterThanEqual(0.9999)
                        .select(1, tslFloat(1).sub(hidden));
                    material.opacityNode = (
                        material.opacityNode || tslFloat(material.opacity)
                    ).mul(visible);
                    material.alphaTest = Math.max(material.alphaTest, 0.001);
                    material.needsUpdate = true;
                }
            });
            return (value) => {
                amount.value = value;
                root.updateWorldMatrix(true, false);
                base.value = root.matrixWorld.elements[13] + footOffset;
                root.visible = value > 0;
            };
        },
        defaultAvatarUrl: DEFAULT_LOBBY_AVATAR_URL,
        async createRenderer(canvas: HTMLCanvasElement) {
            const renderer = new THREE.WebGPURenderer({
                canvas,
                antialias: true,
                samples: 4,
                alpha: true,
                forceWebGL,
                powerPreference: "high-performance",
            });
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.NoToneMapping;
            // This controller owns requestAnimationFrame and per-frame statistics.
            renderer.info.autoReset = false;
            type DeviceBackend = typeof renderer.backend & {
                isWebGPUBackend?: boolean;
                device?: GPUDevice;
            };
            // WebGPURenderer may replace this backend while falling back during
            // init. Retain it so a partially initialized owned device is released.
            const initialBackend = renderer.backend as DeviceBackend;
            let device: GPUDevice | undefined;
            let disposed = false;
            let graphicsFailed = false;
            const reportLoss = () => {
                if (disposed || graphicsFailed) return;
                graphicsFailed = true;
                canvas.dispatchEvent(new Event("lobbycontextlost"));
            };
            const onValidationError = (event: GPUUncapturedErrorEvent) => {
                if (disposed || graphicsFailed) return;
                console.error(
                    "Lobby WebGPU validation failed",
                    event.error.message
                );
                reportLoss();
            };
            const disposeRenderer = renderer.dispose.bind(renderer);
            renderer.dispose = () => {
                if (disposed) return;
                disposed = true;
                device?.removeEventListener(
                    "uncapturederror",
                    onValidationError
                );
                // Destroying our device resolves its lost promise asynchronously.
                // A disposed renderer must never report loss to a reused canvas.
                renderer.onDeviceLost = () => undefined;
                try {
                    disposeRenderer();
                } finally {
                    const backends = [
                        initialBackend,
                        renderer.backend as DeviceBackend,
                    ];
                    const devices = new Set<GPUDevice>();
                    for (const owned of backends) {
                        if (owned.isWebGPUBackend && owned.device)
                            devices.add(owned.device);
                    }
                    // This factory never accepts an externally supplied device.
                    devices.forEach((owned) => owned.destroy());
                }
            };
            renderer.onDeviceLost = reportLoss;
            try {
                await renderer.init();
                if (graphicsFailed)
                    throw new Error(
                        "Lobby graphics device was lost during initialization"
                    );
                device = (renderer.backend as DeviceBackend).device;
                device?.addEventListener("uncapturederror", onValidationError);
            } catch (error) {
                renderer.dispose();
                throw error;
            }
            return renderer;
        },
        createCrowd: (
            scene: THREE.Scene,
            renderer: THREE.WebGPURenderer,
            enabled: boolean
        ) => new LobbyAvatarCrowd(scene, renderer, enabled),
        name: (renderer: THREE.WebGPURenderer) =>
            (
                renderer.backend as THREE.WebGPURenderer["backend"] & {
                    readonly isWebGPUBackend?: boolean;
                }
            ).isWebGPUBackend
                ? "webgpu"
                : "webgl2-modern",
        // Modern Three removed the legacy pi multiplier in its light shader.
        createNameTags,
        lightScale: Math.PI,
        // r180 uses a uniform buffer for <=1000 instance matrices, assuming a
        // 64 KiB limit. Some WebGL2 devices only allow 16 KiB. This capacity
        // selects r180's instanced vertex-buffer path while drawing only arrivals.
        shadowCapacity: 1024,
        compile: (
            renderer: THREE.WebGPURenderer,
            scene: THREE.Scene,
            camera: THREE.PerspectiveCamera
        ) => renderer.compileAsync(scene, camera),
        render(
            renderer: THREE.WebGPURenderer,
            scene: THREE.Scene,
            camera: THREE.PerspectiveCamera
        ) {
            renderer.info.reset();
            renderer.render(scene, camera);
        },
        stats: (renderer: THREE.WebGPURenderer) => ({
            draws: renderer.info.render.drawCalls,
            triangles: renderer.info.render.triangles,
        }),
        createFloorMaterial(_focus = new THREE.Vector3(), tiled = false) {
            const palette = LOBBY_ENVIRONMENT;
            const surfacePosition = tiled
                ? attribute("lobbyFloorSurface", "vec3")
                : positionWorld;
            const distance = surfacePosition.xz.sub(cameraPosition.xz).length();
            const cell = surfacePosition.xz
                .div(palette.gridSpacing)
                .toVar("lobbyCell");
            // Pixel footprint keeps the world-anchored grid crisp without moiré
            // at grazing angles. Fade each axis independently before it aliases.
            const footprint = cell
                .fwidth()
                .max(0.00001)
                .toVar("lobbyFootprint");
            const edge = cell.add(0.5).fract().sub(0.5).abs();
            const lines = tslFloat(1)
                .sub(smoothstep(footprint.mul(0.25), footprint, edge))
                .mul(tslFloat(1).sub(smoothstep(0.08, 0.5, footprint)));
            const grid = lines.x
                .max(lines.y)
                .mul(
                    tslFloat(1).sub(
                        smoothstep(
                            palette.gridFadeStart,
                            palette.gridFadeEnd,
                            distance
                        )
                    )
                );
            const floor = vec3(...palette.floor).add(
                vec3(...palette.grid).mul(grid)
            );
            const material = new THREE.MeshBasicNodeMaterial({
                name: "lobby-graphite-grid",
                side: THREE.FrontSide,
                toneMapped: false,
                fog: false,
            });
            const floorColor = mix(
                floor,
                vec3(...palette.clear),
                smoothstep(
                    palette.floorFadeStart,
                    palette.floorFadeEnd,
                    distance
                )
            );
            const brightness = uniform(1);
            material.userData.lobbyBrightness = brightness;
            material.colorNode = (
                tiled
                    ? floorColor.add(
                          vec3(...LOBBY_FLOOR_DISSOLVE.glow).mul(
                              attribute("lobbyTileGlow", "float")
                          )
                      )
                    : floorColor
            ).mul(brightness);
            return material;
        },
    };
    // Only the controller boundary crosses type versions. All scene objects,
    // loaders, materials and shader nodes inside this backend use r180 together.
    return backend as unknown as LobbySceneBackend;
}
