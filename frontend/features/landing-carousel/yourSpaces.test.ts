import {
    countSpaces,
    createSpaceCards,
    parseSpaceFilter,
    RESET_SPACES_ID,
    type SpaceFilter,
    isDeployed,
    SHOW_ALL_SPACES_ID,
    SPACES_SHOWN,
    withSpaces,
} from "./yourSpaces";

jest.mock("@utils/destinationCover", () => ({
    exhibitCover: (info?: { heroImg?: string }) =>
        info?.heroImg || "/images/sq_image_placeholder.png",
}));
jest.mock("@utils/urlUtils", () => ({ resize: (url: string) => url }));

const space = (id: string, extra: any = {}) =>
    ({
        id,
        createdAt: `2026-01-${String(10 + Number(id.slice(1))).padStart(
            2,
            "0"
        )}T00:00:00Z`,
        ...extra,
        info: { room: "loft", headline: `Space ${id}`, ...extra.info },
    } as any);

const spaces = Array.from({ length: 12 }, (_, index) => space(`s${index}`));

describe("Create's own spaces", () => {
    it("stops at nine, newest first, and ends with a card for the rest", () => {
        const cards = createSpaceCards(spaces, "", false);
        expect(cards).toHaveLength(SPACES_SHOWN + 1);
        expect(cards[0].spaceId).toBe("s11");
        const last = cards[cards.length - 1];
        expect(last.id).toBe(SHOW_ALL_SPACES_ID);
        expect(last.title).toBe("+3 more");
        expect(last.buildStatus).toBe("Show all 12 spaces");
        expect(cards.every((card) => card.section === "spaces")).toBe(true);
    });

    it("shows the rest as a collage of real covers, hidden spaces first", () => {
        const withCovers = spaces.map((item, index) =>
            index === 0 || index === 11
                ? { ...item, info: { ...item.info, heroImg: `/c${index}.jpg` } }
                : item
        );
        const cards = createSpaceCards(withCovers, "", false);
        // s0 is hidden behind the card, s11 is the newest one shown.
        expect(cards[cards.length - 1].collage).toEqual([
            "/c0.jpg",
            "/c11.jpg",
        ]);
    });

    it("shows ten spaces whole, since they fill the same cells", () => {
        const cards = createSpaceCards(spaces.slice(0, 10), "", false);
        expect(cards).toHaveLength(10);
        expect(cards.every((card) => card.spaceId)).toBe(true);
    });

    it("filters by views, deployed, drafts and shared", () => {
        const mixed = [
            space("s1", { visits: 5, info: { heroImg: "a" } }),
            space("s2", { visits: 90 }),
            space("s3", { visits: 40, invited: true, info: { heroImg: "a" } }),
        ];
        const ids = (filter: SpaceFilter) =>
            createSpaceCards(mixed, "", false, undefined, filter).map(
                (card) => card.spaceId
            );
        expect(ids("viewed")).toEqual(["s2", "s3", "s1"]);
        expect(ids("deployed")).toEqual(["s1"]);
        expect(ids("drafts")).toEqual(["s2"]);
        expect(ids("shared")).toEqual(["s3"]);
        expect(
            createSpaceCards(mixed, "", false, undefined, "viewed")[0]
                .buildStatus
        ).toBe("90 visits");
        expect(countSpaces(mixed, "", "deployed")).toBe(1);
        expect(parseSpaceFilter("nope")).toBe("latest");
    });

    it("keeps the section when a filter matches nothing", () => {
        const cards = createSpaceCards(spaces, "", false, undefined, "shared");
        expect(cards).toHaveLength(1);
        expect(cards[0].id).toBe(RESET_SPACES_ID);
        expect(cards[0].title).toBe("No shared spaces yet");
        // The link for a new tab keeps the filter it expands.
        const viewed = createSpaceCards(spaces, "", false, undefined, "viewed");
        expect(viewed[viewed.length - 1].href).toBe(
            "/?create=gallery&spaces=all&spacesFilter=viewed"
        );
        expect(cards[0].section).toBe("spaces");
    });

    it("shows every space once expanded", () => {
        const cards = createSpaceCards(spaces, "", true);
        expect(cards).toHaveLength(12);
        expect(cards.some((card) => card.id === SHOW_ALL_SPACES_ID)).toBe(
            false
        );
    });

    it("searches every space, deployed or not, without the cap", () => {
        const mixed = [
            space("s1", { info: { headline: "Photo club", heroImg: "a" } }),
            space("s2", { info: { headline: "Photo draft" } }),
            space("s3", { info: {}, invited: true }),
        ];
        expect(isDeployed(mixed[0])).toBe(true);
        expect(isDeployed(mixed[1])).toBe(false);
        expect(
            createSpaceCards(mixed, "photo", false).map((c) => c.spaceId)
        ).toEqual(["s2", "s1"]);
        expect(
            createSpaceCards(mixed, "draft", false).map((c) => c.spaceId)
        ).toEqual(["s3", "s2"]);
        expect(
            createSpaceCards(mixed, "shared", false).map((c) => c.spaceId)
        ).toEqual(["s3"]);
        const many = createSpaceCards(spaces, "space", false);
        expect(many).toHaveLength(12);
    });

    it("labels status and lists unnamed spaces after named ones", () => {
        const cards = createSpaceCards(
            [
                space("s9", { info: { headline: "" } }),
                space("s1", { info: { heroImg: "a" } }),
                space("s2", { invited: true }),
            ],
            "",
            false
        );
        expect(cards.map((card) => card.spaceId)).toEqual(["s2", "s1", "s9"]);
        expect(cards.map((card) => card.destinationStatus)).toEqual([
            "Shared with you",
            "Deployed",
            "Draft",
        ]);
        expect(cards[2].title).toBe("Untitled");
    });

    it("tags templates only when spaces lead the grid", () => {
        const template = { id: "template-x" } as any;
        expect(withSpaces([], [template])).toEqual([template]);
        const cards = createSpaceCards(spaces.slice(0, 1), "", false);
        expect(withSpaces(cards, [template])[1].section).toBe("templates");
    });
});
