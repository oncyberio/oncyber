import { spaceAvatarChoices } from "./spaceAvatarChoices";

test("uploads and owned avatars lead, then the catalog without hidden ones", () => {
    const choices = spaceAvatarChoices(
        [{ id: "up", name: "Mine", url: "https://a/up.vrm", image: "up.png" }],
        [{ id: "nft", name: "Owned", url: "https://a/nft.vrm" }],
        [
            { id: "summer", name: "Summer", url: "https://a/summer.vrm" },
            {
                id: "secret",
                name: "Secret",
                url: "https://a/s.vrm",
                hidden: true,
            },
            // The same model as an upload is listed once.
            { id: "dup", name: "Dup", url: "https://a/up.vrm" },
        ]
    );
    expect(choices.map((c) => [c.id, c.source, c.owned])).toEqual([
        ["up", "UPLOADED", true],
        ["nft", "OWNED", true],
        ["summer", "DEFAULT", false],
    ]);
    expect(choices[0].img).toBe("up.png");
});

test("entries still loading are skipped", () => {
    expect(spaceAvatarChoices([null], [undefined], [])).toEqual([]);
});
