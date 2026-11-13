import { AiProvider, ChatMessage, runAssistant } from "./assistant";
import { emptyChangeset } from "./edits";

function scripted(
    replies: Partial<ChatMessage>[]
): AiProvider & { seen: ChatMessage[][] } {
    const seen: ChatMessage[][] = [];
    return {
        id: "test",
        label: "Test",
        seen,
        verify: async () => ["m"],
        complete: async ({ messages }) => {
            seen.push(messages.map((m) => ({ ...m })));
            return {
                role: "assistant",
                content: null,
                ...replies.shift(),
            } as ChatMessage;
        },
    };
}

const call = (id: string, name: string, args: object) => ({
    id,
    type: "function" as const,
    function: { name, arguments: JSON.stringify(args) },
});

const github = {
    mainSha: async () => "base",
    searchCode: async () => ["frontend/a.tsx"],
    readFile: async (path: string) =>
        path === "frontend/a.tsx" ? "<h1>Hello</h1>" : null,
};

describe("contributor assistant", () => {
    it("searches, reads, and proposes a change with a live preview", async () => {
        const provider = scripted([
            { tool_calls: [call("1", "search_code", { query: "Hello" })] },
            {
                tool_calls: [
                    call("2", "read_file", { path: "frontend/a.tsx" }),
                ],
            },
            {
                tool_calls: [
                    call("3", "propose_change", {
                        title: "Say hi",
                        summary: "The title says Hi.",
                        edits: [
                            {
                                path: "frontend/a.tsx",
                                find: "Hello",
                                replace: "Hi",
                            },
                        ],
                        live: {
                            ops: [{ selector: "h1", text: "Hi" }],
                            css: "@import x;",
                        },
                    }),
                ],
            },
        ]);
        const changeset = emptyChangeset();
        const turn = await runAssistant({
            provider,
            key: "k",
            model: "m",
            github,
            changeset,
            history: [],
            request: "say hi",
            page: { path: "/", title: "Oncyber" },
        });
        expect(turn).toEqual({
            kind: "proposal",
            proposal: expect.objectContaining({
                title: "Say hi",
                files: { "frontend/a.tsx": "<h1>Hi</h1>" },
                live: { ops: [{ selector: "h1", text: "Hi" }] },
            }),
        });
        expect(changeset.baseSha).toBe("base");
        // Search results and file text went back to the model as tool output.
        const last = provider.seen[2];
        expect(
            last.filter((m) => m.role === "tool").map((m) => m.content)
        ).toEqual(["frontend/a.tsx", "<h1>Hello</h1>"]);
    });

    it("sends a failed edit back to the model to retry", async () => {
        const provider = scripted([
            {
                tool_calls: [
                    call("1", "read_file", { path: "frontend/a.tsx" }),
                    call("2", "propose_change", {
                        title: "x",
                        summary: "x",
                        edits: [
                            {
                                path: "frontend/a.tsx",
                                find: "Nope",
                                replace: "x",
                            },
                        ],
                        live: {},
                    }),
                ],
            },
            { content: "I couldn't find it." },
        ]);
        const turn = await runAssistant({
            provider,
            key: "k",
            model: "m",
            github,
            changeset: emptyChangeset(),
            history: [],
            request: "x",
            page: { path: "/", title: "" },
        });
        expect(turn).toEqual({ kind: "reply", text: "I couldn't find it." });
        const tool = provider.seen[1].filter((m) => m.role === "tool");
        expect(tool[1].content).toContain("Not applied");
    });

    it("refuses paths outside the repository", async () => {
        const provider = scripted([
            { tool_calls: [call("1", "read_file", { path: "../secret" })] },
            { content: "ok" },
        ]);
        await runAssistant({
            provider,
            key: "k",
            model: "m",
            github,
            changeset: emptyChangeset(),
            history: [],
            request: "x",
            page: { path: "/", title: "" },
        });
        expect(provider.seen[1].find((m) => m.role === "tool").content).toBe(
            "This path can't be read."
        );
    });
});
