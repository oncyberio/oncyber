/** @jest-environment node */
import { getExhibitById, updateExhibit } from "./exhibit";
import { db } from "@utils/firebaseAdmin";

// Staff picks read Firestore; these tests are about the feed itself.
jest.mock("@utils/staffPicks", () => ({
    readStaffPickIds: jest.fn(async () => []),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        runTransaction: jest.fn(),
        collection: jest.fn(() => ({ doc: jest.fn() })),
    },
    fire: {},
}));
jest.mock("@utils/firestore/spaceSearch", () => ({ searchSpaces: jest.fn() }));
jest.mock("@features/landing-carousel/data", () => ({ DEFAULT_FILTERS: {} }));
jest.mock("@utils/saveToDb", () => ({
    getSlug: jest.fn(),
    oldToNew: {},
    pathToSlug: {},
}));
jest.mock("@utils/metadata/formatExhibit", () => ({
    formatExhibit: jest.fn(),
    formatUpdate: jest.fn(),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    getUserProfileByWalletId: jest.fn(),
}));
jest.mock("./stylekit", () => ({ getStylekitByRoom: jest.fn() }));

test.each([
    ["the owner", { owner: "0xeditor" }],
    ["the visit count", { number_of_visits: 1e6 }],
])("an edit through a path update cannot set %s", async (_name, update) => {
    const result = await updateExhibit(
        "space-1",
        { FIRESTORE_UPDATE_Field: true, update },
        "0xeditor"
    );
    expect(result).toEqual({ success: false, error: "You can't update." });
    expect(db.runTransaction).not.toHaveBeenCalled();
});

test("a view passed along from the shared cache keeps the age it was filled at", async () => {
    const HOUR = 60 * 60 * 1000;
    const filled = 1_700_000_000_000;
    let now = filled + 23 * HOUR;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    const view = { id: "space-9", owner: "0xowner", ownerSpaces: [] };
    const liveRead = jest.fn(async () => ({ exists: false }));
    const sharedRead = jest.fn(async () => ({
        data: () => ({ v: 7, ts: filled, exhibit: view }),
    }));
    const mockDb = db as any;
    mockDb.collection = jest.fn((name: string) => ({
        doc: jest.fn(() => ({
            get: name === "caches" ? sharedRead : liveRead,
        })),
    }));
    mockDb.getAll = jest.fn(async () => [
        { exists: true, data: () => ({ lastUpdatedAt: 7 }) },
    ]);
    try {
        // An instance picks the view up an hour before it is a day old.
        expect(await getExhibitById("space-9")).toMatchObject({
            id: "space-9",
        });
        expect(sharedRead).toHaveBeenCalledTimes(1);
        expect(liveRead).not.toHaveBeenCalled();
        // Two hours on, a day has passed since the fill: the copy this
        // instance kept is not served, and the space is read again.
        now = filled + 25 * HOUR;
        await getExhibitById("space-9");
        expect(liveRead).toHaveBeenCalledTimes(1);
    } finally {
        clock.mockRestore();
    }
});
