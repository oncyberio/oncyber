/** @jest-environment jsdom */
import { loadRoomTextureDonor } from "./roomTextureDonor";
import {
    uploadRoomTexture,
    cappedTextureSize,
    estimateStorageBytes,
} from "./progressiveTextureUpload";
import Renderer from "../renderer";
import { markNativeStartup } from "@utils/nativeStartupDiagnostics";
import { captureRoomTextureUpgrade } from "./roomTextureUpgrade";
import { prepareRoomTextureUpgrade } from "./roomTextureUpgradeController";

jest.mock("./roomTextureDonor", () => ({ loadRoomTextureDonor: jest.fn() }));
jest.mock("./progressiveTextureUpload", () => ({
    ...jest.requireActual("./progressiveTextureUpload.pixels"),
    uploadRoomTexture: jest.fn(),
}));
jest.mock("@utils/roomTextureUpgradeTask", () => ({
    ...jest.requireActual("@utils/roomTextureUpgradeTask"),
    createRoomTextureUpgradeScheduler: () => ({
        idle: (run) => {
            const id = setTimeout(run, 32);
            return () => clearTimeout(id);
        },
        frame: (run) => {
            const id = setTimeout(run, 16);
            return () => clearTimeout(id);
        },
        stats: {},
        observe: jest.fn(),
    }),
}));
jest.mock("../renderer", () => ({
    __esModule: true,
    default: { initTexture: jest.fn(), domElement: new EventTarget() },
}));
jest.mock("../constants", () => ({
    EDIT_MODE: false,
    UPLOADER_MODE: false,
    GPU_TIER: { path: "high" },
    IS_MOBILE: false,
}));
jest.mock("./roomTextureUpgrade", () => ({
    captureRoomTextureUpgrade: jest.fn(),
}));
jest.mock("@utils/nativeStartupDiagnostics", () => ({
    markNativeStartup: jest.fn(),
}));

const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
};
const tick = async (ms) => {
    jest.advanceTimersByTime(ms);
    await flush();
};
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
function plan(count = 2, total = 2, skipped = [], alreadyFull = 0) {
    let applied = 0;
    const textures = Array.from({ length: count }, (_, id) => ({
        id,
        isTexture: true,
        image: { width: 512, height: 512 },
        userData: { roomTextureUpgradeLowSize: [128, 128] },
    }));
    return {
        textures,
        get stats() {
            return { total, matched: count, applied, alreadyFull };
        },
        steps: (upload) =>
            textures.map((texture, index) => async () => {
                if (skipped.includes(index)) return;
                const uploaded = await upload(texture);
                if (uploaded !== null) applied++;
            }),
        dispose: jest.fn(),
    };
}
let owner, upgrade, previousEnvironment;
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    owner = {
        bind: jest.fn(),
        plan: jest.fn((donor) => donor.plan),
        dispose: jest.fn(),
        restoreLowTextureBindings: jest.fn(),
    };
    uploadRoomTexture.mockImplementation(async (texture, options) => {
        const size = cappedTextureSize(
            texture.image.width,
            texture.image.height,
            options.maxDimension
        );
        return {
            ...texture,
            image: size,
            dispose: jest.fn(),
            userData: {
                progressiveRoomTexture: {
                    ...size,
                    bytes: estimateStorageBytes(size.width, size.height),
                    capped:
                        size.width < texture.image.width ||
                        size.height < texture.image.height,
                },
            },
        };
    });
    captureRoomTextureUpgrade.mockReturnValue(owner);
    upgrade = prepareRoomTextureUpgrade(
        {
            preferLowResolution: true,
            roomParameters: { paths: { low: "/low.glb", high: "/high.glb" } },
            exhibit: { info: {} },
        },
        { url: "/low.glb", quality: "low", source: "room", cycle: "day" },
        {}
    );
});
afterEach(async () => {
    upgrade.dispose();
    await flush();
    jest.useRealTimers();
    process.env.NODE_ENV = previousEnvironment;
});

