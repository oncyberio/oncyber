const mockSdkLoaded = jest.fn();
const mockCreateClient = jest.fn();
jest.mock("./alchemyNfts", () => {
    mockSdkLoaded();
    return { createAlchemyNftClient: mockCreateClient };
});
jest.mock("@env", () => ({
    nodeEnv: {
        ETH_BALANCE_CHECKER_RPC: "https://eth.example",
        POLYGON_RPC: "https://polygon.example",
    },
}));

beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockCreateClient.mockReset().mockImplementation((rpc) => ({ rpc }));
});

test("visiting without owned-avatar discovery never loads the SDK", () => {
    require("./vrmNftClient");
    expect(mockSdkLoaded).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
});

test("concurrent discovery reuses each chain's client and correct RPC", async () => {
    const { getVrmNftClient } = require("./vrmNftClient");
    const [first, second, polygon] = await Promise.all([
        getVrmNftClient("eth"),
        getVrmNftClient("eth"),
        getVrmNftClient("polygon"),
    ]);
    expect(first).toBe(second);
    expect(first.rpc).toBe("https://eth.example");
    expect(polygon.rpc).toBe("https://polygon.example");
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
});

test("failed initialization can be retried", async () => {
    mockCreateClient.mockImplementationOnce(() => {
        throw new Error("unavailable");
    });
    const { getVrmNftClient } = require("./vrmNftClient");
    await expect(getVrmNftClient("eth")).rejects.toThrow("unavailable");
    await expect(getVrmNftClient("eth")).resolves.toMatchObject({
        rpc: "https://eth.example",
    });
});
