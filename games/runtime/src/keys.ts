/**
 * Keys and focus: which keys belong to the Oncyber page, and the gate that
 * stops game input while the visitor types in the page or a page menu is
 * open. Pure: no DOM. The browser half is keysBrowser.ts. See
 * docs/games/keys-focus.md.
 */

/** A binding as game.json declares it (same shape as `InputBinding`). */
export interface KeyBinding {
    keyboard?: string[];
    touch?: string;
    gamepad?: string;
}
export type KeyBindings = Record<string, KeyBinding>;

/**
 * Keys the page owns, by `KeyboardEvent.code`. A game never binds these.
 * Pressed while the game has focus, they are handed to the page, which
 * opens the world menu, focuses chat or toggles sound.
 */
export const RESERVED_KEYS: Readonly<Record<string, "menu" | "chat" | "mute">> =
    Object.freeze({
        Escape: "menu",
        Enter: "chat",
        NumpadEnter: "chat",
        KeyM: "mute",
    });
export type PageKeyIntent = "menu" | "chat" | "mute";

/** Messages of this area, after the `<game>:` prefix. */
export const KEY_MESSAGES = Object.freeze({
    /** game -> page: `{ code }`, a reserved key was pressed in the game. */
    key: "key",
    /** page -> game: `{ paused, reason }`. */
    input: "input",
    /** page -> game: `{ muted }`. */
    muted: "muted",
    /** page -> game: asks for `inputState` (checks only). */
    probe: "input-probe",
    /** game -> page: `{ paused, held, delivered, probe }`. */
    state: "input-state",
});

const ACTION_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/;
const KEY_CODE = /^[A-Z][A-Za-z0-9]{0,31}$/;

export interface KeyFinding {
    code: "KEY_RESERVED" | "KEY_INVALID" | "ACTION_INVALID";
    message: string;
}

/** Problems in a game's declared bindings: reserved or malformed keys. */
export function checkBindings(input: unknown): KeyFinding[] {
    const findings: KeyFinding[] = [];
    if (!input || typeof input !== "object" || Array.isArray(input))
        return [
            {
                code: "ACTION_INVALID",
                message: "game.json declares no input actions",
            },
        ];
    for (const [action, binding] of Object.entries(input as KeyBindings)) {
        if (!ACTION_NAME.test(action))
            findings.push({
                code: "ACTION_INVALID",
                message: `action name "${action}"`,
            });
        const keys = binding?.keyboard ?? [];
        if (!Array.isArray(keys)) {
            findings.push({
                code: "KEY_INVALID",
                message: `${action}.keyboard must be a list of key codes`,
            });
            continue;
        }
        for (const key of keys) {
            if (typeof key !== "string" || !KEY_CODE.test(key))
                findings.push({
                    code: "KEY_INVALID",
                    message: `${action}: "${key}" is not a KeyboardEvent.code`,
                });
            else if (Object.hasOwn(RESERVED_KEYS, key))
                findings.push({
                    code: "KEY_RESERVED",
                    message: `${action}: ${key} belongs to the page (${RESERVED_KEYS[key]})`,
                });
        }
    }
    return findings;
}

/** Key code -> the declared actions it drives. Reserved keys never map. */
export function keyMap(input: KeyBindings): Map<string, string[]> {
    const keys = new Map<string, string[]>();
    for (const [action, binding] of Object.entries(input ?? {}))
        for (const key of binding?.keyboard ?? []) {
            if (typeof key !== "string" || Object.hasOwn(RESERVED_KEYS, key))
                continue;
            keys.set(key, [...(keys.get(key) ?? []), action]);
        }
    return keys;
}

const REASON = /^[a-z][a-z0-9-]{0,23}$/;

/**
 * Why input is paused, as a set of reasons ("chat", "menu", "typing"...).
 * `paused` fires when the first reason arrives and `resumed` when the last
 * one leaves, so a game sees one clean pair however many page surfaces
 * overlap.
 */
export class InputGate {
    /** Who holds -> the reason to report. The page has one slot of its own. */
    private holds = new Map<string, string>();
    private listener: { paused?(reason: string): void; resumed?(): void };
    constructor(
        listener: { paused?(reason: string): void; resumed?(): void } = {}
    ) {
        this.listener = listener;
    }
    get paused() {
        return this.holds.size > 0;
    }
    /** The first reason still holding, or "". */
    get reason(): string {
        return this.holds.values().next().value ?? "";
    }
    private put(holder: string, reason: string) {
        const first = this.holds.size === 0;
        if (this.holds.size >= 16 && !this.holds.has(holder)) return;
        this.holds.set(holder, reason);
        if (first) this.listener.paused?.(reason);
    }
    private drop(holder: string) {
        if (this.holds.delete(holder) && !this.holds.size)
            this.listener.resumed?.();
    }
    hold(reason: string) {
        if (REASON.test(reason) && !this.holds.has(reason))
            this.put(reason, reason);
    }
    release(reason: string) {
        this.drop(reason);
    }
    /** The page's word. Each message replaces what the page said before. */
    set(paused: boolean, reason = "page") {
        if (paused) this.put("@page", REASON.test(reason) ? reason : "page");
        else this.drop("@page");
    }
}

/**
 * Held actions and the keys holding them. Two keys bound to one action
 * (W and ArrowUp) keep it down until both are up; pausing lets go of
 * everything and reports each action that was down.
 */
export class HeldActions {
    private keys = new Map<string, string[]>();
    private down = new Map<string, Set<string>>();
    delivered = 0;
    constructor(input: KeyBindings) {
        this.keys = keyMap(input);
    }
    bound(code: string) {
        return this.keys.has(code);
    }
    /** Actions that changed: `[action, 1]` on press, `[action, 0]` on release. */
    key(code: string, pressed: boolean): Array<[string, number]> {
        const changes: Array<[string, number]> = [];
        for (const action of this.keys.get(code) ?? []) {
            const holders = this.down.get(action) ?? new Set<string>();
            const was = holders.size > 0;
            if (pressed) holders.add(code);
            else holders.delete(code);
            if (holders.size) this.down.set(action, holders);
            else this.down.delete(action);
            if (was !== holders.size > 0)
                changes.push([action, pressed ? 1 : 0]);
        }
        this.delivered += changes.length;
        return changes;
    }
    held() {
        return [...this.down.keys()];
    }
    /** Lets go of everything; the caller sends each as a release. */
    releaseAll(): string[] {
        const actions = this.held();
        this.down.clear();
        return actions;
    }
}
