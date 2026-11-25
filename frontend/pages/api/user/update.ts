import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import { auth } from "../../../utils/middlewares/authMiddleware";
import { db } from "../../../utils/firebaseAdmin";
import { validateUsername } from "@utils/rules/user";
import { invalidateUserProfile } from "@utils/firestore/userProfiles";
import { writesAccountIdentity } from "@utils/auth/accountOwnership";
import { markProfileWritten } from "@utils/auth/profileWrites";
import { readHiddenNfts } from "@features/space-info/profileSections";

export async function isValidAndUniqueUsername(_username) {
    const username = _username
        .toLowerCase()
        .replace(/[^a-zA-Z0-9-_]+/, "")
        .replace(/ /g, "_");

    let result = validateUsername(username);

    if (result.success === false) {
        return {
            success: false,
            message: result.error,
        };
    }

    const doc = await db
        .collection("users")
        .where("username", "==", username)
        .limit(1)
        .get();

    if (!doc.empty)
        return {
            success: false,
            message: "Username already exists.",
        };

    return {
        success: true,
        username: username,
    };
}

// ! this needs to go to v2 asap and re-implemented from scratch
export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        const userId = await auth(req);

        const { payload } = req.body as {
            payload: {
                currentExhibitId: string;
                walletId: string;
                description: string;
                socials: {};
                banner: string;
                avatar: string;
                username: string;
                walletCustomName: string;
            };
        };

        if (
            payload.walletId &&
            userId?.toLowerCase?.() !== payload.walletId?.toLowerCase?.()
        ) {
            return res.status(400).json({
                success: false,
                message: "Can't update wallet id",
            });
        }

        // Linked accounts are written only by sign-in, link, unlink and
        // merge, after each account is proved; gating and roles trust them.
        if (writesAccountIdentity(payload)) {
            return res.status(400).json({
                success: false,
                message: "Can't update linked accounts",
            });
        }

        // if (payload.currentExhibitId) {
        //     const doc = await db
        //         .collection("exhibits")
        //         .doc(payload.currentExhibitId)
        //         .get();

        //     const data = doc.data() as Experience;

        //     if (
        //         !data?.editors.some(
        //             (it) => it.toLowerCase() === userId.toLowerCase()
        //         )
        //     ) {
        //         return res.status(400).json({
        //             success: false,
        //             message: "Not your exhibit.",
        //         });
        //     }
        // }

        // Which of their NFTs a profile leaves out: a list of ids, checked
        // here because the rest of this payload is written as it comes.
        if ("hiddenNfts" in payload) {
            const hidden = readHiddenNfts((payload as any).hiddenNfts);
            if (!hidden)
                return res.status(400).json({
                    success: false,
                    message: "That list of NFTs can’t be saved.",
                });
            (payload as any).hiddenNfts = hidden;
        }
        // We he tries to change the username we first check if it exists
        if (payload.username) {
            const result = await isValidAndUniqueUsername(payload.username);

            if (!result.success) return res.status(400).json(result);

            payload.username = result.username;
        }

        // Noticed that some tezos and solana wallets aren't lowercased
        const userDoc = await db
            .collection("users")
            .where("walletId", "==", userId.toLowerCase())
            .get();

        if (userDoc.empty) {
            await db.collection("users").doc(userId).set(payload);
        } else {
            await db
                .collection("users")
                .doc(userDoc.docs[0].id)
                .update(payload);
        }

        // Drop the cached walletId->profile snapshot so display lookups pick
        // up the edit immediately instead of after the cache TTL.
        invalidateUserProfile(userId);
        // Other warm instances still hold their own copy: the mark makes
        // this person's next page skip it.
        markProfileWritten(res);

        res.status(200).json({
            success: true,
            userId,
        });
    } catch (err) {
        console.log("err", err);
        res.status(400).json({
            success: false,
        });
    }
};
