import {
    TALKING_HOLD_MS,
    TalkingMeter,
    levelOf,
    nextTalking,
} from "./gameTalking";

describe("who is talking", () => {
    it("measures a level from time-domain bytes", () => {
        expect(levelOf(new Uint8Array(0))).toBe(0);
        expect(levelOf(new Uint8Array(64).fill(128))).toBe(0);
        expect(levelOf(Uint8Array.from([0, 255, 0, 255]))).toBeGreaterThan(0.9);
    });

    it("starts on a loud reading and holds through a short pause", () => {
        const quiet = { talking: false, until: 0 };
        expect(nextTalking(quiet, 0.01, 0)).toEqual(quiet);
        const on = nextTalking(quiet, 0.2, 1000);
        expect(on.talking).toBe(true);
        expect(nextTalking(on, 0, 1000 + TALKING_HOLD_MS - 1).talking).toBe(
            true
        );
        expect(nextTalking(on, 0, 1000 + TALKING_HOLD_MS).talking).toBe(false);
        // Murmuring between the two thresholds keeps it on, but never starts it.
        expect(nextTalking(on, 0.03, 99999).talking).toBe(true);
        expect(nextTalking(quiet, 0.03, 0).talking).toBe(false);
    });

    it("tracks players by id and forgets them when they leave", () => {
        let level = 0;
        let now = 0;
        let closed = 0;
        const meter = new TalkingMeter(
            () => ({ read: () => level, close: () => closed++ }),
            () => now
        );
        expect(meter.talking("a")).toBe(false);
        meter.watch("a", {} as MediaStream);
        level = 0.5;
        expect(meter.talking("a")).toBe(true);
        level = 0;
        now = TALKING_HOLD_MS + 1;
        expect(meter.talking("a")).toBe(false);
        level = 0.5;
        expect(meter.talking("a")).toBe(true);
        meter.unwatch("a");
        expect(closed).toBe(1);
        expect(meter.talking("a")).toBe(false);
        meter.watch("b", {} as MediaStream);
        meter.close();
        expect(closed).toBe(2);
    });

    it("stays off where a stream can't be measured", () => {
        const meter = new TalkingMeter(() => null);
        meter.watch("a", {} as MediaStream);
        expect(meter.talking("a")).toBe(false);
    });
});
