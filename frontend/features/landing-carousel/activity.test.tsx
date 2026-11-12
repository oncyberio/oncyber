/** @jest-environment jsdom */
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import {
    createActivityStore,
    LandingActivityProvider,
    useLandingActivity,
    useLandingBusy,
} from "./activity";
import CyberloopMark from "./components/CyberloopMark";

let store: ReturnType<typeof createActivityStore>;
let root: Root;
let host: HTMLDivElement;
let reduced = false;
let hidden = false;
let changeMotion: () => void;
let sprite: { onload?: () => void; src?: string };
const OriginalImage = window.Image;
function Harness({
    busy = false,
    show = true,
    scrollLinked = false,
    continuous = false,
}) {
    store = useLandingActivity();
    useLandingBusy(busy);
    return show ? (
        <CyberloopMark scrollLinked={scrollLinked} continuous={continuous} />
    ) : null;
}
function render(
    busy = false,
    show = true,
    scrollLinked = false,
    continuous = false
) {
    act(() =>
        root.render(
            <LandingActivityProvider>
                <Harness
                    busy={busy}
                    show={show}
                    scrollLinked={scrollLinked}
                    continuous={continuous}
                />
            </LandingActivityProvider>
        )
    );
}
const mark = () => host.querySelector<HTMLElement>(".cyberloop-mark");
function advance(ms: number) {
    act(() => jest.advanceTimersByTime(ms));
}
function loadSprite() {
    act(() => sprite.onload?.());
}
beforeEach(() => {
    jest.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    reduced = hidden = false;
    sprite = undefined;
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => hidden,
    });
    window.matchMedia = jest.fn(() => ({
        get matches() {
            return reduced;
        },
        addEventListener: (_, fn) => {
            changeMotion = fn;
        },
        removeEventListener: jest.fn(),
    })) as any;
    window.Image = jest.fn(() => (sprite = {})) as any;
    host = document.createElement("div");
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    expect(jest.getTimerCount()).toBe(0);
    window.Image = OriginalImage;
    jest.useRealTimers();
});
it("keeps independent loads active until the last owner finishes", () => {
    const activity = createActivityStore();
    const change = jest.fn();
    const unsubscribe = activity.subscribe(change);
    const scroll = Symbol(),
        network = Symbol();
    activity.set(scroll, true);
    activity.set(network, true);
    activity.set(scroll, false);
    activity.set(scroll, false);
    expect(activity.getSnapshot()).toBe(true);
    expect(change).toHaveBeenCalledTimes(1);
    activity.set(network, false);
    expect(activity.getSnapshot()).toBe(false);
    expect(change).toHaveBeenCalledTimes(2);
    unsubscribe();
    activity.set(network, true);
    expect(change).toHaveBeenCalledTimes(2);
});
it("loads the sprite only on activity, advances it, and freezes without snapping", () => {
    render();
    expect(window.Image).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    render(true);
    expect(mark().dataset.cyberloopState).toBe("idle");
    loadSprite();
    const initial = mark().style.backgroundPosition;
    advance(160);
    expect(mark().dataset.cyberloopState).toBe("playing");
    expect(mark().style.backgroundPosition).not.toBe(initial);
    render(false);
    advance(220);
    const resting = mark().style.backgroundPosition;
    expect(mark().dataset.cyberloopState).toBe("idle");
    advance(1000);
    expect(mark().style.backgroundPosition).toBe(resting);
    expect(jest.getTimerCount()).toBe(0);
    render(true);
    expect(mark().style.backgroundPosition).toBe(resting);
    expect(window.Image).toHaveBeenCalledTimes(1);
});
it("bridges short gaps without stopping another pending request", () => {
    render(true);
    loadSprite();
    const key = Symbol();
    store.set(key, true);
    render(false);
    advance(500);
    expect(mark().dataset.cyberloopState).toBe("playing");
    store.set(key, false);
    advance(100);
    store.set(key, true);
    advance(500);
    expect(mark().dataset.cyberloopState).toBe("playing");
    store.set(key, false);
    advance(220);
    expect(jest.getTimerCount()).toBe(0);
});
it("uses the still image for reduced motion, including changes during playback", () => {
    reduced = true;
    render(true);
    expect(window.Image).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    reduced = false;
    changeMotion();
    loadSprite();
    advance(150);
    reduced = true;
    changeMotion();
    expect(mark().style.backgroundImage).toContain("cyberloop-still.webp");
    expect(mark().dataset.cyberloopState).toBe("idle");
    expect(jest.getTimerCount()).toBe(0);
});
it("suspends in hidden tabs and resumes only if activity is still pending", () => {
    render(true);
    loadSprite();
    advance(100);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(jest.getTimerCount()).toBe(0);
    const paused = mark().style.backgroundPosition;
    advance(10000);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mark().style.backgroundPosition).toBe(paused);
    render(false);
    advance(220);
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(jest.getTimerCount()).toBe(0);
});
it("does not start late loads after completion or leave timers on unmount", () => {
    render(true);
    render(false);
    loadSprite();
    expect(jest.getTimerCount()).toBe(0);
    render(true);
    advance(50);
    render(false, false);
    expect(sprite.onload).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
});

