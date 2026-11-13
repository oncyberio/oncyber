/** @jest-environment node */
// The engine's star field carries on the page's loading stars when it takes
// over from the link entrance (utils/spaceEntrance), instead of starting a
// second field from black.

jest.mock(
    "@3constants",
    () => ({
        DPI: 1,
        APP_STATES: { INTRO: "intro", SPACE: "space", TRANSITION: "t" },
        VIEW: { w: 800, h: 600 },
    }),
    { virtual: true }
);
jest.mock(
    "@3emitter",
    () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }),
    { virtual: true }
);
jest.mock("@3events", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3renderer", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("gsap", () => ({
    __esModule: true,
    default: { to: jest.fn(() => ({ kill: jest.fn() })) },
}));

const gsap = require("gsap").default;

function freshStarfield() {
    let starfield;
    jest.isolateModules(() => {
        starfield = require("./index.js").default;
    });
    return starfield;
}

beforeEach(() => gsap.to.mockClear());

test("adopts the page's stars at full brightness", async () => {
    const starfield = freshStarfield();
    const handOffStars = jest.fn(() => [
        { x: 10, y: -20, z: 3, lightness: 0.8 },
        { x: -5, y: 7, z: 12, lightness: 1 },
    ]);
    await starfield.setState("intro", { handOffStars });
    expect(handOffStars).toHaveBeenCalledTimes(1);
    expect(starfield.transitionValue).toBe(1);
    expect(gsap.to).not.toHaveBeenCalled();
    // The canvas's y grows downwards; the engine's grows upwards.
    expect(starfield.stars[0]).toMatchObject({ x: 10, y: 20, z: 3 });
    expect(starfield.stars[1]).toMatchObject({ x: -5, y: -7, z: 12 });
    expect(starfield.stars[2]).toMatchObject({ x: 10, y: 20, z: 3 });
    expect(starfield.stars.every((star) => star.spawned)).toBe(true);
});

test("fades in from black when the page showed no stars", async () => {
    const starfield = freshStarfield();
    await starfield.setState("intro", { handOffStars: () => null });
    expect(starfield.transitionValue).toBe(0);
    expect(gsap.to).toHaveBeenCalledWith(
        starfield,
        expect.objectContaining({ transitionValue: 1 })
    );
});

test("fades in from black with no hand-off at all", async () => {
    const starfield = freshStarfield();
    await starfield.setState("intro", {});
    expect(starfield.transitionValue).toBe(0);
    expect(gsap.to).toHaveBeenCalledTimes(1);
});
