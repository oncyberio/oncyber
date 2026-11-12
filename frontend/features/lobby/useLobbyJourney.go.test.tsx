/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useLobbyJourney from "./useLobbyJourney";
import { sampleTravelPresentation } from "./travelPresentation";
import { LOBBY_DESTINATION_PROTOCOL } from "./lobbyJourneyProtocol";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_BLACK_AT_MS,
    TRAVEL_DEPARTURE_MS,
    WORLD_DISSOLVE_MS,
    WORLD_BLACK_HOLD_MS,
} from "./worldTravelTiming";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let journey: ReturnType<typeof useLobbyJourney>;
let nonce = 0;
const SPACE = { id: "one", title: "One", href: "/one" };
const DEPARTURE_MS = TRAVEL_DEPARTURE_MS;
const ADMISSION_MS = TRAVEL_BLACK_AT_MS + WORLD_BLACK_HOLD_MS;
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
function message(
    type: string,
    overrides = {},
    source = journey.frameRef.current?.contentWindow
) {
    act(() =>
        window.dispatchEvent(
            new MessageEvent("message", {
                source,
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
// The destination document mounts only once the avatar is seated.
function mountDestination() {
    advance(TRAVEL_ISOLATE_MS);
    advance(DEPARTURE_MS - TRAVEL_ISOLATE_MS);
    advance(16);
    advance(16);
}
function finishDeparture() {
    advance(TRAVEL_ISOLATE_MS);
    advance(DEPARTURE_MS - TRAVEL_ISOLATE_MS);
    advance(16);
    advance(16);
}
const sample = () =>
    sampleTravelPresentation(
        { ...journey.travel, partyIds: [] },
        performance.now(),
        journey.travel.startedAt
    );
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false }),
    });
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: { randomUUID: () => `go-attempt-${++nonce}` },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test("choosing a destination mounts its document only once the avatar is seated", () => {
    act(() => expect(journey.go(SPACE)).toBe(true));
    const startedAt = journey.travel.startedAt;
    const attempt = journey.attempt;
    expect(journey.phase).toBe("loading");
    expect(journey.travel.phase).toBe("isolate");
    expect(journey.travel.dissolveStartedAt).toBe(
        startedAt + TRAVEL_DISSOLVE_AT_MS
    );
    expect(sample()).toMatchObject({ cameraMix: 0, dissolve: 0 });
    expect(journey.frameUrl).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    // No document prefetch: world pages are sent no-store, so the browser
    // would discard it and the frame would render the page a second time.
    expect(
        document.head.querySelector('link[rel="prefetch"][as="document"]')
    ).toBeNull();
    advance(TRAVEL_ISOLATE_MS / 2);
    expect(sample()).toMatchObject({ cameraMix: 0.5, dissolve: 0 });
    expect(journey.frameRef.current).toBeNull();
    advance(TRAVEL_ISOLATE_MS / 2);
    expect(journey.travel.phase).toBe("charge");
    expect(journey.frameRef.current).toBeNull();
    // Booting the document stalls the main thread: never during the jump.
    advance(TRAVEL_DISSOLVE_AT_MS - (performance.now() - startedAt));
    expect(sample().dissolve).toBeCloseTo(0, 2);
    advance(WORLD_DISSOLVE_MS);
    expect(sample()).toMatchObject({
        cameraMix: 1,
        lift: 0,
        animation: "TRAVEL_ATTACK",
    });
    expect(sample().dissolve).toBeCloseTo(1, 2);
    expect(journey.frameRef.current).toBeNull();
    advance(DEPARTURE_MS - TRAVEL_BLACK_AT_MS);
    expect(journey.frameRef.current).toBeNull();
    advance(16);
    expect(journey.frameRef.current).toBeNull();
    advance(16);
    expect(sample().animation).toBe("TRAVEL_CROUCH_IDLE");
    const frame = journey.frameRef.current;
    expect(frame).not.toBeNull();
    expect(frame.src).toContain(`/one?__lobbyAttempt=${attempt}`);
    expect(journey.attempt).toBe(attempt);
    expect(journey.travel.startedAt).toBe(startedAt);
});

test("a prepared automatic trip enters without a second click and reveals only after native staging", () => {
    act(() => journey.go(SPACE));
    finishDeparture();
    const frame = journey.frameRef.current;
    const request = jest.spyOn(frame.contentWindow, "postMessage");
    const startedAt = journey.travel.startedAt;
    message("prepared", { reveal: "native" });
    expect(journey.phase).toBe("entering");
    expect(journey.travel.startedAt).toBe(startedAt);
    expect(journey.enter()).toBe(false);
    advance(32);
    expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ type: "enter", awaitReveal: true }),
        window.location.origin
    );
    message("prepared");
    expect(journey.travel.startedAt).toBe(startedAt);
    message("reveal-ready");
    expect(journey.phase).toBe("entering");
    message("entered");
    advance(16);
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "stage-reveal" }),
        window.location.origin
    );
    message("reveal-ready");
    expect(journey.phase).toBe("revealing");
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "reveal" }),
        window.location.origin
    );
    message("revealed");
    expect(journey.phase).toBe("entered");
    expect(journey.frameRef.current).toBe(frame);
});

