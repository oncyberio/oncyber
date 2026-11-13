import {
    TRAVEL_DEPARTURE_MS,
    TRAVEL_DISSOLVE_AT_MS,
} from "./worldTravelTiming";
import { getEmoteShortcutIndex } from "./emoteShortcuts";
import {
    createTravelGlowTexture,
    sampleTravelGlowAngle,
} from "./travelGlowTexture";
import { createTravelHaloText } from "./travelHaloText";
import {
    sampleTravelArrival,
    TRAVEL_ARRIVAL_MS,
} from "./travelAnimationSequence";
import {
    TRAVEL_ANIMATION_PLAY_MS,
    type TravelAnimationPose,
} from "./travelAnimationPack";
import { createLobbyFloorDissolve } from "./lobbyFloorDissolve";
import { advanceVelocity } from "../../../multiplayer/protocol/movement";
import {
    createLobbyJumpInput,
    lobbyKeyCode,
    readLobbyKeyboard,
} from "./lobbyControls";
import React, { useEffect, useRef } from "react";
import type * as THREE from "three";

import type { createAvatar as NativeAvatarFactory } from "./webgpu/avatarAdapter";
import type { LobbyAvatarCrowd } from "./webgpu/avatarCrowd";
import type { LobbySceneProps } from "./sceneTypes";
import { admitCrowd, crowdBudget } from "./crowdAdmission";
import { FrameTimings } from "./frameTimings";
import { createFlashPresentation } from "./flashPresentation";
import { TransitionFrameTimings } from "./transitionFrameTimings";
import {
    sampleTravelPresentation,
    travelParticipants,
    groupFormationParticipants,
    groupTravelPeers,
    sampleGroupGather,
} from "./travelPresentation";
import { LOBBY_ENVIRONMENT } from "./lobbyEnvironment";
import { orientTravelViewToHeading } from "./worldTravelCamera";
import type { LobbyTravelView } from "./lobbyJourneyProtocol";
import { createTravelPreviewWorld } from "./testing/createTravelPreviewWorld";
import type { LobbyMotionInput } from "./locomotion";
import { SpeechBubbles } from "./speechBubbles";
import {
    WORLD_TRAVEL_HANDOFF_MS,
    easeWorldTravelHandoff,
} from "./worldTravelPose";

export interface LobbySceneBackend {
    three: typeof THREE;
    createAvatar: typeof NativeAvatarFactory;
    createAvatarReveal?: (root: THREE.Object3D) => (amount: number) => void;
    /** The round energy portal (?travel=portal); WebGPU backend only. */
    createStencilPortal?: () => {
        group: THREE.Object3D;
        aperture: THREE.Mesh;
        setLive(enabled: boolean): void;
        setDestination(destination?: {
            imageUrl?: string;
            panoramaUrl?: string;
        }): void;
        update(frame: {
            time: number;
            opening: number;
            opacity: number;
            heading?: number;
            camera?: { position: { x: number; y: number; z: number } };
        }): void;
        dispose(): void;
    };
    defaultAvatarUrl: string;
    createRenderer: (
        canvas: HTMLCanvasElement
    ) => THREE.WebGLRenderer | Promise<THREE.WebGLRenderer>;
    createCrowd: (
        scene: THREE.Scene,
        renderer: THREE.WebGLRenderer,
        enabled: boolean
    ) => LobbyAvatarCrowd;
    createFloorMaterial: (
        focus?: THREE.Vector3,
        tiled?: boolean
    ) => THREE.Material;
    /** One-draw GPU name tags; see webgpu/nameTags.ts. */
    createNameTags?: (
        scene: THREE.Scene,
        capacity?: number
    ) => import("./webgpu/nameTags").NameTags;
    lightScale: number;
    shadowCapacity?: number;
    name: (renderer: THREE.WebGLRenderer) => string;
    render: (
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera
    ) => void;
    compile: (
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera
    ) => void | Promise<void>;
    stats: (renderer: THREE.WebGLRenderer) => {
        draws: number;
        triangles: number;
    };
}

const LOOK_HEIGHT = 1.2;
/** Matches the local arrival (avatarRevealSeconds when landing in the lobby). */
const REMOTE_ARRIVAL_REVEAL_SECONDS = 0.47;
// Travellers walk back from the return line at this pace (m/s), at most this long.
const SETTLE_SPEED = 1.7;
const SETTLE_MAX_MS = 9000;
function isEditing(target: EventTarget | null) {
    return (
        target instanceof Element &&
        !!target.closest(
            "input, textarea, select, button, a, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=menu], [role=textbox]"
        )
    );
}

