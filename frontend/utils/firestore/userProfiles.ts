import { db } from "../firebaseAdmin";
import { getContentByIds } from "../getContentByIds";

// ---------------------------------------------------------------------------
// User-profile read cache (walletId -> user doc).
//
// The `/users WHERE walletId == ?` and `WHERE walletId IN [?]` queries are the
// single biggest Firestore read bucket. They're driven by pure *display*
// resolution — portal owners, avatars, owner/editor lists on the space view —
// which repeats the same handful of walletIds across every view of a popular
// space, and re-runs on every cold serverless instance.
//
// This is a two-tier cache: an in-process Map (free, dies on cold start) backed
// by a cross-instance `caches/user-profile-{walletId}` doc (1 read on a warm
// hit, survives cold starts). `caches/` is server-only under the deployed
// Firestore rules (default `match /{document=**}` denies client reads), so no
// profile field is exposed to clients that isn't already returned by the
// existing endpoints. Profiles change rarely, so a short TTL is safe for these
// display lookups; anything needing live identity (gating, auth) uses its own
// query and does not go through here.
// ---------------------------------------------------------------------------

// Positive hits can live long: profile writes call invalidateUserProfile(),
// which clears the shared doc immediately — the TTL only bounds how long a
// *warm other instance* can serve its in-process copy after an edit. Negative
// (profile-less wallet) entries stay short so a brand-new signup can't be
// invisible for hours.
const POSITIVE_PROFILE_TTL_MS = 2 * 60 * 60 * 1000;
const NEGATIVE_PROFILE_TTL_MS = 15 * 60 * 1000;
const MEM_MAX = 2000;

function profileTtl(user: any): number {
    return user ? POSITIVE_PROFILE_TTL_MS : NEGATIVE_PROFILE_TTL_MS;
}

const mem = new Map<string, { ts: number; user: any }>();

function profileRef(walletId: string) {
    return db.collection("caches").doc(`user-profile-${walletId}`);
}

function memSet(id: string, ts: number, user: any) {
    mem.set(id, { ts, user });
    if (mem.size > MEM_MAX) {
        // Evict least-recently-inserted (Map preserves insertion order).
        const oldest = mem.keys().next().value;
        if (oldest !== undefined) mem.delete(oldest);
    }
}

/**
 * Resolve raw user docs (`{ id, ...data }`) for a set of walletIds, served from
 * the two-tier cache above. Missing users are simply omitted (same as the
 * underlying `walletId in` query). Order is not guaranteed to match the input —
 * callers resolve by id, not position.
 */
export async function getUserProfilesByWalletIds(
    walletIds: string[]
): Promise<any[]> {
    const ids = Array.from(
        new Set(
            (walletIds || [])
                .map((w) => (w || "").toLowerCase())
                .filter(Boolean)
        )
    );
    if (!ids.length) return [];

    const now = Date.now();
    // `null` is a valid (negative) resolution: most NFT owner/creator wallets
    // have no oncyber profile, and without caching the not-found result every
    // display lookup of those wallets re-runs the live query forever.
    const resolved: Record<string, any> = {};
    let misses: string[] = [];

    // 1. in-process
    for (const id of ids) {
        const hit = mem.get(id);
        if (hit && now - hit.ts < profileTtl(hit.user)) {
            resolved[id] = hit.user;
        } else {
            misses.push(id);
        }
    }

    // 2. cross-instance cache docs (one batched getAll)
    if (misses.length) {
        try {
            const snaps = await db.getAll(...misses.map(profileRef));
            const next: string[] = [];
            snaps.forEach((snap: any, i: number) => {
                const id = misses[i];
                const data = snap.data();
                if (data && now - data.ts < profileTtl(data.user)) {
                    resolved[id] = data.user;
                    memSet(id, data.ts, data.user);
                } else {
                    next.push(id);
                }
            });
            misses = next;
        } catch (err) {
            // fall through to the live read for everything still missing
        }
    }

    // 3. live read for the rest, then publish to both cache tiers
    if (misses.length) {
        const fresh = await getContentByIds("users", "walletId", misses);
        for (const user of fresh) {
            const key = (user?.walletId || "").toLowerCase();
            if (!key) continue;
            resolved[key] = user;
            memSet(key, now, user);
            // Best-effort shared write; never block or fail the request on it.
            profileRef(key)
                .set({ ts: now, user })
                .catch(() => {});
        }
        // Negative-cache the walletIds the live query didn't return, so
        // profile-less wallets stop re-querying on every lookup.
        for (const id of misses) {
            if (id in resolved) continue;
            resolved[id] = null;
            memSet(id, now, null);
            profileRef(id)
                .set({ ts: now, user: null })
                .catch(() => {});
        }
    }

    return ids.map((id) => resolved[id]).filter(Boolean);
}

/**
 * Drop a wallet's cached profile (both tiers) after a write to its user doc
 * (profile update, new avatar, account link/merge), so the caches never serve
 * the pre-write snapshot for a full TTL. Best-effort: only this instance's
 * in-process entry is cleared, but the shared doc delete covers cold reads
 * everywhere.
 */
export function invalidateUserProfile(walletId: string): void {
    const id = (walletId || "").toLowerCase();
    if (!id) return;
    mem.delete(id);
    profileRef(id)
        .delete()
        .catch(() => {});
}

export async function getUserProfileByWalletId(
    walletId: string
): Promise<any | null> {
    const [user] = await getUserProfilesByWalletIds([walletId]);
    return user || null;
}

/**
 * Is `accountId` the signed-in account itself, or one already linked to it?
 * Linking proved control of the linked account (its signature or id token),
 * so its records may be moved into the signed-in account. Reads the live
 * user document, never the display cache above.
 */
export async function isOwnOrLinkedAccount(
    sessionUserId: unknown,
    accountId: unknown
): Promise<boolean> {
    if (typeof sessionUserId !== "string" || !sessionUserId) return false;
    if (typeof accountId !== "string" || !accountId) return false;
    if (sessionUserId.toLowerCase() === accountId.toLowerCase()) return true;
    const snap = await db
        .collection("users")
        .where("walletId", "==", sessionUserId.toLowerCase())
        .limit(1)
        .get();
    const linked = snap.empty ? [] : snap.docs[0].data()?.linkedAccounts;
    return Array.isArray(linked) && linked.includes(accountId.toLowerCase());
}

/**
 * A user document as anyone may see it: the same document without the
 * e-mail addresses (the account's own and those of its linked sign-ins,
 * stored in `linkedAccountsData` and returned resolved as `linkedAccounts`).
 * The raw documents above are for server-side use and for the owner.
 */
export function publicUserProfile<T extends Record<string, any>>(user: T): T {
    if (!user || typeof user !== "object") return user;
    const { email, ...rest } = user as Record<string, any>;
    for (const field of ["linkedAccountsData", "linkedAccounts"]) {
        if (!Array.isArray(rest[field])) continue;
        rest[field] = rest[field].map((account) => {
            if (!account || typeof account !== "object") return account;
            const { email: linkedEmail, ...linked } = account;
            return linked;
        });
    }
    return rest as T;
}
