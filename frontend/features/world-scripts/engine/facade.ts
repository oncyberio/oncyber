/**
 * The one place world scripts reach into the 3D engine
 * (components/_3DExhibit-v2). Everything else in this feature asks here.
 *
 * The engine has no interface for a feature like this one: what is used is
 * its modules' own singletons and a few fields nobody promised to keep. A
 * rename there would not fail to compile here (the engine is JavaScript),
 * and most of what is read is optional by nature (no player yet, no world
 * between two spaces), so it would fail silently: no artworks, no
 * collisions, no teleport. ./facade.contract.test.ts reads the engine's
 * source and fails when a name this file relies on is gone. Add to both
 * when you reach for something new.
 *
 * `window.scene`, the one thing read before the engine's modules may be
 * loaded, is in ./worldUp.ts for that reason.
 */
import type { Camera as ThreeCamera, Mesh, Object3D, Vector3 } from "three";
import Scene from "@3/three/scene";
import Camera from "@3/three/camera";
import Players from "@3/three/factory/player";
import Root from "@3/three/root";
import GLTF from "@3/three/gltf";
import VRMS from "@3/three/factory/player/vrms.json";
import Emitter from "@3/three/events/emitter";
import Events from "@3/three/events/events";
import {
    APP_STATES,
    CANVAS,
    CURRENT_SPACE,
    CURRENT_STATE,
    DEFAULT_PLAYER_AVATAR_PICTURE,
    IS_MOBILE,
} from "@3/three/constants";
import {
    UPDATE_CHAT,
    UPDATE_USERNAME,
} from "@3/three/factory/player/constants";
import { RenderDemand } from "@3/three/utils/renderDemand";

export { worldHasScene } from "./worldUp";

type Vec3 = [number, number, number];

/**
 * The world is showing: a player and a camera are in place, and the
 * world's loading animation is over. A script that starts while the world
 * still loads builds its things on the thread that is loading, and a
 * visitor waits longer for both.
 */
export function engineReady() {
    try {
        return (
            !!(Players as any).main &&
            !!Camera.current &&
            !!CANVAS &&
            CURRENT_STATE !== APP_STATES.INTRO
        );
    } catch {
        return false;
    }
}

// The scene, the camera, the canvas, the visitor.

export function addToScene(object: Object3D) {
    (Scene as any).add(object);
}

export function removeFromScene(object: Object3D) {
    (Scene as any).remove(object);
}

/** The world's sky and fog colours, where it has them. */
export function sceneColors(): { sky?: string; fog?: string } {
    const hex = (color: any) =>
        color?.isColor ? `#${color.getHexString()}` : undefined;
    const scene = Scene as any;
    return { sky: hex(scene.background), fog: hex(scene.fog?.color) };
}

/** The camera the world is drawn through now, if there is one. */
export function currentCamera(): ThreeCamera | null {
    return (Camera.current as ThreeCamera) || null;
}

/** The canvas the world is drawn on. */
export function worldCanvas(): HTMLCanvasElement | null {
    return (CANVAS as HTMLCanvasElement) || null;
}

/** The visitor's own avatar: where it stands, and how tall it is drawn. */
export function mainPlayer(): {
    position: Vector3;
    modelScale?: number;
} | null {
    return (Players as any).main ?? null;
}

/** Puts the visitor somewhere. The controls refuse while travelling. */
export function teleport(position: Vec3) {
    try {
        (Root as any).teleport?.({
            position: { x: position[0], y: position[1], z: position[2] },
        });
    } catch {
        /* the controls refuse a move while travelling: ignore */
    }
}

/** Whether this is a phone or a tablet, as the engine decided it. */
export function onMobile(): boolean {
    return !!IS_MOBILE;
}

// Frames.

/** `run` once per frame the engine updates, with the seconds since the last. */
export function onUpdate(run: (delta: number) => void) {
    Emitter.on(Events.UPDATE, run);
    return () => void Emitter.off?.(Events.UPDATE, run);
}

/**
 * Says that `source` changes the picture every frame for as long as it is
 * active; otherwise the engine draws only when something changed.
 */
export function drawEveryFrame(source: string, active: boolean) {
    RenderDemand.setContinuous(source, active);
}

// Artworks.

/** The space's artworks as the engine has them now: scene objects. */
export function liveArtworks(): Object3D[] {
    try {
        return (Root as any).getArtworks?.() || [];
    } catch {
        return [];
    }
}

export function artworkId(artwork: any): string {
    return String(
        artwork?.data?.id ?? artwork?.item?.id ?? artwork?.uuid ?? ""
    );
}

export function artworkName(artwork: any): string {
    return String(artwork?.data?.name ?? "").slice(0, 120);
}

export function artworkType(artwork: any): string {
    return String(artwork?.mediaType ?? artwork?.data?.type ?? "");
}

// The world's own model, and what is walked on.

/** The world's model: what the space loader put on show. */
export function worldModel(): Object3D | null {
    try {
        return (Root as any).currentSpace?.scene?.spaceScene ?? null;
    } catch {
        return null;
    }
}

/** The engine's collision world: a static tree and colliders that can move. */
export interface CollisionWorld {
    staticOctree: {
        traverseTriangles(visit: (triangle: CollisionTriangle) => void): void;
    };
    addCollider(mesh: Object3D): unknown;
    removeCollider(mesh: Object3D): void;
    updateDynOctree(): void;
}
export interface CollisionTriangle {
    a: Vector3;
    b: Vector3;
    c: Vector3;
}

