import { fitPlacardRect, layoutGalleryLabel } from "./galleryLabelLayout";

const measure = (_font: string, text: string) => Array.from(text).length * 20;

test("uses compact gallery credit typography and positions the footer after the text", () => {
    const credit = {
        artist: "Lucía Muñoz",
        location: "Cuenca, Ecuador",
        title: "Ceramic Study",
        x: "luciamunoz",
        website: "lucia.example",
    };
    const out = layoutGalleryLabel(
        { artist: credit.artist, title: credit.title, credit },
        measure
    );
    expect([out.width, out.height, out.background]).toEqual([
        768,
        326,
        "#f3f1ec",
    ]);
    expect(
        out.lines.map(({ text, x, y, size, baseline }) => [
            text,
            x,
            y,
            size,
            baseline,
        ])
    ).toEqual([
        ["Lucía Muñoz", 46, 91, 58, "alphabetic"],
        ["Cuenca, Ecuador", 46, 137, 38, "alphabetic"],
        ["Ceramic Study", 46, 187, 44, "alphabetic"],
        ["@luciamunoz", 92, 244, 36, "alphabetic"],
        ["lucia.example", 92, 286, 36, "alphabetic"],
    ]);
    expect(out.lines[0].font).toMatch(/^700 58px 'Open Sans'/);
    expect(out.icons).toEqual([
        { icon: "x", x: 46, y: 216, size: 30 },
        { icon: "website", x: 46, y: 258, size: 30 },
    ]);
});

test("keeps a warm title-only card and wraps long titles", () => {
    const out = layoutGalleryLabel(
        {
            title: "A title with several words that need to wrap before finally being truncated",
            artist: "Rafaël Torres",
        },
        measure
    );
    expect([out.width, out.height, out.background]).toEqual([
        512,
        188,
        "#f3f1ec",
    ]);
    expect(out.lines).toHaveLength(3);
    expect(out.lines[1].text).toMatch(/…$/);
    expect(out.lines[2]).toMatchObject({
        text: "Rafaël Torres",
        x: 34,
        y: 130,
        size: 30,
        baseline: "top",
    });
    expect(out.icons).toHaveLength(0);
});

test("keeps both handles and the website when a long description needs clipping", () => {
    const credit = {
        artist: "Lucía Muñoz",
        location: "Cuenca, Ecuador",
        title: "A very long artwork title that wraps across the label",
        description:
            "A carefully glazed ceramic piece developed during a long study of public spaces and textures. "
                .repeat(3)
                .trim(),
        x: "luciamunoz",
        website: "lucia.example",
        instagram: "lucia.studio",
    };
    const out = layoutGalleryLabel(
        { artist: credit.artist, title: credit.title, credit },
        measure
    );
    expect(out.icons.map((icon) => icon.icon)).toEqual([
        "x",
        "instagram",
        "website",
    ]);
    expect(out.icons[0].y).toBe(out.icons[1].y);
    expect(out.icons[2].y).toBeGreaterThan(out.icons[1].y);
    const description = out.lines.filter((line) => line.size === 33);
    expect(description).toHaveLength(2);
    expect(description.at(-1)?.text).toMatch(/…$/);
    expect(description.at(-1)?.y).toBeLessThan(out.icons[0].y);
    expect(
        out.lines.every((l) => l.x + measure(l.font, l.text) <= out.width - 42)
    ).toBe(true);
    expect(out.lines.map((l) => l.text)).toEqual(
        expect.arrayContaining([
            "@luciamunoz",
            "@lucia.studio",
            "lucia.example",
        ])
    );
});

test("shows no unwanted social rows and uses up to two lines of description", () => {
    const credit = {
        artist: "Lucía Muñoz",
        title: "Ceramic Study",
        location: "",
        x: "",
        website: "",
        description:
            "A study of changing daylight in the studio and the way it reflects off glazed stoneware over time.",
    };
    const out = layoutGalleryLabel(
        { artist: credit.artist, title: credit.title, credit },
        measure
    );
    const description = out.lines.filter((l) => l.size === 33);
    expect(out.icons).toHaveLength(0);
    expect(description).toHaveLength(2);
    expect(description[1].text).toMatch(/…$/);
});

test("stacks long handles rather than clipping them in a crowded footer", () => {
    const credit = {
        artist: "Lucía Muñoz",
        location: "Cuenca, Ecuador",
        title: "An unusually long title for an artwork and a test case",
        x: "abcdefghijklmn",
        instagram: "abcdefghijklmnopqrstuvwxyz0123",
        website: "lucia.example",
        description:
            "A deliberately long description to verify that the footer still has room.",
    };
    const out = layoutGalleryLabel(
        { artist: credit.artist, title: credit.title, credit },
        measure
    );
    expect(out.icons[0].y).toBeLessThan(out.icons[1].y);
    expect(out.lines.map((l) => l.text)).toEqual(
        expect.arrayContaining(["@" + credit.x, "@" + credit.instagram])
    );
    expect(out.lines.some((l) => l.size === 33)).toBe(true);
});

test("a label with only an artist and title uses about half the old height", () => {
    const credit = {
        artist: "Lucía Muñoz",
        title: "Ceramic Study",
        location: "",
        x: "",
        website: "",
    };
    const out = layoutGalleryLabel(
        { artist: credit.artist, title: credit.title, credit },
        measure
    );
    expect(out.height).toBe(226);
    expect(out.lines.map((l) => l.text)).toEqual([credit.artist, credit.title]);
    expect(out.lines[1].font).toMatch(/^400 44px /);
    expect(out.icons).toHaveLength(0);
});

test("resizing to contents leaves the bottom aligned and the back on the wall", () => {
    const base = { x: 2, y: 1, z: -0.025 + 0.58 * 0.028, w: 1, h: 0.58 };
    for (const height of [226, 500]) {
        const rect = fitPlacardRect(base, { width: 768, height });
        expect(rect.h).toBeCloseTo(height / 768);
        expect(rect.y - rect.h / 2).toBeCloseTo(base.y - base.h / 2);
        expect(rect.z - rect.h * 0.028).toBeCloseTo(-0.025);
        expect([rect.x, rect.w]).toEqual([base.x, base.w]);
    }
});
