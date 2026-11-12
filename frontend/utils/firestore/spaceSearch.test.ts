import {
    searchSpaces,
    titlePrefixes,
    normalizeSearch,
    matchesSpaceSearch,
} from "./spaceSearch";
const filters = {
    q: "",
    category: "most-visited" as const,
    chain: "",
    owner: "",
    collection: "",
};
let mockDocuments: any[] = [];
const mockReads = jest.fn();
const field = (doc, path) =>
    path === "__name__"
        ? doc.id
        : path.split(".").reduce((value, key) => value?.[key], doc.data);
class MockQuery {
    conditions = [];
    order = [];
    after = [];
    cap = 0;
    fields = [];
    select(...fields) {
        this.fields = fields;
        return this;
    }
    where(...condition) {
        this.conditions.push(condition);
        return this;
    }
    orderBy(key) {
        this.order.push(key);
        return this;
    }
    startAfter(...after) {
        this.after = after;
        return this;
    }
    limit(cap) {
        this.cap = cap;
        return this;
    }
    async get() {
        mockReads(this);
        const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
        const rows = mockDocuments
            .filter((doc) =>
                this.conditions.every(([key, op, value]) => {
                    const actual = field(doc, key);
                    if (actual === undefined) return false;
                    return op === ">="
                        ? actual >= value
                        : op === "<="
                        ? actual <= value
                        : op === "array-contains"
                        ? actual.includes(value)
                        : op === "in"
                        ? value.includes(actual)
                        : actual === value;
                })
            )
            .sort((a, b) =>
                this.order.reduce(
                    (value, key) =>
                        value || compare(field(a, key), field(b, key)),
                    0
                )
            )
            .filter(
                (doc) =>
                    !this.after.length ||
                    this.order.reduce(
                        (value, key, i) =>
                            value || compare(field(doc, key), this.after[i]),
                        0
                    ) > 0
            )
            .slice(0, this.cap);
        return {
            size: rows.length,
            docs: rows.map((doc) => ({
                id: doc.id,
                data: () => doc.data,
                get: (key) => field(doc, key),
            })),
        };
    }
}
jest.mock("@utils/firebaseAdmin", () => ({
    db: { collection: () => new MockQuery() },
}));
jest.mock("firebase-admin", () => ({
    firestore: { FieldPath: { documentId: () => "__name__" } },
}));
function doc(id, title, extra = {}) {
    return {
        id,
        data: {
            info: { headline: title, heroImg: `/${id}.jpg`, customLink: id },
            ...extra,
        },
    };
}
beforeEach(() => {
    mockReads.mockClear();
    mockDocuments = [];
});
test("queries existing casing variants and recognizes numbered editions", () => {
    expect(titlePrefixes("cyber spotlight n1")).toContain("Cyber Spotlight");
    expect(normalizeSearch("Cyber Spotlight №1")).toBe(
        normalizeSearch("cyber spotlight n1")
    );
});
test("returns real title matches beyond the browse feed without leaking document contents", async () => {
    mockDocuments = [3, 1, 2].map((n) =>
        doc(`spotlight${n}`, `Cyber Spotlight №${n}`, {
            artworks: { secret: "heavy" },
            gating: { password: "secret" },
        })
    );
    const result = await searchSpaces({ ...filters, q: "cyber spotlight" });
    expect(result.exhibits.map((doc) => doc.info.headline)).toEqual([
        "Cyber Spotlight №1",
        "Cyber Spotlight №2",
        "Cyber Spotlight №3",
    ]);
    expect(result.hasMore).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
    mockReads.mock.calls.forEach(([query]) => {
        expect(query.cap).toBe(20);
        expect(query.fields).not.toContain("artworks");
        expect(query.conditions.length).toBeGreaterThan(0);
    });
});
test("paginates all title matches using per-query cursors without skips", async () => {
    mockDocuments = Array.from({ length: 45 }, (_, i) =>
        doc(
            `paging${String(i).padStart(2, "0")}`,
            `Paging ${String(i).padStart(2, "0")}`
        )
    );
    let cursor = "",
        ids = [],
        pages = 0;
    do {
        const result = await searchSpaces({ ...filters, q: "paging" }, cursor);
        ids.push(...result.exhibits.map((doc) => doc.id));
        cursor = result.cursor;
        pages++;
    } while (cursor && pages < 5);
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
    expect(pages).toBe(3);
});
test("rejects a cursor reused for a different query", async () => {
    const cursor = Buffer.from(
        JSON.stringify({ key: "wrong", positions: [] })
    ).toString("base64url");
    await expect(
        searchSpaces({ ...filters, q: "other" }, cursor)
    ).rejects.toThrow("Invalid search cursor");
});
test.each([
    { mock: true },
    { deleted: true },
    { isPublic: false },
    { published: false },
    { visibility: "unlisted" },
    { visibility: "private" },
])("omits nonpublic cards %p", (flags) => {
    expect(
        matchesSpaceSearch(doc("private", "Secret", flags).data, {
            ...filters,
            q: "secret",
        })
    ).toBe(false);
});
test("combines chain, owner, collection and room filters", () => {
    const data = doc("filters", "Matched", {
        owner: "0xABC",
        chains: ["ethereum"],
        collections: ["art"],
    }).data;
    expect(
        matchesSpaceSearch(data, {
            ...filters,
            q: "matched",
            owner: "0xabc",
            chain: "ethereum",
            collection: "art",
        })
    ).toBe(true);
    expect(
        matchesSpaceSearch(data, { ...filters, q: "matched", chain: "polygon" })
    ).toBe(false);
    expect(
        matchesSpaceSearch(data, {
            ...filters,
            q: "matched",
            category: "oncyberlabs",
        })
    ).toBe(false);
});
test("repeated identical searches share the short-lived metadata cache", async () => {
    mockDocuments = [doc("cached", "Cached title")];
    const one = await searchSpaces({ ...filters, q: "cached" });
    const reads = mockReads.mock.calls.length;
    const two = await searchSpaces({ ...filters, q: "cached" });
    expect(two).toEqual(one);
    expect(mockReads).toHaveBeenCalledTimes(reads);
});

