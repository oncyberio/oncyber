/** @jest-environment node */
import {
    artworkLine,
    spaceContent,
    SPACE_CONTENT_LIMITS,
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
                // An upload still called by its file name.
                c: {
                    data: {
                        mime_type: "model/gltf-binary",
                        name: "donald_trump.glb",
                    },
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
