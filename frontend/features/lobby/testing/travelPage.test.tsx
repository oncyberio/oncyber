/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { WORLD_TILE_REVEAL_MS } from "../worldTileMotion";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_BLACK_AT_MS,
    WORLD_DISSOLVE_MS,
    TRAVEL_DEPARTURE_MS,
} from "../worldTravelTiming";
let mockSceneProps: any;
jest.mock("next/dynamic", () => ({
    __esModule: true,
    default: () => (props: any) => {
        mockSceneProps = props;
        return null;
    },
}));
jest.mock("@features/content-host/testing/ControlIconPreview", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("../avatarSelection", () => ({
    DEFAULT_LOBBY_AVATAR_URL: "/sample.vrm",
}));
import LobbyTravelLab from "../../../pages/dev/lobby-travel";

function mountLab() {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
            frames.set(++id, callback);
            return id;
        }
    );
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
        frames.delete(frame);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<LobbyTravelLab />));
    act(() => mockSceneProps.onReady());
    return {
        container,
        frames,
        button: (label: string) =>
            [...container.querySelectorAll("button")].find(
                (item) => item.textContent === label
            ),
        click(label: string) {
            act(() => Simulate.click(this.button(label)));
        },
        advance(ms: number) {
            act(() => jest.advanceTimersByTime(ms));
        },
        frame() {
            act(() => {
                const pending = [...frames.values()];
                frames.clear();
                pending.forEach((callback) => callback(performance.now()));
            });
        },
        close() {
            act(() => root.unmount());
            container.remove();
        },
    };
}
let lab: ReturnType<typeof mountLab>;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    lab = mountLab();
});
afterEach(() => {
    lab.close();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test("play dims on the clap and keeps the remaining attack and crouch before revealing", () => {
    expect(lab.container.textContent).toContain("World transition · preview");
    expect(TRAVEL_DEPARTURE_MS).toBeGreaterThan(TRAVEL_BLACK_AT_MS);
    lab.click("Play transition");
    const startedAt = mockSceneProps.travel.startedAt;
    expect(mockSceneProps.travel.dissolveStartedAt).toBe(
        startedAt + TRAVEL_DISSOLVE_AT_MS
    );
    expect(mockSceneProps.travel.phase).toBe("isolate");
    lab.advance(TRAVEL_ISOLATE_MS);
    expect(mockSceneProps.travel).toMatchObject({ phase: "charge", startedAt });
    expect(lab.button("charge").getAttribute("aria-pressed")).toBe("true");
    lab.advance(TRAVEL_DISSOLVE_AT_MS - TRAVEL_ISOLATE_MS);
    expect(lab.button("dim").getAttribute("aria-pressed")).toBe("true");
    expect(mockSceneProps.travel.dissolveProgress).toBeUndefined();
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
    lab.advance(WORLD_DISSOLVE_MS / 2);
    lab.frame();
    expect(
        Number(
            (
                lab.container.querySelector(
                    '[aria-label="Dimming progress"]'
                ) as HTMLInputElement
            ).value
        )
    ).toBeCloseTo(0.5);
    lab.advance(WORLD_DISSOLVE_MS / 2);
    expect(lab.button("black").getAttribute("aria-pressed")).toBe("true");
    expect(mockSceneProps.travel).toMatchObject({ phase: "charge", startedAt });
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
    lab.advance(TRAVEL_DEPARTURE_MS - TRAVEL_BLACK_AT_MS - 1);
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
    lab.advance(1);
    expect(mockSceneProps.travel).toMatchObject({ phase: "reveal", startedAt });
    expect(mockSceneProps.worldRevealPreview.progress).toBe(0);
    lab.advance(WORLD_TILE_REVEAL_MS / 2);
    lab.frame();
    expect(mockSceneProps.worldRevealPreview.progress).toBeCloseTo(0.5);
    // +1 ms: the trip-speed departure ends on a fractional millisecond.
    lab.advance(WORLD_TILE_REVEAL_MS / 2 + 1);
    lab.frame();
    expect(mockSceneProps.travel).toBeUndefined();
    expect(mockSceneProps.worldRevealPreview).toMatchObject({
        progress: 1,
        arrived: true,
        partyIds: ["preview-0", "preview-1"],
    });
    expect(lab.container.textContent).toContain("WASD to move");
});

test("manual inspection freezes charge, half dissolve and black without starting the destination", () => {
    lab.click("charge");
    expect(mockSceneProps.travel.dissolveProgress).toBe(0);
    lab.click("dim");
    expect(mockSceneProps.travel).toMatchObject({
        phase: "charge",
        dissolveProgress: 0.5,
    });
    lab.advance(10000);
    expect(mockSceneProps.travel.dissolveProgress).toBe(0.5);
    const slider = lab.container.querySelector(
        '[aria-label="Dimming progress"]'
    );
    act(() => Simulate.change(slider, { target: { value: "0.27" } } as any));
    expect(mockSceneProps.travel.dissolveProgress).toBe(0.27);
    lab.click("black");
    expect(mockSceneProps.travel).toMatchObject({
        phase: "charge",
        dissolveProgress: 1,
    });
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
    lab.click("reveal");
    expect(mockSceneProps.travel.dissolveProgress).toBe(1);
    expect(mockSceneProps.worldRevealPreview.progress).toBe(0.5);
});

test("scrubbing cancels automatic handoff and replay or lobby cancellation clears stale callbacks", () => {
    lab.click("Play transition");
    lab.advance(TRAVEL_DISSOLVE_AT_MS);
    const slider = lab.container.querySelector(
        '[aria-label="Dimming progress"]'
    );
    act(() => Simulate.change(slider, { target: { value: "0.4" } } as any));
    lab.advance(10000);
    lab.frame();
    expect(mockSceneProps.travel.dissolveProgress).toBe(0.4);
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
    lab.click("Play transition");
    lab.advance(TRAVEL_DEPARTURE_MS);
    expect(mockSceneProps.travel.phase).toBe("reveal");
    lab.click("lobby");
    expect(lab.frames.size).toBe(0);
    lab.advance(10000);
    lab.frame();
    expect(mockSceneProps.travel).toBeUndefined();
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
    lab.click("arrived");
    expect(mockSceneProps.travel).toBeUndefined();
    expect(mockSceneProps.worldRevealPreview.arrived).toBe(true);
    lab.click("Play transition");
    expect(mockSceneProps.travel.phase).toBe("isolate");
    expect(mockSceneProps.worldRevealPreview).toBeUndefined();
});

test("reduced motion requests immediate geometry changes and completes without an animated reveal", () => {
    const checkbox = lab.container.querySelector('input[type="checkbox"]');
    act(() => Simulate.change(checkbox, { target: { checked: true } } as any));
    lab.click("Play transition");
    expect(mockSceneProps.travel.reducedMotion).toBe(true);
    lab.advance(TRAVEL_DEPARTURE_MS);
    expect(mockSceneProps.worldRevealPreview).toMatchObject({
        progress: 1,
        reducedMotion: true,
    });
    lab.frame();
    expect(mockSceneProps.travel).toBeUndefined();
    expect(mockSceneProps.worldRevealPreview.arrived).toBe(true);
});
