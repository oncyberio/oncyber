/** @jest-environment node */
jest.mock("./landingServerSideProps", () => ({
    landingFeedProps: jest.fn(async (filters) => ({
        initialFeed: { cards: [{ id: "staff-1" }], cursor: "", hasMore: false },
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

test("a link that found nothing answers 404 with the landing to explore", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { slug: "frahm-genesis" },
        "/frahm-genesis"
    );
    expect(res.statusCode).toBe(404);
    expect(props.notFound).toEqual({ query: "frahm genesis" });
    expect(props.initialFeed.cards).toHaveLength(1);
    // The route's own parameter is not a discovery filter.
    expect(landingFeedProps).toHaveBeenCalledWith({});
});

test("a bare space id leaves the search empty", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { id: "Gxy7Y4XyIMgMeFobRM0D" },
        "/spaces/Gxy7Y4XyIMgMeFobRM0D"
    );
    expect(res.statusCode).toBe(404);
    expect(props.notFound).toEqual({ query: "" });
});
