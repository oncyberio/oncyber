/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import SpaceSeo from "./SpaceSeo";
import { searchUrl } from "@utils/siteUrl";

let mockQuery: Record<string, string> = {};
jest.mock("next/router", () => ({
    useRouter: () => ({ query: mockQuery }),
}));
// Render head tags inline so the test can read them.
jest.mock("next/head", () => ({
    __esModule: true,
    default: ({ children }) => <>{children}</>,
}));

const attr = (html: string, pattern: RegExp) => (html.match(pattern) || [])[1];

const gallery = {
    id: "VhtHNtMx3hB3bdKBOZMI",
    owner: "0xf20d5e0f0a1b2c3d4e5f60718293a4b5c6d7573d",
    ownerName: "frahm",
    number_of_visits: 1200,
    info: {
        headline: "Frahm Gallery",
        customLink: "frahm-gallery",
        description: "Premium frames.",
        heroImg: "https://example.com/hero.png",
    },
    artworks: {
        a: {
            data: {
                mime_type: "image/png",
                name: "Frame 1",
                creator: { user: { username: "kunstkennerey" } },
            },
        },
        b: {
            data: { mime_type: "cyber/text", text: "Welcome to the gallery" },
        },
    },
};

beforeEach(() => {
    mockQuery = {};
});

test("a space names itself, its address, its image and what it holds", () => {
    const html = renderToStaticMarkup(<SpaceSeo experience={gallery} />);
    expect(attr(html, /<title>([^<]*)<\/title>/)).toBe("Frahm Gallery");
    expect(attr(html, /rel="canonical" href="([^"]*)"/)).toBe(
        searchUrl("/frahm-gallery")
    );
    expect(attr(html, /property="og:image" content="([^"]*)"/)).toBe(
        "https://example.com/hero.png"
    );
    expect(attr(html, /property="og:image:alt" content="([^"]*)"/)).toBe(
        "Frahm Gallery"
    );
    const data = JSON.parse(
        attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    );
    const work = data["@graph"].find(
        (node) => node["@type"] === "CreativeWork"
    );
    expect(work.hasPart[0]).toMatchObject({
        "@type": "VisualArtwork",
        name: "Frame 1",
        creator: { name: "kunstkennerey" },
    });
    expect(work.interactionStatistic.userInteractionCount).toBe(1200);
    expect(work.text).toBe("Welcome to the gallery");
    expect(html).toContain("<h1>Frahm Gallery</h1>");
    expect(html).toContain("<p>Welcome to the gallery</p>");
    expect(html).toContain("<li>Frame 1 by kunstkennerey</li>");
});

test("an embedded world, with no artworks at all, gets the same treatment", () => {
    const html = renderToStaticMarkup(
        <SpaceSeo
            experience={{
                id: "web1",
                owner: "0xabc",
                runtime: { kind: "web", url: "https://example.com" },
                info: {
                    headline: "Web world",
                    description: "A world on the web.",
                },
            }}
            ownerName="maker"
        />
    );
    expect(attr(html, /<title>([^<]*)<\/title>/)).toBe("Web world");
    expect(attr(html, /name="description" content="([^"]*)"/)).toBe(
        "A world on the web."
    );
    expect(attr(html, /rel="canonical" href="([^"]*)"/)).toBe(
        searchUrl("/spaces/web1")
    );
    expect(html).toContain('<a href="/@maker" tabindex="-1">@maker</a>');
});

test("a page that shows one work by its id keeps the id in its address", () => {
    mockQuery = { slug: "art-blocks", id: "172000777", coords: "1x2x3" };
    const html = renderToStaticMarkup(
        <SpaceSeo
            experience={{
                id: "ab",
                info: {
                    headline: "Rituals - Venice #777",
                    customLink: "art-blocks",
                },
            }}
        />
    );
    expect(attr(html, /rel="canonical" href="([^"]*)"/)).toBe(
        searchUrl("/art-blocks?id=172000777")
    );
    expect(attr(html, /property="og:url" content="([^"]*)"/)).toBe(
        searchUrl("/art-blocks?id=172000777")
    );
});

test("a visitor the gate turns away is told the space's name, not what is inside", () => {
    const template = { name: "Cyber Warehouse" };
    const html = renderToStaticMarkup(
        <SpaceSeo
            experience={gallery}
            destination={template}
            ownerName="frahm"
            gated
        />
    );
    // Nor the template it is built in.
    expect(html).not.toContain("Cyber Warehouse");
    expect(
        renderToStaticMarkup(
            <SpaceSeo
                experience={gallery}
                destination={template}
                ownerName="frahm"
            />
        )
    ).toContain("Cyber Warehouse");
    expect(html).toContain("<title>Frahm Gallery</title>");
    expect(html).toContain("Premium frames.");
    // Neither the works nor the words on the walls.
    expect(html).not.toContain("Frame 1");
    expect(html).not.toContain("kunstkennerey");
    expect(html).not.toContain("Welcome to the gallery");
    // Nor how much it is visited.
    expect(html).not.toContain("interactionStatistic");
    expect(html).not.toContain("1200");
    // The same space, admitted, says all of it.
    const open = renderToStaticMarkup(
        <SpaceSeo experience={gallery} ownerName="frahm" />
    );
    expect(open).toContain("Frame 1");
    expect(open).toContain("Welcome to the gallery");
});