test("n1 matches edition №1 rather than №10", () => {
    expect(
        matchesSpaceSearch(doc("edition1", "Cyber Spotlight №1").data, {
            ...filters,
            q: "cyber spotlight n1",
        })
    ).toBe(true);
    expect(
        matchesSpaceSearch(doc("edition10", "Cyber Spotlight №10").data, {
            ...filters,
            q: "cyber spotlight n1",
        })
    ).toBe(false);
});

test("includes public matching worlds without cover metadata", () => {
    const data = { info: { headline: "Uncovered gallery" } };
    expect(matchesSpaceSearch(data, { ...filters, q: "uncovered" })).toBe(true);
    expect(
        matchesSpaceSearch(
            { ...data, published: false },
            { ...filters, q: "uncovered" }
        )
    ).toBe(false);
});

function indexedArtist(names: string[], terms: string[], extra = {}) {
    return { names, terms, addresses: [], ...extra };
}
test("finds displayed artists beyond titles, omits private galleries and keeps provenance out of responses", async () => {
    const artistSearch = indexedArtist(
        ["XCOPY", "xcopyart"],
        ["xcopy", "xcopyart"],
        { sourceHash: "private-hash", evidence: "internal-evidence" }
    );
    mockDocuments = [
        doc("artist-room", "A quiet room", {
            artistSearch,
            artworks: { secret: "heavy" },
        }),
        doc("private-room", "Private", { artistSearch, isPublic: false }),
    ];
    const result = await searchSpaces({ ...filters, q: "@xcopyart" });
    expect(result.exhibits.map((item) => item.id)).toEqual(["artist-room"]);
    expect(result.exhibits[0].artistSearch.names).toEqual([
        "XCOPY",
        "xcopyart",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
        /private-hash|internal-evidence|heavy/
    );
    expect(
        mockReads.mock.calls.some(([query]) =>
            query.conditions.some(
                ([field, op, value]) =>
                    field === "artistSearch.terms" &&
                    op === "array-contains" &&
                    value === "xcopyart"
            )
        )
    ).toBe(true);
});
test("artist results paginate without loading artwork documents", async () => {
    mockDocuments = Array.from({ length: 45 }, (_, i) =>
        doc(`artist-page-${String(i).padStart(2, "0")}`, `Room ${i}`, {
            artistSearch: indexedArtist(["osf_rekt"], ["osfrekt"]),
        })
    );
    let cursor = "",
        ids = [],
        pages = 0;
    do {
        const result = await searchSpaces(
            { ...filters, q: "osf_rekt" },
            cursor
        );
        ids.push(...result.exhibits.map((item) => item.id));
        cursor = result.cursor;
        pages++;
    } while (cursor && pages < 5);
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
    mockReads.mock.calls.forEach(([query]) =>
        expect(query.fields).not.toContain("artworks")
    );
});
test("verified gallery makers can match without being credited for the artworks", async () => {
    mockDocuments = [
        doc("contest", "AI Contest", {
            artistSearch: indexedArtist([], ["clairesilver"], {
                curatorNames: ["Claire Silver", "clairesilver"],
            }),
        }),
    ];
    const result = await searchSpaces({ ...filters, q: "clairesilver" });
    expect(result.exhibits.map((item) => item.id)).toEqual(["contest"]);
    expect(result.exhibits[0].artistSearch.names).toEqual([]);
});
test("artist names respect other discovery filters", () => {
    const data = doc("filtered-artist", "Room", {
        artistSearch: indexedArtist(["Beeple"], ["beeple"]),
        chains: ["ethereum"],
    }).data;
    expect(
        matchesSpaceSearch(data, { ...filters, q: "beeple", chain: "tezos" })
    ).toBe(false);
    expect(
        matchesSpaceSearch(data, { ...filters, q: "beeple", chain: "ethereum" })
    ).toBe(true);
});
