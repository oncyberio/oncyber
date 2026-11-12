import {
    isLobbyDestinationPreparing,
    waitForLobbyDestinationEntry,
} from "./lobbyDestinationBridge";
import {
    getDestination,
    getExhibit,
    getExhibitPreviews,
    getUserByWalletId,
    getUserProfiles,
} from "./saveToDb";

jest.mock("./lobbyDestinationBridge", () => ({
    isLobbyDestinationPreparing: jest.fn(),
    waitForLobbyDestinationEntry: jest.fn(),
}));
jest.mock("./saveToDb", () => ({
    getDestination: jest.fn(),
    getExhibit: jest.fn(),
    getExhibitByCustomLink: jest.fn(),
    getExhibitPreviews: jest.fn(),
    getUserByWalletId: jest.fn(),
    getUserProfiles: jest.fn(),
}));
jest.mock("./metadata/formatExhibit", () => ({
    formatExhibit: (value) => value,
}));

let csr: typeof import("./csr");
const portalExhibit = {
    id: "portal-target",
    owner: "target-owner",
    info: { room: "target-room" },
};
const exhibit = {
    id: "source",
    owner: "source-owner",
    portals: {
        first: { exhibitId: "portal-target" },
        duplicate: { exhibitId: "portal-target" },
    },
} as any;
// Preview requests are batched on a zero-delay timer; let it fire and drain.
const ownerReads = () =>
    (getUserProfiles as jest.Mock).mock.calls.flatMap(
        ([walletIds]) => walletIds
    );
// Preview and owner reads are each batched on a zero-delay timer, and owner
// reads start once previews arrive, so drain a few rounds.
const tick = () =>
    new Promise<void>((resolve) => setTimeout(() => setImmediate(resolve), 0));
const settle = async () => {
    for (let i = 0; i < 3; i++) await tick();
};

beforeEach(() => {
    jest.clearAllMocks();
    (isLobbyDestinationPreparing as jest.Mock).mockReturnValue(false);
    (waitForLobbyDestinationEntry as jest.Mock).mockResolvedValue(undefined);
    (getExhibit as jest.Mock).mockResolvedValue({ exhibit: portalExhibit });
    (getExhibitPreviews as jest.Mock).mockResolvedValue([portalExhibit]);
    (getDestination as jest.Mock).mockResolvedValue({ slug: "target-room" });
    (getUserByWalletId as jest.Mock).mockResolvedValue({
        success: true,
        user: { walletId: "owner" },
    });
    (getUserProfiles as jest.Mock).mockImplementation(async (walletIds) =>
        Object.fromEntries(
            walletIds.map((walletId) => [
                walletId.toLowerCase(),
                { walletId: "owner" },
            ])
        )
    );
    // Each page document owns its own cache and speculative-preload lifetime.
    jest.isolateModules(() => {
        csr = require("./csr");
    });
});

test("lobby preparation issues no speculative portal or owner requests", async () => {
    (isLobbyDestinationPreparing as jest.Mock).mockReturnValue(true);
    await csr.preloadExhibitPortalData(exhibit, new AbortController().signal);
    await settle();
    expect(getExhibit).not.toHaveBeenCalled();
    expect(getExhibitPreviews).not.toHaveBeenCalled();
    expect(getDestination).not.toHaveBeenCalled();
    expect(ownerReads()).toEqual([]);
});

test("renderer-demand portal metadata waits for entry then deduplicates", async () => {
    let reveal: () => void;
    const entry = new Promise<void>((resolve) => {
        reveal = resolve;
    });
    (waitForLobbyDestinationEntry as jest.Mock).mockReturnValue(entry);
    (isLobbyDestinationPreparing as jest.Mock).mockReturnValue(true);
    await csr.preloadExhibitPortalData(exhibit, new AbortController().signal);
    const loaded = Promise.all([
        csr.getPortalExhibit("portal-target"),
        csr.getPortalExhibit("portal-target"),
    ]);
    const otherMetadata = Promise.all([
        csr.getPortalDestination("target-room"),
        csr.getPortalOwner("target-owner"),
    ]);
    await settle();
    expect(getExhibit).not.toHaveBeenCalled();
    expect(getDestination).not.toHaveBeenCalled();
    expect(ownerReads()).toEqual([]);
    reveal();
    const [first, duplicate] = await loaded;
    await otherMetadata;
    expect(first).toBe(portalExhibit);
    expect(duplicate).toBe(portalExhibit);
    expect(getExhibit).toHaveBeenCalledTimes(1);
    expect(getExhibit).toHaveBeenCalledWith("portal-target");
    await Promise.all([
        csr.getPortalDestination("target-room"),
        csr.getPortalOwner("target-owner"),
    ]);
    expect(getDestination).toHaveBeenCalledWith("target-room");
    expect(ownerReads()).toContain("target-owner");
});

test("ordinary direct visits preload previews once, not full exhibits", async () => {
    const signal = new AbortController().signal;
    await csr.preloadExhibitPortalData(exhibit, signal);
    await settle();
    expect(getExhibit).not.toHaveBeenCalled();
    expect(getExhibitPreviews).toHaveBeenCalledTimes(1);
    expect(getExhibitPreviews).toHaveBeenCalledWith(["portal-target"]);
    expect(getDestination).toHaveBeenCalledTimes(1);
    expect(ownerReads()).toContain("source-owner");
    expect(ownerReads()).toContain("target-owner");
    await csr.preloadExhibitPortalData(exhibit, signal);
    await settle();
    expect(getExhibitPreviews).toHaveBeenCalledTimes(1);
    await expect(csr.getPortalPreviewExhibit("portal-target")).resolves.toBe(
        portalExhibit
    );
    expect(getExhibitPreviews).toHaveBeenCalledTimes(1);
});

