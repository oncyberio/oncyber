/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useLobbyJourney } from "./useLobbyJourney";
import {
    TRAVEL_DEPARTURE_MS,
    TRAVEL_ISOLATE_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_BLACK_AT_MS,
    WORLD_BLACK_HOLD_MS,
} from "./worldTravelTiming";
import { sampleTravelPresentation } from "./travelPresentation";
import {
    destinationFrameUrl,
    readLobbyTravelView,
    hasConnectedDestinationRoom,
    LOBBY_DESTINATION_PROTOCOL,
} from "./lobbyJourneyProtocol";

import {
    beginLobbyReturn,
    finishLobbyReturn,
    pendingLobbyReturn,
    type LobbyReturnTransition,
} from "@utils/lobbyReturnTransition";

let root: Root;
let container: HTMLDivElement;
let journey: ReturnType<typeof useLobbyJourney>;
let nonce = 0;
function Harness({ initialReturn }: { initialReturn?: LobbyReturnTransition }) {
    journey = useLobbyJourney(initialReturn);
    return journey.frameUrl ? (
        <iframe
            key={journey.attempt}
            ref={journey.frameRef}
            src={journey.frameUrl}
        />
    ) : null;
}
function message(
    type: string,
    overrides: Record<string, unknown> = {},
    options: MessageEventInit = {}
) {
    window.dispatchEvent(
        new MessageEvent("message", {
            source: journey.frameRef.current?.contentWindow,
            origin: window.location.origin,
            data: {
                protocol: LOBBY_DESTINATION_PROTOCOL,
                attempt: journey.attempt,
                type,
                ...overrides,
            },
            ...options,
        })
    );
}
// Let React commit each clock boundary before advancing the next queued frame.
function sendEntry(reduced = false) {
    if (reduced) act(() => jest.advanceTimersByTime(1));
    else {
        act(() => jest.advanceTimersByTime(TRAVEL_ISOLATE_MS));
        act(() =>
            jest.advanceTimersByTime(TRAVEL_DEPARTURE_MS - TRAVEL_ISOLATE_MS)
        );
    }
    act(() => jest.advanceTimersByTime(32));
}
function stageEntry() {
    act(() => jest.advanceTimersByTime(1));
    act(() => jest.advanceTimersByTime(16));
}
function completeEntry() {
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    act(() => message("revealed"));
}
const SPACE = { id: "one", title: "One", href: "/one" };
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false }),
    });
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: {
            randomUUID: () =>
                `00000000-0000-4000-8000-${String(++nonce).padStart(12, "0")}`,
        },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    const pending = pendingLobbyReturn();
    if (pending) finishLobbyReturn(pending);
    jest.useRealTimers();
    jest.restoreAllMocks();
});
test("document load and forged messages never claim destination readiness", () => {
    act(() => journey.select(SPACE));
    const iframe = journey.frameRef.current;
    act(() => iframe.dispatchEvent(new Event("load")));
    act(() => message("prepared", {}, { origin: "https://other.example" }));
    act(() => message("prepared", {}, { source: window }));
    act(() => message("prepared", { attempt: "stale-attempt" }));
    expect(journey.phase).toBe("loading");
    act(() => message("prepared"));
    expect(journey.phase).toBe("ready");
    expect(journey.frameRef.current).toBe(iframe);
});
test("entry is explicit, guarded against repeat gestures, and keeps the prepared document", () => {
    act(() => journey.select(SPACE));
    act(() => message("entered"));
    expect(journey.phase).toBe("loading");
    act(() => message("prepared"));
    const iframe = journey.frameRef.current;
    let first: boolean;
    let second: boolean;
    act(() => {
        first = journey.enter();
        second = journey.enter();
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(journey.phase).toBe("entering");
    act(() => message("entered"));
    expect(journey.phase).toBe("entering");
    expect(journey.admitted).toBe(false);
    sendEntry();
    expect(journey.travel.phase).toBe("charge");
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    act(() => journey.finishReveal());
    expect(journey.phase).toBe("revealing");
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
    expect(journey.frameRef.current).toBe(iframe);
    act(() => journey.cancel());
    expect(journey.phase).toBe("idle");
    expect(container.querySelector("iframe")).toBeNull();
});
test("replacing a destination rejects late callbacks and resets progress", () => {
    act(() => journey.select(SPACE));
    const oldWindow = journey.frameRef.current.contentWindow;
    const oldAttempt = journey.attempt;
    act(() => message("progress", { progress: 0.7 }));
    act(() => journey.select({ ...SPACE, id: "two", href: "/two" }));
    act(() =>
        message("prepared", { attempt: oldAttempt }, { source: oldWindow })
    );
    expect(journey.phase).toBe("loading");
    expect(journey.progress).toBe(0);
    act(() => message("progress", { progress: 0.4 }));
    act(() => message("progress", { progress: 0.2 }));
    expect(journey.progress).toBe(0.4);
});
test("failed admission and preparation timeout dispose the frame while preserving a fallback", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    act(() => journey.enter());
    act(() =>
        message("error", {
            error: {
                code: "admission-failed",
                message: "Room full",
                canOpenNormally: true,
            },
        })
    );
    expect(journey.phase).toBe("error");
    expect(journey.error.message).toBe("Room full");
    expect(journey.selected).toEqual(SPACE);
    expect(journey.frameUrl).toBeNull();
    expect(journey.canOpenNormally).toBe(true);
    act(() => journey.select(SPACE));
    act(() => jest.advanceTimersByTime(90_000));
    expect(journey.error.code).toBe("timeout");
    expect(container.querySelector("iframe")).toBeNull();
});
test("external and non-space destinations never create a preparation iframe", () => {
    expect(() =>
        destinationFrameUrl(
            "https://elsewhere.example/space",
            window.location.origin,
            "nonce"
        )
    ).toThrow();
    expect(() =>
        destinationFrameUrl(
            "/api/private/data",
            window.location.origin,
            "nonce"
        )
    ).toThrow();
    act(() =>
        journey.select({ ...SPACE, href: "https://elsewhere.example/space" })
    );
    expect(journey.phase).toBe("error");
    expect(journey.error.code).toBe("unsupported");
    expect(journey.frameUrl).toBeNull();
});

test("destination admission requires a currently open Colyseus transport", () => {
    expect(hasConnectedDestinationRoom(null)).toBe(false);
    expect(hasConnectedDestinationRoom({ sessionId: "old" })).toBe(false);
    expect(
        hasConnectedDestinationRoom({
            sessionId: "old",
            connection: { transport: { ws: { readyState: 3 } } },
        })
    ).toBe(false);
    expect(
        hasConnectedDestinationRoom({
            sessionId: "live",
            connection: { transport: { ws: { readyState: 1 } } },
        })
    ).toBe(true);
    act(() => journey.select({ ...SPACE, href: "javascript:alert(1)" }));
    expect(journey.canOpenNormally).toBe(false);
});

test("slow admission holds a cancellable charge without revealing a destination", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    act(() => journey.enter());
    act(() => jest.advanceTimersByTime(600));
    expect(journey.travel.phase).toBe("charge");
    act(() => jest.advanceTimersByTime(10000));
    expect(journey.phase).toBe("entering");
    expect(journey.admitted).toBe(false);
    const oldWindow = journey.frameRef.current.contentWindow;
    const oldAttempt = journey.attempt;
    act(() => journey.cancel());
    act(() =>
        message("entered", { attempt: oldAttempt }, { source: oldWindow })
    );
    act(() => jest.advanceTimersByTime(10000));
    expect(journey.phase).toBe("idle");
    expect(journey.travel).toBeNull();
});
test("cancel during reveal never releases the abandoned world or the replacement", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    act(() => journey.cancel());
    act(() => journey.select({ ...SPACE, id: "two", href: "/two" }));
    act(() => journey.finishReveal());
    act(() => jest.advanceTimersByTime(2100));
    expect(journey.phase).toBe("loading");
    expect(journey.travel).toBeNull();
});
test("a cancelled reveal callback cannot release a replacement already revealing", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    const finishAbandonedReveal = journey.finishReveal;
    act(() => jest.advanceTimersByTime(900));
    act(() => journey.cancel());

    act(() => journey.select({ ...SPACE, id: "two", href: "/two" }));
    act(() => message("prepared"));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    const destination = journey.frameRef.current;
    const release = jest.spyOn(destination.contentWindow, "postMessage");
    act(() => finishAbandonedReveal());
    expect(journey.phase).toBe("revealing");
    expect(journey.frameRef.current).toBe(destination);
    expect(release).not.toHaveBeenCalled();

    act(() => journey.finishReveal());
    expect(journey.phase).toBe("revealing");
    expect(release).not.toHaveBeenCalled();
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
    act(() => finishAbandonedReveal());
    act(() => jest.advanceTimersByTime(2100));
    expect(release).not.toHaveBeenCalled();
});
test("destination failure during reveal removes its frame and ignores completion", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    const finish = journey.finishReveal;
    act(() =>
        message("error", {
            error: { code: "connection-lost", message: "Disconnected" },
        })
    );
    act(() => finish());
    act(() => jest.advanceTimersByTime(2100));
    expect(journey.phase).toBe("error");
    expect(journey.admitted).toBe(false);
    expect(journey.travel).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
});
test("reduced motion still waits for the next frame, admission and staging acknowledgement", () => {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: true }),
    });
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    act(() => journey.enter());
    act(() => message("entered"));
    expect(journey.admitted).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "enter", reducedMotion: true }),
        window.location.origin
    );
    act(() => message("entered"));
    stageEntry();
    expect(journey.phase).toBe("entering");
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
});

