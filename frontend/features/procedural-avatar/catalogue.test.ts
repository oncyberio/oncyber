/** @jest-environment node */
import { DEFAULT_HAIR, HAIR_FILES } from "./figure/hairFiles";
import { DEFAULT_OUTFIT } from "./figure/outfitFiles";
import {
    PROCEDURAL_AVATARS,
    figureAvatarOf,
    figureAvatarUrl,
    figureHairFor,
    proceduralAvatarId,
} from "./catalogue";
import { CHARACTERS } from "./characters";
import { FIGURE_STYLES } from "./figure/style";

const generated = PROCEDURAL_AVATARS.filter((entry) => !entry.figure);
const figures = PROCEDURAL_AVATARS.filter((entry) => entry.figure);

test("every catalogue entry has a character behind it", () => {
    expect(generated.map((entry) => entry.id).sort()).toEqual(
        Object.keys(CHARACTERS).sort()
    );
    for (const entry of figures) {
        expect(FIGURE_STYLES[entry.figure]).toBeTruthy();
        expect(proceduralAvatarId(entry.url)).toBe(entry.id);
    }
    for (const entry of generated) {
        expect(CHARACTERS[entry.id].name).toBe(entry.name);
        expect(proceduralAvatarId(entry.url)).toBe(entry.id);
    }
});

test("only a procedural avatar's own path stands for it", () => {
    // As picked, and as it comes back from a travel round trip.
    expect(proceduralAvatarId("/avatars/procedural/runner")).toBe("runner");
    expect(
        proceduralAvatarId("https://oncyber.io/avatars/procedural/runner")
    ).toBe("runner");
    expect(
        proceduralAvatarId(
            "http://localhost:13000/avatars/procedural/stagehand?x=1"
        )
    ).toBe("stagehand");
    for (const other of [
        "",
        undefined,
        null,
        "/avatars/procedural/",
        "/avatars/procedural/unknown",
        "/avatars/procedural/runner/extra",
        "/models/pfp.vrm",
        "https://cyber.mypinata.cloud/ipfs/Qm?filename=runner.glb",
        "http://[bad",
    ])
        expect(proceduralAvatarId(other)).toBeNull();
});

test("a figure avatar's URL carries its variation", () => {
    expect(figureAvatarUrl("figure")).toBe("/avatars/procedural/figure");
    expect(figureAvatarUrl("figure", 7)).toBe(
        "/avatars/procedural/figure?look=7"
    );
    expect(figureAvatarUrl("runner", 7)).toBeNull();
    expect(figureAvatarOf(figureAvatarUrl("figure", 7))).toEqual({
        id: "figure",
        style: "stagehand",
        look: 7,
        hair: figureHairFor(7),
        outfit: DEFAULT_OUTFIT,
    });
    expect(
        figureAvatarOf("https://oncyber.io/avatars/procedural/figure?look=3")
    ).toEqual({
        id: "figure",
        style: "stagehand",
        look: 3,
        hair: figureHairFor(3),
        outfit: DEFAULT_OUTFIT,
    });
    for (const look of ["-1", "1.5", "x", "100000"])
        expect(
            figureAvatarOf(`/avatars/procedural/figure?look=${look}`)?.look
        ).toBe(0);
    expect(figureAvatarOf("/avatars/procedural/runner")).toBeNull();
    expect(figureAvatarOf("/models/pfp.vrm")).toBeNull();
});

test("a figure's hair: the owner's cut by default, others for variations", () => {
    expect(figureAvatarOf("/avatars/procedural/figure")?.hair).toBe(
        DEFAULT_HAIR
    );
    const crowd = new Set(
        [1, 2, 3, 4, 5, 6].map(
            (look) => figureAvatarOf(figureAvatarUrl("figure", look))?.hair
        )
    );
    expect(crowd.has(DEFAULT_HAIR)).toBe(false);
    expect(crowd.size).toBe(Object.keys(HAIR_FILES).length - 1);
    for (const hair of crowd) expect(HAIR_FILES[hair]).toBeDefined();
    expect(figureAvatarUrl("figure", 2, "bob")).toBe(
        "/avatars/procedural/figure?look=2&hair=bob"
    );
    expect(figureAvatarOf(figureAvatarUrl("figure", 0, "none"))?.hair).toBe(
        null
    );
    // An unknown cut is the look's own, never fetched by name.
    expect(figureAvatarOf("/avatars/procedural/figure?hair=../x")?.hair).toBe(
        DEFAULT_HAIR
    );
    expect(figureAvatarUrl("figure", 0, "../x")).toBe(
        "/avatars/procedural/figure"
    );
});

test("a figure wears the default outfit unless its URL names another", () => {
    expect(figureAvatarOf("/avatars/procedural/figure")?.outfit).toBe(
        DEFAULT_OUTFIT
    );
    expect(
        figureAvatarOf(figureAvatarUrl("figure", 0, undefined, "none"))?.outfit
    ).toBeNull();
    expect(figureAvatarOf("/avatars/procedural/figure?outfit=x")?.outfit).toBe(
        DEFAULT_OUTFIT
    );
});

test("the Usher wears its own cut and the wide-striped tie", () => {
    expect(figureAvatarOf("/avatars/procedural/usher")).toEqual({
        id: "usher",
        style: "usher",
        look: 0,
        hair: "short",
        outfit: "stagehand-wide",
    });
});
