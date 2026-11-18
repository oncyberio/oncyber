import { decodeRecipe } from "./codec";
import { isAuthoredAvatarId } from "./authored/catalogue";
import { authoredAvatarUrl, toonAvatarUrl } from "./url";

/**
 * The avatar a visitor last finished in the maker, kept in this browser so
 * the lobby can offer it without an account. `wear` asks the lobby to put it
 * on the next time it opens.
 */
export type SavedToonAvatar = {
    code: string;
    /** Set when the avatar is an authored one (with `code` as its sliders). */
    id?: string;
    /** Small portrait (data URL) for pickers. */
    image?: string;
    wear?: boolean;
};

const KEY = "oncyber:toon-avatar";
const DRAFT_KEY = "oncyber:toon-avatar-draft";
const MAX_IMAGE = 200_000;

export const TOON_AVATAR_NAME = "My avatar";

export function readSavedToonAvatar(): SavedToonAvatar | null {
    try {
        const stored = JSON.parse(localStorage.getItem(KEY) || "null");
        if (!stored || !decodeRecipe(stored.code)) return null;
        const image =
            typeof stored.image === "string" &&
            stored.image.startsWith("data:image/") &&
            stored.image.length <= MAX_IMAGE
                ? stored.image
                : undefined;
        return {
            code: stored.code,
            id: isAuthoredAvatarId(stored.id) ? stored.id : undefined,
            image,
            wear: stored.wear === true,
        };
    } catch {
        return null;
    }
}

export function saveToonAvatar(avatar: SavedToonAvatar) {
    try {
        const image =
            avatar.image && avatar.image.length <= MAX_IMAGE
                ? avatar.image
                : undefined;
        localStorage.setItem(KEY, JSON.stringify({ ...avatar, image }));
    } catch {
        // Private browsing or a full disk: the avatar still works this visit.
    }
}

/** The saved avatar as a lobby choice, clearing the request to wear it. */
export function takeWornToonAvatar() {
    const saved = readSavedToonAvatar();
    if (!saved?.wear) return null;
    saveToonAvatar({ ...saved, wear: false });
    return savedToonChoice(saved);
}

export function savedToonChoice(saved: SavedToonAvatar) {
    const url = saved.id
        ? authoredAvatarUrl(saved.id, saved.code)
        : toonAvatarUrl(saved.code);
    return { id: url, name: TOON_AVATAR_NAME, url, img: saved.image };
}

export function readToonDraft(): string | null {
    try {
        const code = localStorage.getItem(DRAFT_KEY);
        return decodeRecipe(code) ? code : null;
    } catch {
        return null;
    }
}

export function saveToonDraft(code: string) {
    try {
        localStorage.setItem(DRAFT_KEY, code);
    } catch {
        // Nothing to do: the address bar still carries the avatar.
    }
}
