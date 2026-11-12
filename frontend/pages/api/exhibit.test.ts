/** @jest-environment node */
import { updateExhibit } from "./exhibit";
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
