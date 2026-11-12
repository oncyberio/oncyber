/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import EmotePanel from "./EmotePanel";
import {
    DEFAULT_EMOTE_SHORTCUTS,
    EMOTE_SHORTCUTS_STORAGE_KEY,
    getEmoteShortcuts,
} from "./emoteShortcuts";

jest.mock("./EmotePosePreview", () => ({
    __esModule: true,
    default: ({ name, active }) => (
        <svg data-pose={name} data-active={String(active)} />
    ),
}));

const items = [
    "WAVING",
    "HIPHOP",
    "MOONWALK",
    "TECHNO",
    "SHUFFLING",
    "CHAABI",
    "CHAABI2",
    "SEXY",
    "DEATH",
    "PRAYING",
    "WANNAROCK",
    "CRIP",
    "SITTING",
    "FLOORSITTING",
    "SITTALKING",
].map((name) => ({ name }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onSelect: jest.Mock;
let onClose: jest.Mock;
let onStop: jest.Mock;
let opener: HTMLButtonElement;
const tile = (index: number) =>
    container.querySelector<HTMLButtonElement>(`[data-emote-index="${index}"]`);
const slot = (index: number) =>
    container.querySelector<HTMLButtonElement>(
        `[data-shortcut-slot="${index}"]`
    );
const key = (target: Element, key: string, options = {}) =>
    act(() => Simulate.keyDown(target, { key, ...options }));
const click = (target: HTMLElement) => act(() => target.click());
const render = (mobile = false, source = items) =>
    act(() =>
        root.render(
            <EmotePanel
                items={source}
                mobile={mobile}
                onSelect={onSelect}
                onClose={onClose}
                onStop={onStop}
                returnFocusRef={{ current: opener }}
            />
        )
    );
const dataTransfer = () => {
    const values = new Map<string, string>();
    return {
        effectAllowed: "all",
        dropEffect: "none",
        get types() {
            return Array.from(values.keys());
        },
        setData: (type: string, value: string) => values.set(type, value),
        getData: (type: string) => values.get(type) || "",
    };
};
const drag = (source: HTMLButtonElement, destination: HTMLButtonElement) => {
    const transfer = dataTransfer();
    act(() => Simulate.dragStart(source, { dataTransfer: transfer }));
    act(() => Simulate.dragOver(destination, { dataTransfer: transfer }));
    expect(destination.dataset.dropTarget).toBe("true");
    act(() => Simulate.drop(destination, { dataTransfer: transfer }));
    act(() => Simulate.dragEnd(source, { dataTransfer: transfer }));
    return transfer;
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem(
        EMOTE_SHORTCUTS_STORAGE_KEY,
        JSON.stringify(DEFAULT_EMOTE_SHORTCUTS)
    );
    getEmoteShortcuts();
    opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onSelect = jest.fn();
    onClose = jest.fn();
    onStop = jest.fn();
    render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    opener.remove();
    localStorage.clear();
});

it("shows nine shortcuts and only the unassigned moves below, preserving Floor sitting's original engine index", () => {
    expect(container.querySelectorAll("[data-shortcut-slot]")).toHaveLength(9);
    const below = Array.from(
        container.querySelectorAll<HTMLElement>("[data-emote-library]")
    ).map((node) => node.dataset.emoteName);
    expect(below).toEqual(["PRAYING", "WANNAROCK", "CRIP", "FLOORSITTING"]);
    expect(below.some((name) => getEmoteShortcuts().includes(name))).toBe(
        false
    );
    expect(tile(0)).toBeNull();
    expect(tile(12)).toBeNull();
    expect(tile(14)).toBeNull();
    expect(tile(13)?.getAttribute("aria-label")).toBe("Play Floor sitting");
    click(tile(13));
    expect(onSelect).toHaveBeenCalledWith(13, "FLOORSITTING");
    expect(slot(0).getAttribute("aria-keyshortcuts")).toBe("1");
});

it("drops an unassigned move onto a shortcut and persists it without playing or closing", () => {
    const transfer = drag(tile(9), slot(2));
    expect(transfer.getData("application/x-oncyber-emote")).toBe("PRAYING");
    expect(getEmoteShortcuts()[2]).toBe("PRAYING");
    expect(slot(2).getAttribute("aria-label")).toContain("Praying");
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "Praying is shortcut 3."
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    act(() => root.render(null));
    render();
    expect(slot(2).dataset.emoteName).toBe("PRAYING");
    click(slot(2));
    expect(onSelect).toHaveBeenLastCalledWith(9, "PRAYING");
});

it("swaps two assigned slots when one is dragged onto the other", () => {
    drag(slot(0), slot(4));
    expect(getEmoteShortcuts()[4]).toBe("WAVING");
    expect(getEmoteShortcuts()[0]).toBe("SHUFFLING");
    expect(new Set(getEmoteShortcuts()).size).toBe(9);
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "Wave is shortcut 5. Shuffling moved to shortcut 1."
    );
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

it("ignores removed or unrelated drop data and cancelled drags", () => {
    for (const name of ["SITTING", "SITTALKING", "unrelated text"]) {
        const transfer = dataTransfer();
        transfer.setData("text/plain", name);
        act(() => Simulate.drop(slot(0), { dataTransfer: transfer }));
    }
    const transfer = dataTransfer();
    act(() => Simulate.dragStart(tile(13), { dataTransfer: transfer }));
    act(() => Simulate.dragOver(slot(1), { dataTransfer: transfer }));
    act(() => Simulate.dragEnd(tile(13), { dataTransfer: transfer }));
    expect(slot(1).hasAttribute("data-drop-target")).toBe(false);
    expect(getEmoteShortcuts()).toEqual(DEFAULT_EMOTE_SHORTCUTS);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

it("cancels a native drag with Escape without closing the picker", () => {
    const transfer = dataTransfer();
    act(() => Simulate.dragStart(tile(13), { dataTransfer: transfer }));
    act(() => Simulate.dragOver(slot(1), { dataTransfer: transfer }));
    key(tile(13), "Escape");
    expect(slot(1).hasAttribute("data-drop-target")).toBe(false);
    expect(container.querySelector('[role="status"]').textContent).toBe(
        "Shortcut drag cancelled."
    );
    act(() => Simulate.dragEnd(tile(13), { dataTransfer: transfer }));
    expect(getEmoteShortcuts()).toEqual(DEFAULT_EMOTE_SHORTCUTS);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

it("assigns with Shift plus a physical number key and plays the updated mapping with plain numbers", () => {
    act(() => tile(13).focus());
    key(tile(13), "!", { code: "Digit1", shiftKey: true });
    expect(getEmoteShortcuts()[0]).toBe("FLOORSITTING");
    expect(tile(13)).toBeNull();
    expect(tile(0)?.dataset.emoteName).toBe("WAVING");
    expect(document.activeElement).toBe(slot(0));
    expect(onSelect).not.toHaveBeenCalled();
    key(slot(0), "1", { code: "Digit1" });
    expect(onSelect).toHaveBeenLastCalledWith(13, "FLOORSITTING");
    key(slot(0), "9", { code: "Digit9" });
    expect(onSelect).toHaveBeenLastCalledWith(8, "DEATH");
});

it("supports selecting a move then tapping a shortcut without needing drag on touch screens", () => {
    const assign = container.querySelector<HTMLButtonElement>(
        '[aria-label="Assign animation shortcuts"]'
    );
    click(assign);
    expect(assign.getAttribute("aria-pressed")).toBe("true");
    click(tile(13));
    expect(slot(1).getAttribute("aria-label")).toContain(
        "Assign Floor sitting here"
    );
    click(slot(1));
    expect(getEmoteShortcuts()[1]).toBe("FLOORSITTING");
    expect(onSelect).not.toHaveBeenCalled();
    click(assign);
    click(slot(1));
    expect(onSelect).toHaveBeenLastCalledWith(13, "FLOORSITTING");
});

it("browses one two-row grid where the first spare move sits under shortcut nine", () => {
    // Column by column: 1/2 … 9/Praying, Wanna rock/Crip, Floor sitting.
    expect(document.activeElement).toBe(tile(9));
    key(tile(9), "ArrowUp");
    expect(document.activeElement).toBe(slot(8));
    key(slot(8), "ArrowDown");
    expect(document.activeElement).toBe(tile(9));
    key(tile(9), "ArrowRight");
    expect(document.activeElement).toBe(tile(11));
    key(tile(11), "ArrowUp");
    expect(document.activeElement).toBe(tile(10));
    key(tile(10), "ArrowRight");
    expect(document.activeElement).toBe(tile(13));
    key(tile(13), "ArrowRight");
    expect(document.activeElement).toBe(tile(13));
    key(tile(13), "ArrowDown");
    expect(document.activeElement).toBe(tile(13));
    key(tile(13), "Home");
    expect(document.activeElement).toBe(slot(0));
    key(slot(0), "ArrowDown");
    expect(document.activeElement).toBe(slot(1));
    key(slot(1), "ArrowRight");
    expect(document.activeElement).toBe(slot(3));
    key(slot(3), "End");
    expect(document.activeElement).toBe(tile(13));
    key(tile(13), "ArrowLeft");
    expect(document.activeElement).toBe(tile(10));
    key(tile(10), "ArrowLeft");
    expect(document.activeElement).toBe(slot(8));
    expect(onSelect).not.toHaveBeenCalled();
});

it("plays a single preview across both rows, following hover or keyboard focus", () => {
    const active = () =>
        Array.from(container.querySelectorAll('[data-active="true"]')).map(
            (node) => node.getAttribute("data-pose")
        );
    expect(active()).toEqual(["PRAYING"]);
    act(() => Simulate.mouseEnter(slot(2)));
    expect(active()).toEqual(["MOONWALK"]);
    act(() => Simulate.mouseLeave(slot(2)));
    expect(active()).toEqual(["PRAYING"]);
    act(() => Simulate.mouseEnter(tile(11)));
    key(tile(9), "ArrowRight");
    expect(active()).toEqual(["CRIP"]);
});

it("keeps Stop and Escape separate from playing and lets Escape cancel assignment first", () => {
    const stop = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Stop animation"
    );
    click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    click(container.querySelector('[aria-label="Assign animation shortcuts"]'));
    key(tile(9), "Escape");
    expect(onClose).not.toHaveBeenCalled();
    key(tile(9), "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
});

it("returns focus after close without stealing focus from another control", async () => {
    act(() => root.render(null));
    await act(async () => await Promise.resolve());
    expect(document.activeElement).toBe(opener);
    render();
    const other = document.createElement("button");
    document.body.append(other);
    act(() => other.focus());
    act(() => root.render(null));
    await act(async () => await Promise.resolve());
    expect(document.activeElement).toBe(other);
    other.remove();
});

it("keeps shortcut nine assignable by keyboard and reveals moves past the edge", () => {
    const library = container.querySelector<HTMLElement>(".animation-grid");
    Object.defineProperty(library, "clientWidth", { value: 100 });
    Object.defineProperties(tile(13), {
        offsetLeft: { value: 200 },
        offsetWidth: { value: 64 },
    });

    key(slot(0), "End");
    expect(document.activeElement).toBe(tile(13));
    expect(library.scrollLeft).toBe(172);

    key(tile(13), "(", { code: "Digit9", shiftKey: true });
    expect(slot(8).dataset.emoteName).toBe("FLOORSITTING");
    expect(tile(8)?.dataset.emoteName).toBe("DEATH");
    expect(document.activeElement).toBe(slot(8));
    expect(onSelect).not.toHaveBeenCalled();
    key(slot(8), "9", { code: "Digit9" });
    expect(onSelect).toHaveBeenCalledWith(13, "FLOORSITTING");
    expect(onClose).not.toHaveBeenCalled();
});

it("assigns shortcut nine by tapping a move then the slot", () => {
    click(container.querySelector('[aria-label="Assign animation shortcuts"]'));
    click(tile(13));
    expect(tile(13).dataset.pending).toBe("true");
    click(slot(8));
    expect(slot(8).dataset.emoteName).toBe("FLOORSITTING");
    expect(tile(13)).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
});

it("phone picker preserves engine indices and selection rules with tap and stop controls", () => {
    render(true, [...items, { name: "CUSTOM_DANCE" }]);
    const phoneMoves = container.querySelectorAll(
        ".phone-animation-grid button"
    );
    expect(phoneMoves).toHaveLength(13);
    expect(container.querySelector("[data-shortcut-slot]")).toBeNull();
    expect(
        container.querySelector('[aria-label="Assign animation shortcuts"]')
    ).toBeNull();
    click(container.querySelector('[aria-label="Play Floor sitting"]'));
    expect(onSelect).toHaveBeenLastCalledWith(13, "FLOORSITTING");
    expect(
        container.querySelector('[aria-label="Play Custom_dance"]')
    ).toBeNull();
    click(container.querySelector('[aria-label="Play Wave"]'));
    expect(onSelect).toHaveBeenLastCalledWith(0, "WAVING");
    const stop = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Stop animation"
    );
    click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    click(container.querySelector('[aria-label="Close animations"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
    render(false);
    expect(container.querySelectorAll("[data-shortcut-slot]")).toHaveLength(9);
});
