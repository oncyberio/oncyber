import type * as THREE from "three/webgpu";
import { LOBBY_GUEST_PORTRAIT } from "../lobbyIdentity";
import {
    createNameTags as createSharedNameTags,
    type NameTags as SharedNameTags,
} from "@features/name-tags/nameTags";

/**
 * Lobby name tags: the shared tags (features/name-tags), with the lobby's
 * guest portrait for visitors without a photo. Written every frame from the
 * rendered avatar positions.
 */
export function createNameTags(scene: THREE.Scene, capacity = 64) {
    const tags = createSharedNameTags(scene, capacity, {
        // Only fades when it would fill the view; tags stay up close.
        closeFade: [0.4, 1],
        fallbackPhoto: LOBBY_GUEST_PORTRAIT,
    });
    const show = tags.show;
    return Object.assign(tags, {
        show(
            id: string,
            name: string,
            photo: string,
            x: number,
            y: number,
            z: number,
            pinned = false
        ) {
            // A visitor without a photo still gets a portrait bubble.
            show(id, name, photo || LOBBY_GUEST_PORTRAIT, x, y, z, pinned);
        },
    });
}

export type NameTags = SharedNameTags;
