// The lobby's third-person camera as pure numbers: it orbits a point above
// the avatar's feet, the visitor drags or steers it, and movement is relative
// to it. three.ts applies the result to a camera.
import { ARRIVAL, CAMERA } from "./constants.ts";

export interface Point {
    x: number;
    y: number;
    z: number;
}

export interface FollowCamera {
    /** Where the view is, and where the visitor pointed it. Radians. At yaw 0
     * the camera sits on +z of the avatar and looks down -z. */
    yaw: number;
    pitch: number;
    targetYaw: number;
    targetPitch: number;
    /** Game units per lobby metre. */
    scale: number;
    /** From the look point to the camera, in game units. */
    distance: number;
    /** The look point relative to the avatar's feet, in game units. */
    look: Point;
    /** Set by `arrival`: the field of view the lobby handed over, and how
     * much of it is left (1 on arrival, 0 once settled). */
    fov: number | null;
    fovBlend: number;
    /** Easing from an arrival framing to the lobby's follow camera. */
    settling: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (rate: number, dt: number) =>
    1 - Math.exp(-rate * clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1));

/** The lobby's field of view for a view this many CSS pixels wide. */
export const lobbyFov = (width: number) =>
    width < CAMERA.narrowWidth ? CAMERA.narrowFov : CAMERA.fov;

/** The lobby's follow camera, looking along `yaw`. */
export function createFollowCamera(
    options: { yaw?: number; scale?: number } = {}
): FollowCamera {
    const scale = options.scale && options.scale > 0 ? options.scale : 1;
    const yaw = options.yaw || 0;
    return {
        yaw,
        pitch: CAMERA.pitch,
        targetYaw: yaw,
        targetPitch: CAMERA.pitch,
        scale,
        distance: CAMERA.distance * scale,
        look: { x: 0, y: CAMERA.lookHeight * scale, z: 0 },
        fov: null,
        fovBlend: 0,
        settling: false,
    };
}

const settle = (camera: FollowCamera) => {
    if (camera.fov === null || camera.settling) return;
    camera.settling = true;
    // Past the lobby's limits the view comes back to them, not snaps.
    camera.targetPitch = clamp(
        camera.targetPitch,
        CAMERA.pitchMin,
        CAMERA.pitchMax
    );
};

/** A drag on the view, in CSS pixels. */
export function dragLook(camera: FollowCamera, dx: number, dy: number) {
    settle(camera);
    camera.targetYaw -= dx * CAMERA.dragYaw;
    camera.targetPitch = clamp(
        camera.targetPitch - dy * CAMERA.dragPitch,
        CAMERA.pitchMin,
        CAMERA.pitchMax
    );
}

/** A wheel or trackpad scroll, in pixels: tilts the view. */
export function wheelLook(camera: FollowCamera, deltaY: number) {
    settle(camera);
    const delta = clamp(deltaY, -CAMERA.wheelMax, CAMERA.wheelMax);
    camera.targetPitch = clamp(
        camera.targetPitch - delta * CAMERA.wheelPitch,
        CAMERA.pitchMin,
        CAMERA.pitchMax
    );
}

/** Steer with the arrow keys or a stick: turns at once, with no easing. */
export function turnLook(camera: FollowCamera, yaw: number, pitch = 0) {
    if (!yaw && !pitch) return;
    settle(camera);
    camera.targetYaw += yaw;
    camera.yaw += yaw;
    camera.targetPitch = clamp(
        camera.targetPitch + pitch,
        CAMERA.pitchMin,
        CAMERA.pitchMax
    );
}

/** Once per frame, before reading `camera.yaw` for movement. `moving` is
 * whether the visitor is giving movement input. */
export function updateCamera(
    camera: FollowCamera,
    seconds: number,
    moving = false
) {
    if (moving) settle(camera);
    const k = ease(CAMERA.lookRate, seconds);
    camera.yaw += (camera.targetYaw - camera.yaw) * k;
    camera.pitch += (camera.targetPitch - camera.pitch) * k;
    if (!camera.settling) return;
    const s = ease(ARRIVAL.settleRate, seconds);
    const distance = CAMERA.distance * camera.scale,
        height = CAMERA.lookHeight * camera.scale;
    camera.distance += (distance - camera.distance) * s;
    camera.look.x += -camera.look.x * s;
    camera.look.y += (height - camera.look.y) * s;
    camera.look.z += -camera.look.z * s;
    camera.fovBlend += -camera.fovBlend * s;
    if (
        camera.fovBlend < 0.002 &&
        Math.abs(camera.distance - distance) < 0.002 * camera.scale &&
        Math.hypot(camera.look.x, camera.look.y - height, camera.look.z) <
            0.002 * camera.scale
    ) {
        camera.distance = distance;
        camera.look = { x: 0, y: height, z: 0 };
        camera.settling = false;
        camera.fov = null;
        camera.fovBlend = 0;
    }
}

export interface CameraPose {
    position: Point;
    target: Point;
    /** Vertical field of view, degrees. */
    fov: number;
    near: number;
}

/** Where the camera is for an avatar whose feet are at `feet` (the ground
 * under it: the lobby's camera does not bob with a jump). `width` is the
 * view's width in CSS pixels. */
export function cameraPose(
    camera: FollowCamera,
    feet: { x: number; y?: number; z: number },
    width = 1280
): CameraPose {
    const target = {
        x: feet.x + camera.look.x,
        y: (feet.y || 0) + camera.look.y,
        z: feet.z + camera.look.z,
    };
    const flat = Math.cos(camera.pitch) * camera.distance;
    const lobby = lobbyFov(width);
    // The lobby's handed-over field of view gives way to the follow camera's.
    const fov =
        camera.fov === null
            ? lobby
            : lobby + (camera.fov - lobby) * camera.fovBlend;
    return {
        position: {
            x: target.x + Math.sin(camera.yaw) * flat,
            y: target.y - Math.sin(camera.pitch) * camera.distance,
            z: target.z + Math.cos(camera.yaw) * flat,
        },
        target,
        fov,
        near: CAMERA.near * camera.scale,
    };
}
