/** @jest-environment jsdom */
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import useLobbyGroupJourney, {
    GroupJourneyController,
    GroupJourneySocial,
} from "./useLobbyGroupJourney";

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let social: GroupJourneySocial, hook: ReturnType<typeof useLobbyGroupJourney>;
let state: GroupJourneyController, update: React.Dispatch<any>;
let sequence: number;
const select = jest.fn((destination) =>
    update((old) => ({
        ...old,
        selected: destination,
        phase: "loading",
        attempt: `attempt-${++sequence}`,
    }))
);
const enter = jest.fn(() => {
    update((old) => ({ ...old, phase: "entering" }));
    return true;
});
const cancel = jest.fn(() =>
    update((old) => ({ ...old, phase: "idle", selected: null, attempt: null }))
);
const person = (id: string) => ({
    id,
    name: id,
    avatar: "/avatar.png",
    vrmUrl: "/avatar.vrm",
    scale: 1,
});
const makeGroup = () => ({
    id: "group-one",
    name: "Friends",
    ownerId: "peer",
    joinCode: "ABCDEF12",
    members: [person("peer"), person("self")],
    messages: [],
    travel: {
        id: "travel-one-123456789",
        initiatorId: "peer",
        destination: { id: "world", title: "Gallery", href: "/gallery" },
        status: "inviting" as const,
        responses: { self: "pending" as const, peer: "accepted" as const },
        readyIds: [],
        acceptedIds: ["peer"],
        poses: {},
        expiresAt: 100000,
    },
});
function Harness() {
    const [journey, setJourney] = useState({
        phase: "idle",
        selected: null,
        attempt: null,
    });
    update = setJourney;
    state = { ...journey, select, enter, cancel } as GroupJourneyController;
    hook = useLobbyGroupJourney({ social, journey: state });
    return null;
}
const render = () => act(() => root.render(<Harness />));
const changeTravel = (patch: any) => {
    social = {
        ...social,
        groups: social.groups.map((group) => ({
            ...group,
            travel: { ...group.travel, ...patch },
        })),
    };
    render();
};
const accepted = () =>
    changeTravel({
        status: "preparing",
        responses: { self: "accepted", peer: "accepted" },
        acceptedIds: ["peer", "self"],
    });
const phase = (value: string) =>
    act(() => update((old) => ({ ...old, phase: value })));
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    jest.clearAllMocks();
    sequence = 0;
    social = {
        sessionId: "self",
        groups: [makeGroup()],
        groupClock: { serverNow: 1000, receivedAt: performance.now() },
        groupAction: jest.fn(async () => ({ requestId: "result" })),
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});

test("receiving a travel invitation never prepares a frame until self acceptance is confirmed", async () => {
    render();
    expect(select).not.toHaveBeenCalled();
    await act(async () => {
        await hook.accept("group-one", "travel-one-123456789");
    });
    expect(social.groupAction).toHaveBeenCalledWith({
        action: "travel-respond",
        groupId: "group-one",
        travelId: "travel-one-123456789",
        accepted: true,
    });
    expect(select).not.toHaveBeenCalled();
    accepted();
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith({
        id: "world",
        title: "Gallery",
        href: "/gallery?lobbyGroupCohort=travel-one-123456789",
    });
    expect(social.groupAction).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "travel-ready" })
    );
    phase("ready");
    expect(social.groupAction).toHaveBeenCalledWith({
        action: "travel-ready",
        groupId: "group-one",
        travelId: "travel-one-123456789",
        success: true,
    });
});

test("actual frame readiness waits for one server start and ordinary admission before entered reporting", () => {
    render();
    accepted();
    phase("ready");
    changeTravel({
        status: "travelling",
        startAt: 2000,
        readyIds: ["self", "peer"],
    });
    act(() => jest.advanceTimersByTime(999));
    expect(enter).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(enter).toHaveBeenCalledTimes(1);
    expect(state.phase).toBe("entering");
    expect(social.groupAction).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "travel-entered" })
    );
    changeTravel({ status: "travelling", startAt: 2000 });
    act(() => jest.advanceTimersByTime(1000));
    expect(enter).toHaveBeenCalledTimes(1);
    phase("entered");
    expect(social.groupAction).toHaveBeenCalledWith({
        action: "travel-entered",
        groupId: "group-one",
        travelId: "travel-one-123456789",
    });
});

