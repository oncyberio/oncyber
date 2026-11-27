/**
 * Changing avatar from inside a game: the game's side.
 *
 * A game runs in a frame with no account, so it does not list the visitor's
 * avatars, draw a picker or save a choice. It asks the page for the picker
 * (`avatar-picker`); the page shows its own, the lobby's, saves what the
 * visitor chooses to their account, and says what it was (`avatar`). The
 * game's only job is to wear it: with the avatar kit, `kit.wear(avatar.url)`.
 *
 *     const avatars = connectAvatar();
 *     avatars.on((avatar) => kit.wear(avatar.url));
 *     button.onclick = () => avatars.ask();
 *
 * No imports of the DOM beyond `window`: pure readers first, then the
 * connection. The page's side is frontend/features/avatar-picker; both
 * answer the cases in games/runtime/test/contract.fixtures.json the same
 * way. See docs/games/avatar-kit.md.
 */
import { GAME_MESSAGE_PREFIX } from "./contract.ts";

/** What a game says to ask for the page's picker. No payload. */
export const AVATAR_PICKER_KIND = "avatar-picker";
/** What the page says when the visitor has chosen. */
export const AVATAR_KIND = "avatar";

/** The avatar a visitor chose: public presentation only. */
export interface PageAvatar {
    /** The page's id for it, or its address when it has none. */
    id: string;
    name: string;
    /** The model's address, absolute. Hand it to the avatar kit. */
    url: string;
    /** The size the visitor set for it (above 0, at most 4), if any. */
    scale?: number;
}

const text = (value: unknown, max: number) =>
    typeof value === "string" && value && value.length <= max ? value : "";

/**
 * The avatar in an `avatar` message, or null. The model is a web address,
 * or a path of the site (read against `origin`); anything else names no
 * avatar. The same rules as the page's own reader.
 */
export function readAvatarMessage(
    message: any,
    origin: string
): PageAvatar | null {
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
 * The game's connection to the page's avatar picker. Embedded, `ask()`
 * opens the picker and `on()` hears each choice; standalone (a dev server)
 * there is no page, so `ask()` answers false and nothing is ever heard:
 * hide the game's own button when `available` is false.
 */
export function connectAvatar(
    options: {
        /** The form the game speaks; the one prefix unless it is an old build's. */
        prefix?: string;
        /** For tests: the window to talk through. */
        window?: Window;
    } = {}
) {
    const win = options.window ?? window;
    const prefix = options.prefix ?? GAME_MESSAGE_PREFIX;
    const embedded = win.parent !== win;
    const listeners = new Set<(avatar: PageAvatar) => void>();
    let current: PageAvatar | null = null;
    // The frame's address shares the page's origin even though its own
    // origin is opaque: only the page is heard, and only it is told.
    const receive = (event: MessageEvent) => {
        if (event.source !== win.parent || event.origin !== win.location.origin)
            return;
        if (event.data?.type !== prefix + AVATAR_KIND) return;
        const avatar = readAvatarMessage(event.data, win.location.origin);
        if (!avatar) return;
        current = avatar;
        for (const listener of [...listeners]) listener(avatar);
    };
    if (embedded) win.addEventListener("message", receive);
    return {
        /** False when there is no page to show a picker. */
        available: embedded,
        /** The last avatar the visitor chose during this visit, or null. */
        get current() {
            return current;
        },
        /**
         * Asks the page to show its picker. Returns false when there is no
         * page. The answer, if the visitor chooses, comes through `on`.
         */
        ask(): boolean {
            if (!embedded) return false;
            win.parent.postMessage(
                { type: prefix + AVATAR_PICKER_KIND },
                win.location.origin
            );
            return true;
        },
        /** Calls `listener` with each avatar the visitor chooses; returns the unsubscribe. */
        on(listener: (avatar: PageAvatar) => void): () => void {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        dispose() {
            listeners.clear();
            if (embedded) win.removeEventListener("message", receive);
        },
    };
}
export type GameAvatarClient = ReturnType<typeof connectAvatar>;
