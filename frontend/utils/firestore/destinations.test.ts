/** @jest-environment node */

// A module, so its top-level names do not collide with other test files.
export {};

type Row = { id: string; data: Record<string, any> };
let mockRows: Row[] = [];
let mockCatalog: Record<string, any>[] = [];
const mockQueryRead = jest.fn();
const mockCatalogRead = jest.fn();
const snapshot = (rows: Row[]) => ({
    empty: rows.length === 0,
    size: rows.length,
    docs: rows.map((row) => {
        const data = { ...row.data };
        return { id: row.id, data: () => data };
    }),
});
class MockQuery {
    conditions: Array<[string, string, any]> = [];
    cap = Infinity;
    constructor(public path: string) {}
    where(key, op, value) {
        this.conditions.push([key, op, value]);
        return this;
    }
    orderBy() {
        return this;
    }
    limit(cap) {
        this.cap = cap;
        return this;
    }
    collection(name) {
        return new MockQuery(`${this.path}/${name}`);
    }
    doc(id = "new") {
        const query = this;
        return {
            collection: (name) => new MockQuery(`${query.path}/${id}/${name}`),
            get: async () => {
                const row = mockRows.find((row) => row.id === id);
                const data = row ? { ...row.data } : undefined;
                return { exists: !!row, data: () => data };
            },
            set: async () => {},
            update: async (data) => {
                const row = mockRows.find((row) => row.id === id);
                row.data = { ...row.data, ...data };
            },
            delete: async () => {
                mockRows = mockRows.filter((row) => row.id !== id);
            },
        };
    }
    async add(data) {
        mockRows.push({ id: "created", data });
        return { id: "created" };
    }
    get() {
        return this.path === "new-destinations"
            ? mockQueryRead(this)
            : mockCatalogRead(this);
    }
}
const mockDb = { collection: (path) => new MockQuery(path) };
jest.mock("@utils/firebaseAdmin", () => ({
    db: mockDb,
    fire: { Timestamp: { now: () => Date.now() } },
}));

const CACHE_KEY = Symbol.for("oncyber.destination-slug-cache.v1");
let api: typeof import("./destinations");
const destination = (slug: string, name = slug): Row => ({
    id: slug,
    data: { slug, name, status: "tested" },
});
beforeEach(() => {
    delete (globalThis as any)[CACHE_KEY];
    jest.resetModules();
    mockRows = [destination("room")];
    mockCatalog = [];
    mockQueryRead
        .mockReset()
        .mockImplementation(async (query: MockQuery) =>
            snapshot(
                mockRows
                    .filter((row) =>
                        query.conditions.every(
                            ([key, op, value]) =>
                                op === "==" && row.data[key] === value
                        )
                    )
                    .slice(0, query.cap)
            )
        );
    mockCatalogRead
        .mockReset()
        .mockImplementation(async () =>
            snapshot([{ id: "0", data: { destinations: mockCatalog } }])
        );
    api = require("./destinations");
});
afterEach(() => {
    delete (globalThis as any)[CACHE_KEY];
    jest.restoreAllMocks();
});

test("cold single-slug lookup reads one destination, never the complete catalog", async () => {
    expect(await api.getDestinationBySlug("room")).toMatchObject({
        _id: "room",
        slug: "room",
    });
    await api.getDestinationBySlug("room");
    expect(mockQueryRead).toHaveBeenCalledTimes(1);
    expect(mockQueryRead.mock.calls[0][0].conditions).toEqual([
        ["slug", "==", "room"],
    ]);
    expect(mockQueryRead.mock.calls[0][0].cap).toBe(1);
    expect(mockCatalogRead).not.toHaveBeenCalled();
});

test("warm public data survives server module re-evaluation", async () => {
    await api.getDestinationBySlug("room");
    jest.resetModules();
    const other: typeof api = require("./destinations");
    expect(await other.getDestinationBySlug("room")).toMatchObject({
        slug: "room",
    });
    expect(mockQueryRead).toHaveBeenCalledTimes(1);
});

