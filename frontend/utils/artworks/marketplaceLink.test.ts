import { marketplaceLink } from "./marketplaceLink";

describe("marketplaceLink", () => {
    it("links Ethereum NFTs to OpenSea", () => {
        expect(
            marketplaceLink({
                blockchain: "ethereum",
                contract_address: "0xabc",
                token_id: "7",
            })
        ).toEqual({
            id: "opensea",
            name: "OpenSea",
            href: "https://opensea.io/assets/ethereum/0xabc/7",
        });
    });

    it("uses the OpenSea chain slug for Polygon and Base", () => {
        expect(
            marketplaceLink({
                blockchain: "ethereum",
                marketplace: "polygon",
                contract_address: "0xabc",
                token_id: "1",
            })?.href
        ).toBe("https://opensea.io/assets/matic/0xabc/1");
        expect(
            marketplaceLink({
                blockchain: "base" as any,
                marketplace: "base",
                contract_address: "0xdef",
                token_id: "2",
            })?.href
        ).toBe("https://opensea.io/assets/base/0xdef/2");
    });

    it("prefers OpenSea's own permalink when the asset has one", () => {
        expect(
            marketplaceLink({
                blockchain: "ethereum",
                contract_address: "0xabc",
                token_id: "7",
                openSeaLink: "https://opensea.io/item/ethereum/0xabc/7",
            })?.href
        ).toBe("https://opensea.io/item/ethereum/0xabc/7");
    });

    it("links Tezos NFTs to objkt", () => {
        expect(
            marketplaceLink({
                blockchain: "tezos",
                contract_address: "KT1abc",
                token_id: "42",
                openSeaLink: "https://objkt.com/asset/hicetnunc/42",
            })
        ).toEqual({
            id: "objkt",
            name: "objkt",
            href: "https://objkt.com/tokens/KT1abc/42",
        });
    });

    it("links Solana NFTs to Magic Eden by mint", () => {
        expect(
            marketplaceLink({
                blockchain: "solana",
                contract_address: "Mint111",
                token_id: "x@Mint111",
                openSeaLink: "https://explorer.solana.com/address/Mint111",
            })?.href
        ).toBe("https://magiceden.io/item-details/Mint111");
    });

    it("returns null when there is no marketplace page", () => {
        expect(marketplaceLink(null)).toBeNull();
        expect(
            marketplaceLink({ blockchain: "none" as any, token_id: "1" })
        ).toBeNull();
        expect(
            marketplaceLink({
                blockchain: "niftygateway",
                openSeaLink: "https://niftygateway.com/x",
            })
        ).toBeNull();
        expect(
            marketplaceLink({ blockchain: "ethereum", token_id: "1" })
        ).toBeNull();
    });
});