test("native reveal requires current renderer completion, never a compositor timer", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    expect(journey.revealMode).toBe("native");
    act(() => journey.enter());
    act(() => message("revealed"));
    expect(journey.phase).toBe("entering");
    sendEntry();
    act(() => message("entered"));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    stageEntry();
    act(() => message("reveal-ready"));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "reveal", reducedMotion: false }),
        window.location.origin
    );
    act(() => jest.advanceTimersByTime(3000));
    act(() => journey.finishReveal());
    act(() => message("revealed", {}, { origin: "https://other.example" }));
    act(() => message("revealed", { attempt: "old-attempt" }));
    act(() => message("revealed", {}, { source: window }));
    expect(journey.phase).toBe("revealing");
    expect(request).toHaveBeenCalledTimes(2);
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
    act(() => jest.advanceTimersByTime(15_000));
    expect(journey.phase).toBe("entered");
});
test("a stalled native reveal returns to the lobby instead of releasing input", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    const attempt = journey.attempt,
        source = journey.frameRef.current.contentWindow;
    act(() => jest.advanceTimersByTime(15_000));
    expect(journey.phase).toBe("error");
    expect(journey.error.code).toBe("reveal-timeout");
    expect(journey.admitted).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
    act(() => message("revealed", { attempt }, { source }));
    expect(journey.phase).toBe("error");
});
test("entry copies the last trusted avatar-relative camera pose before admission", () => {
    const view = {
        cameraOffset: { x: 1, y: 2, z: 3 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 0.5,
        avatarLift: 0.3,
        fov: 60,
    };
    act(() => journey.select(SPACE));
    act(() => journey.setTravelView(view));
    view.cameraOffset.x = 900;
    act(() => message("prepared", { reveal: "native" }));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    act(() => journey.enter());
    expect(request).not.toHaveBeenCalled();
    sendEntry();
    expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
            type: "enter",
            travelView: { ...view, cameraOffset: { x: 1, y: 2, z: 3 } },
        }),
        window.location.origin
    );
});

