import {
    createSpaceCards,
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
    it("stops at nine, newest first, and ends with Show all", () => {
        const cards = createSpaceCards(spaces, "", false);
        expect(cards).toHaveLength(SPACES_SHOWN + 1);
        expect(cards[0].spaceId).toBe("s11");
        const last = cards[cards.length - 1];
        expect(last.id).toBe(SHOW_ALL_SPACES_ID);
        expect(last.title).toBe("Show all 12 spaces");
        expect(last.buildStatus).toBe("3 more");
        expect(cards.every((card) => card.section === "spaces")).toBe(true);
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
