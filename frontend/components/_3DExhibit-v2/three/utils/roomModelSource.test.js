/** @jest-environment jsdom */
import {
    selectRoomModelSource,
    publishRoomModelSource,
    selectRoomTextureUpgradeSource,
    classicRoomModelOptions,
    roomModelFallbacks,
} from "./roomModelSource";
import { loadRoomModel } from "./loadRoomModel";

const room = {
    paths: {
        low: "low.glb",
        mid: "mid.glb",
        high: "high.glb",
        low_compressed: "low-ktx.glb",
    },
};
test("lobby preparation uses the authored low texture variant on desktop", () => {
    expect(
        selectRoomModelSource(room, {
            preferLowResolution: true,
            quality: "high",
        })
    ).toMatchObject({ url: "low.glb", quality: "low" });
    expect(
        selectRoomModelSource(room, {
            preferLowResolution: true,
            compressedSupport: true,
        })
    ).toMatchObject({ url: "low-ktx.glb", quality: "low_compressed" });
    expect(selectRoomModelSource(room)).toMatchObject({
        url: "high.glb",
        quality: "high",
    });
});
test("keeps normal quality defaults and mobile compressed support", () => {
    expect(selectRoomModelSource(room, { quality: "mid" }).url).toBe(
        "high.glb"
    );
    expect(selectRoomModelSource(room, { quality: "low" }).url).toBe("low.glb");
    expect(
        selectRoomModelSource(room, { isMobile: true, compressedSupport: true })
            .url
    ).toBe("low-ktx.glb");
    expect(selectRoomModelSource(room, { compressedSupport: true }).url).toBe(
        "high.glb"
    );
});
test("missing low variants safely use available mid, high, legacy or upload files", () => {
    const opts = { preferLowResolution: true };
    expect(
        selectRoomModelSource({ paths: { mid: "mid", high: "high" } }, opts).url
    ).toBe("mid");
    expect(selectRoomModelSource({ paths: { high: "high" } }, opts).url).toBe(
        "high"
    );
    expect(
        selectRoomModelSource(
            { path_low: "legacy-low", paths: { high: "high" } },
            opts
        ).url
    ).toBe("legacy-low");
    expect(selectRoomModelSource({ path: "legacy-high" }, opts).url).toBe(
        "legacy-high"
    );
    expect(
        selectRoomModelSource({ uPath: { fileURL: "blob:upload" } }, opts)
    ).toMatchObject({
        url: "blob:upload",
        source: "upload",
        quality: "original",
    });
    expect(selectRoomModelSource({})).toMatchObject({ url: undefined });
});
test("null variant metadata retains legacy low path fallback", () => {
    expect(
        selectRoomModelSource(
            { path_low: "legacy-low", paths: { low: null, high: "high" } },
            { preferLowResolution: true }
        ).url
    ).toBe("legacy-low");
});
test("low resolution preserves the authored skin and its background", () => {
    const r = {
        ...room,
        skins: { gold: { paths: { high: "gold-high" }, background: "#ab8" } },
    };
    expect(
        selectRoomModelSource(r, { skin: "gold", preferLowResolution: true })
    ).toMatchObject({ url: "gold-high", source: "skin", background: "#ab8" });
    r.skins.gold.paths.low = "gold-low";
    expect(
        selectRoomModelSource(r, { skin: "gold", preferLowResolution: true })
            .url
    ).toBe("gold-low");
    expect(
        selectRoomModelSource(r, { skin: "unknown", preferLowResolution: true })
            .url
    ).toBe("low.glb");
});
test("night cycles preserve night appearance before falling back to day variants", () => {
    const r = {
        type: "cycle",
        paths: { ...room.paths, night_high: "night-high" },
    };
    expect(
        selectRoomModelSource(r, { preferLowResolution: true, hour: 23 })
    ).toMatchObject({ url: "night-high", quality: "high", cycle: "night" });
    r.paths.night_low = "night-low";
    expect(
        selectRoomModelSource(r, { preferLowResolution: true, hour: 23 }).url
    ).toBe("night-low");
    expect(
        selectRoomModelSource(r, { preferLowResolution: true, hour: 12 })
    ).toMatchObject({ url: "low.glb", cycle: "day" });
    expect(
        selectRoomModelSource(
            { ...room, type: "cycle" },
            { preferLowResolution: true, hour: 23 }
        ).url
    ).toBe("low.glb");
});
test("source selection keeps signed URLs byte-for-byte", () => {
    const signed =
        "https://assets.test/room.glb?version=2&signature=abc%2Fdef&filename=room%20low.glb";
    expect(
        selectRoomModelSource(
            { paths: { low: signed } },
            { preferLowResolution: true }
        ).url
    ).toBe(signed);
});
test("development diagnostics never include the full URL or signed query", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
        publishRoomModelSource({
            quality: "low",
            source: "room",
            cycle: "day",
            url: "https://assets.test/CID?filename=room-low.glb&token=private",
        });
        expect(
            document.documentElement.getAttribute("data-native-model-quality")
        ).toBe("low");
        expect(
            document.documentElement.getAttribute("data-native-model-file")
        ).toBe("room-low.glb");
        expect(document.documentElement.outerHTML).not.toContain("private");
        expect(document.documentElement.outerHTML).not.toContain("assets.test");
    } finally {
        process.env.NODE_ENV = previous;
    }
});

