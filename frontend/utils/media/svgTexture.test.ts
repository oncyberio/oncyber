/** @jest-environment jsdom */
import { normalizeSvgTextureSource, prepareSvgTextureBlob } from "./svgTexture";

function svg(attributes: string, children = "") {
    return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${children}</svg>`;
}

function root(source: string) {
    return new DOMParser().parseFromString(source, "image/svg+xml")
        .documentElement;
}

test.each([
    ["0 0 24 24", "512", "512"],
    ["-12 -6 24 12", "512", "256"],
    ["0,0,12,24", "256", "512"],
    ["0 0 .5 .25", "512", "256"],
    ["0 0 1e6 2e6", "256", "512"],
])(
    "viewBox %s produces a bounded, aspect-correct texture",
    (viewBox, width, height) => {
        const result = root(
            normalizeSvgTextureSource(svg(`viewBox="${viewBox}"`))
        );
        expect(result.getAttribute("width")).toBe(width);
        expect(result.getAttribute("height")).toBe(height);
        expect(result.getAttribute("viewBox")).toBe(viewBox);
    }
);

test("normalization preserves the animated artwork and negative viewBox origin", () => {
    const children =
        '<defs><path id="pixel" d="M0 0h1v1z"/></defs>' +
        '<use href="#pixel"><animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite"/>' +
        '<animateTransform attributeName="transform" type="translate" values="0 0;1 0" dur="1s"/></use>';
    const input = svg(
        'viewBox="-12 -12 24 24" preserveAspectRatio="xMinYMin meet"',
        children
    );
    const result = root(normalizeSvgTextureSource(input));
    expect(result.innerHTML).toBe(root(input).innerHTML);
    expect(result.getAttribute("preserveAspectRatio")).toBe("xMinYMin meet");
});

test.each([
    'width="640" height="320"',
    'width="12.5px" height="6.25px"',
    'width="2in" height="1in"',
])("valid authored dimensions remain untouched: %s", (dimensions) => {
    const input = svg(`${dimensions} viewBox="0 0 24 24"`);
    expect(normalizeSvgTextureSource(input)).toBe(input);
});

test.each([
    "width: 400px",
    "height: 200px",
    "fill: red; WIDTH: 400px !important",
    "width/**/: 400px",
    "width: var(--art-width)",
    "w\\69 dth: 400px",
])("root CSS dimensions remain untouched: %s", (style) => {
    const input = svg(`viewBox="0 0 200 100" style="${style}"`);
    expect(normalizeSvgTextureSource(input)).toBe(input);
});

test.each([
    "<style>svg { width: 400px }</style>",
    "<defs><style>.art { height: 200px }</style></defs>",
    "<style>path { fill: red }</style>",
])("embedded stylesheets keep their existing decode path", (stylesheet) => {
    const input = svg('class="art" viewBox="0 0 200 100"', stylesheet);
    expect(normalizeSvgTextureSource(input)).toBe(input);
});

test("root color-only CSS does not prevent normalization", () => {
    const input = svg(
        'viewBox="0 0 200 100" style="color: red; fill: currentColor"'
    );
    const result = root(normalizeSvgTextureSource(input));
    expect(result.getAttribute("width")).toBe("512");
    expect(result.getAttribute("height")).toBe("256");
    expect(result.getAttribute("style")).toBe("color: red; fill: currentColor");
});

test.each([
    ['width="300"', "300", "150"],
    ['height="100"', "200", "100"],
    ['width="2in"', "2in", "96"],
    ['width="100%" height="100%"', "512", "256"],
])(
    "missing intrinsic dimensions derive from the authored size or viewBox: %s",
    (dimensions, width, height) => {
        const result = root(
            normalizeSvgTextureSource(svg(`${dimensions} viewBox="0 0 24 12"`))
        );
        expect(result.getAttribute("width")).toBe(width);
        expect(result.getAttribute("height")).toBe(height);
    }
);

test.each([
    "",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">',
    svg('viewBox="0 0 -24 24"'),
    svg('viewBox="0 0 24 0"'),
    svg('viewBox="0 0 Infinity 24"'),
    svg('viewBox="0 0 24 24 0"'),
    svg('viewBox="0 0 24"'),
    svg('viewBox="0 0 1 1" width="1e30"'),
    svg('width="100"'),
    '<html viewBox="0 0 24 24"></html>',
])(
    "malformed or unsupported sizes keep their existing decode path",
    (input) => {
        expect(normalizeSvgTextureSource(input)).toBe(input);
    }
);

test("the blob helper reuses already-sized input and preserves the SVG content type", async () => {
    const sized = { text: async () => svg('width="512" height="512"') };
    expect(await prepareSvgTextureBlob(sized as Blob)).toBe(sized);
    const unsized = {
        text: async () => svg('viewBox="0 0 24 24"'),
        type: "image/svg+xml",
    };
    const result = await prepareSvgTextureBlob(unsized as Blob);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe("image/svg+xml");
    expect(result.size).toBeGreaterThan(unsized.type.length);
});
