/** @jest-environment node */

// A module, so its top-level names do not collide with other test files.
export {};

// The procedures run against the real Firestore helpers and the real status
// lifecycle; only the database underneath is replaced, by this in-memory one.
const mockDocs = new Map<string, Record<string, any>>();
let mockCreated = 0;

function mockDoc(path: string) {
    const id = path.split("/").pop();
    return {
        id,
        get: async () => ({
            id,
            exists: mockDocs.has(path),
            data: () =>
                mockDocs.has(path) ? { ...mockDocs.get(path) } : undefined,
        }),
        set: async (data) => void mockDocs.set(path, { ...data }),
        update: async (data) => {
            if (!mockDocs.has(path)) throw new Error("NOT_FOUND");
            mockDocs.set(path, { ...mockDocs.get(path), ...data });
        },
        delete: async () => void mockDocs.delete(path),
        collection: (name) => mockCollection(`${path}/${name}`),
    };
}

function mockCollection(path: string) {
    const query = {
        where: () => query,
        orderBy: () => query,
        limit: () => query,
        select: () => query,
        // The catalog queries behind a publish are not what is tested here.
        get: async () => ({ empty: true, size: 0, docs: [] }),
        doc: (id) => mockDoc(`${path}/${id}`),
        add: async (data) => {
            const id = `created-${++mockCreated}`;
            mockDocs.set(`${path}/${id}`, { ...data });
            return { id };
        },
    };
    return query;
}

jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (path) => mockCollection(path),
        batch: () => ({
            set: () => undefined,
            update: () => undefined,
            delete: () => undefined,
            commit: async () => undefined,
        }),
    },
    fire: { Timestamp: { now: () => 0 } },
}));
jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));

const OWNER = "0xowner";
const owner = { userId: OWNER } as any;
const stranger = { userId: "0xstranger" } as any;
const stored = (id = "room") => mockDocs.get(`new-destinations/${id}`);
const store = (status: string, extra = {}) =>
    mockDocs.set("new-destinations/room", {
        slug: "room",
        name: "Room",
        userId: OWNER,
        status,
        ...extra,
    });

let api: typeof import("./writeOperations");

beforeEach(() => {
    mockDocs.clear();
    mockCreated = 0;
    jest.resetModules();
    api = require("./writeOperations");
});

describe("create", () => {
    test("a destination starts as a draft owned by the caller", async () => {
        const created = await api.createDestination.call(owner, {
            payload: { slug: "new", name: "New", userId: "0xsomeone-else" },
        });
        expect(created).toMatchObject({ status: "tested", userId: OWNER });

        const explicit = await api.createDestination.call(owner, {
            payload: { slug: "other", name: "Other", status: "tested" },
        });
        expect(explicit.status).toBe("tested");
    });

    test.each(["submitted", "verified", "rejected", "failed", "active", "x"])(
        "a destination cannot be created as %s",
        async (status) => {
            await expect(
                api.createDestination.call(owner, {
                    payload: { slug: "new", name: "New", status },
                })
            ).rejects.toThrow('A new destination starts as "tested"');
            expect(mockDocs.size).toBe(0);
        }
    );
});

describe("the generic update", () => {
    test.each([
        ["tested", "verified"],
        ["tested", "active"],
        ["tested", "rejected"],
        ["submitted", "verified"],
        ["submitted", "active"],
        ["submitted", "rejected"],
        ["rejected", "verified"],
        ["verified", "active"],
        ["active", "tested"],
        ["tested", "failed"],
        ["tested", null],
    ])(
        "an owner cannot move %s to %s, and nothing else is written",
        async (from, status) => {
            store(from);
            await expect(
                api.updateDestinationById.call(owner, {
                    id: "room",
                    payload: { status, name: "Renamed" },
                })
            ).rejects.toThrow("Destination status cannot change");
            expect(stored()).toMatchObject({ status: from, name: "Room" });
        }
    );

    test("fields other than the status are still saved", async () => {
        store("verified");
        const saved = await api.updateDestinationById.call(owner, {
            id: "room",
            payload: { quantity: 3, thumbnail: "t.png" },
        });
        expect(saved).toMatchObject({ status: "verified", quantity: 3 });
    });

    // Finding: two client calls send a status through the generic update.
    test("the Resubmit button's call still works", async () => {
        store("rejected");
        await api.updateDestinationById.call(owner, {
            id: "room",
            payload: { status: "submitted" },
        });
        expect(stored().status).toBe("submitted");
    });

    test("the mint dialog can still mark a mint that was not saved", async () => {
        store("verified");
        await api.updateDestinationById.call(owner, {
            id: "room",
            payload: { status: "failed" },
        });
        expect(stored().status).toBe("failed");
    });

    test("someone else's destination is still refused", async () => {
        store("tested");
        await expect(
            api.updateDestinationById.call(stranger, {
                id: "room",
                payload: { name: "Taken" },
            })
        ).rejects.toThrow("Unauthorized");
        expect(stored().name).toBe("Room");
    });
});

