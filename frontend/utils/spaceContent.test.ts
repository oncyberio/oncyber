/** @jest-environment node */
import {
    artworkLine,
    spaceContent,
    SPACE_CONTENT_LIMITS,
    uploadName,
    withoutContents,
} from "./spaceContent";

const text = (value: string) => ({
    data: { mime_type: "cyber/text", text: value },
});
const nft = (data: object) => ({ data: { mime_type: "image/png", ...data } });

describe("spaceContent", () => {
    it("reads the words on the walls, the longest first, once each", () => {
        const { texts } = spaceContent({
            artworks: {
                a: text("Museum\nOf\nMemes"),
                b: text(
                    "The squirrel that sparked a movement. Peanut was killed by the New York police."
                ),
                c: text("museum of memes"),
                d: text("ok"),
                e: text("  "),
            },
        });
        expect(texts).toEqual([
            "The squirrel that sparked a movement. Peanut was killed by the New York police.",
            "Museum Of Memes",
        ]);
    });

    it("lists named works with their artist and collection", () => {
        const { artworks, artists } = spaceContent({
            artistSearch: { names: ["6529Collections", "Grant Riven Yun"] },
            artworks: {
                a: nft({
                    name: "Aeroglyph6529",
                    description: "Myths of the Near Future\n\nMeme: 8",
                    creator: { user: { username: "6529Collections" } },
                    collection: { name: "The Memes by 6529" },
                    image_url: "https://example.com/a.png",
                }),
                // The same work hung twice.
                b: nft({
                    name: "Aeroglyph6529",
                    creator: { user: { username: "6529Collections" } },
                    collection: { name: "The Memes by 6529" },
                }),
                // Uploads called by their file names: a name, or none.
                c: {
                    data: {
                        mime_type: "model/gltf-binary",
                        name: "trump_skibidi_toilet.glb",
                    },
                },
                c2: { data: { mime_type: "image/jpeg", name: "IMG_1234.jpg" } },
                c3: { data: { mime_type: "image/png", name: "PFP.png" } },
                c4: {
                    data: { mime_type: "text/html", name: "Telegram: Contact" },
                },
                // Placeholders and account ids are not names.
                d: nft({
                    name: "43",
                    description: "No description provided",
                    creator: {
                        user: { username: "OWSfidhkijbX2U1aMKSiVGDiKyq2" },
                    },
                    collection: { name: "OpenSea Collection" },
                }),
                e: { data: { mime_type: "embed/youtube", name: "A video" } },
            },
        });
        expect(artworks).toEqual([
            {
                name: "Aeroglyph6529",
                creator: "6529Collections",
                collection: "The Memes by 6529",
                description: "Myths of the Near Future Meme: 8",
                image: "https://example.com/a.png",
            },
            { name: "trump skibidi toilet" },
            { name: "43" },
        ]);
        expect(artists).toEqual([
            "6529Collections",
            "Grant Riven Yun",
            "The Memes by 6529",
        ]);
    });

    it("lists where its portals lead, once each, never itself", () => {
        const { portals } = spaceContent({
            id: "5P8XBjWClakkWNVTEkzQ",
            portals: {
                a: { exhibitId: "HRkakF5x5rFEVvRqUu8S" },
                b: { exhibitId: "HRkakF5x5rFEVvRqUu8S" },
                c: { exhibitId: "5P8XBjWClakkWNVTEkzQ" },
                d: { exhibitId: "../etc" },
                e: {},
            },
        });
        expect(portals).toEqual(["HRkakF5x5rFEVvRqUu8S"]);
    });

    it("reads visits and dates in any stored form", () => {
        expect(
            spaceContent({
                number_of_visits: 140774,
                createdAt: "2021-12-11T10:48:15.352Z",
                lastContentUpdatedAt: 1718941272303,
            })
        ).toMatchObject({
            visits: 140774,
            created: "2021-12-11",
            modified: "2024-06-21",
        });
        expect(
            spaceContent({ createdAt: { _seconds: 1640995200 } }).created
        ).toBe("2022-01-01");
    });

    it("keeps to its limits and survives a space with nothing in it", () => {
        const many = Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => [
                `k${i}`,
                i % 2
                    ? text(`Wall text number ${i} `.repeat(20))
                    : nft({ name: `Work ${i}` }),
            ])
        );
        const content = spaceContent({ artworks: many });
        expect(content.artworks).toHaveLength(SPACE_CONTENT_LIMITS.artworks);
        expect(content.texts.length).toBeLessThanOrEqual(
            SPACE_CONTENT_LIMITS.texts
        );
        expect(content.texts.join("").length).toBeLessThanOrEqual(
            SPACE_CONTENT_LIMITS.textTotal
        );
        expect(spaceContent(null)).toEqual({
            texts: [],
            artworks: [],
            artists: [],
            portals: [],
            siblings: [],
        });
        expect(spaceContent({ artworks: { a: null, b: {} } }).artworks).toEqual(
            []
        );
    });
});

