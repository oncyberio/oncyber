/**
 * Avatars a world script places: one of Oncyber's own, standing in the
 * world with a name over its head. They are made the way other visitors'
 * avatars are (the engine's player factory), so they look and move the
 * same, but they belong to no one: nothing about them leaves this browser.
 *
 * Only avatars from the built-in catalogue can be asked for, by id; a
 * script cannot make the page fetch a file of its choosing.
 */
import { Vector3, type Object3D } from "three";
import Scene from "@3/three/scene";
import Players from "@3/three/factory/player";
import GLTF from "@3/three/gltf";
import VRMS from "@3/three/factory/player/vrms.json";
import {
    CURRENT_SPACE,
    DEFAULT_PLAYER_AVATAR_PICTURE,
} from "@3/three/constants";
import {
    UPDATE_CHAT,
    UPDATE_USERNAME,
} from "@3/three/factory/player/constants";
import type { AvatarMotion, ThingProps } from "../protocol";

/** Each motion as the engine's emote number; idle is no emote. */
const EMOTE: Record<AvatarMotion, number> = {
    idle: -1,
    wave: 0,
    dance: 1,
    shuffle: 4,
    pray: 9,
    sit: 12,
};
const DEFAULT_AVATAR = "sunshine";

/** The catalogue's file for an avatar id, or the default avatar's. */
export function avatarUrl(id: string | undefined): string {
    const catalogue = VRMS as Record<string, { url?: string }>;
    return (
        (id && Object.prototype.hasOwnProperty.call(catalogue, id)
            ? catalogue[id]?.url
            : undefined) || catalogue[DEFAULT_AVATAR].url
    );
}

let count = 0;

export function createAvatar(id: string, holder: Object3D) {
    let npc: any = null;
    let disposed = false;
    let url = "";
    let props: ThingProps = {};
    let named = "";
    let said = "";
    let motion: AvatarMotion | undefined;
    let pendingSay = "";
    let shown = true;
    const at = new Vector3();
    const key = `script-avatar-${++count}`;

    async function load(wanted: string) {
        url = wanted;
        const gltf = GLTF as any;
        if (gltf[wanted] == null)
            await gltf.loadOnce({ name: wanted, url: wanted });
        if (disposed || url !== wanted) return;
        const userData: Record<string, unknown> = {
            avatar: DEFAULT_PLAYER_AVATAR_PICTURE,
            username: props.name || "",
            walletId: "",
            isAdmin: false,
            VRM: wanted,
            HIGH_VRM: wanted,
        };
        // an avatar with moving hair and cloth is drawn from a pool
        if (gltf[wanted]?.isHighQuality) {
            const pooled = await gltf.requestPool(wanted);
            if (disposed || url !== wanted) return;
            pooled.scene.poolUsed = true;
            userData.VRMMeshes = pooled;
        }
        holder.getWorldPosition(at);
        const main = (Players as any).main;
        const next = (Players as any).get({
            userData,
            exhibit: { id: (CURRENT_SPACE as any)?.exhibit?.id },
            user: { id: key },
            sessionId: key,
            roomParameters: { user_height: 2.8 },
            position: at.clone(),
            rotation: holder.rotation.y,
            isDummy: true,
        });
        npc = next;
        (Scene as any).add(next);
        next.visible = true;
        // drawn however far the visitor is, as the world's own things are
        if (next.username?.wrapper) next.username.wrapper.ignoreLOD = true;
        if (next.avatar3D) next.avatar3D.ignoreLOD = true;
        // as tall as the visitors of this world stand
        if (typeof main?.modelScale === "number")
            next.scaleVRM(main.modelScale);
        named = "";
        said = "";
        motion = undefined;
        shown = true;
        apply();
    }

    function apply() {
        if (!npc) return;
        const name = props.name || "";
        if (name !== named) {
            named = name;
            npc.updatePlayer({
                type: UPDATE_USERNAME,
                payload: name,
                textOnly: true,
            });
        }
        const wanted = props.motion || "idle";
        if (wanted !== motion) {
            motion = wanted;
            npc.handleSit?.(wanted === "sit");
            npc.playEmote?.(EMOTE[wanted]);
        }
        const say = props.say || "";
        if (say !== said) {
            said = say;
            pendingSay = say;
        }
        const show = props.visible !== false;
        if (show !== shown) {
            shown = show;
            if (show) npc.show?.();
            else npc.hide?.();
        }
    }

    return {
        update(next: ThingProps) {
            props = next;
            const wanted = avatarUrl(next.avatar);
            if (wanted !== url) {
                remove();
                void load(wanted).catch(() => undefined);
            } else apply();
        },
        /** Once a frame: the avatar follows where the script put it. */
        frame() {
            if (!npc) return;
            holder.getWorldPosition(at);
            npc.position.copy(at);
            npc.rotation.y = holder.rotation.y;
            // its label is placed a frame after it is made: speech waits for it
            if (pendingSay && npc.username?.wrapper?.position?.y) {
                npc.updatePlayer({
                    type: UPDATE_CHAT,
                    payload: { text: pendingSay, date: "", acc_date: "" },
                });
                pendingSay = "";
            }
        },
        dispose() {
            disposed = true;
            remove();
        },
    };

    function remove() {
        if (!npc) return;
        try {
            (Scene as any).remove(npc);
            npc.dispose();
        } catch {
            /* the engine let its players go first (leaving the space) */
        }
        npc = null;
    }
}
