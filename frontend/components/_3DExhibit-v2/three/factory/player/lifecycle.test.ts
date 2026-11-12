/** @jest-environment jsdom */
jest.mock("@3events", () => ({ __esModule: true, default: {} }), { virtual: true });
const mockAvatars = { enabled: true, setAtlas: jest.fn() };
jest.mock("./instanceavatarvrm", () => ({
    __esModule: true,
    default: mockAvatars,
}));
jest.mock("./instance", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("./instanceusername", () => ({
    __esModule: true,
    default: jest.fn(() => ({ dispose: jest.fn() })),
}));
jest.mock("./instanceusername/generator", () => ({
    __esModule: true,
    default: { CANVAS_SIZE: 64 },
}));
jest.mock(
    "@3factory/atlas",
    () => ({
        __esModule: true,
        default: { get: () => ({ reset: jest.fn() }) },
    }),
    { virtual: true }
);
jest.mock(
    "@3scene",
    () => ({
        __esModule: true,
        default: { add: jest.fn(), remove: jest.fn() },
    }),
    { virtual: true }
);
jest.mock("@3camera", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3gltf", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3textures", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("@3emitter", () => ({ __esModule: true, default: {} }), {
    virtual: true,
});
jest.mock("./constants", () => ({ DEFAULT_PLAYER_AVATAR_PICTURE: "" }));

test("reusing the player factory resumes avatar rendering after every space exit", () => {
    const { Players } = require("./index");
    const players = new Players();
    for (let trip = 0; trip < 3; trip++) {
        players.initUsername();
        expect(mockAvatars.enabled).toBe(true);
        players.disposeAll();
        expect(mockAvatars.enabled).toBe(false);
    }
    players.initUsername();
    expect(mockAvatars.enabled).toBe(true);
});
