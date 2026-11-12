import { Texture, TextureLoader } from "three";
import { CardPool } from "./pool";
import { createGridLayout, cylinderMetrics } from "./layout";
import { BUILD_CARDS } from "../buildOptions";
import { fallbackCover } from "../coverSources";

jest.mock("./createCardMaterial", () => ({
    createCardMaterial: () => {
        const { ShaderMaterial, Vector2 } = require("three");
        return new ShaderMaterial({
            uniforms: {
                ready: { value: 0 },
                map: { value: null },
                imageAspect: { value: 1 },
                center: { value: new Vector2() },
                cardSize: { value: new Vector2() },
                opacity: { value: 1 },
                radius: { value: 1 },
                cornerRadius: { value: 0 },
                hover: { value: 0 },
            },
        });
    },
    configureCardTexture: jest.fn(),
}));
let success: (texture: Texture) => void;
let failure: () => void;
beforeEach(() => {
    jest.spyOn(TextureLoader.prototype, "load").mockImplementation(
        (url, onLoad, _, onError) => {
            success = onLoad;
            failure = onError as any;
            return new Texture();
        }
    );
});
afterEach(() => jest.restoreAllMocks());
it("keeps loading until all overlapping preview requests settle, including failures", async () => {
    const busy = jest.fn();
    const pool = new CardPool(jest.fn(), busy);
    const first = (pool as any).loadTexture("first");
    const firstSuccess = success;
    const second = (pool as any).loadTexture("second");
    firstSuccess(new Texture());
    await first;
    expect(busy).toHaveBeenLastCalledWith(true);
    failure();
    await second;
    expect(busy).toHaveBeenLastCalledWith(false);
    pool.dispose();
});
it("clears loading on disposal and cannot restart from a late image callback", async () => {
    const busy = jest.fn();
    const pool = new CardPool(jest.fn(), busy);
    const pending = (pool as any).loadTexture("late");
    pool.dispose();
    expect(busy).toHaveBeenLastCalledWith(false);
    const calls = busy.mock.calls.length;
    const texture = new Texture();
    const dispose = jest.spyOn(texture, "dispose");
    success(texture);
    expect(await pending).toBeNull();
    expect(dispose).toHaveBeenCalled();
    expect(busy).toHaveBeenCalledTimes(calls);
});

function card(id: string, imageUrls = [`/${id}.jpg`]) {
    return { ...BUILD_CARDS[0], id, imageUrls };
}
function draw(pool: CardPool, cards: ReturnType<typeof card>[]) {
    pool.update(
        cards,
        createGridLayout(cards).cells,
        cylinderMetrics(1200, 500, 2, 2),
        0,
        ""
    );
}
function texture() {
    return new Texture({ width: 1200, height: 800 } as any);
}
function firstUniforms(pool: CardPool) {
    return (pool.group.children[0] as any).material.uniforms;
}
it("keeps loaded covers ready across filtering and binds cached covers synchronously when slots are reused", async () => {
    const pool = new CardPool(jest.fn());
    draw(pool, [card("first")]);
    const cover = texture();
    success(cover);
    await Promise.resolve();
    expect(firstUniforms(pool).ready.value).toBe(1);
    draw(pool, [card("first")]);
    expect(firstUniforms(pool).map.value).toBe(cover);
    draw(pool, [card("reused", ["/first.jpg"])]);
    // Check before any promise or animation frame can settle.
    expect(firstUniforms(pool).ready.value).toBe(1);
    expect(firstUniforms(pool).map.value).toBe(cover);
    expect(TextureLoader.prototype.load).toHaveBeenCalledTimes(1);
    pool.dispose();
});
it("keeps a world's current cover visible while its replacement loads", async () => {
    const pool = new CardPool(jest.fn());
    draw(pool, [card("room")]);
    const original = texture();
    success(original);
    await Promise.resolve();
    draw(pool, [card("room", ["/new-cover.jpg"])]);
    expect(firstUniforms(pool).ready.value).toBe(1);
    expect(firstUniforms(pool).map.value).toBe(original);
    const replacement = texture();
    success(replacement);
    await Promise.resolve();
    expect(firstUniforms(pool).map.value).toBe(replacement);
    pool.dispose();
});
it("cannot flash a stale search result into a slot reassigned to another world", async () => {
    const pool = new CardPool(jest.fn());
    draw(pool, [card("first")]);
    const firstLoaded = success;
    draw(pool, [card("second")]);
    firstLoaded(texture());
    await Promise.resolve();
    expect(firstUniforms(pool).ready.value).toBe(0);
    const second = texture();
    success(second);
    await Promise.resolve();
    expect(firstUniforms(pool).map.value).toBe(second);
    pool.dispose();
});
it("never falls back to a 360 capture when ordinary covers fail", async () => {
    const pool = new CardPool(jest.fn());
    draw(pool, [
        {
            ...card("room"),
            panoramaUrl: "/360.jpg",
            panoramaUrlMobile: "/360-mobile.jpg",
        } as any,
    ]);
    failure();
    await Promise.resolve();
    expect(TextureLoader.prototype.load).toHaveBeenCalledTimes(2);
    expect((TextureLoader.prototype.load as jest.Mock).mock.calls[1][0]).toBe(
        fallbackCover("room")
    );
    const fallback = texture();
    success(fallback);
    await Promise.resolve();
    expect(firstUniforms(pool).ready.value).toBe(1);
    expect(firstUniforms(pool).map.value).toBe(fallback);
    pool.dispose();
});
it("bounds the cache as search visits new images", async () => {
    const pool = new CardPool(jest.fn());
    draw(pool, [
        card("seed-a"),
        card("seed-b"),
        card("seed-c"),
        card("seed-d"),
    ]);
    (TextureLoader.prototype.load as jest.Mock).mock.calls.forEach((call) =>
        call[1](texture())
    );
    await Promise.resolve();
    const hidden = (pool.group.children[1] as any).material.uniforms;
    for (let i = 0; i < 50; i++) {
        draw(pool, [card(`world-${i}`)]);
        success(texture());
        await Promise.resolve();
    }
    expect((pool as any).textures.size).toBeLessThanOrEqual(36);
    expect(firstUniforms(pool).ready.value).toBe(1);
    expect(hidden.ready.value).toBe(0);
    expect(hidden.map.value).toBeNull();
    pool.dispose();
});