test("upgrades desktop arrival textures, with mid as the constrained-device ceiling", () => {
    const initial = selectRoomModelSource(room, { preferLowResolution: true });
    expect(selectRoomTextureUpgradeSource(room, initial)).toMatchObject({
        url: "high.glb",
        quality: "high",
    });
    expect(
        selectRoomTextureUpgradeSource(room, initial, { isMobile: true })
    ).toMatchObject({ url: "mid.glb", quality: "mid" });
    expect(
        selectRoomTextureUpgradeSource(room, initial, { quality: "low" })
    ).toMatchObject({ url: "mid.glb" });
    expect(
        selectRoomTextureUpgradeSource(
            { paths: { high: "high.glb" } },
            initial,
            { isMobile: true }
        )
    ).toBeNull();
});
test("upgrade never changes the selected skin or time of day", () => {
    const styled = {
        ...room,
        type: "cycle",
        skins: {
            gold: {
                paths: {
                    night_low: "gold-night-low",
                    night_high: "gold-night-high",
                    high: "gold-day-high",
                },
            },
        },
    };
    const initial = selectRoomModelSource(styled, {
        preferLowResolution: true,
        skin: "gold",
        hour: 23,
    });
    expect(
        selectRoomTextureUpgradeSource(styled, initial, { skin: "gold" })
    ).toMatchObject({ url: "gold-night-high", cycle: "night", source: "skin" });
    delete styled.skins.gold.paths.night_high;
    expect(
        selectRoomTextureUpgradeSource(styled, initial, { skin: "gold" })
    ).toBeNull();
    expect(
        selectRoomTextureUpgradeSource(styled, initial, { skin: "missing" })
    ).toBeNull();
});
test("does not download originals, the same URL or an equal/lower quality export", () => {
    expect(
        selectRoomTextureUpgradeSource(room, {
            source: "upload",
            quality: "original",
        })
    ).toBeNull();
    expect(
        selectRoomTextureUpgradeSource(room, selectRoomModelSource(room))
    ).toBeNull();
    const initial = {
        url: "low.glb",
        quality: "low",
        source: "room",
        cycle: "day",
    };
    expect(
        selectRoomTextureUpgradeSource(
            { paths: { low: "low.glb", high: "low.glb" } },
            initial
        )
    ).toBeNull();
    expect(
        selectRoomTextureUpgradeSource({ paths: { low: "low.glb" } }, initial)
    ).toBeNull();
    expect(
        selectRoomTextureUpgradeSource({ path: "legacy-high" }, initial)
    ).toMatchObject({ url: "legacy-high" });
});

