import { notFoundQuery, searchWordSuggestions } from "./notFound";

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
