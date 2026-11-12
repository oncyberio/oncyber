const constants = {
    APP_STATES: { TRANSITION: "transition", SPACE: "space" },
    IS_FIRST_PERSON: false,
    IS_MULTIPLAYER: true,
};
jest.mock("@components/_3DExhibit-v2/three/constants", () => constants);

import { focusArtwork, releaseArtworkFocus } from "./focusArtwork";

function fakeWorld() {
    const calls: string[] = [];
    return {
        calls,
        currentArtworks: { isTransitionning: false },
        setThirdPerson: jest.fn(async ({ enabled }) => {
            calls.push(`third:${enabled}`);
        }),
        setState: jest.fn(async (state) => {
            calls.push(state);
        }),
    };
}

const artwork = { raycastMesh: {}, maxLookatDistance: () => 3 };

describe("focusArtwork", () => {
    it("keeps first person until the details are released", async () => {
        const world = fakeWorld();
        await focusArtwork(world, artwork);
        expect(world.calls).toEqual(["third:false", "transition", "space"]);
        expect(world.currentArtworks.isTransitionning).toBe(false);

        releaseArtworkFocus(world);
        expect(world.calls).toEqual([
            "third:false",
            "transition",
            "space",
            "third:true",
        ]);
    });

    it("releases once, and not when it never switched", () => {
        const world = fakeWorld();
        releaseArtworkFocus(world);
        expect(world.setThirdPerson).not.toHaveBeenCalled();
    });

    it("aims at the framed surface with collision checks", async () => {
        const world = fakeWorld();
        await focusArtwork(world, artwork);
        expect(world.setState).toHaveBeenCalledWith("transition", {
            target: artwork.raycastMesh,
            lookAtDistance: 3,
            checkCollitions: true,
        });
        releaseArtworkFocus(world);
    });
});