/** The collision world of the space on show, or null between spaces. */
export function collisionWorld(): CollisionWorld | null {
    try {
        const controls = (Camera as any).currentControls;
        return controls?.world?.collisions?.worldOctree ?? null;
    } catch {
        return null;
    }
}

/**
 * The engine keeps a mesh's collider on the mesh itself: a mesh put into a
 * new collision world needs it forgotten first.
 */
export function forgetCollider(mesh: Mesh) {
    mesh.userData._collider = null;
}

// Doors and portals.

/** A door of the world's model is a group named this way, by its number. */
export const DOOR_MESH_NAME = /^Portal_Door_(\d+)$/i;

/** A place the space loader found for a portal, as far as a door goes. */
export interface PortalPlaceholder {
    /** The door of the model that closes it, when it has one. */
    door: Object3D | null;
    /** What the portal would show: it stands just behind the door. */
    preview: Object3D | null;
    /** What the space names it by when it makes it a portal. */
    portalId: string;
}

/** Where the space loader found a place for a portal, door or not. */
export function portalPlaceholders(): PortalPlaceholder[] {
    const found: any[] = (Root as any).currentSpace?.portalPlaceholders || [];
    return found.map((item) => ({
        door: item?.meshes?.portalDoor ?? null,
        preview:
            item?.meshes?.originalPreviewMesh ||
            item?.meshes?.previewMesh ||
            null,
        portalId: item?.portalId,
    }));
}

/** The ids of the placeholders the space has made portals. */
export function assignedPortalIds(): Set<string> {
    const portals = (CURRENT_SPACE as any)?.exhibit?.portals || {};
    return new Set(Object.values(portals).map((portal: any) => portal?.id));
}

// Avatars: made the way other visitors' are, by the engine's player factory.

/** The built-in avatars: id to file. */
export function avatarCatalogue(): Record<string, { url?: string }> {
    return VRMS as Record<string, { url?: string }>;
}

/** Loads an avatar's file unless the engine has it already. */
export async function loadAvatarFile(url: string) {
    const gltf = GLTF as any;
    if (gltf[url] == null) await gltf.loadOnce({ name: url, url });
}

/**
 * An avatar with moving hair and cloth is drawn from a pool: asks for one
 * from it (standAvatar marks it used). Undefined for the others, which
 * need none.
 */
export async function requestPooledAvatar(url: string): Promise<unknown> {
    const gltf = GLTF as any;
    if (!gltf[url]?.isHighQuality) return undefined;
    return gltf.requestPool(url);
}

/** An avatar standing in the world, as far as a script may direct it. */
export interface StandingAvatar {
    setName(name: string): void;
    /** Sits or stands, and plays the engine's emote of that number. */
    setMotion(sit: boolean, emote: number): void;
    /** False while its label is not placed yet: say it again next frame. */
    say(text: string): boolean;
    setShown(shown: boolean): void;
    place(position: Vector3, yaw: number): void;
    remove(): void;
}

/**
 * Stands an avatar in the scene: a player of the engine's that belongs to
 * no one (a dummy), as tall as the visitors of this world stand.
 */
export function standAvatar(options: {
    url: string;
    pooled?: unknown;
    name: string;
    key: string;
    position: Vector3;
    yaw: number;
}): StandingAvatar {
    const userData: Record<string, unknown> = {
        avatar: DEFAULT_PLAYER_AVATAR_PICTURE,
        username: options.name,
        walletId: "",
        isAdmin: false,
        VRM: options.url,
        HIGH_VRM: options.url,
    };
    if (options.pooled) {
        (options.pooled as any).scene.poolUsed = true;
        userData.VRMMeshes = options.pooled;
    }
    const main = (Players as any).main;
    const npc = (Players as any).get({
        userData,
        exhibit: { id: (CURRENT_SPACE as any)?.exhibit?.id },
        user: { id: options.key },
        sessionId: options.key,
        roomParameters: { user_height: 2.8 },
        position: options.position.clone(),
        rotation: options.yaw,
        isDummy: true,
    });
    addToScene(npc);
    npc.visible = true;
    // drawn however far the visitor is, as the world's own things are
    if (npc.username?.wrapper) npc.username.wrapper.ignoreLOD = true;
    if (npc.avatar3D) npc.avatar3D.ignoreLOD = true;
    // as tall as the visitors of this world stand
    if (typeof main?.modelScale === "number") npc.scaleVRM(main.modelScale);
    return {
        setName(name) {
            npc.updatePlayer({
                type: UPDATE_USERNAME,
                payload: name,
                textOnly: true,
            });
        },
        setMotion(sit, emote) {
            npc.handleSit?.(sit);
            npc.playEmote?.(emote);
        },
        say(text) {
            // its label is placed a frame after it is made: speech waits
            if (!npc.username?.wrapper?.position?.y) return false;
            npc.updatePlayer({
                type: UPDATE_CHAT,
                payload: { text, date: "", acc_date: "" },
            });
            return true;
        },
        setShown(shown) {
            if (shown) npc.show?.();
            else npc.hide?.();
        },
        place(position, yaw) {
            npc.position.copy(position);
            npc.rotation.y = yaw;
        },
        remove() {
            try {
                removeFromScene(npc);
                npc.dispose();
            } catch {
                /* the engine let its players go first (leaving the space) */
            }
        },
    };
}
