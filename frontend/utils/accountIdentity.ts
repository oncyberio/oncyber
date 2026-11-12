import { createHash } from "crypto";
import { db } from "@utils/firebaseAdmin";
import { preparePartyIdentityMerge } from "./partyIdentityMerge";
import { SOCIAL_COLLECTIONS } from "@utils/socialCollections";

const unique = (values: unknown[]) => [...new Set(values.filter((v): v is string => typeof v === "string" && !!v))].slice(0, 100);
const defaults = (account: any) => ({ subjectUid: account.data().walletId || account.id, legacySubjectUids: unique([account.id, account.data().walletId, ...(account.data().linkedAccounts || [])]) });

/** Canonical account identity and stable legacy save subjects stay server-side. */
export async function socialAccountIdentity(account: any) {
    const ref = db.collection(SOCIAL_COLLECTIONS.identityRoots).doc(account.id);
    return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const identity = snapshot.exists ? snapshot.data() : defaults(account);
        if (!snapshot.exists) tx.create(ref, { ...identity, createdAt: new Date() });
        return { uid: account.id, subjectUid: identity.subjectUid, legacySubjectUids: unique([...identity.legacySubjectUids || [], ...defaults(account).legacySubjectUids]) };
    });
}

/** Read before the account merge's writes, then commit with the same transaction. */
export async function prepareSocialIdentityMerge(tx: any, source: any, destination: any) {
    const sourceRef = db.collection(SOCIAL_COLLECTIONS.identityRoots).doc(source.id);
    const destinationRef = db.collection(SOCIAL_COLLECTIONS.identityRoots).doc(destination.id);
    const [a, b] = await Promise.all([tx.get(sourceRef), tx.get(destinationRef)]);
    const before = a.exists ? a.data() : defaults(source);
    const after = b.exists ? b.data() : defaults(destination);
    const legacySubjectUids = unique([before.subjectUid, after.subjectUid, ...(before.legacySubjectUids || []), ...(after.legacySubjectUids || []), ...defaults(source).legacySubjectUids]);
    const commitParties = await preparePartyIdentityMerge(tx, source.id, destination.id);
    return () => {
        commitParties();
        tx.set(destinationRef, { subjectUid: after.subjectUid, legacySubjectUids, updatedAt: new Date() });
        tx.set(db.collection(SOCIAL_COLLECTIONS.accountRedirects).doc(source.id), { canonicalId: destination.id, updatedAt: new Date() });
    };
}

export async function canonicalAccountId(id: string) {
    const seen = new Set<string>();
    for (let count = 0; count < 20; count++) {
        if (seen.has(id)) throw new Error("ACCOUNT_REDIRECT_CYCLE");
        seen.add(id);
        const redirect = await db.collection(SOCIAL_COLLECTIONS.accountRedirects).doc(id).get();
        if (!redirect.exists) return id;
        id = redirect.data().canonicalId;
    }
    throw new Error("ACCOUNT_REDIRECT_LIMIT");
}

export const followId = (from: string, to: string) => createHash("sha256").update(JSON.stringify([from, to])).digest("hex");
