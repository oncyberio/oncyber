jest.mock("@utils/firebaseAdmin", () => ({
    db: { collection: jest.fn(), batch: jest.fn() },
    fire: {},
}));
jest.mock("@api/accounts/authenticate/utils/link", () => ({
    getAccountDoc: jest.fn(),
}));

import { askForScript, isAllowlisted, worldScriptsEnabled } from "./server";

const reply = (content: string, extra: object = {}) =>
    jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            model: "test/model",
            choices: [{ message: { content } }],
            usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0.0123 },
            ...extra,
        }),
    })) as any;

describe("world scripts on the server", () => {
    it("is off unless the flag is on", () => {
        expect(worldScriptsEnabled({})).toBe(false);
        expect(worldScriptsEnabled({ NEXT_PUBLIC_WORLD_SCRIPTS: "1" })).toBe(
            true
        );
    });

    it("lets in only listed accounts, by id or wallet", () => {
        expect(isAllowlisted(["acc1", "0xabc"], "0xABC, other")).toBe(true);
        expect(isAllowlisted(["acc1"], "")).toBe(false);
        expect(isAllowlisted(["anyone"], "*")).toBe(true);
    });

    it("asks OpenRouter with the server key and reports the cost", async () => {
        const fetcher = reply(
            '{"say":"Done","change":"content","name":"Coins","source":"world.add({})"}'
        );
        const result = await askForScript(
            { request: "add coins", currentSource: "old()" },
            fetcher,
            { OPENROUTER_API_KEY: "key-123", OPENROUTER_MODEL: "some/model" }
        );
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
        expect(init.headers.Authorization).toBe("Bearer key-123");
        const body = JSON.parse(init.body);
        expect(body.model).toBe("some/model");
        expect(body.messages[1].content).toContain("old()");
        expect(body.messages[1].content).toContain('"""add coins"""');
        expect(result.answer).toMatchObject({
            change: "content",
            source: "world.add({})",
        });
        expect(result.usage).toEqual({
            model: "test/model",
            promptTokens: 100,
            completionTokens: 50,
            costUsd: 0.0123,
        });
    });

    it("fails with the usage when the model writes no script", async () => {
        await expect(
            askForScript({ request: "x" }, reply("no idea"), {
                OPENROUTER_API_KEY: "k",
            })
        ).rejects.toMatchObject({
            message: "The model did not answer with a script.",
            usage: { promptTokens: 100 },
        });
    });

    it("says why when the provider refuses", async () => {
        const fetcher = jest.fn(async () => ({
            ok: false,
            status: 402,
            json: async () => ({ error: { message: "Insufficient credits" } }),
        })) as any;
        await expect(
            askForScript({ request: "x" }, fetcher, { OPENROUTER_API_KEY: "k" })
        ).rejects.toThrow(
            "The model did not answer (402: Insufficient credits)."
        );
    });

    it("asks for a style when the world has none, and passes on a failure", async () => {
        const fetcher = reply('{"source":"x()"}');
        await askForScript(
            {
                request: "coins",
                world: { title: "Starry Night", sky: "#0b1d51" },
                failure: { source: "bad(", reason: "SyntaxError: oops" },
            },
            fetcher,
            { OPENROUTER_API_KEY: "k" }
        );
        const first = JSON.parse(fetcher.mock.calls[0][1].body).messages[1]
            .content;
        expect(first).toContain("This world has no style yet");
        expect(first).toContain("Title: Starry Night");
        expect(first).toContain("SyntaxError: oops");

        await askForScript(
            {
                request: "coins",
                style: { palette: ["#000000", "#ffffff"], look: "toon" },
            },
            fetcher,
            { OPENROUTER_API_KEY: "k" }
        );
        const second = JSON.parse(fetcher.mock.calls[1][1].body).messages[1]
            .content;
        expect(second).toContain("This world's style (follow it)");
        expect(second).toContain('"look":"toon"');
    });
});
