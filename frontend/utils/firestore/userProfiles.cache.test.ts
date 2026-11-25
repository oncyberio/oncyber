/** @jest-environment node */
// The shared cache documents, as another instance would see them.
let mockShared: Record<string, any> = {};

jest.mock("../getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("../firebaseAdmin", () => {
    const ref = (id: string) => ({
        id,
        set: jest.fn(async (value) => {
            mockShared[id] = value;
        }),
        delete: jest.fn(async () => {
            delete mockShared[id];
        }),
    });
    return {
        db: {
            collection: () => ({ doc: ref }),
            getAll: jest.fn(async (...refs: { id: string }[]) =>
                refs.map(({ id }) => ({ data: () => mockShared[id] }))
            ),
        },
    };
});

let live: jest.Mock;
const HOUR = 60 * 60 * 1000;
let now = 1_700_000_000_000;
let profiles: typeof import("./userProfiles");

beforeEach(() => {
    jest.resetModules();
    mockShared = {};
    now = 1_700_000_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    // A fresh module is a fresh instance: its in-process copies are empty.
    profiles = require("./userProfiles");
    live = require("../getContentByIds").getContentByIds;
});
afterEach(() => jest.restoreAllMocks());

const account = (vrm: string) => ({
    id: "0xalice",
    walletId: "0xalice",
    settings: { vrm },
});

test("an instance's own copy outlives an edit made through another instance", async () => {
    live.mockResolvedValue([account("dickbutt")]);
    await profiles.getUserProfileByWalletId("0xalice");
    // The edit lands elsewhere: the document changes and the shared copy
    // goes, but this instance still holds what it read before.
    live.mockResolvedValue([account("sunshine")]);
    delete mockShared["user-profile-0xalice"];
    now += 10 * 60 * 1000;
    const stale = await profiles.getUserProfileByWalletId("0xalice");
    expect(stale.settings.vrm).toBe("dickbutt");
    expect(live).toHaveBeenCalledTimes(1);
});

test("a read told when the account was written skips every older copy", async () => {
    live.mockResolvedValue([account("dickbutt")]);
    await profiles.getUserProfileByWalletId("0xalice");
    live.mockResolvedValue([account("sunshine")]);
    now += 10 * 60 * 1000;
    const writtenAt = now;
    // Neither this instance's copy nor the shared one (both older) is used.
    now += 5_000;
    const fresh = await profiles.getUserProfileByWalletId("0xalice", {
        notBefore: writtenAt,
    });
    expect(fresh.settings.vrm).toBe("sunshine");
    expect(live).toHaveBeenCalledTimes(2);
    // The copy made by that read is new enough for the reads after it.
    now += 60_000;
    await profiles.getUserProfileByWalletId("0xalice", {
        notBefore: writtenAt,
    });
    expect(live).toHaveBeenCalledTimes(2);
});

test("a copy taken in the same millisecond as the write is not trusted", async () => {
    live.mockResolvedValue([account("dickbutt")]);
    await profiles.getUserProfileByWalletId("0xalice");
    // The save lands within that millisecond, on another instance.
    live.mockResolvedValue([account("sunshine")]);
    const fresh = await profiles.getUserProfileByWalletId("0xalice", {
        notBefore: now,
    });
    expect(fresh.settings.vrm).toBe("sunshine");
    expect(live).toHaveBeenCalledTimes(2);
});

test("a mark older than the copy changes nothing", async () => {
    live.mockResolvedValue([account("sunshine")]);
    await profiles.getUserProfileByWalletId("0xalice");
    now += HOUR;
    await profiles.getUserProfileByWalletId("0xalice", {
        notBefore: now - 2 * HOUR,
    });
    await profiles.getUserProfileByWalletId("0xalice", {});
    expect(live).toHaveBeenCalledTimes(1);
});