test("only starts after arrival, binds live scene roots, and never repeats a successful upgrade", async () => {
    const donor = { plan: plan() },
        scene = {},
        extra = {};
    loadRoomTextureDonor.mockResolvedValue(donor);
    upgrade.attach(scene, [extra]);
    expect(scene.roomTextureUpgrade).toBe(upgrade);
    await tick(100);
    expect(loadRoomTextureDonor).not.toHaveBeenCalled();
    upgrade.start();
    upgrade.start();
    await tick(32);
    expect(loadRoomTextureDonor).toHaveBeenCalledTimes(1);
    expect(owner.bind).toHaveBeenCalledWith([scene, extra]);
    expect(markNativeStartup).toHaveBeenCalledWith(
        "native-room-textures-start"
    );
    expect(markNativeStartup).not.toHaveBeenCalledWith(
        "native-room-textures-ready"
    );
    await tick(16);
    await tick(16);
    await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(2);
    expect(donor.plan.dispose).toHaveBeenCalledTimes(1);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("complete");
    expect(markNativeStartup).toHaveBeenCalledWith(
        "native-room-textures-ready"
    );
    upgrade.stop();
    upgrade.start();
    await tick(100);
    expect(loadRoomTextureDonor).toHaveBeenCalledTimes(1);
});

test("stop before the idle slot cancels queued work and start creates a fresh attempt", async () => {
    loadRoomTextureDonor.mockResolvedValue({ plan: plan(0, 0) });
    upgrade.start();
    upgrade.stop();
    await tick(100);
    expect(loadRoomTextureDonor).not.toHaveBeenCalled();
    upgrade.start();
    await tick(32);
    await tick(16);
    expect(loadRoomTextureDonor).toHaveBeenCalledTimes(1);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("no-compatible-textures");
    expect(markNativeStartup).not.toHaveBeenCalledWith(
        "native-room-textures-ready"
    );
});

test("a cancelled fetch aborts but its late donor is released without affecting a newer successful attempt", async () => {
    const old = deferred(),
        first = { plan: plan() },
        next = { plan: plan() };
    loadRoomTextureDonor
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(next);
    upgrade.start();
    await tick(32);
    const firstSignal = loadRoomTextureDonor.mock.calls[0][1].signal;
    upgrade.stop();
    expect(firstSignal.aborted).toBe(true);
    upgrade.start();
    await tick(32);
    await tick(16);
    await tick(16);
    await tick(16);
    old.resolve(first);
    await flush();
    expect(first.plan.dispose).toHaveBeenCalledTimes(1);
    expect(next.plan.dispose).toHaveBeenCalledTimes(1);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(2);
    expect(owner.bind).toHaveBeenCalledTimes(1);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("complete");
    expect(
        markNativeStartup.mock.calls.filter(
            ([stage]) => stage === "native-room-textures-ready"
        )
    ).toHaveLength(1);
});

test("resume preserves successful installs and reports only actual installs across attempts", async () => {
    const first = { plan: plan() },
        next = { plan: plan(1, 2) };
    loadRoomTextureDonor
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(next);
    upgrade.start();
    await tick(32);
    await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(1);
    upgrade.stop();
    await flush();
    expect(first.plan.dispose).toHaveBeenCalledTimes(1);
    upgrade.start();
    await tick(32);
    await tick(16);
    await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(2);
    expect(
        document.documentElement.getAttribute(
            "data-native-room-texture-applied"
        )
    ).toBe("2");
    expect(
        document.documentElement.getAttribute("data-native-room-texture-total")
    ).toBe("2");
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("complete");
});

test("skipped or incompatible bindings do not falsely report a fully upgraded room", async () => {
    loadRoomTextureDonor.mockResolvedValue({ plan: plan(2, 3, [1]) });
    upgrade.start();
    await tick(32);
    await tick(16);
    await tick(16);
    await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(1);
    expect(
        document.documentElement.getAttribute(
            "data-native-room-texture-applied"
        )
    ).toBe("1");
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("partial");
    expect(
        document.documentElement.getAttribute(
            "data-native-room-texture-quality"
        )
    ).toBe("mixed");
});

test("retry after a failed fetch leaves the owner alive and can finish", async () => {
    loadRoomTextureDonor
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ plan: plan(1, 1) });
    upgrade.start();
    await tick(32);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("failed");
    expect(owner.dispose).not.toHaveBeenCalled();
    upgrade.start();
    await tick(32);
    await tick(16);
    await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(1);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("complete");
});

test("disposal is terminal even when an old decoder returns late", async () => {
    const pending = deferred(),
        donor = { plan: plan() };
    loadRoomTextureDonor.mockReturnValue(pending.promise);
    upgrade.start();
    await tick(32);
    upgrade.dispose();
    upgrade.dispose();
    upgrade.start();
    upgrade.attach({});
    pending.resolve(donor);
    await flush();
    await tick(100);
    expect(owner.dispose).toHaveBeenCalledTimes(1);
    expect(donor.plan.dispose).toHaveBeenCalledTimes(1);
    expect(owner.bind).not.toHaveBeenCalled();
    expect(uploadRoomTexture).not.toHaveBeenCalled();
    expect(loadRoomTextureDonor).toHaveBeenCalledTimes(1);
    expect(markNativeStartup).not.toHaveBeenCalledWith(
        "native-room-textures-ready"
    );
});