test("the destination stages the final camera frame before the parent exposes it", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    const pose = {
        cameraOffset: { x: 8, y: 4, z: 9 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 1,
        avatarLift: 0.2,
        fov: 50,
    };
    act(() => journey.setTravelView(pose));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    stageEntry();
    expect(journey.phase).toBe("entering");
    expect(journey.stagingReveal).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "stage-reveal", travelView: pose }),
        window.location.origin
    );
    act(() => message("reveal-ready", { attempt: "old" }));
    act(() => message("revealed"));
    expect(journey.phase).toBe("entering");
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    expect(journey.stagingReveal).toBe(false);
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "reveal" }),
        window.location.origin
    );
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
});
test("a stalled staging step does not expose the destination", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => jest.advanceTimersByTime(15_000));
    expect(journey.phase).toBe("error");
    expect(journey.error.code).toBe("reveal-preparation-timeout");
    expect(journey.stagingReveal).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
});

test("reduced-motion staging reads the next rendered pose and cancellation drops that queued frame", () => {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: true }),
    });
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    act(() => journey.enter());
    sendEntry(true);
    act(() => message("entered"));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    act(() => jest.advanceTimersByTime(1));
    expect(request).not.toHaveBeenCalled();
    const pose = {
        cameraOffset: { x: 2, y: 3, z: 4 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarLift: 0,
        avatarHeight: 1.8,
        avatarRotation: 0.4,
        fov: 60,
    };
    act(() => journey.setTravelView(pose));
    act(() => jest.advanceTimersByTime(16));
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "stage-reveal", travelView: pose }),
        window.location.origin
    );
    act(() => journey.cancel());
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    act(() => journey.enter());
    sendEntry(true);
    act(() => message("entered"));
    const abandoned = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    act(() => jest.advanceTimersByTime(1));
    act(() => journey.cancel());
    abandoned.mockClear();
    act(() => jest.advanceTimersByTime(16));
    expect(abandoned).not.toHaveBeenCalled();
    expect(journey.phase).toBe("idle");
});

