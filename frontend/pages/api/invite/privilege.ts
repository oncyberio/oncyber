// co-curator
// delegator
// owner
// admin_curator

import { db } from "@utils/firebaseAdmin";
import { canChangeRole, getUserRole } from "@utils/invite";

import { auth, verify } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { getUserData } from "./kick";

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const userId = await auth(req);

        const { owners, editorId, privilege, exhibitId } = req.body;

        const validatedAccounts = [];

        // privilege we need to check if privilege is valid.
        // WE readlly need that body validation middleware...

        if (owners.length) {
            await Promise.all(
                owners?.map(async (accountId) => {
                    const value = await verify(req?.cookies?.[accountId]);

                    if (value) {
                        validatedAccounts.push(value);
                    }
                })
            );
        }

        await db.runTransaction(async (transaction) => {
            //
            const exhibitRef = db.collection("exhibits").doc(exhibitId);

            const exhibitDoc = await transaction.get(exhibitRef);

            const exhibit = exhibitDoc.data();

            const [editorData, userData] = await Promise.all([
                getUserData(transaction, editorId, exhibitId),
                getUserData(transaction, userId, exhibitId),
            ]);

            const userRole = getUserRole(userData.userExhibit);

            const editorRole = getUserRole(editorData.userExhibit);

            if (
                exhibit.owner !== userId &&
                !canChangeRole(userRole, editorRole)
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "You don't have permission to switch this user's privilege.",
                });
            }

            const payload = {
                id: exhibitId,
                invited: true,
                isCurator: true,
                otherOwners: validatedAccounts,
                isAdminCurator: privilege === "admin-curator",
                privilege,
            };

            transaction.set(editorData.userExhibitRef, payload);
        });

        return res.json({
            success: true,
            privilege,
        });
    } catch (err) {
        console.log("errr", err);

        return res.json({
            success: false,
            message: err.message,
        });
    }
};