test("same-resolution surfaces count as already full without redundant GPU uploads", async () => {
    loadRoomTextureDonor.mockResolvedValue({ plan: plan(1, 3, [], 2) });
    upgrade.start();
    await tick(32);
    await tick(16);
    await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(1);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("complete");
    expect(
        document.documentElement.getAttribute(
            "data-native-room-texture-quality"
        )
    ).toBe("high");
    expect(
        document.documentElement.getAttribute(
            "data-native-room-texture-applied"
        )
    ).toBe("1");
    expect(
        document.documentElement.getAttribute(
            "data-native-room-texture-already-full"
        )
    ).toBe("2");
});

test("bounds peak extra GPU memory and keeps low after the refinement budget is exhausted", async () => {
    const donor = plan(20, 20);
    for (const texture of donor.textures) {
        texture.image = { width: 4096, height: 4096 };
        texture.userData.roomTextureUpgradeLowSize = [1024, 1024];
    }
    loadRoomTextureDonor.mockResolvedValue({ plan: donor });
    upgrade.start();
    await tick(32);
    for (let i = 0; i < 21; i++) await tick(16);
    expect(uploadRoomTexture).toHaveBeenCalledTimes(6);
    expect(
        uploadRoomTexture.mock.calls.every(
            ([, opts]) => opts.maxDimension <= 2048
        )
    ).toBe(true);
    const stats = JSON.parse(
        document.documentElement.getAttribute("data-native-room-texture-upload")
    );
    expect(stats.extraBytes).toBeLessThan(128 * 1024 * 1024);
    expect(stats.keptLow).toBe(14);
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("partial");
});

test("context loss restores retained low maps and never restarts GPU refinement for that scene", async () => {
    loadRoomTextureDonor.mockResolvedValue({ plan: plan() });
    upgrade.start();
    await tick(32);
    Renderer.domElement.dispatchEvent(new Event("webglcontextlost"));
    expect(owner.restoreLowTextureBindings).toHaveBeenCalledTimes(1);
    upgrade.start();
    await tick(100);
    expect(loadRoomTextureDonor).toHaveBeenCalledTimes(1);
    expect(uploadRoomTexture).not.toHaveBeenCalled();
    expect(
        document.documentElement.getAttribute("data-native-room-texture-state")
    ).toBe("kept-low-after-context-loss");
});

describe("a direct visit that started at mid", () => {
    const direct = (initial) =>
        prepareRoomTextureUpgrade(
            {
                preferLowResolution: false,
                roomParameters: {
                    paths: { mid: "/mid.glb", high: "/high.glb" },
                },
                exhibit: { info: {} },
            },
            initial,
            {}
        );

    test("prepares nothing when the room did not start below high", () => {
        expect(
            direct({
                url: "/high.glb",
                quality: "high",
                source: "room",
                cycle: "day",
            })
        ).toBeNull();
    });

    test("sharpens to the high file only after allow(), at full size", async () => {
        const sharpen = direct({
            url: "/mid.glb",
            quality: "mid",
            source: "room",
            cycle: "day",
            refine: true,
        });
        try {
            expect(sharpen.sharpening).toBe(true);
            const donor = plan(3, 3);
            for (const texture of donor.textures) {
                texture.image = { width: 4096, height: 4096 };
                texture.userData.roomTextureUpgradeLowSize = [2048, 2048];
            }
            loadRoomTextureDonor.mockResolvedValue({ plan: donor });
            sharpen.attach({});
            sharpen.start();
            await tick(100);
            expect(loadRoomTextureDonor).not.toHaveBeenCalled();
            sharpen.allow();
            sharpen.start();
            await tick(32);
            expect(loadRoomTextureDonor).toHaveBeenCalledWith(
                "/high.glb",
                expect.anything()
            );
            for (let i = 0; i < 4; i++) await tick(16);
            // Three 4096 px maps (about 85 MB each with mipmaps) fit the
            // 1024 MB budget of a high-tier GPU; the lobby's cap is 2048 px.
            expect(uploadRoomTexture).toHaveBeenCalledTimes(3);
            expect(
                uploadRoomTexture.mock.calls.every(
                    ([, opts]) => opts.maxDimension === 4096
                )
            ).toBe(true);
            expect(
                document.documentElement.getAttribute(
                    "data-native-room-texture-state"
                )
            ).toBe("complete");
        } finally {
            sharpen.dispose();
        }
    });
});
