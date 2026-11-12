/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useLobbySocial from "./useLobbySocial";
import { LobbyPrediction } from "./LobbyPrediction";

const mockConnections: any[] = [];
let mockWelcomeOnConnect = true;
// Spawns are random in the app; these tests reconcile against a fixed origin.
jest.mock("./lobbySpawn", () => ({
    randomLobbySpawn: () => ({ x: 0, y: 0, z: 4, rotation: 0 }),
}));
jest.mock("./LobbyConnection", () => {
    const original = jest.requireActual("./LobbyConnection");
    return {
        ...original,
        LobbyConnection: jest.fn().mockImplementation(() => {
            const prediction =
                new (require("./LobbyPrediction").LobbyPrediction)();
            const client = {
                prediction,
                connect: jest.fn(async () => {
                    if (mockWelcomeOnConnect) prediction.welcome([9, 0, -3, 1]);
                }),
                close: jest.fn(async () => {}),
                updateAvatar: jest.fn(),
                updatePosition: (pose) => {
                    prediction.pose = { ...pose };
                },
                getPredictedPose: () => ({ ...prediction.pose }),
                consumeCorrection: () => prediction.consume(),
                sampleParticipants: () => [],
                getNetworkDiagnostics: () => null,
                sendMessage: jest.fn(),
                toggleVoice: jest.fn(),
                setLobbyPresence: jest.fn(),
                setFlash: jest.fn(() => true),
                groupAction: jest.fn(async () => ({
                    requestId: "group-command",
                })),
            };
            mockConnections.push(client);
            return client;
        }),
    };
});

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let social: ReturnType<typeof useLobbySocial>;
function Harness({
    enabled = true,
    present = true,
    location = undefined,
    userId = "Anon-test",
    nativeSpace = undefined,
}: any) {
    social = useLobbySocial({
        enabled,
        nativeSpace,
        present,
        location,
        identity: { userId },
    });
    return null;
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockConnections.length = 0;
    mockWelcomeOnConnect = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("welcome before scene initialization starts at reconciled spawn without a second jump", () => {
    act(() => root.render(<Harness />));
    const initialize = social.initializePose;
    expect(social.initializePose()).toMatchObject({
        x: 9,
        y: 0,
        z: -3,
        rotation: 1,
    });
    expect(social.consumeCorrection()).toBeNull();
    social.updatePosition({ x: 10, y: 0, z: -3, rotation: 1 });
    // Recreating only the renderer retains the live connection's local pose.
    expect(social.initializePose().x).toBe(10);
    expect(social.consumeCorrection()).toBeNull();
    act(() => root.render(<Harness />));
    expect(social.initializePose).toBe(initialize);
    expect(mockConnections).toHaveLength(1);
});

test("welcome after scene initialization delivers one delta against the same initial origin", () => {
    mockWelcomeOnConnect = false;
    act(() => root.render(<Harness />));
    const initial = social.initializePose();
    const prediction: LobbyPrediction = mockConnections[0].prediction;
    prediction.welcome([9, 0, -3, 1]);
    const delta = social.consumeCorrection();
    expect(initial.x + delta.x).toBeCloseTo(9);
    expect(initial.z + delta.z).toBeCloseTo(-3);
    expect(initial.rotation + delta.rotation).toBeCloseTo(1);
    expect(social.consumeCorrection()).toBeNull();
    act(() => root.render(<Harness enabled={false} />));
    expect(social.initializePose()).toMatchObject({ x: 9, z: -3 });
    expect(mockConnections[0].close).toHaveBeenCalledTimes(1);
});

test("forwards the selected direct-message recipient to the live connection", () => {
    act(() => root.render(<Harness />));
    mockConnections[0].sendMessage.mockReturnValue(true);
    expect(social.sendMessage("Hello", "peer")).toBe(true);
    expect(mockConnections[0].sendMessage).toHaveBeenCalledWith(
        "Hello",
        "peer"
    );
});

test("entering a destination suppresses source presence without replacing the group socket", async () => {
    act(() => root.render(<Harness />));
    const connection = mockConnections[0];
    act(() => root.render(<Harness present={false} />));
    expect(mockConnections).toHaveLength(1);
    expect(connection.close).not.toHaveBeenCalled();
    expect(connection.setLobbyPresence).toHaveBeenLastCalledWith(false);
    await expect(
        social.groupAction({
            action: "message",
            groupId: "group",
            text: "Arrived",
        })
    ).resolves.toEqual({ requestId: "group-command" });
    expect(connection.groupAction).toHaveBeenCalledWith({
        action: "message",
        groupId: "group",
        text: "Arrived",
    });
    act(() => root.render(<Harness present />));
    expect(mockConnections).toHaveLength(1);
    expect(connection.setLobbyPresence).toHaveBeenLastCalledWith(true);
});

test("space location and group chat keep the same socket; account changes replace it", async () => {
    act(() => root.render(<Harness />));
    const client = mockConnections[0];
    const destination = { id: "one", title: "Gallery", href: "/one" };
    for (const [present, location] of [
        [true, { state: "travelling", destination }],
        [false, { state: "space", destination }],
        [false, { state: "travelling" }],
        [true, { state: "lobby" }],
    ] as const) {
        act(() =>
            root.render(<Harness present={present} location={location} />)
        );
        expect(client.setLobbyPresence).toHaveBeenLastCalledWith(
            present,
            location
        );
        await social.groupAction({
            action: "message",
            groupId: "approved",
            text: "Still together",
        });
        expect(mockConnections).toHaveLength(1);
        expect(client.close).not.toHaveBeenCalled();
    }
    act(() => root.render(<Harness userId="different-account" />));
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(mockConnections).toHaveLength(2);
    expect(social.groups).toEqual([]);
});

test("gym scope is explicit and disabling a visit closes its socket", () => {
    act(() => root.render(<Harness nativeSpace="arena" />));
    const constructor = require("./LobbyConnection").LobbyConnection;
    expect(constructor).toHaveBeenLastCalledWith(
        expect.any(Object),
        expect.any(Function),
        { endpointConfig: undefined, nativeSpace: "arena" }
    );
    act(() =>
        root.render(<Harness enabled={false} nativeSpace="arena" />)
    );
    expect(mockConnections[0].close).toHaveBeenCalledTimes(1);
    act(() => root.render(<Harness enabled nativeSpace="arena" />));
    expect(mockConnections).toHaveLength(2);
});

const flash = {
    id: "one",
    title: "Artwork",
    imageUrl: "/art.png",
    nonce: "test",
    startedAt: 10,
};
test("keeps a prepared Flash across retry and clears it on departure and leaving", async () => {
    act(() => root.render(<Harness />));
    expect(social.setFlash(flash)).toBe(true);
    expect(mockConnections[0].setFlash).toHaveBeenLastCalledWith(flash);
    act(() => social.retry());
    expect(mockConnections[1].setFlash).toHaveBeenLastCalledWith(flash);
    act(() => root.render(<Harness present={false} />));
    act(() => social.retry());
    expect(mockConnections[2].setFlash).toHaveBeenLastCalledWith(null);
    act(() => root.render(<Harness />));
    social.setFlash(flash);
    await act(async () => social.leave());
    act(() => social.retry());
    expect(mockConnections[3].setFlash).toHaveBeenLastCalledWith(null);
});
test("does not revive a stopped or moving Flash after retry", () => {
    act(() => root.render(<Harness />));
    social.setFlash(flash);
    social.setFlash(null);
    act(() => social.retry());
    expect(mockConnections[1].setFlash).toHaveBeenLastCalledWith(null);
    social.setFlash(flash);
    social.updatePosition({ x: 0, y: 0, z: 5, rotation: 0, moving: true });
    act(() => social.retry());
    expect(mockConnections[2].setFlash).toHaveBeenLastCalledWith(null);
});
