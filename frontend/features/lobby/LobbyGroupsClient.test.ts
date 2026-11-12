/** @jest-environment jsdom */
import { LobbyConnection, initialLobbySnapshot } from "./LobbyConnection";
import { readLobbyGroups } from "./lobbyGroupValidation";

const member = (id: string) => ({
    id,
    name: id,
    avatar: "/avatar.png",
    vrmUrl: "/model.vrm",
    scale: 1,
});
const snapshot = () => ({
    supported: true,
    serverNow: 1000,
    invitations: [],
    groups: [
        {
            id: "group-one",
            name: "Friends",
            ownerId: "self",
            joinCode: "ABCDEF12",
            members: [member("self"), member("peer")],
            messages: [
                {
                    id: "message-one",
                    groupId: "group-one",
                    sessionId: "peer",
                    name: "Peer",
                    avatar: "/peer.png",
                    text: "Group secret",
                    sentAt: 900,
                },
            ],
        },
    ],
});
let connection: LobbyConnection;
let client: any;
let room: any;
beforeEach(() => {
    jest.useFakeTimers();
    room = {
        sessionId: "self",
        send: jest.fn(),
        leave: jest.fn(async () => {}),
    };
    connection = new LobbyConnection({ username: "Me" }, jest.fn());
    client = connection as any;
    client.room = room;
    client.welcomed = true;
    client.snapshot = {
        ...initialLobbySnapshot(),
        status: "connected",
        sessionId: "self",
    };
    client.receiveGroups(snapshot());
});
afterEach(async () => {
    await connection.close();
    jest.useRealTimers();
});

test("authoritative group history stays separate from global and direct messages", () => {
    expect(connection.snapshot.groups).toHaveLength(1);
    expect(connection.snapshot.groupMessages[0].text).toBe("Group secret");
    expect(connection.snapshot.messages).toEqual([]);
    const next = snapshot();
    client.receiveGroups(next);
    next.groups[0].messages[0].text = "mutated transport object";
    expect(connection.snapshot.groupMessages[0].text).toBe("Group secret");
    client.receiveGroups({ ...snapshot(), groups: [] });
    expect(connection.snapshot.groupMessages).toEqual([]);
});

test("malformed or foreign membership snapshots cannot replace approved group data", () => {
    const foreign = snapshot();
    foreign.groups[0].members = [member("outsider")];
    expect(readLobbyGroups(foreign, "self")).toBeNull();
    client.receiveGroups(foreign);
    expect(
        connection.snapshot.groups[0].members.map((entry) => entry.id)
    ).toEqual(["self", "peer"]);
    const malicious = snapshot();
    malicious.groups[0].members[0].avatar = "javascript:alert(1)";
    expect(readLobbyGroups(malicious, "self")).toBeNull();
    expect(
        readLobbyGroups(
            { ...snapshot(), groups: Array(17).fill(snapshot().groups[0]) },
            "self"
        )
    ).toBeNull();
});

