import {
    HeldActions,
    InputGate,
    KEY_MESSAGES,
    RESERVED_KEYS,
    type KeyBindings,
} from "./keys.ts";

/**
 * The one place a game's keyboard is read. A game calls `bindPageKeys` with
 * the actions it declared in game.json and gets them back as
 * `action(name, value)`; it adds no key listeners of its own. Keys the page
 * reserves are handed to the page. While the visitor types in the page or a
 * page menu is open the game gets `paused(reason)`, no actions, and then
 * `resumed()`. See docs/games/keys-focus.md.
 */
export interface PageKeysOptions {
    /** The game's id: without `prefix`, messages are `<game>:<kind>`. */
    game: string;
    /**
     * The message prefix. A game on the one contract passes
     * `GAME_MESSAGE_PREFIX` (contract.ts), so its messages are
     * `oncyber:game:<kind>`; a build from before the contract leaves it out.
     */
    prefix?: string;
    /** The declared actions (game.json `runtime.input`, or `input`). */
    input: KeyBindings;
    /** A declared action went down (1) or up (0). Never called while paused. */
    action(name: string, value: number): void;
    /** Input paused: every held action was already released with `action(name, 0)`. */
    paused?(reason: string): void;
    resumed?(): void;
    /**
     * The page turned sound off or on. Only for a build from before the
     * sound output (audio.ts), which hears the same setting as `audio`.
     */
    muted?(muted: boolean): void;
    /** Facts for checks, e.g. `{ position: [x, y, z] }`. */
    probe?(): unknown;
    /** Where the page is. A nested UI frame passes its own relay (see `relayPageKeys`). */
    post?(message: object): void;
    /** Test seams. */
    window?: Window;
    document?: Document;
}

export interface PageKeys {
    readonly paused: boolean;
    /** Pause from inside the game (its own modal). Same gate as the page's. */
    hold(reason: string): void;
    release(reason: string): void;
    /**
     * Take the pointer lock through here, never with requestPointerLock
     * directly: the lock is given up while input is paused and taken back
     * on the visitor's next click after it resumes.
     */
    lockPointer(element: Element): void;
    unlockPointer(): void;
    dispose(): void;
}

const typing = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return (
        !!el &&
        typeof el.tagName === "string" &&
        (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
    );
};

