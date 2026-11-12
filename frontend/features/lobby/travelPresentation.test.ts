import {
    sampleTravelPresentation,
    LOBBY_RETURN_REVEAL_MS,
    LOBBY_RETURN_TOTAL_MS,
    travelParticipants,
} from "./travelPresentation";
import type { LobbyParticipant, LobbyTravelPresentation } from "./sceneTypes";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_CHARGE_LEAD_MS,
    TRAVEL_CLAP_MS,
    TRAVEL_BLACK_AT_MS,
    TRAVEL_DISSOLVE_AT_MS,
    WORLD_DISSOLVE_MS,
} from "./worldTravelTiming";

const travel: LobbyTravelPresentation = {
    phase: "isolate",
    startedAt: 100,
    partyIds: ["party-peer"],
    reducedMotion: false,
};

test("travel charges on a stable clock and its halo fades during arrival", () => {
    expect(sampleTravelPresentation(travel, 100, 100)).toMatchObject({
        cameraMix: 0,
        charge: 0,
        lift: 0,
        animation: "IDLE_CC0",
    });
    const charged = sampleTravelPresentation(
        { ...travel, phase: "charge" },
        travel.startedAt + TRAVEL_ISOLATE_MS + TRAVEL_CHARGE_LEAD_MS + 1,
        700
    );
    expect(charged).toMatchObject({
        cameraMix: 1,
        charge: 1,
        animation: "TRAVEL_CROUCH_IDLE",
        lift: 0,
    });
    expect(charged.opacity).toBeCloseTo(0.6);
    expect(
        sampleTravelPresentation({ ...travel, phase: "charge" }, 30_000, 700)
            .opacity
    ).toBeCloseTo(0.6);
    const reveal = { ...travel, phase: "reveal" as const };
    expect(
        sampleTravelPresentation(reveal, 30_000, 30_000).opacity
    ).toBeCloseTo(0.6);
    expect(
        sampleTravelPresentation(reveal, 30_500, 30_000).opacity
    ).toBeCloseTo(0.3);
    expect(sampleTravelPresentation(reveal, 40_000, 30_000).opacity).toBe(0);
});

test("reduced motion retains ready idle and steady lighting without camera tween or levitation", () => {
    const reduced = {
        ...travel,
        phase: "charge" as const,
        reducedMotion: true,
    };
    const a = sampleTravelPresentation(reduced, 1800, 700);
    const b = sampleTravelPresentation(reduced, 8000, 700);
    expect(a).toMatchObject({
        cameraMix: 1,
        animation: "IDLE_CC0",
        lift: 0,
        pulse: 0.55,
    });
    expect(b).toMatchObject({
        cameraMix: a.cameraMix,
        animation: a.animation,
        lift: a.lift,
        pulse: a.pulse,
    });
    expect(a.pose.name).toBe("IDLE_CC0");
    expect(b.pose.name).toBe("IDLE_CC0");
    expect(b.pose.time).toBeGreaterThan(a.pose.time);
});

test("formation uses only exact existing renderer IDs without mutating authority or inventing peers", () => {
    const peer: LobbyParticipant = Object.freeze({
        id: "party-peer",
        name: "Peer",
        x: 120,
        y: 2,
        z: 100,
        rotation: 1,
        speed: 3,
    });
    const stranger: LobbyParticipant = Object.freeze({
        id: "other-peer",
        name: "Other",
        x: 2,
        y: 0,
        z: 2,
        rotation: 0,
    });
    const source = Object.freeze([peer, stranger]);
    const result = travelParticipants(
        source,
        { ...travel, partyIds: ["party-peer", "party-peer", "absent-peer"] },
        { x: 10, z: 20 },
        0
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
        id: "party-peer",
        x: 10,
        y: 0,
        z: 19.1,
        rotation: Math.PI,
        speed: 0,
        floor: true,
        restConfirmed: true,
    });
    expect(result[1]).toBe(stranger);
    expect(peer).toMatchObject({ x: 120, y: 2, z: 100, speed: 3 });
});

test("party positions face the camera and rotate with the local avatar", () => {
    const members = ["a", "b"].map((id) => ({
        id,
        name: id,
        x: 50,
        y: 0,
        z: 50,
        rotation: 0,
    }));
    const result = travelParticipants(
        members,
        { ...travel, partyIds: ["a", "b"] },
        { x: 0, z: 0 },
        Math.PI / 2
    );
    expect(result[0].x).toBeCloseTo(result[1].x);
    expect(result[0].z).toBeCloseTo(-result[1].z);
    expect(result[0].x).toBeLessThan(0);
    expect(result[0].rotation).toBeCloseTo(Math.PI * 1.5);
});

