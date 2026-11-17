import { closeMatches, notFoundQuery, searchWordSuggestions } from "./notFound";

describe("notFoundQuery", () => {
    it.each([
        ["/frahm-genesis", "frahm genesis"],
        ["/frahm-genesis/", "frahm genesis"],
        ["/@some_artist", "some artist"],
        ["/thulio.art", "thulio art"],
        ["/caf%C3%A9-night?coords=1x2x3x4", "café night"],
        ["/spaces/Gxy7Y4XyIMgMeFobRM0D", ""],
        ["/spaces/sVT8pSMUuE3NZTRvbTzC%0A", ""],
        ["/spaces/my-old-gallery", "my old gallery"],
        ["/%E0%A4%A", "E0A4A"],
        ["", ""],
    ])("%s → %j", (path, words) => {
        expect(notFoundQuery(path)).toBe(words);
    });

    it("keeps the search short", () => {
        expect(notFoundQuery("/" + "a-".repeat(80)).length).toBeLessThanOrEqual(
            60
        );
    });
});

describe("searchWordSuggestions", () => {
    it("offers each distinctive word of a failed search", () => {
        expect(searchWordSuggestions("frahm genesis")).toEqual([
            "frahm",
            "genesis",
        ]);
        expect(searchWordSuggestions("The Frahm  the genesis")).toEqual([
            "the",
            "frahm",
            "genesis",
        ]);
    });

    it("skips short words and numbers, and keeps it to three", () => {
        expect(searchWordSuggestions("a 6529 museum of memes")).toEqual([
            "museum",
            "memes",
        ]);
        expect(searchWordSuggestions("one two three four")).toHaveLength(3);
    });

    it("offers nothing for a single word", () => {
        expect(searchWordSuggestions("frahm")).toEqual([]);
        expect(searchWordSuggestions("")).toEqual([]);
    });
});

describe("closeMatches", () => {
    const cards = (...ids: string[]) => ids.map((id) => ({ id }));

    it("puts the rarest word's matches first, without repeats", () => {
        expect(
            closeMatches([cards("g1", "g2", "f2", "g3"), cards("f1", "f2")])
        ).toEqual(cards("f1", "f2", "g1", "g2", "g3"));
    });

    it("keeps a few per word and a few in all", () => {
        const many = (prefix: string) =>
            cards(...Array.from({ length: 20 }, (_, i) => `${prefix}${i}`));
        expect(
            closeMatches([many("a"), many("b")], { perWord: 3, max: 5 })
        ).toEqual(cards("a0", "a1", "a2", "b0", "b1"));
    });

    it("finds nothing when no word does", () => {
        expect(closeMatches([[], []])).toEqual([]);
    });
});