test("slow asset loading stays black and keeps the full preparation timeout", () => {
    act(() => journey.go(SPACE));
    finishDeparture();
    const frame = journey.frameRef.current;
    advance(60_000);
    expect(journey.phase).toBe("loading");
    expect(sample().dissolve).toBe(1);
    expect(journey.frameRef.current).toBe(frame);
    message("progress", { progress: 0.6 });
    expect(journey.progress).toBe(0.6);
    message("prepared");
    expect(journey.phase).toBe("entering");
    expect(sample().dissolve).toBe(1);
});

test.each([
    0,
    TRAVEL_ISOLATE_MS - 1,
    TRAVEL_ISOLATE_MS,
    TRAVEL_ISOLATE_MS + 16,
    TRAVEL_ISOLATE_MS + WORLD_DISSOLVE_MS / 2,
    DEPARTURE_MS,
    DEPARTURE_MS + 16,
])(
    "cancelling at %ims disposes the loading frame and prevents late entry",
    (elapsed) => {
        act(() => journey.go(SPACE));
        const attempt = journey.attempt;
        advance(elapsed);
        const frame = journey.frameRef.current;
        const source = frame?.contentWindow || window;
        const request = frame ? jest.spyOn(source, "postMessage") : null;
        act(() => journey.cancel());
        if (request)
            expect(request).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: "dispose", attempt }),
                window.location.origin
            );
        expect(
            document.head.querySelector('link[rel="prefetch"][as="document"]')
        ).toBeNull();
        message("prepared", { attempt }, source);
        message("entered", { attempt }, source);
        advance(100_000);
        expect(journey.phase).toBe("idle");
        expect(journey.travel).toBeNull();
        expect(container.querySelector("iframe")).toBeNull();
    }
);

test.each([0, ADMISSION_MS, ADMISSION_MS + 16])(
    "cancelling a prepared frame at %ims clears the pending admission fence",
    (elapsed) => {
        act(() => journey.go(SPACE));
        const startedAt = journey.travel.startedAt;
        mountDestination();
        const source = journey.frameRef.current.contentWindow;
        const request = jest.spyOn(source, "postMessage");
        message("prepared", { reveal: "native" });
        advance(Math.max(0, elapsed - (performance.now() - startedAt)));
        expect(request).not.toHaveBeenCalled();
        act(() => journey.cancel());
        advance(100_000);
        expect(request.mock.calls.map(([command]) => command.type)).toEqual([
            "dispose",
        ]);
        expect(journey.phase).toBe("idle");
        expect(container.querySelector("iframe")).toBeNull();
    }
);

test("duplicate choices retain the loading frame and a replacement rejects stale readiness", () => {
    act(() => journey.go(SPACE));
    const attempt = journey.attempt;
    mountDestination();
    const source = journey.frameRef.current.contentWindow;
    act(() => expect(journey.go(SPACE)).toBe(false));
    expect(journey.attempt).toBe(attempt);
    advance(400);
    act(() => journey.select({ id: "two", title: "Two", href: "/two" }));
    const frame = journey.frameRef.current;
    finishDeparture();
    expect(journey.frameRef.current).toBe(frame);
    expect(journey.frameUrl).toContain("/two?");
    expect(journey.travel).toBeNull();
    message("prepared", { attempt }, source);
    expect(journey.phase).toBe("loading");
    message("prepared", { attempt });
    expect(journey.phase).toBe("loading");
    message("prepared");
    expect(journey.phase).toBe("ready");
});

