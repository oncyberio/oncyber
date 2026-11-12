import PortalFactory from "./index";
import { Portal } from "./portal";
import {
    getPortalDestination,
    getPortalPreviewExhibit,
    getPortalOwner,
} from "@utils/csr";

let mockCurrentSpace;
jest.mock("three", () => ({ PlaneGeometry: class {} }));
jest.mock("./portalcontainer", () => ({ PortalContainer: class {} }));
jest.mock("./portal", () => ({ Portal: jest.fn() }));
jest.mock("./portalplaceholder", () => ({}));
jest.mock("@utils/js", () => ({ noop: () => {} }));
jest.mock("../../utils/spaceutils", () => ({ artworkDepth: () => 1 }));
jest.mock("./previewmesh", () => ({}));
jest.mock("@utils/csr", () => ({
    getPortalDestination: jest.fn(),
    getPortalPreviewExhibit: jest.fn(),
    getPortalOwner: jest.fn(),
}));
jest.mock("../space/space", () => ({ SPACE_EVENTS: {} }));
jest.mock("@utils/metadata/formatExhibit", () => ({
    formatExhibit: (value) => value,
}));
jest.mock("../../constants", () => ({
    get CURRENT_SPACE() {
        return mockCurrentSpace;
    },
    USER_HEIGHT: 1.8,
}));
jest.mock("../../utils/camera", () => ({}));

const exhibit = { id: "target", owner: "owner", info: { room: "room" } };
const room = { slug: "room" };
const user = { walletId: "owner" };
beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentSpace = null;
    getPortalPreviewExhibit.mockResolvedValue(exhibit);
    getPortalDestination.mockResolvedValue(room);
    getPortalOwner.mockResolvedValue(user);
});

test("metadata requests carry the portal lifetime through each remote lookup", async () => {
    const signal = new AbortController().signal;
    await expect(
        PortalFactory.loadPortalData("target", {}, signal)
    ).resolves.toEqual({ exhibit, roomParameters: room, user });
    expect(getPortalPreviewExhibit).toHaveBeenCalledWith("target", signal);
    expect(getPortalDestination).toHaveBeenCalledWith("room", signal);
    expect(getPortalOwner).toHaveBeenCalledWith("owner", signal);
});

test("cancelling during exhibit lookup prevents destination and owner fan-out", async () => {
    let resolve;
    getPortalPreviewExhibit.mockReturnValue(
        new Promise((done) => {
            resolve = done;
        })
    );
    const controller = new AbortController();
    const result = PortalFactory.loadPortalData(
        "target",
        {},
        controller.signal
    ).catch((error) => error);
    controller.abort();
    resolve(exhibit);
    expect(await result).toMatchObject({
        message: "ABORT_IF_SPACE_WAS_DISPOSED",
    });
    expect(getPortalDestination).not.toHaveBeenCalled();
    expect(getPortalOwner).not.toHaveBeenCalled();
});

test("an already cancelled portal issues no metadata requests", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
        PortalFactory.loadPortalData("target", {}, controller.signal)
    ).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
    expect(getPortalPreviewExhibit).not.toHaveBeenCalled();
});

test("in-space portal metadata is available without any remote lookup", async () => {
    mockCurrentSpace = {
        exhibit: { ...exhibit, ownerData: user },
        roomParameters: room,
    };
    await expect(PortalFactory.loadPortalData("target")).resolves.toEqual({
        exhibit: mockCurrentSpace.exhibit,
        roomParameters: room,
        user,
    });
    expect(getPortalPreviewExhibit).not.toHaveBeenCalled();
    expect(getPortalDestination).not.toHaveBeenCalled();
    expect(getPortalOwner).not.toHaveBeenCalled();
});

test("cancelling portal initialization disposes it instead of attaching it after scene teardown", async () => {
    const controller = new AbortController();
    let resolve;
    const portal = {
        opts: { exhibitId: "target" },
        initState: () =>
            new Promise((done) => {
                resolve = done;
            }),
        dispose: jest.fn(),
    };
    Portal.mockImplementation(() => portal);
    const result = PortalFactory.getPortal({
        exhibitId: "target",
        exhibit: {},
        placeholderData: { meshes: { previewMesh: {} } },
        abort: controller.signal,
    });
    controller.abort();
    resolve();
    expect(await result).toBeNull();
    expect(portal.dispose).toHaveBeenCalledTimes(1);
});

describe("building many portals", () => {
    const { forEachInSlices } = jest.requireActual("./index");
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

    test("each slice runs in its own task", async () => {
        const seen = [];
        const done = forEachInSlices([1, 2, 3, 4, 5], 2, undefined, (n) => seen.push(n));
        await Promise.resolve();
        await Promise.resolve();
        expect(seen).toEqual([1, 2]);
        await done;
        await Promise.resolve();
        expect(seen).toEqual([1, 2, 3, 4, 5]);
    });

    test("a disposed world stops building", async () => {
        const controller = new AbortController();
        const seen = [];
        const done = forEachInSlices([1, 2, 3, 4], 2, controller.signal, (n) => seen.push(n));
        controller.abort();
        await done;
        await tick();
        expect(seen).toEqual([1, 2]);
    });

    test("one failing portal does not stop the others", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        const seen = [];
        await forEachInSlices([1, 2, 3], 2, undefined, (n) => {
            if (n === 1) throw new Error("bad portal");
            seen.push(n);
        });
        await tick();
        expect(seen).toEqual([2, 3]);
    });
});
