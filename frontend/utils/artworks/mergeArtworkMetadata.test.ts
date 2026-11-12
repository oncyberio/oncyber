import { mergeArtworkMetadata } from "./mergeArtworkMetadata";
import type { FetchedAsset } from "../../@types/Asset";
const owner = {
    address: "0x" + "a".repeat(40),
    profile_img_url: "owner.png",
    user: { username: "Collector" },
};
const creator = {
    address: "0x" + "b".repeat(40),
    user: { username: "Artist", profile_img_url: "artist.png" },
};
const saved: FetchedAsset = {
    blockchain: "ethereum",
    name: "Saved",
    owner,
    creator,
    ownerships: [{ owner, quantity: 1 }],
    supply: 1,
};

test.each([undefined, null, {}, { address: "" }, { address: "   " }])(
    "preserves saved attribution when refreshed accounts are missing: %p",
    (account) => {
        const result = mergeArtworkMetadata(saved, {
            blockchain: "ethereum",
            name: "Refreshed",
            owner: account as any,
            creator: account as any,
        });
        expect(result).toMatchObject({
            name: "Refreshed",
            owner,
            creator,
            ownerships: saved.ownerships,
            supply: 1,
        });
    }
);
test("keeps known names and avatars for the same account, while accepting new profile fields", () => {
    const result = mergeArtworkMetadata(saved, {
        blockchain: "ethereum",
        owner: {
            address: owner.address.toUpperCase().replace("0X", "0x"),
            profile_img_url: null,
            user: { username: "", profile_img_url: "new.png" },
        },
    });
    expect(result.owner).toMatchObject({
        profile_img_url: "owner.png",
        user: { username: "Collector", profile_img_url: "new.png" },
    });
    expect(saved.owner).toEqual(owner);
});
test("accepts an explicit owner change without carrying over the previous collector's identity or owner list", () => {
    const nextOwner = { address: "0x" + "c".repeat(40), user: {} };
    const result = mergeArtworkMetadata(saved, {
        blockchain: "ethereum",
        owner: nextOwner,
    });
    expect(result.owner).toEqual(nextOwner);
    expect(result.ownerships).toBeUndefined();
    expect(result.creator).toEqual(creator);
});
test("retains explicit burn ownership and never substitutes the creator as collector", () => {
    const result = mergeArtworkMetadata(saved, {
        blockchain: "ethereum",
        owner: { address: "0x" + "0".repeat(40), user: {} },
    });
    expect(result.owner.address).toBe("0x" + "0".repeat(40));
    expect(result.ownerships).toBeUndefined();
});
test("accepts refreshed multi-owner and supply information", () => {
    const ownerships = [
        { owner, quantity: 2 },
        { owner: creator, quantity: 1 },
    ];
    expect(
        mergeArtworkMetadata(saved, {
            blockchain: "ethereum",
            ownerships,
            supply: 3,
        })
    ).toMatchObject({ ownerships, supply: 3 });
});