describe("artworkLine", () => {
    it("names the work, its artist and its collection", () => {
        expect(
            artworkLine({
                name: "Aeroglyph6529",
                creator: "6529Collections",
                collection: "The Memes by 6529",
            })
        ).toBe("Aeroglyph6529 by 6529Collections (The Memes by 6529)");
        expect(artworkLine({ name: "Solo" })).toBe("Solo");
        expect(artworkLine({ name: "A", creator: "X", collection: "X" })).toBe(
            "A by X"
        );
    });
});

describe("uploadName", () => {
    it.each([
        ["PEDRO.jpg", "PEDRO"],
        ["lebrontoy.png", "lebrontoy"],
        ["president_donald_j._trump__fly.glb", "president donald j trump fly"],
        ["Hammy.jpg", "Hammy"],
        ["IMG_1234.jpg", ""],
        ["Screenshot 2024-05-05 at 10.11.12.png", ""],
        ["untitled.glb", ""],
        ["12.png", ""],
        ["a1.mp4", ""],
        ["video2.mp4", ""],
        ["trump_ymca_dance (1).glb", "trump ymca dance"],
        ["TrumpPortrait.jpg.png", "TrumpPortrait"],
        [
            "world_war_2_usa_flag_animation.glb",
            "world war 2 usa flag animation",
        ],
        ["asd.png", ""],
        ["7358d270-d76e-11ef-94cb-5f844ceb9e30.jpg", ""],
        ["LYNXNPEB7R0F5.jpg", ""],
        ["GSapYunXIAAzQZu.jpg", ""],
        ["77772524007-getty-images-2182526163.jpg", ""],
        ["160504160857-03-donald-trump-0504.jpg", ""],
        ["nyu-121124-01.jpg", ""],
    ])("%s → %j", (file, name) => {
        expect(uploadName(file)).toBe(name);
    });
});

describe("siblings", () => {
    it("lists the creator's other spaces, skipping anything malformed", () => {
        expect(
            spaceContent({
                id: "self",
                ownerSpaces: [
                    { id: "a", name: "Frahm Flow", path: "/frahm-flow" },
                    { id: "self", name: "This one", path: "/spaces/self" },
                    {
                        id: "b",
                        name: "Bad",
                        path: "https://elsewhere.example/",
                    },
                    null,
                ],
            }).siblings
        ).toEqual([{ id: "a", name: "Frahm Flow", path: "/frahm-flow" }]);
    });
});

describe("review fixes", () => {
    it("leaves out a date no calendar holds instead of failing the page", () => {
        const content = spaceContent({
            createdAt: 1e20,
            lastUpdatedAt: { _seconds: 1700000000 },
        });
        expect(content.created).toBeUndefined();
        expect(content.modified).toBe("2023-11-14");
    });

    it("uses a work's original image when its preview is not a web address", () => {
        const { artworks } = spaceContent({
            artworks: {
                a: nft({
                    name: "One",
                    image_preview_url: "ipfs://preview",
                    image_url: "https://example.com/one.png",
                }),
                b: nft({
                    name: "Two",
                    image_preview_url: "https://example.com/two-small.png",
                    image_url: "https://example.com/two.png",
                }),
            },
        });
        expect(artworks.map((work) => work.image)).toEqual([
            "https://example.com/one.png",
            "https://example.com/two-small.png",
        ]);
    });

    it("links only to the creator's spaces on this site", () => {
        const { siblings } = spaceContent({
            id: "self",
            ownerSpaces: [
                { id: "a", name: "Fine", path: "/fine" },
                { id: "b", name: "Other host", path: "//evil.example" },
                { id: "c", name: "Backslash", path: "/\\evil.example" },
                { id: "d", name: "No slash", path: "evil.example" },
            ],
        });
        expect(siblings.map((link) => link.id)).toEqual(["a"]);
    });

    it("a gated space keeps its name and description and loses what is inside", () => {
        const space = {
            id: "s",
            number_of_visits: 12,
            createdAt: 1700000000000,
            lastUpdatedAt: 1700000000000,
            info: { headline: "Members Only", description: "By invitation." },
            artworks: {
                a: text("The secret story on the wall"),
                b: nft({ name: "Hidden Work" }),
            },
            portals: { p: { exhibitId: "ABCDEFGHIJKLMNOP" } },
            ownerSpaces: [{ id: "x", name: "Other", path: "/other" }],
            artistSearch: { names: ["Hidden Artist"] },
        };
        const shown = withoutContents(space);
        expect(shown.info).toEqual(space.info);
        expect(spaceContent(shown)).toEqual({
            texts: [],
            artworks: [],
            artists: [],
            portals: [],
            siblings: [],
        });
        // The space itself is not changed.
        expect(spaceContent(space).texts).toHaveLength(1);
        expect(spaceContent(space).visits).toBe(12);
        expect(spaceContent(space).created).toBe("2023-11-14");
        expect(withoutContents(null)).toBeNull();
    });
});
