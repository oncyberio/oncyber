import * as THREE from "three/webgpu";
import Camera from "@3camera";
import Scene from "@3scene";
import Emitter from "@3emitter";
import Events from "@3events";
import Renderer from "@3renderer";
import Players from "../factory/player";
import Root from "../root";
import PostProcessing from "../renderer/postprocessing";
import {
    CANVAS,
    CSS_CANVAS,
    CURRENT_SPACE,
    IS_FIRST_PERSON,
    SET_IS_FIRST_PERSON,
} from "../constants";
import type { LobbyDestinationEntryOptions } from "@features/lobby/lobbyJourneyProtocol";
import type { LobbyPortalView } from "@features/lobby/lobbyPortalPreview";
import { applyWorldTravelView } from "@features/lobby/worldTravelPose";
import {
    mapNativeProfilePortalView,
    nativeProfilePortalFraming,
} from "./nativeProfilePortalView";
import {
    resolveNativeTravelGroundedFeet,
    synchronizeNativeTravelGrounding,
} from "./nativeTravelGrounding";
import { nativeTravelAvatarYawOffset } from "./nativeTravelAvatarYaw";


/** A live view into the already loaded native room. The profile retains its own
 * lightweight Three lobby; only the destination's existing renderer draws here. */
export function createNativeProfilePortal(world: {
    nextUpdate(signal?: AbortSignal): Promise<unknown>;
}) {
    const player: any = Players.main;
    const originalCamera: any = Camera.current;
    const controls: any = Camera.currentControls;
    const physics = controls?.world;
    const avatar = player?.avatar3D;
    if (!player || !originalCamera || !Root.currentSpace?.scene)
        throw new Error("The destination scene is not ready for its portal.");
    const anchor = player.position.clone();
    const grounded = resolveNativeTravelGroundedFeet(physics, anchor);
    if (grounded) anchor.copy(grounded);
    const authoredHeading = [
        physics?.roomParameters?.initialPlayerRotation?.y,
        originalCamera.roomParameters?.initialPlayerRotation?.y,
        physics?.initial?.cameraRot?.y,
    ].find(Number.isFinite);
    const direction = originalCamera.getWorldDirection(new THREE.Vector3());
    const heading = authoredHeading ?? Math.atan2(-direction.x, -direction.z);
    const saved = {
        camera: originalCamera,
        cameraPosition: originalCamera.position.clone(),
        cameraQuaternion: originalCamera.quaternion.clone(),
        cameraFov: originalCamera.fov,
        cameraAspect: originalCamera.aspect,
        cameraActive: Camera.active,
        firstPerson: IS_FIRST_PERSON,
        controlsEnabled: controls?.enabled,
        playerPosition: player.position.clone(),
        playerRotation: player.rotation.clone(),
        playerVisible: player.visible,
        playerMoving: player.isMoving,
        playerFloor: player.isPlayerOnFloor,
        playerJumping: player.isJumping,
        playerDeactivated: player.deactivated,
        avatarVisible: avatar?.visible,
        avatarOpacity: avatar?.opacity,
        avatarFloor: avatar?.onFloor,
        avatarJumping: avatar?.isJumping,
        avatarFloorVelocity: avatar?.floorVelocity,
        avatarSmoothedFloorVelocity: avatar?.smoothedFloorVelocity,
        avatarHeight: avatar?.headPosition?.y,
        avatarReadyIdle: avatar?.travelReadyIdle,
        avatarReadyUntilMovement: avatar?.travelReadyIdleUntilMovement,
        usernameVisible: player.username?.wrapper?.visible,
        travelFraming: originalCamera.travelFraming,
        travelTargetOffset: originalCamera.travelTargetOffset?.clone(),
        cssVisibility: CSS_CANVAS?.style.visibility,
        documentFlag: document.documentElement.getAttribute(
            "data-profile-portal-preview"
        ),
        canvasFlag: CANVAS.getAttribute("data-profile-portal-preview"),

    };
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
        if (originalCamera[key] !== undefined)
            cameraSeeds.set(
                key,
                originalCamera[key]?.clone?.() ?? originalCamera[key]
            );
    const movementSeeds = new Map<string, any>();
    const playerState = physics?.playerState;
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
    const savedPan = playerState?.joystickState?.pan?.clone();
    const abort = new AbortController();
    let disposed = false,
        complete = false,
        prepared = false,
        locked = true,
        revealing = false;
    let camera: any = originalCamera;
    let mapped: ReturnType<typeof mapNativeProfilePortalView> | undefined;
    let pendingReveal: Promise<void> | undefined;
    let previewPlayerVisible = false;
    let movement: LobbyPortalView["movement"];
    const clippingPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading)),
        anchor
    );
    const room = Root.currentSpace.scene;
    const roomParent = room.parent;
    const clipGroup = new THREE.ClippingGroup();
    clipGroup.clippingPlanes = [clippingPlane];
    roomParent.add(clipGroup);
    clipGroup.add(room);
    const removeClip = () => {
        if (room.parent === clipGroup) roomParent.add(room);
        clipGroup.removeFromParent();
    };
    const chromeStyle = document.createElement("style");
    chromeStyle.textContent = `
        html[data-profile-portal-preview="true"] body * { visibility: hidden !important; }
        html[data-profile-portal-preview="true"] canvas[data-profile-portal-preview="true"] { visibility: visible !important; }
    `;
    document.head.appendChild(chromeStyle);
    document.documentElement.setAttribute(
        "data-profile-portal-preview",
        "true"
    );
    CANVAS.setAttribute("data-profile-portal-preview", "true");
    if (CSS_CANVAS) CSS_CANVAS.style.visibility = "hidden";
    const restoreAttribute = (
        element: Element,
        name: string,
        value: string | null
    ) => {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
    };
    const restoreChrome = () => {
        chromeStyle.remove();
        restoreAttribute(
            document.documentElement,
            "data-profile-portal-preview",
            saved.documentFlag
        );
        restoreAttribute(
            CANVAS,
            "data-profile-portal-preview",
            saved.canvasFlag
        );
        if (CSS_CANVAS) CSS_CANVAS.style.visibility = saved.cssVisibility || "";
    };
    const lock = () => {
        if (disposed || !locked) return;
        Camera.current = camera;
        Camera.active = false;
        if (controls) controls.enabled = false;
        if (mapped) {
            player.isMoving = (movement?.speed || 0) > 0.05;
            player.isPlayerOnFloor = true;
            player.isJumping = false;
            if (avatar) {
                avatar.setPlayerOnFloor?.(true);
                avatar.setPlayerIsJumping?.(false);
                avatar.travelReadyIdle = false;
                avatar.travelReadyIdleUntilMovement = false;
            }
            const feet = mapped.playerPosition;
            applyWorldTravelView(THREE, camera, player, feet, {
                cameraOffset: mapped.cameraPosition.clone().sub(feet),
                cameraTargetOffset: mapped.cameraTarget.clone().sub(feet),
                avatarRotation:
                    mapped.avatarRotation - nativeTravelAvatarYawOffset(avatar),
                avatarLift: 0,
                cameraMode: "third-person",
                fov: mapped.fov,
            });
            camera.aspect = mapped.aspect;
            camera.updateProjectionMatrix();
        }
        if (!revealing) {
            player.visible = previewPlayerVisible;
            if (avatar) avatar.visible = previewPlayerVisible;
        }
        if (player.username?.wrapper) player.username.wrapper.visible = false;
        Camera.updateFrustum(camera);
    };
    Emitter.on(Events.PRE_UPDATE, lock);
    Emitter.on(Events.PRE_RENDER, lock);
    function renderNow() {
        if (disposed || complete) return;
        const target = Renderer.getRenderTarget();
        try {
            lock();
            Renderer.setRenderTarget(null);
            Renderer.clear();
            Scene.updateMatrixWorld(true);
            PostProcessing.render(
                Scene,
                camera,
                CURRENT_SPACE?.roomParameters || {}
            );
        } finally {
            Renderer.setRenderTarget(target);
        }
    }
    function unlock(success: boolean) {
        locked = false;
        Emitter.off(Events.PRE_UPDATE, lock);
        Emitter.off(Events.PRE_RENDER, lock);
        Camera.active = success ? true : saved.cameraActive;
        if (controls && Camera.currentControls === controls)
            controls.enabled = success ? true : saved.controlsEnabled;
        removeClip();
    }
    function preview(view: LobbyPortalView) {
        if (disposed || complete || revealing) return;
        previewPlayerVisible = view.playerPosition.z <= 0;
        movement = view.movement;
        mapped = mapNativeProfilePortalView(
            view,
            anchor,
            heading,
            saved.avatarHeight
        );
        if (prepared) renderNow();
    }
    return {
        async prepare(options: LobbyDestinationEntryOptions) {
            if (disposed) throw new Error("Portal arrival cancelled.");
            if (!prepared) {
                await Camera.setThirdPerson?.(false, true);
                if (disposed) throw new Error("Portal arrival cancelled.");
                camera = Camera.current;
                SET_IS_FIRST_PERSON(false);
                controls?.setCamera?.(camera);
                if (controls) controls.enabled = false;
                Camera.active = false;

                // Warm both clipping variants while the saved capture is visible.
                // Removing the clip at handoff must not compile a blank frame.
                removeClip();
                await Renderer.compileAsync(Scene, camera);
                if (disposed) throw new Error("Portal arrival cancelled.");
                roomParent.add(clipGroup);
                clipGroup.add(room);
                await Renderer.compileAsync(Scene, camera);
                if (disposed) throw new Error("Portal arrival cancelled.");
                prepared = true;
            }
            // Staging updates the view without rebasing the authored entrance.
            if (options.portalView) preview(options.portalView);
            lock();
            renderNow();
            await world.nextUpdate(abort.signal);
            if (disposed) throw new Error("Portal arrival cancelled.");
        },
        preview,
        reveal(options: LobbyDestinationEntryOptions) {
            if (disposed)
                return Promise.reject(new Error("Portal arrival cancelled."));
            if (pendingReveal) return pendingReveal;
            if (options.portalView) preview(options.portalView);
            revealing = true;
            pendingReveal = (async () => {
                if (!mapped) throw new Error("The portal camera is not ready.");
                // Keep the same feet/camera seen through the aperture. The normal
                // collision body is seeded before the native controller takes over.
                const settled = resolveNativeTravelGroundedFeet(
                    physics,
                    mapped.playerPosition
                );
                if (settled) {
                    const adjustment = settled
                        .clone()
                        .sub(mapped.playerPosition);
                    mapped.playerPosition.copy(settled);
                    mapped.cameraPosition.add(adjustment);
                    mapped.cameraTarget.add(adjustment);
                }
                removeClip();
                lock();
                player.visible = true;
                player.deactivated = false;
                player.isMoving = (movement?.speed || 0) > 0.05;
                player.isPlayerOnFloor = true;
                player.isJumping = false;
                if (avatar) {
                    avatar.visible = true;
                    avatar.opacity = 1;
                    avatar.travelReadyIdle = false;
                    avatar.travelReadyIdleUntilMovement = false;
                }
                player.updateAvatar?.();
                if (playerState) {
                    playerState.veclocity?.set(0, 0, 0);
                    playerState.direction?.set(0, 0, 0);
                    playerState.originalDirection?.set(0, 0, 0);
                    playerState.keyStates = Object.fromEntries((movement?.keys || []).map(key => [key, true]));
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
                    playerState.rotateQuarternion?.setFromEuler(
                        player.rotation
                    );
                }
                controls?.setCamera?.(camera);
                synchronizeNativeTravelGrounding(physics, player.position);
                // Grounding resets velocity. Restore the mapped walking momentum
                // afterwards so crossing does not brake and restart the avatar.
                playerState?.veclocity?.copy(mapped.velocity);
                camera.travelFraming = nativeProfilePortalFraming(
                    mapped,
                    saved.cameraFov
                );
                camera.updateTravelFraming?.(0);
                renderNow();
                await world.nextUpdate(abort.signal);
                if (disposed) throw new Error("Portal arrival cancelled.");
                unlock(true);
                restoreChrome();
                if (player.username?.wrapper)
                    player.username.wrapper.visible = saved.usernameVisible;
                complete = true;
            })();
            return pendingReveal;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            abort.abort();
            restoreChrome();
            if (complete) return;
            unlock(false);
            SET_IS_FIRST_PERSON(saved.firstPerson);
            Camera.current = originalCamera;
            controls?.setCamera?.(originalCamera);
            originalCamera.position.copy(saved.cameraPosition);
            originalCamera.quaternion.copy(saved.cameraQuaternion);
            originalCamera.fov = saved.cameraFov;
            originalCamera.aspect = saved.cameraAspect;
            originalCamera.travelFraming = saved.travelFraming;
            originalCamera.travelTargetOffset = saved.travelTargetOffset;
            for (const [key, value] of cameraSeeds)
                if (originalCamera[key]?.copy) originalCamera[key].copy(value);
                else originalCamera[key] = value;
            originalCamera.updateProjectionMatrix();
            originalCamera.updateMatrixWorld(true);
            Camera.addAudioListener?.();
            Camera.updateFrustum(originalCamera);
            player.position.copy(saved.playerPosition);
            player.rotation.copy(saved.playerRotation);
            player.visible = saved.playerVisible;
            player.isMoving = saved.playerMoving;
            player.isPlayerOnFloor = saved.playerFloor;
            player.isJumping = saved.playerJumping;
            player.deactivated = saved.playerDeactivated;
            if (avatar) {
                avatar.visible = saved.avatarVisible;
                avatar.opacity = saved.avatarOpacity;
                avatar.onFloor = saved.avatarFloor;
                avatar.isJumping = saved.avatarJumping;
                avatar.floorVelocity = saved.avatarFloorVelocity;
                avatar.smoothedFloorVelocity =
                    saved.avatarSmoothedFloorVelocity;
                avatar.travelReadyIdle = saved.avatarReadyIdle;
                avatar.travelReadyIdleUntilMovement =
                    saved.avatarReadyUntilMovement;
            }
            if (player.username?.wrapper)
                player.username.wrapper.visible = saved.usernameVisible;
            synchronizeNativeTravelGrounding(physics, saved.playerPosition);
            for (const [key, value] of movementSeeds)
                if (playerState[key]?.copy) playerState[key].copy(value);
                else
                    playerState[key] =
                        typeof value === "object" ? { ...value } : value;
            if (savedPan) playerState.joystickState.pan.copy(savedPan);
            player.updateAvatar?.();
        },
    };
}
