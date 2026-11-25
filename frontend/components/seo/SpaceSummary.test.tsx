/** @jest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import SpaceSummary from "./SpaceSummary";

const space = {
    id: "VhtHNtMx3hB3bdKBOZMI",
    owner: "0xf20d5e0f0a1b2c3d4e5f60718293a4b5c6d7573d",
    ownerName: "frahm",
    info: {
        headline: "Frahm Gallery",
        description: "Premium frames.\n\nCheck out our <b>Genesis</b> launch.",
    },
};

test("the server-rendered page names the space, its creator and what it shows", () => {
    const html = renderToStaticMarkup(
        <SpaceSummary space={space} featuring={["CloneX", "Frahm"]} />
    );
    expect(html).toContain("<h1>Frahm Gallery</h1>");
    expect(html).toContain('<a href="/@frahm" tabindex="-1">@frahm</a>');
    expect(html).toContain("<p>Premium frames.</p>");
    expect(html).toContain("<p>Check out our Genesis launch.</p>");
    expect(html).toContain("<p>Featuring CloneX, Frahm.</p>");
});

test("a space without a name or details adds nothing it does not know", () => {
    expect(
        renderToStaticMarkup(<SpaceSummary space={{ id: "a", info: {} }} />)
    ).toBe("");
    const html = renderToStaticMarkup(
        <SpaceSummary space={{ id: "a", info: { headline: "Solo" } }} />
    );
    expect(html).toContain("<h1>Solo</h1>");
    expect(html).not.toContain("Featuring");
    expect(html).not.toContain(" by ");
});

test("it carries what is inside: wall texts, works, artists, portals and visits", () => {
    const html = renderToStaticMarkup(
        <SpaceSummary
            space={space}
            gallery="Wolfgang №2"
            content={{
                texts: ["The squirrel that sparked a movement."],
                artworks: [
                    {
                        name: "Aeroglyph6529",
                        creator: "6529Collections",
                        collection: "The Memes by 6529",
                        description: "Myths of the Near Future",
                    },
                ],
                artists: ["6529Collections", "The Memes by 6529"],
                portals: ["HRkakF5x5rFEVvRqUu8S"],
                siblings: [
                    { id: "s1", name: "Frahm Flow", path: "/frahm-flow" },
                ],
                visits: 140774,
                modified: "2024-06-21",
            }}
        />
    );
    expect(html).toContain("Built in Wolfgang №2.");
    expect(html).toContain("140,774 visits.");
    expect(html).toContain('<time dateTime="2024-06-21">2024-06-21</time>');
    expect(html).toContain(
        "<p>Featuring 6529Collections, The Memes by 6529.</p>"
    );
    expect(html).toContain("<p>The squirrel that sparked a movement.</p>");
    expect(html).toContain(
        "<li>Aeroglyph6529 by 6529Collections (The Memes by 6529): Myths of the Near Future</li>"
    );
    expect(html).toContain(
        '<a href="/spaces/HRkakF5x5rFEVvRqUu8S" tabindex="-1">'
    );
    expect(html).toContain("<h2>More spaces by @frahm</h2>");
    expect(html).toContain(
        '<a href="/frahm-flow" tabindex="-1">Frahm Flow</a>'
    );
});

test("a space that was never named is headed by its creator's name", () => {
    const html = renderToStaticMarkup(
        <SpaceSummary
            space={{ id: "a", ownerName: "cosmicmeta", info: {} }}
            featuring={["Ruu"]}
        />
    );
    expect(html).toContain("<h1>@cosmicmeta&#x27;s space</h1>");
    // With nobody to name it after, there is nothing to say.
    expect(
        renderToStaticMarkup(<SpaceSummary space={{ id: "a", info: {} }} />)
    ).toBe("");
});
