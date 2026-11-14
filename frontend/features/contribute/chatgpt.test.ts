import {
    fromResponsesOutput,
    readResponseStream,
    toResponsesInput,
} from "./chatgpt";

function stream(text: string) {
    const bytes = new TextEncoder().encode(text);
    let sent = false;
    return {
        getReader: () => ({
            read: async () =>
                sent
                    ? { done: true, value: undefined }
                    : ((sent = true), { done: false, value: bytes }),
        }),
    } as any;
}

describe("ChatGPT plan provider", () => {
    it("maps chat history to Responses input", () => {
        const { instructions, input } = toResponsesInput([
            { role: "system", content: "be brief" },
            { role: "user", content: "hi" },
            {
                role: "assistant",
                content: null,
                tool_calls: [
                    {
                        id: "c1",
                        type: "function",
                        function: {
                            name: "read_file",
                            arguments: '{"path":"a"}',
                        },
                    },
                ],
            },
            { role: "tool", tool_call_id: "c1", content: "file" },
        ]);
        expect(instructions).toBe("be brief");
        expect(input).toEqual([
            { role: "user", content: "hi" },
            {
                type: "function_call",
                call_id: "c1",
                name: "read_file",
                arguments: '{"path":"a"}',
            },
            { type: "function_call_output", call_id: "c1", output: "file" },
        ]);
    });

    it("maps output back to a chat message", () => {
        expect(
            fromResponsesOutput([
                {
                    type: "message",
                    content: [{ type: "output_text", text: "ok" }],
                },
                {
                    type: "function_call",
                    call_id: "c2",
                    name: "search_code",
                    arguments: "{}",
                },
            ])
        ).toEqual({
            role: "assistant",
            content: "ok",
            tool_calls: [
                {
                    id: "c2",
                    type: "function",
                    function: { name: "search_code", arguments: "{}" },
                },
            ],
        });
    });

    it("waits for response.completed in the stream", async () => {
        const done = {
            type: "response.completed",
            response: {
                output: [
                    {
                        type: "message",
                        content: [{ type: "output_text", text: "hi" }],
                    },
                ],
            },
        };
        await expect(
            readResponseStream(
                stream(
                    `event: x\ndata: {"type":"response.output_text.delta"}\n\n` +
                        `data: ${JSON.stringify(done)}\n\n`
                )
            )
        ).resolves.toEqual({ role: "assistant", content: "hi" });
        await expect(
            readResponseStream(
                stream(`data: {"type":"response.incomplete"}\n\n`)
            )
        ).rejects.toThrow("stopped early");
        await expect(
            readResponseStream(
                stream(`data: {"type":"response.output_text.delta"}\n\n`)
            )
        ).rejects.toThrow("cut off");
    });
});