test("previous-space messages are ignored before entry and must match the active frame", () => {
    act(() => journey.select(SPACE));
    act(() => message("back"));
    expect(journey.phase).toBe("loading");
    act(() => message("prepared"));
    act(() => journey.enter());
    sendEntry();
    act(() => message("entered"));
    stageEntry();
    act(() => message("reveal-ready"));
    act(() => journey.finishReveal());
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
    act(() => message("back", {}, { origin: "https://other.example" }));
    act(() => message("back", { attempt: "stale-attempt" }));
    act(() => message("back", {}, { source: window }));
    expect(journey.phase).toBe("entered");
    const frame = journey.frameRef.current;
    act(() => message("back"));
    expect(journey.phase).toBe("returning");
    expect(journey.travel.phase).toBe("return");
    expect(journey.frameRef.current).toBe(frame);
    const startedAt = journey.travel.startedAt;
    act(() => journey.markReturnReady(startedAt));
    act(() => journey.finishReturn(startedAt));
    expect(journey.phase).toBe("idle");
    expect(container.querySelector("iframe")).toBeNull();
});
test("travel view carries an explicit valid camera mode", () => {
    const view = {
        cameraOffset: { x: 0, y: 2, z: 4 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 0,
        avatarLift: 0.38,
        fov: 58,
    };
    expect(
        readLobbyTravelView({ ...view, cameraMode: "third-person" }).cameraMode
    ).toBe("third-person");
    expect(
        readLobbyTravelView({ ...view, cameraMode: "first-person" }).cameraMode
    ).toBe("first-person");
    expect(readLobbyTravelView({ ...view, cameraMode: "fly" })).toBeNull();
});

test("a new destination cannot inherit the previous group travel snapshot", () => {
    act(() => journey.select(SPACE));
    act(() =>
        journey.setTravelView({
            cameraOffset: { x: 0, y: 2, z: 4 },
            cameraTargetOffset: { x: 0, y: 1, z: 0 },
            avatarRotation: 0,
            avatarLift: 0,
            fov: 60,
            peers: [
                {
                    id: "old-peer",
                    name: "Previous group",
                    avatar: "",
                    vrmUrl: "",
                    scale: 1,
                    offset: { x: 2, y: 0, z: 0 },
                    rotation: 0,
                },
            ],
        } as any)
    );
    act(() => journey.cancel());
    act(() => journey.select({ ...SPACE, id: "two", href: "/two" }));
    act(() => message("prepared"));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    act(() => journey.enter());
    expect(request).not.toHaveBeenCalled();
    sendEntry();
    expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "enter", travelView: undefined }),
        window.location.origin
    );
});

