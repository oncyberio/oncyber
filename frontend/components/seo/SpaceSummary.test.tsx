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
