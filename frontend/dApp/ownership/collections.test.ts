import { isCollectionOwner } from "./collections";
import { isOwnerOfEtherumNft } from "@utils/ethereumAssets";

const mockProviderUrls: string[] = [];
const mockBalanceOf = jest.fn();
const mockQueryFilter = jest.fn();
const mockBalanceOfBatch = jest.fn();

jest.mock("ethers", () => ({
    ethers: {
        providers: {
            JsonRpcProvider: jest.fn((url: string) => {
                mockProviderUrls.push(url);
                return { url };
            }),
        },
        Contract: jest.fn(() => ({
            balanceOf: mockBalanceOf,
            filters: { TransferSingle: jest.fn(() => "filter") },
            queryFilter: mockQueryFilter,
            balanceOfBatch: mockBalanceOfBatch,
        })),
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
    mockQueryFilter.mockReset();
    mockBalanceOfBatch.mockReset();
    (isOwnerOfEtherumNft as jest.Mock).mockReset();
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

const erc1155 = {
    ...collection,
    type: "ERC1155",
    blockchain: "shape" as const,
};

test("ERC-1155 ownership is read on-chain when the RPC allows the scan", async () => {
    mockQueryFilter.mockResolvedValue([{ args: { id: 7 } }]);
    mockBalanceOfBatch.mockResolvedValue([{ gt: () => true }]);
    const result = await isCollectionOwner(wallet, erc1155);
    expect(mockBalanceOfBatch).toHaveBeenCalledWith([wallet], [7]);
    expect(result).toEqual({ success: true, value: true });
    expect(isOwnerOfEtherumNft).not.toHaveBeenCalled();
});

test("ERC-1155 falls back to OpenSea when the RPC refuses the log scan", async () => {
    mockQueryFilter.mockRejectedValue(
        new Error("query exceeds max block range 10000")
    );
    (isOwnerOfEtherumNft as jest.Mock).mockResolvedValue({
        success: true,
        value: true,
    });
    const result = await isCollectionOwner(wallet, erc1155);
    expect(isOwnerOfEtherumNft).toHaveBeenCalledWith(wallet, {
        slug: "some-collection",
        blockchain: "shape",
    });
    expect(result).toEqual({ success: true, value: true });
});

test("without a slug a refused log scan is reported, not guessed", async () => {
    mockQueryFilter.mockRejectedValue(
        new Error("query exceeds max block range 10000")
    );
    const result = await isCollectionOwner(wallet, {
        ...erc1155,
        slug: undefined,
    });
    expect(result).toEqual({
        success: false,
        error: "query exceeds max block range 10000",
    });
    expect(isOwnerOfEtherumNft).not.toHaveBeenCalled();
});
