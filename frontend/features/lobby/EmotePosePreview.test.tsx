/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import EmotePosePreview from "./EmotePosePreview";
import { SUMMER_EMOTE_PREVIEWS } from "./summerEmoteData";
import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let media: {
    matches: boolean;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
};
let fetchMock: jest.Mock;
let raf: jest.SpyInstance;
const originalFetch = global.fetch;
const still = (name = "WAVING") =>
    container.querySelector<HTMLImageElement>(
        `img[data-emote-preview="${name}"]`
    );
const motion = (name = "WAVING") =>
    container.querySelector<HTMLImageElement>(
        `img[data-emote-motion="${name}"]`
    );
const render = async (name = "WAVING", active = false) => {
    await act(async () => {
        root.render(<EmotePosePreview name={name} active={active} />);
    });
};
const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", {
        configurable: true,
        value: hidden,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
};
const setReducedMotion = (reduced: boolean) => {
    media.matches = reduced;
    const listeners = media.addEventListener.mock.calls;
    act(() => listeners[listeners.length - 1]?.[1]());
};

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    media = {
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    };
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: jest.fn(() => media),
    });
    Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
    });
    raf = jest.spyOn(window, "requestAnimationFrame");
    fetchMock = jest.fn();
    global.fetch = fetchMock;
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
});

test("idle cards show the rendered Summer pose without requesting motion or starting clocks", async () => {
    await render();
    expect(still()?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.WAVING.still
    );
    expect(motion()).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
});

test("only active cards mount the animated image and keep the still underneath while it loads", async () => {
    await render();
    await render("WAVING", true);
    expect(motion()?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.WAVING.motion
    );
    expect(still()?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.WAVING.still
    );
    expect(still()?.style.visibility).toBe("visible");
    expect(container.querySelectorAll("img")).toHaveLength(2);
    act(() => Simulate.load(motion()));
    expect(motion()?.style.visibility).toBe("visible");
    expect(still()).not.toBeNull();
    expect(still()?.style.visibility).toBe("hidden");
    await render("WAVING", false);
    expect(motion()).toBeNull();
    expect(still()?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.WAVING.still
    );
    expect(still()?.style.visibility).toBe("visible");
    await render("WAVING", true);
    expect(motion()?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.WAVING.motion
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
});

test("reduced motion keeps only the still and responds to preference changes", async () => {
    media.matches = true;
    await render("HIPHOP", true);
    expect(still("HIPHOP")).not.toBeNull();
    expect(motion("HIPHOP")).toBeNull();
    setReducedMotion(false);
    expect(motion("HIPHOP")).not.toBeNull();
    setReducedMotion(true);
    expect(motion("HIPHOP")).toBeNull();
    expect(still("HIPHOP")).not.toBeNull();
});

test("hidden tabs unmount animated images and cleanup removes both listeners", async () => {
    const remove = jest.spyOn(document, "removeEventListener");
    setHidden(true);
    await render("TECHNO", true);
    expect(motion("TECHNO")).toBeNull();
    expect(still("TECHNO")).not.toBeNull();
    setHidden(false);
    expect(motion("TECHNO")).not.toBeNull();
    setHidden(true);
    expect(motion("TECHNO")).toBeNull();
    expect(still("TECHNO")).not.toBeNull();
    await act(async () => root.render(null));
    expect(media.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
    );
    expect(remove).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
    );
});

test("failed animation preserves the still, avoids a retry loop, and retries on the next activation", async () => {
    await render("WAVING", true);
    const originalStill = still();
    act(() => Simulate.load(motion()));
    expect(still()?.style.visibility).toBe("hidden");
    act(() => Simulate.error(motion()));
    expect(still()).toBe(originalStill);
    expect(still()?.style.visibility).toBe("visible");
    expect(motion()).toBeNull();
    await render("WAVING", true);
    expect(motion()).toBeNull();
    await render("WAVING", false);
    await render("WAVING", true);
    expect(motion()).not.toBeNull();
    act(() => Simulate.error(motion()));
    await render("PRAYING", true);
    expect(still("PRAYING")?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.PRAYING.still
    );
    expect(motion("PRAYING")?.getAttribute("src")).toBe(
        SUMMER_EMOTE_PREVIEWS.PRAYING.motion
    );
});

test("the rendered Summer manifest covers all native animations with separate still and motion assets", () => {
    expect(Object.keys(SUMMER_EMOTE_PREVIEWS).sort()).toEqual(
        EMOTES.map(({ name }) => name).sort()
    );
    expect(Object.keys(SUMMER_EMOTE_PREVIEWS)).toHaveLength(15);
    const paths = new Set<string>();
    for (const preview of Object.values(SUMMER_EMOTE_PREVIEWS)) {
        expect(preview.width).toBeGreaterThanOrEqual(128);
        expect(preview.width).toBeLessThanOrEqual(192);
        expect(preview.height).toBe(preview.width);
        expect(preview.duration).toBeGreaterThan(0);
        expect(Number.isFinite(preview.duration)).toBe(true);
        expect(preview.still).toMatch(/^\/.*\.webp(?:\?.*)?$/);
        expect(preview.motion).toMatch(/^\/.*\.webp(?:\?.*)?$/);
        expect(preview.still).not.toBe(preview.motion);
        paths.add(preview.still);
        paths.add(preview.motion);
    }
    expect(paths.size).toBe(30);
});
