/**
 * The world access proofs this tab holds, by space slug (the gating check's
 * `spaceId`, which is also the multiplayer room label). In memory only: a
 * reload asks for the password again, as it always did. The proof is opaque
 * here; the server signs and checks it (./proof.ts).
 */

type Entry = { proof: string; expiresAt: number };

const proofs = new Map<string, Entry>();

// Refresh a proof this close to its expiry before relying on it.
export const PROOF_REFRESH_MARGIN_MS = 10 * 60 * 1000;

function expiryOf(proof: string): number {
    try {
        const payload = proof.split(".")[1];
        const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const expiry = JSON.parse(json)?.e;
        return typeof expiry === "number" ? expiry * 1000 : 0;
    } catch {
        return 0;
    }
}

/** Keep the proof a successful gating check returned, if any. */
export function rememberWorldAccess(
    spaceId: string,
    result: { type?: string; proof?: string } | null | undefined
) {
    if (!spaceId || result?.type !== "success") return;
    if (typeof result.proof !== "string" || !result.proof) return;
    proofs.set(spaceId, {
        proof: result.proof,
        expiresAt: expiryOf(result.proof),
    });
}

// The gating check renews a proof up to this long after it expired
// (WORLD_ACCESS_RENEWAL_GRACE_S in ./proof.ts); after that it is useless.
const RENEWAL_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * The proof held for this space, for the gating check: it is still renewed
 * there a while after it expired. Null once it cannot be.
 */
export function heldWorldAccessProof(
    spaceId: string,
    now = Date.now()
): string | undefined {
    const entry = proofs.get(spaceId);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt + RENEWAL_GRACE_MS <= now) {
        proofs.delete(spaceId);
        return undefined;
    }
    return entry.proof;
}

/** The proof held for this space while a room join accepts it. */
export function readWorldAccessProof(
    spaceId: string,
    now = Date.now()
): string | undefined {
    const proof = heldWorldAccessProof(spaceId, now);
    const entry = proofs.get(spaceId);
    if (!proof || (entry.expiresAt && entry.expiresAt <= now)) return undefined;
    return proof;
}

/** Does the proof held for this space need refreshing before a join? */
export function worldAccessProofExpiring(spaceId: string, now = Date.now()) {
    const entry = proofs.get(spaceId);
    return !!entry && entry.expiresAt - now < PROOF_REFRESH_MARGIN_MS;
}

/**
 * Before a room join: renew the proof held for this space when it expired
 * or is about to, by sending it back to the gating check. Never throws; the
 * join decides whether what is held is enough.
 */
export async function renewWorldAccess(
    spaceId: string,
    check: (proof: string) => Promise<{ type?: string; proof?: string }>
) {
    const proof = heldWorldAccessProof(spaceId);
    if (!proof || !worldAccessProofExpiring(spaceId)) return;
    try {
        rememberWorldAccess(spaceId, await check(proof));
    } catch (err) {
        console.warn("[world access] renewal failed", err);
    }
}

export function forgetWorldAccess(spaceId?: string) {
    if (spaceId == null) proofs.clear();
    else proofs.delete(spaceId);
}