test("the source reaches black before native entry and holds black during slow admission and staging", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared", { reveal: "native" }));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    const initial = performance.now();
    act(() => journey.enter());
    expect(journey.travel.dissolveStartedAt).toBe(
        initial + TRAVEL_DISSOLVE_AT_MS
    );
    act(() => message("entered"));
    expect(journey.admitted).toBe(false);
    act(() => jest.advanceTimersByTime(TRAVEL_ISOLATE_MS));
    act(() => jest.advanceTimersByTime(TRAVEL_BLACK_AT_MS - TRAVEL_ISOLATE_MS));
    const sample = () =>
        sampleTravelPresentation(
            { ...journey.travel, partyIds: [] },
            performance.now(),
            initial
        );
    expect(sample()).toMatchObject({
        lift: 0,
        animation: "TRAVEL_ATTACK",
    });
    expect(sample().dissolve).toBeCloseTo(1, 2);
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(WORLD_BLACK_HOLD_MS));
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "enter" }),
        window.location.origin
    );
    act(() => jest.advanceTimersByTime(8000));
    expect(journey.phase).toBe("entering");
    expect(journey.admitted).toBe(false);
    expect(sample().dissolve).toBe(1);
    act(() => message("entered"));
    expect(journey.stagingReveal).toBe(false);
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("entering");
    stageEntry();
    expect(journey.stagingReveal).toBe(true);
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "stage-reveal" }),
        window.location.origin
    );
    act(() => jest.advanceTimersByTime(5000));
    expect(sample().dissolve).toBe(1);
    expect(journey.phase).toBe("entering");
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "reveal" }),
        window.location.origin
    );
    expect(request).toHaveBeenCalledTimes(3);
});

test.each([
    1200,
    TRAVEL_BLACK_AT_MS + WORLD_BLACK_HOLD_MS,
    TRAVEL_BLACK_AT_MS + WORLD_BLACK_HOLD_MS + 16,
])(
    "cancelling pending entry at %dms drops its timer or queued render frame",
    (elapsed) => {
        act(() => journey.select(SPACE));
        act(() => message("prepared", { reveal: "native" }));
        const abandoned = jest.spyOn(
            journey.frameRef.current.contentWindow,
            "postMessage"
        );
        const source = journey.frameRef.current.contentWindow,
            attempt = journey.attempt;
        act(() => journey.enter());
        act(() => jest.advanceTimersByTime(600));
        act(() => jest.advanceTimersByTime(elapsed - 600));
        expect(abandoned).not.toHaveBeenCalled();
        act(() => journey.cancel());
        abandoned.mockClear();
        act(() =>
            journey.select({
                ...SPACE,
                id: "replacement",
                href: "/replacement",
            })
        );
        act(() => message("entered", { attempt }, { source }));
        act(() => jest.advanceTimersByTime(3000));
        expect(abandoned).not.toHaveBeenCalled();
        expect(journey.phase).toBe("loading");
        expect(journey.travel).toBeNull();
    }
);

test("duplicate Back cannot restart return and only its current rendered token disposes the frame", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    completeEntry();
    const frame = journey.frameRef.current;
    const request = jest.spyOn(frame.contentWindow, "postMessage");
    act(() => message("back"));
    const startedAt = journey.travel.startedAt;
    act(() => jest.advanceTimersByTime(600));
    act(() => message("back"));
    expect(journey.travel.startedAt).toBe(startedAt);
    act(() => journey.finishReturn(startedAt - 1));
    act(() => jest.advanceTimersByTime(2000));
    expect(journey.phase).toBe("returning");
    expect(journey.frameRef.current).toBe(frame);
    expect(request).not.toHaveBeenCalled();
    act(() => journey.markReturnReady(startedAt));
    act(() => journey.finishReturn(startedAt));
    expect(journey.phase).toBe("idle");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "dispose" }),
        window.location.origin
    );
    act(() => journey.markReturnReady(startedAt));
    act(() => journey.finishReturn(startedAt));
    expect(request).toHaveBeenCalledTimes(1);
});

test("an old return completion cannot dispose a replacement return", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    completeEntry();
    act(() => message("back"));
    const abandonedAt = journey.travel.startedAt;
    act(() => journey.cancel());
    act(() => journey.select({ ...SPACE, id: "next", href: "/next" }));
    act(() => message("prepared"));
    completeEntry();
    act(() => message("back"));
    const currentAt = journey.travel.startedAt;
    expect(currentAt).not.toBe(abandonedAt);
    const frame = journey.frameRef.current;
    act(() => journey.finishReturn(abandonedAt));
    expect(journey.phase).toBe("returning");
    expect(journey.frameRef.current).toBe(frame);
    act(() => journey.markReturnReady(currentAt));
    act(() => journey.finishReturn(currentAt));
    expect(journey.phase).toBe("idle");
});