test("departure follows its scheduled dimming clock and preserves the settled avatar pose", () => {
    const charged = { ...travel, phase: "charge" as const };
    expect(sampleTravelPresentation(charged, 30_000, 700).dissolve).toBe(0);
    const ready = { ...charged, dissolveStartedAt: 30_000 };
    const start = sampleTravelPresentation(ready, 30_000, 700);
    const middle = sampleTravelPresentation(ready, 30_350, 700);
    const black = sampleTravelPresentation(ready, 30_700, 700);
    expect([start.dissolve, middle.dissolve, black.dissolve]).toEqual([
        0, 0.5, 1,
    ]);
    expect([start.lift, middle.lift, black.lift]).toEqual([0, 0, 0]);
    expect([start.cameraMix, middle.cameraMix, black.cameraMix]).toEqual([
        1, 1, 1,
    ]);
    expect(sampleTravelPresentation(ready, 31_000, 700).dissolve).toBe(1);
    expect(
        sampleTravelPresentation(
            { ...ready, dissolveProgress: 0.25 },
            31_000,
            700
        ).dissolve
    ).toBe(0.25);
});

test("return remains grounded idle throughout the floor assembly without replaying meditation or orbiting", () => {
    const returning = { ...travel, phase: "return" as const };
    const sample = (elapsed: number) =>
        sampleTravelPresentation(returning, returning.startedAt + elapsed, 0);
    for (const elapsed of [
        0,
        250,
        LOBBY_RETURN_REVEAL_MS / 2,
        LOBBY_RETURN_REVEAL_MS - 1,
    ]) {
        expect(sample(elapsed)).toMatchObject({
            returnHandoff: 1,
            charge: 0,
            lift: 0,
            animation: "IDLE",
            returnComplete: false,
        });
    }
    expect(sample(0)).toMatchObject({ returnProgress: 0, dissolve: 1 });
    expect(sample(LOBBY_RETURN_REVEAL_MS / 2)).toMatchObject({
        returnProgress: 0.5,
        dissolve: 0.5,
    });
    expect(LOBBY_RETURN_TOTAL_MS).toBe(LOBBY_RETURN_REVEAL_MS);
    expect(sample(LOBBY_RETURN_TOTAL_MS)).toMatchObject({
        returnProgress: 1,
        dissolve: 0,
        returnHandoff: 1,
        lift: 0,
        animation: "IDLE",
        returnComplete: true,
    });
    expect(sample(LOBBY_RETURN_TOTAL_MS + 500)).toEqual(
        sample(LOBBY_RETURN_TOTAL_MS)
    );
    expect(sample(-50)).toEqual(sample(0));
});

test("reduced-motion return is immediately assembled, grounded and complete", () => {
    expect(
        sampleTravelPresentation(
            { ...travel, phase: "return", reducedMotion: true },
            travel.startedAt,
            0
        )
    ).toMatchObject({
        returnProgress: 1,
        dissolve: 0,
        returnHandoff: 1,
        lift: 0,
        animation: "IDLE",
        returnComplete: true,
    });
});

test("the room starts fading at the authored clap while the attack continues", () => {
    const outgoing = {
        ...travel,
        phase: "charge" as const,
        dissolveStartedAt: travel.startedAt + TRAVEL_DISSOLVE_AT_MS,
    };
    const sample = (elapsed: number) =>
        sampleTravelPresentation(outgoing, travel.startedAt + elapsed, 0);
    expect(TRAVEL_DISSOLVE_AT_MS).toBe(TRAVEL_ISOLATE_MS + TRAVEL_CLAP_MS);
    expect(sample(TRAVEL_DISSOLVE_AT_MS - 1).dissolve).toBe(0);
    const clap = sample(TRAVEL_DISSOLVE_AT_MS);
    expect(clap).toMatchObject({
        dissolve: 0,
        pose: { name: "TRAVEL_ATTACK" },
    });
    // The clap lands on the attack's authored frame 65, at trip speed.
    expect(clap.pose.time).toBeCloseTo(65 / 30, 6);
    expect(
        sample(TRAVEL_DISSOLVE_AT_MS + WORLD_DISSOLVE_MS / 2).dissolve
    ).toBeCloseTo(0.5);
    expect(sample(TRAVEL_BLACK_AT_MS - 1).dissolve).toBeLessThan(1);
    expect(sample(TRAVEL_BLACK_AT_MS)).toMatchObject({
        dissolve: 1,
        pose: { name: "TRAVEL_ATTACK" },
    });
    expect(sample(TRAVEL_BLACK_AT_MS + 100)).toMatchObject({
        dissolve: 1,
        pose: { name: "TRAVEL_ATTACK" },
    });
    expect(sample(TRAVEL_ISOLATE_MS + TRAVEL_CHARGE_LEAD_MS - 1)).toMatchObject(
        {
            dissolve: 1,
            pose: { name: "TRAVEL_CROUCH_DOWN" },
        }
    );
});
