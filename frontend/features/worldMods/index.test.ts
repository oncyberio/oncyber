/** @jest-environment node */
import { applyWorldMod, applyWorldScene, hasWorldMod } from "./index";
import { STARRY_NIGHT_STROKES } from "./worlds/thestarrynight_skydome/strokeFile";

beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("hasWorldMod", () => {
    test("knows the Starry Night dome, whatever the case", () => {
        expect(hasWorldMod("thestarrynight_skydome")).toBe(true);
        expect(hasWorldMod("TheStarryNight_Skydome")).toBe(true);
        expect(hasWorldMod("another-space")).toBe(false);
        expect(hasWorldMod(undefined)).toBe(false);
    });
});

describe("applyWorldMod", () => {
    const context = { background: null, mobile: true };

    test("runs the world's own hook with its slug in lower case", async () => {
        const onBackground = jest.fn();
        await applyWorldMod("My_World", context, {
            my_world: async () => ({ default: { onBackground } }),
        });
        expect(onBackground).toHaveBeenCalledWith({
            ...context,
            slug: "my_world",
        });
    });

    test("does nothing for worlds without a mod", async () => {
        const load = jest.fn();
        await applyWorldMod("elsewhere", context, { my_world: load });
        await applyWorldMod(undefined, context, { my_world: load });
        expect(load).not.toHaveBeenCalled();
    });

    test("never rejects when a mod fails to load or run", async () => {
        await expect(
            applyWorldMod("a", context, {
                a: () => Promise.reject(new Error("chunk failed")),
            })
        ).resolves.toBeUndefined();
        await expect(
            applyWorldMod("b", context, {
                b: async () => ({
                    default: {
                        onBackground: () => {
                            throw new Error("boom");
                        },
                    },
                }),
            })
        ).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledTimes(2);
    });

    test("a mod with no hook for the sky is left alone", async () => {
        await expect(
            applyWorldMod("c", context, {
                c: async () => ({ default: { onScene: jest.fn() } }),
            })
        ).resolves.toBeUndefined();
        expect(console.warn).not.toHaveBeenCalled();
    });

    test("the Starry Night stroke file is served from its world's folder", () => {
        expect(STARRY_NIGHT_STROKES.url).toMatch(
            /^\/world-mods\/thestarrynight_skydome\/starry-night-sky\.[0-9a-f]{12}\.bin$/
        );
    });
});

describe("applyWorldScene", () => {
    const context = {
        scene: null,
        colliders: [],
        portalIds: [],
        mobile: false,
        onDispose: () => {},
    };

    test("runs the world's scene hook, and only that one", async () => {
        const onScene = jest.fn();
        const onBackground = jest.fn();
        await applyWorldScene("My_World", context, {
            my_world: async () => ({ default: { onScene, onBackground } }),
        });
        expect(onScene).toHaveBeenCalledWith({ ...context, slug: "my_world" });
        expect(onBackground).not.toHaveBeenCalled();
    });

    test("waits for the hook, so the world is changed before it is used", async () => {
        const order: string[] = [];
        await applyWorldScene("a", context, {
            a: async () => ({
                default: {
                    onScene: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 5));
                        order.push("mod");
                    },
                },
            }),
        });
        order.push("loader");
        expect(order).toEqual(["mod", "loader"]);
    });

    test("never rejects when a mod fails", async () => {
        await expect(
            applyWorldScene("a", context, {
                a: async () => ({
                    default: {
                        onScene: () => {
                            throw new Error("boom");
                        },
                    },
                }),
            })
        ).resolves.toBeUndefined();
        await applyWorldScene("elsewhere", context, {});
        expect(console.warn).toHaveBeenCalledTimes(1);
    });
});
