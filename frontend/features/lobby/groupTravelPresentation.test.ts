import {
    groupFormationParticipants,
    groupTravelPeers,
    sampleGroupGather,
} from "./travelPresentation";
import { readLobbyTravelView } from "./lobbyJourneyProtocol";
import type { LobbyGroupFormation } from "./sceneTypes";

const formation: LobbyGroupFormation = {
    id: "trip",
    selfId: "b",
    initiatorId: "a",
    startedAt: 10,
    members: ["a", "b", "c"].map((id) => ({
        id,
        name: id,
        avatar: `/${id}.png`,
        vrmUrl: `/${id}.vrm`,
        scale: 1,
    })),
    poses: {
        a: { x: 10, y: 0, z: 20, rotation: 1 },
        b: { x: 11, y: 0, z: 20, rotation: 1 },
        c: { x: 9, y: 0, z: 20, rotation: 1 },
    },
};
const view = {
    cameraOffset: { x: 0, y: 2, z: 6 },
    cameraTargetOffset: { x: 0, y: 1, z: 0 },
    avatarRotation: 1,
    avatarLift: 0.38,
    fov: 60,
};

test("group formation uses exact server poses and retains approved profiles without a live roster", () => {
    const source = JSON.stringify(formation);
    const peers = groupFormationParticipants(formation);
    expect(peers.map((peer) => peer.id)).toEqual(["a", "c"]);
    expect(peers[0]).toMatchObject({
        ...formation.poses.a,
        restConfirmed: true,
        floor: true,
        speed: 0,
        vrmUrl: "/a.vrm",
    });
    expect(JSON.stringify(formation)).toBe(source);
    expect(
        groupFormationParticipants({
            ...formation,
            members: [...formation.members, formation.members[0]],
            poses: { a: formation.poses.a },
        })
    ).toHaveLength(1);
});

test("each client's relative peers reconstruct the same formation with the initiator at its center", () => {
    for (const selfId of ["a", "b", "c"]) {
        const peers = groupTravelPeers({ ...formation, selfId });
        const self = formation.poses[selfId];
        expect(peers.some((peer) => peer.id === selfId)).toBe(false);
        for (const peer of peers)
            expect({
                x: peer.offset.x + self.x,
                y: peer.offset.y + self.y,
                z: peer.offset.z + self.z,
            }).toEqual({
                x: formation.poses[peer.id].x,
                y: formation.poses[peer.id].y,
                z: formation.poses[peer.id].z,
            });
    }
});

test("gathering changes position only when the avatar is hidden and finishes in a full-size idle", () => {
    expect(sampleGroupGather(0)).toEqual({ arrived: false, scale: 1 });
    expect(sampleGroupGather(80).scale).toBeCloseTo(0.5);
    expect(sampleGroupGather(160)).toEqual({ arrived: true, scale: 0 });
    expect(sampleGroupGather(200)).toEqual({ arrived: true, scale: 0 });
    expect(sampleGroupGather(480)).toEqual({ arrived: true, scale: 1 });
    expect(sampleGroupGather(0, true)).toEqual({ arrived: true, scale: 1 });
});

test("handoff copies bounded cosmetic peers and spawn offsets without retaining mutable vectors", () => {
    const source = {
        ...view,
        spawnOffset: { x: 1, y: 0, z: 0 },
        avatarIdleTime: 1.75,
        peers: groupTravelPeers(formation),
    };
    const result = readLobbyTravelView(source);
    expect(result).toEqual(source);
    source.spawnOffset.x = 99;
    source.peers[0].offset.x = 99;
    expect(result.spawnOffset.x).toBe(1);
    expect(result.peers[0].offset.x).toBe(-1);
});

test.each([
    { avatarIdleTime: NaN },
    { avatarIdleTime: Infinity },
    { avatarIdleTime: -0.01 },
    { avatarIdleTime: 60.01 },
    { avatarIdleTime: "1.75" },
    { spawnOffset: { x: 100, y: 0, z: 0 } },
    {
        peers: Array.from({ length: 8 }, (_, id) => ({
            ...groupTravelPeers(formation)[0],
            id: String(id),
        })),
    },
    { peers: [groupTravelPeers(formation)[0], groupTravelPeers(formation)[0]] },
    {
        peers: [
            {
                ...groupTravelPeers(formation)[0],
                vrmUrl: "javascript:alert(1)",
            },
        ],
    },
    {
        peers: [
            {
                ...groupTravelPeers(formation)[0],
                avatar: "https://user:pass@example.com/a.png",
            },
        ],
    },
    {
        peers: [
            {
                ...groupTravelPeers(formation)[0],
                offset: { x: Infinity, y: 0, z: 0 },
            },
        ],
    },
    { peers: [{ ...groupTravelPeers(formation)[0], scale: 20 }] },
])("malformed or excessive cosmetic snapshots are rejected: %p", (extra) => {
    expect(readLobbyTravelView({ ...view, ...extra })).toBeNull();
});

test.each([0, 1.75, 60])(
    "handoff accepts a bounded active idle time of %s seconds",
    (avatarIdleTime) => {
        expect(
            readLobbyTravelView({ ...view, avatarIdleTime }).avatarIdleTime
        ).toBe(avatarIdleTime);
    }
);