export function bindPageKeys(options: PageKeysOptions): PageKeys {
    const win = options.window ?? window;
    const doc = options.document ?? win.document;
    const prefix = options.prefix ?? `${options.game}:`;
    const post =
        options.post ??
        ((message: object) => {
            if (win.parent !== win) win.parent.postMessage(message, "*");
        });
    const held = new HeldActions(options.input);
    let lockWanted: Element | null = null;
    let leavingLock = false;
    let disposed = false;
    const letGo = () => {
        for (const action of held.releaseAll()) options.action(action, 0);
    };
    const gate = new InputGate({
        paused(reason) {
            letGo();
            // The page needs the cursor for its menu or chat.
            if (doc.pointerLockElement) {
                leavingLock = true;
                doc.exitPointerLock?.();
            }
            options.paused?.(reason);
        },
        resumed() {
            options.resumed?.();
        },
    });
    const key = (event: KeyboardEvent) => {
        if (typing(event.target) || event.isComposing) return;
        const pressed = event.type === "keydown";
        if (Object.hasOwn(RESERVED_KEYS, event.code)) {
            // The page decides what its keys do, paused or not.
            event.preventDefault();
            if (pressed && !event.repeat)
                post({ type: prefix + KEY_MESSAGES.key, code: event.code });
            return;
        }
        if (
            !held.bound(event.code) ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        ) {
            // A modifier chord is the browser's; let go of the key if it was down.
            if (!pressed)
                for (const [action, value] of held.key(event.code, false))
                    options.action(action, value);
            return;
        }
        event.preventDefault();
        if (gate.paused || (pressed && event.repeat)) return;
        for (const [action, value] of held.key(event.code, pressed))
            options.action(action, value);
    };
    // Focus left the frame: the key-up will never arrive.
    const blur = () => letGo();
    const message = (event: MessageEvent) => {
        if (event.source !== win.parent) return;
        const data = event.data;
        const type =
            typeof data?.type === "string" && data.type.startsWith(prefix)
                ? data.type.slice(prefix.length)
                : "";
        if (type === KEY_MESSAGES.input)
            gate.set(
                data.paused === true,
                typeof data.reason === "string" ? data.reason : "page"
            );
        else if (type === KEY_MESSAGES.muted)
            options.muted?.(data.muted === true);
        else if (type === KEY_MESSAGES.probe) {
            let probe: unknown = null;
            try {
                probe = options.probe?.() ?? null;
            } catch {
                /* a failing probe reports nothing */
            }
            post({
                type: prefix + KEY_MESSAGES.state,
                paused: gate.paused,
                reason: gate.reason,
                held: held.held(),
                delivered: held.delivered,
                locked: !!doc.pointerLockElement,
                probe,
            });
        }
    };
    const lockChange = () => {
        if (doc.pointerLockElement) return;
        const ours = leavingLock;
        leavingLock = false;
        // The browser took the lock back on Escape and kept the key event:
        // tell the page, as if Escape had been pressed.
        if (!ours && lockWanted && !gate.paused)
            post({ type: prefix + KEY_MESSAGES.key, code: "Escape" });
    };
    // Browsers only grant the lock on a gesture, so take it back on the
    // first click after input resumes.
    const pointerDown = () => {
        if (
            lockWanted &&
            !gate.paused &&
            !doc.pointerLockElement &&
            lockWanted.isConnected !== false
        )
            request(lockWanted);
    };
    const request = (element: Element) => {
        try {
            const result = (element as any).requestPointerLock?.();
            if (result && typeof result.catch === "function")
                result.catch(() => {});
        } catch {
            /* not allowed right now; the next click asks again */
        }
    };
    win.addEventListener("keydown", key);
    win.addEventListener("keyup", key);
    win.addEventListener("blur", blur);
    win.addEventListener("message", message);
    win.addEventListener("pointerdown", pointerDown);
    doc.addEventListener("pointerlockchange", lockChange);
    return {
        get paused() {
            return gate.paused;
        },
        hold: (reason) => gate.hold(reason),
        release: (reason) => gate.release(reason),
        lockPointer(element) {
            lockWanted = element;
            if (!gate.paused) request(element);
        },
        unlockPointer() {
            lockWanted = null;
            if (doc.pointerLockElement) {
                leavingLock = true;
                doc.exitPointerLock?.();
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            letGo();
            win.removeEventListener("keydown", key);
            win.removeEventListener("keyup", key);
            win.removeEventListener("blur", blur);
            win.removeEventListener("message", message);
            win.removeEventListener("pointerdown", pointerDown);
            doc.removeEventListener("pointerlockchange", lockChange);
        },
    };
}

/** What `bindSessionKeys` needs from a `RuntimeSession`. */
interface KeySession {
    phase: string;
    action(action: string, value?: number): void;
    setInputPaused(paused: boolean, reason?: string): void;
    inspect(): unknown;
}

/** For games on the lifecycle: keys drive the session's declared actions. */
export function bindSessionKeys(
    session: KeySession,
    /**
     * `paused` and `resumed` run after the session's input has stopped or
     * started again: a game whose solo play stands still while the visitor
     * types holds its one pause there (pausing.ts, reason "input").
     */
    options: Omit<PageKeysOptions, "action" | "probe"> &
        Partial<Pick<PageKeysOptions, "probe">>
): PageKeys {
    return bindPageKeys({
        probe: () => session.inspect(),
        ...options,
        action(name, value) {
            if (session.phase === "entered") session.action(name, value);
        },
        paused(reason) {
            session.setInputPaused(true, reason);
            options.paused?.(reason);
        },
        resumed() {
            session.setInputPaused(false);
            options.resumed?.();
        },
    });
}

/**
 * For a game whose interface is a nested frame: passes that frame's
 * reserved keys up to the page and the page's pause and sound state down.
 * In the nested frame, call `bindPageKeys` as usual.
 */
export function relayPageKeys(
    frame: HTMLIFrameElement,
    game: string,
    win: Window = window,
    /** A game on the one contract passes `GAME_MESSAGE_PREFIX`. */
    prefix = `${game}:`
) {
    const down = new Set(
        [KEY_MESSAGES.input, KEY_MESSAGES.muted].map((kind) => prefix + kind)
    );
    const relay = (event: MessageEvent) => {
        const type = event.data?.type;
        if (typeof type !== "string") return;
        if (event.source === frame.contentWindow) {
            if (
                type === prefix + KEY_MESSAGES.key &&
                Object.hasOwn(RESERVED_KEYS, event.data.code) &&
                win.parent !== win
            )
                win.parent.postMessage({ type, code: event.data.code }, "*");
        } else if (
            event.source === win.parent &&
            win.parent !== win &&
            down.has(type)
        ) {
            frame.contentWindow?.postMessage(
                {
                    type,
                    paused: event.data.paused === true,
                    reason: String(event.data.reason ?? "page").slice(0, 24),
                    muted: event.data.muted === true,
                },
                "*"
            );
        }
    };
    win.addEventListener("message", relay);
    return () => win.removeEventListener("message", relay);
}
