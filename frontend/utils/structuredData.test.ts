/** @jest-environment node */
import {
    docStructuredData,
    featuredSpacesStructuredData,
    featuredNames,
    jsonLdScript,
    plainText,
    siteStructuredData,
    spaceCreator,
    spaceName,
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

describe("docStructuredData", () => {
    it("places a docs page under Docs", () => {
        const data: any = docStructuredData({
            slug: "avatars",
            title: "Avatars",
            description: "Everyone has a 3D avatar.",
        });
        const article = graph(data, "TechArticle");
        expect(article.url).toBe(searchUrl("/docs/avatars"));
        // An article has no `breadcrumb` property: the trail is its own node.
        expect(article.breadcrumb).toBeUndefined();
        expect(
            graph(data, "BreadcrumbList").itemListElement.map(
                (item) => item.name
            )
        ).toEqual(["oncyber", "Docs", "Avatars"]);
        expect(
            graph(
                docStructuredData({ slug: "", title: "Oncyber docs" }),
                "BreadcrumbList"
            ).itemListElement
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

describe("featuredSpacesStructuredData", () => {
    it("lists the spaces the home page features, in order", () => {
        const data: any = featuredSpacesStructuredData([
            {
                title: "6529 Museum District",
                href: "/6529om",
                imageUrls: ["https://example.com/a.png"],
            },
            { title: "Starry Night", href: "/spaces/abc" },
            { title: "", href: "/nameless" },
            { title: "Elsewhere", href: "https://elsewhere.example/" },
        ]);
        expect(data["@type"]).toBe("ItemList");
        expect(data.itemListElement).toEqual([
            {
                "@type": "ListItem",
                position: 1,
                name: "6529 Museum District",
                url: searchUrl("/6529om"),
                image: "https://example.com/a.png",
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Starry Night",
                url: searchUrl("/spaces/abc"),
            },
        ]);
        expect(featuredSpacesStructuredData([])).toBeNull();
        expect(featuredSpacesStructuredData(undefined)).toBeNull();
    });
});

describe("a docs page written as questions", () => {
    it("is a FAQ page with each question and answer", () => {
        const data: any = docStructuredData({
            slug: "what-is-oncyber",
            title: "What is Oncyber?",
            faq: [{ question: "Is it free?", answer: "Yes." }],
        });
        const page = graph(data, "FAQPage");
        expect(page.mainEntity).toEqual([
            {
                "@type": "Question",
                name: "Is it free?",
                acceptedAnswer: { "@type": "Answer", text: "Yes." },
            },
        ]);
    });
});

describe("an unnamed space", () => {
    it("is called after its creator, in the heading and the structured data", () => {
        const space = {
            id: "abc",
            owner: "0x2b4f00000000000000000000000000000000beef",
            info: {},
        };
        expect(spaceName(space)).toBe("0x2b4f…beef's space");
        expect(spaceName({ ...space, ownerName: "cosmicmeta" })).toBe(
            "@cosmicmeta's space"
        );
        expect(spaceName({ id: "abc", info: { headline: " Frahm " } })).toBe(
            "Frahm"
        );
        expect(spaceName({ id: "abc", info: {} })).toBe("");
        const data: any = spaceStructuredData({
            ...space,
            ownerName: "cosmicmeta",
        });
        expect(JSON.stringify(data)).toContain("@cosmicmeta's space");
        expect(spaceStructuredData({ id: "abc", info: {} })).toBeNull();
    });
});
