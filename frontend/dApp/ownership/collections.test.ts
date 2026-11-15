import { isCollectionOwner } from "./collections";

const mockProviderUrls: string[] = [];
const mockBalanceOf = jest.fn();

jest.mock("ethers", () => ({
    ethers: {
        providers: {
            JsonRpcProvider: jest.fn((url: string) => {
                mockProviderUrls.push(url);
                return { url };
            }),
        },
        Contract: jest.fn(() => ({ balanceOf: mockBalanceOf })),
    },
}));
jest.mock("@env", () => ({
    nodeEnv: {
        ETH_RPC: "https://eth.test",
        BASE_RPC: "https://base.test",
        SHAPE_RPC: "https://shape.test",
    },
}));
jest.mock("@utils/ethereumAssets", () => ({ isOwnerOfEtherumNft: jest.fn() }));
jest.mock("@utils/tezosAssets", () => ({ isOwnerOfTezosNft: jest.fn() }));
jest.mock("@utils/solanaAssets", () => ({ isOwnerOfSolanaNft: jest.fn() }));

const wallet = "0x" + "a".repeat(40);
const collection = {
    slug: "some-collection",
    address: "0x" + "b".repeat(40),
    type: "ERC721",
};

beforeEach(() => {
    mockProviderUrls.length = 0;
    mockBalanceOf.mockReset();
});

test.each([
    ["ethereum", "https://eth.test"],
    ["base", "https://base.test"],
    ["shape", "https://shape.test"],
] as const)(
    "%s gating checks ownership over its own RPC",
    async (chain, rpc) => {
        mockBalanceOf.mockResolvedValue({ toNumber: () => 1 });
        const result = await isCollectionOwner(wallet, {
            ...collection,
            blockchain: chain,
        });
        expect(mockProviderUrls).toEqual([rpc]);
        expect(mockBalanceOf).toHaveBeenCalledWith(wallet);
        expect(result).toEqual({ success: true, value: true });
    }
);

test("a Shape wallet holding nothing is not an owner", async () => {
    mockBalanceOf.mockResolvedValue({ toNumber: () => 0 });
    const result = await isCollectionOwner(wallet, {
        ...collection,
        blockchain: "shape",
    });
    expect(result).toEqual({ success: true, value: false });
});

test("unknown chains are rejected without an RPC call", async () => {
    const result = await isCollectionOwner(wallet, {
        ...collection,
        blockchain: "toString" as any,
    });
    expect(result.success).toBe(false);
    expect(mockProviderUrls).toEqual([]);
});
