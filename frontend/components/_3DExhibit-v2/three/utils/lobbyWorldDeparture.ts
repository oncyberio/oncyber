import { captureWorldTravelFrame } from "@utils/nativeWorldTravel";
import PostProcessing from "../renderer/postprocessing";
import { holdArtworkPresentation } from "@utils/artworkPresentation";
import Renderer from "@3renderer";
import { warmWorldTransition } from "@features/lobby/warmWorldTransition";
import { finishInSlices } from "@features/lobby/slicedWork";
import { tripMark } from "@utils/tripTimingMarks";
import { createWorldRevealClock } from "@features/lobby/worldRevealClock";
import {
    createNoopWorldReveal,
    createWorldSweepReveal,
    readWorldDepartureStyle,
} from "@features/lobby/worldSweepReveal";
import * as THREE from "three";
import Camera from "@3camera";
import Scene from "@3scene";
import Shared from "../globals/shared";
import {
    holdNativeTravelIdle,
    readNativeTravelIdleTime,
} from "./nativeTravelIdle";
import Emitter from "@3emitter";
import Events from "@3events";
import Players from "../factory/player";
import Root from "../root";
import { nativeTravelAvatarYawOffset } from "./nativeTravelAvatarYaw";
import {
    CANVAS,
    CSS_CANVAS,
    IS_FIRST_PERSON,
    CURRENT_SPACE,
} from "../constants";
import {
    buildWorldCubeReveal,
    createWorldCubeReveal,
} from "@features/lobby/worldCubeReveal";
import {
    takeWorldTransition,
    rememberWorldTransition,
    type WorldTransitionCacheDetails,
} from "@features/lobby/worldTransitionCache";
import {
    buildWorldTransitionMedia,
    createWorldTransitionMedia,
} from "@features/lobby/worldTransitionMedia";
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
    WORLD_DISSOLVE_MS,
    WORLD_BLACK_HOLD_MS,
} from "@features/lobby/worldTravelTiming";
import {
    readLobbyTravelView,
    type LobbyDestinationEntryOptions,
    type LobbyTravelView,
} from "@features/lobby/lobbyJourneyProtocol";

/** Holds a live native scene in the black departure frame until the host removes
 * it. Construction is inert; depart() snapshots the current pose, not spawn. */
