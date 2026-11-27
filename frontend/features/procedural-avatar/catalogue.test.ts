/** @jest-environment node */
import { PROCEDURAL_AVATARS, proceduralAvatarId } from "./catalogue";
import { CHARACTERS } from "./characters";

test("every catalogue entry has a character behind it", () => {
    expect(PROCEDURAL_AVATARS.map((entry) => entry.id).sort()).toEqual(
        Object.keys(CHARACTERS).sort()
    );
    for (const entry of PROCEDURAL_AVATARS) {
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
