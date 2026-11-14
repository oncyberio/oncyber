/**
 * The page's half of keys and focus for games (docs/games/keys-focus.md).
 * The page owns Escape (world menu), Enter (chat) and M (sound). A game
 * hands those keys over when it has focus, and gets no input while the
 * visitor types in the page or a page menu is open.
 *
 * No imports and no framework: the games check loads this file as it is
 * (scripts/games/keysCheck.mjs), so the check exercises the code the site
 * runs.
 */

/** Keys the page owns, by `KeyboardEvent.code`. Same table as games/runtime/src/keys.ts. */
export const GAME_RESERVED_KEYS: Readonly<
    Record<string, "menu" | "chat" | "mute">
> = Object.freeze({
    Escape: "menu",
    Enter: "chat",
    NumpadEnter: "chat",
    KeyM: "mute",
});
export type GameKeyIntent = "menu" | "chat" | "mute";

/** Marks the field Enter focuses. Any text field pauses game input. */
export const GAME_CHAT_ATTRIBUTE = "data-game-chat";

/** True for an element the visitor types into. */
export function isTypingTarget(target: unknown): boolean {
    const element = target as {
        tagName?: unknown;
        isContentEditable?: boolean;
        type?: unknown;
        readOnly?: boolean;
        disabled?: boolean;
    } | null;
    if (!element || typeof element.tagName !== "string") return false;
    if (element.isContentEditable) return true;
    if (element.disabled || element.readOnly) return false;
    if (element.tagName === "TEXTAREA" || element.tagName === "SELECT")
        return true;
    if (element.tagName !== "INPUT") return false;
    // Buttons, checkboxes and sliders take no text.
    return !/^(button|checkbox|radio|range|submit|reset|file|image|color)$/.test(
        String(element.type ?? "text")
    );
}

export interface GameInputHostOptions {
    /** The game's id: messages are `<game>:<kind>`. */
    game: string;
    /** Posts to the game's frame. */
    send(message: object): void;
    /** Gives keyboard focus back to the game's frame. */
    focusGame(): void;
    /** A page key was pressed, in the game or in the page. */
    intent(intent: GameKeyIntent): void;
    muted?: boolean;
}

export interface GameInputHost {
    readonly paused: boolean;
    readonly reason: string;
    readonly muted: boolean;
    /** Pause game input for a page surface ("menu", "chat"...). */
    hold(reason: string): void;
    /** Let go; when nothing else holds, the game resumes and gets focus. */
    release(reason: string): void;
    /** `tell: false` records what the game itself chose, without echoing it. */
    setMuted(muted: boolean, tell?: boolean): void;
    /** A message from the game's frame. True when it was one of ours. */
    receive(data: unknown): boolean;
    /** Tell the game the current state again (it just loaded). */
    sync(): void;
    /**
     * Watch a document of the page: typing in any text field pauses the
     * game, and the page's keys work when the page has focus. `keys: false`
     * watches typing only (a parent page with its own shortcuts).
     */
    watch(document: Document, options?: { keys?: boolean }): () => void;
}

export function createGameInputHost(
    options: GameInputHostOptions
): GameInputHost {
    const prefix = `${options.game}:`;
    const holds = new Set<string>();
    let muted = options.muted === true;
    let told: string | null = null;
    const reason = () => (holds.values().next().value as string) ?? "";
    // Only changes go to the game: one message per pause, reason or resume.
    const tell = () => {
        const state = holds.size ? reason() : "";
        if (state === told) return;
        told = state;
        options.send({
            type: `${prefix}input`,
            paused: holds.size > 0,
            reason: state,
        });
    };
    const host: GameInputHost = {
        get paused() {
            return holds.size > 0;
        },
        get reason() {
            return reason();
        },
        get muted() {
            return muted;
        },
        hold(why) {
            if (!/^[a-z][a-z0-9-]{0,23}$/.test(why)) return;
            holds.add(why);
            tell();
        },
        release(why) {
            if (!holds.delete(why)) return;
            tell();
            if (!holds.size) options.focusGame();
        },
        setMuted(next, tell = true) {
            muted = next === true;
            if (tell) options.send({ type: `${prefix}muted`, muted });
        },
        receive(data) {
            const message = data as { type?: unknown; code?: unknown } | null;
            if (message?.type !== `${prefix}key`) return false;
            const code = message.code;
            if (
                typeof code === "string" &&
                Object.prototype.hasOwnProperty.call(GAME_RESERVED_KEYS, code)
            )
                options.intent(GAME_RESERVED_KEYS[code]);
            return true;
        },
        sync() {
            told = null;
            tell();
            options.send({ type: `${prefix}muted`, muted });
        },
        watch(document, { keys = true } = {}) {
            const focus = () => {
                if (isTypingTarget(document.activeElement)) host.hold("typing");
                else host.release("typing");
            };
            const key = (event: KeyboardEvent) => {
                if (event.repeat || event.isComposing) return;
                const intent = GAME_RESERVED_KEYS[event.code];
                if (!intent) return;
                if (isTypingTarget(event.target)) {
                    // Escape leaves the field; every other key is text.
                    if (intent !== "menu") return;
                    event.preventDefault();
                    (event.target as HTMLElement).blur?.();
                    if (!holds.size) options.focusGame();
                    return;
                }
                // Enter on a focused button presses that button.
                if (
                    intent === "chat" &&
                    /^(BUTTON|A|SUMMARY)$/.test(
                        String((event.target as HTMLElement)?.tagName)
                    )
                )
                    return;
                event.preventDefault();
                options.intent(intent);
            };
            document.addEventListener("focusin", focus);
            document.addEventListener("focusout", focusSoon);
            if (keys) document.addEventListener("keydown", key);
            // focusout fires before the next element has focus.
            let timer: ReturnType<typeof setTimeout> | undefined;
            function focusSoon() {
                clearTimeout(timer);
                timer = setTimeout(focus, 0);
            }
            focus();
            return () => {
                clearTimeout(timer);
                document.removeEventListener("focusin", focus);
                document.removeEventListener("focusout", focusSoon);
                document.removeEventListener("keydown", key);
                host.release("typing");
            };
        },
    };
    return host;
}

/** Focuses the page's chat field, if it has one. */
export function focusGameChat(document: Document): boolean {
    const field = document.querySelector<HTMLElement>(
        `[${GAME_CHAT_ATTRIBUTE}]`
    );
    if (!field) return false;
    field.focus();
    return document.activeElement === field;
}
