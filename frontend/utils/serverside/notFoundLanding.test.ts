/** @jest-environment node */
jest.mock("./landingServerSideProps", () => ({
    landingFeedProps: jest.fn(async (filters, { readFeed = true } = {}) => ({
        initialFeed: {
            cards: readFeed ? [{ id: "staff-1" }] : [],
            cursor: "",
            hasMore: false,
        },
        initialFilters: {
            q: "",
            category: "staff",
            chain: "",
            owner: "",
            collection: "",
            ...filters,
        },
        defaultCategory: "staff",
        initialError: false,
    })),
}));

import { landingFeedProps } from "./landingServerSideProps";
import { notFoundLanding } from "./notFoundLanding";

beforeEach(() => jest.clearAllMocks());

test("a missing link answers 404 and opens on a search for its words", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { slug: "frahm-genesis" },
        "/frahm-genesis"
    );
    expect(res.statusCode).toBe(404);
    expect(props.initialFilters.q).toBe("frahm genesis");
    expect(props.notFound).toEqual({ query: "frahm genesis" });
    // The route's own parameter is not a filter, and the browser runs the
    // search, so no feed is read here.
    expect(landingFeedProps).toHaveBeenCalledWith(
        { q: "frahm genesis" },
        { readFeed: false }
    );
});

test("a search already in the link wins", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { slug: "frahm-genesis", q: "frahm" },
        "/frahm-genesis?q=frahm"
    );
    expect(props.initialFilters.q).toBe("frahm");
});

test("a bare space id opens the landing's worlds", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { id: "Gxy7Y4XyIMgMeFobRM0D" },
        "/spaces/Gxy7Y4XyIMgMeFobRM0D"
    );
    expect(res.statusCode).toBe(404);
    expect(props.initialFilters.q).toBe("");
    expect(props.initialFeed.cards).toHaveLength(1);
    expect(landingFeedProps).toHaveBeenCalledWith({}, { readFeed: true });
});
