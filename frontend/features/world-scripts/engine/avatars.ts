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
import type { AvatarMotion, ThingProps } from "../protocol";
import {
    avatarCatalogue,
    loadAvatarFile,
    requestPooledAvatar,
    standAvatar,
    type StandingAvatar,
} from "./facade";

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
    const catalogue = avatarCatalogue();
    return (
        (id && Object.prototype.hasOwnProperty.call(catalogue, id)
            ? catalogue[id]?.url
            : undefined) || catalogue[DEFAULT_AVATAR].url
    );
}

let count = 0;

export function createAvatar(id: string, holder: Object3D) {
    let npc: StandingAvatar | null = null;
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
        await loadAvatarFile(wanted);
        if (disposed || url !== wanted) return;
        const pooled = await requestPooledAvatar(wanted);
        if (disposed || url !== wanted) return;
        holder.getWorldPosition(at);
        npc = standAvatar({
            url: wanted,
            pooled,
            name: props.name || "",
            key,
            position: at,
            yaw: holder.rotation.y,
        });
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
            npc.setName(name);
        }
        const wanted = props.motion || "idle";
        if (wanted !== motion) {
            motion = wanted;
            npc.setMotion(wanted === "sit", EMOTE[wanted]);
        }
        const say = props.say || "";
        if (say !== said) {
            said = say;
            pendingSay = say;
        }
        const show = props.visible !== false;
        if (show !== shown) {
            shown = show;
            npc.setShown(show);
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
            npc.place(at, holder.rotation.y);
            // its label is placed a frame after it is made: speech waits for it
            if (pendingSay && npc.say(pendingSay)) pendingSay = "";
        },
        dispose() {
            disposed = true;
            remove();
        },
    };

    function remove() {
        npc?.remove();
        npc = null;
    }
}
