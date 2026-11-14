import {
    RECORDING_ARRIVAL_EVERY_S,
    RECORDING_ARRIVAL_FIRST_S,
    recordingPartyLanding,
    recordingPartyPlayers,
} from "./recordingParty";

const main = { x: 0, y: 0, z: 0 };
const forward = { x: 0, z: -1 };

test("friends land around you, apart, ahead and to the sides", () => {
    const spots = recordingPartyLanding(8, main, forward);
    expect(spots).toHaveLength(8);
    for (const spot of spots) {
        const distance = Math.hypot(spot.x, spot.z);
        expect(distance).toBeGreaterThan(0.5);
        expect(distance).toBeLessThan(3.1);
        // never straight behind you, where the camera is
        expect(spot.z).toBeLessThan(1.2);
    }
    for (let i = 0; i < spots.length; i++)
        for (let j = i + 1; j < spots.length; j++)
            expect(
                Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)
            ).toBeGreaterThanOrEqual(0.75);
});

test("they arrive one at a time", () => {
    const spots = recordingPartyLanding(6, main, forward);
    expect(spots[0].delay).toBeGreaterThanOrEqual(RECORDING_ARRIVAL_FIRST_S);
    for (let i = 1; i < spots.length; i++)
        expect(spots[i].delay - spots[i - 1].delay).toBeGreaterThan(
            RECORDING_ARRIVAL_EVERY_S - 0.26
        );
});

test("each stands on the floor under its spot, as high above it as you", () => {
    // a slope rising toward -z, you 0.1 above the floor
    const floorAt = (x, z) => -z * 0.3;
    const spots = recordingPartyLanding(6, { x: 0, y: 0.1, z: 0 }, forward, {
        floorAt,
    });
    for (const spot of spots)
        expect(spot.y).toBeCloseTo(floorAt(spot.x, spot.z) + 0.1, 5);
});

test("no one lands past a wall or off a ledge", () => {
    // a wall 1 m ahead; a drop to the right
    const clearPath = (from, to) => to.z > -1 + 0.4;
    const floorAt = (x) => (x > 0.8 ? -5 : 0);
    const spots = recordingPartyLanding(8, main, forward, {
        floorAt,
        clearPath,
    });
    for (const spot of spots) {
        expect(spot.z).toBeGreaterThan(-1);
        expect(spot.x).toBeLessThanOrEqual(0.8);
    }
});

test("a closet still fits everyone, right beside you", () => {
    const spots = recordingPartyLanding(4, main, forward, {
        floorAt: () => 0,
        clearPath: () => false,
    });
    expect(spots).toHaveLength(4);
    for (const spot of spots)
        expect(Math.hypot(spot.x, spot.z)).toBeCloseTo(0.6, 5);
});

test("packet entries carry the spot and arrival time", () => {
    const spots = recordingPartyLanding(2, main, forward);
    const players = recordingPartyPlayers(
        [
            { id: "a", name: "A" },
            { id: "b", name: "B" },
        ],
        { ...main, scale: 1, space: "s", userHeight: 1.6 },
        spots
    );
    expect(players[1]).toMatchObject({
        positionX: spots[1].x,
        positionY: spots[1].y,
        positionZ: spots[1].z,
        arriveAt: spots[1].delay,
        sessionId: "recording-b",
        recordingFriend: true,
    });
});