test("concurrent reads share work across module instances", async () => {
    let finish: (value: ReturnType<typeof snapshot>) => void;
    mockQueryRead.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const first = api.getDestinationBySlug("room");
    jest.resetModules();
    const other: typeof api = require("./destinations");
    const second = other.getDestinationBySlug("room");
    expect(mockQueryRead).toHaveBeenCalledTimes(1);
    finish(snapshot(mockRows));
    expect(await first).toEqual(await second);
});

test("explicit fresh read bypasses hits and older pending fills cannot replace it", async () => {
    let finishOld: (value: ReturnType<typeof snapshot>) => void;
    mockQueryRead.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finishOld = resolve;
            })
    );
    const old = api.getDestinationBySlug("room");
    mockRows = [destination("room", "Updated")];
    expect(
        await api.getDestinationBySlug("room", { fresh: true })
    ).toMatchObject({ name: "Updated" });
    finishOld(snapshot([destination("room", "Old")]));
    await old;
    expect(await api.getDestinationBySlug("room")).toMatchObject({
        name: "Updated",
    });
    await api.getDestinationBySlug("room", { fresh: true });
    expect(mockQueryRead).toHaveBeenCalledTimes(3);
});

test("invalidation prevents an outstanding read from repopulating stale metadata", async () => {
    let finish: (value: ReturnType<typeof snapshot>) => void;
    mockQueryRead.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const pending = api.getDestinationBySlug("room");
    api.invalidateDestinationSlugCache("room");
    finish(snapshot([destination("room", "Old")]));
    await pending;
    mockRows = [destination("room", "New")];
    expect(await api.getDestinationBySlug("room")).toMatchObject({
        name: "New",
    });
    expect(mockQueryRead).toHaveBeenCalledTimes(2);
});

test("positive and negative TTLs are bounded and hits do not extend them", async () => {
    let now = 1000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    await api.getDestinationBySlug("room");
    await api.getDestinationBySlug("missing");
    now += 19_999;
    await api.getDestinationBySlug("missing");
    await api.getDestinationBySlug("room");
    expect(mockQueryRead).toHaveBeenCalledTimes(2);
    now += 1;
    await api.getDestinationBySlug("missing");
    expect(mockQueryRead).toHaveBeenCalledTimes(3);
    now = 1000 + 30 * 60 * 1000;
    await api.getDestinationBySlug("room");
    expect(mockQueryRead).toHaveBeenCalledTimes(4);
});

test("result cache is LRU-bounded to 500 destinations", async () => {
    mockRows = Array.from({ length: 501 }, (_, i) => destination(`room-${i}`));
    for (let i = 0; i < 500; i++) await api.getDestinationBySlug(`room-${i}`);
    await api.getDestinationBySlug("room-0");
    await api.getDestinationBySlug("room-500");
    await api.getDestinationBySlug("room-0");
    expect(mockQueryRead).toHaveBeenCalledTimes(501);
    await api.getDestinationBySlug("room-1");
    expect(mockQueryRead).toHaveBeenCalledTimes(502);
    expect((globalThis as any)[CACHE_KEY].entries.size).toBe(500);
});

test("in-flight state is bounded and rejected reads can retry", async () => {
    let finish: (value: ReturnType<typeof snapshot>) => void;
    const gate = new Promise((resolve) => {
        finish = resolve;
    });
    mockQueryRead.mockImplementation(() => gate);
    const reads = Array.from({ length: 501 }, (_, i) =>
        api.getDestinationBySlug(`room-${i}`)
    );
    expect((globalThis as any)[CACHE_KEY].pending.size).toBe(500);
    finish(snapshot([]));
    await Promise.all(reads);
    expect((globalThis as any)[CACHE_KEY].pending.size).toBe(0);
    mockQueryRead.mockRejectedValueOnce(new Error("offline"));
    await expect(api.getDestinationBySlug("retry")).rejects.toThrow("offline");
    mockQueryRead.mockResolvedValueOnce(snapshot([destination("retry")]));
    expect(await api.getDestinationBySlug("retry")).toMatchObject({
        slug: "retry",
    });
});

