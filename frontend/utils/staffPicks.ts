import type { NextApiRequest } from "next";
import { db, fire } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { lobbyRole } from "@utils/lobbyRoles";

/**
 * Staff picks are one ordered list (newest pick first) kept in a single doc.
 * It replaces the old `info.featured` flag, which is left untouched on the
 * exhibits as an archive of the previous selection.
 */
const STAFF_PICKS_DOC = () => db.collection("curation").doc("staff-picks");
export const STAFF_PICKS_LIMIT = 200;

let cache: { ts: number; ids: string[] } | null = null;
const CACHE_MS = 15 * 1000;

export async function readStaffPickIds(fresh = false): Promise<string[]> {
    if (!fresh && cache && Date.now() - cache.ts < CACHE_MS) return cache.ids;
    const snap = await STAFF_PICKS_DOC().get();
    const ids = Array.isArray(snap.data()?.ids)
        ? snap.data().ids.filter((id: unknown) => typeof id === "string" && id)
        : [];
    cache = { ts: Date.now(), ids };
    return ids;
}

/** Add or remove one space; returns the updated list. */
export async function setStaffPick(
    exhibitId: string,
    picked: boolean,
    actor: string
): Promise<string[]> {
    const ref = STAFF_PICKS_DOC();
    const ids = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current: string[] = Array.isArray(snap.data()?.ids)
            ? snap.data().ids
            : [];
        const rest = current.filter((id) => id !== exhibitId);
        const next = picked
            ? [exhibitId, ...rest].slice(0, STAFF_PICKS_LIMIT)
            : rest;
        transaction.set(
            ref,
            {
                ids: next,
                updatedAt: fire.FieldValue.serverTimestamp(),
                updatedBy: actor,
            },
            { merge: true }
        );
        return next;
    });
    cache = { ts: Date.now(), ids };
    return ids;
}

/** The signed-in account when it may curate staff picks (owner or lobby admin). */
export async function staffPickCurator(
    req: NextApiRequest
): Promise<string | null> {
    let uid: string;
    try {
        uid = await auth(req);
    } catch {
        return null;
    }
    const account = await getAccountDoc(uid).catch(() => null);
    if (!account) return null;
    return lobbyRole(account) ? account.id : null;
}
