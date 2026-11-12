import {
    TRAVEL_ANIMATION_DURATION_MS as duration,
    TRAVEL_ANIMATION_PLAY_MS as play,
    TRAVEL_ANIMATION_SPEED as speed,
} from "./travelAnimationPack";
import {
    sampleTravelDeparture,
    sampleTravelArrival,
    TRAVEL_POSE_BLEND_MS,
    TRAVEL_ARRIVAL_MS,
} from "./travelAnimationSequence";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_CHARGE_LEAD_MS,
    TRAVEL_DEPARTURE_MS,
    TRAVEL_BLACK_AT_MS,
    TRAVEL_DISSOLVE_AT_MS,
    TRAVEL_CLAP_MS,
    WORLD_BLACK_HOLD_MS,
} from "./worldTravelTiming";

const attackStart = TRAVEL_ISOLATE_MS;
const crouchStart = attackStart + play.TRAVEL_ATTACK;
const holdStart = crouchStart + play.TRAVEL_CROUCH_DOWN;

test("trips play the jump in about 2.9 s and the stand-up in about 0.6 s", () => {
    expect(speed.TRAVEL_ATTACK).toBe(speed.TRAVEL_CROUCH_DOWN);
    expect(speed.TRAVEL_CROUCH_IDLE).toBe(1);
    expect(play.TRAVEL_ATTACK).toBeCloseTo(duration.TRAVEL_ATTACK / 1.55);
    expect(TRAVEL_DEPARTURE_MS).toBeGreaterThan(3400);
    expect(TRAVEL_DEPARTURE_MS).toBeLessThan(3600);
    expect(play.TRAVEL_STAND_UP).toBeCloseTo(625);
});

test("departure plays the complete authored attack and crouch before waiting, even on skipped frames", () => {
    expect(sampleTravelDeparture(attackStart - 1).name).toBe("IDLE_CC0");
    expect(sampleTravelDeparture(attackStart)).toMatchObject({
        name: "TRAVEL_ATTACK",
        time: 0,
        blend: 0,
    });
    const attackEnd = sampleTravelDeparture(crouchStart - 1);
    expect(attackEnd.name).toBe("TRAVEL_ATTACK");
    expect(attackEnd.time).toBeCloseTo(
        (duration.TRAVEL_ATTACK - speed.TRAVEL_ATTACK) / 1000
    );
    expect(sampleTravelDeparture(crouchStart)).toMatchObject({
        name: "TRAVEL_CROUCH_DOWN",
        time: 0,
    });
    const crouchEnd = sampleTravelDeparture(holdStart - 1);
    expect(crouchEnd.name).toBe("TRAVEL_CROUCH_DOWN");
    expect(crouchEnd.time).toBeCloseTo(
        (duration.TRAVEL_CROUCH_DOWN - speed.TRAVEL_CROUCH_DOWN) / 1000
    );
    expect(sampleTravelDeparture(holdStart)).toMatchObject({
        name: "TRAVEL_CROUCH_IDLE",
        time: 0,
    });
    // A slow render resumes the authored timeline; it cannot restart the attack.
    expect(sampleTravelDeparture(holdStart + 27_350)).toEqual({
        name: "TRAVEL_CROUCH_IDLE",
        time: 27.35,
    });
    expect(TRAVEL_CHARGE_LEAD_MS).toBe(
        play.TRAVEL_ATTACK + play.TRAVEL_CROUCH_DOWN
    );
    expect(TRAVEL_DEPARTURE_MS).toBeCloseTo(holdStart, 6);
    expect(TRAVEL_DEPARTURE_MS).toBeGreaterThan(
        TRAVEL_BLACK_AT_MS + WORLD_BLACK_HOLD_MS
    );
    expect(sampleTravelDeparture(TRAVEL_DISSOLVE_AT_MS)).toMatchObject({
        name: "TRAVEL_ATTACK",
        time: (TRAVEL_CLAP_MS * speed.TRAVEL_ATTACK) / 1000,
    });
    expect(TRAVEL_CLAP_MS * speed.TRAVEL_ATTACK).toBeCloseTo((65 / 30) * 1000);
});

test("each new pose blends from the completed previous pose without shortening the authored clip", () => {
    const attack = sampleTravelDeparture(
        attackStart + TRAVEL_POSE_BLEND_MS / 2
    );
    expect(attack).toMatchObject({
        name: "TRAVEL_ATTACK",
        blend: 0.5,
    });
    expect(attack.time).toBeCloseTo(0.09 * speed.TRAVEL_ATTACK);
    expect(attack.previous.name).toBe("IDLE_CC0");
    const crouch = sampleTravelDeparture(
        crouchStart + TRAVEL_POSE_BLEND_MS / 2
    );
    expect(crouch.blend).toBeCloseTo(0.5);
    expect(crouch.previous).toEqual({
        name: "TRAVEL_ATTACK",
        time: duration.TRAVEL_ATTACK / 1000,
    });
    expect(
        sampleTravelDeparture(crouchStart + TRAVEL_POSE_BLEND_MS + 1).previous
    ).toBeUndefined();
});

test("arrival plays the whole stand-up at trip speed then blends to held ready idle for another 180ms", () => {
    expect(TRAVEL_ARRIVAL_MS).toBe(play.TRAVEL_STAND_UP + 180);
    const standEnd = play.TRAVEL_STAND_UP;
    expect(sampleTravelArrival(0)).toEqual({
        name: "TRAVEL_STAND_UP",
        time: 0,
        blend: 0,
        previous: { name: "TRAVEL_CROUCH_IDLE", time: 0 },
    });
    const late = sampleTravelArrival(standEnd - 1);
    expect(late.name).toBe("TRAVEL_STAND_UP");
    expect(late.time).toBeCloseTo((1000 - speed.TRAVEL_STAND_UP) / 1000);
    expect(sampleTravelArrival(standEnd)).toEqual({
        name: "IDLE_CC0",
        time: 0,
        blend: 0,
        previous: { name: "TRAVEL_STAND_UP", time: 1 },
    });
    expect(sampleTravelArrival(standEnd + 90).blend).toBeCloseTo(0.5);
    const settled = sampleTravelArrival(TRAVEL_ARRIVAL_MS);
    expect(settled.name).toBe("IDLE_CC0");
    expect(settled.time).toBeCloseTo(0.18);
    expect(settled.blend).toBeUndefined();
    expect(sampleTravelArrival(standEnd + 30_000)).toEqual({
        name: "IDLE_CC0",
        time: 30,
    });
});

test("reduced motion uses ready idle and invalid clocks cannot request a corrupt pose", () => {
    for (const sample of [sampleTravelDeparture, sampleTravelArrival]) {
        for (const time of [0, 1200, 31_000])
            expect(sample(time, true)).toEqual({
                name: "IDLE_CC0",
                time: time / 1000,
            });
        for (const time of [-100, NaN, Infinity])
            expect(sample(time)).toEqual(sample(0));
    }
});
