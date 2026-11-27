/**
 * Tells the spaces that are open that their script was saved
 * (features/world-scripts/livePickup.ts): a notice on the space's live
 * feed, which every open space listens to.
 *
 * Written as the server (the admin SDK), so it does not depend on what
 * the feed's rules let a browser write.
 */
import { realtime } from "@utils/firebaseAdmin";
import { scriptEvent, type Landing } from "@features/world-scripts/livePickup";

/**
 * Never throws: the script is saved whether or not anyone hears of it, and
 * a space that does not hear has it on its next load.
 */
export async function announceScript(
    experienceId: string,
    savedAt: number,
    landing: Landing
) {
    try {
        await realtime()
            .ref("/exhibits/" + experienceId)
            .push(scriptEvent(savedAt, landing, Date.now()));
        return true;
    } catch (error) {
        console.error("[world scripts] save not announced", error);
        return false;
    }
}
