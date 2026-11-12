/** @jest-environment node */
const mockSolanaLoaded = jest.fn();
const mockSolanaLookup = jest.fn();
let mockSolanaLoadError: Error | null = null;

jest.mock("./solanaAssets", () => {
    mockSolanaLoaded();
    if (mockSolanaLoadError) throw mockSolanaLoadError;
    return { fetchSolanaAssetById: mockSolanaLookup };
});
jest.mock("./getAddrType", () => ({ getAddrType: (wallet) => wallet }));
jest.mock("./ethereumAssets", () => ({ fetchEthereumAssetById: jest.fn() }));
jest.mock("./polygonAssets", () => ({
    fetchChainAssetById: jest.fn(),
    fetchOwnedChainAssets: jest.fn(),
}));
jest.mock("./autographAssets", () => ({ fetchAutographAssetById: jest.fn() }));
jest.mock("./nftPortAssets", () => ({ fetchNftPortAssetById: jest.fn() }));
jest.mock("./niftyAssets", () => ({}));
jest.mock("./tezosAssets", () => ({ fetchTezosAssetById: jest.fn() }));
jest.mock("./counterpartyAssets", () => ({
    fetchCounterPartyAssetById: jest.fn(),
}));

const load = () => require("./fetchAssets") as typeof import("./fetchAssets");
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSolanaLookup.mockReset();
    mockSolanaLoadError = null;
});

test("loading the shared asset API does not initialize the Solana SDK module", () => {
    expect(load().fetchAssetById).toBeInstanceOf(Function);
    expect(mockSolanaLoaded).not.toHaveBeenCalled();
});

test("native Solana metadata lookup loads on demand and preserves the result", async () => {
    const { fetchAssetById } = load();
    const result = { success: true, asset: { name: "Solana artwork" } };
    mockSolanaLookup.mockResolvedValue(result);
    await expect(fetchAssetById("solana", "mint", "token")).resolves.toBe(
        result
    );
    expect(mockSolanaLookup).toHaveBeenCalledWith("solana", "mint");
    await fetchAssetById("solana", "second-mint", "second-token");
    expect(mockSolanaLoaded).toHaveBeenCalledTimes(1);
});

test("Solana OpenSea metadata keeps its existing API route without loading the SDK", async () => {
    const { fetchAssetById } = load();
    const lookup = jest.requireMock("./polygonAssets").fetchChainAssetById;
    const result = { success: true, asset: { name: "OpenSea artwork" } };
    lookup.mockResolvedValue(result);
    await expect(
        fetchAssetById("solana", "mint", "token", "opensea")
    ).resolves.toBe(result);
    expect(lookup).toHaveBeenCalledWith("solana", "solana", "mint", "token");
    expect(mockSolanaLoaded).not.toHaveBeenCalled();
});

const assetRoutes: Array<
    [string, string | undefined, string, string, unknown[]]
> = [
    [
        "ethereum",
        undefined,
        "./ethereumAssets",
        "fetchEthereumAssetById",
        ["asset", "token"],
    ],
    [
        "ethereum",
        "matic",
        "./polygonAssets",
        "fetchChainAssetById",
        ["matic", "ethereum", "asset", "token"],
    ],
    [
        "ethereum",
        "klaytn",
        "./polygonAssets",
        "fetchChainAssetById",
        ["klaytn", "ethereum", "asset", "token"],
    ],
    [
        "ethereum",
        "autograph",
        "./autographAssets",
        "fetchAutographAssetById",
        ["ethereum", "asset", "token", { extra: true }],
    ],
    [
        "ethereum",
        "nftport",
        "./nftPortAssets",
        "fetchNftPortAssetById",
        ["ethereum", "asset", "token"],
    ],
    [
        "tezos",
        undefined,
        "./tezosAssets",
        "fetchTezosAssetById",
        ["tezos", "asset", "token"],
    ],
    [
        "counterparty",
        undefined,
        "./counterpartyAssets",
        "fetchCounterPartyAssetById",
        ["token"],
    ],
];
test.each(assetRoutes)(
    "%s/%s routing remains independent of Solana",
    async (chain, marketplace, module, name, args) => {
        const { fetchAssetById } = load();
        const lookup = jest.requireMock(module)[name];
        const result = { success: true, asset: { name: "Existing artwork" } };
        lookup.mockResolvedValue(result);
        await expect(
            fetchAssetById(chain, "asset", "token", marketplace, {
                extra: true,
            })
        ).resolves.toBe(result);
        expect(lookup).toHaveBeenCalledWith(...args);
        expect(mockSolanaLoaded).not.toHaveBeenCalled();
    }
);

test("failed Solana metadata retains its existing failure result", async () => {
    const failure = { success: false, error: new Error("RPC unavailable") };
    mockSolanaLookup.mockResolvedValue(failure);
    await expect(
        load().fetchAssetById("solana", "mint", "token")
    ).resolves.toBe(failure);
});

test("Solana module load failure rejects without trying another chain", async () => {
    const { fetchAssetById } = load();
    mockSolanaLoadError = new Error("Chunk unavailable");
    await expect(fetchAssetById("solana", "mint", "token")).rejects.toBe(
        mockSolanaLoadError
    );
    expect(mockSolanaLookup).not.toHaveBeenCalled();
    expect(
        jest.requireMock("./polygonAssets").fetchChainAssetById
    ).not.toHaveBeenCalled();
});

test("unsupported refetch chains still reject without loading Solana", async () => {
    await expect(
        load().fetchAssetById("unknown", "asset", "token")
    ).rejects.toThrow("No refetch support for blockchain unknown");
    expect(mockSolanaLoaded).not.toHaveBeenCalled();
});

test("Solana owned assets retain API pagination without loading the SDK", async () => {
    const { fetchOwnedAssets } = load();
    const lookup = jest.requireMock("./polygonAssets").fetchOwnedChainAssets;
    const result = { assets: [], hasMore: false };
    lookup.mockResolvedValue(result);
    await expect(fetchOwnedAssets("solana", 3)).resolves.toBe(result);
    expect(lookup).toHaveBeenCalledWith("solana", "solana", 3);
    expect(mockSolanaLoaded).not.toHaveBeenCalled();
});

test("unsupported Solana ownership and creation stay fail-closed", async () => {
    const api = load();
    await expect(
        api.isOwnerOfNftCollection("solana", { blockchain: "solana" })
    ).resolves.toEqual({
        success: false,
        error: "No ownership check support for blockchain solana",
    });
    await expect(api.fetchCreatedAssets("solana")).rejects.toThrow(
        "Unavailable at the moment"
    );
    expect(mockSolanaLoaded).not.toHaveBeenCalled();
});
