import {
    invalidateLobbyEndpoint,
    parseLobbyEndpoints,
    selectLobbyEndpoint,
} from "./lobbyEndpoints";

beforeEach(() => {
    globalThis.fetch = jest.fn();
    invalidateLobbyEndpoint();
    delete process.env.NEXT_PUBLIC_LOBBY_REGION;
});
afterEach(() => {
    jest.restoreAllMocks();
});

test("regional endpoints are bounded deployment configuration, never arbitrary insecure URLs", () => {
    expect(
        parseLobbyEndpoints(
            JSON.stringify([
                { id: "eu", httpUrl: "https://eu.example.com" },
                { id: "local", httpUrl: "http://127.0.0.1:2568" },
                { id: "bad", httpUrl: "http://example.com" },
                { id: "secret", httpUrl: "https://user:pass@example.com" },
                { id: "eu", httpUrl: "https://duplicate.example.com" },
            ])
        )
    ).toEqual([
        {
            id: "eu",
            httpUrl: "https://eu.example.com",
            wsUrl: "wss://eu.example.com",
        },
        {
            id: "local",
            httpUrl: "http://127.0.0.1:2568",
            wsUrl: "ws://127.0.0.1:2568",
        },
    ]);
});

test("selection ignores incompatible servers and caches a reachable v1 region", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
        async (url) =>
            ({
                ok: true,
                json: async () => ({
                    lobbyProtocol: String(url).includes("eu.") ? 1 : 0,
                }),
            } as Response)
    );
    const config = JSON.stringify([
        { id: "us", httpUrl: "https://us.example.com" },
        { id: "eu", httpUrl: "https://eu.example.com" },
    ]);
    expect(
        (await selectLobbyEndpoint(new AbortController().signal, config)).id
    ).toBe("eu");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await selectLobbyEndpoint(new AbortController().signal, config);
    expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("explicit region routing does not fall back into an unrelated legacy room", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(
        selectLobbyEndpoint(
            new AbortController().signal,
            JSON.stringify([{ id: "eu", httpUrl: "https://eu.example.com" }])
        )
    ).rejects.toThrow("No lobby region");
    const aborted = new AbortController();
    aborted.abort();
    await expect(selectLobbyEndpoint(aborted.signal)).rejects.toThrow(
        "cancelled"
    );
});

test("invalid explicit regional configuration never silently selects legacy Arena", async () => {
    await expect(
        selectLobbyEndpoint(new AbortController().signal, "{broken json")
    ).rejects.toThrow("No valid lobby regions");
    await expect(
        selectLobbyEndpoint(new AbortController().signal, "[]")
    ).rejects.toThrow("No valid lobby regions");
    expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("shared world protocol is an explicit endpoint opt-in and health version must match", async () => {
    const config = JSON.stringify([
        { id: "world", httpUrl: "http://127.0.0.1:2580", protocol: 2 },
    ]);
    expect(parseLobbyEndpoints(config)[0]).toMatchObject({ protocol: 2 });
    expect(
        parseLobbyEndpoints(
            JSON.stringify([
                { id: "invalid", httpUrl: "https://example.com", protocol: 3 },
            ])
        )
    ).toEqual([]);
    (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ lobbyProtocol: 2 }),
    });
    expect(
        await selectLobbyEndpoint(new AbortController().signal, config)
    ).toMatchObject({ protocol: 2 });
    invalidateLobbyEndpoint();
    (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ lobbyProtocol: 1 }),
    });
    await expect(
        selectLobbyEndpoint(new AbortController().signal, config)
    ).rejects.toThrow("No lobby region");
});
