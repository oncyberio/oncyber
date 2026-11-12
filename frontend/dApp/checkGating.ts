import { Experience } from "@uitypes/experience";
import { GatingCheckResult } from "@utils/checkGatingRules";
import SocialApi from "@api/social/_api";
import { getSpaceSlug } from "@utils/exhibit";
import { UserState } from "@uitypes/user";
import {
    heldWorldAccessProof,
    rememberWorldAccess,
} from "@utils/worldPassword/accessProofs";

/**
 * Ask the server whether the visitor may enter. The password, when given,
 * is checked there; a world access proof this tab already holds for the
 * world is sent along, so a check after the password was entered (a sign-in,
 * a room join) does not ask for it again.
 */
export async function checkGating(
    experience: Experience,
    user: Partial<UserState>,
    password?: string
): Promise<GatingCheckResult> {
    //

    if (experience?.gating == null) {
        return { type: "success" };
    }

    const spaceId = getSpaceSlug(experience);

    return SocialApi.opts({ encode: true })
        .checkGating({
            spaceId,
            nbPlayers: 0,
            password,
            proof: heldWorldAccessProof(spaceId),
        })
        .then((result: GatingCheckResult) => {
            rememberWorldAccess(spaceId, result);
            return result;
        })
        .catch((err) => {
            console.error(err);
            return { type: "other-error", error: err.message };
        });
}
