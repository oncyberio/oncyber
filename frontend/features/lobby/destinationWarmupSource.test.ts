import {
    destinationDataUrl,
    roomCacheKey,
    warmRoomModels,
} from "./destinationWarmupSource";

const ORIGIN = "https://oncyber.io";
const VOID = {
    slug: "void_v2",
    paths: {
        high: "https://cyber.mypinata.cloud/ipfs/QmHigh?filename=void_high.glb",
        mid: "https://cyber.mypinata.cloud/ipfs/QmMid?filename=void_mid.glb",
        low: "https://cyber.mypinata.cloud/ipfs/QmLow?filename=void_low.glb",
    },
};
const props = (dest: any, info: any = {}, extra: any = {}) => ({
    experience: { info: { room: "void_v2", ...info }, ...extra },
    dest,
});

describe("destinationDataUrl", () => {
    it("maps lobby destinations to the page's server data", () => {
        expect(destinationDataUrl("/void", ORIGIN, "b1", "en")).toBe(
            "https://oncyber.io/_next/data/b1/en/void.json"
        );
        expect(
            destinationDataUrl("/spaces/abc/?coords=1", ORIGIN, "b1", "en")
        ).toBe("https://oncyber.io/_next/data/b1/en/spaces/abc.json");
        expect(destinationDataUrl("/void", ORIGIN, "b1")).toBe(
            "https://oncyber.io/_next/data/b1/void.json"
        );
    });

    it("refuses other origins, unsupported paths and a missing build", () => {
        expect(destinationDataUrl("https://evil.test/void", ORIGIN, "b1")).toBe(
            null
        );
        expect(destinationDataUrl("/a/b/c", ORIGIN, "b1")).toBe(null);
        expect(destinationDataUrl("/void", ORIGIN, "")).toBe(null);
    });
});

describe("warmRoomModels", () => {
    it("picks the low file a lobby-prepared frame loads", () => {
        expect(warmRoomModels(props(VOID))).toEqual({
            plain: VOID.paths.low,
            compressed: VOID.paths.low,
        });
    });

    it("tells the compressed variant apart when the room has one", () => {
        const dest = {
            ...VOID,
            paths: { ...VOID.paths, low_compressed: "https://x.test/c.glb" },
        };
        expect(warmRoomModels(props(dest))).toEqual({
            plain: VOID.paths.low,
            compressed: "https://x.test/c.glb",
        });
    });

    it("follows the experience's skin and params like Scene3D", () => {
        const dest = {
            ...VOID,
            skins: { dusk: { paths: { low: "https://x.test/dusk.glb" } } },
        };
        expect(
            warmRoomModels(props(dest, { currentSkin: "dusk" }))?.plain
        ).toBe("https://x.test/dusk.glb");
        const params = { params: { paths: { low: "https://x.test/p.glb" } } };
        expect(warmRoomModels(props(VOID, {}, params))?.plain).toBe(
            "https://x.test/p.glb"
        );
    });

    it("skips rooms Scene3D loads some other way", () => {
        // info.room names another destination: Scene3D fetches it itself.
        expect(warmRoomModels(props(VOID, { room: "other" }))).toBe(null);
        expect(warmRoomModels(props({ ...VOID, isFuture: true }))).toBe(null);
        expect(
            warmRoomModels(
                props({
                    slug: "void_v2",
                    uPath: { fileURL: "https://x/u.glb" },
                })
            )
        ).toBe(null);
        expect(warmRoomModels(null)).toBe(null);
    });

    it("picks the file a direct visit loads, by GPU tier", () => {
        const direct = (gpuTier: any, isMobile = false) =>
            ({ kind: "direct", gpuTier, isMobile } as const);
        // Desktop, not low: mid first, sharpening to high after arrival.
        expect(warmRoomModels(props(VOID), direct("high"))?.plain).toBe(
            VOID.paths.mid
        );
        expect(warmRoomModels(props(VOID), direct("low"))?.plain).toBe(
            VOID.paths.low
        );
        // Phones take the compressed file when the GPU can read it.
        const dest = {
            ...VOID,
            paths: { ...VOID.paths, low_compressed: "https://x.test/c.glb" },
        };
        expect(warmRoomModels(props(dest), direct("low", true))).toEqual({
            plain: VOID.paths.low,
            compressed: "https://x.test/c.glb",
        });
        // Desktops never take it.
        expect(warmRoomModels(props(dest), direct("mid"))).toEqual({
            plain: VOID.paths.mid,
            compressed: VOID.paths.mid,
        });
        // No remembered tier: the page looks it up first, so don't guess.
        expect(warmRoomModels(props(VOID), direct(null))).toBe(null);
    });

    it("uses the loader's cache key", () => {
        expect(roomCacheKey(" http://a.test/r.glb ")).toBe(
            "https://a.test/r.glb"
        );
    });
});