describe("direct visits start at mid on capable desktops", () => {
    const classic = (env) =>
        selectRoomModelSource(room, classicRoomModelOptions(env));

    test.each(["high", "mid"])(
        "desktop with a %s GPU: mid, then sharpen",
        (gpuTier) => {
            expect(classic({ gpuTier })).toEqual({
                url: "mid.glb",
                quality: "mid",
                source: "room",
                cycle: "day",
                refine: true,
            });
            expect(
                selectRoomTextureUpgradeSource(room, classic({ gpuTier }), {
                    quality: gpuTier,
                })
            ).toMatchObject({ url: "high.glb", quality: "high" });
        }
    );

    test("phones, low GPUs, lobby entry and the editor keep their order", () => {
        expect(
            classic({ gpuTier: "low", isMobile: true, compressedSupport: true })
        ).toMatchObject({ url: "low-ktx.glb" });
        expect(classic({ gpuTier: "low", isMobile: true })).toMatchObject({
            url: "low.glb",
        });
        expect(classic({ gpuTier: "low" })).toMatchObject({ url: "low.glb" });
        expect(
            classic({ gpuTier: "high", preferLowResolution: true })
        ).toMatchObject({ url: "low.glb" });
        const editing = classic({ gpuTier: "high", editing: true });
        expect(editing).toMatchObject({ url: "high.glb" });
        expect(editing.refine).toBeUndefined();
    });

    test("a room without a mid file arrives at high, with nothing to sharpen", () => {
        const source = selectRoomModelSource(
            { paths: { low: "low.glb", high: "high.glb" } },
            classicRoomModelOptions({ gpuTier: "high" })
        );
        expect(source).toMatchObject({ url: "high.glb", quality: "high" });
        expect(source.refine).toBeUndefined();
    });

    test("a night cycle starts at its night mid file", () => {
        const source = selectRoomModelSource(
            {
                type: "cycle",
                paths: {
                    ...room.paths,
                    night_mid: "n-mid",
                    night_high: "n-high",
                },
            },
            { ...classicRoomModelOptions({ gpuTier: "high" }), hour: 23 }
        );
        expect(source).toMatchObject({
            url: "n-mid",
            cycle: "night",
            refine: true,
        });
    });
});

test("a room that cannot read its chosen file falls back through its other files", async () => {
    const options = classicRoomModelOptions({ gpuTier: "high" });
    const selected = selectRoomModelSource(room, options);
    expect(selected.url).toBe("mid.glb");
    expect(
        roomModelFallbacks(room, options, selected).map((s) => s.url)
    ).toEqual(["high.glb", "low.glb"]);
    const lobby = classicRoomModelOptions({
        preferLowResolution: true,
        compressedSupport: true,
    });
    expect(
        roomModelFallbacks(room, lobby, selectRoomModelSource(room, lobby)).map(
            (s) => s.url
        )
    ).toEqual(["low.glb", "mid.glb", "high.glb"]);
    // Legacy single-file rooms and uploads have nothing else to try.
    expect(
        roomModelFallbacks({ path: "a.glb" }, options, { url: "a.glb" })
    ).toEqual([]);
    expect(
        roomModelFallbacks({ uPath: { fileURL: "u.glb" } }, options, {
            url: "u.glb",
        })
    ).toEqual([]);

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const load = jest.fn(async (url) => {
        if (url === "mid.glb") throw new Error("Invalid typed array length: 4");
        return url;
    });
    await expect(
        loadRoomModel(
            load,
            selected,
            roomModelFallbacks(room, options, selected)
        )
    ).resolves.toMatchObject({
        result: "high.glb",
        source: { url: "high.glb", quality: "high" },
    });
    // Every file failing reports the first error; leaving the space stops at once.
    const broken = jest.fn(async (url) => {
        throw new Error(`broken ${url}`);
    });
    await expect(
        loadRoomModel(broken, selected, [{ url: "high.glb" }])
    ).rejects.toThrow("broken mid.glb");
    const aborted = jest.fn(async () => {
        throw new Error("ABORT_IF_SPACE_WAS_DISPOSED");
    });
    await expect(
        loadRoomModel(aborted, selected, [{ url: "high.glb" }])
    ).rejects.toThrow("ABORT_IF_SPACE_WAS_DISPOSED");
    expect(aborted).toHaveBeenCalledTimes(1);
    warn.mockRestore();
});
