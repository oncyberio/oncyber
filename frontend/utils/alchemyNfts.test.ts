import {
    createAlchemyNftClient,
    getNftsUrl,
    hexToDecimalString,
} from "./alchemyNfts";

test("builds the NFT v2 endpoint from an RPC URL", () => {
    const url = new URL(
        getNftsUrl("https://eth-mainnet.g.alchemy.com/v2/KEY", {
            owner: "0xabc",
            contractAddresses: ["0x1", "0x2"],
            withMetadata: false,
            pageKey: undefined,
        })
    );
    expect(url.origin + url.pathname).toBe(
        "https://eth-mainnet.g.alchemy.com/nft/v2/KEY/getNFTs"
    );
    expect(url.searchParams.getAll("contractAddresses")).toEqual([
        "0x1",
        "0x2",
    ]);
    expect(url.searchParams.get("withMetadata")).toBe("false");
    expect(url.searchParams.has("pageKey")).toBe(false);
});

test("returns JSON on 200 and throws on other errors", async () => {
    const ok = jest
        .fn()
        .mockResolvedValue({
            status: 200,
            json: async () => ({ ownedNfts: [] }),
        });
    await expect(
        createAlchemyNftClient(
            "https://x.g.alchemy.com/v2/K",
            ok
        ).alchemy.getNfts({ owner: "o" })
    ).resolves.toEqual({ ownedNfts: [] });
    const bad = jest
        .fn()
        .mockResolvedValue({ status: 500, statusText: "Server Error" });
    await expect(
        createAlchemyNftClient(
            "https://x.g.alchemy.com/v2/K",
            bad
        ).alchemy.getNfts({ owner: "o" })
    ).rejects.toThrow("500");
});

test("converts hex token ids to decimal", () => {
    expect(hexToDecimalString("0x1f")).toBe("31");
    expect(
        hexToDecimalString(
            "0x0000000000000000000000000000000000000000000000000000000000000001"
        )
    ).toBe("1");
});
