/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
    DEFAULT_EMOTE_SHORTCUTS,
    EMOTE_SHORTCUTS_STORAGE_KEY,
    assignEmoteShortcut,
    getEmoteShortcutIndex,
    getEmoteShortcuts,
    isSelectableEmote,
    normalizeEmoteShortcuts,
    setEmoteShortcut,
    useEmoteShortcuts,
} from "./emoteShortcuts";

beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
        EMOTE_SHORTCUTS_STORAGE_KEY,
        JSON.stringify(DEFAULT_EMOTE_SHORTCUTS)
    );
    getEmoteShortcuts();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => jest.restoreAllMocks());

test("keeps original engine IDs when hidden animations are excluded", () => {
    expect(isSelectableEmote("SITTING")).toBe(false);
    expect(isSelectableEmote("SITTALKING")).toBe(false);
    expect(isSelectableEmote("FLOORSITTING")).toBe(true);
    expect(getEmoteShortcuts()).toEqual(DEFAULT_EMOTE_SHORTCUTS);
    setEmoteShortcut(0, "FLOORSITTING");
    expect(getEmoteShortcutIndex(0)).toBe(13);
    expect(getEmoteShortcutIndex(9)).toBe(-1);
    expect(getEmoteShortcutIndex(-1)).toBe(-1);
});

test("replaces a slot or swaps an already assigned move without duplicates", () => {
    const replaced = assignEmoteShortcut(DEFAULT_EMOTE_SHORTCUTS, 0, "PRAYING");
    expect(replaced[0]).toBe("PRAYING");
    expect(replaced.slice(1)).toEqual(DEFAULT_EMOTE_SHORTCUTS.slice(1));
    const swapped = assignEmoteShortcut(replaced, 8, "PRAYING");
    expect(swapped[8]).toBe("PRAYING");
    expect(swapped[0]).toBe("DEATH");
    expect(new Set(swapped).size).toBe(9);
    expect(assignEmoteShortcut(swapped, 8, "SITTING")).toBe(swapped);
    expect(assignEmoteShortcut(swapped, NaN, "WAVING")).toBe(swapped);
    expect(DEFAULT_EMOTE_SHORTCUTS[0]).toBe("WAVING");
});

test("repairs duplicate, removed, unknown and malformed saved slots", () => {
    const repaired = normalizeEmoteShortcuts([
        "PRAYING",
        "PRAYING",
        "SITTING",
        "SITTALKING",
        null,
        "UNKNOWN",
        "FLOORSITTING",
    ]);
    expect(repaired).toHaveLength(9);
    expect(repaired[0]).toBe("PRAYING");
    expect(repaired[6]).toBe("FLOORSITTING");
    expect(repaired.every(isSelectableEmote)).toBe(true);
    expect(new Set(repaired).size).toBe(9);
    window.localStorage.setItem(EMOTE_SHORTCUTS_STORAGE_KEY, "invalid JSON");
    expect(getEmoteShortcuts()).toEqual(DEFAULT_EMOTE_SHORTCUTS);
    expect(normalizeEmoteShortcuts({})).toBe(DEFAULT_EMOTE_SHORTCUTS);
});

test("persists assignments and reads newer assignments without reopening the picker", () => {
    setEmoteShortcut(1, "CRIP");
    expect(
        JSON.parse(window.localStorage.getItem(EMOTE_SHORTCUTS_STORAGE_KEY))[1]
    ).toBe("CRIP");
    expect(getEmoteShortcutIndex(1)).toBe(11);
    const next = [...DEFAULT_EMOTE_SHORTCUTS];
    next[1] = "WANNAROCK";
    window.localStorage.setItem(
        EMOTE_SHORTCUTS_STORAGE_KEY,
        JSON.stringify(next)
    );
    expect(getEmoteShortcutIndex(1)).toBe(10);
    expect(getEmoteShortcuts()).toBe(getEmoteShortcuts());
});

test("keeps the preference usable when browser storage writes are blocked", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage unavailable");
    });
    setEmoteShortcut(0, "PRAYING");
    expect(getEmoteShortcuts()[0]).toBe("PRAYING");
    expect(getEmoteShortcutIndex(0)).toBe(9);
});

test("updates all mounted pickers for local and other-tab changes", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const Picker = () => <span>{useEmoteShortcuts().shortcuts[0]}</span>;
    act(() =>
        root.render(
            <>
                <Picker />
                <Picker />
            </>
        )
    );
    act(() => setEmoteShortcut(0, "PRAYING"));
    expect(container.textContent).toBe("PRAYINGPRAYING");
    window.localStorage.removeItem(EMOTE_SHORTCUTS_STORAGE_KEY);
    act(() =>
        window.dispatchEvent(
            new StorageEvent("storage", { key: EMOTE_SHORTCUTS_STORAGE_KEY })
        )
    );
    expect(container.textContent).toBe("WAVINGWAVING");
    act(() => root.unmount());
});
