import { firstScreenCovers, MOBILE_GRID_QUERY } from "./coverPreloads";
import { fallbackCover } from "./coverSources";

const card = (
    id: string,
    imageUrls: string[] = [`https://img.test/${id}`]
) => ({
    id,
    imageUrls,
});

test("names the first two covers for every screen and the next two for wide ones", () => {
    const cards = ["a", "b", "c", "d", "e", "f"].map((id) => card(id));
    expect(firstScreenCovers(cards)).toEqual([
        { href: "https://img.test/a" },
        { href: "https://img.test/b" },
        { href: "https://img.test/c", media: "(min-width: 701px)" },
        { href: "https://img.test/d", media: "(min-width: 701px)" },
    ]);
    // The wide query starts where the grid's own phone query stops.
    expect(MOBILE_GRID_QUERY).toBe("(max-width: 700px)");
});

test("uses the cover the grid will ask for first", () => {
    expect(
        firstScreenCovers([
            card("a", ["https://img.test/first", "https://img.test/second"]),
            card("no-cover", []),
        ])
    ).toEqual([
        { href: "https://img.test/first" },
        { href: fallbackCover("no-cover") },
    ]);
});

test("leaves out collages and repeated covers, and survives no feed", () => {
    expect(
        firstScreenCovers([
            {
                ...card("a"),
                collage: ["https://img.test/1", "https://img.test/2"],
            },
            card("b", ["https://img.test/same"]),
            card("c", ["https://img.test/same"]),
        ])
    ).toEqual([{ href: "https://img.test/same" }]);
    expect(firstScreenCovers(undefined)).toEqual([]);
});
