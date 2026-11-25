import {
    nextSection,
    openingSection,
    profileSections,
    visitsLabel,
} from "./profileSections";

const space = { id: "a" };

describe("profileSections", () => {
    it("lists only the sections a profile has", () => {
        expect(
            profileSections({
                spaces: [space, space],
                featured: [space],
                hasNfts: true,
            })
        ).toEqual([
            { id: "spaces", label: "Spaces", count: 2 },
            { id: "featured", label: "Featured in", count: 1 },
            { id: "owned", label: "Collected" },
            { id: "created", label: "Created" },
        ]);
        expect(
            profileSections({ spaces: [], featured: [], hasNfts: false })
        ).toEqual([{ id: "spaces", label: "Spaces", count: 0 }]);
    });
});

describe("openingSection", () => {
    it("opens on their spaces", () => {
        expect(
            openingSection(
                profileSections({
                    spaces: [space],
                    featured: [space],
                    hasNfts: true,
                })
            )
        ).toBe("spaces");
    });

    it("opens on the first section with something when they deployed none", () => {
        expect(
            openingSection(
                profileSections({
                    spaces: [],
                    featured: [space],
                    hasNfts: true,
                })
            )
        ).toBe("featured");
        expect(
            openingSection(
                profileSections({ spaces: [], featured: [], hasNfts: true })
            )
        ).toBe("owned");
        expect(
            openingSection(
                profileSections({ spaces: [], featured: [], hasNfts: false })
            )
        ).toBe("spaces");
    });
});

describe("nextSection", () => {
    const sections = profileSections({
        spaces: [space],
        featured: [space],
        hasNfts: true,
    });

    it("moves with the arrow keys and wraps at the ends", () => {
        expect(nextSection(sections, "spaces", "ArrowRight")).toBe("featured");
        expect(nextSection(sections, "created", "ArrowRight")).toBe("spaces");
        expect(nextSection(sections, "spaces", "ArrowLeft")).toBe("created");
        expect(nextSection(sections, "owned", "Home")).toBe("spaces");
        expect(nextSection(sections, "spaces", "End")).toBe("created");
    });

    it("stays put for other keys, at the target, or alone", () => {
        expect(nextSection(sections, "spaces", "Enter")).toBeNull();
        expect(nextSection(sections, "spaces", "Home")).toBeNull();
        expect(
            nextSection(
                profileSections({ spaces: [], featured: [], hasNfts: false }),
                "spaces",
                "ArrowRight"
            )
        ).toBeNull();
    });
});

describe("visitsLabel", () => {
    it("reads like the landing's cards", () => {
        expect(visitsLabel(140774)).toBe("140.8K visits");
        expect(visitsLabel(907)).toBe("907 visits");
        expect(visitsLabel(1)).toBe("1 visit");
    });

    it("says nothing for a space nobody has visited", () => {
        expect(visitsLabel(0)).toBe("");
        expect(visitsLabel(undefined)).toBe("");
        expect(visitsLabel("many")).toBe("");
    });
});

test("hidden NFTs are saved as unique lower-case ids, or not at all", () => {
    const { readHiddenNfts, HIDDEN_NFTS_MAX } = require("./profileSections");
    const a = "0x" + "AA".repeat(20) + "/12";
    expect(readHiddenNfts([a, a.toLowerCase()])).toEqual([a.toLowerCase()]);
    expect(readHiddenNfts([])).toEqual([]);
    for (const bad of [
        null,
        "0x",
        [42],
        ["not-an-nft"],
        ["0x" + "aa".repeat(20)],
        ["0x" + "aa".repeat(20) + "/../x"],
        Array(HIDDEN_NFTS_MAX + 1).fill(a),
    ])
        expect(readHiddenNfts(bad)).toBeNull();
});
