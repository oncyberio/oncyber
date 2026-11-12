import { ownedAvatarChoice, ownedFirst } from "./useOwnedLobbyAvatars";

test("owned and uploaded choices precede the catalog without duplicates", () => {
    const mine = ownedAvatarChoice({ id: "mine", url: "https://example.com/a.vrm", name: "Mine" });
    const other = { id: "default", name: "Default", url: "https://example.com/b.vrm" };
    expect(ownedFirst([mine], [{ ...mine, id: "duplicate" }, other])).toEqual([mine, other]);
});

test("NFT model metadata uses the existing Pinata gateway and skips ordinary art", () => {
    expect(ownedAvatarChoice({ metadata: { vrm_url: "ipfs://model", name: "Owned", image: "ipfs://portrait" } })).toMatchObject({ url: "https://cyber.mypinata.cloud/ipfs/model", img: "https://cyber.mypinata.cloud/ipfs/portrait", owned: true });
    expect(ownedAvatarChoice({ metadata: { image: "https://example.com/art.png" } })).toBeUndefined();
    expect(ownedAvatarChoice({ url: "javascript:bad" })).toBeUndefined();
});

test("supports nested VRM metadata", () => {
    expect(ownedAvatarChoice({ metadata: { assets: [{ media_type: "model", files: [{ file_type: "model/vrm", url: "https://example.com/a.vrm" }] }] } }).url).toBe("https://example.com/a.vrm");
});
