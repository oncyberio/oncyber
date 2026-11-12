import {
    AUDIO_LOW_BAR,
    decibelsToLevel,
    levelToDecibels,
    readVoiceDebug,
} from "./levels";

test("the speaking threshold in the code is a level between silence and full scale", () => {
    expect(AUDIO_LOW_BAR).toBeGreaterThan(0);
    expect(AUDIO_LOW_BAR).toBeLessThan(1);
});

test("levels and decibels convert both ways", () => {
    expect(levelToDecibels(0.5)).toBe(-50);
    expect(levelToDecibels(1)).toBe(0);
    expect(decibelsToLevel(-50)).toBe(0.5);
    expect(decibelsToLevel(-20)).toBeCloseTo(0.8);
    expect(decibelsToLevel(levelToDecibels(0.42))).toBeCloseTo(0.42);
    // -100dB and quieter, down to digital silence, is level 0
    expect(decibelsToLevel(-130)).toBe(0);
    expect(decibelsToLevel(-Infinity)).toBe(0);
});

test.each([
    ["", null],
    ["?voice=1", null],
    ["?voiceDebugger=1", null],
    ["?voiceDebug", {}],
    ["?voiceDebug=", {}],
    ["?a=1&voiceDebug&b=2", {}],
    ["?voiceDebug=on", {}],
    ["?voiceDebug=1.5", {}],
    ["?voiceDebug=-101", {}],
    ["?voiceDebug=0.42", { threshold: 0.42 }],
    ["?voiceDebug=%200.42", { threshold: 0.42 }],
    ["?voiceDebug=0", { threshold: 0 }],
    ["?voiceDebug=1", { threshold: 1 }],
    ["?voiceDebug=-50", { threshold: 0.5 }],
    ["?voiceDebug=-100", { threshold: 0 }],
])("the query %j asks for %j", (search, request) => {
    expect(readVoiceDebug(search)).toEqual(request);
});

test("a threshold given in decibels lands on the level scale", () => {
    expect(readVoiceDebug("?voiceDebug=-58").threshold).toBeCloseTo(0.42);
});