function spriteFrame() {
    const [x, y] = mark().style.backgroundPosition.split(" ").map(parseFloat);
    return Math.round((x * 14) / 100) + 15 * Math.round((y * 14) / 100);
}
const ribbonShapes = () =>
    Array.from(mark().querySelectorAll("path")).map((path) =>
        path.getAttribute("d")
    );
const turn = () => mark().querySelector("g").getAttribute("transform");

it("arrives on the original symbol and unfolds into the loop with the first column", () => {
    render(true, true, true);
    const arrival = ribbonShapes();
    expect(mark().tagName.toLowerCase()).toBe("svg");
    expect(mark().dataset.cyberloopForm).toBe("original");
    expect(mark().dataset.cyberloopProgress).toBe("0.000");
    expect(arrival).toHaveLength(3);
    expect(window.Image).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    store.setScrollProgress(0.45);
    const halfway = ribbonShapes();
    expect(mark().dataset.cyberloopForm).toBe("transition");
    expect(halfway).not.toEqual(arrival);
    advance(1000);
    expect(ribbonShapes()).toEqual(halfway);
    store.setScrollProgress(1);
    const loop = ribbonShapes();
    expect(mark().dataset.cyberloopForm).toBe("loop");
    expect(loop).not.toEqual(halfway);
    const firstTurn = turn();
    store.setScrollProgress(2);
    expect(ribbonShapes()).toEqual(loop);
    expect(turn()).not.toBe(firstTurn);
    store.setScrollProgress(0.45);
    expect(ribbonShapes()).toEqual(halfway);
    store.setScrollProgress(0);
    expect(mark().dataset.cyberloopForm).toBe("original");
    expect(ribbonShapes()).toEqual(arrival);
    expect(jest.getTimerCount()).toBe(0);
});
it("restores the actual gallery position without image loading or an autoplay tail", () => {
    render(false, false, true);
    store.setScrollProgress(4);
    render(false, true, true);
    expect(mark().dataset.cyberloopForm).toBe("loop");
    const pose = turn();
    render(false, false, true);
    render(false, true, true);
    expect(turn()).toBe(pose);
    expect(window.Image).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});
it("uses discrete identities for reduced motion and catches up after a hidden tab", () => {
    reduced = true;
    render(false, true, true);
    expect(mark().dataset.cyberloopForm).toBe("original");
    store.setScrollProgress(1);
    expect(mark().dataset.cyberloopForm).toBe("loop");
    const reducedTurn = turn();
    store.setScrollProgress(2);
    expect(turn()).toBe(reducedTurn);
    reduced = false;
    changeMotion();
    const visibleTurn = turn();
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    store.setScrollProgress(3);
    expect(turn()).toBe(visibleTurn);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(turn()).not.toBe(visibleTurn);
    reduced = true;
    changeMotion();
    expect(turn()).toBe(reducedTurn);
    store.setScrollProgress(0);
    expect(mark().dataset.cyberloopForm).toBe("original");
    expect(window.Image).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});
it("keeps the arrival identity still while background work comes and goes", () => {
    render(false, true, true);
    const arrival = ribbonShapes();
    render(true, true, true);
    advance(500);
    render(false, true, true);
    advance(500);
    expect(ribbonShapes()).toEqual(arrival);
    expect(mark().dataset.cyberloopForm).toBe("original");
    expect(window.Image).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});
it("keeps the continuous modal animation independent of carousel position", () => {
    render(false, true, false, true);
    loadSprite();
    advance(160);
    const frame = spriteFrame();
    expect(frame).toBeGreaterThan(90);
    store.setScrollProgress(4);
    expect(spriteFrame()).toBe(frame);
    advance(160);
    expect(spriteFrame()).toBeGreaterThan(frame);
});
