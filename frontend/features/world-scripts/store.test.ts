import { mergeGameLines, readAiCommand } from "./store";

describe("/ai in the chat", () => {
    it("reads the request after /ai", () => {
        expect(readAiCommand("/ai add more NPCs")).toBe("add more NPCs");
        expect(readAiCommand("  /AI   make it rain ")).toBe("make it rain");
        expect(readAiCommand("/ai")).toBe("");
        expect(readAiCommand("/aim high")).toBeNull();
        expect(readAiCommand("hello /ai")).toBeNull();
    });

    it("fits game lines into the chat by time", () => {
        const chat = [
            { id: "a", sentAt: 10 },
            { id: "b", sentAt: 30 },
        ];
        const merged = mergeGameLines(chat, [
            { id: "g1", text: "Working on it…", sentAt: 20 },
            { id: "g2", text: "Done.", sentAt: 40 },
        ]);
        expect(merged.map((line) => line.id)).toEqual(["a", "g1", "b", "g2"]);
        expect(mergeGameLines(chat, [])).toBe(chat);
    });
});