/** A lightweight void using the real Oncyber VRMs and native animation clips. */
export function createLobbyScene(backend: LobbySceneBackend) {
    const THREE = backend.three;
    const createAvatar = backend.createAvatar;
    const DEFAULT_LOBBY_AVATAR_URL = backend.defaultAvatarUrl;
    return function LobbyScene(props: LobbySceneProps) {
        const hostRef = useRef<HTMLDivElement>(null);
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const labelRef = useRef<HTMLDivElement>(null);
        const touchRef = useRef<HTMLDivElement>(null);
        const latest = useRef(props);
        latest.current = props;
        const wakeRef = useRef<() => void>(() => undefined);

        useEffect(() => {
            const host = hostRef.current;
            const canvas = canvasRef.current;
            const labels = labelRef.current;
            const touch = touchRef.current;
            if (!host || !canvas || !labels || !touch) return;

            let cancelled = false;
            let cleanup: (() => void) | undefined;
            const failed = (error?: unknown) => {
                console.error("Lobby renderer initialization failed", error);
                if (!cancelled)
                    latest.current.onError(
                        "Your browser could not open the 3D lobby. You can still browse the worlds.",
                        "renderer"
                    );
            };
            function start(renderer: THREE.WebGLRenderer) {
                if (cancelled) {
                    renderer.dispose();
                    return;
                }
                host.dataset.renderer = backend.name(renderer);
                try {
                    cleanup = setup(renderer);
                } catch (error) {
                    renderer.dispose();
                    throw error;
                }
            }
            try {
                const pending = backend.createRenderer(canvas);
                if (pending instanceof Promise)
                    void pending.then(start).catch(failed);
                else start(pending);
            } catch (error) {
                failed(error);
            }
            return () => {
                cancelled = true;
                cleanup?.();
            };

            function setup(renderer: THREE.WebGLRenderer) {
                let disposed = false;
                let contextLost = false;
                let frame = 0;
                let lastTime = 0;
                const frameTimings = new FrameTimings();
                const transitionTimings =
                    process.env.NODE_ENV === "development"
                        ? new TransitionFrameTimings()
                        : null;
                let lastTransitionPublish = -Infinity;
                function publishTransitionTimings(time: number, force = false) {
                    if (!transitionTimings) return;
                    if (!force && time - lastTransitionPublish < 250) return;
                    const stats = transitionTimings.stats();
                    if (!stats) return;
                    canvas.dataset.travelFrameStats = JSON.stringify(stats);
                    lastTransitionPublish = time;
                }
                let population = 0;
                let nativeVisible = 0;
                let nativeReady = 0;
                let surrogateAvatars = 0;
                const nativeFrustum = new THREE.Frustum();
                const nativeProjection = new THREE.Matrix4();
                const nativeSphere = new THREE.Sphere();
                let entranceTime = 0;
                let ready = false;
                let compiling = 0;
                let width = 1;
                let height = 1;
                let lastMoveSent = 0;
                let lastPose = "";
                const planarVelocity = { vx: 0, vz: 0 };
                let verticalSpeed = 0;
                let jumpCount = 0;
                const jumpInput = createLobbyJumpInput();
                let jumpHeld = false;
                let emoteIndex = -1;
                let emoteNonce = -1;
                let previewMix = 0;
                let wasPreviewing = false;
                let previewYaw = 0;
                let avatarReveal = 1;
                let avatarRevealTarget = 1;
                // Swaps are quick; arriving in the lobby builds up slowly.
                let avatarRevealSeconds = 0.28;
                let setAvatarReveal: ((amount: number) => void) | undefined;
                let yaw = 0;
                let pitch = -0.28;
                let targetYaw = yaw;
                let targetPitch = pitch;
                // Use the same origin as prediction, including on renderer recovery.
                const initialPose = latest.current.initializePose?.();
                const position = new THREE.Vector3(
                    initialPose?.x ??
                        props.initialPosition?.x ??
                        (Math.random() - 0.5) * 4,
                    initialPose?.y ?? 0,
                    initialPose?.z ??
                        props.initialPosition?.z ??
                        (Math.random() - 0.5) * 4
                );
                const velocity = new THREE.Vector2();
                const correctionOffset = new THREE.Vector3();
                const displayPosition = position.clone();
                const keys = new Set<string>();
                const touchMovement = new THREE.Vector2();
                const projected = new THREE.Vector3();
                const reducedMotion = window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                );
                const geometries = new Set<THREE.BufferGeometry>();
                const materials = new Set<THREE.Material>();
                const textures = new Set<THREE.Texture>();
                const scene = new THREE.Scene();
                let previewWorld: ReturnType<typeof createTravelPreviewWorld>;
                const previewWorldAnchor = new THREE.Vector3();
                let previewWorldYaw = 0;
                let wasWorldPreview = false;
                let wasPreviewArrived = false;
                let previewArrivalStartedAt: number | undefined;
                let arrivalLocked = false;
                let arrivalPose: TravelAnimationPose | undefined;
                let arrivalCamera:
                    | {
                          startedAt: number;
                          yaw: number;
                          radius: number;
                          height: number;
                          focusHeight: number;
                      }
                    | undefined;
                const crowd = backend.createCrowd(
                    scene,
                    renderer,
                    props.crowdEnabled !== false
                );
                let lastStats = 0;
                let lastTraceTime = -Infinity;
                const environment = LOBBY_ENVIRONMENT;
                const backdrop = new THREE.Color().setRGB(...environment.clear);
                const arrivalBlack = new THREE.Color(0x000000);
                const departureBackdrop = backdrop.clone();
                scene.background = backdrop;
                scene.fog = new THREE.Fog(
                    backdrop,
                    environment.fogNear,
                    environment.fogFar
                );
                const travelAnchor = new THREE.Vector3();
                const travelCameraStart = new THREE.Vector3();
                const travelCameraFocusStart = new THREE.Vector3();
                const travelCameraTarget = new THREE.Vector3();
                const travelFocus = new THREE.Vector3();
                let travelCameraYaw = 0;
                let travelCameraRadius = 5;
                let travelStartedAt: number | undefined;
                let travelPhase: string | undefined;
                let travelPhaseStartedAt = 0;
                let completedReturn: number | undefined;
                let readyReturn: number | undefined;
                let returnRenderedAt: number | undefined;
                let returnView: LobbyTravelView | undefined;
                let travelYaw = 0;
                let gatheringId: string | undefined;
                const gathered = new Map<
                    string,
                    { at: number; origin: THREE.Vector3 }
                >();
                let travelVisual:
                    | ReturnType<typeof sampleTravelPresentation>
                    | undefined;
                const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 100);
                camera.rotation.set(pitch, yaw, 0, "YXZ");
                camera.position.set(
                    position.x,
                    LOOK_HEIGHT - Math.sin(pitch) * 5,
                    position.z + Math.cos(pitch) * 5
                );
                // MSAA alone resolves in linear HDR and still reads jagged on
                // avatar outlines, so supersample on top of it: 2x on 1x
                // screens, 1.5x on Retina, capped at 3. Drops back to the
                // native ratio if the frame rate can't keep up (see render()).
                const nativePixelRatio = Math.min(
                    window.devicePixelRatio || 1,
                    2
                );
                let supersampled = true;
                let supersampleCheck = 0;
                const supersampledPixelRatio = Math.min(
                    nativePixelRatio * (nativePixelRatio < 1.5 ? 2 : 1.5),
                    3
                );
                let currentPixelRatio = supersampledPixelRatio;
                renderer.setPixelRatio(supersampledPixelRatio);
                scene.add(
                    new THREE.AmbientLight(0xffffff, 0.42 * backend.lightScale)
                );
                const sunlight = new THREE.DirectionalLight(
                    0xffffff,
                    0.9 * backend.lightScale
                );
                sunlight.position.set(200, 200, 200);
                scene.add(sunlight);
                // A quiet edge light separates dark clothes from the black void.
                // Analytic light only: no shadow map, reflection or extra pass.
                const edgeLight = new THREE.DirectionalLight(
                    0xe7edff,
                    0.22 * backend.lightScale
                );
                edgeLight.position.set(-8, 6, -10);
                scene.add(edgeLight);
                const speechBubbles = new SpeechBubbles(labels);
                const speechPoint = new THREE.Vector3();
                const headOf = (id: string) => {
                    const visitor = id === "self" ? self : avatars.get(id);
                    if (
                        !visitor?.model ||
                        !visitor.group.visible ||
                        visitor.group.scale.x === 0
                    )
                        return undefined;
                    const position = visitor.group.position;
                    return {
                        x: position.x,
                        // The centre of their name tag.
                        y: position.y + (visitor.model.height || 1.8) + 0.12,
                        z: position.z,
                        name:
                            visitor === self
                                ? latest.current.selfName
                                : visitor.speechName,
                        photo:
                            visitor === self
                                ? latest.current.profilePhoto
                                : visitor.speechPhoto,
                    };
                };
                const projectSpeech = (point: {
                    x: number;
                    y: number;
                    z: number;
                }) => {
                    // One metre up from the point, to size the line like the tag.
                    speechPoint
                        .set(point.x, point.y + 1, point.z)
                        .project(camera);
                    const above = (-speechPoint.y * 0.5 + 0.5) * height;
                    speechPoint.set(point.x, point.y, point.z).project(camera);
                    return {
                        x: (speechPoint.x * 0.5 + 0.5) * width,
                        y: (-speechPoint.y * 0.5 + 0.5) * height,
                        scale: Math.abs(
                            (-speechPoint.y * 0.5 + 0.5) * height - above
                        ),
                        visible:
                            speechPoint.z > -1 &&
                            speechPoint.z < 1 &&
                            Math.abs(speechPoint.x) < 1.2 &&
                            Math.abs(speechPoint.y) < 1.2,
                    };
                };
                const nameTags = backend.createNameTags?.(
                    scene as unknown as Parameters<
                        NonNullable<LobbySceneBackend["createNameTags"]>
                    >[0],
                    64
                );

                function geometry<T extends THREE.BufferGeometry>(value: T): T {
                    geometries.add(value);
                    return value;
                }

                function material<T extends THREE.Material>(value: T): T {
                    materials.add(value);
                    return value;
                }

                const plane = geometry(new THREE.PlaneGeometry(1, 1));
                // A quiet grid fades into the horizon; contact shadows ground
                // avatars without a circular spotlight following their feet.
                const floorMaterial = material(
                    backend.createFloorMaterial(displayPosition)
                );
                const floor = new THREE.Mesh(plane, floorMaterial);
                floor.rotation.x = -Math.PI / 2;
                floor.scale.set(600, 600, 1);
                scene.add(floor);
                const departureFloor = createLobbyFloorDissolve(
                    THREE,
                    material(backend.createFloorMaterial(displayPosition, true))
                );
                scene.add(departureFloor.mesh);

                // A small procedural texture anchors visitors to an otherwise invisible floor.
                const shadowCanvas = document.createElement("canvas");
                shadowCanvas.width = shadowCanvas.height = 64;
                const context = shadowCanvas.getContext("2d");
                if (context) {
                    const gradient = context.createRadialGradient(
                        32,
                        32,
                        1,
                        32,
                        32,
                        32
                    );
                    gradient.addColorStop(0, "rgba(0, 0, 0, 0.58)");
                    gradient.addColorStop(0.35, "rgba(0, 0, 0, 0.24)");
                    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
                    context.fillStyle = gradient;
                    context.fillRect(0, 0, 64, 64);
                }
                const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
                textures.add(shadowTexture);
                const shadowMaterial = material(
                    new THREE.MeshBasicMaterial({
                        map: shadowTexture,
                        transparent: true,
                        depthWrite: false,
                        toneMapped: false,
                    })
                );
                function shadow(
                    parent: THREE.Object3D,
                    x: number,
                    z: number,
                    sx: number,
                    sz: number
                ) {
                    const mesh = new THREE.Mesh(plane, shadowMaterial);
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.set(x, 0.016, z);
                    mesh.scale.set(sx, sz, 1);
                    parent.add(mesh);
                    return mesh;
                }

                // Contact shadows share one draw too, rather than growing with the crowd.
                const crowdShadows = new THREE.InstancedMesh(
                    plane,
                    shadowMaterial,
                    backend.shadowCapacity || 512
                );
                crowdShadows.name = "lobby-crowd-shadows";
                crowdShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                crowdShadows.frustumCulled = false;
                crowdShadows.count = 0;
                scene.add(crowdShadows);
                const shadowMatrix = new THREE.Matrix4();
                const shadowRotation = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(-Math.PI / 2, 0, 0)
                );
                const shadowPosition = new THREE.Vector3();
                const shadowScale = new THREE.Vector3(1.4, 1.4, 1);

                type Avatar = Awaited<ReturnType<typeof createAvatar>>;
                type Visitor = {
                    group: THREE.Group;
                    /** Profile picture, shown beside what they say. */
                    speechPhoto?: string;
                    speechName?: string;
                    model?: Avatar;
                    /** Arrival build-up for other people, 0..1 while it plays. */
                    reveal?: number;
                    setReveal?: (amount: number) => void;
                    url?: string;
                    scale?: number;
                    photo?: string;
                    shadow?: THREE.Mesh;
                    request?: AbortController;
                    motion: LobbyMotionInput;
                    animationDelta?: number;
                    nativeSuppressed?: boolean;
                    returnIdleToken?: number;
                    returnIdleModel?: Avatar;
                    cinematic?: boolean;
                    flashing?: boolean;
                    modelFlashing?: boolean;
                    dismissedFlashNonce?: string;
                    flashOrigin?: { nonce: string; x: number; z: number };
                };
                function settleReturnIdle(visitor: Visitor) {
                    const travel = latest.current.travel;
                    if (
                        travel?.phase !== "return" ||
                        !visitor.model ||
                        (visitor.returnIdleToken === travel.startedAt &&
                            visitor.returnIdleModel === visitor.model)
                    )
                        return;
                    // The retained lobby rig was paused in its old departure pose.
                    // Finish its local idle crossfade before the first visible return frame.
                    Object.assign(visitor.motion, {
                        speed: 0,
                        grounded: true,
                        stopping: true,
                        restConfirmed: true,
                        postTeleportIdle: true,
                        stopDistance: 0,
                        height: 0,
                        verticalVelocity: 0,
                        jumpCount: 0,
                        turnRate: 0,
                        headingError: 0,
                        turnIntent: 0,
                        procedural: false,
                    });
                    // Keep the ready idle on its semantic clock after control release.
                    // A movement/action clears this preference, never a rest timer.
                    visitor.model.update(0.1, undefined, visitor.motion);
                    visitor.model.update(0.1, undefined, visitor.motion);
                    // Only the local native avatar supplies a playback phase.
                    // Seed after the hidden emote fade; consume it once so the
                    // ready idle keeps advancing throughout the lobby reveal.
                    if (
                        visitor === self &&
                        travel.returnView?.avatarIdleTime !== undefined
                    ) {
                        visitor.motion.postTeleportIdleTime =
                            travel.returnView.avatarIdleTime;
                        visitor.model.update(0, undefined, visitor.motion);
                        visitor.motion.postTeleportIdleTime = undefined;
                    }
                    visitor.returnIdleToken = travel.startedAt;
                    visitor.returnIdleModel = visitor.model;
                }
                const self: Visitor = {
                    group: new THREE.Group(),
                    motion: { speed: 0, grounded: true, quality: "full" },
                };
                self.group.name = "lobby-local-player";
                self.group.rotation.y = initialPose?.rotation || 0;
                const presentation = new THREE.Group();
                presentation.name = "lobby-avatar-turntable";
                self.group.add(presentation);
                self.shadow = shadow(self.group, 0, 0, 1.4, 1.4);
                scene.add(self.group);
                const avatars = new Map<string, Visitor>();
                let localFlashNonce: string | undefined;
                let dismissedFlashNonce: string | undefined;
                let readyFlashNonce: string | undefined;
                let flashMix = 0;
                const localFlashAllowed = () => {
                    const current = latest.current;
                    return (
                        current.active &&
                        !contextLost &&
                        !document.hidden &&
                        !current.travel &&
                        !current.groupFormation &&
                        !current.avatarPreview &&
                        !current.worldRevealPreview &&
                        current.flash?.nonce !== dismissedFlashNonce
                    );
                };
                function dismissLocalFlash() {
                    const flash = latest.current.flash;
                    readyFlashNonce = undefined;
                    if (!flash || flash.nonce === dismissedFlashNonce) return;
                    // React/network clear can arrive later than this input frame.
                    dismissedFlashNonce = flash.nonce;
                    latest.current.onFlashDismiss?.(flash.nonce);
                }
                const flashWarmed = new WeakSet<object>();
                const flashPresentation = createFlashPresentation(THREE, {
                    onTimeout: (flash) =>
                        latest.current.onFlashDismiss?.(flash.nonce),
                    onReady(flash) {
                        if (
                            !localFlashAllowed() ||
                            latest.current.flash?.nonce !== flash.nonce
                        )
                            return;
                        readyFlashNonce = flash.nonce;
                        const front = self.group.rotation.y + Math.PI;
                        targetYaw =
                            yaw +
                            Math.atan2(
                                Math.sin(front - yaw),
                                Math.cos(front - yaw)
                            );
                        targetPitch = -0.12;
                        if (reducedMotion.matches) {
                            yaw = targetYaw;
                            pitch = targetPitch;
                        }
                        latest.current.onFlashReady?.(flash);
                    },
                    onError(flash, message) {
                        if (
                            latest.current.flash?.nonce !== flash.nonce ||
                            dismissedFlashNonce === flash.nonce
                        )
                            return;
                        dismissedFlashNonce = flash.nonce;
                        readyFlashNonce = undefined;
                        latest.current.onFlashError?.(flash.nonce, message);
                    },
                });
                function clearFlashes() {
                    dismissLocalFlash();
                    flashPresentation.clear();
                    flashMix = 0;
                }
                // Shared core Three primitives work in both the legacy and WebGPU backends.
                const travelHaloMaterial = material(
                    new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0,
                        depthWrite: false,
                        toneMapped: false,
                        side: THREE.DoubleSide,
                    })
                );
                const travelHalo = new THREE.Mesh(
                    geometry(new THREE.RingGeometry(0.788, 0.797, 128)),
                    travelHaloMaterial
                );
                travelHalo.name = "lobby-travel-halo";
                travelHalo.rotation.x = -Math.PI / 2;
                travelHalo.visible = false;
                const travelGlowTexture = createTravelGlowTexture(THREE);
                textures.add(travelGlowTexture);
                const travelGlowMaterial = material(
                    new THREE.MeshBasicMaterial({
                        map: travelGlowTexture,
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0,
                        depthWrite: false,
                        toneMapped: false,
                        side: THREE.DoubleSide,
                    })
                );
                const travelGlow = new THREE.Mesh(
                    geometry(new THREE.PlaneGeometry(2, 2)),
                    travelGlowMaterial
                );
                travelGlow.name = "lobby-travel-glow";
                travelGlow.position.z = 0.001;
                travelHalo.add(travelGlow);
                // Travel draws no words: only the loading band rides the halo.
                const travelHaloText = createTravelHaloText(THREE);
                travelHalo.add(travelHaloText.group);
                scene.add(travelHalo);
                const travelLight = new THREE.PointLight(0xa6dcff, 0, 8, 2);
                scene.add(travelLight);
                const selectionGeometry = new THREE.RingGeometry(
                    0.48,
                    0.54,
                    32
                );
                const selectionMaterial = new THREE.MeshBasicMaterial({
                    color: 0x72e7ff,
                    transparent: true,
                    opacity: 0.9,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                });
                geometries.add(selectionGeometry);
                materials.add(selectionMaterial);
                const selectionRing = new THREE.Mesh(
                    selectionGeometry,
                    selectionMaterial
                );
                selectionRing.rotation.x = -Math.PI / 2;
                selectionRing.visible = false;
                scene.add(selectionRing);
                const pickRay = new THREE.Raycaster();
                const pickPoint = new THREE.Vector3();
                const pickBox = new THREE.Box3();
                // The round portal (the Oct 2026 profile portal, ported to
                // WebGPU) opens in front of the avatar when a space is chosen
                // with ?travel=portal. Walking into it (or clicking it) travels.
                const PORTAL_AHEAD = 4.4;
                const PORTAL_HEIGHT = 2.46;
                const PORTAL_OPEN_MS = 1050;
                let stencilPortal:
                    | ReturnType<
                          NonNullable<LobbySceneBackend["createStencilPortal"]>
                      >
                    | undefined;
                let portalKey: string | undefined;
                let portalPanorama: string | undefined;
                let portalOpenedAt = 0;
                let portalEntered = false;
                let portalLive = false;
                let portalCameraMix = 0;
                const portalForward = new THREE.Vector3();
                function enterPortal() {
                    if (portalEntered || !portalKey) return;
                    if (latest.current.portalActivated === false) {
                        latest.current.onActivatePortal?.();
                        return;
                    }
                    portalEntered = true;
                    latest.current.onEnterPortal?.();
                }
                function pickPortal(event: PointerEvent) {
                    if (
                        !portalKey ||
                        !stencilPortal ||
                        latest.current.portalActivated !== false
                    )
                        return false;
                    const rect = canvas.getBoundingClientRect();
                    if (!rect.width || !rect.height) return false;
                    pickRay.setFromCamera(
                        new THREE.Vector2(
                            ((event.clientX - rect.left) / rect.width) * 2 - 1,
                            1 - ((event.clientY - rect.top) / rect.height) * 2
                        ),
                        camera
                    );
                    if (
                        !pickRay.intersectObject(stencilPortal.aperture, false)
                            .length
                    )
                        return false;
                    enterPortal();
                    return true;
                }
                function updatePortal(now: number) {
                    // Walking through: the doorway stays exactly as it is
                    // until the cut into the loaded room.
                    if (
                        latest.current.travel?.viaPortal &&
                        portalKey &&
                        stencilPortal
                    ) {
                        stencilPortal.update({
                            time: now / 1000,
                            opening: 1,
                            opacity: 1,
                            camera,
                        });
                        return;
                    }
                    const next = latest.current.portal;
                    const key =
                        next && !latest.current.travel
                            ? `${next.id}:${next.href}`
                            : undefined;
                    if (key !== portalKey) {
                        portalKey = key;
                        portalEntered = false;
                        portalLive = false;
                        if (key && !backend.createStencilPortal) {
                            // No portal renderer here: travel straight away.
                            enterPortal();
                            return;
                        }
                        if (key && !stencilPortal) {
                            stencilPortal = backend.createStencilPortal();
                            scene.add(stencilPortal.group);
                        }
                        if (stencilPortal) stencilPortal.group.visible = !!key;
                        if (key) {
                            // Open it a few steps ahead, along the view.
                            portalForward.set(
                                -Math.sin(yaw),
                                0,
                                -Math.cos(yaw)
                            );
                            stencilPortal.group.position.set(
                                displayPosition.x +
                                    portalForward.x * PORTAL_AHEAD,
                                PORTAL_HEIGHT,
                                displayPosition.z +
                                    portalForward.z * PORTAL_AHEAD
                            );
                            stencilPortal.group.lookAt(
                                displayPosition.x,
                                PORTAL_HEIGHT,
                                displayPosition.z
                            );
                            portalOpenedAt = now;
                            portalPanorama = next.panoramaUrl;
                            stencilPortal.setDestination(next);
                        } else stencilPortal?.setDestination();
                    }
                    if (!portalKey || !stencilPortal) return;
                    if (next?.panoramaUrl !== portalPanorama) {
                        // The 360 arrived after the doorway opened.
                        portalPanorama = next?.panoramaUrl;
                        stencilPortal.setDestination(next);
                    }
                    const t = reducedMotion.matches
                        ? 1
                        : Math.min(1, (now - portalOpenedAt) / PORTAL_OPEN_MS);
                    // The doorway tears open quickly, then settles.
                    stencilPortal.update({
                        time: now / 1000,
                        opening: 1 - Math.pow(1 - t, 3),
                        opacity: Math.min(1, t * 2),
                        camera,
                    });
                    stencilPortal.group.updateWorldMatrix(true, false);
                    // Keep the room clipped until the camera clears the doorway too;
                    // otherwise the destination's exterior wall fills the handoff.
                    const doorway = stencilPortal.group.worldToLocal(
                        camera.position.clone()
                    );
                    if (
                        portalLive &&
                        t >= 0.8 &&
                        Math.abs(doorway.x) < 1.7 &&
                        doorway.z < 0.6 &&
                        doorway.z > -1
                    )
                        enterPortal();
                }
                function markSelection(id = latest.current.selectedAvatarId) {
                    const visitor = id === "self" ? self : avatars.get(id);
                    selectionRing.visible =
                        !latest.current.travel && !!visitor && !!id;
                    if (visitor)
                        selectionRing.position.set(
                            visitor.group.position.x,
                            0.027,
                            visitor.group.position.z
                        );
                }
                function pickAvatar(event: PointerEvent) {
                    if (
                        !latest.current.onSelectAvatar ||
                        !!latest.current.travel ||
                        arrivalLocked ||
                        !!latest.current.groupFormation ||
                        latest.current.avatarPreview
                    )
                        return;
                    const rect = canvas.getBoundingClientRect();
                    if (!rect.width || !rect.height) return;
                    pickRay.setFromCamera(
                        new THREE.Vector2(
                            ((event.clientX - rect.left) / rect.width) * 2 - 1,
                            1 - ((event.clientY - rect.top) / rect.height) * 2
                        ),
                        camera
                    );
                    let selected:
                        | { id: string; avatarUrl?: string }
                        | undefined;
                    let nearest = Infinity;
                    // Analytic bounds work for GPU-instanced avatars without skinned-mesh raycasts.
                    for (const [id, visitor] of [
                        ["self", self],
                        ...avatars.entries(),
                    ] as Array<[string, Visitor]>) {
                        if (!visitor.model) continue;
                        const p = visitor.group.position;
                        const height = visitor.model.height || 1.8;
                        const radius = height * 0.23;
                        pickBox.min.set(p.x - radius, p.y, p.z - radius);
                        pickBox.max.set(
                            p.x + radius,
                            p.y + height,
                            p.z + radius
                        );
                        if (!pickRay.ray.intersectBox(pickBox, pickPoint))
                            continue;
                        const distance = pickPoint.distanceToSquared(
                            pickRay.ray.origin
                        );
                        if (distance < nearest) {
                            nearest = distance;
                            selected = { id, avatarUrl: visitor.url };
                        }
                    }
                    if (selected) {
                        markSelection(selected.id);
                        latest.current.onSelectAvatar(selected);
                        if (
                            !latest.current.active &&
                            !compiling &&
                            !contextLost
                        )
                            backend.render(renderer, scene, camera);
                    }
                }

                // The visitor's own avatar URL that failed with nothing else on
                // screen. While the scene is still asked for it, the default
                // avatar loads instead; choosing anything else clears it.
                let failedAvatarUrl: string | undefined;
                const remoteQueue = new Map<Visitor, () => void>();
                const activeRemoteLoads = new Set<{
                    visitor: Visitor;
                    request: AbortController;
                }>();
                const nativeSources = new Set<string>();
                let activeLoads = 0;
                let admitted: ReturnType<typeof admitCrowd> = [];
                let previousSource: readonly unknown[];
                let lastAdmission = -Infinity;
                // After a trip, the travellers walk from their line back to their
                // own spots instead of jumping there.
                let lastFormationIds: Set<string> | null = null;
                const settling = new Map<string, number>();
                function drainLoads() {
                    if (
                        disposed ||
                        !remoteQueue.size ||
                        !latest.current.active ||
                        document.hidden
                    )
                        return;
                    const travel = latest.current.travel;
                    const allowed = travel
                        ? new Set(travel.partyIds.map((id) => avatars.get(id)))
                        : null;
                    const limit = crowdBudget(
                        latest.current.renderBudget
                    ).loadConcurrency;
                    // Let already-running crowd requests settle without restarting
                    // them on cancellation. They must neither start more crowd work
                    // nor occupy the slots needed by the visible travel party.
                    let running = allowed
                        ? Array.from(activeRemoteLoads).filter(
                              ({ visitor, request }) =>
                                  allowed.has(visitor) &&
                                  !request.signal.aborted
                          ).length
                        : activeLoads;
                    for (const [visitor, load] of remoteQueue) {
                        if (running >= limit) break;
                        if (
                            allowed &&
                            (!allowed.has(visitor) ||
                                (travel.phase !== "return" &&
                                    !visitor.cinematic))
                        )
                            continue;
                        remoteQueue.delete(visitor);
                        load();
                        running++;
                    }
                }

                // People appear at once in the default avatar, which is ready
                // first, and change into their own as each model finishes
                // preparing, instead of standing invisible until then.
                const readyUrls = new Set<string>();
                const warming = new Set<string>();
                const warmQueue: string[] = [];
                let warmActive = 0;
                function pumpWarm() {
                    while (warmActive < 3 && warmQueue.length && !disposed) {
                        const url = warmQueue.shift();
                        warmActive++;
                        crowd
                            .create(url)
                            .then((handle) => {
                                // Held, undrawn, just long enough for the
                                // people wearing it to take it over.
                                handle.setReveal?.(0);
                                handle.root.visible = false;
                                readyUrls.add(url);
                                setTimeout(() => handle.dispose(), 5000);
                            })
                            .catch(() => readyUrls.add(url))
                            .finally(() => {
                                warmActive--;
                                warming.delete(url);
                                pumpWarm();
                            });
                    }
                }
                function warmAvatar(url: string) {
                    if (readyUrls.has(url) || warming.has(url)) return;
                    warming.add(url);
                    warmQueue.push(url);
                    pumpWarm();
                }
                function loadVisitor(
                    visitor: Visitor,
                    url: string,
                    scale?: number,
                    local = false,
                    photo?: string,
                    cinematic = false,
                    flashing = false
                ) {
                    if (
                        !url ||
                        (visitor.url === url &&
                            visitor.scale === scale &&
                            visitor.photo === photo &&
                            visitor.cinematic === cinematic &&
                            visitor.flashing === flashing)
                    )
                        return;
                    visitor.request?.abort();
                    const request = new AbortController();
                    visitor.request = request;
                    visitor.url = url;
                    visitor.scale = scale;
                    visitor.photo = photo;
                    visitor.cinematic = cinematic;
                    visitor.flashing = flashing;
                    if (local && visitor.model) avatarRevealTarget = 0;
                    const hideUntil =
                        performance.now() +
                        (local && visitor.model && !reducedMotion.matches
                            ? 180
                            : 0);
                    if (local)
                        latest.current.onAvatarStatus?.({
                            url,
                            status: "loading",
                        });
                    const load =
                        local || cinematic || flashing
                            ? createAvatar
                            : crowd.create.bind(crowd);
                    const begin = () => {
                        if (disposed || request.signal.aborted) return;
                        const activeRequest = { visitor, request };
                        if (!local) {
                            activeLoads++;
                            activeRemoteLoads.add(activeRequest);
                        }
                        void load(url, {
                            signal: request.signal,
                            scale,
                            profilePhoto: photo,
                        })
                            .then(async (model) => {
                                try {
                                    if (local || cinematic)
                                        await model.prepareTravel?.();
                                } catch (error) {
                                    model.dispose();
                                    throw error;
                                }
                                if (disposed || request.signal.aborted) {
                                    model.dispose();
                                    return;
                                }
                                if (!local && !cinematic && !flashing)
                                    readyUrls.add(url);
                                if (
                                    !local &&
                                    !cinematic &&
                                    !flashing &&
                                    model.root.userData.lobbyNativeAvatar &&
                                    latest.current.crowdEnabled !== false
                                ) {
                                    nativeSources.add(url);
                                    // Keep a bounded capability cache as people change custom avatars.
                                    if (nativeSources.size > 64)
                                        nativeSources.delete(
                                            nativeSources.values().next().value
                                        );
                                    const nativeCount = Array.from(
                                        avatars.values()
                                    ).filter(
                                        (other) =>
                                            other !== visitor &&
                                            !other.modelFlashing &&
                                            other.model?.root.userData
                                                .lobbyNativeAvatar
                                    ).length;
                                    if (
                                        nativeCount >=
                                        crowdBudget(latest.current.renderBudget)
                                            .maxNativeAvatars
                                    ) {
                                        model.dispose();
                                        if (url === DEFAULT_LOBBY_AVATAR_URL) {
                                            visitor.model?.root.removeFromParent();
                                            visitor.model?.dispose();
                                            visitor.model = undefined;
                                            visitor.nativeSuppressed = true;
                                            return;
                                        }
                                        loadVisitor(
                                            visitor,
                                            DEFAULT_LOBBY_AVATAR_URL,
                                            scale,
                                            false,
                                            photo
                                        );
                                        return;
                                    }
                                }
                                if (local && performance.now() < hideUntil)
                                    await new Promise((resolve) =>
                                        setTimeout(
                                            resolve,
                                            hideUntil - performance.now()
                                        )
                                    );
                                if (disposed || request.signal.aborted) {
                                    model.dispose();
                                    return;
                                }
                                const replacing = !!visitor.model;
                                visitor.model?.root.removeFromParent();
                                visitor.model?.dispose();
                                visitor.model = model;
                                visitor.modelFlashing = flashing;
                                (local ? presentation : visitor.group).add(
                                    model.root
                                );
                                if (local) {
                                    setAvatarReveal =
                                        backend.createAvatarReveal?.(
                                            model.root
                                        );
                                    // Landing in the lobby (not returning from a world)
                                    // rises from the feet; swaps reuse the same effect.
                                    const arriving =
                                        !replacing &&
                                        !latest.current.travel &&
                                        !reducedMotion.matches;
                                    avatarRevealSeconds = arriving
                                        ? 0.47
                                        : 0.28;
                                    avatarReveal =
                                        (replacing || arriving) &&
                                        !reducedMotion.matches
                                            ? 0
                                            : 1;
                                    avatarRevealTarget = 1;
                                    setAvatarReveal?.(avatarReveal);
                                    previewYaw = 0;
                                    latest.current.onAvatarStatus?.({
                                        url,
                                        status: "ready",
                                    });
                                } else {
                                    // Other people land the way you do: the same
                                    // build-up from the feet when they first appear.
                                    // Swaps, travel and Flash keep an instant cut.
                                    visitor.setReveal = undefined;
                                    visitor.reveal = undefined;
                                    if (
                                        !replacing &&
                                        !cinematic &&
                                        !flashing &&
                                        !latest.current.travel &&
                                        !reducedMotion.matches
                                    ) {
                                        visitor.setReveal = model.setReveal
                                            ? model.setReveal
                                            : backend.createAvatarReveal?.(
                                                  model.root
                                              );
                                        if (visitor.setReveal) {
                                            visitor.reveal = 0;
                                            visitor.setReveal(0);
                                        }
                                    }
                                }
                                // Await asynchronous GPU pipelines before submitting draws.
                                if (local) {
                                    const pending = backend.compile(
                                        renderer,
                                        scene,
                                        camera
                                    );
                                    if (pending instanceof Promise) {
                                        compiling++;
                                        void pending
                                            .catch(() => {
                                                if (!disposed)
                                                    onContextLost(
                                                        new Event(
                                                            "lobbycontextlost"
                                                        )
                                                    );
                                            })
                                            .finally(() => {
                                                compiling--;
                                            });
                                    }
                                }
                            })
                            .catch((error) => {
                                if (disposed || request.signal.aborted) return;
                                if (!local) return;
                                avatarRevealTarget = 1;
                                // With nothing else to show, one broken avatar
                                // file must not take the lobby down: the next
                                // frame loads the default in its place.
                                const useDefault =
                                    !visitor.model &&
                                    url !== DEFAULT_LOBBY_AVATAR_URL;
                                if (useDefault) failedAvatarUrl = url;
                                latest.current.onAvatarStatus?.(
                                    useDefault
                                        ? {
                                              url,
                                              status: "error",
                                              fallbackUrl:
                                                  DEFAULT_LOBBY_AVATAR_URL,
                                          }
                                        : { url, status: "error" }
                                );
                                // An asset failure: another renderer would fail
                                // on the same file, so this never falls back.
                                if (!visitor.model && !useDefault)
                                    latest.current.onError(
                                        "Your avatar couldn’t load. Please try again.",
                                        "asset"
                                    );
                            })
                            .finally(() => {
                                if (!local) {
                                    activeLoads--;
                                    activeRemoteLoads.delete(activeRequest);
                                    drainLoads();
                                }
                            });
                    };
                    if (local) begin();
                    else {
                        remoteQueue.set(visitor, begin);
                        drainLoads();
                    }
                }

                function updateParticipants(delta: number, time: number) {
                    const rawSource =
                        latest.current.sampleParticipants?.(time) ||
                        latest.current.participants;
                    const travel = latest.current.travel;
                    const preview = latest.current.worldRevealPreview;
                    const group = latest.current.groupFormation;
                    const formation =
                        travel ?? (preview?.partyIds ? preview : undefined);
                    const allowed = group
                        ? new Set(group.members.map((person) => person.id))
                        : formation
                        ? new Set(formation.partyIds)
                        : null;
                    const source = group
                        ? groupFormationParticipants(group)
                        : formation
                        ? travelParticipants(
                              rawSource.filter((person) =>
                                  allowed.has(person.id)
                              ),
                              { partyIds: formation.partyIds },
                              travel ? travelAnchor : previewWorldAnchor,
                              travel ? travelYaw : previewWorldYaw
                          )
                        : rawSource;
                    if (!formation && !group && lastFormationIds)
                        for (const id of lastFormationIds)
                            settling.set(id, time + SETTLE_MAX_MS);
                    lastFormationIds =
                        formation && !group
                            ? new Set(formation.partyIds)
                            : null;
                    if (formation || group) settling.clear();
                    population = rawSource.length;
                    // Keep cached non-party assets ready for cancellation, including GPU
                    // instances whose batching ignores the parent's visible flag.
                    for (const [id, avatar] of avatars) {
                        const shown = !allowed || allowed.has(id);
                        avatar.group.visible = shown;
                        avatar.group.scale.setScalar(shown ? 1 : 0);
                    }
                    const budget = crowdBudget(latest.current.renderBudget);
                    if (
                        !!group ||
                        rawSource !== previousSource ||
                        time - lastAdmission >= 200
                    ) {
                        admitted = admitCrowd(
                            source,
                            position,
                            new Set(avatars.keys()),
                            budget,
                            DEFAULT_LOBBY_AVATAR_URL,
                            new Set(admitted.map((item) => item.url))
                        );
                        previousSource = rawSource;
                        lastAdmission = time;
                        const present = new Set(
                            group
                                ? [
                                      ...rawSource.map((person) => person.id),
                                      ...source.map((person) => person.id),
                                  ]
                                : formation
                                ? rawSource.map((person) => person.id)
                                : admitted.map(({ person }) => person.id)
                        );
                        // Release departures before scheduling arrivals, keeping memory bounded.
                        for (const [id, avatar] of avatars) {
                            if (present.has(id)) continue;
                            remoteQueue.delete(avatar);
                            avatar.request?.abort();
                            avatar.model?.dispose();
                            scene.remove(avatar.group);
                            avatars.delete(id);
                        }
                    }
                    // Admit at most four nearby live gestures. Everyone else retains
                    // the normal crowd path and never loads the Flash clip/image.
                    const flashingIds = new Set<string>();
                    if (
                        !travel &&
                        !group &&
                        !preview &&
                        !latest.current.avatarPreview
                    ) {
                        for (const { person } of admitted) {
                            const flash = person.flash;
                            const avatar = avatars.get(person.id);
                            if (!flash) {
                                if (avatar) avatar.flashOrigin = undefined;
                                continue;
                            }
                            if (avatar?.dismissedFlashNonce === flash.nonce)
                                continue;
                            const origin = avatar?.flashOrigin;
                            const moved =
                                Number(person.speed) > 0.08 ||
                                person.floor === false ||
                                (person.y || 0) > 0.05 ||
                                person.animation >= 0 ||
                                (origin?.nonce === flash.nonce &&
                                    Math.hypot(
                                        person.x - origin.x,
                                        person.z - origin.z
                                    ) > 0.05);
                            if (moved) {
                                if (avatar)
                                    avatar.dismissedFlashNonce = flash.nonce;
                                continue;
                            }
                            if (avatar && origin?.nonce !== flash.nonce)
                                avatar.flashOrigin = {
                                    nonce: flash.nonce,
                                    x: person.x,
                                    z: person.z,
                                };
                            if (
                                flashingIds.size < 4 &&
                                (person.x - position.x) ** 2 +
                                    (person.z - position.z) ** 2 <=
                                    144
                            )
                                flashingIds.add(person.id);
                        }
                    }
                    nameTags?.begin();
                    // Your own tag first, so a full crowd never crowds it out.
                    if (
                        self.model &&
                        budget.maxLabels > 0 &&
                        latest.current.selfName &&
                        !travel &&
                        !group &&
                        !preview &&
                        !latest.current.avatarPreview &&
                        self.group.visible &&
                        !speechBubbles.speaking("self")
                    )
                        nameTags?.show(
                            "self",
                            latest.current.selfName,
                            latest.current.profilePhoto || "",
                            self.group.position.x,
                            self.group.position.y +
                                (self.model.height || 1.8) +
                                0.12,
                            self.group.position.z,
                            true
                        );
                    let shadowCount = 0;
                    let fullMotionCount = 0;
                    nativeVisible = nativeReady = surrogateAvatars = 0;
                    const nativeAllowed = new Set<string>();
                    if (nativeSources.size) {
                        for (const { person } of admitted) {
                            if (nativeAllowed.size >= budget.maxNativeAvatars)
                                break;
                            if (
                                !avatars.get(person.id)?.modelFlashing &&
                                avatars.get(person.id)?.model?.root.userData
                                    .lobbyNativeAvatar
                            )
                                nativeAllowed.add(person.id);
                        }
                        for (const { person, url } of admitted) {
                            if (nativeAllowed.size >= budget.maxNativeAvatars)
                                break;
                            if (
                                nativeSources.has(url) &&
                                !flashingIds.has(person.id)
                            )
                                nativeAllowed.add(person.id);
                        }
                    }
                    {
                        nativeProjection.multiplyMatrices(
                            camera.projectionMatrix,
                            camera.matrixWorldInverse
                        );
                        (nativeFrustum.setFromProjectionMatrix as any)(
                            nativeProjection,
                            (renderer as any).coordinateSystem
                        );
                    }
                    for (let index = 0; index < admitted.length; index++) {
                        const {
                            person: formationParticipant,
                            url: requestedUrl,
                        } = admitted[index];
                        let participant = formationParticipant;
                        const gather = group && gathered.get(participant.id);
                        const teleport =
                            gather && participant.id !== group.initiatorId
                                ? sampleGroupGather(
                                      time - gather.at,
                                      reducedMotion.matches
                                  )
                                : { arrived: true, scale: 1 };
                        if (gather && !teleport.arrived)
                            participant = {
                                ...participant,
                                x: gather.origin.x,
                                y: gather.origin.y,
                                z: gather.origin.z,
                            };
                        const flashing = flashingIds.has(participant.id);
                        const url = flashing
                            ? participant.vrmUrl || requestedUrl
                            : latest.current.crowdEnabled !== false &&
                              nativeSources.has(requestedUrl) &&
                              !nativeAllowed.has(participant.id)
                            ? DEFAULT_LOBBY_AVATAR_URL
                            : requestedUrl;
                        if (
                            url !==
                            (participant.vrmUrl || DEFAULT_LOBBY_AVATAR_URL)
                        )
                            surrogateAvatars++;
                        let avatar = avatars.get(participant.id);
                        if (!avatar) {
                            const group = new THREE.Group();
                            group.position.set(
                                participant.x,
                                Math.max(0, participant.y || 0),
                                participant.z
                            );
                            scene.add(group);
                            avatar = {
                                group,
                                motion: {
                                    speed: 0,
                                    grounded: true,
                                    quality: "crowd",
                                },
                                animationDelta: 0,
                            };
                            avatars.set(participant.id, avatar);
                        }
                        if (
                            flashing &&
                            avatar.flashOrigin?.nonce !==
                                participant.flash.nonce
                        )
                            avatar.flashOrigin = {
                                nonce: participant.flash.nonce,
                                x: participant.x,
                                z: participant.z,
                            };
                        const shown = !allowed || allowed.has(participant.id);
                        avatar.group.visible = shown;
                        avatar.group.scale.setScalar(
                            shown ? teleport.scale : 0
                        );
                        if (!shown) continue;
                        if (
                            avatar.nativeSuppressed &&
                            nativeAllowed.has(participant.id)
                        ) {
                            avatar.url = undefined;
                            avatar.nativeSuppressed = false;
                        }
                        const cinematic =
                            (allowed?.has(participant.id) ||
                                latest.current.travelPartyIds
                                    // Parties hold 8; staged recording crowds bring up to 16.
                                    ?.slice(0, 16)
                                    .includes(participant.id)) &&
                            travel?.phase !== "return";
                        // Until their own avatar is ready, they stand in the
                        // default one (see warmAvatar) so nobody is invisible.
                        const standIn =
                            !flashing &&
                            latest.current.crowdEnabled !== false &&
                            (!avatar.model ||
                                avatar.url === DEFAULT_LOBBY_AVATAR_URL) &&
                            (cinematic
                                ? !avatar.model
                                : url !== DEFAULT_LOBBY_AVATAR_URL &&
                                  !readyUrls.has(url));
                        if (standIn && !cinematic) warmAvatar(url);
                        loadVisitor(
                            avatar,
                            standIn ? DEFAULT_LOBBY_AVATAR_URL : url,
                            participant.scale,
                            false,
                            participant.avatar,
                            standIn ? false : cinematic,
                            flashing
                        );
                        const sampled =
                            !!group ||
                            !!formation ||
                            !!latest.current.sampleParticipants;
                        const previousX = avatar.group.position.x;
                        const previousY = avatar.group.position.y;
                        const previousZ = avatar.group.position.z;
                        const previousHeading = avatar.group.rotation.y;
                        // Network samples are already interpolated at the presentation time.
                        let blend = sampled ? 1 : 1 - Math.exp(-12 * delta);
                        let rotationTarget = Number.isFinite(
                            participant.rotation
                        )
                            ? participant.rotation
                            : 0;
                        const settleUntil = settling.get(participant.id);
                        if (settleUntil !== undefined) {
                            const dx = participant.x - avatar.group.position.x;
                            const dz = participant.z - avatar.group.position.z;
                            const gap = Math.hypot(dx, dz);
                            if (gap < 0.05 || time > settleUntil)
                                settling.delete(participant.id);
                            else {
                                // Walk there at an easy pace, facing the way.
                                blend = Math.min(
                                    1,
                                    (SETTLE_SPEED * delta) / gap
                                );
                                if (gap > 0.3)
                                    rotationTarget = Math.atan2(-dx, -dz);
                            }
                        }
                        avatar.group.position.x +=
                            (participant.x - avatar.group.position.x) * blend;
                        avatar.group.position.y +=
                            (THREE.MathUtils.clamp(
                                Number.isFinite(participant.y)
                                    ? participant.y
                                    : 0,
                                0,
                                20
                            ) -
                                avatar.group.position.y) *
                            blend;
                        avatar.group.position.z +=
                            (participant.z - avatar.group.position.z) * blend;
                        const rotation = rotationTarget;
                        const turn = settling.has(participant.id)
                            ? 1 - Math.exp(-8 * delta)
                            : blend;
                        avatar.group.rotation.y +=
                            Math.atan2(
                                Math.sin(rotation - avatar.group.rotation.y),
                                Math.cos(rotation - avatar.group.rotation.y)
                            ) * turn;
                        if (
                            avatar.model &&
                            (latest.current.crowdEnabled === false ||
                                avatar.model.root.userData.lobbyNativeAvatar)
                        ) {
                            nativeReady++;
                            const scale = participant.scale || 1;
                            nativeSphere.center.set(
                                participant.x,
                                participant.y + 0.9 * scale,
                                participant.z
                            );
                            nativeSphere.radius = 1.8 * scale;
                            avatar.model.root.visible =
                                nativeFrustum.intersectsSphere(nativeSphere);
                            if (avatar.model.root.visible) nativeVisible++;
                        }
                        const distanceSq =
                            (participant.x - position.x) ** 2 +
                            (participant.z - position.z) ** 2;
                        // Use presented velocity in metres/second, including on the
                        // compatibility path whose poses still need interpolation.
                        const motion = avatar.motion;
                        const displayScale =
                            Number.isFinite(participant.scale) &&
                            participant.scale > 0
                                ? THREE.MathUtils.clamp(
                                      participant.scale,
                                      0.2,
                                      4
                                  )
                                : 1;
                        const observedSpeed =
                            Math.hypot(
                                avatar.group.position.x - previousX,
                                avatar.group.position.z - previousZ
                            ) / Math.max(delta, 0.001);
                        motion.speed =
                            (Number.isFinite(participant.speed) &&
                            !settling.has(participant.id)
                                ? Math.max(0, participant.speed)
                                : observedSpeed) / displayScale;
                        motion.restConfirmed = participant.restConfirmed;
                        motion.jumpCount = participant.jumpCount;
                        motion.height = avatar.group.position.y;
                        motion.verticalVelocity =
                            (avatar.group.position.y - previousY) /
                            Math.max(delta, 0.001);
                        motion.grounded =
                            participant.floor ?? motion.height <= 0.001;
                        motion.procedural =
                            !reducedMotion.matches &&
                            latest.current.proceduralMotion !== false;
                        motion.headingError = Math.atan2(
                            Math.sin(rotation - avatar.group.rotation.y),
                            Math.cos(rotation - avatar.group.rotation.y)
                        );
                        motion.turnRate =
                            (avatar.group.rotation.y - previousHeading) /
                            Math.max(delta, 0.001);
                        motion.turnIntent = Number.isFinite(
                            participant.turnIntent
                        )
                            ? participant.turnIntent
                            : motion.headingError + motion.turnRate * 0.22;
                        // Rich gait blending is bounded independently of avatar count.
                        // Retain it slightly farther away to avoid a distance-boundary pop.
                        const fullDistance =
                            motion.quality === "full" ? 196 : 144;
                        motion.quality =
                            fullMotionCount < 16 && distanceSq < fullDistance
                                ? "full"
                                : "crowd";
                        if (motion.quality === "full") fullMotionCount++;
                        if (
                            !travelVisual &&
                            (motion.speed > 0.04 ||
                                !motion.grounded ||
                                participant.animation >= 0)
                        )
                            motion.postTeleportIdle = false;
                        if (travelVisual || arrivalLocked) {
                            motion.speed = 0;
                            motion.grounded = true;
                            motion.verticalVelocity = 0;
                            motion.procedural = false;
                        }
                        settleReturnIdle(avatar);
                        if (
                            flashing &&
                            avatar.modelFlashing &&
                            avatar.model?.playFlash
                        ) {
                            if (
                                motion.speed > 0.08 ||
                                !motion.grounded ||
                                participant.animation >= 0
                            ) {
                                avatar.dismissedFlashNonce =
                                    participant.flash.nonce;
                            } else {
                                flashPresentation.sync({
                                    id: participant.id,
                                    flash: participant.flash,
                                    avatar: avatar.model,
                                    parent: avatar.group,
                                    reducedMotion: reducedMotion.matches,
                                });
                            }
                        }
                        avatar.animationDelta += delta;
                        if (
                            distanceSq < 400 ||
                            // Baked instances only advance clip times/weights; keep
                            // them at display cadence. Throttle distant live rigs only.
                            (latest.current.crowdEnabled !== false &&
                                !avatar.model?.root.userData
                                    .lobbyNativeAvatar) ||
                            avatar.animationDelta >= 1 / 20
                        ) {
                            const pose = travelVisual?.pose || arrivalPose;
                            if (
                                !pose ||
                                !avatar.model?.sampleTravelPose?.(pose)
                            )
                                avatar.model?.update(
                                    avatar.animationDelta,
                                    travelVisual
                                        ? latest.current.travel?.phase ===
                                          "return"
                                            ? undefined
                                            : travelVisual.animation
                                        : participant.animation >= 0
                                        ? participant.animation
                                        : undefined,
                                    motion
                                );
                            avatar.motion.postTeleportIdleTime = undefined;
                            avatar.animationDelta = 0;
                        }
                        if (travelVisual)
                            avatar.group.position.y += travelVisual.lift;
                        if (shadowCount < 512 && distanceSq < 2500) {
                            shadowPosition.set(
                                avatar.group.position.x,
                                0.016,
                                avatar.group.position.z
                            );
                            crowdShadows.setMatrixAt(
                                shadowCount++,
                                shadowMatrix.compose(
                                    shadowPosition,
                                    shadowRotation,
                                    shadowScale
                                )
                            );
                        }
                        // A tag waits for its avatar, so names don't float
                        // over empty floor while a model loads.
                        avatar.speechPhoto = participant.avatar;
                        avatar.speechName = participant.name;
                        // What they just said stands in for the tag.
                        if (
                            avatar.model &&
                            index < budget.maxLabels &&
                            distanceSq < 900 &&
                            !speechBubbles.speaking(participant.id)
                        )
                            nameTags?.show(
                                participant.id,
                                participant.name || "Guest",
                                participant.avatar || "",
                                avatar.group.position.x,
                                avatar.group.position.y +
                                    (avatar.model?.height || 1.8) +
                                    0.12,
                                avatar.group.position.z
                            );
                    }
                    nameTags?.end(camera);
                    crowdShadows.count = shadowCount;
                    crowdShadows.instanceMatrix.needsUpdate = shadowCount > 0;
                    drainLoads();
                }

                function resize() {
                    width = Math.max(1, host.clientWidth);
                    height = Math.max(1, host.clientHeight);
                    camera.aspect = width / height;
                    camera.fov = width < 600 ? 72 : 58;
                    camera.updateProjectionMatrix();
                    renderer.setSize(width, height, false);
                    frameTimings.reset();
                }
                const observer = new ResizeObserver(resize);
                observer.observe(host);
                resize();

                let drag: {
                    id: number;
                    x: number;
                    y: number;
                    startX: number;
                    startY: number;
                    moved: boolean;
                } | null = null;
                function onPointerDown(event: PointerEvent) {
                    if (
                        !!latest.current.travel ||
                        arrivalLocked ||
                        !!latest.current.groupFormation ||
                        (!latest.current.active &&
                            !latest.current.onSelectAvatar) ||
                        event.button !== 0
                    )
                        return;
                    canvas.focus({ preventScroll: true });
                    canvas.setPointerCapture(event.pointerId);
                    drag = {
                        id: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        startX: event.clientX,
                        startY: event.clientY,
                        moved: false,
                    };
                }
                function onPointerMove(event: PointerEvent) {
                    if (
                        latest.current.travel ||
                        arrivalLocked ||
                        !drag ||
                        event.pointerId !== drag.id
                    )
                        return;
                    drag.moved ||=
                        Math.hypot(
                            event.clientX - drag.startX,
                            event.clientY - drag.startY
                        ) > 6;
                    if (
                        !latest.current.active ||
                        (latest.current.onSelectAvatar && !drag.moved)
                    )
                        return;
                    const dx = event.clientX - drag.x;
                    const dy = event.clientY - drag.y;
                    if (latest.current.avatarPreview) {
                        previewYaw -= dx * 0.008;
                        drag.x = event.clientX;
                        drag.y = event.clientY;
                        return;
                    }
                    targetYaw -= dx * 0.0032;
                    targetPitch = THREE.MathUtils.clamp(
                        targetPitch - dy * 0.0025,
                        -0.65,
                        0.05
                    );
                    drag.x = event.clientX;
                    drag.y = event.clientY;
                    canvas.style.cursor = "grabbing";
                }
                function onWheel(event: WheelEvent) {
                    // Preserve browser pinch-to-zoom. Ordinary wheel/trackpad
                    // scrolling belongs to this canvas, never the page below.
                    if (event.ctrlKey || event.metaKey) return;
                    event.preventDefault();
                    if (
                        !latest.current.active ||
                        latest.current.travel ||
                        arrivalLocked ||
                        latest.current.groupFormation ||
                        latest.current.avatarPreview
                    )
                        return;
                    const unit =
                        event.deltaMode === 1
                            ? 16
                            : event.deltaMode === 2
                            ? canvas.clientHeight
                            : 1;
                    const delta = THREE.MathUtils.clamp(
                        event.deltaY * unit,
                        -160,
                        160
                    );
                    targetPitch = THREE.MathUtils.clamp(
                        targetPitch - delta * 0.0015,
                        -0.65,
                        0.05
                    );
                }
                function onPointerUp(event: PointerEvent) {
                    if (!drag || drag.id !== event.pointerId) return;
                    const clicked =
                        event.type === "pointerup" &&
                        !drag.moved &&
                        Math.hypot(
                            event.clientX - drag.startX,
                            event.clientY - drag.startY
                        ) <= 6;
                    drag = null;
                    if (clicked && !pickPortal(event)) pickAvatar(event);
                    if (canvas.hasPointerCapture(event.pointerId)) {
                        canvas.releasePointerCapture(event.pointerId);
                    }
                    canvas.style.cursor = "grab";
                }
                const movementCodes = new Set([
                    "KeyW",
                    "KeyA",
                    "KeyS",
                    "KeyD",
                    "ArrowUp",
                    "ArrowLeft",
                    "ArrowDown",
                    "ArrowRight",
                ]);
                function onKeyDown(event: KeyboardEvent) {
                    if (
                        !latest.current.active ||
                        !!latest.current.travel ||
                        arrivalLocked ||
                        !!latest.current.groupFormation ||
                        latest.current.avatarPreview ||
                        event.defaultPrevented ||
                        event.isComposing ||
                        isEditing(event.target) ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.altKey
                    )
                        return;
                    const code = lobbyKeyCode(event);
                    if (
                        code === "Space" &&
                        !event.repeat &&
                        !keys.has("Space")
                    ) {
                        jumpInput.queue();
                        dismissLocalFlash();
                        keys.add("Space");
                        emoteIndex = -1;
                        event.preventDefault();
                    }
                    if (/^Digit[1-9]$/.test(code) && !event.repeat) {
                        dismissLocalFlash();
                        emoteIndex = getEmoteShortcutIndex(
                            Number(code.slice(5)) - 1
                        );
                        event.preventDefault();
                    }
                    if (code === "ShiftLeft" || code === "ShiftRight")
                        keys.add(code);
                    if (movementCodes.has(code)) {
                        dismissLocalFlash();
                        keys.add(code);
                        event.preventDefault();
                    }
                }

                function onKeyUp(event: KeyboardEvent) {
                    keys.delete(lobbyKeyCode(event));
                }
                function clearInput() {
                    keys.clear();
                    jumpInput.clear();
                    jumpHeld = false;
                    touchMovement.set(0, 0);
                    velocity.set(0, 0);
                    if (drag && canvas.hasPointerCapture(drag.id))
                        canvas.releasePointerCapture(drag.id);
                    drag = null;
                    if (touchId !== null && touch.hasPointerCapture(touchId))
                        touch.releasePointerCapture(touchId);
                    touchId = null;
                    touch.style.setProperty("--thumb-x", "0px");
                    touch.style.setProperty("--thumb-y", "0px");
                }
                function onFocus(event: FocusEvent) {
                    if (isEditing(event.target)) clearInput();
                }

                let touchId: number | null = null;
                function onTouchMove(event: PointerEvent) {
                    if (
                        latest.current.travel ||
                        arrivalLocked ||
                        latest.current.groupFormation ||
                        event.pointerId !== touchId
                    )
                        return;
                    const rect = touch.getBoundingClientRect();
                    touchMovement.set(
                        (event.clientX - rect.left - rect.width / 2) / 30,
                        (event.clientY - rect.top - rect.height / 2) / 30
                    );
                    if (touchMovement.length() > 1) touchMovement.normalize();
                    touch.style.setProperty(
                        "--thumb-x",
                        `${touchMovement.x * 22}px`
                    );
                    touch.style.setProperty(
                        "--thumb-y",
                        `${touchMovement.y * 22}px`
                    );
                    event.preventDefault();
                }
                function onTouchDown(event: PointerEvent) {
                    if (
                        !latest.current.active ||
                        latest.current.avatarPreview ||
                        latest.current.travel ||
                        arrivalLocked
                    )
                        return;
                    touchId = event.pointerId;
                    touch.setPointerCapture(event.pointerId);
                    onTouchMove(event);
                }
                function onTouchUp(event: PointerEvent) {
                    if (touchId !== event.pointerId) return;
                    touchId = null;
                    touchMovement.set(0, 0);
                    touch.style.setProperty("--thumb-x", "0px");
                    touch.style.setProperty("--thumb-y", "0px");
                }

                function render(time: number) {
                    const cpuStart = performance.now();
                    frame = 0;
                    if (
                        disposed ||
                        contextLost ||
                        !latest.current.active ||
                        document.hidden
                    ) {
                        lastTime = 0;
                        frameTimings.reset();
                        clearFlashes();
                        if (document.hidden) transitionTimings?.pause();
                        else if (transitionTimings?.finish())
                            publishTransitionTimings(time, true);
                        clearInput();
                        return;
                    }
                    const delta = lastTime
                        ? Math.min((time - lastTime) / 1000, 0.05)
                        : 1 / 60;
                    lastTime = time;
                    entranceTime += delta;
                    const travel = latest.current.travel;
                    const group = latest.current.groupFormation;
                    if (
                        travel ||
                        group ||
                        latest.current.avatarPreview ||
                        latest.current.worldRevealPreview
                    )
                        clearFlashes();
                    flashPresentation.beginFrame();
                    if (latest.current.flash?.nonce !== localFlashNonce) {
                        localFlashNonce = latest.current.flash?.nonce;
                        readyFlashNonce = undefined;
                        if (localFlashAllowed() && localFlashNonce) {
                            emoteIndex = -1;
                        }
                    }
                    const groupAnchor = group?.poses[group.initiatorId];
                    const groupSelf = group?.poses[group.selfId];
                    if (group?.id !== gatheringId) {
                        gatheringId = group?.id;
                        gathered.clear();
                        emoteIndex = -1;
                        clearInput();
                        previousSource = undefined;
                        self.group.scale.setScalar(1);
                        if (groupAnchor) {
                            travelAnchor.set(
                                groupAnchor.x,
                                groupAnchor.y,
                                groupAnchor.z
                            );
                            travelCameraStart.copy(camera.position);
                            travelCameraYaw = Math.atan2(
                                camera.position.x - travelAnchor.x,
                                camera.position.z - travelAnchor.z
                            );
                            travelCameraRadius = Math.hypot(
                                camera.position.x - travelAnchor.x,
                                camera.position.z - travelAnchor.z
                            );
                            travelFocus.copy(travelAnchor);
                            travelFocus.y += LOOK_HEIGHT;
                            camera.getWorldDirection(travelCameraFocusStart);
                            travelCameraFocusStart
                                .multiplyScalar(
                                    camera.position.distanceTo(travelFocus)
                                )
                                .add(camera.position);
                            travelYaw = groupAnchor.rotation - Math.PI;
                        }
                    }
                    if (group)
                        for (const member of group.members) {
                            if (gathered.has(member.id)) continue;
                            const pose = group.poses[member.id];
                            if (!pose) continue;
                            gathered.set(member.id, {
                                at: time,
                                origin:
                                    member.id === group.selfId
                                        ? displayPosition.clone()
                                        : avatars
                                              .get(member.id)
                                              ?.group.position.clone() ||
                                          new THREE.Vector3(
                                              pose.x,
                                              pose.y,
                                              pose.z
                                          ),
                            });
                        }
                    if (travel && travel.startedAt !== travelStartedAt) {
                        travelStartedAt = travel.startedAt;
                        arrivalCamera = undefined;
                        previewArrivalStartedAt = undefined;
                        arrivalLocked = false;
                        arrivalPose = undefined;
                        completedReturn = undefined;
                        readyReturn = returnRenderedAt = undefined;
                        returnView = undefined;
                        if (travel.phase === "return" && travel.returnView) {
                            const source = travel.returnView;
                            const sourceCameraYaw = Math.atan2(
                                source.cameraOffset.x -
                                    source.cameraTargetOffset.x,
                                source.cameraOffset.z -
                                    source.cameraTargetOffset.z
                            );
                            // Rotate the whole source composition into the lobby's
                            // retained heading; screen framing is invariant under yaw.
                            returnView = orientTravelViewToHeading(
                                source,
                                sourceCameraYaw +
                                    self.group.rotation.y -
                                    source.avatarRotation
                            );
                        }
                        if (travel.phase === "return")
                            entranceTime = Math.max(entranceTime, 1.65);
                        previousSource = undefined;
                        if (groupAnchor)
                            travelAnchor.set(
                                groupAnchor.x,
                                groupAnchor.y,
                                groupAnchor.z
                            );
                        else travelAnchor.copy(displayPosition);
                        {
                            // Travel is planted, including departures initiated mid-jump.
                            travelAnchor.y = 0;
                            position.y = 0;
                            jumpCount = 0;
                            jumpInput.clear();
                            jumpHeld = false;
                        }
                        travelCameraStart.copy(camera.position);
                        travelCameraYaw = Math.atan2(
                            camera.position.x - travelAnchor.x,
                            camera.position.z - travelAnchor.z
                        );
                        travelCameraRadius = Math.hypot(
                            camera.position.x - travelAnchor.x,
                            camera.position.z - travelAnchor.z
                        );
                        travelFocus.copy(travelAnchor);
                        travelFocus.y += LOOK_HEIGHT;
                        camera.getWorldDirection(travelCameraFocusStart);
                        travelCameraFocusStart
                            .multiplyScalar(
                                camera.position.distanceTo(travelFocus)
                            )
                            .add(camera.position);
                        travelYaw =
                            (groupAnchor?.rotation ?? self.group.rotation.y) -
                            Math.PI;
                        if (travel.phase === "return") {
                            // The final rear control pose; native return framing
                            // eases into it after the first prepared frame.
                            yaw = targetYaw = travelYaw + Math.PI;
                            pitch = targetPitch = -0.28;
                        }
                        travelPhase = undefined;
                        emoteIndex = -1;
                        clearInput();
                        verticalSpeed = 0;
                    }
                    if (travel?.phase !== travelPhase) {
                        travelPhase = travel?.phase;
                        travelPhaseStartedAt = time;
                    }
                    // Through the portal the room is already loaded: keep the
                    // lobby exactly as it is until the cut, no dimming or crouch.
                    travelVisual =
                        travel && !travel.viaPortal
                            ? sampleTravelPresentation(
                                  {
                                      ...travel,
                                      // Hidden preparation must not consume the visible reveal.
                                      startedAt:
                                          travel.phase === "return"
                                              ? returnRenderedAt ?? time
                                              : travel.startedAt,
                                      reducedMotion:
                                          travel.reducedMotion ||
                                          reducedMotion.matches,
                                  },
                                  time,
                                  travelPhaseStartedAt
                              )
                            : undefined;
                    if (!travel && travelStartedAt !== undefined) {
                        travelStartedAt = undefined;
                        returnView = undefined;
                        camera.fov = width < 600 ? 72 : 58;
                        camera.updateProjectionMatrix();
                        previousSource = undefined;
                        emoteIndex = -1;
                        clearInput();
                    }
                    const worldPreview = latest.current.worldRevealPreview;
                    if (worldPreview && !wasWorldPreview) {
                        // Capture once: the assembled world and party do not follow the walking player.
                        previewWorldAnchor.copy(
                            travel ? travelAnchor : displayPosition
                        );
                        // This fixture uses the lobby's y=0 movement plane, including a replay started mid-jump.
                        previewWorldAnchor.y = 0;
                        previewWorldYaw = travel
                            ? travelYaw
                            : self.group.rotation.y - Math.PI;
                    }
                    const arrived = !!worldPreview?.arrived && !travel;
                    if (arrived && !wasPreviewArrived) {
                        const reduced =
                            worldPreview.reducedMotion || reducedMotion.matches;
                        previewArrivalStartedAt =
                            wasWorldPreview && !reduced ? time : undefined;
                        arrivalCamera = reduced
                            ? undefined
                            : {
                                  startedAt: time,
                                  yaw: Math.atan2(
                                      camera.position.x - previewWorldAnchor.x,
                                      camera.position.z - previewWorldAnchor.z
                                  ),
                                  radius: Math.hypot(
                                      camera.position.x - previewWorldAnchor.x,
                                      camera.position.z - previewWorldAnchor.z
                                  ),
                                  height: camera.position.y,
                                  focusHeight: travelFocus.y || LOOK_HEIGHT,
                              };
                        self.motion.postTeleportIdle = true;
                        position.copy(previewWorldAnchor);
                        position.y = 0;
                        correctionOffset.set(0, 0, 0);
                        velocity.set(0, 0);
                        verticalSpeed = jumpCount = 0;
                        emoteIndex = -1;
                        clearInput();
                        yaw = targetYaw = self.group.rotation.y;
                        pitch = targetPitch = -0.28;
                        previousSource = undefined;
                        canvas.focus({ preventScroll: true });
                    }
                    if (!worldPreview) {
                        arrivalCamera = undefined;
                        previewArrivalStartedAt = undefined;
                    }
                    const wasArrivalLocked = arrivalLocked;
                    arrivalLocked =
                        arrived &&
                        previewArrivalStartedAt !== undefined &&
                        time - previewArrivalStartedAt < TRAVEL_ARRIVAL_MS;
                    arrivalPose = arrivalLocked
                        ? sampleTravelArrival(time - previewArrivalStartedAt)
                        : undefined;
                    if (wasArrivalLocked && !arrivalLocked) {
                        clearInput();
                        self.motion.postTeleportIdleTime =
                            previewArrivalStartedAt !== undefined
                                ? Math.max(
                                      0,
                                      (time -
                                          previewArrivalStartedAt -
                                          TRAVEL_ANIMATION_PLAY_MS.TRAVEL_STAND_UP) /
                                          1000
                                  )
                                : undefined;
                        for (const visitor of avatars.values()) {
                            visitor.motion.postTeleportIdle = true;
                            visitor.motion.postTeleportIdleTime =
                                self.motion.postTeleportIdleTime;
                        }
                    }
                    wasWorldPreview = !!worldPreview;
                    wasPreviewArrived = arrived;
                    const correction = latest.current.consumeCorrection?.();
                    if (
                        correction &&
                        [correction.x, correction.y, correction.z].every(
                            Number.isFinite
                        )
                    ) {
                        // Preserve all movement made since the acknowledged packet.
                        if (correction.hardSnap) correctionOffset.set(0, 0, 0);
                        else {
                            correctionOffset.x -= correction.x;
                            correctionOffset.y -= correction.y;
                            correctionOffset.z -= correction.z;
                        }
                        position.x += correction.x;
                        position.y = Math.max(0, position.y + correction.y);
                        position.z += correction.z;
                        if (Number.isFinite(correction.rotation))
                            self.group.rotation.y += correction.rotation;
                        if (correction.hardSnap) {
                            velocity.set(0, 0);
                            verticalSpeed = 0;
                        }
                    }
                    const previewing =
                        !travel && !!latest.current.avatarPreview;
                    if (previewing !== wasPreviewing) {
                        clearInput();
                        velocity.set(0, 0);
                        if (previewing) {
                            emoteIndex = -1;
                            previewYaw = 0;
                        }
                        wasPreviewing = previewing;
                    }
                    previewMix = reducedMotion.matches
                        ? Number(previewing)
                        : previewMix +
                          (Number(previewing) - previewMix) *
                              (1 - Math.exp(-10 * delta));
                    const keyboard = readLobbyKeyboard(keys, delta);
                    const strafe = keyboard.strafe + touchMovement.x;
                    const forward = keyboard.forward + touchMovement.y;
                    if (!previewing && !travel && !group && !arrivalLocked) {
                        targetYaw += keyboard.turn;
                        yaw += keyboard.turn;
                    }
                    const jump = jumpInput.read(delta);
                    const ease = 1 - Math.exp(-12 * delta);
                    let movingInput =
                        Math.abs(strafe) + Math.abs(forward) > 0.01;
                    // Release the controls into a short brake, without the long
                    // exponential coast that makes planted feet slide over the floor.
                    if (movingInput) emoteIndex = -1;
                    if (
                        latest.current.emote &&
                        latest.current.emote.nonce !== emoteNonce
                    ) {
                        emoteNonce = latest.current.emote.nonce;
                        emoteIndex = latest.current.emote.index;
                    }
                    yaw += (targetYaw - yaw) * (1 - Math.exp(-18 * delta));
                    pitch +=
                        (targetPitch - pitch) * (1 - Math.exp(-18 * delta));
                    const predicted = latest.current.advanceMovement?.(delta, {
                        strafe:
                            previewing || travel || group || arrivalLocked
                                ? 0
                                : strafe,
                        forward:
                            previewing || travel || group || arrivalLocked
                                ? 0
                                : forward,
                        yaw,
                        running:
                            !travel &&
                            !arrivalLocked &&
                            !group &&
                            (keys.has("ShiftLeft") || keys.has("ShiftRight")),
                        jump:
                            !travel &&
                            !arrivalLocked &&
                            !group &&
                            !previewing &&
                            jump,
                        animation: travel || group ? -1 : emoteIndex,
                    });
                    // A replay may drive different controls from the keyboard.
                    // Gait, facing and braking must describe the movement actually simulated.
                    const movementInput = predicted?.movementInput;
                    const movementYaw = movementInput?.yaw ?? yaw;
                    const movementStrafe = movementInput?.strafe ?? strafe;
                    const movementForward = movementInput?.forward ?? forward;
                    movingInput =
                        Math.abs(movementStrafe) + Math.abs(movementForward) >
                        0.01;
                    let nextX: number, nextZ: number;
                    if ((travel || group || arrivalLocked) && !predicted) {
                        velocity.set(0, 0);
                        nextX = position.x;
                        nextZ = position.z;
                    } else if (predicted) {
                        velocity.set(predicted.vx, predicted.vz);
                        verticalSpeed = predicted.vy;
                        position.y = predicted.y;
                        jumpCount =
                            predicted.jumpCount ?? (predicted.y > 0 ? 1 : 0);
                        nextX = predicted.x;
                        nextZ = predicted.z;
                        emoteIndex = predicted.animation;
                    } else {
                        planarVelocity.vx = velocity.x;
                        planarVelocity.vz = velocity.y;
                        advanceVelocity(
                            planarVelocity,
                            strafe,
                            forward,
                            keys.has("ShiftLeft") || keys.has("ShiftRight"),
                            delta
                        );
                        velocity.set(planarVelocity.vx, planarVelocity.vz);
                        if (movingInput) emoteIndex = -1;
                        if (
                            latest.current.emote &&
                            latest.current.emote.nonce !== emoteNonce
                        ) {
                            emoteNonce = latest.current.emote.nonce;
                            emoteIndex = latest.current.emote.index;
                        }
                        // A supplied network controller may be unavailable while
                        // connecting, offline, or on the legacy pose protocol.
                        if (jump && !jumpHeld && jumpCount < 2) {
                            verticalSpeed = 6;
                            jumpCount++;
                        }
                        if (position.y > 0 || verticalSpeed > 0) {
                            verticalSpeed -= 18 * delta;
                            position.y = Math.max(
                                0,
                                position.y + verticalSpeed * delta
                            );
                            if (position.y === 0) {
                                verticalSpeed = 0;
                                jumpCount = 0;
                            }
                        }
                        nextX =
                            position.x +
                            (Math.cos(yaw) * velocity.x +
                                Math.sin(yaw) * velocity.y) *
                                delta;
                        nextZ =
                            position.z +
                            (-Math.sin(yaw) * velocity.x +
                                Math.cos(yaw) * velocity.y) *
                                delta;
                    }
                    jumpHeld = jump;
                    const previousX = position.x;
                    const previousZ = position.z;
                    position.x = THREE.MathUtils.clamp(nextX, -200, 200);
                    position.z = THREE.MathUtils.clamp(nextZ, -200, 200);
                    correctionOffset.multiplyScalar(Math.exp(-14 * delta));
                    displayPosition.copy(position).add(correctionOffset);
                    if (travelVisual) displayPosition.copy(travelAnchor);
                    if (groupSelf) {
                        const gather = gathered.get(group.selfId);
                        const teleport =
                            group.selfId === group.initiatorId || travel
                                ? { arrived: true, scale: 1 }
                                : sampleGroupGather(
                                      time - (gather?.at ?? time),
                                      reducedMotion.matches
                                  );
                        if (teleport.arrived || !gather)
                            displayPosition.set(
                                groupSelf.x,
                                groupSelf.y,
                                groupSelf.z
                            );
                        else displayPosition.copy(gather.origin);
                        self.group.scale.setScalar(teleport.scale);
                    }
                    const entrance = reducedMotion.matches
                        ? 0
                        : Math.pow(1 - Math.min(entranceTime / 1.65, 1), 3);
                    if (
                        latest.current.flash &&
                        (!localFlashAllowed() ||
                            movingInput ||
                            velocity.length() > 0.08 ||
                            position.y > 0.001 ||
                            keys.has("Space") ||
                            jumpInput.pending ||
                            emoteIndex >= 0)
                    )
                        dismissLocalFlash();
                    const flashTarget = Number(
                        !!readyFlashNonce &&
                            readyFlashNonce === latest.current.flash?.nonce &&
                            localFlashAllowed()
                    );
                    flashMix = reducedMotion.matches
                        ? flashTarget
                        : flashMix +
                          (flashTarget - flashMix) *
                              (1 - Math.exp(-10 * delta));
                    // Camera presentation leaves the shared avatar heading untouched.
                    // Pull the follow camera 30% closer as we approach, keeping
                    // the same look direction and passing this lens to native controls.
                    let portalCameraTarget = 0;
                    if (
                        portalKey &&
                        stencilPortal &&
                        latest.current.portalActivated
                    ) {
                        stencilPortal.group.updateWorldMatrix(true, false);
                        const localFeet = stencilPortal.group.worldToLocal(
                            displayPosition.clone()
                        );
                        const approach = THREE.MathUtils.clamp(
                            (4 - localFeet.z) / 3,
                            0,
                            1
                        );
                        if (Math.abs(localFeet.x) < 3)
                            portalCameraTarget =
                                approach * approach * (3 - 2 * approach);
                    }
                    portalCameraMix +=
                        (portalCameraTarget - portalCameraMix) *
                        (reducedMotion.matches ? 1 : 1 - Math.exp(-7 * delta));
                    const distance =
                        (5 + entrance * 1.5 - flashMix * 1.6) *
                        (1 - 0.3 * portalCameraMix);
                    const horizontalDistance = Math.cos(pitch) * distance;
                    camera.position.set(
                        displayPosition.x + Math.sin(yaw) * horizontalDistance,
                        LOOK_HEIGHT - Math.sin(pitch) * distance,
                        displayPosition.z + Math.cos(yaw) * horizontalDistance
                    );
                    camera.rotation.set(pitch, yaw, 0, "YXZ");
                    camera.updateMatrixWorld();

                    self.group.position.copy(displayPosition);
                    if (travelVisual)
                        self.group.position.y += travelVisual.lift;
                    self.shadow.position.y = 0.016 - self.group.position.y;
                    const actualSpeed =
                        Math.hypot(
                            position.x - previousX,
                            position.z - previousZ
                        ) / Math.max(delta, 0.001);
                    const previousHeading = self.group.rotation.y;
                    let headingError = 0;
                    if (actualSpeed > 0.1) {
                        const rotation =
                            movementYaw + Math.atan2(-velocity.x, -velocity.y);
                        headingError = Math.atan2(
                            Math.sin(rotation - self.group.rotation.y),
                            Math.cos(rotation - self.group.rotation.y)
                        );
                        self.group.rotation.y += headingError * ease;
                    }
                    // Prediction already eases heading at the fixed simulation rate.
                    // Recomputing it with the camera yaw made scripted actors skate sideways.
                    if (predicted) self.group.rotation.y = predicted.rotation;
                    self.motion.speed =
                        (predicted
                            ? Math.hypot(predicted.vx, predicted.vz)
                            : actualSpeed) /
                        (Number.isFinite(latest.current.avatarScale) &&
                        latest.current.avatarScale > 0
                            ? THREE.MathUtils.clamp(
                                  latest.current.avatarScale,
                                  0.2,
                                  4
                              )
                            : 1);
                    self.motion.stopping = !movingInput;
                    self.motion.restConfirmed = !movingInput;
                    // Exponential controller braking integrates to v / damping.
                    self.motion.stopDistance = movingInput
                        ? undefined
                        : self.motion.speed / 28;
                    self.motion.grounded = position.y <= 0;
                    self.motion.height = position.y;
                    self.motion.verticalVelocity = verticalSpeed;
                    self.motion.jumpCount = jumpCount;
                    self.motion.turnRate =
                        Math.atan2(
                            Math.sin(self.group.rotation.y - previousHeading),
                            Math.cos(self.group.rotation.y - previousHeading)
                        ) / Math.max(delta, 0.001);
                    self.motion.headingError = headingError;
                    const intendedHeading =
                        movementYaw +
                        Math.atan2(-movementStrafe, -movementForward);
                    self.motion.turnIntent = movingInput
                        ? Math.atan2(
                              Math.sin(intendedHeading - self.group.rotation.y),
                              Math.cos(intendedHeading - self.group.rotation.y)
                          )
                        : 0;
                    if (
                        !travel &&
                        !arrivalLocked &&
                        !group &&
                        (movingInput ||
                            self.motion.speed > 0.04 ||
                            !self.motion.grounded ||
                            emoteIndex >= 0)
                    )
                        self.motion.postTeleportIdle = false;
                    self.motion.procedural =
                        !travel &&
                        !reducedMotion.matches &&
                        !previewing &&
                        latest.current.proceduralMotion !== false;
                    // Posture is applied to the live hips/spine, keeping the
                    // parent transform upright for stable world-space foot locks.
                    // Preview rotation is local presentation, leaving the shared movement pose intact.
                    avatarReveal = reducedMotion.matches
                        ? avatarRevealTarget
                        : Math.max(
                              0,
                              Math.min(
                                  1,
                                  avatarReveal +
                                      ((avatarRevealTarget ? 1 : -1) * delta) /
                                          (avatarRevealTarget
                                              ? avatarRevealSeconds
                                              : 0.16)
                              )
                          );
                    setAvatarReveal?.(
                        avatarReveal * avatarReveal * (3 - 2 * avatarReveal)
                    );
                    for (const visitor of avatars.values()) {
                        if (visitor.reveal === undefined) continue;
                        const amount = (visitor.reveal = Math.min(
                            1,
                            visitor.reveal +
                                delta / REMOTE_ARRIVAL_REVEAL_SECONDS
                        ));
                        visitor.setReveal?.(amount * amount * (3 - 2 * amount));
                        if (amount === 1) {
                            visitor.reveal = undefined;
                            visitor.setReveal = undefined;
                        }
                    }
                    const faceAngle = Math.atan2(
                        Math.sin(yaw + Math.PI - self.group.rotation.y),
                        Math.cos(yaw + Math.PI - self.group.rotation.y)
                    );
                    presentation.scale.setScalar(
                        returnView?.cameraMode === "first-person" &&
                            travel?.phase === "return"
                            ? easeWorldTravelHandoff(
                                  travelVisual?.returnProgress ?? 0
                              )
                            : 1
                    );
                    presentation.rotation.y = travel
                        ? 0
                        : previewMix * (faceAngle + previewYaw);
                    presentation.rotation.x = 0;
                    if (travelVisual || groupAnchor) {
                        self.group.rotation.y =
                            groupSelf?.rotation ?? travelYaw + Math.PI;
                        self.motion.speed = 0;
                        self.motion.grounded = true;
                        self.motion.verticalVelocity = 0;
                        self.motion.turnRate = 0;
                        self.motion.stopping = self.motion.restConfirmed = true;
                        if (travel?.phase === "return") {
                            self.motion.height = self.motion.stopDistance = 0;
                            self.motion.jumpCount =
                                self.motion.headingError =
                                self.motion.turnIntent =
                                    0;
                        }
                        if (travel?.phase !== "return") {
                            const partyCount = group
                                ? group.members.length
                                : new Set(travel.partyIds).size;
                            const distance =
                                4.6 + Math.min(partyCount, 7) * 0.44;
                            // Orbit the player instead of interpolating through their body.
                            const cameraMix =
                                travelVisual?.cameraMix ??
                                sampleTravelPresentation(
                                    {
                                        phase: "isolate",
                                        startedAt: group.startedAt,
                                        partyIds: [],
                                        reducedMotion: reducedMotion.matches,
                                    },
                                    time,
                                    group.startedAt
                                ).cameraMix;
                            const orbit =
                                travelCameraYaw +
                                Math.atan2(
                                    Math.sin(travelYaw - travelCameraYaw),
                                    Math.cos(travelYaw - travelCameraYaw)
                                ) *
                                    cameraMix;
                            const radius =
                                travelCameraRadius +
                                (distance - travelCameraRadius) * cameraMix;
                            camera.position.set(
                                travelAnchor.x + Math.sin(orbit) * radius,
                                travelCameraStart.y +
                                    (travelAnchor.y + 2 - travelCameraStart.y) *
                                        cameraMix,
                                travelAnchor.z + Math.cos(orbit) * radius
                            );
                            travelCameraTarget.copy(travelAnchor);
                            travelCameraTarget.y +=
                                1.05 + (travelVisual?.lift ?? 0) * 0.35;
                            travelFocus.lerpVectors(
                                travelCameraFocusStart,
                                travelCameraTarget,
                                cameraMix
                            );
                            camera.lookAt(travelFocus);
                            camera.updateMatrixWorld();
                        } else {
                            travelFocus.set(
                                displayPosition.x,
                                LOOK_HEIGHT,
                                displayPosition.z
                            );
                            if (returnView) {
                                const mix = easeWorldTravelHandoff(
                                    travelVisual.returnProgress
                                );
                                const scale =
                                    returnView.avatarHeight > 0 &&
                                    self.model?.height > 0
                                        ? self.model.height /
                                          returnView.avatarHeight
                                        : 1;
                                const sourceTarget = new THREE.Vector3(
                                    returnView.cameraTargetOffset.x,
                                    returnView.cameraTargetOffset.y,
                                    returnView.cameraTargetOffset.z
                                ).multiplyScalar(scale);
                                const sourceOrbit = new THREE.Vector3(
                                    returnView.cameraOffset.x -
                                        returnView.cameraTargetOffset.x,
                                    returnView.cameraOffset.y -
                                        returnView.cameraTargetOffset.y,
                                    returnView.cameraOffset.z -
                                        returnView.cameraTargetOffset.z
                                ).multiplyScalar(scale);
                                const sourceYaw = Math.atan2(
                                    sourceOrbit.x,
                                    sourceOrbit.z
                                );
                                const sourcePitch = Math.atan2(
                                    sourceOrbit.y,
                                    Math.hypot(sourceOrbit.x, sourceOrbit.z)
                                );
                                const orbit =
                                    sourceYaw +
                                    Math.atan2(
                                        Math.sin(yaw - sourceYaw),
                                        Math.cos(yaw - sourceYaw)
                                    ) *
                                        mix;
                                const orbitPitch =
                                    sourcePitch + (-pitch - sourcePitch) * mix;
                                const radius =
                                    sourceOrbit.length() +
                                    (distance - sourceOrbit.length()) * mix;
                                travelFocus.set(
                                    displayPosition.x +
                                        sourceTarget.x * (1 - mix),
                                    sourceTarget.y +
                                        (LOOK_HEIGHT - sourceTarget.y) * mix,
                                    displayPosition.z +
                                        sourceTarget.z * (1 - mix)
                                );
                                camera.position.set(
                                    travelFocus.x +
                                        Math.sin(orbit) *
                                            Math.cos(orbitPitch) *
                                            radius,
                                    travelFocus.y +
                                        Math.sin(orbitPitch) * radius,
                                    travelFocus.z +
                                        Math.cos(orbit) *
                                            Math.cos(orbitPitch) *
                                            radius
                                );
                                camera.lookAt(travelFocus);
                                camera.fov =
                                    returnView.fov +
                                    ((width < 600 ? 72 : 58) - returnView.fov) *
                                        mix;
                                camera.updateProjectionMatrix();
                                camera.updateMatrixWorld();
                            }
                        }
                    }
                    if (arrivalCamera) {
                        const progress = Math.min(
                            1,
                            Math.max(
                                0,
                                (time - arrivalCamera.startedAt) /
                                    WORLD_TRAVEL_HANDOFF_MS
                            )
                        );
                        const mix = easeWorldTravelHandoff(progress);
                        const orbit =
                            arrivalCamera.yaw +
                            Math.atan2(
                                Math.sin(yaw - arrivalCamera.yaw),
                                Math.cos(yaw - arrivalCamera.yaw)
                            ) *
                                mix;
                        const radius =
                            arrivalCamera.radius +
                            (horizontalDistance - arrivalCamera.radius) * mix;
                        camera.position.set(
                            displayPosition.x + Math.sin(orbit) * radius,
                            arrivalCamera.height +
                                (camera.position.y - arrivalCamera.height) *
                                    mix,
                            displayPosition.z + Math.cos(orbit) * radius
                        );
                        travelCameraTarget.set(
                            displayPosition.x,
                            arrivalCamera.focusHeight +
                                (LOOK_HEIGHT - arrivalCamera.focusHeight) * mix,
                            displayPosition.z
                        );
                        camera.lookAt(travelCameraTarget);
                        camera.updateMatrixWorld();
                        if (progress === 1) arrivalCamera = undefined;
                    }
                    if (
                        (travelVisual || group) &&
                        latest.current.onTravelView
                    ) {
                        latest.current.onTravelView({
                            cameraOffset: {
                                x: camera.position.x - displayPosition.x,
                                y: camera.position.y - displayPosition.y,
                                z: camera.position.z - displayPosition.z,
                            },
                            cameraTargetOffset: {
                                x: travelFocus.x - displayPosition.x,
                                y: travelFocus.y - displayPosition.y,
                                z: travelFocus.z - displayPosition.z,
                            },
                            ...(group && groupSelf && groupAnchor
                                ? {
                                      spawnOffset: {
                                          x: groupSelf.x - groupAnchor.x,
                                          y: groupSelf.y - groupAnchor.y,
                                          z: groupSelf.z - groupAnchor.z,
                                      },
                                      peers: groupTravelPeers(group),
                                  }
                                : {}),
                            avatarRotation: self.group.rotation.y,
                            avatarLift: travelVisual?.lift ?? 0,
                            avatarHeight: self.model?.height ?? 1.8,
                            cameraMode: "third-person",
                            fov: camera.fov,
                        });
                    }
                    if (worldPreview) {
                        if (!previewWorld)
                            previewWorld = createTravelPreviewWorld(
                                THREE,
                                scene
                            );
                        previewWorld.show(
                            worldPreview.progress,
                            previewWorldAnchor,
                            previewWorldYaw
                        );
                        floor.visible = false;
                        departureFloor.setProgress(1, travelAnchor);
                        scene.background = arrivalBlack;
                        scene.fog = null;
                    } else {
                        previewWorld?.hide();
                        const dissolve = travelVisual?.dissolve ?? 0;
                        const returning = travel?.phase === "return";
                        // Dim the intact lobby after the camera settles. Keep the
                        // tile buffers cold until a return actually needs them.
                        const dim = dissolve * dissolve * (3 - 2 * dissolve);
                        const brightness = Math.pow(1 - dim, 2.2);
                        floorMaterial.userData.lobbyBrightness.value = returning
                            ? 1
                            : brightness;
                        departureFloor.setProgress(
                            returning ? travelVisual.returnProgress : 1,
                            travelAnchor,
                            "reveal"
                        );
                        floor.visible = returning
                            ? dissolve === 0
                            : brightness > 0;
                        departureBackdrop
                            .copy(backdrop)
                            .multiplyScalar(
                                returning ? 1 - dissolve : brightness
                            );
                        scene.background = departureBackdrop;
                        if (dissolve > 0) scene.fog = null;
                        else if (!scene.fog)
                            scene.fog = new THREE.Fog(
                                backdrop,
                                environment.fogNear,
                                environment.fogFar
                            );
                    }
                    host.dataset.worldDissolve = String(
                        travelVisual?.dissolve ?? 0
                    );
                    if (process.env.NODE_ENV === "development") {
                        canvas.dataset.worldDissolve =
                            host.dataset.worldDissolve;
                        canvas.dataset.worldBrightness = String(
                            floorMaterial.userData.lobbyBrightness.value
                        );
                        canvas.dataset.worldReturn =
                            travel?.phase === "return"
                                ? String(travelVisual.returnProgress)
                                : "";
                        canvas.dataset.worldReturnHandoff =
                            travel?.phase === "return"
                                ? String(travelVisual.returnHandoff)
                                : "";
                        canvas.dataset.worldDissolveTiles = String(
                            departureFloor.mesh.userData.tiles ?? 0
                        );
                        canvas.dataset.worldDissolveTilesActive = String(
                            departureFloor.mesh.visible
                        );
                    }
                    // The circle and its orbit share the clap cue with lights-out.
                    const haloElapsed = travel
                        ? time - travel.startedAt - TRAVEL_DISSOLVE_AT_MS
                        : -1;
                    const staticHalo =
                        travel?.reducedMotion || reducedMotion.matches;
                    const haloActive =
                        !!travelVisual &&
                        !travel?.viaPortal &&
                        travel?.phase !== "return" &&
                        (staticHalo || haloElapsed >= 0);
                    travelHalo.visible = haloActive && !worldPreview;
                    // A quiet white track stays lit in the void; only its highlight orbits.
                    const haloVisibility = haloActive
                        ? travelVisual.opacity / 0.6
                        : 0;
                    travelHaloMaterial.opacity = haloVisibility * 0.18;
                    travelGlowMaterial.opacity = haloVisibility * 0.95;
                    travelGlow.rotation.z =
                        haloActive && !staticHalo
                            ? sampleTravelGlowAngle(haloElapsed)
                            : 0;
                    travelHalo.position.set(
                        displayPosition.x,
                        0.026,
                        displayPosition.z
                    );
                    travelHaloText.setLabel(
                        haloActive && !worldPreview ? travel.label : undefined
                    );
                    travelHaloText.update({
                        opacity: Math.min(1, haloVisibility * 1.15),
                        elapsedMs: staticHalo ? 0 : haloElapsed,
                        // Halo-local Y is world -Z after its floor rotation.
                        cameraAngle: Math.atan2(
                            displayPosition.z - camera.position.z,
                            camera.position.x - displayPosition.x
                        ),
                        staticMotion: staticHalo,
                    });
                    // Steady size: the ring and its band only fade, never breathe.
                    travelHalo.scale.setScalar(travelVisual ? 2 : 1);
                    travelLight.position.set(
                        displayPosition.x,
                        displayPosition.y + 1.4,
                        displayPosition.z
                    );
                    travelLight.intensity = travelVisual
                        ? travelVisual.pulse *
                          travelVisual.opacity *
                          backend.lightScale *
                          1.8
                        : 0;
                    const wantedAvatarUrl = latest.current.avatarUrl;
                    if (wantedAvatarUrl !== failedAvatarUrl)
                        failedAvatarUrl = undefined;
                    loadVisitor(
                        self,
                        failedAvatarUrl
                            ? DEFAULT_LOBBY_AVATAR_URL
                            : wantedAvatarUrl,
                        latest.current.avatarScale,
                        true,
                        latest.current.profilePhoto
                    );
                    settleReturnIdle(self);
                    if (process.env.NODE_ENV === "development")
                        canvas.dataset.postTeleportIdle = String(
                            !!self.motion.postTeleportIdle
                        );
                    if (
                        latest.current.flash &&
                        localFlashAllowed() &&
                        self.model?.playFlash
                    ) {
                        flashPresentation.sync({
                            id: "self",
                            flash: latest.current.flash,
                            avatar: self.model,
                            parent: self.group,
                            local: true,
                            reducedMotion: reducedMotion.matches,
                        });
                    }
                    // Warm only the current local rig, while the picker is open.
                    // Failed preparation is retried by selection, not every frame.
                    if (
                        latest.current.flashPreviewOpen &&
                        self.model?.prepareFlash &&
                        !flashWarmed.has(self.model)
                    ) {
                        flashWarmed.add(self.model);
                        void self.model.prepareFlash().catch(() => {});
                    }
                    const selfTravelPose = travelVisual?.pose || arrivalPose;
                    if (process.env.NODE_ENV === "development") {
                        canvas.dataset.travelAnimation =
                            selfTravelPose?.name ?? "";
                        canvas.dataset.travelAnimationTime = String(
                            selfTravelPose?.time ?? 0
                        );
                    }
                    if (
                        !selfTravelPose ||
                        !self.model?.sampleTravelPose?.(selfTravelPose)
                    )
                        self.model?.update(
                            delta,
                            travelVisual
                                ? travel?.phase === "return"
                                    ? undefined
                                    : travelVisual.animation
                                : previewing || group
                                ? "IDLE"
                                : emoteIndex >= 0
                                ? emoteIndex
                                : undefined,
                            self.motion
                        );
                    self.motion.postTeleportIdleTime = undefined;
                    updateParticipants(delta, time);
                    flashPresentation.finishFrame(delta, reducedMotion.matches);
                    markSelection();
                    if (
                        latest.current.onMotionFrame &&
                        time - lastTraceTime >= 1000 / 60 - 0.001
                    ) {
                        lastTraceTime = time;
                        latest.current.onMotionFrame({
                            timeMs: time,
                            dt: delta,
                            actors: (
                                [["self", self], ...avatars.entries()] as Array<
                                    [string, Visitor]
                                >
                            ).map(([id, visitor]) => ({
                                id,
                                x: visitor.group.position.x,
                                y: visitor.group.position.y,
                                z: visitor.group.position.z,
                                rotation: visitor.group.rotation.y,
                                avatarUrl: visitor.url,
                                motion: { ...visitor.motion },
                            })),
                        });
                    }
                    crowd.flush(camera);
                    updatePortal(performance.now());
                    if (
                        portalKey &&
                        stencilPortal &&
                        latest.current.renderPortal
                    ) {
                        stencilPortal.group.updateWorldMatrix(true, false);
                        const local = (point: THREE.Vector3) => {
                            const result = stencilPortal.group.worldToLocal(
                                point.clone()
                            );
                            result.y += PORTAL_HEIGHT;
                            return { x: result.x, y: result.y, z: result.z };
                        };
                        const target = camera
                            .getWorldDirection(new THREE.Vector3())
                            .multiplyScalar(
                                camera.position.distanceTo(displayPosition)
                            )
                            .add(camera.position);
                        const live = latest.current.renderPortal({
                            cameraPosition: local(camera.position),
                            cameraTarget: local(target),
                            playerPosition: local(displayPosition),
                            avatarRotation:
                                self.group.rotation.y -
                                stencilPortal.group.rotation.y,
                            avatarHeight: self.model?.height ?? 1.8,
                            movement: {
                                keys: [...keys].filter((code) =>
                                    /^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(
                                        code
                                    )
                                ),
                                speed: self.motion.speed,
                                velocity: new THREE.Vector3(
                                    (position.x - previousX) /
                                        Math.max(delta, 0.001),
                                    0,
                                    (position.z - previousZ) /
                                        Math.max(delta, 0.001)
                                ).applyAxisAngle(
                                    new THREE.Vector3(0, 1, 0),
                                    -stencilPortal.group.rotation.y
                                ),
                            },
                            fov: camera.fov,
                            aspect: camera.aspect,
                        });
                        portalLive = live;
                        stencilPortal.setLive(live);
                    }
                    if (!compiling) {
                        camera.updateMatrixWorld();
                        speechBubbles.update(
                            latest.current.travel ||
                                latest.current.groupFormation
                                ? undefined
                                : latest.current.speech,
                            headOf,
                            projectSpeech
                        );
                        try {
                            backend.render(renderer, scene, camera);
                        } catch {
                            onContextLost(new Event("lobbycontextlost"));
                            return;
                        }
                        if (
                            travel?.phase === "return" &&
                            self.model &&
                            latest.current.travel === travel &&
                            readyReturn !== travel.startedAt
                        ) {
                            // Keep the outgoing iframe visible until this canvas
                            // contains its new idle pose and stable return camera.
                            readyReturn = travel.startedAt;
                            returnRenderedAt = time;
                            latest.current.onReturnReady?.(travel.startedAt);
                        }
                        if (
                            travel?.phase === "return" &&
                            travelVisual?.returnComplete &&
                            self.model &&
                            latest.current.travel === travel &&
                            completedReturn !== travel.startedAt
                        ) {
                            completedReturn = travel.startedAt;
                            clearInput();
                            canvas.focus({ preventScroll: true });
                            latest.current.onReturnComplete?.(travel.startedAt);
                        }
                        if (latest.current.onStats && time - lastStats > 500) {
                            latest.current.onStats({
                                ...crowd.stats,
                                ...backend.stats(renderer),
                                backend: backend.name(renderer),
                                instances: crowd.stats.instances + nativeReady,
                                visible: crowd.stats.visible + nativeVisible,
                                nativeAvatars: nativeReady,
                                surrogateAvatars,
                                population,
                                admitted: avatars.size,
                                pendingLoads: activeLoads + remoteQueue.size,
                                labels: nameTags?.count ?? 0,
                                ...frameTimings.stats(),
                                viewport: {
                                    width,
                                    height,
                                    bufferWidth: canvas.width,
                                    bufferHeight: canvas.height,
                                },
                            });
                            lastStats = time;
                        }
                        if (!ready && self.model) {
                            ready = true;
                            latest.current.onReady();
                        }
                    }
                    if (!travel && !group && time - lastMoveSent >= 50) {
                        const pose = `${position.x.toFixed(
                            3
                        )},${position.z.toFixed(
                            3
                        )},${self.group.rotation.y.toFixed(
                            3
                        )},${position.y.toFixed(3)},${emoteIndex}`;
                        if (pose !== lastPose) {
                            latest.current.onMove({
                                x: position.x,
                                y: position.y,
                                z: position.z,
                                rotation: self.group.rotation.y,
                                animation: emoteIndex,
                                floor: position.y === 0,
                            });
                            lastPose = pose;
                        }
                        lastMoveSent = time;
                    }
                    const frameCpuMs = performance.now() - cpuStart;
                    if (transitionTimings) {
                        const changed = transitionTimings.record(
                            travel,
                            time,
                            frameCpuMs
                        );
                        publishTransitionTimings(time, changed);
                    }
                    frameTimings.record(
                        time,
                        frameCpuMs,
                        ready &&
                            !compiling &&
                            activeLoads === 0 &&
                            remoteQueue.size === 0
                    );
                    // Once the departure has finished on black, only the seated
                    // avatar and the travel circle are drawn while the hidden
                    // destination loads: render them at the native ratio and
                    // leave the GPU to the destination until the trip ends.
                    const coveredHold =
                        !!travel &&
                        travel.phase !== "return" &&
                        travel.phase !== "isolate" &&
                        // The development preview draws its reveal here.
                        !latest.current.worldRevealPreview &&
                        (travel.reducedMotion ||
                            time - travel.startedAt >= TRAVEL_DEPARTURE_MS);
                    const pixelRatio =
                        supersampled && !coveredHold
                            ? supersampledPixelRatio
                            : nativePixelRatio;
                    if (currentPixelRatio !== pixelRatio) {
                        currentPixelRatio = pixelRatio;
                        renderer.setPixelRatio(pixelRatio);
                        resize();
                    }
                    if (supersampled && ++supersampleCheck % 60 === 0) {
                        const timing = frameTimings.stats();
                        // ~45 fps or worse over a settled window: stop supersampling.
                        if (
                            timing.sampleFrames >= 120 &&
                            timing.frameIntervalMs.p50 > 22
                        ) {
                            supersampled = false;
                            if (currentPixelRatio !== nativePixelRatio) {
                                currentPixelRatio = nativePixelRatio;
                                renderer.setPixelRatio(nativePixelRatio);
                                resize();
                            }
                        }
                    }
                    frame = requestAnimationFrame(render);
                }

                function wake() {
                    if (document.hidden) transitionTimings?.pause();
                    else if (
                        !latest.current.active &&
                        transitionTimings?.finish()
                    )
                        publishTransitionTimings(performance.now(), true);
                    if (!latest.current.active || document.hidden) {
                        clearFlashes();
                        if (frame) cancelAnimationFrame(frame);
                        frame = 0;
                        lastTime = 0;
                        frameTimings.reset();
                        clearInput();
                        return;
                    }
                    if (!disposed && !contextLost && !frame) {
                        frame = requestAnimationFrame(render);
                    }
                }
                function onContextLost(event: Event) {
                    if (disposed || contextLost) return;
                    event.preventDefault();
                    contextLost = true;
                    clearFlashes();
                    if (transitionTimings?.finish())
                        publishTransitionTimings(performance.now(), true);
                    if (frame) cancelAnimationFrame(frame);
                    frame = 0;
                    clearInput();
                    latest.current.onError(
                        "The 3D lobby lost its graphics connection. Please try entering again.",
                        "renderer"
                    );
                }
                wakeRef.current = wake;
                canvas.addEventListener("wheel", onWheel, { passive: false });
                canvas.addEventListener("pointerdown", onPointerDown);
                canvas.addEventListener("pointermove", onPointerMove);
                canvas.addEventListener("pointerup", onPointerUp);
                canvas.addEventListener("pointercancel", onPointerUp);
                canvas.addEventListener("lostpointercapture", onPointerUp);
                canvas.addEventListener("webglcontextlost", onContextLost);
                canvas.addEventListener("lobbycontextlost", onContextLost);
                touch.addEventListener("pointerdown", onTouchDown);
                touch.addEventListener("pointermove", onTouchMove);
                touch.addEventListener("pointerup", onTouchUp);
                touch.addEventListener("pointercancel", onTouchUp);
                touch.addEventListener("lostpointercapture", onTouchUp);
                window.addEventListener("keydown", onKeyDown);
                // Chat/dialog handlers may stop bubbling, but a release must always clear
                // held movement so the visitor cannot continue walking behind an overlay.
                window.addEventListener("keyup", onKeyUp, true);
                window.addEventListener("blur", clearInput);
                document.addEventListener("focusin", onFocus, true);
                document.addEventListener("visibilitychange", wake);
                wake();

                return () => {
                    disposed = true;
                    stencilPortal?.dispose();
                    wakeRef.current = () => undefined;
                    cancelAnimationFrame(frame);
                    observer.disconnect();
                    canvas.removeEventListener("wheel", onWheel);
                    canvas.removeEventListener("pointerdown", onPointerDown);
                    canvas.removeEventListener("pointermove", onPointerMove);
                    canvas.removeEventListener("pointerup", onPointerUp);
                    canvas.removeEventListener("pointercancel", onPointerUp);
                    canvas.removeEventListener(
                        "lostpointercapture",
                        onPointerUp
                    );
                    canvas.removeEventListener(
                        "webglcontextlost",
                        onContextLost
                    );
                    canvas.removeEventListener(
                        "lobbycontextlost",
                        onContextLost
                    );
                    touch.removeEventListener("pointerdown", onTouchDown);
                    touch.removeEventListener("pointermove", onTouchMove);
                    touch.removeEventListener("pointerup", onTouchUp);
                    touch.removeEventListener("pointercancel", onTouchUp);
                    touch.removeEventListener("lostpointercapture", onTouchUp);
                    window.removeEventListener("keydown", onKeyDown);
                    window.removeEventListener("keyup", onKeyUp, true);
                    window.removeEventListener("blur", clearInput);
                    document.removeEventListener("focusin", onFocus, true);
                    document.removeEventListener("visibilitychange", wake);
                    remoteQueue.clear();
                    activeRemoteLoads.clear();
                    delete canvas.dataset.travelFrameStats;
                    flashPresentation.dispose();
                    self.request?.abort();
                    self.model?.dispose();
                    for (const avatar of avatars.values()) {
                        avatar.request?.abort();
                        avatar.model?.dispose();
                    }
                    previewWorld?.dispose();
                    departureFloor.dispose();
                    crowd.dispose();
                    crowdShadows.dispose();
                    speechBubbles.dispose();
                    labels.replaceChildren();
                    scene.clear();
                    nameTags?.dispose();
                    geometries.forEach((value) => value.dispose());
                    materials.forEach((value) => value.dispose());
                    textures.forEach((value) => value.dispose());
                    travelHaloText.dispose();
                    renderer.dispose();
                };
            }
        }, []);

        useEffect(() => {
            wakeRef.current();
        }, [
            props.active,
            props.travel?.startedAt,
            props.travel?.phase,
            props.travel?.dissolveProgress,
            props.travel?.dissolveStartedAt,
            props.groupFormation?.id,
            props.groupFormation?.members,
            props.worldRevealPreview?.arrived,
        ]);

        return (
            <div className="lobby-scene" ref={hostRef}>
                <canvas
                    ref={canvasRef}
                    tabIndex={0}
                    aria-label="Oncyber lobby. Use WASD or up/down arrows to move, left/right arrows to turn, Shift to sprint, Space to jump and again to double jump, 1–9 to emote, and drag or scroll to look around."
                />
                <div ref={labelRef} className="lobby-scene-labels" />
                <div
                    style={
                        props.avatarPreview ||
                        props.travel ||
                        props.groupFormation
                            ? { display: "none" }
                            : undefined
                    }
                    ref={touchRef}
                    className="lobby-scene-thumbpad"
                    aria-hidden="true"
                >
                    <span />
                </div>
                <style jsx>{`
                    .lobby-scene,
                    canvas,
                    .lobby-scene-labels {
                        position: absolute;
                        inset: 0;
                        width: 100%;
                        height: 100%;
                    }
                    .lobby-scene {
                        overflow: hidden;
                        background: transparent;
                    }
                    canvas {
                        display: block;
                        touch-action: none;
                        cursor: grab;
                        outline: none;
                    }
                    .lobby-scene-labels {
                        pointer-events: none;
                    }
                    .lobby-scene-thumbpad {
                        display: none;
                        position: absolute;
                        bottom: max(184px, env(safe-area-inset-bottom));
                        left: 22px;
                        width: 88px;
                        height: 88px;
                        border: 1px solid #ffffff1f;
                        border-radius: 50%;
                        background: #111318b3;
                        touch-action: none;
                        user-select: none;
                    }
                    .lobby-scene-thumbpad span {
                        position: absolute;
                        width: 34px;
                        height: 34px;
                        top: 26px;
                        left: 26px;
                        border-radius: 50%;
                        background: #d8dce04d;
                        transform: translate(
                            var(--thumb-x, 0px),
                            var(--thumb-y, 0px)
                        );
                        pointer-events: none;
                    }
                    @media (pointer: coarse) {
                        .lobby-scene-thumbpad {
                            display: block;
                        }
                    }
                `}</style>
            </div>
        );
    };
}
