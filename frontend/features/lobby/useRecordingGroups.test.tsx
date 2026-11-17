/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createRecordingCrowd, parseRecordingCrowd } from "./recordingCrowd";
import useRecordingGroups from "./useRecordingGroups";
import type {
    LobbyGroup,
    LobbyGroupAction,
    LobbyGroupInvitation,
    LobbyGroupResult,
} from "../../../multiplayer/protocol/lobby-groups";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const crowd = createRecordingCrowd(parseRecordingCrowd("?crowd=12"), [
    { url: "https://x/a.vrm" },
]);
const live = {
    sessionId: "me",
    groupsSupported: false,
    groups: [] as LobbyGroup[],
    invitations: [] as LobbyGroupInvitation[],
    groupMessages: [] as LobbyGroup["messages"],
    groupClock: null,
    groupAction: (_command: Omit<LobbyGroupAction, "requestId">) =>
        Promise.reject<LobbyGroupResult>(new Error("no server")),
    getPredictedPose: () => ({ x: 0, y: 0, z: 0, rotation: 0 }),
};

test("staged people join your party and travel with you", async () => {
    jest.useFakeTimers();
    let social: ReturnType<typeof useRecordingGroups<typeof live>>;
    function Probe() {
        social = useRecordingGroups(live, crowd, { name: "Me" }, false);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe />));
    expect(social.groupsSupported).toBe(true);
    const invited = social.groupPlayers.slice(0, 3).map((p) => p.id);

    let groupId: string;
    await act(async () => {
        groupId = (
            await social.groupAction({
                action: "create",
                name: "Crew",
                memberIds: invited,
            })
        ).groupId;
    });
    await act(async () => jest.advanceTimersByTime(3000));
    expect(social.groups[0].members.map((m) => m.id).sort()).toEqual(
        ["me", ...invited].sort()
    );

    await act(async () => {
        await social.groupAction({
            action: "travel-propose",
            groupId,
            destination: { id: "space1", title: "Space", href: "/space1" },
        });
    });
    await act(async () => jest.advanceTimersByTime(4000));
    const travel = () => social.groups[0].travel;
    expect(travel().acceptedIds).toHaveLength(4);
    // You get ready yourself; the staged people already have.
    await act(async () => {
        await social.groupAction({
            action: "travel-ready",
            groupId,
            travelId: travel().id,
            success: true,
        });
    });
    await act(async () => jest.advanceTimersByTime(2500));
    expect(travel().status).toBe("travelling");
    expect(Object.keys(travel().poses)).toHaveLength(4);

    // A real party server wins: nothing is mocked.
    await act(async () => root.unmount());
    jest.useRealTimers();
});

test("outside a recording the lobby's own parties are untouched", async () => {
    let social: typeof live;
    function Probe() {
        social = useRecordingGroups(live, null, { name: "Me" }, false);
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe />));
    expect(social).toBe(live);
    await act(async () => root.unmount());
});