test("a stalled lobby return releases the old frame only at its ten-second watchdog", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    completeEntry();
    act(() => message("back"));
    act(() => jest.advanceTimersByTime(9999));
    expect(journey.phase).toBe("returning");
    expect(journey.frameRef.current).not.toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(journey.phase).toBe("idle");
    expect(journey.frameRef.current).toBeNull();
});

test("return visibility waits for its rendered token, preserves framing and rejects stale acknowledgements", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    completeEntry();
    const view = {
        cameraOffset: { x: 2, y: 3, z: 6 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 1.2,
        avatarLift: 0,
        avatarHeight: 3.6,
        fov: 75,
        cameraMode: "third-person",
    };
    act(() => message("back", { travelView: view }));
    const token = journey.travel.startedAt;
    const frame = journey.frameRef.current;
    expect(journey.returnReady).toBe(false);
    expect(journey.travel.returnView).toEqual(view);
    view.cameraOffset.x = 99;
    expect(journey.travel.returnView.cameraOffset.x).toBe(2);
    act(() => journey.finishReturn(token));
    act(() => journey.markReturnReady(token - 1));
    expect(journey.phase).toBe("returning");
    expect(journey.returnReady).toBe(false);
    act(() => journey.markReturnReady(token));
    expect(journey.returnReady).toBe(true);
    expect(journey.frameRef.current).toBe(frame);
    act(() => message("back"));
    expect(journey.returnReady).toBe(true);
    expect(journey.travel.startedAt).toBe(token);
    act(() => journey.cancel());
    act(() => journey.markReturnReady(token));
    expect(journey.phase).toBe("idle");
    expect(journey.returnReady).toBe(false);
});

test("a reduced-motion return can acknowledge its first and final render together", () => {
    act(() => journey.select(SPACE));
    act(() => message("prepared"));
    completeEntry();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: true }),
    });
    act(() => message("back", { travelView: { cameraOffset: { x: NaN } } }));
    expect(journey.travel.returnView).toBeUndefined();
    expect(journey.travel.reducedMotion).toBe(true);
    const token = journey.travel.startedAt;
    act(() => {
        journey.markReturnReady(token);
        journey.finishReturn(token);
    });
    expect(journey.phase).toBe("idle");
    expect(journey.frameRef.current).toBeNull();
});

test("cancelling after admission discards the pending final-pose handoff", () => {
    act(() => journey.go(SPACE));
    // The destination mounts only once the avatar is seated.
    act(() => jest.advanceTimersByTime(TRAVEL_ISOLATE_MS));
    act(() =>
        jest.advanceTimersByTime(TRAVEL_DEPARTURE_MS - TRAVEL_ISOLATE_MS)
    );
    act(() => jest.advanceTimersByTime(32));
    const source = journey.frameRef.current.contentWindow;
    const attempt = journey.attempt;
    const request = jest.spyOn(source, "postMessage");
    act(() => message("prepared", { reveal: "native" }));
    act(() => jest.advanceTimersByTime(32));
    act(() => message("entered"));
    expect(journey.admitted).toBe(true);
    act(() => journey.cancel());
    act(() => message("reveal-ready", { attempt }, { source }));
    act(() => jest.advanceTimersByTime(TRAVEL_DEPARTURE_MS));
    expect(request.mock.calls.map(([command]) => command.type)).toEqual([
        "enter",
        "dispose",
    ]);
    expect(journey.phase).toBe("idle");
    expect(journey.frameRef.current).toBeNull();
});

