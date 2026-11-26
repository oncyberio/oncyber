import { GAMES } from "./catalog";
import { deviceNotice, gameOnDevice } from "./gameDevices";

describe("games by device", () => {
    const touch = { devices: ["desktop", "phone"] as any };
    const keys = { devices: ["desktop", "gamepad"] as any };

    it("offers a game on phones and tablets only when it claims phone", () => {
        expect(gameOnDevice(touch, "phone")).toBe(true);
        expect(gameOnDevice(touch, "tablet")).toBe(true);
        expect(gameOnDevice(keys, "phone")).toBe(false);
        expect(gameOnDevice(keys, "tablet")).toBe(false);
    });

    it("offers a game on desktop only when it claims desktop", () => {
        expect(gameOnDevice(keys, "desktop")).toBe(true);
        expect(gameOnDevice({ devices: ["phone"] as any }, "desktop")).toBe(
            false
        );
    });

    it("lets a headset through: no game can declare one yet", () => {
        expect(gameOnDevice(keys, "headset")).toBe(true);
    });

    it("agrees with the catalog", () => {
        expect(gameOnDevice(GAMES.ace, "phone")).toBe(true);
        expect(gameOnDevice(GAMES.garden, "phone")).toBe(false);
    });

    it("says where a game is missing", () => {
        expect(deviceNotice("Padel", "phone")).toBe(
            "Padel isn’t on phones yet."
        );
        expect(deviceNotice("Padel", "tablet")).toBe(
            "Padel isn’t on tablets yet."
        );
    });
});