test("cancellation before the start disposes the owned frame and cannot enter later", () => {
    render();
    accepted();
    phase("ready");
    changeTravel({
        status: "travelling",
        startAt: 2000,
        readyIds: ["self", "peer"],
    });
    changeTravel({ status: "cancelled", reason: "A member left" });
    expect(cancel).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(2000));
    expect(enter).not.toHaveBeenCalled();
    expect(state.phase).toBe("idle");
});

test("a new session cannot inherit a delayed start or the old formation", () => {
    render();
    accepted();
    phase("ready");
    changeTravel({
        status: "travelling",
        startAt: 2000,
        readyIds: ["self", "peer"],
    });
    social = { ...social, sessionId: "replacement", groups: [] };
    render();
    act(() => jest.advanceTimersByTime(2000));
    expect(enter).not.toHaveBeenCalled();
    expect(hook.formation).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
});

test("destination failures are reported without entering or bypassing the host", () => {
    render();
    accepted();
    phase("error");
    expect(social.groupAction).toHaveBeenCalledWith({
        action: "travel-ready",
        groupId: "group-one",
        travelId: "travel-one-123456789",
        success: false,
    });
    expect(enter).not.toHaveBeenCalled();
});

test("formation uses accepted authoritative member order, exact poses and stable profiles", () => {
    render();
    accepted();
    const poses = {
        peer: { x: 4, y: 0, z: 2, rotation: 1 },
        self: { x: 5, y: 0, z: 3, rotation: 1 },
    };
    changeTravel({ status: "gathering", poses });
    const formed = hook.formation;
    expect(formed.members.map((member) => member.id)).toEqual(["peer", "self"]);
    expect(formed.poses).toEqual(poses);
    act(() => jest.advanceTimersByTime(500));
    changeTravel({ status: "travelling", startAt: 3000 });
    expect(hook.formation.startedAt).toBe(formed.startedAt);
    expect(hook.formation.members).toBe(formed.members);
});

test("formation follows a traveller who returns on a new session, and one the trip left behind", () => {
    social.groups[0].members.push(person("third"));
    render();
    changeTravel({
        status: "preparing",
        responses: { self: "accepted", peer: "accepted", third: "accepted" },
        acceptedIds: ["peer", "self", "third"],
    });
    const pose = { x: 4, y: 0, z: 2, rotation: 1 };
    changeTravel({
        status: "gathering",
        poses: { peer: pose, self: pose, third: pose },
    });
    const formed = hook.formation;
    const ids = () => hook.formation.members.map((member) => member.id);
    expect(ids()).toEqual(["peer", "self", "third"]);

    // The peer dropped and came back: same person, new session id.
    social = {
        ...social,
        groups: social.groups.map((group) => ({
            ...group,
            ownerId: "peer-2",
            members: [person("peer-2"), person("self"), person("third")],
            travel: {
                ...group.travel,
                initiatorId: "peer-2",
                responses: {
                    self: "accepted",
                    "peer-2": "accepted",
                    third: "accepted",
                },
                acceptedIds: ["peer-2", "self", "third"],
                poses: { "peer-2": pose, self: pose, third: pose },
            },
        })),
    };
    render();
    expect(ids()).toEqual(["peer-2", "self", "third"]);
    expect(hook.formation.startedAt).toBe(formed.startedAt);

    // The third traveller never returned: the trip goes on without them.
    changeTravel({
        responses: {
            self: "accepted",
            "peer-2": "accepted",
            third: "declined",
        },
        acceptedIds: ["peer-2", "self"],
        poses: { "peer-2": pose, self: pose },
    });
    expect(ids()).toEqual(["peer-2", "self"]);
    expect(hook.formation.startedAt).toBe(formed.startedAt);
});

test("declining an invitation never prepares a destination", async () => {
    render();
    await act(async () => {
        await hook.decline("group-one", "travel-one-123456789");
    });
    changeTravel({ responses: { self: "declined", peer: "accepted" } });
    expect(select).not.toHaveBeenCalled();
    expect(enter).not.toHaveBeenCalled();
});

