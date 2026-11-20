import {
    groupGameCredits,
    loadGameCredits,
    parseGameCredits,
} from "./gameCredits";

const anton = {
    title: "Anton",
    kind: "font",
    author: "The Anton Project Authors",
    source: "https://github.com/googlefonts/AntonFont",
    license: "OFL-1.1",
    licenseName: "SIL Open Font License 1.1",
    licenseUrl: "https://openfontlicense.org/",
    licenseFile: "fonts/Anton-OFL.txt",
    files: ["fonts/Anton-Regular.ttf"],
    note: null,
    confirmed: true,
};

test("reads credits and links the licence text shipped with the game", () => {
    const parsed = parseGameCredits("padel", {
        version: 1,
        own: 2,
        credits: [anton],
    });
    expect(parsed?.own).toBe(2);
    expect(parsed?.credits[0]).toMatchObject({
        title: "Anton",
        licenseName: "SIL Open Font License 1.1",
        licenseHref: "/games/padel/fonts/Anton-OFL.txt",
        source: "https://github.com/googlefonts/AntonFont",
        confirmed: true,
    });
});

test("falls back to the licence's public page, and drops unsafe links", () => {
    const parsed = parseGameCredits("ace", {
        version: 1,
        credits: [
            { ...anton, licenseFile: null },
            { ...anton, title: "B", licenseFile: "../../api/secret" },
            {
                ...anton,
                title: "C",
                source: "javascript:alert(1)",
                licenseFile: "a?b",
                licenseUrl: "http://example.com",
                kind: "__proto__",
                confirmed: "yes",
            },
        ],
    });
    expect(parsed?.credits[0].licenseHref).toBe("https://openfontlicense.org/");
    expect(parsed?.credits[1].licenseHref).toBe("https://openfontlicense.org/");
    expect(parsed?.credits[2]).toMatchObject({
        source: null,
        licenseHref: null,
        kind: "other",
        confirmed: false,
    });
});

test("malformed files give null and bad entries are skipped", () => {
    expect(parseGameCredits("ace", null)).toBeNull();
    expect(parseGameCredits("ace", { version: 2, credits: [] })).toBeNull();
    expect(parseGameCredits("ace", { version: 1, credits: "x" })).toBeNull();
    expect(
        parseGameCredits("ace", { version: 1, credits: [null, {}, anton] })
            ?.credits
    ).toHaveLength(1);
});

test("groups by kind in a fixed order", () => {
    const parsed = parseGameCredits("padel", {
        version: 1,
        credits: [
            { ...anton, title: "three.js", kind: "library" },
            anton,
            { ...anton, title: "Clips", kind: "motion" },
        ],
    });
    expect(groupGameCredits(parsed!.credits).map((g) => g.label)).toEqual([
        "Fonts",
        "Motion",
        "Code libraries",
    ]);
});

test("a missing credits.json is not an error", async () => {
    const missing = (async () => ({ ok: false })) as unknown as typeof fetch;
    expect(await loadGameCredits("ace", undefined, missing)).toBeNull();
    const broken = (async () => {
        throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await loadGameCredits("ace", undefined, broken)).toBeNull();
    const found = (async (url: string) => ({
        ok: url === "/games/ace/credits.json",
        json: async () => ({ version: 1, own: 1, credits: [anton] }),
    })) as unknown as typeof fetch;
    expect(
        (await loadGameCredits("ace", undefined, found))?.credits
    ).toHaveLength(1);
});

test("a hosted release's credits and licence texts come from the release", async () => {
    const base = "https://gateway.example/ipfs/bafybeigdyrzt/";
    const asked: string[] = [];
    const hosted = (async (url: string) => {
        asked.push(url);
        return {
            ok: true,
            json: async () => ({ version: 1, own: 0, credits: [anton] }),
        };
    }) as unknown as typeof fetch;
    const credits = await loadGameCredits("ace", undefined, hosted, base);
    expect(asked).toEqual([`${base}credits.json`]);
    expect(credits?.credits[0].licenseHref).toBe(`${base}fonts/Anton-OFL.txt`);
});
