jest.mock("@utils/js", () => ({
    ...jest.requireActual("@utils/js"),
    getJSON: jest.fn(async () => ({ success: true, exhibits: [] })),
}));
jest.mock("@utils/saveToDb", () => ({
    getExhibitByCustomLink: jest.fn(async (slug: string) => ({
        success: true,
        exhibit: { id: slug, info: { headline: "Space" } },
    })),
    getPublicUserExhibits: jest.fn(),
}));

import { getJSON } from "@utils/js";
import { getExhibitByCustomLink } from "@utils/saveToDb";
import { searchExhibits } from "./utils";

beforeEach(() => jest.clearAllMocks());

describe("searchExhibits", () => {
    it.each([
        "https://www.oncyber.com/starrynight",
        "https://oncyber.com/starrynight",
        "oncyber.com/starrynight",
        "https://oncyber.io/starrynight",
        "https://www.oncyber.io/starrynight",
    ])("opens a pasted space link: %s", async (link) => {
        await searchExhibits(link);
        expect(getExhibitByCustomLink).toHaveBeenCalledWith("starrynight");
        expect(getJSON).not.toHaveBeenCalled();
    });

    it("reads /spaces/<id> links by id", async () => {
        await searchExhibits("https://www.oncyber.com/spaces/abc123");
        expect(getExhibitByCustomLink).toHaveBeenCalledWith("s@abc123");
    });

    it("searches by text for anything else", async () => {
        await searchExhibits("https://example.com/starrynight");
        expect(getExhibitByCustomLink).not.toHaveBeenCalled();
        expect(getJSON).toHaveBeenCalled();
    });
});
