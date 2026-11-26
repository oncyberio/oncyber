/**
 * Changing avatar from inside a frame (a world, a game): the page's part.
 *
 * What runs in a frame cannot reach the account, so it does not keep the
 * list of a visitor's avatars or save their choice. It asks the page for
 * the picker (`avatar-picker`, saying which avatar it wears now if it
 * likes), the page shows its own, saves the choice
 * to the account, and tells the frame what was chosen (`avatar`). The
 * frame's only job is to wear it. One picker, the lobby's, for everything
 * the site frames.
 *
 * This file is the pure part: the two messages and the saved setting.
 */
import type { TravelAvatar } from "@utils/travelAvatar";

/** What a frame says to ask for the picker. */
export const AVATAR_PICKER_KIND = "avatar-picker";
/** What the page says when the visitor has chosen. */
export const AVATAR_KIND = "avatar";

/**
 * The avatar a frame says it is wearing when it asks for the picker, so
 * the picker opens on it. Optional: the page knows the saved avatar and
 * the one chosen this visit, but not a default the frame picked itself.
 */
export function readPickerRequest(message: any): { wearing?: string } {
    const wearing = message?.avatarId;
    return typeof wearing === "string" && wearing && wearing.length <= 200
        ? { wearing }
        : {};
}

/** The `avatar` message for a choice: public presentation only. */
export function avatarMessage(avatar: TravelAvatar) {
    return {
        avatarUrl: avatar.url,
        avatarId: avatar.id,
        avatarName: avatar.name || "Avatar",
        ...(typeof avatar.scale === "number"
            ? { avatarScale: avatar.scale }
            : {}),
    };
}

const text = (value: unknown, max: number) =>
    typeof value === "string" && value && value.length <= max ? value : "";

/**
 * The frame's side: the avatar in an `avatar` message, or null. The model
 * is a web address or a path of the site; anything else names no avatar.
 */
export function readAvatarMessage(
    message: any,
    origin: string
): TravelAvatar | null {
    const address = text(message?.avatarUrl, 2048);
    if (!address) return null;
    let url: URL;
    try {
        url = new URL(address, origin);
    } catch {
        return null;
    }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password)
        return null;
    const scale = message.avatarScale;
    return {
        id: text(message.avatarId, 200) || url.href,
        name: text(message.avatarName, 120) || "Avatar",
        url: url.href,
        ...(typeof scale === "number" && scale > 0 && scale <= 4
            ? { scale }
            : {}),
    };
}

/**
 * The account's settings with this avatar as the saved one. Null when
 * there is nothing to save: it is already the saved one, or it is an
 * avatar held in a wallet, which is known by its model's address and has
 * no id a setting can hold (it is worn for the visit all the same).
 */
export function settingsWithAvatar(
    settings: Record<string, unknown> | null | undefined,
    avatar: TravelAvatar
): Record<string, unknown> | null {
    if (!avatar.id || /^[a-z]+:\/\//i.test(avatar.id)) return null;
    if (settings?.vrm === avatar.id) return null;
    return { ...(settings || {}), vrm: avatar.id };
}
