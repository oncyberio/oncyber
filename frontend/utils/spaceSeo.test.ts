/** @jest-environment node */
import { singleDisplayQuery, spaceSeo } from "./spaceSeo";

const work = (data: object) => ({ data });

describe("spaceSeo", () => {
    it("titles a space with its own name and describes it in one line", () => {
        const seo = spaceSeo(
            {
                id: "VhtHNtMx3hB3bdKBOZMI",
                owner: "0xf20d5e0f",
                info: {
                    headline: "Frahm Gallery",
                    customLink: "frahm-gallery",
                    description:
                        "Premium frames.\n\nCheck out our Genesis launch.",
                },
                artworks: {
                    a: work({
                        creator: { user: { username: "kunstkennerey" } },
                    }),
                    b: work({ contract: { name: "Art Blocks" } }),
                    c: work({
                        creator: { user: { username: "kunstkennerey" } },
                    }),
                },
            },
            { ownerName: "frahm" }
        );
        expect(seo.title).toBe("Frahm Gallery");
        expect(seo.description).toBe(
            "Premium frames. Check out our Genesis launch. Featuring NFTs from kunstkennerey, Art Blocks and many more"
        );
        expect(seo.socialDescription).toBe(
            "Premium frames.\n\nCheck out our Genesis launch."
        );
        expect(seo.featuring).toEqual(["kunstkennerey", "Art Blocks"]);
        expect(seo.keywords).toBe("kunstkennerey, Art Blocks");
        expect(seo.canonicalPath).toBe("/frahm-gallery");
    });

    it("falls back to the creator and the gallery for an untitled, empty space", () => {
        const seo = spaceSeo({
            id: "abc",
            owner: "0xf20d5e0f0a",
            info: { room: "white-cube_v2" },
        });
        expect(seo.title).toBe("0xf20's Untitled white-cube_v2 - oncyber");
        expect(seo.description).toBe(
            "Immerse yourself in 0xf20's white-cube_v2."
        );
        expect(seo.featuring).toEqual([]);
        expect(seo.canonicalPath).toBe("/spaces/abc");
    });

    it("cuts a long description at a word", () => {
        const seo = spaceSeo({
            id: "abc",
            info: { headline: "Long", description: "word ".repeat(80) },
            artworks: { a: work({ name: "Ignored when the text is long" }) },
        });
        expect(seo.description.length).toBeLessThanOrEqual(160);
        expect(seo.description.endsWith("word")).toBe(true);
    });

    it("names uploads without their file extension, and skips machine names", () => {
        const seo = spaceSeo(
            {
                id: "abc",
                info: { headline: "Museum Of Brainrot" },
                artworks: {
                    a: work({ name: "PEDRO.jpg" }),
                    b: work({ name: "IMG_1234.jpg" }),
                    c: work({ name: "rizz.png" }),
                },
            },
            { ownerName: "museumofbrainrot" }
        );
        expect(seo.description).toBe(
            "Immerse yourself in museumofbrainrot's Museum Of Brainrot. Featuring NFTs from PEDRO, rizz and many more"
        );
        expect(seo.keywords).toBe("PEDRO, rizz");
    });

    it("survives a space with no artworks field", () => {
        expect(
            spaceSeo({ id: "abc", info: { headline: "Web world" } }).title
        ).toBe("Web world");
    });
});

describe("singleDisplayQuery", () => {
    const artBlocks = { id: "x", info: { customLink: "art-blocks" } };

    it("keeps the work's id on a space that shows one work per address", () => {
        expect(singleDisplayQuery(artBlocks, { id: "172000777" })).toBe(
            "?id=172000777"
        );
        expect(
            spaceSeo(artBlocks, { query: { id: "172000777", coords: "1x2" } })
                .canonicalPath
        ).toBe("/art-blocks?id=172000777");
    });

    it("drops it everywhere else, and anything that is not an id", () => {
        expect(
            singleDisplayQuery(
                { info: { customLink: "frahm-gallery" } },
                { id: "172000777" }
            )
        ).toBe("");
        expect(singleDisplayQuery(artBlocks, {})).toBe("");
        expect(singleDisplayQuery(artBlocks, { id: "1&x=<script>" })).toBe("");
        expect(singleDisplayQuery(artBlocks, { id: ["1", "2"] })).toBe("");
    });
});

describe("review fixes", () => {
    it("keeps the collection in a LooksRare address and out of an Art Blocks one", () => {
        const query = { id: "42", contract: "0xabc" };
        expect(
            singleDisplayQuery({ info: { customLink: "art-blocks" } }, query)
        ).toBe("?id=42");
        expect(
            singleDisplayQuery({ info: { customLink: "looksrare" } }, query)
        ).toBe("?contract=0xabc&id=42");
    });

    it("does not feature wall texts or embedded pages as works", () => {
        const seo = spaceSeo({
            info: { headline: "Gallery" },
            artworks: {
                a: { data: { mime_type: "cyber/text", name: "Wall label" } },
                b: { data: { mime_type: "embed/youtube", name: "A video" } },
                c: { data: { mime_type: "image/png", name: "Real Work" } },
            },
        });
        expect(seo.featuring).toEqual(["Real Work"]);
    });

    it("keeps a long description that has no space to cut at", () => {
        const seo = spaceSeo({
            info: { headline: "Gallery", description: "x".repeat(400) },
        });
        expect(seo.description).toBe("x".repeat(160));
    });

    it("lists only whole names, and none when none fits", () => {
        const work = (name: string) => ({
            data: { mime_type: "image/png", name },
        });
        const artworks = Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [
                `w${i}`,
                work(`Artist Number ${i}`),
            ])
        );
        const fits = spaceSeo({
            info: { headline: "Gallery", description: "Short." },
            artworks,
        }).description;
        expect(fits).toMatch(/Featuring NFTs from Artist Number 0, /);
        expect(fits).toMatch(/Artist Number \d+ and many more$/);
        const none = spaceSeo({
            info: { headline: "Gallery", description: "y ".repeat(70).trim() },
            artworks,
        }).description;
        expect(none).not.toMatch(/Featuring/);
    });

    it("gives a space with a reserved link its id address", () => {
        expect(
            spaceSeo({
                id: "abc",
                info: { headline: "X", customLink: "about" },
            }).canonicalPath
        ).toBe("/spaces/abc");
    });
});
