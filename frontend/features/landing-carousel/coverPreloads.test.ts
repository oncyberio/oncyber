import { firstScreenCovers, MOBILE_GRID_QUERY } from "./coverPreloads";
import { fallbackCover } from "./coverSources";

jest.mock("@utils/destinationPreviews", () => ({
    ...jest.requireActual("@utils/destinationPreviews"),
    previewForRoom: jest.fn(
        jest.requireActual("@utils/destinationPreviews").previewForRoom
    ),
}));

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

test("names none when a search or filter will replace the server's cards", () => {
    const cards = ["a", "b"].map((id) => card(id));
    expect(firstScreenCovers(cards, { q: "frahm" })).toEqual([]);
    expect(firstScreenCovers(cards, { chain: "tezos" })).toEqual([]);
    expect(firstScreenCovers(cards, { owner: "0xabc" })).toEqual([]);
    expect(firstScreenCovers(cards, { collection: "punks" })).toEqual([]);
    // A category alone is the feed the server sent.
    expect(
        firstScreenCovers(cards, { q: "", category: "latest", chain: "" })
    ).toHaveLength(2);
});

test("a world with only its room's stock picture gets the room's shipped cover, or none", () => {
    const stock = ["https://oncyber.io/models/room/cover.jpg"];
    const previews = jest.requireMock("@utils/destinationPreviews");
    previews.previewForRoom.mockImplementation((_catalog, room) =>
        room === "shipped" ? ["/destinations/shipped.webp"] : []
    );
    expect(
        firstScreenCovers([
            { ...card("a", stock), room: "shipped" },
            // Its cover comes from a catalog the browser fetches later.
            { ...card("b", stock), room: "catalog-only" },
            // A build card keeps its own picture.
            { ...card("c", stock), room: "shipped", buildStatus: "Soon" },
            // An uploaded cover always wins.
            { ...card("d"), room: "shipped" },
        ])
    ).toEqual([
        { href: "/destinations/shipped.webp" },
        { href: stock[0], media: "(min-width: 701px)" },
        { href: "https://img.test/d", media: "(min-width: 701px)" },
    ]);
});
