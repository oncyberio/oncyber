import { OPENSEA_ALLOWED_PATH, openSeaPath } from "./openSeaFetch";

test("normalizes full OpenSea URLs to v2 paths", () => {
    expect(
        openSeaPath("https://api.opensea.io/v2/chain/matic/account/0xabc/nfts")
    ).toBe("chain/matic/account/0xabc/nfts");
    expect(openSeaPath("https://api.opensea.io/api/v2/collections/x")).toBe(
        "collections/x"
    );
});

test("only read-only NFT paths go through the proxy", () => {
    const wallet = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
    for (const ok of [
        `chain/ethereum/account/${wallet}/nfts?limit=50&next=abc%3D`,
        `chain/matic/account/${wallet}/nfts`,
        `chain/ethereum/contract/${wallet}/nfts/123`,
        "collection/boredapeyachtclub/nfts?limit=50",
        "collections/boredapeyachtclub",
    ])
        expect(OPENSEA_ALLOWED_PATH.test(ok)).toBe(true);
    for (const bad of [
        "admin/secret",
        `chain/ethereum/account/${wallet}/nfts/../../orders`,
        "https://evil.example/x",
        `chain/ethereum/account/${wallet}/nfts?x=<script>`,
    ])
        expect(OPENSEA_ALLOWED_PATH.test(bad)).toBe(false);
});
