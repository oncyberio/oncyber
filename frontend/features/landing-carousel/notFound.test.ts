import { notFoundCard, notFoundQuery, NOT_FOUND_CARD_ID } from "./notFound";

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

describe("notFoundCard", () => {
    it("names what was missing and searches for it", () => {
        const card = notFoundCard("frahm genesis");
        expect(card.id).toBe(NOT_FOUND_CARD_ID);
        expect(card.title).toBe("Could not find “Frahm Genesis”");
        expect(card.href).toBe("/?q=frahm%20genesis");
        expect(card.imageUrls).toEqual([]);
    });

    it("still explains itself without words to search for", () => {
        const card = notFoundCard("");
        expect(card.title).toBe("Could not find this world");
        expect(card.href).toBe("/");
    });
});
