import {
    SPACE_SHARDS,
    shardRange,
    sitemapIndexXml,
    sitemapParts,
    spaceSitemapEntry,
    urlsetXml,
} from "./sitemap";

const ORIGIN = "https://www.oncyber.com";

describe("space parts", () => {
    it("cover every id exactly once", () => {
        const owner = (id: string) =>
            SPACE_SHARDS.filter((key) => {
                const { start, end } = shardRange(key);
                return (
                    (start === null || id >= start) &&
                    (end === null || id < end)
                );
            });
        for (const id of [
            "0abc",
            "9zz",
            "A1",
            "Zq",
            "_legacy",
            "a",
            "zzzz",
            "~odd",
            "-x",
        ])
            expect([id, owner(id).length]).toEqual([id, 1]);
    });

    it("refuse unknown keys", () => {
        expect(shardRange("")).toBeNull();
        expect(shardRange("ab")).toBeNull();
        expect(shardRange("-")).toBeNull();
    });

    it("are all in the index", () => {
        const parts = sitemapParts(ORIGIN);
        expect(parts[0]).toBe(`${ORIGIN}/sitemaps/pages.xml`);
        expect(parts).toContain(`${ORIGIN}/sitemaps/spaces-Q.xml`);
        expect(parts).toHaveLength(63);
    });
});

describe("spaceSitemapEntry", () => {
    it("lists a named public space at its custom link", () => {
        expect(
            spaceSitemapEntry(
                "abc",
                {
                    info: {
                        customLink: "starrynight",
                        headline: "Starry Night",
                    },
                    lastContentUpdatedAt: Date.UTC(2026, 10, 1),
                },
                ORIGIN
            )
        ).toEqual({ loc: `${ORIGIN}/starrynight`, lastmod: "2026-11-01" });
    });

    it("lists a titled space without a link at /spaces/<id>", () => {
        expect(
            spaceSitemapEntry(
                "abc",
                {
                    info: { headline: "Untitled 2" },
                    createdAt: { _seconds: 1640995200 },
                },
                ORIGIN
            )
        ).toEqual({ loc: `${ORIGIN}/spaces/abc`, lastmod: "2022-01-01" });
    });

    it("uses /spaces/<id> when the link is one of the site's own pages", () => {
        expect(
            spaceSitemapEntry("abc", { info: { customLink: "studio" } }, ORIGIN)
                ?.loc
        ).toBe(`${ORIGIN}/spaces/abc`);
    });

    it.each([
        ["an empty draft", { info: {} }],
        ["a private space", { info: { customLink: "x", private: true } }],
        [
            "an unlisted space",
            { visibility: "unlisted", info: { customLink: "x" } },
        ],
        ["a deleted space", { deleted: true, info: { customLink: "x" } }],
        ["a mock", { mock: true, info: { customLink: "x" } }],
    ])("skips %s", (_name, data) => {
        expect(spaceSitemapEntry("abc", data, ORIGIN)).toBeNull();
    });
});

describe("xml", () => {
    it("escapes links", () => {
        const xml = urlsetXml([{ loc: `${ORIGIN}/a&b<c>` }]);
        expect(xml).toContain(
            "<loc>https://www.oncyber.com/a&amp;b&lt;c&gt;</loc>"
        );
        expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    });

    it("writes an index", () => {
        expect(sitemapIndexXml([`${ORIGIN}/sitemaps/pages.xml`])).toContain(
            "<sitemap><loc>https://www.oncyber.com/sitemaps/pages.xml</loc></sitemap>"
        );
    });
});
