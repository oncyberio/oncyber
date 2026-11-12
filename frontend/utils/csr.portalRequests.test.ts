/**
 * Request count for the portal metadata of a 30-portal world.
 *
 * Each mocked saveToDb call below is one HTTP request in the browser:
 * getExhibit = FETCH_SINGLE_EXHIBIT (the full exhibit), getExhibitPreviews =
 * one batched GET_EXHIBITS_BY_IDS, getDestination = one destination read,
 * getUserProfiles = one batched owner profile read.
 */
import { getDestination, getExhibit, getExhibitPreviews } from "./saveToDb";
import { getUserByWalletId, getUserProfiles } from "./saveToDb";

jest.mock("./lobbyDestinationBridge", () => ({
    isLobbyDestinationPreparing: () => false,
    waitForLobbyDestinationEntry: async () => undefined,
}));
jest.mock("./saveToDb", () => ({
    getDestination: jest.fn(async (slug) => ({ slug })),
    getExhibit: jest.fn(async (id) => ({ exhibit: mockTarget(id) })),
    getExhibitByCustomLink: jest.fn(),
    getExhibitPreviews: jest.fn(async (ids) => ids.map(mockTarget)),
    getUserByWalletId: jest.fn(async (walletId) => ({
        success: true,
        user: { walletId },
    })),
    getUserProfiles: jest.fn(async (walletIds) =>
        Object.fromEntries(
            walletIds.map((walletId) => [walletId.toLowerCase(), { walletId }])
        )
    ),
}));
jest.mock("./metadata/formatExhibit", () => ({
    formatExhibit: (value) => value,
}));

const PORTALS = 30;
const ROOMS = 10;
const OWNERS = 12;

// Portal i leads to world i, in one of 10 rooms, owned by one of 12 owners;
// owner 0 also owns the world the visitor is in.
function mockTarget(id: string) {
    const i = Number(id.split("-")[1]);
    return {
        id,
        owner: `owner-${i % OWNERS}`,
        info: { room: `room-${i % ROOMS}` },
    };
}

const world = {
    id: "hub",
    owner: "owner-0",
    portals: Object.fromEntries(
        Array.from({ length: PORTALS }, (_, i) => [
            `p${i}`,
            { exhibitId: `world-${i}` },
        ])
    ),
} as any;

// The preview batch is flushed by a 0 ms timer that csr registers only after
// an await, so it can land a millisecond after a timer started here. A few
// timer + I/O turns let it and the reads chained on it finish on a busy CI
// runner too.
const settle = async () => {
    for (let turn = 0; turn < 5; turn++)
        await new Promise<void>((resolve) =>
            setTimeout(() => setImmediate(resolve), 1)
        );
};

function requests() {
    return {
        full: (getExhibit as jest.Mock).mock.calls.length,
        batched: (getExhibitPreviews as jest.Mock).mock.calls.length,
        destinations: (getDestination as jest.Mock).mock.calls.length,
        owners: (getUserProfiles as jest.Mock).mock.calls.length,
        singleOwners: (getUserByWalletId as jest.Mock).mock.calls.length,
    };
}

let csr: typeof import("./csr");

beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
        csr = require("./csr");
    });
});

test("a 30-portal world warms its previews in 13 requests, none of them full exhibits", async () => {
    // Before this change (measured by running this scenario against the
    // previous csr.ts): 30 full exhibits (46-284 KB each, uncached) +
    // 10 destinations + 12 owners = 52, started at mount, before the room
    // download (13 owners when the owner address has capitals). Owners were
    // then one request each (23 in all); they now share one batched read per
    // turn: the visitor's world owner first, then every portal owner.
    csr.preloadExhibitPortalData(world, new AbortController().signal);
    await settle();

    expect(requests()).toEqual({
        full: 0,
        batched: 1,
        destinations: ROOMS,
        owners: 2,
        singleOwners: 0,
    });
});

test("portal previews drawn after the warm-up cost no further requests", async () => {
    csr.preloadExhibitPortalData(world, new AbortController().signal);
    await settle();

    // What a portal asks for to draw its preview (with the portal factory
    // reading previews; see getPortalPreviewExhibit).
    await Promise.all(
        Object.values(world.portals).map(async (portal: any) => {
            const preview = await csr.getPortalPreviewExhibit(portal.exhibitId);
            await Promise.all([
                csr.getPortalDestination(preview.info.room),
                csr.getPortalOwner(preview.owner),
            ]);
        })
    );

    expect(requests()).toEqual({
        full: 0,
        batched: 1,
        destinations: ROOMS,
        owners: 2,
        singleOwners: 0,
    });

    // Opening one portal fetches that one world in full.
    await csr.getPortalExhibit("world-7");
    expect(requests().full).toBe(1);
});

test("without the warm-up, previews asked for together still share one request", async () => {
    // The lobby path skips the warm-up; the renderer asks portal by portal.
    await Promise.all(
        Object.values(world.portals).map((portal: any) =>
            csr.getPortalPreviewExhibit(portal.exhibitId)
        )
    );
    expect(requests()).toMatchObject({ full: 0, batched: 1 });
});

test("a world with thousands of portal owners reads them 50 at a time", async () => {
    const owners = Array.from({ length: 2200 }, (_, i) => `0xOwner${i}`);
    const users = await Promise.all(
        owners.map((owner) => csr.getPortalOwner(owner))
    );
    expect(requests().owners).toBe(44);
    expect(requests().singleOwners).toBe(0);
    expect(users[1234]).toEqual({ walletId: "0xOwner1234" });
});

test("a failed owner batch falls back to one read per owner", async () => {
    (getUserProfiles as jest.Mock).mockRejectedValueOnce(new Error("500"));
    await expect(csr.getPortalOwner("owner-3")).resolves.toEqual({
        walletId: "owner-3",
    });
    expect(requests().singleOwners).toBe(1);
});
