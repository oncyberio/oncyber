import { z } from "zod";
import { db } from "@utils/firebaseAdmin";
import { NoApi, proc } from "@utils/rpc/server";
import {
    runSavedCall,
    type SavedDoc,
    type SavedQuotaDoc,
    type SavedTransaction,
} from "@features/games/savedDataServer";

/**
 * Saved data for games (docs/games/saved-data.md). The rules live in
 * features/games/savedDataServer.ts; these procedures give them a Firestore
 * transaction and the caller's account.
 *
 * Collections: `gameSaved` (one document per value) and `gameSavedQuota`
 * (one per account). Only the Admin SDK touches them.
 */
const VALUES = "gameSaved";
const QUOTAS = "gameSavedQuota";

const call = z.object({
    game: z.string().max(63),
    party: z.string().max(80).optional(),
    key: z.string().max(32),
});

function transaction(tx: FirebaseFirestore.Transaction): SavedTransaction {
    const value = (id: string) => db.collection(VALUES).doc(id);
    const quota = (userId: string) => db.collection(QUOTAS).doc(userId);
    return {
        async getValue(id) {
            const doc = await tx.get(value(id));
            if (!doc.exists) return null;
            const data = doc.data();
            return {
                ...data,
                expiresAt: data.expiresAt?.toDate?.() ?? undefined,
            } as SavedDoc;
        },
        setValue(id, doc) {
            if (doc) tx.set(value(id), doc);
            else tx.delete(value(id));
        },
        async getQuota(userId) {
            const doc = await tx.get(quota(userId));
            return doc.exists ? (doc.data() as SavedQuotaDoc) : null;
        },
        setQuota(userId, doc) {
            tx.set(quota(userId), doc);
        },
    };
}

/** Reads one declared key. Visitor keys need a session; shared keys don't. */
export const savedRead = proc({
    auth: false,
    schema: call,
    async handler({ game, party, key }) {
        return db.runTransaction(
            (tx) =>
                runSavedCall(
                    transaction(tx),
                    { game, party, request: { op: "get", key } },
                    this.userId
                ),
            { readOnly: true }
        );
    },
});

/** Sets or removes one declared key, compare-and-set for shared scopes. */
export const savedWrite = proc({
    auth: true,
    schema: call.extend({
        op: z.enum(["set", "remove"]),
        stateVersion: z.number().int().optional(),
        // Checked for shape and size against the game's declaration.
        value: z.unknown().optional(),
        ifRevision: z.number().int().nonnegative().optional(),
    }),
    async handler({ game, party, ...request }) {
        return db.runTransaction((tx) =>
            runSavedCall(transaction(tx), { game, party, request }, this.userId)
        );
    },
});

export default NoApi;