test("skipping preparation does not consume the preload opportunity after revealed entry", async () => {
    (isLobbyDestinationPreparing as jest.Mock).mockReturnValue(true);
    await csr.preloadExhibitPortalData(exhibit, new AbortController().signal);
    (isLobbyDestinationPreparing as jest.Mock).mockReturnValue(false);
    (waitForLobbyDestinationEntry as jest.Mock).mockResolvedValue(undefined);
    await csr.preloadExhibitPortalData(exhibit, new AbortController().signal);
    await settle();
    expect(getExhibitPreviews).toHaveBeenCalledTimes(1);
});

test("an already-cancelled page issues no requests or claims the preload lifetime", async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    await csr.preloadExhibitPortalData(exhibit, cancelled.signal);
    await settle();
    expect(getExhibitPreviews).not.toHaveBeenCalled();
    expect(ownerReads()).toEqual([]);
    await csr.preloadExhibitPortalData(exhibit, new AbortController().signal);
    await settle();
    expect(getExhibitPreviews).toHaveBeenCalledTimes(1);
});

test("cancelling a direct preload prevents late destination and owner fan-out", async () => {
    let resolve: (value: any) => void;
    (getExhibitPreviews as jest.Mock).mockReturnValue(
        new Promise((done) => {
            resolve = done;
        })
    );
    const controller = new AbortController();
    await csr.preloadExhibitPortalData(exhibit, controller.signal);
    await settle();
    controller.abort();
    resolve([portalExhibit]);
    await settle();
    expect(getDestination).not.toHaveBeenCalled();
    expect(ownerReads()).toEqual(["source-owner"]);
});

test("a failed preview batch falls back to the full exhibit", async () => {
    (getExhibitPreviews as jest.Mock).mockRejectedValue(new Error("500"));
    await expect(csr.getPortalPreviewExhibit("portal-target")).resolves.toBe(
        portalExhibit
    );
    expect(getExhibit).toHaveBeenCalledWith("portal-target");
});

test("a loaded full exhibit serves its preview without a request", async () => {
    await csr.getPortalExhibit("portal-target");
    await expect(csr.getPortalPreviewExhibit("portal-target")).resolves.toBe(
        portalExhibit
    );
    expect(getExhibitPreviews).not.toHaveBeenCalled();
});

test("previews asked for together share one request", async () => {
    (getExhibitPreviews as jest.Mock).mockImplementation(async (ids) =>
        ids.map((id) => ({ ...portalExhibit, id }))
    );
    const ids = Array.from({ length: 60 }, (_, i) => `portal-${i}`);
    const previews = await Promise.all(
        ids.map((id) => csr.getPortalPreviewExhibit(id))
    );
    expect(previews.map((it) => it.id)).toEqual(ids);
    // Chunks of PORTAL_PREVIEW_BATCH_SIZE (50) keep the URL short.
    expect(getExhibitPreviews).toHaveBeenCalledTimes(2);
    expect((getExhibitPreviews as jest.Mock).mock.calls[0][0]).toHaveLength(50);
});

test("a missing exhibit has no preview", async () => {
    (getExhibitPreviews as jest.Mock).mockResolvedValue([]);
    await expect(csr.getPortalPreviewExhibit("gone")).resolves.toBeNull();
    expect(getExhibit).not.toHaveBeenCalled();
});

test("aborted deferred consumers do not fetch or poison the shared cache", async () => {
    let reveal: () => void;
    const entry = new Promise<void>((resolve) => {
        reveal = resolve;
    });
    (waitForLobbyDestinationEntry as jest.Mock).mockReturnValue(entry);
    const cancelled = new AbortController();
    const abandoned = csr
        .getPortalExhibit("portal-target", cancelled.signal)
        .catch((error) => error);
    const survivor = csr.getPortalExhibit("portal-target");
    cancelled.abort();
    reveal();
    expect(await abandoned).toMatchObject({ name: "AbortError" });
    expect(await survivor).toBe(portalExhibit);
    expect(getExhibit).toHaveBeenCalledTimes(1);
    expect(await csr.getPortalExhibit("portal-target")).toBe(portalExhibit);
    expect(getExhibit).toHaveBeenCalledTimes(1);
});

test("failed entry does not cache a rejected admission wait", async () => {
    const failure = Object.assign(new Error("Access denied"), {
        name: "AbortError",
    });
    (waitForLobbyDestinationEntry as jest.Mock).mockRejectedValue(failure);
    await expect(csr.getPortalExhibit("portal-target")).rejects.toBe(failure);
    expect(getExhibit).not.toHaveBeenCalled();
    (waitForLobbyDestinationEntry as jest.Mock).mockResolvedValue(undefined);
    await expect(csr.getPortalExhibit("portal-target")).resolves.toBe(
        portalExhibit
    );
    expect(getExhibit).toHaveBeenCalledTimes(1);
});

test("cached metadata remains available without a new entry wait", async () => {
    await csr.getPortalExhibit("portal-target");
    await csr.getPortalDestination("target-room");
    await csr.getPortalOwner("target-owner");
    (waitForLobbyDestinationEntry as jest.Mock).mockImplementation(() => {
        throw new Error("Must not wait for cache");
    });
    await expect(csr.getPortalExhibit("portal-target")).resolves.toBe(
        portalExhibit
    );
    await expect(csr.getPortalDestination("target-room")).resolves.toEqual({
        slug: "target-room",
    });
    await expect(csr.getPortalOwner("target-owner")).resolves.toEqual({
        walletId: "owner",
    });
});
