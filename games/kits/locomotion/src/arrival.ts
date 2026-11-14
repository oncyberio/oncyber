// Arrival: the lobby shows the visitor from a camera of its own just before
// it reveals the game. This turns that view into the game's space, so the
// first frame of the game is the last frame of the lobby, facing whichever
// way the game wants.
import { CAMERA, MOTION } from "./constants.ts";
import { createFollowCamera, type FollowCamera, type Point } from "./camera.ts";

/** The lobby's view as the page bridge sends it (`arrival`): offsets are
 * relative to the avatar's feet, in lobby metres. */
export interface LobbyView {
    cameraOffset: Point;
    cameraTargetOffset: Point;
    /** The avatar's heading, radians. */
    avatarRotation: number;
    /** The avatar's height in the lobby. Defaults to 1.8. */
    avatarHeight?: number;
    /** Vertical field of view, degrees. */
    fov: number;
}

/** The same view as the lifecycle's enter(continuity) carries it. */
export interface ContinuityView {
    avatar: { position: readonly number[]; rotation: readonly number[] };
    camera: {
        position: readonly number[];
        target: readonly number[];
        fov: number;
    };
}

export interface ArrivalOptions {
    /** Where the visitor's feet go, in the game's space. */
    at: { x: number; y?: number; z: number };
    /** The heading the camera looks along once arrived, radians. 0 looks
     * down -z; a quarter turn (PI / 2) looks down -x. */
    facing: number;
    /** The avatar's height in the game's units. Defaults to 1.8 (metres). */
    avatarHeight?: number;
}

export interface Arrival {
    /** The camera, in the game's space. */
    position: Point;
    target: Point;
    fov: number;
    /** The avatar's heading in the game's space, radians (0 faces -z). */
    avatarRotation: number;
    /** Game units per lobby metre, for `createWalker({ scale })`. */
    scale: number;
    /** A follow camera that starts on this exact framing and eases into the
     * lobby's once the visitor moves or looks. */
    camera: FollowCamera;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const number = (v: unknown, fallback = NaN) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
const point = (v: any): Point =>
    Array.isArray(v)
        ? { x: number(v[0]), y: number(v[1]), z: number(v[2]) }
        : { x: number(v?.x), y: number(v?.y), z: number(v?.z) };

/** Accept either shape; null when it is not a usable third-person view. */
export function readLobbyView(value: unknown): LobbyView | null {
    const v = value as any;
    if (!v || typeof v !== "object") return null;
    let view: LobbyView;
    if (v.camera && v.avatar) {
        const feet = point(v.avatar.position),
            camera = point(v.camera.position),
            target = point(v.camera.target);
        const [x, y, z, w] = [0, 1, 2, 3].map((n) =>
            number(v.avatar.rotation?.[n], n === 3 ? 1 : 0)
        );
        view = {
            cameraOffset: {
                x: camera.x - feet.x,
                y: camera.y - feet.y,
                z: camera.z - feet.z,
            },
            cameraTargetOffset: {
                x: target.x - feet.x,
                y: target.y - feet.y,
                z: target.z - feet.z,
            },
            avatarRotation: Math.atan2(
                2 * (w * y + x * z),
                1 - 2 * (y * y + x * x)
            ),
            fov: number(v.camera.fov),
        };
    } else {
        view = {
            cameraOffset: point(v.cameraOffset),
            cameraTargetOffset: point(v.cameraTargetOffset),
            avatarRotation: number(v.avatarRotation),
            avatarHeight:
                number(v.avatarHeight) >= 0.2 && v.avatarHeight <= 10
                    ? v.avatarHeight
                    : undefined,
            fov: number(v.fov),
        };
    }
    const d = {
        x: view.cameraOffset.x - view.cameraTargetOffset.x,
        y: view.cameraOffset.y - view.cameraTargetOffset.y,
        z: view.cameraOffset.z - view.cameraTargetOffset.z,
    };
    const length = Math.hypot(d.x, d.y, d.z);
    // A camera on its own look point, far away, or with no lens is not a view.
    if (!(length > 0.3 && length < 100) || !(view.fov > 5 && view.fov < 150))
        return null;
    if (
        ![view.cameraOffset, view.cameraTargetOffset].every(
            (p) => Math.hypot(p.x, p.y, p.z) <= 1000
        ) ||
        !Number.isFinite(view.avatarRotation)
    )
        return null;
    return view;
}

/**
 * Turn the lobby's view into the game's own space.
 *
 * Pass the `view` from the page bridge's `arrival` message, or the
 * `continuity` from enter(). With no usable view (a direct visit) the
 * result is the lobby's ordinary follow camera behind the visitor.
 */
export function arrival(view: unknown, options: ArrivalOptions): Arrival {
    const height =
        options.avatarHeight && options.avatarHeight > 0
            ? options.avatarHeight
            : MOTION.referenceHeight;
    const scale = height / MOTION.referenceHeight;
    const feet = { x: options.at.x, y: options.at.y || 0, z: options.at.z };
    const facing = number(options.facing, 0);
    const lobby = readLobbyView(view);
    const camera = createFollowCamera({ yaw: facing, scale });
    if (!lobby) {
        const flat = Math.cos(CAMERA.pitch) * camera.distance;
        return {
            position: {
                x: feet.x + Math.sin(facing) * flat,
                y:
                    feet.y +
                    camera.look.y -
                    Math.sin(CAMERA.pitch) * camera.distance,
                z: feet.z + Math.cos(facing) * flat,
            },
            target: { x: feet.x, y: feet.y + camera.look.y, z: feet.z },
            fov: CAMERA.fov,
            avatarRotation: facing,
            scale,
            camera,
        };
    }
    // Keep the lobby's framing on screen: size it by the avatar's own height.
    const frame = height / (lobby.avatarHeight ?? MOTION.referenceHeight);
    const dx = lobby.cameraOffset.x - lobby.cameraTargetOffset.x,
        dz = lobby.cameraOffset.z - lobby.cameraTargetOffset.z;
    const dy = lobby.cameraOffset.y - lobby.cameraTargetOffset.y;
    // The heading the lobby's camera looked along; turn everything so it
    // becomes the game's pick.
    const incoming =
        Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : lobby.avatarRotation;
    const turn = facing - incoming,
        sin = Math.sin(turn),
        cos = Math.cos(turn);
    const map = (p: Point): Point => ({
        x: (p.x * cos + p.z * sin) * frame,
        y: p.y * frame,
        z: (p.z * cos - p.x * sin) * frame,
    });
    const offset = map(lobby.cameraOffset),
        look = map(lobby.cameraTargetOffset);
    const distance = Math.hypot(dx, dy, dz) * frame;
    camera.distance = distance;
    camera.look = look;
    camera.pitch = camera.targetPitch = -Math.asin(
        clamp((dy * frame) / distance, -1, 1)
    );
    camera.fov = lobby.fov;
    camera.fovBlend = 1;
    return {
        position: {
            x: feet.x + offset.x,
            y: feet.y + offset.y,
            z: feet.z + offset.z,
        },
        target: { x: feet.x + look.x, y: feet.y + look.y, z: feet.z + look.z },
        fov: lobby.fov,
        avatarRotation: Math.atan2(
            Math.sin(lobby.avatarRotation + turn),
            Math.cos(lobby.avatarRotation + turn)
        ),
        scale,
        camera,
    };
}
