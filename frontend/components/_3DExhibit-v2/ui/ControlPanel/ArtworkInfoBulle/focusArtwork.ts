import {
    APP_STATES,
    IS_FIRST_PERSON,
    IS_MULTIPLAYER,
} from "@components/_3DExhibit-v2/three/constants";

/**
 * Moves the camera in front of an artwork, the same way a tap on the
 * artwork does on a phone, and resolves once the camera has arrived.
 * Used before the small-screen artwork details open, so the panel shows
 * on top of the artwork rather than wherever the camera happened to be.
 */
export async function focusArtwork(world: any, artwork: any) {
    if (!world || !artwork?.maxLookatDistance) return;

    const thirdPerson = IS_MULTIPLAYER && !IS_FIRST_PERSON;

    try {
        if (thirdPerson) await world.setThirdPerson({ enabled: false });

        await world.setState(APP_STATES.TRANSITION, {
            target: artwork,
            lookAtDistance: artwork.maxLookatDistance(),
            checkCollitions: true,
        });

        await world.setState(APP_STATES.SPACE, {});
    } catch (e) {
        console.error(e);
    } finally {
        if (thirdPerson) world.setThirdPerson({ enabled: true });
    }
}
