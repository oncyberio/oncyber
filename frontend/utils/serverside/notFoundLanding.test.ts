/** @jest-environment node */
jest.mock("./landingServerSideProps", () => ({
    readLandingFeed: jest.fn(),
    landingFeedProps: jest.fn(async (filters) => ({
        initialFeed: { cards: [], cursor: "", hasMore: false },
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
import { notFoundLanding, notFoundSections } from "./notFoundLanding";

const card = (id: string, extra = {}) => ({ id, ...extra } as any);

const feeds = {
    staff: {
        cards: [card("a"), card("b"), card("p1", { section: "popular" })],
    },
    "most-visited": { cards: [card("b"), card("c"), card("d")] },
};
const read = jest.fn(async (category: string) => feeds[category]);

beforeEach(() => jest.clearAllMocks());

test("a missing link answers 404 and opens on a search for its words", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { slug: "frahm-genesis" },
        "/frahm-genesis",
        read
    );
    expect(res.statusCode).toBe(404);
    expect(props.initialFilters.q).toBe("frahm genesis");
    expect(props.notFound.query).toBe("frahm genesis");
    // The route's own parameter is not a filter, and the browser runs the
    // search, so no feed is read for it here.
    expect(landingFeedProps).toHaveBeenCalledWith(
        { q: "frahm genesis" },
        { readFeed: false }
    );
});

test("the staff picks and popular worlds follow, each tagged and deduplicated", async () => {
    const props = await notFoundLanding(
        { statusCode: 200 } as any,
        { slug: "frahm-genesis" },
        "/frahm-genesis",
        read
    );
    expect(
        props.notFound.sections.map((item) => [item.id, item.section])
    ).toEqual([
        ["a", "staff"],
        ["b", "staff"],
        ["c", "popular"],
        ["d", "popular"],
    ]);
});

test("a feed that fails leaves its section out", async () => {
    const props = await notFoundLanding(
        { statusCode: 200 } as any,
        { slug: "x" },
        "/x",
        async (category) => {
            if (category === "staff") throw new Error("down");
            return feeds[category];
        }
    );
    expect(props.notFound.sections.map((item) => item.section)).toEqual([
        "popular",
        "popular",
        "popular",
    ]);
});

test("a search already in the link wins", async () => {
    const props = await notFoundLanding(
        { statusCode: 200 } as any,
        { slug: "frahm-genesis", q: "frahm" },
        "/frahm-genesis?q=frahm",
        read
    );
    expect(props.initialFilters.q).toBe("frahm");
    expect(props.notFound.query).toBe("frahm");
});

test("a bare space id shows only the sections", async () => {
    const res = { statusCode: 200 } as any;
    const props = await notFoundLanding(
        res,
        { id: "Gxy7Y4XyIMgMeFobRM0D" },
        "/spaces/Gxy7Y4XyIMgMeFobRM0D",
        read
    );
    expect(res.statusCode).toBe(404);
    expect(props.notFound.query).toBe("");
    expect(props.notFound.sections).toHaveLength(4);
});

test("each section is capped", () => {
    const many = Array.from({ length: 30 }, (_, i) => card(`s${i}`));
    const sections = notFoundSections(
        many,
        many.map((c) => card(`p${c.id}`)),
        5
    );
    expect(sections).toHaveLength(10);
});
