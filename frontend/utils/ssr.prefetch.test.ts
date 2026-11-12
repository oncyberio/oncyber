/** @jest-environment node */
import { getExhibitByCustomLink } from "pages/api/exhibit";
import { prefetchSlugPageData } from "./ssr";

jest.mock(
    "pages/api/exhibit",
    () => ({
        getExhibitByCustomLink: jest.fn(async () => null),
        getExhibitById: jest.fn(async () => null),
        getExhibitsByIds: jest.fn(),
    }),
    { virtual: true }
);
jest.mock("utils/artworks", () => ({ processArtworks: (a) => a }), {
    virtual: true,
});
jest.mock("./emptyRoom", () => ({ EMPTY_ROOM: { slug: "empty" } }));
jest.mock("./firestore/destinations", () => ({}));
jest.mock("./firebaseAdmin", () => ({ db: {} }));
jest.mock("./firestore/userProfiles", () => ({}));
jest.mock("./saveToDb", () => ({ pathToSlug: {}, oldToNew: {}, newToOld: {} }));
jest.mock("./metadata/formatExhibit", () => ({ formatExhibit: (e) => e }));
jest.mock("./partnerships/singledisplay", () => ({
    GET_SINGLE_DISPLAY_EXPERIENCE: () => null,
}));

const mockByLink = getExhibitByCustomLink as jest.Mock;
beforeEach(() => mockByLink.mockClear());

test("starts the same world read the /[slug] page makes", async () => {
    await expect(
        prefetchSlugPageData({ params: { slug: "rift" }, query: {} })
    ).resolves.toEqual({ dest: null, experience: null });
    expect(mockByLink).toHaveBeenCalledWith("rift");
});

test("applies the page's `built` alias", async () => {
    await prefetchSlugPageData({ params: { slug: "built" }, query: {} });
    expect(mockByLink).toHaveBeenCalledWith("BUILT");
});

test("profile pages and missing slugs read nothing", () => {
    expect(
        prefetchSlugPageData({ params: { slug: "@artist" }, query: {} })
    ).toBeUndefined();
    expect(prefetchSlugPageData({ params: {}, query: {} })).toBeUndefined();
    expect(prefetchSlugPageData({})).toBeUndefined();
    expect(mockByLink).not.toHaveBeenCalled();
});