describe("submit and cancel", () => {
    test.each(["tested", "submitted", "rejected", "verified"])(
        "an owner can submit a %s destination for review",
        async (from) => {
            store(from);
            await expect(
                api.submitReview.call(owner, {
                    id: "room",
                    // A status in the form data never wins.
                    payload: { description: "Hello", status: "verified" },
                })
            ).resolves.toEqual({ success: true });
            expect(stored()).toMatchObject({
                status: "submitted",
                description: "Hello",
            });
        }
    );

    test.each(["submitted", "rejected", "verified", "tested"])(
        "an owner can take a %s destination back to a draft",
        async (from) => {
            store(from);
            await expect(
                api.cancelSubmit.call(owner, { id: "room" })
            ).resolves.toEqual({ success: true });
            expect(stored().status).toBe("tested");
        }
    );

    test.each(["active", "failed"])(
        "a %s destination can no longer be submitted or cancelled",
        async (from) => {
            store(from);
            await expect(
                api.submitReview.call(owner, { id: "room", payload: {} })
            ).rejects.toThrow("Destination status cannot change");
            await expect(
                api.cancelSubmit.call(owner, { id: "room" })
            ).rejects.toThrow("Destination status cannot change");
            expect(stored().status).toBe(from);
        }
    );
});

describe("finishing a mint", () => {
    const drop = { token_id: "7", contract_address: "0xcontract" };

    test("a verified destination is published with its token", async () => {
        store("verified");
        await api.finalizeCreateDrop.call(owner, { id: "room", payload: drop });
        expect(stored()).toMatchObject({ status: "active", ...drop });
    });

    test("finalizeMint publishes a verified destination and leaves an active one active", async () => {
        store("verified");
        await api.finalizeMint.call(owner, { id: "room" });
        expect(stored().status).toBe("active");
        await api.finalizeMint.call(owner, { id: "room" });
        expect(stored().status).toBe("active");
    });

    test("finalizeDestination publishes a verified destination, or saves the token alone", async () => {
        store("verified");
        await api.finalizeDestination.call(owner, {
            id: "room",
            payload: { token_id: 7, contract_address: "0xcontract" },
        });
        expect(stored()).toMatchObject({ status: "verified", token_id: 7 });
        await api.finalizeDestination.call(owner, {
            id: "room",
            payload: { status: "active" },
        });
        expect(stored().status).toBe("active");
    });

    test.each(["tested", "submitted", "rejected"])(
        "a %s destination cannot be published by any finalize call",
        async (from) => {
            store(from);
            const refused = "Destination status cannot change";
            await expect(
                api.finalizeCreateDrop.call(owner, {
                    id: "room",
                    payload: drop,
                })
            ).rejects.toThrow(refused);
            await expect(
                api.finalizeMint.call(owner, { id: "room" })
            ).rejects.toThrow(refused);
            await expect(
                api.finalizeDestination.call(owner, {
                    id: "room",
                    payload: { ...drop, status: "active" },
                })
            ).rejects.toThrow(refused);
            expect(stored()).toEqual({
                slug: "room",
                name: "Room",
                userId: OWNER,
                status: from,
            });
        }
    );

    test.each(["verified", "rejected", "tested", "submitted"])(
        "finalizeDestination cannot set %s",
        async (status) => {
            store(status === "tested" ? "submitted" : "tested");
            await expect(
                api.finalizeDestination.call(owner, {
                    id: "room",
                    payload: { status },
                })
            ).rejects.toThrow("Destination status cannot change");
        }
    );
});

describe("moving destinations between accounts", () => {
    // Transfers only happen inside account linking (link.ts), after the
    // caller proves both accounts; no public RPC can move destinations.
    test("taking another account's destinations is not exposed", async () => {
        store("active", { userId: "0xvictim" });
        expect(Object.hasOwn(api, "transferDestinationsToUser")).toBe(false);
        expect(stored().userId).toBe("0xvictim");
    });
});
