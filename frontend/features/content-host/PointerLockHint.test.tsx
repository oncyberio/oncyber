/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ExperienceShell from "./ExperienceShell";
import PointerLockHint from "./PointerLockHint";

jest.mock("@features/landing-carousel/components/Header", () => ({
    __esModule: true,
    default: () => <header />,
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let lockedElement: Element | null;
let originalLock: PropertyDescriptor | undefined;
const hint = () => container.querySelector('[role="status"]');
const render = () => act(() => root.render(<PointerLockHint />));
const changeLock = (element: Element | null) => {
    lockedElement = element;
    act(() => document.dispatchEvent(new Event("pointerlockchange")));
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    lockedElement = null;
    originalLock = Object.getOwnPropertyDescriptor(
        document,
        "pointerLockElement"
    );
    Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        get: () => lockedElement,
    });
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalLock) {
        Object.defineProperty(document, "pointerLockElement", originalLock);
    } else {
        delete (document as any).pointerLockElement;
    }
    jest.restoreAllMocks();
    delete (window as any).matchMedia;
});

test("stays hidden when the document has no pointer lock", () => {
    render();
    expect(hint()).toBeNull();
});

test("reads an existing pointer lock when mounted", () => {
    lockedElement = document.createElement("canvas");
    render();
    expect(hint().textContent).toBe(
        "Press Esc to regain control of your mouse"
    );
    expect(hint().querySelector("kbd").textContent).toBe("Esc");
});

test("shows and hides as the document gains and loses pointer lock", () => {
    render();
    changeLock(document.createElement("canvas"));
    expect(hint()).not.toBeNull();
    changeLock(null);
    expect(hint()).toBeNull();
    changeLock(document.createElement("canvas"));
    expect(hint()).not.toBeNull();
});

test("a failed pointer lock request does not show a hint", () => {
    render();
    act(() => document.dispatchEvent(new Event("pointerlockerror")));
    expect(hint()).toBeNull();
});

test("the experience shell mounts the hint for its current document", () => {
    lockedElement = document.createElement("canvas");
    act(() => {
        root.render(
            <ExperienceShell
                title="Example world"
                onExit={jest.fn()}
                showHeader={false}
            />
        );
    });
    const shell = container.querySelector(
        '[aria-label="Oncyber world controls"]'
    );
    expect(shell.contains(hint())).toBe(true);
    changeLock(null);
    expect(hint()).toBeNull();
});

test("removes its document listener when unmounted", () => {
    const add = jest.spyOn(document, "addEventListener");
    const remove = jest.spyOn(document, "removeEventListener");
    render();
    const registrations = add.mock.calls.filter(
        ([event]) => event === "pointerlockchange"
    );
    expect(registrations).toHaveLength(1);
    const [, listener] = registrations[0];
    act(() => root.render(null));
    expect(remove).toHaveBeenCalledWith("pointerlockchange", listener);
    changeLock(document.createElement("canvas"));
    expect(hint()).toBeNull();
});

test("invites mouse users to click in when the host asks", () => {
    (window as any).matchMedia = (query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    });
    act(() => root.render(<PointerLockHint lookHint />));
    expect(hint().textContent).toBe("Click to look around freely");
    changeLock(document.createElement("canvas"));
    expect(hint().textContent).toBe(
        "Press Esc to regain control of your mouse"
    );
});

test("the look hint stays away on touch screens", () => {
    (window as any).matchMedia = (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    });
    act(() => root.render(<PointerLockHint lookHint />));
    expect(hint()).toBeNull();
});

test("the experience top bar steps aside while the pointer is locked", () => {
    act(() =>
        root.render(<ExperienceShell title="Twin flames" onExit={() => {}} />)
    );
    const shell = container.querySelector(
        '[aria-label="Oncyber world controls"]'
    );
    expect(shell.hasAttribute("data-pointer-locked")).toBe(false);
    changeLock(document.createElement("canvas"));
    expect(shell.hasAttribute("data-pointer-locked")).toBe(true);
    changeLock(null);
    expect(shell.hasAttribute("data-pointer-locked")).toBe(false);
});

test("prompts hide after six seconds of being shown, not counting time behind a panel", () => {
    jest.useFakeTimers();
    try {
        (window as any).matchMedia = (query: string) => ({
            matches: true,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        });
        act(() => root.render(<PointerLockHint lookHint />));
        expect(hint().textContent).toBe("Click to look around freely");
        act(() => jest.advanceTimersByTime(4000));
        // A panel opens: hidden, clock stopped.
        act(() => root.render(<PointerLockHint lookHint paused />));
        expect(hint()).toBeNull();
        act(() => jest.advanceTimersByTime(10000));
        // Closed again: the remaining two seconds are shown.
        act(() => root.render(<PointerLockHint lookHint />));
        expect(hint()).not.toBeNull();
        act(() => jest.advanceTimersByTime(2100));
        expect(hint()).toBeNull();
        // Locking is a new appearance with its own six seconds.
        changeLock(document.createElement("canvas"));
        expect(hint().textContent).toContain("Esc");
        act(() => jest.advanceTimersByTime(6100));
        expect(hint()).toBeNull();
    } finally {
        jest.useRealTimers();
    }
});