test("a return from a top-level world waits for a rendered lobby frame, including Strict Mode", () => {
    const transition = beginLobbyReturn({
        cameraOffset: { x: 0, y: 2, z: 4 },
        cameraTargetOffset: { x: 0, y: 1, z: 0 },
        avatarRotation: 0.4,
        avatarLift: 0,
        avatarIdleTime: 2.1,
        fov: 60,
    });
    act(() =>
        root.render(
            <React.StrictMode>
                <Harness initialReturn={transition} />
            </React.StrictMode>
        )
    );
    expect(journey.phase).toBe("returning");
    expect(journey.frameUrl).toBeNull();
    expect(journey.travel).toEqual({ ...transition, phase: "return" });
    act(() => journey.finishReturn(transition.startedAt));
    expect(journey.phase).toBe("returning");
    act(() => journey.markReturnReady(transition.startedAt + 1));
    expect(document.querySelector("[data-lobby-return]")).not.toBeNull();
    act(() => journey.markReturnReady(transition.startedAt));
    expect(journey.returnReady).toBe(true);
    expect(document.querySelector("[data-lobby-return]")).toBeNull();
    expect(pendingLobbyReturn()).toBe(transition);
    act(() => journey.finishReturn(transition.startedAt + 1));
    expect(journey.phase).toBe("returning");
    act(() => journey.finishReturn(transition.startedAt));
    expect(journey.phase).toBe("idle");
    expect(pendingLobbyReturn()).toBeNull();
});
test.each(["cancel", "timeout"])(
    "a top-level return releases the cover on %s",
    (reason) => {
        const transition = beginLobbyReturn();
        act(() =>
            root.render(<Harness key="return" initialReturn={transition} />)
        );
        if (reason === "cancel") act(() => journey.cancel());
        else act(() => jest.advanceTimersByTime(10000));
        expect(journey.phase).toBe("idle");
        expect(pendingLobbyReturn()).toBeNull();
        expect(document.querySelector("[data-lobby-return]")).toBeNull();
    }
);

test("an instant trip (through the portal) travels like reduced motion", () => {
    act(() => journey.go(SPACE, { instant: true }));
    expect(journey.travel.reducedMotion).toBe(true);
    expect(journey.travel.phase).toBe("charge");
    expect(journey.travel.dissolveStartedAt).toBe(journey.travel.startedAt);
});

test("live portal admits once before crossing, then hands off the same destination", () => {
    const view = {
        cameraPosition: { x: 0, y: 2, z: 5 },
        cameraTarget: { x: 0, y: 1, z: 0 },
        playerPosition: { x: 0, y: 0, z: 2 },
        avatarRotation: 0,
        avatarHeight: 1.8,
        fov: 60,
        aspect: 1.5,
    };
    act(() => journey.select(SPACE));
    const frame = journey.frameRef.current;
    const post = jest.spyOn(frame.contentWindow, "postMessage");
    act(() => message("prepared"));
    expect(journey.renderPortal(view)).toBe(false);
    journey.renderPortal(view);
    expect(post.mock.calls.filter(([m]) => m.type === "enter")).toHaveLength(1);
    expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ portalView: view, awaitReveal: true }),
        window.location.origin
    );
    act(() => message("entered"));
    expect(journey.phase).toBe("ready");
    expect(journey.admitted).toBe(true);
    act(() => journey.crossPortal());
    expect(journey.portalCrossing).toBe(true);
    expect(journey.travel).toBeNull();
    expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ type: "reveal", portal: true }),
        window.location.origin
    );
    expect(post.mock.calls.some(([m]) => m.type === "stage-reveal")).toBe(
        false
    );
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
    expect(journey.frameRef.current).toBe(frame);
    expect(post.mock.calls.filter(([m]) => m.type === "enter")).toHaveLength(1);
});

test("only the entered iframe may mirror its current space and coordinates without remounting", () => {
    window.history.replaceState({ __N: true, key: "lobby" }, "", "/?lobby=1");
    act(() => journey.select(SPACE));
    const iframe = journey.frameRef.current;
    act(() => message("location", { href: "/too-early" }));
    expect(window.location.pathname).toBe("/");
    act(() => message("prepared", { reveal: "native" }));
    completeEntry();
    act(() => message("location", { href: "/forged" }, { source: window }));
    expect(window.location.pathname).toBe("/");
    act(() =>
        message("location", {
            href: "/next?coords=1x2x3x0.5&__lobbyAttempt=private",
        })
    );
    expect(window.location.pathname + window.location.search).toBe(
        "/next?coords=1x2x3x0.5"
    );
    expect(journey.frameRef.current).toBe(iframe);
    expect(iframe.src).toContain("/one?");
    act(() => journey.cancel());
    expect(window.location.pathname + window.location.search).toBe("/?lobby=1");
});