test("another accepted trip becomes active after the old one is cancelled", () => {
    render();
    accepted();
    const next = makeGroup();
    next.id = "group-two";
    next.travel.id = "travel-two-123456789";
    social = {
        ...social,
        groups: [
            {
                ...social.groups[0],
                travel: { ...social.groups[0].travel, status: "cancelled" },
            },
            {
                ...next,
                travel: {
                    ...next.travel,
                    responses: { self: "accepted", peer: "accepted" },
                    acceptedIds: ["peer", "self"],
                },
            },
        ],
    };
    render();
    expect(hook.activeTravel.id).toBe("travel-two-123456789");
    expect(select).toHaveBeenLastCalledWith(
        expect.objectContaining({
            href: "/gallery?lobbyGroupCohort=travel-two-123456789",
        })
    );
});

test("a cancellation after local entry returns the participant until the group completes", () => {
    render();
    accepted();
    phase("ready");
    changeTravel({ status: "travelling", startAt: 2000, readyIds: ["self", "peer"] });
    act(() => jest.advanceTimersByTime(1000));
    phase("entered");
    changeTravel({ status: "cancelled", reason: "A traveller could not enter" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(state.phase).toBe("idle");
    expect(hook.error).toBe("A traveller could not enter");
});

test("a completed destination remains open if the source group connection later disappears", () => {
    render();
    accepted();
    phase("ready");
    changeTravel({ status: "travelling", startAt: 2000, readyIds: ["self", "peer"] });
    act(() => jest.advanceTimersByTime(1000));
    phase("entered");
    changeTravel({ status: "complete" });
    social = { ...social, sessionId: "", groups: [] };
    render();
    expect(cancel).not.toHaveBeenCalled();
    expect(state.phase).toBe("entered");
});

test("host admission failure after synchronized start cancels the shared trip", () => {
    render();
    accepted();
    phase("ready");
    changeTravel({ status: "travelling", startAt: 2000, readyIds: ["self", "peer"] });
    act(() => jest.advanceTimersByTime(1000));
    phase("error");
    expect(social.groupAction).toHaveBeenLastCalledWith({
        action: "travel-cancel", groupId: "group-one", travelId: "travel-one-123456789", success: false,
    });
    expect(state.phase).toBe("error");
});


test("joining the next trip from a destination returns to the lobby before accepting", async () => {
    render();
    phase("entered");
    changeTravel({ id: "travel-next-123456789" });
    expect(state.phase).toBe("entered");
    expect(cancel).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    let acknowledgePresence: (value: any) => void;
    (social.groupAction as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
        acknowledgePresence = resolve;
    }));
    let joined: ReturnType<typeof hook.accept>;
    act(() => { joined = hook.accept("group-one", "travel-next-123456789"); });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(state.phase).toBe("idle");
    expect(social.groupAction).toHaveBeenCalledTimes(1);
    expect(social.groupAction).toHaveBeenLastCalledWith({ action: "active-world", active: false });
    await act(async () => {
        acknowledgePresence({ requestId: "presence" });
        await joined;
    });
    expect(social.groupAction).toHaveBeenLastCalledWith({
        action: "travel-respond", groupId: "group-one", travelId: "travel-next-123456789", accepted: true,
    });
    expect(select).not.toHaveBeenCalled();
    accepted();
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ href: "/gallery?lobbyGroupCohort=travel-next-123456789" }));
});

test("failed lobby return cannot accept a trip from an active destination", async () => {
    render();
    phase("entered");
    (social.groupAction as jest.Mock).mockRejectedValueOnce(new Error("Return failed"));
    await act(async () => {
        await expect(hook.accept("group-one", "travel-one-123456789")).rejects.toThrow("Return failed");
    });
    expect(social.groupAction).toHaveBeenCalledTimes(1);
    expect(social.groupAction).not.toHaveBeenCalledWith(expect.objectContaining({ action: "travel-respond" }));
    expect(select).not.toHaveBeenCalled();
});
