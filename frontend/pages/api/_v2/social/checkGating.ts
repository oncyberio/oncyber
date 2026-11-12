import { z } from "zod";
import { NoApi, proc } from "@utils/rpc/server";
import { getExhibitAccessByCustomLink } from "@utils/firestore/exhibitAccess";
import type { Experience } from "@uitypes/experience";
import { checkGatingRules, GatingCheckResult } from "@utils/checkGatingRules";
import { isEditor } from "@utils/exhibit";
import { db } from "@utils/firebaseAdmin";
import { getUserByDoc } from "@api/accounts/user/utils";
import { hasWorldPassword } from "@utils/worldPassword/publicGating";
import { createWorldPasswordCheck } from "@utils/worldPassword/server";
import { attemptClientKey } from "@utils/worldPassword/attempts";
import { signWorldAccessProof } from "@utils/worldPassword/proof";

/**
 * Admission to a world. The password is checked here against its hash; a
 * visitor who passes a password-gated world gets `proof`, which the
 * multiplayer room join and gated content reads accept, and which can be
 * sent back instead of the password until it expires.
 */
export const checkGating = proc({
    //
    schema: z.object({
        spaceId: z.string().min(1),
        cap: z.boolean().optional(),
        nbPlayers: z.number(),
        password: z.string().max(200).optional(),
        proof: z.string().max(1024).optional(),
    }),

    auth: false,

    //
    async handler({
        spaceId,
        cap: onlyCheckCap,
        nbPlayers,
        password,
        proof,
    }): Promise<GatingCheckResult> {
        //

        try {
            const exhibit = await getExhibitAccessByCustomLink(spaceId);

            if (exhibit == null) {
                throw new Error("Failed to get exhibit data for " + spaceId);
            }

            if (!exhibit.gating) return { type: "success" };

            const passwordCheck = createWorldPasswordCheck({
                exhibitId: exhibit.id,
                gating: exhibit.gating,
                password,
                proof,
                client: attemptClientKey(this.req),
            });

            const admitted = (): GatingCheckResult => {
                if (onlyCheckCap || !hasWorldPassword(exhibit.gating))
                    return { type: "success" };
                const issued = signWorldAccessProof({
                    exhibitId: exhibit.id,
                    rev: passwordCheck.rev,
                });
                return issued
                    ? { type: "success", proof: issued }
                    : { type: "success" };
            };

            // Skip gating test for editors
            if (isEditor(exhibit as Experience, this.userId)) {
                return admitted();
            }

            const { roomCapacity, ...rest } = exhibit.gating;

            let gating = onlyCheckCap ? { roomCapacity } : rest;

            // let userId = walletId;

            let user = null;

            if (this.userId) {
                const userSnap = await db
                    .collection("users")
                    .where("walletId", "==", this.userId?.toLowerCase())
                    .get();

                if (userSnap.empty) {
                    return { type: "other-error", error: "user not found" };
                }

                const userDoc = userSnap.docs[0];

                user = await getUserByDoc(userDoc);
            }

            const result = await checkGatingRules(
                gating,
                user,
                nbPlayers,
                passwordCheck.check
            );

            if (result.type === "success") return admitted();
            if (result.type === "password-error" && passwordCheck.limited)
                return { type: "too-many-attempts-error" };
            return result;
            //
        } catch (err) {
            console.error(err);
            return {
                type: "other-error",
                error: err.message || "Failed to check gating",
            };
        }
    },
});

export default NoApi;
