import { readWorldScriptAnswer } from "./brief";

describe("reading the model's answer", () => {
    it("reads the JSON answer", () => {
        const answer = readWorldScriptAnswer(
            '{"say":"Added two NPCs.","change":"content","name":"Chase","source":"world.add({})"}',
            true
        );
        expect(answer).toEqual({
            say: "Added two NPCs.",
            change: "content",
            name: "Chase",
            source: "world.add({})",
        });
    });

    it("treats the first script as a logic change", () => {
        expect(
            readWorldScriptAnswer('{"change":"content","source":"x()"}', false)
                .change
        ).toBe("logic");
    });

    it("falls back to a fenced block and removes stray fences", () => {
        expect(
            readWorldScriptAnswer("Here:\n```js\nworld.add({});\n```", true)
                .source
        ).toBe("world.add({});");
        expect(
            readWorldScriptAnswer('{"source":"```js\\nx()\\n```"}', true).source
        ).toBe("x()");
    });

    it("returns nothing when there is no script", () => {
        expect(readWorldScriptAnswer("Sorry, I can't.", true)).toBeNull();
    });
});
