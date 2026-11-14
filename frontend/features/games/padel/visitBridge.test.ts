import { gymPeers, readGymPose, createGymPeerSampler } from "./visitBridge";

test("validates visit poses and translates canonical emotes into the native wire enum", () => {
    expect(
        readGymPose({
            x: 1,
            y: 0.4,
            z: 2,
            rotation: 0,
            speed: 3,
            grounded: false,
            verticalVelocity: 2,
            emote: "WAVING",
            token: "secret",
        })
    ).toEqual({
        x: 1,
        y: 0.4,
        z: 2,
        rotation: 0,
        speed: 3,
        floor: false,
        vy: 2,
        vx: 0,
        vz: 0,
        moving: true,
        animation: 0,
    });
    for (const value of [
        null,
        {},
        { x: Infinity, y: 0, z: 0, rotation: 0 },
        { x: 1000, y: 0, z: 0, rotation: 0 },
    ])
        expect(readGymPose(value)).toBeNull();
    expect(
        readGymPose({ x: 0, y: 0, z: 0, rotation: 0, emote: "invented" })
            .animation
    ).toBe(-1);
});
test("peer packets contain only gym visitors' public data, never self or account fields", () => {
    const player = {
        id: "peer",
        name: "Visitor",
        vrmUrl: "/person.vrm",
        avatar: "/pfp.png",
        x: 1,
        y: 0,
        z: 2,
        rotation: 0,
        animation: 0,
        floor: true,
        vx: 2,
        vz: 0,
        token: "secret",
        partyIdentity: "private",
        userId: "account",
    };
    expect(
        gymPeers([{ ...player, id: "self" }, player] as any, "self")
    ).toEqual([
        {
            id: "peer",
            username: "Visitor",
            vrmUrl: "/person.vrm",
            avatar: "/pfp.png",
            x: 1,
            y: 0,
            z: 2,
            rotation: 0,
            speed: 2,
            grounded: true,
            verticalVelocity: 0,
            vx: 2,
            vz: 0,
            emote: "WAVING",
        },
    ]);
    expect(
        gymPeers(
            Array.from({ length: 100 }, (_, i) => ({
                ...player,
                id: String(i),
            })) as any,
            "self"
        )
    ).toHaveLength(64);
});

test("native peer motion derives velocity without teleport spikes or stale rejoin history", () => {
    const sample = createGymPeerSampler();
    const base = {
        id: "p",
        name: "P",
        x: 0,
        y: 0,
        z: 0,
        rotation: 1,
        animation: -1,
        floor: true,
    } as any;
    expect(sample([base], "self", 1000)[0].vx).toBe(0);
    expect(
        sample([{ ...base, x: 0.2, z: 0.4 }], "self", 1100)[0]
    ).toMatchObject({ vx: 2, vz: 4, rotation: 1 });
    expect(sample([{ ...base, x: 40 }], "self", 1200)[0].vx).toBe(0);
    sample([], "self", 1300);
    expect(sample([base], "self", 1400)[0].vx).toBe(0);
});