export function createNativeLobbyDeparture(
    world: {
        nextUpdate(): Promise<unknown>;
    },
    pause?: () => Promise<void>
) {
    let disposed = false;
    let releaseArtwork: (() => void) | undefined;
    const abort = new AbortController();
    const pauseBuild = async () => {
        await pause?.();
        if (disposed) throw new Error("Departure cancelled.");
    };
    let pending: Promise<LobbyTravelView | void> | undefined;
    let rejectPending: ((error: Error) => void) | undefined;
    let frame = 0;
    let restore: ((replaced: boolean) => void) | undefined;
    let capturedScene: any;
    let effect: ReturnType<typeof createWorldCubeReveal> | undefined;
    let sky: ReturnType<typeof createWorldSkyReveal> | undefined;
    let reflectors: ReturnType<typeof createWorldReflectorReveal> | undefined;
    let mediaEffect: ReturnType<typeof createWorldTransitionMedia> | undefined;
    let effectDetails: WorldTransitionCacheDetails | undefined;
    const devAttributes = new Map<string, string | null>();
    const debug = (key: string, value: string | number) => {
        if (process.env.NODE_ENV !== "development" || !CANVAS) return;
        const name = `data-world-departure-${key}`;
        if (!devAttributes.has(name))
            devAttributes.set(name, CANVAS.getAttribute(name));
        CANVAS.setAttribute(name, String(value));
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        tripMark("depart:disposed");
        abort.abort();
        releaseArtwork?.();
        releaseArtwork = undefined;
        cancelAnimationFrame(frame);
        rejectPending?.(new Error("Departure cancelled."));
        rejectPending = undefined;
        const replaced =
            capturedScene && Root.currentSpace?.scene !== capturedScene;
        const currentBackground = Scene.background;
        const currentFog = Scene.fog;
        // Geometry captured the sky's intact background. Restore it first.
        mediaEffect?.dispose();
        const retained =
            effect &&
            !replaced &&
            effectDetails &&
            rememberWorldTransition(capturedScene, effect, effectDetails);
        if (!retained) effect?.dispose();
        sky?.dispose();
        reflectors?.dispose();
        if (replaced) {
            Scene.background = currentBackground;
            Scene.fog = currentFog;
        }
        restore?.(replaced);
        restore = undefined;
        for (const [name, value] of devAttributes)
            if (value === null) CANVAS.removeAttribute(name);
            else CANVAS.setAttribute(name, value);
    };
    return {
        depart(
            options: LobbyDestinationEntryOptions
        ): Promise<LobbyTravelView | void> {
            if (disposed)
                return Promise.reject(new Error("Departure cancelled."));
            if (pending) return pending;
            releaseArtwork = holdArtworkPresentation();
            pending = new Promise<LobbyTravelView | void>((resolve, reject) => {
                rejectPending = reject;
                void (async () => {
                    try {
                        const player: any = Players.main;
                        const camera: any = Camera.current;
                        if (!player || !camera || !Root.currentSpace?.scene)
                            throw new Error(
                                "The world's scene is not ready for departure."
                            );
                        // Recording: the staged friends line up beside you
                        // first, in the places the lobby shows them on return.
                        const lineYaw =
                            player.rotation.y +
                            nativeTravelAvatarYawOffset(player.avatar3D);
                        const lineUp = (window as any)
                            .__oncyberRecordingLineUp as
                            | ((yaw: number, snap?: boolean) => boolean)
                            | undefined;
                        if (lineUp?.(lineYaw)) {
                            await new Promise((done) => setTimeout(done, 900));
                            if (disposed)
                                throw new Error("Departure cancelled.");
                            lineUp(lineYaw, true);
                        }
                        capturedScene = Root.currentSpace.scene;
                        tripMark("depart:start");
                        const controls: any = Camera.currentControls;
                        const state = controls?.world?.playerState;
                        const avatar = player.avatar3D;
                        const anchor = player.position.clone();
                        // The return renderer needs the view actually on screen,
                        // including camera collision shortening and free-look. Keep
                        // it relative to feet so no world coordinates cross the seam.
                        const cameraOffset = camera.position
                            .clone()
                            .sub(anchor);
                        const cameraTargetOffset = camera
                            .getWorldDirection(new THREE.Vector3())
                            .multiplyScalar(Math.max(1, cameraOffset.length()))
                            .add(cameraOffset);
                        const avatarHeight = avatar?.headPosition?.y;
                        const returnView = readLobbyTravelView({
                            cameraOffset,
                            cameraTargetOffset,
                            avatarRotation:
                                player.rotation.y +
                                nativeTravelAvatarYawOffset(avatar),
                            avatarLift: 0,
                            avatarTravelPose: "idle",
                            ...(Number.isFinite(avatarHeight) &&
                            avatarHeight >= 0.2 &&
                            avatarHeight <= 10
                                ? { avatarHeight }
                                : {}),
                            cameraMode: IS_FIRST_PERSON
                                ? "first-person"
                                : "third-person",
                            fov: camera.fov,
                        });
                        const saved = {
                            position: anchor.clone(),
                            rotation: player.rotation.clone(),
                            visible: player.visible,
                            deactivated: player.deactivated,
                            isMoving: player.isMoving,
                            cameraActive: Camera.active,
                            controlsEnabled: controls?.enabled,
                            cameraPosition: camera.position.clone(),
                            cameraQuaternion: camera.quaternion.clone(),
                            fov: camera.fov,
                            cssVisibility: CSS_CANVAS?.style.visibility,
                            avatarVisible: avatar?.visible,
                            opacity: avatar?.opacity,
                            emote: avatar?.emote,
                            travelReadyIdle: avatar?.travelReadyIdle,
                            onFloor: avatar?.onFloor,
                            isJumping: avatar?.isJumping,
                            floorVelocity: avatar?.floorVelocity,
                            smoothedFloorVelocity:
                                avatar?.smoothedFloorVelocity,
                        };
                        const movement = new Map<string, any>();
                        for (const key of [
                            "veclocity",
                            "direction",
                            "originalDirection",
                            "rotation",
                            "quaternion",
                            "rotateQuarternion",
                            "tempRotation",
                            "currentSpeed",
                            "keyStates",
                            "joystickStates",
                        ])
                            if (state?.[key] !== undefined)
                                movement.set(
                                    key,
                                    state[key]?.clone?.() ??
                                        (typeof state[key] === "object"
                                            ? { ...state[key] }
                                            : state[key])
                                );
                        const joystickPan = state?.joystickState?.pan?.clone();
                        const lock = () => {
                            if (disposed) return;
                            if (Root.currentSpace?.scene !== capturedScene) {
                                dispose();
                                return;
                            }
                            Camera.active = false;
                            Camera.current = camera;
                            if (controls) controls.enabled = false;
                            player.deactivated = true;
                            player.isMoving = false;
                            player.position.copy(saved.position);
                            player.rotation.copy(saved.rotation);
                            player.visible = saved.visible;
                            state?.veclocity?.set(0, 0, 0);
                            if (avatar) {
                                avatar.visible = saved.avatarVisible;
                                avatar.opacity = saved.opacity;
                                avatar.onFloor = true;
                                avatar.isJumping = false;
                                avatar.floorVelocity =
                                    avatar.smoothedFloorVelocity = 0;
                            }
                            holdNativeTravelIdle(avatar);
                            debug(
                                "idle",
                                avatar?.currentAction?.name ?? "pending"
                            );
                            player.updateAvatar?.();
                            camera.position.copy(saved.cameraPosition);
                            camera.quaternion.copy(saved.cameraQuaternion);
                            camera.fov = saved.fov;
                            camera.updateProjectionMatrix();
                            camera.updateMatrixWorld(true);
                            Camera.updateFrustum(camera);
                        };
                        restore = (replaced) => {
                            Emitter.off(Events.PRE_UPDATE, lock);
                            Emitter.off(Events.PRE_RENDER, lock);
                            if (avatar)
                                avatar.travelReadyIdle = saved.travelReadyIdle;
                            if (replaced) {
                                // A retained renderer may already own a new space. Do
                                // not write the previous room's pose or sky into it.
                                if (Camera.current === camera)
                                    Camera.active = saved.cameraActive;
                                if (
                                    Camera.currentControls === controls &&
                                    controls
                                )
                                    controls.enabled = saved.controlsEnabled;
                                if (Players.main === player) {
                                    player.deactivated = saved.deactivated;
                                    player.isMoving = false;
                                }
                                if (CSS_CANVAS)
                                    CSS_CANVAS.style.visibility =
                                        saved.cssVisibility ?? "";
                                return;
                            }
                            player.position.copy(saved.position);
                            player.rotation.copy(saved.rotation);
                            player.visible = saved.visible;
                            player.deactivated = saved.deactivated;
                            player.isMoving = saved.isMoving;
                            if (avatar) {
                                if (avatar.emote !== saved.emote) {
                                    if (
                                        typeof avatar.emoteResolve ===
                                        "function"
                                    )
                                        avatar.stopEmote?.();
                                    avatar.emote = -1;
                                    avatar.currentEmote = null;
                                    avatar.emoteResolve = null;
                                    if (saved.emote >= 0)
                                        player
                                            .playEmote?.(saved.emote)
                                            ?.catch?.(() => {});
                                }
                                avatar.visible = saved.avatarVisible;
                                avatar.opacity = saved.opacity;
                                avatar.onFloor = saved.onFloor;
                                avatar.isJumping = saved.isJumping;
                                avatar.floorVelocity = saved.floorVelocity;
                                avatar.smoothedFloorVelocity =
                                    saved.smoothedFloorVelocity;
                            }
                            player.updateAvatar?.();
                            camera.position.copy(saved.cameraPosition);
                            camera.quaternion.copy(saved.cameraQuaternion);
                            camera.fov = saved.fov;
                            camera.updateProjectionMatrix();
                            camera.updateMatrixWorld(true);
                            Camera.current = camera;
                            Camera.active = saved.cameraActive;
                            controls?.setCamera?.(camera);
                            if (controls && Camera.currentControls === controls)
                                controls.enabled = saved.controlsEnabled;
                            for (const [key, value] of movement)
                                if (state[key]?.copy) state[key].copy(value);
                                else
                                    state[key] =
                                        typeof value === "object"
                                            ? { ...value }
                                            : value;
                            if (joystickPan)
                                state.joystickState.pan.copy(joystickPan);
                            if (CSS_CANVAS)
                                CSS_CANVAS.style.visibility =
                                    saved.cssVisibility ?? "";
                            Camera.updateFrustum(camera);
                        };
                        Emitter.on(Events.PRE_UPDATE, lock);
                        Emitter.on(Events.PRE_RENDER, lock);
                        lock();
                        if (CSS_CANVAS) CSS_CANVAS.style.visibility = "hidden";
                        // Back keeps the camera framing and blends straight into the
                        // same ready idle that continues after the lobby handoff.
                        const buildStarted = performance.now();
                        const sources: any[] = [];
                        Root.currentSpace.scene.traverse?.((object: any) => {
                            // Include authored sky shells embedded in legacy GLBs.
                            // The adapter conservatively identifies backgrounds;
                            // regular room geometry stays in the cube departure.
                            if (object.isMesh) sources.push(object);
                        });
                        sky = createWorldSkyReveal(THREE, {
                            scene: Scene,
                            sources,
                            getCamera: () => camera,
                            mode: "dissolve",
                        });
                        reflectors = createWorldReflectorReveal({
                            sources,
                            mode: "dissolve",
                        });
                        const skySources = new Set(sky.supportedSources);
                        const reflectorSources = new Set(
                            reflectors.supportedSources
                        );
                        const playerRoots = new Set([
                            player,
                            ...(Players.instances || []),
                        ]);
                        const animatedRoots = getWorldTransitionAnimatedRoots(
                            THREE,
                            capturedScene
                        );
                        const animatedRootSet = new Set(animatedRoots);
                        const mediaRoots = [
                            ...animatedRoots,
                            Root.currentArtworks,
                            Root.currentStreams,
                            Root.currentPortals,
                            Root.linkPortal,
                        ].filter(Boolean);
                        const revealRoots = [
                            Root.currentSpace.scene,
                            ...mediaRoots,
                        ].filter(Boolean);
                        const excludeSource = (object: any) =>
                            playerRoots.has(object) ||
                            object.name === "avatarContainer" ||
                            skySources.has(object) ||
                            reflectorSources.has(object);
                        const fitSettings = {
                            cellSize: 2,
                            rigidProps: WORLD_REVEAL_RIGID_PROPS,
                            radius: 18,
                            coverage: "all" as const,
                            refinement: getWorldRevealDetail(
                                camera.position,
                                camera.getWorldDirection(new THREE.Vector3()),
                                anchor
                            ),
                            maxCells: 12000,
                            maxFragments: 20000,
                            maxTriangles: getWorldRevealTriangleBudget(
                                revealRoots,
                                excludeSource
                            ),
                            maxClipTests: 1000000,
                        };
                        const cachedStartCell = Math.min(
                            8,
                            readWorldRevealFitHint(
                                capturedScene,
                                fitSettings,
                                window.location.pathname
                            )
                        );
                        let cellSize = cachedStartCell;
                        let fitAttempts = 0,
                            budgetLimited = false;
                        let cacheHit = false;
                        let additions: any[] = [];
                        const sweep = readWorldDepartureStyle() === "sweep";
                        if (sweep) {
                            effect = createWorldSweepReveal({
                                THREE,
                                roots: revealRoots,
                                anchor,
                                mode: "dissolve",
                                exclude: excludeSource,
                            }) as unknown as typeof effect;
                            // Nothing to fit or cache: the sweep stands in for both.
                            cacheHit = true;
                            effectDetails = undefined;
                        }
                        const cached = takeWorldTransition(
                            capturedScene,
                            (reason) => debug("cache-miss", reason)
                        );
                        if (cached && sweep) cached.effect.dispose();
                        else if (cached) {
                            try {
                                additions = cached.effect.getAddedSources();
                                cacheHit = cached.effect.restart({
                                    anchor,
                                    mode: "dissolve",
                                    direction: "inward",
                                });
                                if (cacheHit) {
                                    effect = cached.effect;
                                    cellSize = cached.details.cellSize;
                                    effectDetails = cached.details;
                                }
                            } catch {
                                cacheHit = false;
                            }
                            if (!cacheHit) {
                                cached.effect.dispose();
                                additions = [];
                            }
                        }
                        for (
                            let attempt = 0;
                            !cacheHit && attempt < 3;
                            attempt++
                        ) {
                            budgetLimited = false;
                            fitAttempts++;
                            const cubeOptions = {
                                ...fitSettings,
                                scene: Scene,
                                hideRoots: [],
                                anchor,
                                mode: "dissolve",
                                direction: "inward",
                                cellSize,
                                exclude: (object) =>
                                    animatedRootSet.has(object) ||
                                    excludeSource(object),
                                onSkip: (_object, reason) => {
                                    if (
                                        [
                                            "cell bound",
                                            "triangle bound",
                                            "fragment memory bound",
                                            "clipping work bound",
                                        ].includes(reason)
                                    )
                                        budgetLimited = true;
                                },
                            };
                            effect = pause
                                ? await finishInSlices(
                                      buildWorldCubeReveal(
                                          THREE,
                                          [capturedScene],
                                          cubeOptions as any
                                      ),
                                      pauseBuild
                                  )
                                : createWorldCubeReveal(
                                      THREE,
                                      [capturedScene],
                                      cubeOptions as any
                                  );
                            if (disposed) {
                                effect.dispose();
                                throw new Error("Departure cancelled.");
                            }
                            if (
                                !budgetLimited ||
                                attempt === 2 ||
                                cellSize >= 8
                            )
                                break;
                            effect.dispose();
                            effect = undefined;
                            cellSize *= 2;
                        }
                        if (!cacheHit) {
                            rememberWorldRevealFitHint(
                                capturedScene,
                                fitSettings,
                                { cellSize, budgetLimited },
                                window.location.pathname
                            );
                            effectDetails = {
                                cellSize,
                                triangleBudget: fitSettings.maxTriangles,
                                refinement: fitSettings.refinement,
                            };
                        }
                        tripMark(
                            cacheHit
                                ? "depart:room-reused"
                                : "depart:room-built"
                        );
                        const mediaStarted = performance.now();
                        const mediaOptions = {
                            ...fitSettings,
                            scene: Scene,
                            anchor,
                            mode: "dissolve" as const,
                            direction: "inward" as const,
                            cellSize,
                            waveExtent: effect.stats.maxDistance,
                            exclude: excludeSource,
                        };
                        mediaEffect = sweep
                            ? (createNoopWorldReveal() as unknown as typeof mediaEffect)
                            : pause
                            ? await finishInSlices(
                                  buildWorldTransitionMedia(
                                      THREE,
                                      [...mediaRoots, ...additions],
                                      mediaOptions
                                  ),
                                  pauseBuild
                              )
                            : createWorldTransitionMedia(
                                  THREE,
                                  [...mediaRoots, ...additions],
                                  mediaOptions
                              );
                        if (disposed) {
                            mediaEffect.dispose();
                            throw new Error("Departure cancelled.");
                        }
                        // Media can extend beyond the static room (or arrive
                        // after its cached build). Both layers must use the same
                        // wave extent, otherwise nearby artwork lingers after
                        // the wall carrying it has already disappeared.
                        if (
                            !sweep &&
                            mediaEffect.stats.maxDistance >
                                effect.stats.maxDistance
                        ) {
                            const extent = mediaEffect.stats.maxDistance;
                            effect.setRevealAnchor(anchor, extent);
                            mediaEffect.setRevealAnchor(anchor, extent);
                        }
                        tripMark("depart:media-built");
                        debug("cache-hit", cacheHit ? 1 : 0);
                        debug(
                            "media-build-ms",
                            Math.round(performance.now() - mediaStarted)
                        );
                        debug("media-cells", mediaEffect.stats.cells);
                        debug("media-triangles", mediaEffect.stats.triangles);
                        debug("media-skipped", mediaEffect.stats.skipped);
                        debug(
                            "media-skips",
                            JSON.stringify(mediaEffect.skipped)
                        );
                        debug(
                            "build-ms",
                            Math.round(performance.now() - buildStarted)
                        );
                        debug("fit-attempts", fitAttempts);
                        debug("cached-start-cell", cachedStartCell);
                        debug(
                            "cells",
                            effect.stats.cells + mediaEffect.stats.cells
                        );
                        debug("skipped", effect.stats.skipped);
                        debug("rigid-sources", effect.stats.rigidSources);
                        debug("rigid-triangles", effect.stats.rigidTriangles);
                        debug("view-cells", effect.stats.viewCells);
                        debug(
                            "view-cell-sizes",
                            JSON.stringify(effect.stats.viewCellSizeCounts)
                        );
                        debug("direction", "inward");
                        for (const key of [
                            "sourceTriangles",
                            "baseTriangles",
                            "triangles",
                            "baseClipTests",
                            "refinementClipTests",
                            "clipTests",
                            "refinementLimit",
                        ] as const)
                            debug(key, effect.stats[key]);
                        debug("sky-tiles", sky.stats.tiles);
                        debug("reflector-sources", reflectors.stats.sources);
                        debug("dimmed-backgrounds", sky.stats.dimmedSources);
                        debug("cell-size", cellSize);
                        debug("triangle-budget", fitSettings.maxTriangles);
                        debug(
                            "detail-focus",
                            JSON.stringify(fitSettings.refinement.focus)
                        );
                        debug(
                            "detail-forward",
                            JSON.stringify(fitSettings.refinement.forward)
                        );
                        debug("min-cell-size", effect.stats.minCellSize);
                        debug("max-cell-size", effect.stats.maxCellSize);
                        debug("refined-cells", effect.stats.refinedCells);
                        debug(
                            "refinement-limited",
                            effect.stats.refinementLimited
                        );
                        const reduced = window.matchMedia?.(
                            "(prefers-reduced-motion: reduce)"
                        );
                        const setProgress = (progress: number) => {
                            effect.setProgress(progress);
                            mediaEffect.setProgress(progress);
                            sky.setProgress(progress);
                            reflectors.setProgress(progress);
                        };
                        await warmWorldTransition(
                            Renderer,
                            Scene,
                            camera,
                            setProgress,
                            abort.signal
                        );
                        if (disposed) throw new Error("Departure cancelled.");
                        tripMark("depart:warmed");
                        const clock = createWorldRevealClock(WORLD_DISSOLVE_MS);
                        let blackStarted: number | undefined;
                        const tick = async (now: number) => {
                            if (disposed) return;
                            try {
                                const skip =
                                    options.reducedMotion || reduced?.matches;
                                const progress = skip
                                    ? 1
                                    : clock.sample(now, !document.hidden);
                                effect.setProgress(progress);
                                mediaEffect.setProgress(progress);
                                sky.setProgress(progress);
                                reflectors.setProgress(progress);
                                debug(
                                    "reflector-opacity",
                                    reflectors.stats.opacity
                                );
                                debug(
                                    "progress",
                                    Math.round(progress * 100) / 100
                                );
                                lock();
                                if (
                                    progress === 1 &&
                                    blackStarted === undefined
                                ) {
                                    blackStarted = now;
                                    tripMark("depart:black");
                                }
                                if (
                                    !skip &&
                                    (progress < 1 ||
                                        now - blackStarted <
                                            WORLD_BLACK_HOLD_MS)
                                ) {
                                    frame = requestAnimationFrame(tick);
                                    return;
                                }
                                await world.nextUpdate();
                                if (disposed) return;
                                rejectPending = undefined;
                                const avatarIdleTime = readNativeTravelIdleTime(
                                    avatar,
                                    Shared.animationTimer.value
                                );
                                if (returnView && avatarIdleTime !== undefined)
                                    returnView.avatarIdleTime = avatarIdleTime;
                                if (returnView) {
                                    captureWorldTravelFrame(
                                        returnView,
                                        CANVAS,
                                        () =>
                                            PostProcessing.render(
                                                Scene,
                                                camera,
                                                CURRENT_SPACE?.roomParameters ||
                                                    {}
                                            )
                                    );
                                }
                                tripMark("depart:resolved");
                                resolve(returnView ?? undefined);
                            } catch (error) {
                                tripMark(`depart:failed:${error?.message}`);
                                reject(error);
                                dispose();
                            }
                        };
                        // Both builders start intact; only the first animation frame
                        // begins dissolving, with no construction-time black flash.
                        frame = requestAnimationFrame(tick);
                    } catch (error) {
                        tripMark(`depart:failed:${error?.message}`);
                        reject(error);
                        dispose();
                    }
                })();
            });
            return pending;
        },
        dispose,
    };
}
