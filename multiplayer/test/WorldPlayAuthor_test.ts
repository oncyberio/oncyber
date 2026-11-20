import assert from "assert";
import { PLAY_BRIEF } from "../protocol/play-brief";
import { readPlayRecipe } from "../protocol/play-zone";
import { PLAY_REQUEST_LIMIT, askPlay, playAuthorFromEnv, readPlayRequest } from "../src/world/playAuthor";

/** A model that answers with `content`, and remembers what it was sent. */
function model(content: string, status = 200) {
    const calls: any[] = [];
    const fetch: any = async (url: string, init: any) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        return { ok: status === 200, status, json: async () => ({ model: "some/model", choices: [{ message: { content } }] }) };
    };
    return { calls, config: { url: "https://model.test/chat", model: "any", key: "secret", fetch } };
}
const pit = () => readPlayRecipe({ title: "Ball pit", things: [{ kind: "ball", count: 50, size: 0.2 }] })!;

describe("play author", () => {
    it("is off unless the server was given a model", () => {
        assert.strictEqual(playAuthorFromEnv({}), null);
        assert.strictEqual(playAuthorFromEnv({ PLAY_AUTHOR_URL: "https://model.test", PLAY_AUTHOR_MODEL: "any" }), null);
        assert.deepStrictEqual(playAuthorFromEnv({ PLAY_AUTHOR_URL: "https://model.test", PLAY_AUTHOR_MODEL: "any", PLAY_AUTHOR_KEY: "k" }), { url: "https://model.test", model: "any", key: "k" });
    });

    it("tidies a typed request", () => {
        assert.strictEqual(readPlayRequest("  more\tballs\n please  "), "more balls please");
        assert.strictEqual(readPlayRequest("x".repeat(1000)).length, PLAY_REQUEST_LIMIT);
        for (const value of [null, 12, {}, "   ", "\n"]) assert.strictEqual(readPlayRequest(value), "");
    });

    it("sends the brief, the game in play and the request, and reads a recipe back", async () => {
        const { calls, config } = model(JSON.stringify({ say: "Moon gravity.", recipe: { ...pit(), gravity: 1.6 }, action: null }));
        const answer = await askPlay("moon gravity", pit(), config);
        assert.strictEqual(answer.say, "Moon gravity.");
        assert.strictEqual(answer.recipe!.gravity, 1.6);
        assert.strictEqual(answer.recipe!.things[0].count, 50);
        assert.strictEqual(answer.action, null);
        assert.strictEqual(answer.servedBy, "some/model");
        const [{ url, headers, body }] = calls;
        assert.strictEqual(url, "https://model.test/chat");
        assert.strictEqual(headers.Authorization, "Bearer secret");
        assert.strictEqual(body.messages[0].content, PLAY_BRIEF);
        assert.ok(body.messages[1].content.includes('"title":"Ball pit"'));
        assert.ok(body.messages[1].content.includes('"""moon gravity"""'));
    });

    it("says so when there is no game yet, and reads an action", async () => {
        const { calls, config } = model('```json\n{"say":"A smash.","recipe":null,"action":{"name":"Smash","seconds":0.8,"moments":[{"at":0.5,"rightHand":"target"}]}}\n```');
        const answer = await askPlay("a smash when I hit", null, config);
        assert.ok(calls[0].body.messages[1].content.startsWith("There is no game in play yet."));
        assert.strictEqual(answer.recipe, null);
        assert.deepStrictEqual({ name: answer.action!.name, contact: answer.action!.contact }, { name: "smash", contact: 0.5 });
    });

    it("clamps whatever the model writes", async () => {
        const { config } = model(JSON.stringify({ say: "x".repeat(900), recipe: { seconds: 1e9, gravity: 9e9, arena: { halfX: 1e6 }, things: [{ kind: "ball", count: 1e9, size: 99 }] }, action: { moments: [{ at: 0.5, rightHand: [1e9, 1e9, 1e9] }] } }));
        const answer = await askPlay("everything, maximum", null, config);
        assert.strictEqual(answer.say.length, 160);
        assert.deepStrictEqual([answer.recipe!.seconds, answer.recipe!.gravity, answer.recipe!.arena.halfX, answer.recipe!.things[0].count, answer.recipe!.things[0].size], [180, 25, 15, 400, 1.5]);
        assert.deepStrictEqual(answer.action!.moments[0].rightHand, [1.1, 2.4, 1.2]);
    });

    it("changes nothing when the model returns neither", async () => {
        const { config } = model(JSON.stringify({ say: "That is not about the game.", recipe: null, action: null }));
        const answer = await askPlay("what is the weather", pit(), config);
        assert.deepStrictEqual([answer.recipe, answer.action, answer.say], [null, null, "That is not about the game."]);
    });

    it("fails plainly on an empty request, a refusal, junk, or a model that hangs", async () => {
        await assert.rejects(askPlay("   ", null, model("{}").config), /Nothing was asked/);
        await assert.rejects(askPlay("more balls", null, model("{}", 500).config), /did not answer \(500\)/);
        await assert.rejects(askPlay("more balls", null, model("I would rather chat.").config), /format asked/);
        const hang: any = (_url: string, init: any) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
        await assert.rejects(askPlay("more balls", null, { url: "https://model.test", model: "any", key: "k", fetch: hang, timeoutMs: 30 }), /took too long/);
    });
});
