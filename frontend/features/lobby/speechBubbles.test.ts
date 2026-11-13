import { SPEECH_SHOW_MS, activeSpeech, speechPresence } from "./speechBubbles";

test("a line eases in, holds, eases out and expires", () => {
    expect(speechPresence(-1)).toBe(0);
    expect(speechPresence(0)).toBe(0);
    expect(speechPresence(100)).toBeGreaterThan(0);
    expect(speechPresence(100)).toBeLessThan(1);
    expect(speechPresence(2000)).toBe(1);
    expect(speechPresence(SPEECH_SHOW_MS - 100)).toBeLessThan(1);
    expect(speechPresence(SPEECH_SHOW_MS)).toBe(0);
});

test("each speaker shows their newest public line", () => {
    const now = 100_000;
    const lines = activeSpeech(
        [
            { sessionId: "a", text: "old", sentAt: now - 3000 },
            { sessionId: "a", text: "new", sentAt: now - 1000 },
            { sessionId: "b", text: "dm", sentAt: now - 500, recipientId: "x" },
            { sessionId: "c", text: "gone", sentAt: now - SPEECH_SHOW_MS },
        ],
        now
    );
    expect(lines).toEqual({ a: { text: "new", at: now - 1000 } });
});
