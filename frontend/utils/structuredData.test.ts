/** @jest-environment node */
import {
    docStructuredData,
    featuredNames,
    jsonLdScript,
    plainText,
    profileStructuredData,
    siteStructuredData,
    spaceCreator,
    spaceStructuredData,
} from "./structuredData";
import { searchUrl } from "./siteUrl";

const graph = (data: any, type: string) =>
    data["@graph"].find((node) => node["@type"] === type);

describe("plainText", () => {
    it("makes one line without markup", () => {
        expect(
            plainText("Frahm <b>Flow</b>\n\nthe first\tanimated frame")
        ).toBe("Frahm Flow the first animated frame");
        expect(plainText(null)).toBe("");
    });

    it("cuts at a word and says so", () => {
        expect(plainText("one two three four", 12)).toBe("one two…");
        expect(plainText("short", 12)).toBe("short");
    });
});

describe("siteStructuredData", () => {
    it("names the site and the organisation on the search origin", () => {
        const data = siteStructuredData("About the site.");
        expect(graph(data, "Organization")).toMatchObject({
            name: "oncyber",
            url: searchUrl("/"),
        });
        const site = graph(data, "WebSite");
        expect(site.url).toBe(searchUrl("/"));
        expect(site.potentialAction.target.urlTemplate).toBe(
            searchUrl("/?q={search_term_string}")
        );
    });
});

describe("spaceStructuredData", () => {
    const space = {
        id: "VhtHNtMx3hB3bdKBOZMI",
        owner: "0xf20d5e0f0a1b2c3d4e5f60718293a4b5c6d7573d",
        ownerName: "frahm",
        info: {
            headline: "Frahm Gallery",
            description: "Premium frames.\n\nCheck out our Genesis launch.",
            customLink: "frahm-gallery",
        },
    };

    it("describes the page, the work, its creator and its place in the site", () => {
        const data = spaceStructuredData(space, {
            image: "https://example.com/hero.png",
            featuring: ["Frahm", "CloneX"],
        });
        const page = graph(data, "WebPage");
        expect(page.url).toBe(searchUrl("/frahm-gallery"));
        expect(page.description).toBe(
            "Premium frames. Check out our Genesis launch."
        );
        expect(
            page.breadcrumb.itemListElement.map((item) => item.name)
        ).toEqual(["oncyber", "@frahm", "Frahm Gallery"]);
        const work = graph(data, "CreativeWork");
        expect(work.creator).toEqual({
            "@type": "Person",
            name: "@frahm",
            url: searchUrl("/@frahm"),
        });
        expect(work.image).toBe("https://example.com/hero.png");
        expect(work.keywords).toBe("Frahm, CloneX");
        expect(page.mainEntity["@id"]).toBe(work["@id"]);
    });

    it("uses the space id without a custom link, and a short wallet for the creator", () => {
        const data = spaceStructuredData({
            ...space,
            ownerName: null,
            info: { headline: "Untitled show" },
        });
        expect(graph(data, "WebPage").url).toBe(
            searchUrl("/spaces/VhtHNtMx3hB3bdKBOZMI")
        );
        expect(graph(data, "CreativeWork").creator.name).toBe("0xf20d…573d");
    });

    it("leaves out what is missing, and a space without a name altogether", () => {
        const work = graph(
            spaceStructuredData(
                { id: "a", info: { headline: "Solo" } },
                {
                    image: "/relative.png",
                }
            ),
            "CreativeWork"
        );
        expect(work).not.toHaveProperty("image");
        expect(work).not.toHaveProperty("creator");
        expect(work).not.toHaveProperty("keywords");
        expect(work).not.toHaveProperty("description");
        expect(spaceStructuredData({ id: "a", info: {} })).toBeNull();
        expect(spaceStructuredData(null)).toBeNull();
    });
});

describe("spaceCreator", () => {
    it("prefers the name, then the wallet, then nobody", () => {
        expect(spaceCreator({ ownerName: "6529", owner: "0xabc" })).toEqual({
            name: "@6529",
            path: "/@6529",
        });
        expect(spaceCreator({ owner: "tz1short" })).toEqual({
            name: "tz1short",
            path: "/@tz1short",
        });
        expect(spaceCreator({})).toBeNull();
    });
});

describe("profileStructuredData", () => {
    it("describes a named profile", () => {
        const data: any = profileStructuredData(
            {
                id: "0xabc0000000000000000000000000000000000def",
                username: "6529",
            },
            "3D spaces and NFTs by @6529 on oncyber."
        );
        expect(data["@type"]).toBe("ProfilePage");
        expect(data.url).toBe(searchUrl("/@6529"));
        expect(data.mainEntity).toMatchObject({
            "@type": "Person",
            name: "@6529",
            alternateName: "6529",
        });
        expect(data.mainEntity).not.toHaveProperty("image");
    });

    it("falls back to the wallet, and to nothing without a profile", () => {
        const data: any = profileStructuredData({
            id: "0xabc0000000000000000000000000000000000def",
            avatar: "https://example.com/a.png",
        });
        expect(data.mainEntity.name).toBe("0xabc0…0def");
        expect(data.mainEntity.image).toBe("https://example.com/a.png");
        expect(profileStructuredData(null)).toBeNull();
    });
});

describe("docStructuredData", () => {
    it("places a docs page under Docs", () => {
        const data: any = docStructuredData({
            slug: "avatars",
            title: "Avatars",
            description: "Everyone has a 3D avatar.",
        });
        expect(data.url).toBe(searchUrl("/docs/avatars"));
        expect(
            data.breadcrumb.itemListElement.map((item) => item.name)
        ).toEqual(["oncyber", "Docs", "Avatars"]);
        expect(
            (docStructuredData({ slug: "", title: "Oncyber docs" }) as any)
                .breadcrumb.itemListElement
        ).toHaveLength(2);
    });
});

describe("jsonLdScript", () => {
    it("cannot close its script tag", () => {
        const script = jsonLdScript({ name: "</script><script>alert(1)" });
        expect(script).not.toContain("<");
        expect(JSON.parse(script).name).toBe("</script><script>alert(1)");
    });
});

describe("featuredNames", () => {
    it("keeps artists and collections, not upload file names or repeats", () => {
        expect(
            featuredNames([
                "Art Blocks",
                "sares-8-perish.glb",
                "punk.jpg",
                "Post Ad 1 Short 2.mp4",
                "art blocks",
                "",
                null,
                "gen_dot_art",
                "Frahm v2.0 Genesis",
            ])
        ).toEqual(["Art Blocks", "gen_dot_art", "Frahm v2.0 Genesis"]);
    });
});
