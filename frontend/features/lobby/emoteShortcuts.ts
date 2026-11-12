import { useSyncExternalStore } from "react";
import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";

export const EMOTE_SHORTCUTS_STORAGE_KEY = "oncyber:emote-shortcuts:v1";
export const EMOTE_SHORTCUTS_CHANGED_EVENT = "oncyber:emote-shortcuts-changed";
export const EMOTE_SHORTCUT_COUNT = 9;
const selectable = EMOTES.map(({ name }) => name).filter(
    (name) => name !== "SITTING" && name !== "SITTALKING"
);
const selectableSet = new Set<string>(selectable);
export const isSelectableEmote = (name: unknown): name is string =>
    typeof name === "string" && selectableSet.has(name);
export const DEFAULT_EMOTE_SHORTCUTS: readonly string[] = Object.freeze(
    selectable.slice(0, EMOTE_SHORTCUT_COUNT)
);

// Store names rather than engine indices: hiding a library item must never
// renumber the animation IDs sent to the avatar or other players.
export function normalizeEmoteShortcuts(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return DEFAULT_EMOTE_SHORTCUTS;
    const used = new Set<string>();
    const result = Array.from({ length: EMOTE_SHORTCUT_COUNT }, (_, slot) => {
        const name = value[slot];
        if (!isSelectableEmote(name) || used.has(name)) return undefined;
        used.add(name);
        return name;
    });
    for (let slot = 0; slot < result.length; slot++) {
        if (result[slot]) continue;
        const fallback = DEFAULT_EMOTE_SHORTCUTS[slot];
        const name = !used.has(fallback)
            ? fallback
            : selectable.find((candidate) => !used.has(candidate));
        result[slot] = name;
        used.add(name);
    }
    return Object.freeze(result);
}

export function assignEmoteShortcut(
    shortcuts: readonly string[],
    slot: number,
    name: string
): readonly string[] {
    if (
        !Number.isInteger(slot) ||
        slot < 0 ||
        slot >= EMOTE_SHORTCUT_COUNT ||
        !isSelectableEmote(name) ||
        shortcuts[slot] === name
    )
        return shortcuts;
    const next = [...normalizeEmoteShortcuts(shortcuts)];
    const previous = next.indexOf(name);
    if (previous >= 0) next[previous] = next[slot];
    next[slot] = name;
    return Object.freeze(next);
}

let snapshot = DEFAULT_EMOTE_SHORTCUTS;
let lastRaw: string | null | undefined;

export function getEmoteShortcuts(): readonly string[] {
    if (typeof window === "undefined") return DEFAULT_EMOTE_SHORTCUTS;
    try {
        const raw = window.localStorage.getItem(EMOTE_SHORTCUTS_STORAGE_KEY);
        if (raw !== lastRaw) {
            lastRaw = raw;
            let parsed: unknown;
            try {
                parsed = raw === null ? undefined : JSON.parse(raw);
            } catch {}
            snapshot = normalizeEmoteShortcuts(parsed);
        }
    } catch {
        // Private/storage-restricted contexts keep assignments for this session.
    }
    return snapshot;
}

/** Zero-based shortcut slot -> original native animation index. */
export function getEmoteShortcutIndex(slot: number): number {
    if (!Number.isInteger(slot) || slot < 0 || slot >= EMOTE_SHORTCUT_COUNT)
        return -1;
    const name = getEmoteShortcuts()[slot];
    return EMOTES.findIndex((emote) => emote.name === name);
}

export function setEmoteShortcut(slot: number, name: string) {
    if (typeof window === "undefined") return;
    const current = getEmoteShortcuts();
    const next = assignEmoteShortcut(current, slot, name);
    if (next === current) return;
    snapshot = next;
    try {
        const raw = JSON.stringify(next);
        window.localStorage.setItem(EMOTE_SHORTCUTS_STORAGE_KEY, raw);
        lastRaw = raw;
    } catch {}
    window.dispatchEvent(new Event(EMOTE_SHORTCUTS_CHANGED_EVENT));
}

const subscribe = (notify: () => void) => {
    const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === EMOTE_SHORTCUTS_STORAGE_KEY) {
            lastRaw = undefined;
            notify();
        }
    };
    window.addEventListener(EMOTE_SHORTCUTS_CHANGED_EVENT, notify);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(EMOTE_SHORTCUTS_CHANGED_EVENT, notify);
        window.removeEventListener("storage", onStorage);
    };
};
const getServerSnapshot = () => DEFAULT_EMOTE_SHORTCUTS;

export function useEmoteShortcuts() {
    const shortcuts = useSyncExternalStore(
        subscribe,
        getEmoteShortcuts,
        getServerSnapshot
    );
    return { shortcuts, assignShortcut: setEmoteShortcut };
}
