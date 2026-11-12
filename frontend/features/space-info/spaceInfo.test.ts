import { buildSpaceInfo } from "./spaceInfo";
import {
    defaultCategoryFor,
    DEFAULT_FILTERS,
    parseFilters,
    setDefaultFeedCategory,
} from "@features/landing-carousel/data";

const wallet = "0x1234567890abcdef1234567890abcdef12345678";

test("space info lists the deployer, artists by work count and artworks", () => {
    const info = buildSpaceInfo({
        id: "abc",
        owner: wallet,
        ownerName: "curator",
        info: {
            headline: " Night Room ",
            customLink: "night",
            description: "Hi",
        },
        artworks: {
            a: {
                data: {
                    id: "1",
                    name: "One",
                    image_url: "https://x.test/1.png",
                    creator: { address: "0xaaa", user: { username: "ana" } },
                },
            },
            b: {
                data: {
                    id: "2",
                    name: "Two",
                    creator: { address: "0xaaa", user: { username: "ana" } },
                    image_url: "ipfs://cid",
                },
            },
            c: {
                data: { id: "3", name: "Three", creator: { address: "0xbbb" } },
            },
            t: { data: { id: "4", text: "Welcome" } },
            m: {
                data: {
                    id: "5",
                    name: "bench.glb",
                    creator: { address: "0xccc" },
                },
            },
            e: { data: {} },
        },
    });
    expect(info.title).toBe("Night Room");
    expect(info.href).toBe("/night");
    expect(info.deployer).toMatchObject({ name: "curator", address: wallet });
    expect(info.artists.map((artist) => [artist.name, artist.count])).toEqual([
        ["ana", 2],
        ["0xbbb", 1],
    ]);
    expect(info.artworks.map((artwork) => artwork.title)).toEqual([
        "One",
        "Two",
        "Three",
    ]);
    expect(info.artworks[1].imageUrl).toContain(
        "cyber.mypinata.cloud/ipfs/cid"
    );
    expect(info.totalArtworks).toBe(3);
});

test("space info falls back to a short wallet and an untitled name", () => {
    const info = buildSpaceInfo({ id: "x", owner: wallet, info: {} });
    expect(info.title).toBe("Untitled space");
    expect(info.deployer.name).toBe("0x1234…5678");
    expect(info.href).toBe("/spaces/x");
});

test("staff picks become the default feed at five", () => {
    expect(defaultCategoryFor(0)).toBe("most-visited");
    expect(defaultCategoryFor(4)).toBe("most-visited");
    expect(defaultCategoryFor(5)).toBe("staff");
    setDefaultFeedCategory("staff");
    expect(parseFilters({}).category).toBe("staff");
    expect(parseFilters({ category: "most-visited" }).category).toBe(
        "most-visited"
    );
    setDefaultFeedCategory("most-visited");
    expect(DEFAULT_FILTERS.category).toBe("most-visited");
});

test("profile NFTs use small CDN thumbnails before any original", () => {
    const { profileNft } = require("./spaceInfo");
    const nft = profileNft({
        identifier: "7",
        contract: "0xabc",
        name: "Piece",
        collection: "set",
        display_image_url: "https://i2c.seadn.io/ethereum/0xabc/x.png",
        image_url: "https://example.com/original-8k.png",
    });
    expect(nft.imageUrls[0]).toBe(
        "https://i2c.seadn.io/ethereum/0xabc/x.png?w=256"
    );
    expect(nft.imageUrls[nft.imageUrls.length - 1]).toBe(
        "https://example.com/original-8k.png"
    );
    expect(nft.href).toBe("https://opensea.io/assets/ethereum/0xabc/7");
});