test("reduced motion loads immediately but still paints black before admission", () => {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: true }),
    });
    act(() => journey.go(SPACE));
    expect(sample().dissolve).toBe(1);
    const frame = journey.frameRef.current;
    expect(frame).not.toBeNull();
    const request = jest.spyOn(frame.contentWindow, "postMessage");
    message("prepared", { reveal: "native" });
    expect(request).not.toHaveBeenCalled();
    advance(16);
    expect(request).not.toHaveBeenCalled();
    advance(16);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({
            type: "enter",
            reducedMotion: true,
            awaitReveal: true,
        }),
        window.location.origin
    );
    expect(journey.frameRef.current).toBe(frame);
});

test("failed or timed out preparation restores the lobby and invalid URLs never start travel", () => {
    act(() => journey.go(SPACE));
    finishDeparture();
    message("error", {
        error: { code: "load-failed", message: "Unavailable" },
    });
    expect(journey.phase).toBe("error");
    expect(journey.travel).toBeNull();
    expect(journey.frameUrl).toBeNull();
    act(() => journey.go(SPACE));
    finishDeparture();
    advance(90_000);
    expect(journey.phase).toBe("error");
    expect(journey.travel).toBeNull();
    expect(journey.frameUrl).toBeNull();
    act(() =>
        expect(journey.go({ ...SPACE, href: "https://external.example" })).toBe(
            false
        )
    );
    expect(journey.error.code).toBe("unsupported");
    expect(journey.travel).toBeNull();
});

test("duplicate progress causes no journey render during departure", () => {
    act(() => journey.go(SPACE));
    mountDestination();
    message("progress", { progress: 0.6 });
    const rendered = journey;
    message("progress", { progress: 0.6 });
    expect(journey).toBe(rendered);
    message("progress", { progress: 0.2 });
    expect(journey).toBe(rendered);
    message("progress", { progress: 0.8 });
    expect(journey.progress).toBe(0.8);
});

test("replacing a pending choice never mounts its stale frame", () => {
    act(() => journey.go(SPACE));
    const oldAttempt = journey.attempt;
    advance(400);
    act(() => journey.select({ id: "two", title: "Two", href: "/two" }));
    const selected = journey.frameRef.current;
    expect(selected).not.toBeNull();
    expect(journey.attempt).not.toBe(oldAttempt);
    advance(1000);
    expect(journey.frameRef.current).toBe(selected);
    expect(journey.frameUrl).toContain("/two?");
    expect(journey.travel).toBeNull();
    expect(
        document.head.querySelector('link[rel="prefetch"][as="document"]')
    ).toBeNull();
});

test("unmounting during the opening cancels both mount fences", () => {
    act(() => journey.go(SPACE));
    advance(TRAVEL_ISOLATE_MS + 16);
    expect(journey.frameRef.current).toBeNull();
    act(() => root.render(null));
    advance(100_000);
    expect(container.querySelector("iframe")).toBeNull();
    expect(
        document.head.querySelector('link[rel="prefetch"][as="document"]')
    ).toBeNull();
});

test("effect replay preserves the pending destination while replacing its timers", () => {
    const effect = React.useEffect;
    jest.spyOn(React, "useEffect").mockImplementation((setup, dependencies) =>
        effect(() => {
            // React development replay retains refs/state while replacing effects.
            const cleanup = setup();
            if (typeof cleanup === "function") cleanup();
            return setup();
        }, dependencies)
    );
    act(() => journey.go(SPACE));
    const attempt = journey.attempt;
    expect(journey.frameRef.current).toBeNull();
    mountDestination();
    expect(journey.frameRef.current).not.toBeNull();
    expect(journey.frameUrl).toContain(`__lobbyAttempt=${attempt}`);
    expect(journey.travel.phase).toBe("charge");
    expect(
        document.head.querySelectorAll('link[rel="prefetch"][as="document"]')
    ).toHaveLength(0);
});
