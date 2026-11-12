/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useLobbyJourney } from "./useLobbyJourney";
import useLobbyGroupJourney, {
    GroupJourneySocial,
} from "./useLobbyGroupJourney";
import { LOBBY_DESTINATION_PROTOCOL } from "./lobbyJourneyProtocol";
import { sampleTravelPresentation } from "./travelPresentation";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_BLACK_AT_MS,
    TRAVEL_DEPARTURE_MS,
    WORLD_BLACK_HOLD_MS,
} from "./worldTravelTiming";

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let journey: ReturnType<typeof useLobbyJourney>, social: GroupJourneySocial;
const trip = "travel-real-123456789";
const person = (id: string) => ({
    id,
    name: id,
    avatar: "",
    vrmUrl: "",
    scale: 1,
});
function Harness() {
    journey = useLobbyJourney();
    useLobbyGroupJourney({ social, journey });
    return journey.frameUrl ? (
        <iframe
            key={journey.attempt}
            ref={journey.frameRef}
            src={journey.frameUrl}
        />
    ) : null;
}
function message(type: string, error?: object) {
    window.dispatchEvent(
        new MessageEvent("message", {
            source: journey.frameRef.current?.contentWindow,
            origin: window.location.origin,
            data: {
                protocol: LOBBY_DESTINATION_PROTOCOL,
                attempt: journey.attempt,
                type,
                error,
            },
        })
    );
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false }),
    });
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    });
    social = {
        sessionId: "self",
        groupClock: { serverNow: 1000, receivedAt: performance.now() },
        groupAction: jest.fn(async () => ({ requestId: "ack" })),
        groups: [
            {
                id: "group",
                name: "Friends",
                ownerId: "peer",
                joinCode: "CODE1234",
                members: [person("peer"), person("self")],
                messages: [],
                travel: {
                    id: trip,
                    initiatorId: "peer",
                    destination: {
                        id: "gallery",
                        title: "Gallery",
                        href: "/gallery",
                    },
                    status: "preparing",
                    responses: { peer: "accepted", self: "accepted" },
                    acceptedIds: ["peer", "self"],
                    readyIds: [],
                    poses: {},
                    expiresAt: 100000,
                },
            },
        ],
    };
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

test.each([false, true])(
    "the real host failure with a cleared attempt reports failure after start=%s",
    (afterStart) => {
        expect(journey.phase).toBe("loading");
        expect(journey.attempt).not.toBeNull();
        if (afterStart) {
            act(() => message("prepared"));
            social = {
                ...social,
                groups: [
                    {
                        ...social.groups[0],
                        travel: {
                            ...social.groups[0].travel,
                            status: "travelling",
                            startAt: 2000,
                            readyIds: ["peer", "self"],
                        },
                    },
                ],
            };
            act(() => root.render(<Harness />));
            act(() => jest.advanceTimersByTime(1000));
            expect(journey.phase).toBe("entering");
        }
        act(() =>
            message("error", {
                code: "admission-failed",
                message: "Group arrivals unavailable",
                canOpenNormally: false,
            })
        );
        expect(journey.phase).toBe("error");
        expect(journey.attempt).toBeNull();
        expect(journey.frameRef.current).toBeNull();
        expect(journey.selected.href).toBe(`/gallery?lobbyGroupCohort=${trip}`);
        const command = {
            action: afterStart ? "travel-cancel" : "travel-ready",
            groupId: "group",
            travelId: trip,
            success: false,
        };
        expect(social.groupAction).toHaveBeenLastCalledWith(command);
        act(() => root.render(<Harness />));
        expect(
            (social.groupAction as jest.Mock).mock.calls.filter(
                ([sent]) =>
                    sent.action === command.action && sent.success === false
            )
        ).toHaveLength(1);
    }
);

test("a synchronized group reaches black before admission and reports arrival only after reveal completion", () => {
    act(() => message("prepared"));
    social = {
        ...social,
        groups: [
            {
                ...social.groups[0],
                travel: {
                    ...social.groups[0].travel,
                    status: "travelling",
                    startAt: 2000,
                    readyIds: ["peer", "self"],
                },
            },
        ],
    };
    act(() => root.render(<Harness />));
    const request = jest.spyOn(
        journey.frameRef.current.contentWindow,
        "postMessage"
    );
    act(() => jest.advanceTimersByTime(1000));
    expect(journey.phase).toBe("entering");
    expect(journey.travel.dissolveStartedAt).toBe(
        journey.travel.startedAt + TRAVEL_DISSOLVE_AT_MS
    );
    act(() => message("entered"));
    expect(journey.admitted).toBe(false);
    act(() => jest.advanceTimersByTime(TRAVEL_ISOLATE_MS));
    act(() => jest.advanceTimersByTime(TRAVEL_BLACK_AT_MS - TRAVEL_ISOLATE_MS));
    expect(
        sampleTravelPresentation(
            { ...journey.travel, partyIds: ["peer"] },
            performance.now(),
            0
        ).dissolve
    ).toBeCloseTo(1, 2);
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(WORLD_BLACK_HOLD_MS));
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(request).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "enter" }),
        window.location.origin
    );
    act(() => message("entered"));
    expect(journey.admitted).toBe(true);
    expect(journey.stagingReveal).toBe(false);
    act(() =>
        jest.advanceTimersByTime(
            TRAVEL_DEPARTURE_MS -
                (performance.now() - journey.travel.startedAt) +
                1
        )
    );
    act(() => jest.advanceTimersByTime(16));
    act(() => message("reveal-ready"));
    expect(journey.phase).toBe("revealing");
    expect(
        (social.groupAction as jest.Mock).mock.calls.filter(
            ([command]) => command.action === "travel-entered"
        )
    ).toHaveLength(0);
    act(() => message("revealed"));
    expect(journey.phase).toBe("entered");
    expect(social.groupAction).toHaveBeenLastCalledWith({
        action: "travel-entered",
        groupId: "group",
        travelId: trip,
    });
    act(() => message("back"));
    expect(journey.phase).toBe("returning");
    const token = journey.travel.startedAt;
    act(() => journey.markReturnReady(token));
    act(() => journey.finishReturn(token));
    expect(journey.phase).toBe("idle");
    expect(
        (social.groupAction as jest.Mock).mock.calls.filter(
            ([command]) => command.action === "travel-entered"
        )
    ).toHaveLength(1);
});
