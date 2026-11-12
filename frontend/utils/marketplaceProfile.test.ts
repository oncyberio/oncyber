import { marketplaceProfileUrl } from "./marketplaceProfile";

const address = "0x" + "a".repeat(40);
test.each([
    undefined,
    "https://opensea.io",
    "https://opensea.io/accounts",
    "https://opensea.io/accounts/",
    "https://www.opensea.io/accounts/",
    "https://opensea.io/account",
])("uses the current OpenSea profile route for base %s", (base) => {
    expect(marketplaceProfileUrl(address, base)).toBe(
        `https://opensea.io/${address}`
    );
});

test("preserves other marketplaces and the existing Hic et Nunc migration", () => {
    expect(
        marketplaceProfileUrl("tz1Artist", "https://objkt.com/profile/")
    ).toBe("https://objkt.com/profile/tz1Artist");
    expect(
        marketplaceProfileUrl(
            "SolanaArtist",
            "https://explorer.solana.com/address"
        )
    ).toBe("https://explorer.solana.com/address/SolanaArtist");
    expect(marketplaceProfileUrl("tz1Artist", "https://hicetnunc.xyz/tz")).toBe(
        "https://hicetnunc.art/tz/tz1Artist"
    );
    expect(marketplaceProfileUrl("", "https://opensea.io/accounts")).toBe("");
});
