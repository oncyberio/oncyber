/** @jest-environment node */
import {
    PROCEDURAL_AVATARS,
    figureAvatarOf,
    figureAvatarUrl,
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
    });
    expect(
        figureAvatarOf("https://oncyber.io/avatars/procedural/figure?look=3")
    ).toEqual({ id: "figure", style: "stagehand", look: 3 });
    for (const look of ["-1", "1.5", "x", "100000"])
        expect(
            figureAvatarOf(`/avatars/procedural/figure?look=${look}`)?.look
        ).toBe(0);
    expect(figureAvatarOf("/avatars/procedural/runner")).toBeNull();
    expect(figureAvatarOf("/models/pfp.vrm")).toBeNull();
});
