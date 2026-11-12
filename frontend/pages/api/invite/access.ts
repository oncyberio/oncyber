import { Experience } from "@uitypes/experience";
import { db } from "@utils/firebaseAdmin";

import { auth } from "@utils/middlewares/authMiddleware";

import { corsMiddleware } from "@utils/middlewares/corsMiddleware";

import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { isSupportedRuntime } from "@utils/runtimeKind";

export async function handleInviteAccess(inviteId, userId) {
    return await db.runTransaction(async (transaction) => {
        // Firestore requires every read to happen before the first write, so
        // the whole read set is resolved up front.

        // 1. Check if invite exists
        const inviteRef = db.collection("invites").doc(inviteId);

        const inviteDoc = await transaction.get(inviteRef);

        // Must come BEFORE reading invite.exhibitId — dereferencing it on a
        // deleted invite threw a TypeError that authServerSideProps swallows,
        // so the user got no message at all instead of this one.
        if (!inviteDoc.exists) {
            return {
                success: false,
                message: "Invite link deleted or doesn't exist.",
            };
        }

        const invite = inviteDoc.data();

        const exhibitRef = db.collection("exhibits").doc(invite.exhibitId);

        const exhibitDoc = await transaction.get(exhibitRef);

        if (!exhibitDoc.exists) {
            return {
                success: false,
                message: "Invite link deleted or doesn't exist.",
            };
        }

        const exhibit = exhibitDoc.data() as Experience;

        // `userId` is a walletId, which is NOT necessarily the user doc id:
        // linked/secondary wallets resolve to their primary doc, and
        // solana/tezos wallets aren't lower cased. Resolve it the same way the
        // rest of the app does and hang every subsequent ref off `userRef` —
        // writing the membership doc under `users/{walletId}` instead put it on
        // a phantom doc, so the "already invited" short-circuit never fired and
        // the space never showed up in the invitee's space list.
        const userDoc = await getAccountDoc(userId, transaction);

        const userRef = userDoc
            ? userDoc.ref
            : db.collection("users").doc(userId);

        const userExhibitRef = userRef
            .collection("exhibits")
            .doc(invite.exhibitId);

        const userExhibitDoc = await transaction.get(userExhibitRef);

        // 2. Writes.

        const editors = exhibit.editors || [];

        const isEditor = editors.some(
            (it) => it?.toLowerCase?.() === userId.toLowerCase()
        );

        // Only runtimes this build serves can take collaborators; other kinds
        // may run code in the editor's session that a new editor did not write.
        if (!isEditor && !isSupportedRuntime(exhibit.runtime)) {
            return {
                success: false,
                message: "This space can't have additional editors yet.",
            };
        }

        const nextEditors = isEditor ? editors : editors.concat(userId);

        // Any write to `editors` MUST bump `lastUpdatedAt`: the exhibit-view
        // cache in pages/api/exhibit.ts is version-keyed on it (24h TTL, and a
        // cross-instance tier), so an unversioned editors write is served stale
        // to studio SSR — the new editor isn't in the array the client sees,
        // ExhibitContext computes userRole == null, and EditWorld reloads the
        // page forever. invite/kick.ts does the same bump.
        if (!isEditor) {
            await transaction.update(exhibitRef, {
                editors: nextEditors,
                lastUpdatedAt: Date.now(),
            });
        }

        const userPayload: any = { currentExhibitId: exhibitDoc.id };

        // Only seed an account doc when the wallet genuinely resolves to
        // nothing — doing it unconditionally minted an orphan `users` doc for
        // linked secondary wallets, which getAccountDoc would then prefer over
        // the real primary account.
        if (!userDoc) {
            userPayload.walletId = userId.toLowerCase();
        }

        // set/merge is safe whether or not the doc exists, unlike update().
        await transaction.set(userRef, userPayload, { merge: true });

        if (userExhibitDoc.exists) {
            // Already a member. `currentExhibitId` is still repointed above,
            // but only now that the editors array is guaranteed to contain
            // them — otherwise this pins the user to a space the studio
            // refuses to open, which is the reload loop with extra steps.
            return {
                success: false,
                message: "You are already invited.",
            };
        }

        await transaction.set(userExhibitRef, {
            id: invite.exhibitId,
            invited: true,
            privilege: "co-curator",
            otherOwners: [],
            isCurator: true,
            isAdminCurator: false,
        });

        return {
            success: true,
            exhibit: {
                ...exhibit,
                editors: nextEditors,
            },
            message: "Successfully invited!",
        };
    });
}

export default async (req, res) => {
    try {
        await corsMiddleware(req, res);

        if (!req.query.inviteId) {
            return res.json({
                success: false,
            });
        }

        const userId = await auth(req);

        const transaction = await handleInviteAccess(
            req.query.inviteId,
            userId
        );

        return res.json(transaction);
    } catch (err) {
        return res.json({
            message: "Accessing invite failed",
            success: false,
        });
    }
};
