import { holdArtworkPresentation } from "@utils/artworkPresentation";
import Renderer from "@3renderer";
import { warmWorldTransition } from "@features/lobby/warmWorldTransition";
import { TransitionFrameTimings } from "@features/lobby/transitionFrameTimings";
import { createWorldRevealClock } from "@features/lobby/worldRevealClock";
import { rememberNativeCameraPreference } from "@utils/nativeCameraPreference";
import * as THREE from "three";
import Camera from "@3camera";
import Scene from "@3scene";
import Emitter from "@3emitter";
import Events from "@3events";
import Players from "../factory/player";
import Root from "../root";
import {
    CANVAS,
    CSS_CANVAS,
    IS_FIRST_PERSON,
    SET_IS_FIRST_PERSON,
} from "../constants";
import {
    buildWorldCubeReveal,
    type createWorldCubeReveal,
} from "@features/lobby/worldCubeReveal";
import { rememberWorldTransition } from "@features/lobby/worldTransitionCache";
import {
    buildWorldTransitionMedia,
    type createWorldTransitionMedia,
} from "@features/lobby/worldTransitionMedia";
import { finishInSlices, finishNow } from "@features/lobby/slicedWork";
import { getWorldTransitionAnimatedRoots } from "@features/lobby/worldTransitionAnimatedRoots";
import {
    getWorldRevealDetail,
    WORLD_REVEAL_RIGID_PROPS,
} from "@features/lobby/worldRevealDetail";
import { getWorldRevealTriangleBudget } from "@features/lobby/worldRevealTriangleBudget";
import { createWorldSkyReveal } from "@features/lobby/worldSkyReveal";
import { createWorldReflectorReveal } from "@features/lobby/worldReflectorReveal";
import {
    readWorldRevealFitHint,
    rememberWorldRevealFitHint,
} from "@features/lobby/worldRevealFitHints";
import {
    WORLD_STAND_UP_FLOOR_RADIUS_M,
    WORLD_TILE_REVEAL_MS,
    worldStandUpProgress,
} from "@features/lobby/worldTileMotion";
import {
    createNoopWorldReveal,
    buildWorldSweepReveal,
    readWorldRevealStyle,
    WORLD_SWEEP_REVEAL_MS,
} from "@features/lobby/worldSweepReveal";
import {
    createTravelCameraResolver,
    orientTravelViewToHeading,
    type CompactTravelCameraProfile,
} from "@features/lobby/worldTravelCamera";
import { MAX_ZOOM_OUT } from "../camera/constants";
import {
    applyWorldTravelView,
    WORLD_TRAVEL_HANDOFF_MS,
    easeWorldTravelHandoff,
} from "@features/lobby/worldTravelPose";
import { createLobbyTravelPeers } from "./lobbyTravelPeers";
import {
    holdRecordingArrivals,
    readRecordingParty,
} from "../factory/multiplayer/recordingParty";
import {
    createNativeTravelAnimation,
    NATIVE_TRAVEL_STAND_UP_MS,
} from "./nativeTravelAnimation";
import {
    resolveNativeTravelGroundedFeet,
    synchronizeNativeTravelGrounding,
} from "./nativeTravelGrounding";
import {
    holdNativeTravelIdle,
    readNativeTravelIdleTime,
} from "./nativeTravelIdle";
import Shared from "../globals/shared";
import { nativeTravelAvatarYawOffset } from "./nativeTravelAvatarYaw";
import type { LobbyDestinationEntryOptions } from "@features/lobby/lobbyJourneyProtocol";

type RevealWorld = { nextUpdate(signal?: AbortSignal): Promise<unknown> };

/** Native-only entry. Lives inside the destination renderer; never captures a
 * canvas or DOM surface. The bridge waits for prepare()'s rendered black frame. */
export function createNativeLobbyReveal(world: RevealWorld) {
    return finishNow(nativeLobbyReveal(world));
}

/** The same entry, built a few milliseconds per frame so the lobby keeps
 * animating while this hidden destination partitions its tiles. */
export function createNativeLobbyRevealInSlices(
    world: RevealWorld,
    pause: () => Promise<void>
) {
    return finishInSlices(nativeLobbyReveal(world), pause);
}

