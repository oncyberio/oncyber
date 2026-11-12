/**
 * @jest-environment jsdom
 */

// The app shell imports these modules instead of `@3constants` so that
// three.js and the engine stay out of every page. Loading them must never
// load three.js, and the transfer test must not start a worker on import.

describe("three-free engine constants", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.doMock("three", () => {
            throw new Error("three.js was loaded");
        });
        jest.doMock("three/webgpu", () => {
            throw new Error("three/webgpu was loaded");
        });
    });

    afterEach(() => {
        jest.dontMock("three");
        jest.dontMock("three/webgpu");
    });

    it("loads shellconstants, device and spacecoords without three.js", () => {
        expect(() => {
            require("./shellconstants");
            require("./device");
            require("./utils/spacecoords");
        }).not.toThrow();
    });

    it("keeps the default avatar picture a live, settable binding", () => {
        const shell = require("./shellconstants");
        const initial = shell.DEFAULT_PLAYER_AVATAR_PICTURE;

        expect(initial).toMatch(/finalsun_ipz0ru\.png$/);

        shell.SET_DEFAULT_AVATAR_PICTURE({ info: { room: "wow_cave" } });

        expect(shell.DEFAULT_PLAYER_AVATAR_PICTURE).toMatch(
            /women_qksitn\.png$/
        );
        expect(shell.DEFAULT_PLAYER_AVATAR_PICTURE).not.toBe(initial);
    });

    it("keeps IS_MULTIPLAYER and EDIT_MODE settable", () => {
        const shell = require("./shellconstants");

        expect(shell.IS_MULTIPLAYER).toBe(false);
        shell.SET_IS_MULTIPLAYER(true);
        expect(shell.IS_MULTIPLAYER).toBe(true);

        expect(shell.EDIT_MODE).toBe(false);
        shell.SET_EDIT_MODE(true);
        expect(shell.EDIT_MODE).toBe(true);
    });

    it("formats coordinates the same way as before", () => {
        const { coordsToId, CoordsReference } = require("./utils/spacecoords");

        expect(
            coordsToId(
                {
                    position: { x: 1, y: 2.345, z: -3 },
                    rotation: { x: 0, y: 1.5, z: 0 },
                },
                "abc"
            )
        ).toBe("1.00X2.35X-3.00X0.00X1.50X0.00@abc");
        expect(CoordsReference).toEqual({ ABSOLUTE: "absolute", HEAD: "head" });
    });

    it("reads desktop flags from the user agent", () => {
        const device = require("./device");

        // jsdom's user agent is a desktop one.
        expect(device.IS_DESKTOP).toBe(true);
        expect(device.IS_MOBILE).toBe(false);
        expect(device.IS_TOUCH).toBe(false);
        expect(device.DELETE_KEY).toBe(device.IS_MAC ? "Backspace" : "Delete");
    });
});
