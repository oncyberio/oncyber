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

    it("reads a style when the model wrote one, and drops a bad one", () => {
        expect(
            readWorldScriptAnswer(
                '{"source":"x()","style":{"summary":"Neon","palette":["#ff00aa","#00ffee"],"look":"glow"}}',
                false
            ).style
        ).toMatchObject({ look: "glow", palette: ["#ff00aa", "#00ffee"] });
        expect(
            readWorldScriptAnswer('{"source":"x()","style":"neon"}', false)
        ).not.toHaveProperty("style");
    });
});
