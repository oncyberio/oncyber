/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useLobbyJourney, { LOBBY_FRAME_MOUNT_MS } from "./useLobbyJourney";
import { LOBBY_DESTINATION_PROTOCOL } from "./lobbyJourneyProtocol";
import { startLoadTimeline } from "@utils/loadTimings";
import { TRAVEL_DEPARTURE_MS, TRAVEL_ISOLATE_MS } from "./worldTravelTiming";

jest.mock("@utils/loadTimings", () => ({ startLoadTimeline: jest.fn() }));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let journey: ReturnType<typeof useLobbyJourney>;
let nonce = 0;
let timeline: { mark: jest.Mock; end: jest.Mock; cancel: jest.Mock };
const SPACE = { id: "one", title: "One", href: "/one" };
function Harness() {
    journey = useLobbyJourney();
    return journey.frameUrl ? (
        <iframe
            key={journey.attempt}
            ref={journey.frameRef}
            src={journey.frameUrl}
        />
    ) : null;
}
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
function message(type: string, overrides = {}) {
    act(() =>
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
            })
        )
    );
}
const stages = () => timeline.mark.mock.calls.map(([stage]) => stage);
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false }),
    });
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: { randomUUID: () => `trip-attempt-${++nonce}-0000000000` },
    });
    timeline = { mark: jest.fn(), end: jest.fn(), cancel: jest.fn() };
    (startLoadTimeline as jest.Mock).mockReset().mockReturnValue(timeline);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});

test("the held frame still mounts once the departure has finished", () => {
    expect(LOBBY_FRAME_MOUNT_MS).toBe(TRAVEL_DEPARTURE_MS);
});

test("a trip records every stage of its load timeline", () => {
    act(() => journey.go(SPACE));
    expect(startLoadTimeline).toHaveBeenCalledWith("lobby-trip");
    expect(stages()).toEqual(["selection"]);
    advance(TRAVEL_ISOLATE_MS);
    advance(LOBBY_FRAME_MOUNT_MS);
    advance(16);
    advance(16);
    expect(stages()).toContain("frame-mounted");
    message("prepared", { reveal: "native" });
    expect(stages().at(-1)).toBe("prepared");
    advance(TRAVEL_DEPARTURE_MS);
    message("entered");
    expect(stages().at(-1)).toBe("entered");
    advance(16);
    message("reveal-ready");
    expect(journey.phase).toBe("revealing");
    expect(timeline.end).not.toHaveBeenCalled();
    message("revealed");
    expect(journey.phase).toBe("entered");
    expect(timeline.end).toHaveBeenCalledWith(
        "revealed",
        expect.objectContaining({ outcome: "entered", held: true })
    );
});

test("cancelling abandons the timeline", () => {
    act(() => journey.go(SPACE));
    act(() => journey.cancel());
    expect(timeline.cancel).toHaveBeenCalledTimes(1);
    expect(timeline.end).not.toHaveBeenCalled();
});

test("a failed trip ends its timeline as failed", () => {
    act(() => journey.go(SPACE));
    advance(TRAVEL_ISOLATE_MS);
    advance(LOBBY_FRAME_MOUNT_MS);
    advance(16);
    advance(16);
    message("error", { error: { code: "load-failed", message: "No" } });
    expect(timeline.end).toHaveBeenCalledWith(
        "failed",
        expect.objectContaining({ outcome: "failed", code: "load-failed" })
    );
});

test("a trip left loading in a background tab does not time out while hidden", () => {
    let hidden = false;
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => hidden,
    });
    const setHidden = (value: boolean) => {
        hidden = value;
        act(() => document.dispatchEvent(new Event("visibilitychange")));
    };
    try {
        act(() => journey.go(SPACE));
        const selectedAt = performance.now();
        advance(TRAVEL_ISOLATE_MS);
        advance(TRAVEL_DEPARTURE_MS);
        advance(16);
        advance(16);
        expect(journey.phase).toBe("loading");
        advance(30_000);
        const visible = performance.now() - selectedAt;
        setHidden(true);
        advance(10 * 60_000);
        expect(journey.phase).toBe("loading");
        setHidden(false);
        // 90 s of visible time in all, counted from selection.
        advance(90_000 - visible - 5);
        expect(journey.phase).toBe("loading");
        advance(10);
        expect(journey.phase).toBe("error");
        expect(journey.error.code).toBe("timeout");
    } finally {
        delete (document as any).hidden;
    }
});

test("a frame that mounts at once (group preparation) marks it at selection", () => {
    act(() => journey.select(SPACE));
    expect(journey.frameRef.current).not.toBeNull();
    expect(stages()).toEqual(["selection", "frame-mounted"]);
});