test("group commands use unique request IDs and resolve only their matching response", async () => {
    const first = connection.groupAction({
        action: "message",
        groupId: "group-one",
        text: "Hello group",
    });
    const second = connection.groupAction({
        action: "invite",
        groupId: "group-one",
        inviteeId: "peer",
    });
    const firstPayload = room.send.mock.calls[0][1],
        secondPayload = room.send.mock.calls[1][1];
    expect(room.send.mock.calls[0][0]).toBe("lobby-group-action");
    expect(firstPayload.requestId).not.toBe(secondPayload.requestId);
    expect(connection.snapshot.messages).toEqual([]);
    let resolved = false;
    first.then(() => {
        resolved = true;
    });
    client.receiveGroupResult({
        requestId: "forged-response",
        groupId: "other",
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    client.receiveGroupResult({
        requestId: secondPayload.requestId,
        groupId: "group-one",
    });
    await expect(second).resolves.toMatchObject({ groupId: "group-one" });
    client.receiveGroupResult({
        requestId: firstPayload.requestId,
        groupId: "group-one",
    });
    await expect(first).resolves.toMatchObject({
        requestId: firstPayload.requestId,
    });
});

test("server rejection, timeouts, and disconnects reject pending commands", async () => {
    const rejected = connection.groupAction({
        action: "leave",
        groupId: "group-one",
    });
    const rejection = expect(rejected).rejects.toThrow("GROUP_NOT_FOUND");
    client.receiveGroupResult({
        requestId: room.send.mock.calls.at(-1)[1].requestId,
        error: "GROUP_NOT_FOUND",
    });
    await rejection;
    const timedOut = connection.groupAction({
        action: "create",
        name: "New group",
    });
    const timeout = expect(timedOut).rejects.toThrow("timed out");
    jest.advanceTimersByTime(8000);
    await timeout;
    const pending = connection.groupAction({
        action: "create",
        name: "Another",
    });
    const disconnected = expect(pending).rejects.toThrow("connection changed");
    await connection.close();
    await disconnected;
});

test("request count is bounded without emitting excess commands", async () => {
    const requests = Array.from({ length: 16 }, () =>
        connection
            .groupAction({ action: "create", name: "Group" })
            .catch(() => {})
    );
    await expect(
        connection.groupAction({ action: "create", name: "Overflow" })
    ).rejects.toThrow("Please wait");
    expect(room.send).toHaveBeenCalledTimes(16);
    await connection.close();
    await Promise.all(requests);
});

test("destination presence stops movement and microphone while group commands retain the socket", async () => {
    const stop = jest.fn();
    client.microphone = { getTracks: () => [{ stop }] };
    connection.setLobbyPresence(false);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(room.leave).not.toHaveBeenCalled();
    expect(connection.snapshot.lobbyPresent).toBe(false);
    expect(room.send).toHaveBeenCalledWith(
        "lobby-group-action",
        expect.objectContaining({ action: "active-world", active: true })
    );
    room.send.mockClear();
    connection.updatePosition({ x: 10, y: 0, z: 0, rotation: 0 });
    jest.advanceTimersByTime(100);
    expect(room.send).not.toHaveBeenCalled();
    const message = connection.groupAction({
        action: "message",
        groupId: "group-one",
        text: "Still together",
    });
    client.receiveGroupResult({
        requestId: room.send.mock.calls[0][1].requestId,
    });
    await expect(message).resolves.toBeDefined();
});

test("authoritative gathering pose blocks local movement until release", () => {
    client.receiveGroupPosition({
        travelId: "travel-one",
        pose: { x: 4, y: 0, z: 6, rotation: 1 },
        held: true,
        serverNow: 1000,
    });
    expect(connection.getPredictedPose()).toMatchObject({ x: 4, z: 6 });
    connection.updatePosition({ x: 99, y: 0, z: 99, rotation: 0 });
    jest.advanceTimersByTime(100);
    expect(connection.getPredictedPose()).toMatchObject({ x: 4, z: 6 });
    expect(room.send).not.toHaveBeenCalled();
    client.receiveGroupPosition({
        travelId: "travel-one",
        pose: { x: 4, y: 0, z: 6, rotation: 1 },
        held: false,
        serverNow: 1100,
    });
    connection.updatePosition({ x: 5, y: 0, z: 6, rotation: 1 });
    jest.advanceTimersByTime(100);
    expect(connection.getPredictedPose().x).toBe(5);
    expect(room.send).toHaveBeenCalled();
});

test("cancelled trips preserve departed participant history so remaining members receive cancellation", () => {
    const next: any = snapshot();
    next.groups[0].members = [member("self")];
    next.groups[0].travel = {
        id: "travel-one-123456789",
        initiatorId: "peer",
        status: "cancelled",
        destination: { id: "world", title: "Gallery", href: "/gallery" },
        responses: { self: "accepted", peer: "accepted" },
        acceptedIds: ["peer", "self"],
        readyIds: ["peer", "self"],
        poses: {
            peer: { x: 0, y: 0, z: 0, rotation: 0 },
            self: { x: 1, y: 0, z: 0, rotation: 0 },
        },
        expiresAt: 2000,
        reason: "A traveller left",
    };
    client.receiveGroups(next);
    expect(connection.snapshot.groups[0].travel.status).toBe("cancelled");
    expect(connection.snapshot.groups[0].travel.acceptedIds).toEqual([
        "peer",
        "self",
    ]);
    next.groups[0].travel.status = "travelling";
    expect(readLobbyGroups(next, "self")).toBeNull();
});

test("a trip holding a dropped traveller's place is accepted; a malformed wait is not", () => {
    const next: any = snapshot();
    next.groups[0].travel = {
        id: "travel-one-123456789",
        initiatorId: "peer",
        status: "preparing",
        destination: { id: "world", title: "Gallery", href: "/gallery" },
        responses: { self: "accepted", peer: "accepted" },
        acceptedIds: ["peer", "self"],
        readyIds: ["self"],
        poses: { peer: { x: 0, y: 0, z: 0, rotation: 0 } },
        expiresAt: 20000,
        waitingFor: [{ id: "peer", name: "Peer", until: 11000 }],
    };
    expect(readLobbyGroups(next, "self").groups[0].travel.waitingFor).toEqual([
        { id: "peer", name: "Peer", until: 11000 },
    ]);
    for (const waitingFor of [
        "peer",
        [{ id: "stranger", name: "Peer", until: 11000 }],
        [{ id: "peer", name: "", until: 11000 }],
        [{ id: "peer", name: "Peer", until: "soon" }],
        Array.from({ length: 9 }, () => ({
            id: "peer",
            name: "Peer",
            until: 11000,
        })),
    ]) {
        next.groups[0].travel.waitingFor = waitingFor;
        expect(readLobbyGroups(next, "self")).toBeNull();
    }
});

test("location changes retain the control room and only send bounded group metadata", () => {
    const destination = {
        id: "wanimal",
        title: "Wanimal blue",
        href: "/wanimal",
    };
    const location: any = {
        state: "travelling",
        destination: { ...destination, privateToken: "secret" },
    };
    connection.setLobbyPresence(true, location);
    expect(room.send).toHaveBeenLastCalledWith(
        "lobby-group-action",
        expect.objectContaining({
            active: false,
            location: { state: "travelling", destination },
        })
    );
    location.destination.title = "Mutated outside transport";
    connection.setLobbyPresence(true, { state: "travelling", destination });
    expect(room.send).toHaveBeenCalledTimes(1);
    connection.setLobbyPresence(false, { state: "space", destination });
    expect(room.send).toHaveBeenLastCalledWith(
        "lobby-group-action",
        expect.objectContaining({
            active: true,
            location: { state: "space", destination },
        })
    );
    expect(room.leave).not.toHaveBeenCalled();
    expect(connection.snapshot.groups).toHaveLength(1);
    expect(connection.snapshot.groupMessages[0].text).toBe("Group secret");
    connection.setLobbyPresence(false, { state: "lobby" });
    connection.setLobbyPresence(false, {
        state: "space",
        destination: { ...destination, href: "/wanimal?private=yes" },
    });
    expect(room.send).toHaveBeenCalledTimes(2);
    connection.setLobbyPresence(true, { state: "lobby" });
    expect(room.send).toHaveBeenLastCalledWith(
        "lobby-group-action",
        expect.objectContaining({ active: false, location: { state: "lobby" } })
    );
});

test("group member locations are validated, copied, and disappear on membership removal", () => {
    const next: any = snapshot();
    next.groups[0].members[1].location = {
        state: "space",
        destination: {
            id: "one",
            title: "Gallery",
            href: "/one",
            token: "secret",
        },
    };
    client.receiveGroups(next);
    const location = connection.snapshot.groups[0].members[1].location;
    expect(location).toEqual({
        state: "space",
        destination: { id: "one", title: "Gallery", href: "/one" },
    });
    next.groups[0].members[1].location.destination.href =
        "https://external.test/private";
    expect(readLobbyGroups(next, "self")).toBeNull();
    expect(location.destination.href).toBe("/one");
    client.receiveGroups({ ...snapshot(), groups: [] });
    expect(connection.snapshot.groups).toEqual([]);
    expect(connection.snapshot.groupMessages).toEqual([]);
});