test("uses an already-warm catalog but never revives it after cross-module invalidation", async () => {
    mockCatalog = [{ _id: "room", ...destination("room", "Catalog old").data }];
    await api.getActiveDestinations();
    expect(await api.getDestinationBySlug("room")).toMatchObject({
        name: "Catalog old",
    });
    expect(mockQueryRead).not.toHaveBeenCalled();
    jest.resetModules();
    const other: typeof api = require("./destinations");
    other.invalidateDestinationSlugCache("room");
    mockRows = [destination("room", "Direct new")];
    expect(await api.getDestinationBySlug("room")).toMatchObject({
        name: "Direct new",
    });
    expect(mockQueryRead).toHaveBeenCalledTimes(1);
});

test("create, rename/update, and delete invalidate positive and negative entries", async () => {
    await api.getDestinationBySlug("created-room");
    await api.createDestination({
        slug: "created-room",
        name: "Created",
        status: "tested",
    } as any);
    expect(await api.getDestinationBySlug("created-room")).toMatchObject({
        name: "Created",
    });
    await api.getDestinationBySlug("room");
    await api.getDestinationBySlug("renamed");
    await api.updateDestination("room", { slug: "renamed", name: "Renamed" });
    expect(await api.getDestinationBySlug("room")).toBeNull();
    expect(await api.getDestinationBySlug("renamed")).toMatchObject({
        name: "Renamed",
    });
    await api.deleteDestination("room");
    expect(await api.getDestinationBySlug("renamed")).toBeNull();
});

describe("status writes follow the review lifecycle", () => {
    const status = () => mockRows.find((row) => row.id === "room").data.status;
    const setStatus = (value) => {
        mockRows = [{ id: "room", data: { slug: "room", status: value } }];
    };
    // Publishing rebuilds the catalog snapshot, which this mock has no
    // batch for; that best-effort step logs and carries on.
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    test("a write is made as the owner unless the caller says otherwise", async () => {
        await expect(
            api.updateDestination("room", { status: "verified", name: "X" })
        ).rejects.toThrow(
            'Destination status cannot change from "tested" to "verified".'
        );
        await expect(
            api.updateDestination("room", { status: "active" })
        ).rejects.toThrow("Destination status cannot change");
        // Refused writes change nothing, not even the other fields.
        expect(mockRows[0].data).toEqual({
            slug: "room",
            name: "room",
            status: "tested",
        });

        await api.updateDestination("room", { status: "submitted" });
        expect(status()).toBe("submitted");
    });

    test("only a mint publishes, and only a verified destination", async () => {
        await expect(
            api.updateDestination(
                "room",
                { status: "active" },
                { actor: "mint" }
            )
        ).rejects.toThrow("Destination status cannot change");

        setStatus("verified");
        await api.updateDestination(
            "room",
            { status: "active" },
            { actor: "mint" }
        );
        expect(status()).toBe("active");
    });

    test("review may verify and reject", async () => {
        setStatus("submitted");
        await api.updateDestination(
            "room",
            { status: "verified" },
            { actor: "review" }
        );
        expect(status()).toBe("verified");
        await api.updateDestination(
            "room",
            { status: "rejected" },
            { actor: "review" }
        );
        expect(status()).toBe("rejected");
    });

    test("a write without a status is never a status move", async () => {
        setStatus("active");
        await api.updateDestination("room", { name: "Live edit" });
        expect(mockRows[0].data).toMatchObject({
            name: "Live edit",
            status: "active",
        });
    });

    test("a destination is created as a draft", async () => {
        const draft = { slug: "draft", name: "Draft" } as any;
        for (const value of ["active", "verified", "submitted", undefined]) {
            await expect(
                api.createDestination({ ...draft, status: value })
            ).rejects.toThrow('A new destination starts as "tested"');
        }
        expect(mockRows.map((row) => row.id)).toEqual(["room"]);

        await api.createDestination({ ...draft, status: "tested" });
        expect(mockRows.map((row) => row.id)).toEqual(["room", "created"]);
    });
});

test("active-catalog invalidation clears public slug entries too", async () => {
    await api.getDestinationBySlug("room");
    api.invalidateActiveDestinationsCache();
    mockRows = [destination("room", "Changed")];
    expect(await api.getDestinationBySlug("room")).toMatchObject({
        name: "Changed",
    });
    expect(mockQueryRead).toHaveBeenCalledTimes(2);
});
