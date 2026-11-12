import { createLobbyTravelPeers } from "./lobbyTravelPeers";
const THREE = require("three");
const snapshot = {
    id: "peer",
    name: "Peer",
    vrmUrl: "/peer.vrm",
    avatar: "/peer.png",
    scale: 1,
    offset: { x: 1, y: 0, z: -1 },
    rotation: 0.5,
};
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
const model = () => ({
    root: new THREE.Group(),
    update: jest.fn(),
    prepareTravel: jest.fn(async () => {}),
    sampleTravelPose: jest.fn((_pose: any) => true),
    dispose: jest.fn(),
    height: 1.8,
    playEmote: jest.fn(),
    sourceUrl: "/peer.vrm",
});

test("retained avatars reuse their loads, keep formation offsets and charge with the local avatar", async () => {
    const scene = new THREE.Scene();
    const avatar = model();
    const factory = jest.fn(async () => avatar);
    const peers = createLobbyTravelPeers(scene, factory);
    peers.prepare([snapshot], { x: 10, y: 2, z: 20 }, false);
    await flush();
    await peers.prepare([snapshot], { x: 11, y: 2, z: 20 }, false);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(scene.children).toEqual([avatar.root]);
    peers.update(performance.now() + 16, 0.38);
    expect(avatar.root.position.toArray()).toEqual([12, 2.38, 19]);
    expect(avatar.root.rotation.y).toBe(0.5);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "TRAVEL_CROUCH_IDLE" })
    );
    peers.dispose();
    peers.dispose();
    expect(scene.children).toHaveLength(0);
    expect(avatar.dispose).toHaveBeenCalledTimes(1);
});

test("reduced motion retains a planted idle and failed assets do not reject admission", async () => {
    const avatar = model();
    const peers = createLobbyTravelPeers(
        new THREE.Scene(),
        jest.fn(async (url) => {
            if (url === "/missing.vrm") throw new Error("missing");
            return avatar;
        })
    );
    expect(
        peers.prepare(
            [snapshot, { ...snapshot, id: "missing", vrmUrl: "/missing.vrm" }],
            { x: 0, y: 0, z: 0 },
            true
        )
    ).toBeUndefined();
    await flush();
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "IDLE_CC0" })
    );
    peers.dispose();
});

test("cancellation disposes late avatar loads instead of adding them to the native scene", async () => {
    let complete: (avatar: ReturnType<typeof model>) => void;
    const scene = new THREE.Scene();
    const avatar = model();
    const factory = jest.fn(
        (_url: string, _options: any) =>
            new Promise<ReturnType<typeof model>>((resolve) => {
                complete = resolve;
            })
    );
    const peers = createLobbyTravelPeers(scene, factory);
    peers.prepare([snapshot], { x: 0, y: 0, z: 0 }, false);
    await flush();
    peers.dispose();
    expect(factory.mock.calls[0][1].signal.aborted).toBe(true);
    complete(avatar);
    await flush();
    expect(scene.children).toHaveLength(0);
    expect(avatar.dispose).toHaveBeenCalledTimes(1);
});

test("a slow cosmetic does not block other peers or readiness and attaches in the latest anchored pose", async () => {
    const scene = new THREE.Scene();
    const ready = model(),
        slow = model();
    let finish: (avatar: ReturnType<typeof model>) => void;
    const factory = jest.fn((url: string) =>
        url === "/slow.vrm"
            ? new Promise<ReturnType<typeof model>>((resolve) => {
                  finish = resolve;
              })
            : Promise.resolve(ready)
    );
    const peers = createLobbyTravelPeers(scene, factory);
    const snapshots = [
        snapshot,
        {
            ...snapshot,
            id: "slow",
            vrmUrl: "/slow.vrm",
            offset: { x: -1, y: 0, z: 2 },
        },
    ];
    expect(
        peers.prepare(snapshots, { x: 10, y: 1, z: 20 }, false)
    ).toBeUndefined();
    await flush();
    expect(scene.children).toEqual([ready.root]);
    expect(peers.hasAvatars).toBe(true);
    peers.prepare(snapshots, { x: 30, y: 2, z: 40 }, false);
    peers.update(performance.now(), 0.25);
    const addedPositions: number[][] = [];
    const add = scene.add.bind(scene);
    scene.add = (...objects) => {
        addedPositions.push(
            ...objects.map((object) => object.position.toArray())
        );
        return add(...objects);
    };
    finish(slow);
    await flush();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(addedPositions).toEqual([[29, 2.25, 42]]);
    expect(slow.sampleTravelPose).toHaveBeenCalled();
    peers.dispose();
});

test("replacing or removing a pending peer aborts its load and rejects stale attachment", async () => {
    const scene = new THREE.Scene();
    const oldAvatar = model(),
        nextAvatar = model();
    const resolvers: Array<(avatar: ReturnType<typeof model>) => void> = [];
    const signals: AbortSignal[] = [];
    const factory = jest.fn(
        (_url: string, options: { signal: AbortSignal }) => {
            signals.push(options.signal);
            return new Promise<ReturnType<typeof model>>((resolve) =>
                resolvers.push(resolve)
            );
        }
    );
    const peers = createLobbyTravelPeers(scene, factory);
    peers.prepare([snapshot], { x: 0, y: 0, z: 0 }, false);
    await flush();
    peers.prepare(
        [{ ...snapshot, vrmUrl: "/updated.vrm" }],
        { x: 10, y: 0, z: 10 },
        false
    );
    await flush();
    expect(signals[0].aborted).toBe(true);
    resolvers[0](oldAvatar);
    resolvers[1](nextAvatar);
    await flush();
    expect(oldAvatar.dispose).toHaveBeenCalledTimes(1);
    expect(scene.children).toEqual([nextAvatar.root]);
    peers.prepare([], { x: 0, y: 0, z: 0 }, false);
    expect(signals[1].aborted).toBe(true);
    expect(peers.hasAvatars).toBe(false);
    expect(scene.children).toHaveLength(0);
    expect(nextAvatar.dispose).toHaveBeenCalledTimes(1);
    peers.dispose();
});

test("disposing before queued cosmetic work starts avoids invoking the factory", async () => {
    const factory = jest.fn(async () => model());
    const peers = createLobbyTravelPeers(new THREE.Scene(), factory);
    peers.prepare([snapshot], { x: 0, y: 0, z: 0 }, false);
    peers.dispose();
    await flush();
    expect(factory).not.toHaveBeenCalled();
});

test("party members crouch through loading, stand with the leader and settle to idle", async () => {
    const avatar = model();
    const peers = createLobbyTravelPeers(new THREE.Scene(), async () => avatar);
    const clock = jest.spyOn(performance, "now").mockReturnValue(0);
    peers.prepare([snapshot], { x: 0, y: 0, z: 0 }, false);
    await flush();
    peers.update(10000);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith({
        name: "TRAVEL_CROUCH_IDLE",
        time: 10,
    });
    peers.standUp(10000);
    peers.update(10500);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "TRAVEL_STAND_UP", time: 0.8 })
    );
    peers.update(10805);
    expect(avatar.sampleTravelPose).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "IDLE_CC0", blend: 1 })
    );
    peers.dispose();
    clock.mockRestore();
});
