import { WORLD_COVER_OPACITY, isGated, worldCover } from "./worldStars";

const loading = {
    phase: "loading",
    onTrip: false,
    gated: false,
    reducedMotion: false,
};

describe("what the page shows over a world while it loads", () => {
    test("stars while it loads, nothing once it has drawn or failed", () => {
        expect(worldCover(loading)).toBe("stars");
        expect(worldCover({ ...loading, phase: "drawn" })).toBe("none");
        expect(worldCover({ ...loading, phase: "failed" })).toBe("none");
    });

    test("a still cover for a visitor who asked for less motion", () => {
        expect(worldCover({ ...loading, reducedMotion: true })).toBe("plain");
    });

    test("nothing over a gated world: its prompt comes before it draws", () => {
        expect(worldCover({ ...loading, gated: true })).toBe("none");
    });

    test("nothing on a trip from the lobby, which stays on screen itself", () => {
        expect(worldCover({ ...loading, onTrip: true })).toBe("none");
    });

    test("the cover is never fully opaque, or the browser starves the frame", () => {
        expect(WORLD_COVER_OPACITY).toBeLessThan(1);
        expect(WORLD_COVER_OPACITY).toBeGreaterThan(0.98);
    });

    test("a space with no gate, or one the visitor passed, is not gated", () => {
        // What the page hands over for every open space.
        expect(isGated({ type: "success" })).toBe(false);
        expect(isGated(undefined)).toBe(false);
        expect(isGated({ type: "password" })).toBe(true);
        expect(isGated({ type: "other-error" })).toBe(true);
    });
});