function* nativeLobbyReveal(world: RevealWorld) {
    const player: any = Players.main;
    const originalCamera: any = Camera.current;
    let camera: any = originalCamera;
    if (!player || !camera || !Root.currentSpace?.scene)
        throw new Error("The world's scene is not ready for arrival.");
    const spawn = player.position.clone();
    const anchor = spawn.clone();
    const renderWaitAbort = new AbortController();
    let peers: ReturnType<typeof createLobbyTravelPeers> | undefined;
    let peerPreparation = 0;
    let travelAnimation: ReturnType<typeof createNativeTravelAnimation>;
    let releaseArtwork: (() => void) | undefined;
    let travelAnimationPreparation: Promise<void> | undefined;
    const prepareTravelAnimation = (reduced: boolean) =>
        (travelAnimationPreparation ||= (async () => {
            const { createAvatar } = await import(
                "@features/lobby/webgpu/avatarAdapter"
            );
            if (disposed) throw new Error("Arrival cancelled.");
            travelAnimation = createNativeTravelAnimation(
                player,
                Scene,
                createAvatar
            );
            await travelAnimation.prepare(reduced);
            if (disposed) throw new Error("Arrival cancelled.");
        })());
    const heldPeers = new Map<
        any,
        {
            visible: boolean;
            avatar?: { object: any; visible: boolean };
            name?: { object: any; visible: boolean };
        }
    >();
    const holdNativePeers = () => {
        if (!peers?.hasAvatars) {
            releaseNativePeers();
            return;
        }
        for (const other of Players.instances || []) {
            if (other === player) continue;
            if (!heldPeers.has(other))
                heldPeers.set(other, { visible: other.visible });
            const savedPeer = heldPeers.get(other);
            // Real avatars and labels can finish loading after the room connects.
            // Snapshot each actual object before hiding it, never an absent one.
            if (other.avatar3D && savedPeer.avatar?.object !== other.avatar3D)
                savedPeer.avatar = {
                    object: other.avatar3D,
                    visible: other.avatar3D.visible,
                };
            if (
                other.username?.wrapper &&
                savedPeer.name?.object !== other.username.wrapper
            )
                savedPeer.name = {
                    object: other.username.wrapper,
                    visible: other.username.wrapper.visible,
                };
            other.visible = false;
            if (other.avatar3D) other.avatar3D.visible = false;
            if (other.username?.wrapper) other.username.wrapper.visible = false;
        }
    };
    const releaseNativePeers = () => {
        for (const [other, saved] of heldPeers) {
            other.visible = saved.visible;
            if (saved.avatar && saved.avatar.object === other.avatar3D)
                other.avatar3D.visible = saved.avatar.visible;
            if (saved.name && saved.name.object === other.username?.wrapper)
                other.username.wrapper.visible = saved.name.visible;
        }
        heldPeers.clear();
    };
    const releaseTravelPeers = () => {
        peerPreparation++;
        peers?.dispose();
        peers = undefined;
        releaseNativePeers();
    };
    const prepareTravelPeers = (
        incoming: LobbyDestinationEntryOptions["travelView"],
        reducedMotion: boolean
    ) => {
        const generation = ++peerPreparation;
        if (!incoming?.peers?.length) {
            releaseTravelPeers();
            return;
        }
        const snapshots = incoming.peers.map((peer) => ({
            ...peer,
            offset: { ...peer.offset },
        }));
        const origin = { x: anchor.x, y: anchor.y, z: anchor.z };
        void (async () => {
            const { createAvatar } = await import(
                "@features/lobby/webgpu/avatarAdapter"
            );
            if (disposed || !locked || generation !== peerPreparation) return;
            if (!peers) peers = createLobbyTravelPeers(Scene, createAvatar);
            peers.update(performance.now(), view?.avatarLift ?? 0);
            await peers.prepare(snapshots, origin, reducedMotion);
        })().catch(() => {
            if (!disposed && locked && generation === peerPreparation)
                releaseTravelPeers();
        });
    };
    const controls: any = Camera.currentControls;
    // Capture the room's authored heading before staging replaces both camera
    // and avatar transforms. The idle avatar's yaw need not match its spawn camera.
    let spawnCameraYaw: number | undefined = [
        controls?.world?.roomParameters?.initialPlayerRotation?.y,
        originalCamera.roomParameters?.initialPlayerRotation?.y,
        controls?.world?.initial?.cameraRot?.y,
    ].find((yaw) => Number.isFinite(yaw));
    if (spawnCameraYaw === undefined && originalCamera.getWorldDirection) {
        const forward = originalCamera.getWorldDirection(new THREE.Vector3());
        if (
            Number.isFinite(forward.x) &&
            Number.isFinite(forward.z) &&
            Math.hypot(forward.x, forward.z) > 1e-6
        )
            spawnCameraYaw = Math.atan2(-forward.x, -forward.z);
    }
    const orientView = (incoming: LobbyDestinationEntryOptions["travelView"]) =>
        incoming && spawnCameraYaw !== undefined
            ? orientTravelViewToHeading(incoming, spawnCameraYaw)
            : incoming;
    const avatar = player.avatar3D;
    const saved = {
        enabled: controls?.enabled,
        firstPerson: IS_FIRST_PERSON,
        cameraActive: Camera.active,
        position: player.position.clone(),
        rotation: player.rotation.clone(),
        playerVisible: player.visible,
        isSitting: player.isSitting,
        seatedMesh: player.seatedMesh,
        deactivated: player.deactivated,
        isMoving: player.isMoving,
        playerOnFloor: player.isPlayerOnFloor,
        playerIsJumping: player.isJumping,
        avatarIsSitting: avatar?.isSitting,
        cameraPosition: camera.position.clone(),
        cameraQuaternion: camera.quaternion.clone(),
        cameraTravelFraming: camera.travelFraming
            ? { ...camera.travelFraming }
            : undefined,
        fov: camera.fov,
        avatarVisible: avatar?.visible,
        opacity: avatar?.opacity,
        emote: avatar?.emote,
        travelReadyIdle: avatar?.travelReadyIdle,
        travelReadyIdleUntilMovement: avatar?.travelReadyIdleUntilMovement,
        onFloor: avatar?.onFloor,
        isJumping: avatar?.isJumping,
        floorVelocity: avatar?.floorVelocity,
        smoothedFloorVelocity: avatar?.smoothedFloorVelocity,
        cssVisibility: CSS_CANVAS?.style.visibility,
        usernameVisible: player.username?.wrapper?.visible,
        avatarHeight: avatar?.headPosition?.y,
        baseScaleRatio: avatar?.baseScaleRatio,
        meshScale: avatar?.highQualityMeshes?.scale?.clone(),
    };
    const playerState = controls?.world?.playerState;
    const movementSeeds = new Map<string, any>();
    for (const key of [
        "veclocity",
        "direction",
        "originalDirection",
        "rotation",
        "quaternion",
        "rotateQuarternion",
        "tempRotation",
        "playerOnFloor",
        "isJumping",
        "jumpCount",
        "jumpHeld",
        "currentSpeed",
        "keyStates",
        "joystickStates",
    ])
        if (playerState?.[key] !== undefined)
            movementSeeds.set(
                key,
                playerState[key]?.clone?.() ??
                    (typeof playerState[key] === "object"
                        ? { ...playerState[key] }
                        : playerState[key])
            );
    const savedJoystickPan = playerState?.joystickState?.pan?.clone();
    const cameraSeeds = new Map<string, any>();
    for (const key of [
        "cameraPosition",
        "idealCameraPosition",
        "cameraTarget",
        "idealCameraTarget",
        "theta",
        "phi",
        "radius",
        "targetRadius",
    ])
        if (camera[key] !== undefined)
            cameraSeeds.set(key, camera[key]?.clone?.() ?? camera[key]);
    let disposed = false,
        complete = false,
        locked = true,
        frame = 0,
        handoffFrame = 0;
    let view: LobbyDestinationEntryOptions["travelView"];
    let compactProfile: CompactTravelCameraProfile | undefined;
    let reducedForEntry = false;
    let handoffFeet: THREE.Vector3 | undefined;
    let handoffPending: Promise<void> | undefined;
    let rejectHandoff: ((reason: Error) => void) | undefined;
    const resolver = createTravelCameraResolver(
        THREE,
        controls?.world?.rayIntersect?.bind(controls.world)
    );
    const resolveView = (incoming: typeof view, allowOrbit = true) =>
        incoming &&
        resolver.resolve(anchor, incoming, {
            near: camera.near,
            aspect: camera.aspect,
            allowOrbit,
        });
    const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
    );
    let pending: Promise<void> | undefined;
    let rejectPending: ((reason: Error) => void) | undefined;
    const spaceSize = Root.currentSpace.bbox?.getSize(new THREE.Vector3());
    // Keep complete architecture first, then spend remaining geometry bounds on
    // smaller nearby squares and distant walls. Avoid failed fine-grid builds.
    const revealRadius = 18;
    let fitAttempts = 0;
    const buildStarted = performance.now();
    const skippedMeshes: Array<Record<string, unknown>> = [];
    const revealedInstances: Record<string, number> = {};
    let budgetLimited = false;
    const skySources: any[] = [];
    Root.currentSpace.scene.traverse?.((object: any) => {
        if (object.isMesh) skySources.push(object);
    });
    // Recognized image backdrops fade in behind the assembling room. Claim them
    // before partitioning so giant authored sky shells cannot consume tile bounds.
    const sky = createWorldSkyReveal(THREE, {
        scene: Scene,
        sources: skySources,
        getCamera: () => camera,
    });
    const reflectors = createWorldReflectorReveal({ sources: skySources });
    const skySourceSet = new Set(sky.supportedSources);
    const reflectorSourceSet = new Set(reflectors.supportedSources);
    const animatedRoots = getWorldTransitionAnimatedRoots(
        THREE,
        Root.currentSpace.scene
    );
    const animatedRootSet = new Set(animatedRoots);
    const mediaRoots = [
        ...animatedRoots,
        Root.currentArtworks,
        Root.currentStreams,
        Root.currentPortals,
        Root.linkPortal,
    ].filter(Boolean);
    const revealRoots = [Root.currentSpace.scene, ...mediaRoots].filter(
        Boolean
    );
    const playerRoots = new Set([player, ...(Players.instances || [])]);
    const excludeSource = (object: any) =>
        playerRoots.has(object) ||
        object.name === "avatarContainer" ||
        skySourceSet.has(object) ||
        reflectorSourceSet.has(object);
    const fitSettings = {
        cellSize: 2,
        rigidProps: WORLD_REVEAL_RIGID_PROPS,
        radius: revealRadius,
        coverage: "all" as const,
        refinement: getWorldRevealDetail(
            camera.position,
            spawnCameraYaw === undefined
                ? camera.getWorldDirection?.(new THREE.Vector3())
                : {
                      x: -Math.sin(spawnCameraYaw),
                      y: 0,
                      z: -Math.cos(spawnCameraYaw),
                  },
            anchor
        ),
        maxCells: 12000,
        maxFragments: 20000,
        maxTriangles: getWorldRevealTriangleBudget(revealRoots, excludeSource),
        maxClipTests: 1000000,
    };
    const cachedStartCell = Math.min(
        8,
        readWorldRevealFitHint(
            Root.currentSpace.scene,
            fitSettings,
            window.location.pathname
        )
    );
    let revealCellSize = cachedStartCell;
    const buildEffect = () =>
        buildWorldCubeReveal(THREE, [Root.currentSpace.scene], {
            ...fitSettings,
            scene: Scene,
            hideRoots: [],
            anchor,
            cellSize: revealCellSize,
            onInstance:
                process.env.NODE_ENV === "development"
                    ? (object) => {
                          const key = object.name || object.uuid;
                          revealedInstances[key] =
                              (revealedInstances[key] ?? 0) + 1;
                      }
                    : undefined,
            onSkip: (object, reason) => {
                if (
                    [
                        "cell bound",
                        "triangle bound",
                        "fragment memory bound",
                        "clipping work bound",
                    ].includes(reason)
                )
                    budgetLimited = true;
                if (
                    process.env.NODE_ENV !== "development" ||
                    skippedMeshes.length >= 50
                )
                    return;
                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];
                skippedMeshes.push({
                    source: object.name || object.uuid,
                    reason,
                    triangles:
                        (object.geometry?.index?.count ??
                            object.geometry?.attributes?.position?.count ??
                            0) / 3,
                    materials: materials.map((material) => material?.type),
                });
            },
            exclude: (object) =>
                animatedRootSet.has(object) || excludeSource(object),
        });
    let effect: ReturnType<typeof createWorldCubeReveal>;
    let effectTransferred = false;
    const capturedSpaceScene = Root.currentSpace.scene;
    // ?travel=sweep: shader front on the world's own materials, no tile build.
    const sweep = readWorldRevealStyle() === "sweep";
    // Fit dense architecture with fewer, larger tiles instead of dropping whole
    // surfaces. Preparation is hidden; dispose each trial before rebuilding.
    try {
        if (sweep)
            effect = (yield* buildWorldSweepReveal({
                THREE,
                roots: revealRoots,
                anchor,
                exclude: excludeSource,
            })) as unknown as ReturnType<typeof createWorldCubeReveal>;
        for (let attempt = 0; !sweep && attempt < 3; attempt++) {
            budgetLimited = false;
            skippedMeshes.length = 0;
            for (const key of Object.keys(revealedInstances))
                delete revealedInstances[key];
            fitAttempts++;
            effect = yield* buildEffect();
            if (!budgetLimited || attempt === 2 || revealCellSize >= 8) break;
            effect.dispose();
            revealCellSize *= 2;
        }
    } catch (error) {
        sky.dispose();
        reflectors.dispose();
        throw error;
    }
    let mediaEffect: ReturnType<typeof createWorldTransitionMedia>;
    try {
        mediaEffect = sweep
            ? (createNoopWorldReveal() as unknown as typeof mediaEffect)
            : yield* buildWorldTransitionMedia(THREE, mediaRoots, {
                  ...fitSettings,
                  scene: Scene,
                  anchor,
                  cellSize: revealCellSize,
                  waveExtent: effect.stats.maxDistance,
                  exclude: excludeSource,
              });
    } catch (error) {
        effect.dispose();
        sky.dispose();
        reflectors.dispose();
        throw error;
    }
    const buildMs = performance.now() - buildStarted;
    rememberWorldRevealFitHint(
        Root.currentSpace.scene,
        fitSettings,
        { cellSize: revealCellSize, budgetLimited },
        window.location.pathname
    );
    const devAttributes = new Map<string, string | null>();
    let progressStep = -1;
    let warmed: Promise<void> | undefined;
    const debugValue = (key: string, value: number | string) => {
        if (process.env.NODE_ENV !== "development" || !CANVAS) return;
        const name = `data-world-reveal-${key}`;
        if (!devAttributes.has(name))
            devAttributes.set(name, CANVAS.getAttribute(name));
        CANVAS.setAttribute(name, String(value));
    };
    for (const key of [
        "cells",
        "viewCells",
        "rigidSources",
        "rigidTriangles",
        "instances",
        "maxDistance",
        "maxCellSize",
        "minCellSize",
        "refinedCells",
        "refinementLimited",
        "levels",
        "triangles",
        "sourceTriangles",
        "baseTriangles",
        "baseClipTests",
        "refinementClipTests",
        "clipTests",
        "skipped",
        "batches",
        "drawCalls",
        "vertices",
    ])
        if (Number.isFinite(effect.stats[key]))
            debugValue(key.toLowerCase(), effect.stats[key]);
    if (effect.stats.refinementLimit)
        debugValue("refinementlimit", effect.stats.refinementLimit);
    if (spawnCameraYaw !== undefined)
        debugValue("spawn-camera-yaw", spawnCameraYaw);
    debugValue("build-ms", Math.round(buildMs));
    debugValue("media-cells", mediaEffect.stats.cells);
    debugValue("media-skipped", mediaEffect.stats.skipped);
    debugValue("media-skips", JSON.stringify(mediaEffect.skipped));
    debugValue("fit-attempts", fitAttempts);
    debugValue("cached-start-cell", cachedStartCell);
    debugValue("sky-tiles", sky.stats.tiles);
    debugValue("sky-sources", sky.stats.sources);
    debugValue("reflector-sources", reflectors.stats.sources);
    debugValue("coverage", "all");
    debugValue("style", sweep ? "sweep" : "tiles");
    debugValue("radius", revealRadius);
    debugValue("cell-size", revealCellSize);
    debugValue("triangle-budget", fitSettings.maxTriangles);
    debugValue(
        "view-cell-sizes",
        JSON.stringify(effect.stats.viewCellSizeCounts)
    );
    debugValue("detail-focus", JSON.stringify(fitSettings.refinement.focus));
    debugValue(
        "detail-forward",
        JSON.stringify(fitSettings.refinement.forward)
    );
    debugValue("space-size", JSON.stringify(spaceSize));
    debugValue("skips", JSON.stringify(skippedMeshes));
    debugValue("instance-sources", JSON.stringify(revealedInstances));
    const setProgress = (progress: number) => {
        effect.setProgress(progress);
        mediaEffect.setProgress(progress);
        sky.setProgress(progress);
        reflectors.setProgress(progress);
        const step = Math.round(progress * 100);
        if (step !== progressStep || progress === 1) {
            progressStep = step;
            debugValue("progress", step / 100);
            debugValue("reflector-opacity", reflectors.stats.opacity);
        }
    };
    if (controls) controls.enabled = false;
    Camera.active = false;
    if (CSS_CANVAS) CSS_CANVAS.style.visibility = "hidden";
    let travelPoseHeld = true;
    const lockPose = (now = performance.now()) => {
        if (disposed || !locked) return;
        // A late destination UI preference must not replace the staged camera.
        if (view && Camera.current !== camera) {
            SET_IS_FIRST_PERSON(view.cameraMode === "first-person");
            Camera.current = camera;
            controls?.setCamera?.(camera);
            if (controls) controls.enabled = false;
        }
        const nativeYawOffset = nativeTravelAvatarYawOffset(avatar);
        applyWorldTravelView(
            THREE,
            camera,
            player,
            anchor,
            view && {
                ...view,
                avatarRotation: view.avatarRotation - nativeYawOffset,
            }
        );
        debugValue("avatar-native-offset", nativeYawOffset);
        if (view)
            debugValue(
                "camera-yaw",
                Math.atan2(
                    view.cameraOffset.x - view.cameraTargetOffset.x,
                    view.cameraOffset.z - view.cameraTargetOffset.z
                )
            );
        player.show?.();
        if (avatar) {
            avatar.visible = view?.cameraMode !== "first-person";
            avatar.opacity = 1;
            avatar.onFloor = true;
            avatar.isJumping = false;
            avatar.floorVelocity = avatar.smoothedFloorVelocity = 0;
            // Match the lobby's normalized avatar height without moving collider
            // feet or changing native head/hip physics metadata.
            if (
                view?.avatarHeight &&
                saved.avatarHeight > 0 &&
                Number.isFinite(saved.avatarHeight)
            ) {
                const ratio = view.avatarHeight / saved.avatarHeight;
                if (Number.isFinite(saved.baseScaleRatio))
                    avatar.baseScaleRatio = saved.baseScaleRatio * ratio;
                if (saved.meshScale && avatar.highQualityMeshes?.scale)
                    avatar.highQualityMeshes.scale
                        .copy(saved.meshScale)
                        .multiplyScalar(ratio);
            }
        }
        if (travelPoseHeld) holdNativeTravelIdle(avatar);
        player.updateAvatar?.();
        travelAnimation?.hold(
            {
                position: player.position,
                rotation:
                    view?.avatarRotation ?? player.rotation.y + nativeYawOffset,
                height: view?.avatarHeight || saved.avatarHeight || 1.8,
                visible: view?.cameraMode !== "first-person",
                idleTime:
                    readNativeTravelIdleTime(
                        avatar,
                        Shared.animationTimer.value
                    ) ?? 0,
            },
            typeof now === "number" ? now : performance.now()
        );
        if (travelAnimation?.active && avatar) avatar.visible = false;
        peers?.update(
            typeof now === "number" ? now : performance.now(),
            view?.avatarLift ?? 0
        );
        holdNativePeers();
        Camera.updateFrustum(camera);
    };
    // Camera's PRE_UPDATE is disabled. PRE_RENDER reapplies the locked pose after
    // any later engine listeners, before the scene is drawn (UPDATE phase).
    const maintainLock = () => lockPose();
    Emitter.on(Events.PRE_UPDATE, maintainLock);
    Emitter.on(Events.PRE_RENDER, maintainLock);
    const stopAvatarEmote = () => {
        travelPoseHeld = false;
        if (!avatar) return;
        if (typeof avatar.emoteResolve === "function") avatar.stopEmote?.();
        // An old or partially loaded avatar can have a clip without a resolver.
        avatar.emote = -1;
        avatar.currentEmote = null;
        avatar.emoteResolve = null;
    };
    const restoreAvatar = () => {
        if (avatar) {
            avatar.travelReadyIdle = saved.travelReadyIdle;
            avatar.travelReadyIdleUntilMovement =
                saved.travelReadyIdleUntilMovement;
            if (avatar.emote !== saved.emote) {
                stopAvatarEmote();
                if (saved.emote >= 0) {
                    avatar.onFloor = true;
                    player.playEmote?.(saved.emote)?.catch?.(() => {});
                }
            }
            avatar.opacity = saved.opacity;
            avatar.onFloor = saved.onFloor;
            avatar.isJumping = saved.isJumping;
            avatar.floorVelocity = saved.floorVelocity;
            avatar.smoothedFloorVelocity = saved.smoothedFloorVelocity;
            if (saved.baseScaleRatio !== undefined)
                avatar.baseScaleRatio = saved.baseScaleRatio;
            if (saved.meshScale)
                avatar.highQualityMeshes?.scale?.copy(saved.meshScale);
        }
        if (player.username?.wrapper)
            player.username.wrapper.visible = saved.usernameVisible;
    };
    const enterIdle = () => {
        stopAvatarEmote();
        player.getUp?.();
        player.isSitting = false;
        player.seatedMesh = null;
        player.deactivated = false;
        player.isMoving = false;
        player.isPlayerOnFloor = true;
        player.isJumping = false;
        if (avatar) {
            avatar.opacity = 1;
            avatar.isSitting = false;
            avatar.onFloor = true;
            avatar.isJumping = false;
            avatar.floorVelocity = avatar.smoothedFloorVelocity = 0;
            avatar.lastFloorVelocityPosition?.set(
                player.position.x,
                0,
                player.position.z
            );
            if (saved.baseScaleRatio !== undefined)
                avatar.baseScaleRatio = saved.baseScaleRatio;
            if (saved.meshScale)
                avatar.highQualityMeshes?.scale?.copy(saved.meshScale);
            holdNativeTravelIdle(avatar, true);
            avatar.travelReadyIdleUntilMovement = true;
        }
        if (player.username?.wrapper)
            player.username.wrapper.visible = saved.usernameVisible;
        if (playerState) {
            playerState.veclocity?.set(0, 0, 0);
            playerState.direction?.set(0, 0, 0);
            playerState.originalDirection?.set(0, 0, 0);
            playerState.keyStates = {};
            playerState.joystickStates = {};
            playerState.joystickState?.pan?.set(0, 0, 0);
            playerState.playerOnFloor = true;
            playerState.isJumping = false;
            playerState.jumpCount = 0;
            playerState.jumpHeld = false;
            playerState.currentSpeed = 0;
            playerState.tempRotation = player.rotation.y;
            playerState.rotation?.copy(player.rotation);
            playerState.quaternion?.setFromEuler(player.rotation);
            playerState.rotateQuarternion?.setFromEuler(player.rotation);
        }
        // Seed the native collision body from the same grounded feet before
        // controls resume, so its first physics step cannot undo the staged pose.
        const synchronized = synchronizeNativeTravelGrounding(
            controls?.world,
            player.position
        );
        handoffFeet = player.position.clone();
        debugValue("grounding-synchronized", synchronized ? 1 : 0);
    };
    const detachLock = (success = false) => {
        // Ordinary native players take over at handoff. Lobby IDs do not identify
        // destination room sessions, so never guess a match from names or avatars.
        releaseTravelPeers();
        travelAnimation?.dispose();
        locked = false;
        Emitter.off(Events.PRE_UPDATE, maintainLock);
        Emitter.off(Events.PRE_RENDER, maintainLock);
        Camera.active = success ? true : saved.cameraActive;
        // a staged recording party starts arriving now
        holdRecordingArrivals(false);
        if (controls && Camera.currentControls === controls)
            controls.enabled = success ? true : saved.enabled;
        if (CSS_CANVAS) CSS_CANVAS.style.visibility = saved.cssVisibility ?? "";
    };
    const cancelRestore = () => {
        if (complete) return;
        restoreAvatar();
        player.position.copy(saved.position);
        player.rotation.copy(saved.rotation);
        player.visible = saved.playerVisible;
        player.isSitting = saved.isSitting;
        player.seatedMesh = saved.seatedMesh;
        player.deactivated = saved.deactivated;
        player.isMoving = saved.isMoving;
        player.isPlayerOnFloor = saved.playerOnFloor;
        player.isJumping = saved.playerIsJumping;
        if (avatar) avatar.isSitting = saved.avatarIsSitting;
        if (avatar) avatar.visible = saved.avatarVisible;
        player.updateAvatar?.();
        if (Camera.current === camera) {
            SET_IS_FIRST_PERSON(saved.firstPerson);
            Camera.current = originalCamera;
            controls?.setCamera?.(originalCamera);
            originalCamera.position.copy(saved.cameraPosition);
            originalCamera.quaternion.copy(saved.cameraQuaternion);
            originalCamera.fov = saved.fov;
            originalCamera.travelFraming = saved.cameraTravelFraming;
            if (camera !== originalCamera) camera.travelFraming = undefined;
            for (const [key, value] of cameraSeeds)
                if (originalCamera[key]?.copy) originalCamera[key].copy(value);
                else originalCamera[key] = value;
            originalCamera.updateProjectionMatrix();
            originalCamera.updateMatrixWorld(true);
            Camera.addAudioListener?.();
            Camera.updateFrustum(originalCamera);
        }
        detachLock();
        for (const [key, value] of movementSeeds)
            if (playerState[key]?.copy) playerState[key].copy(value);
            else
                playerState[key] =
                    typeof value === "object" ? { ...value } : value;
        if (savedJoystickPan)
            playerState.joystickState.pan.copy(savedJoystickPan);
    };
    /** Stand up and settle the camera. When started during the reveal's tail,
     * `canFinish` holds the final pose (and input) until the reveal is done. */
    const startHandoff = (canFinish: () => boolean = () => true): Promise<void> => {
        if (handoffPending) return handoffPending;
        if (!locked) return Promise.resolve();
        if (!view) {
            enterIdle();
            player.visible = !IS_FIRST_PERSON;
            if (avatar) avatar.visible = !IS_FIRST_PERSON;
            player.updateAvatar?.();
            detachLock(true);
            return Promise.resolve();
        }
        handoffPending = new Promise<void>((resolve, reject) => {
            rejectHandoff = reject;
            const from = {
                ...view,
                cameraOffset: { ...view.cameraOffset },
                cameraTargetOffset: { ...view.cameraTargetOffset },
            };
            const orbit = new THREE.Vector3(
                from.cameraOffset.x - from.cameraTargetOffset.x,
                from.cameraOffset.y - from.cameraTargetOffset.y,
                from.cameraOffset.z - from.cameraTargetOffset.z
            );
            const initialRadius = orbit.length();
            if (initialRadius > 1e-6) orbit.multiplyScalar(1 / initialRadius);
            else orbit.set(0, 0, 1);
            const initialYaw = Math.atan2(orbit.x, orbit.z);
            const initialPitch = Math.atan2(
                orbit.y,
                Math.hypot(orbit.x, orbit.z)
            );
            const nativeHeight = Math.max(
                0.2,
                camera.getCameraHeight?.() ||
                    saved.avatarHeight ||
                    from.cameraTargetOffset.y
            );
            const nativeRadius = Math.min(
                MAX_ZOOM_OUT,
                Math.max(initialRadius, nativeHeight * 1.7)
            );
            const finalPitch = compactProfile ? initialPitch : 0.12;
            const finalAvatarYaw = spawnCameraYaw ?? from.avatarRotation;
            const avatarYawDelta = Math.atan2(
                Math.sin(finalAvatarYaw - from.avatarRotation),
                Math.cos(finalAvatarYaw - from.avatarRotation)
            );
            let finalYaw = compactProfile ? initialYaw : finalAvatarYaw;
            // Keep the finished camera in the rear/shoulder sector. A close door
            // can shorten this view, but must never send it back in front again.
            if (from.cameraMode !== "first-person" && !compactProfile) {
                let bestDistance = -1;
                for (const shoulder of [
                    0,
                    Math.PI / 9,
                    -Math.PI / 9,
                    (Math.PI * 7) / 36,
                    (-Math.PI * 7) / 36,
                ]) {
                    const yaw = finalAvatarYaw + shoulder;
                    const candidate = resolveView(
                        {
                            ...from,
                            avatarLift: 0,
                            cameraTargetOffset: { x: 0, y: nativeHeight, z: 0 },
                            cameraOffset: {
                                x:
                                    Math.sin(yaw) *
                                    Math.cos(finalPitch) *
                                    nativeRadius,
                                y:
                                    nativeHeight +
                                    Math.sin(finalPitch) * nativeRadius,
                                z:
                                    Math.cos(yaw) *
                                    Math.cos(finalPitch) *
                                    nativeRadius,
                            },
                        },
                        false
                    );
                    const distance = Math.hypot(
                        candidate.cameraOffset.x,
                        candidate.cameraOffset.y - nativeHeight,
                        candidate.cameraOffset.z
                    );
                    if (distance > bestDistance) {
                        bestDistance = distance;
                        finalYaw = yaw;
                    }
                    if (
                        distance >=
                        Math.min(
                            nativeRadius,
                            Math.max(1.1, nativeHeight * 0.8)
                        )
                    )
                        break;
                }
            }
            const yawDelta = Math.atan2(
                Math.sin(finalYaw - initialYaw),
                Math.cos(finalYaw - initialYaw)
            );
            const start = performance.now();
            const reduce = !!(reducedForEntry || reducedMotion?.matches);
            const standUpMs = travelAnimation?.standUp(start, reduce) || 0;
            peers?.standUp(start);
            const handoffMs = Math.max(WORLD_TRAVEL_HANDOFF_MS, standUpMs);
            const tick = (now: number) => {
                if (disposed) return;
                const t =
                    reducedForEntry || reducedMotion?.matches
                        ? 1
                        : Math.min(1, Math.max(0, (now - start) / handoffMs));
                const ease = easeWorldTravelHandoff(t),
                    mix = (a: number, b: number) => a + (b - a) * ease;
                const firstPerson = from.cameraMode === "first-person";
                const height = Math.max(
                    0.2,
                    camera.getCameraHeight?.() ||
                        saved.avatarHeight ||
                        from.cameraTargetOffset.y
                );
                const target = compactProfile
                    ? { ...from.cameraTargetOffset }
                    : {
                          x: mix(from.cameraTargetOffset.x, 0),
                          y: mix(from.cameraTargetOffset.y, height),
                          z: mix(from.cameraTargetOffset.z, 0),
                      };
                const yaw = initialYaw + yawDelta * ease;
                const pitch = mix(initialPitch, finalPitch);
                const radius = firstPerson
                    ? mix(initialRadius, 0)
                    : compactProfile
                    ? initialRadius
                    : mix(
                          initialRadius,
                          Math.min(
                              MAX_ZOOM_OUT,
                              Math.max(initialRadius, height * 1.7)
                          )
                      );
                const cameraOffset = firstPerson
                    ? {
                          x: mix(from.cameraOffset.x, 0),
                          y: mix(from.cameraOffset.y, height),
                          z: mix(from.cameraOffset.z, 0),
                      }
                    : {
                          x:
                              target.x +
                              Math.sin(yaw) * Math.cos(pitch) * radius,
                          y: target.y + Math.sin(pitch) * radius,
                          z:
                              target.z +
                              Math.cos(yaw) * Math.cos(pitch) * radius,
                      };
                const focus = firstPerson
                    ? {
                          x: cameraOffset.x - orbit.x,
                          y: cameraOffset.y - orbit.y,
                          z: cameraOffset.z - orbit.z,
                      }
                    : target;
                view = resolveView(
                    {
                        ...from,
                        avatarRotation:
                            from.avatarRotation + avatarYawDelta * ease,
                        avatarLift: mix(from.avatarLift, 0),
                        avatarHeight: mix(
                            from.avatarHeight || saved.avatarHeight || 1.8,
                            saved.avatarHeight || from.avatarHeight || 1.8
                        ),
                        cameraTargetOffset: focus,
                        cameraOffset,
                        fov: compactProfile
                            ? from.fov
                            : mix(from.fov, saved.fov),
                    },
                    false
                );
                lockPose(now);
                if (t < 1 || !canFinish())
                    handoffFrame = requestAnimationFrame(tick);
                else {
                    // Commit the selected mode and its target binding before
                    // seeding physics: late UI preferences can leave the mode
                    // flag stale even while the staged camera is still active.
                    SET_IS_FIRST_PERSON(firstPerson);
                    controls?.setCamera?.(camera);
                    enterIdle();
                    player.visible = !firstPerson;
                    if (avatar) avatar.visible = !firstPerson;
                    player.updateAvatar?.();
                    // The native camera and its physics target are already in the
                    // selected mode. Keep this collision-safe pose as controls resume.
                    camera.travelFraming = compactProfile
                        ? { ...compactProfile }
                        : undefined;
                    controls?.world?.thirdPersonPos?.copy(player.position);
                    controls?.world?.playerState?.veclocity?.set(0, 0, 0);
                    if (controls?.world?.playerState) {
                        controls.world.playerState.tempRotation =
                            player.rotation.y;
                    }
                    detachLock(true);
                    debugValue(
                        "camera-mode",
                        IS_FIRST_PERSON ? "first-person" : "third-person"
                    );
                    debugValue(
                        "camera-distance",
                        new THREE.Vector3(
                            view.cameraOffset.x - view.cameraTargetOffset.x,
                            view.cameraOffset.y - view.cameraTargetOffset.y,
                            view.cameraOffset.z - view.cameraTargetOffset.z
                        ).length()
                    );
                    rejectHandoff = undefined;
                    resolve();
                }
            };
            handoffFrame = requestAnimationFrame(tick);
        });
        return handoffPending;
    };
    return {
        stats: effect.stats,
        async prepare(options: LobbyDestinationEntryOptions) {
            releaseArtwork ||= holdArtworkPresentation();
            try {
                reducedForEntry = options.reducedMotion;
                if (disposed) throw new Error("Arrival cancelled.");
                const modeChange =
                    options.travelView?.cameraMode === "first-person"
                        ? Camera.setFirstPerson?.(false, true)
                        : Camera.setThirdPerson?.(false, true);
                // The native methods switch synchronously before their promise yields.
                // Own that camera immediately so cancellation can restore it in the gap.
                camera = Camera.current;
                await modeChange;
                if (disposed) throw new Error("Arrival cancelled.");
                camera = Camera.current;
                if (controls) controls.enabled = false;
                Camera.active = false;
                await prepareTravelAnimation(
                    !!(
                        options.reducedMotion ||
                        reducedMotion?.matches ||
                        options.travelView?.avatarTravelPose === "idle"
                    )
                );
                if (disposed) throw new Error("Arrival cancelled.");
                const orientedView = orientView(options.travelView);
                const offset = orientedView?.spawnOffset;
                anchor.copy(spawn);
                if (offset)
                    anchor.add(new THREE.Vector3(offset.x, offset.y, offset.z));
                // Loading may finish between native gravity steps. Resolve a nearby
                // support surface while still black, before staging the avatar/camera.
                const groundedFeet = resolveNativeTravelGroundedFeet(
                    controls?.world,
                    anchor
                );
                debugValue(
                    "grounding-adjustment",
                    groundedFeet ? groundedFeet.y - anchor.y : 0
                );
                if (groundedFeet) anchor.copy(groundedFeet);
                // A nearby door may shorten this framing, but must not turn the
                // camera around toward the back wall just to gain orbit distance.
                compactProfile = undefined;
                if (
                    orientedView &&
                    spawnCameraYaw !== undefined &&
                    orientedView.cameraMode !== "first-person"
                ) {
                    const framing = resolver.cinematic(
                        anchor,
                        orientedView,
                        { near: camera.near, aspect: camera.aspect },
                        {
                            avatarHeight: saved.avatarHeight,
                            targetHeight:
                                camera.getCameraHeight?.() ||
                                saved.avatarHeight ||
                                1.8,
                            fov: saved.fov,
                            radius: Math.min(
                                MAX_ZOOM_OUT,
                                Math.max(4.6, (saved.avatarHeight || 1.8) * 1.7)
                            ),
                            heading: spawnCameraYaw,
                        }
                    );
                    view = framing.view;
                    compactProfile = framing.profile;
                } else
                    view = resolveView(
                        orientedView,
                        spawnCameraYaw === undefined
                    );
                camera.travelFraming = compactProfile
                    ? { ...compactProfile }
                    : undefined;
                debugValue("compact-camera", compactProfile ? 1 : 0);
                debugValue("camera-fov", view?.fov ?? camera.fov);
                // Friends are cosmetic during staging. Their module and avatar loads
                // must not hold the local player's rendered world or controls hostage.
                // A staged recording party lands you alone: its friends then
                // arrive one by one around the spawn (multiplayer/recordingParty.js).
                if (!readRecordingParty())
                    prepareTravelPeers(orientedView, options.reducedMotion);
                if (view && options.travelView)
                    debugValue(
                        "camera-adjusted",
                        new THREE.Vector3(
                            view.cameraOffset.x -
                                options.travelView.cameraOffset.x,
                            view.cameraOffset.y -
                                options.travelView.cameraOffset.y,
                            view.cameraOffset.z -
                                options.travelView.cameraOffset.z
                        ).length() > 0.01
                            ? 1
                            : 0
                    );
                debugValue("camera-mode", view?.cameraMode || "third-person");
                if (view)
                    debugValue(
                        "camera-distance",
                        new THREE.Vector3(
                            view.cameraOffset.x - view.cameraTargetOffset.x,
                            view.cameraOffset.y - view.cameraTargetOffset.y,
                            view.cameraOffset.z - view.cameraTargetOffset.z
                        ).length()
                    );
                setProgress(0);
                lockPose();
                // The staged player feet are the origin, including party spawn offsets.
                effect.setRevealAnchor(anchor);
                mediaEffect.setRevealAnchor(anchor, effect.stats.maxDistance);
                warmed ||= warmWorldTransition(
                    Renderer,
                    Scene,
                    camera,
                    setProgress,
                    renderWaitAbort.signal
                );
                await warmed;
                if (disposed) throw new Error("Arrival cancelled.");
                await world.nextUpdate(renderWaitAbort.signal);
                if (disposed) throw new Error("Arrival cancelled.");
            } catch (error) {
                releaseArtwork?.();
                releaseArtwork = undefined;
                throw error;
            }
        },
        reveal(options: LobbyDestinationEntryOptions) {
            reducedForEntry ||= options.reducedMotion;
            if (disposed)
                return Promise.reject(new Error("Arrival cancelled."));
            if (pending) return pending;
            // prepare() already resolved the final framing against collisions.
            // Reusing the raw parent offset here would put the camera back in a door.
            if (!view)
                view = resolveView(
                    orientView(options.travelView),
                    spawnCameraYaw === undefined
                );
            lockPose();
            pending = new Promise<void>((resolve, reject) => {
                rejectPending = reject;
                const clock = createWorldRevealClock(
                    sweep ? WORLD_SWEEP_REVEAL_MS : WORLD_TILE_REVEAL_MS
                );
                const timings =
                    process.env.NODE_ENV === "development"
                        ? new TransitionFrameTimings()
                        : null;
                const timingStart = performance.now();
                // Stand up during the reveal's tail, once the floor around the
                // travellers has assembled; input stays held until both end.
                // The short ?travel=sweep reveal keeps the stand-up after it.
                const standAt = sweep
                    ? 1
                    : worldStandUpProgress(
                          effect.completeWithin?.(
                              WORLD_STAND_UP_FLOOR_RADIUS_M
                          ) ?? 1,
                          Math.max(
                              WORLD_TRAVEL_HANDOFF_MS,
                              travelAnimation ? NATIVE_TRAVEL_STAND_UP_MS : 0
                          )
                      );
                let revealSettled = false;
                const tick = async (now: number) => {
                    if (disposed) return;
                    const cpuStart = performance.now();
                    const progress = !!(
                        options.reducedMotion || reducedMotion?.matches
                    )
                        ? 1
                        : clock.sample(now, !document.hidden);
                    setProgress(progress);
                    lockPose();
                    if (
                        progress < 1 &&
                        progress >= standAt &&
                        view &&
                        !handoffPending
                    ) {
                        debugValue("stand-up-progress", standAt);
                        // Awaited (and its failure handled) once the reveal ends.
                        void startHandoff(() => revealSettled).catch(() => {});
                    }
                    timings?.record(
                        {
                            phase: "reveal",
                            startedAt: timingStart,
                            reducedMotion: options.reducedMotion,
                        },
                        now,
                        performance.now() - cpuStart
                    );
                    if (progress >= 1 && timings) {
                        timings.finish();
                        debugValue(
                            "frame-stats",
                            JSON.stringify(timings.stats())
                        );
                    }
                    if (progress < 1) {
                        // Advance every display frame. Waiting for POST_UPDATE
                        // here can insert a second vsync depending on callback order.
                        frame = requestAnimationFrame(tick);
                    } else {
                        try {
                            await world.nextUpdate(renderWaitAbort.signal);
                            if (disposed) return;
                            // Retain the already-uploaded tile buffers while the
                            // native camera hands control back to the player.
                            mediaEffect.dispose();
                            effect.park?.();
                            sky.dispose();
                            reflectors.dispose();
                            if (CSS_CANVAS)
                                CSS_CANVAS.style.visibility =
                                    saved.cssVisibility ?? "";
                            // The bridge keeps input held until the ordinary native
                            // camera has settled and its final safe frame is rendered.
                            revealSettled = true;
                            await startHandoff();
                            await world.nextUpdate(renderWaitAbort.signal);
                            if (disposed) return;
                            if (handoffFeet)
                                debugValue(
                                    "handoff-first-frame-shift",
                                    player.position.distanceTo(handoffFeet)
                                );
                            complete = true;
                            if (
                                !sweep &&
                                Root.currentSpace?.scene === capturedSpaceScene
                            )
                                effectTransferred = rememberWorldTransition(
                                    capturedSpaceScene,
                                    effect,
                                    {
                                        cellSize: revealCellSize,
                                        triangleBudget:
                                            fitSettings.maxTriangles,
                                        refinement: fitSettings.refinement,
                                    }
                                );
                            if (!effectTransferred) effect.dispose();
                            debugValue("cached", effectTransferred ? 1 : 0);
                            rememberNativeCameraPreference(
                                view?.cameraMode === "first-person"
                                    ? "first_person"
                                    : "third_person"
                            );
                            rejectPending = undefined;
                            releaseArtwork?.();
                            releaseArtwork = undefined;
                            resolve();
                        } catch (error) {
                            releaseArtwork?.();
                            releaseArtwork = undefined;
                            reject(error);
                        }
                    }
                };
                frame = requestAnimationFrame(tick);
            });
            return pending;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            renderWaitAbort.abort();
            releaseArtwork?.();
            releaseArtwork = undefined;
            releaseTravelPeers();
            travelAnimation?.dispose();
            cancelAnimationFrame(frame);
            cancelAnimationFrame(handoffFrame);
            rejectHandoff?.(new Error("Arrival cancelled."));
            rejectHandoff = undefined;
            rejectPending?.(new Error("Arrival cancelled."));
            rejectPending = undefined;
            cancelRestore();
            mediaEffect.dispose();
            if (!effectTransferred) effect.dispose();
            sky.dispose();
            reflectors.dispose();
            for (const [name, value] of devAttributes)
                if (value === null) CANVAS.removeAttribute(name);
                else CANVAS.setAttribute(name, value);
        },
    };
}
