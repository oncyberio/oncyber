import {
    APP_STATES,
    IS_FIRST_PERSON,
    IS_MULTIPLAYER,
} from "@components/_3DExhibit-v2/three/constants";

/**
 * Walks the camera up to an artwork, the same way a tap on the artwork
 * does on a phone, and resolves once it has arrived. Used before the
 * small-screen artwork details open, so they show on top of the artwork
 * rather than wherever the camera happened to be.
 *
 * Mirrors DisplayScene's handleMobileTransition: it aims at the artwork's
 * raycast mesh (the framed surface, not the group origin), keeps the eye
 * height through `checkCollitions`, and drops to first person for the move.
 */
export async function focusArtwork(world: any, artwork: any) {
    const target = artwork?.raycastMesh;
    if (!world || !target || !artwork.maxLookatDistance) return;

    const container = world.currentArtworks;
    const thirdPerson = IS_MULTIPLAYER && !IS_FIRST_PERSON;

    try {
        // While moving, looking past another artwork must not swap the
        // current one; the same flag guards a phone tap transition.
        if (container) container.isTransitionning = true;

        if (thirdPerson) await world.setThirdPerson({ enabled: false });

        await world.setState(APP_STATES.TRANSITION, {
            target,
            lookAtDistance: artwork.maxLookatDistance(),
            checkCollitions: true,
        });

        await world.setState(APP_STATES.SPACE, {});
    } catch (e) {
        console.error(e);
    } finally {
        if (container) container.isTransitionning = false;
        if (thirdPerson) world.setThirdPerson({ enabled: true });
    }
}
