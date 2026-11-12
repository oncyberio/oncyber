import { db, fire } from "@utils/firebaseAdmin";

// ---------------------------------------------------------------------------
// Cross-instance index of a user's upload library.
//
// `users/{id}/assets-upload-content` is read (up to MAX_UPLOADS docs) on every
// picker open — the single biggest Firestore read line (~14k reads/day for
// ~280 opens). This index folds the whole library into ONE
// `caches/upload-index-{userId}` doc keyed by hash, so an open costs 1 read.
//
// The subcollection stays the source of truth; the index is a cache:
// - maintained by best-effort merge-writes (`patchUploadIndex`) AFTER each
//   primary commit — a failed/oversized index write must never sink the real
//   write, so it is never part of the primary batch/transaction;
// - rebuilt transactionally from the subcollection whenever it's missing,
//   incomplete (a patch landed before any rebuild — e.g. the asset-optimize
//   cloud function writing against a not-yet-built index), or older than
//   UPLOAD_INDEX_REBUILD_MAX_AGE_MS (bounds drift from a crash between the
//   primary write and its patch);
// - stored TOP-LEVEL under `caches/` (server-only per deployed rules), NOT as
//   a user subcollection: forceMergeAccount copies user subcollections
//   generically and would clobber a subcollection-resident index on merge.
//   Account merges instead delete both users' index docs (see link.ts).
//
// Users with more than MAX_UPLOADS entries (or a library too big for one 1MiB
// doc) simply never get a served index — the rebuild fails or marks `partial`,
// and the caller falls back to the plain capped subcollection query, which is
// exactly today's behavior.
// ---------------------------------------------------------------------------

export const MAX_UPLOADS = 500;

export const UPLOAD_INDEX_REBUILD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function uploadIndexRef(userId: string) {
    return db.collection("caches").doc(`upload-index-${userId}`);
}

/**
 * Best-effort incremental patch after a committed subcollection write.
 * `entries` maps hash -> entry object (or fire.FieldValue.delete()).
 * Never throws; on failure the index doc is dropped so the next read rebuilds
 * from the subcollection instead of serving a stale copy.
 */
export function patchUploadIndex(
    userId: string,
    entries: Record<string, any>
): Promise<unknown> {
    return uploadIndexRef(userId)
        .set({ v: Date.now(), entries }, { merge: true })
        .catch(() =>
            uploadIndexRef(userId)
                .delete()
                .catch(() => {})
        );
}

/**
 * Serve the upload library from the index (1 read), rebuilding it from the
 * subcollection when missing/stale. Returns null when the library can't be
 * indexed (oversized) — the caller falls back to the direct query.
 */
export async function readUploadIndex(userId: string): Promise<any[] | null> {
    try {
        const data = (await uploadIndexRef(userId).get()).data();
        if (
            data?.complete === true &&
            Date.now() - (data.rebuiltAt || 0) <
                UPLOAD_INDEX_REBUILD_MAX_AGE_MS
        ) {
            return Object.values(data.entries || {});
        }
    } catch (err) {
        // ignore — try a rebuild below
    }
    return rebuildUploadIndex(userId);
}

async function rebuildUploadIndex(userId: string): Promise<any[] | null> {
    try {
        return await db.runTransaction(async (t) => {
            const ref = uploadIndexRef(userId);

            // Read the index doc inside the transaction so a concurrent
            // incremental patch conflicts and retries this rebuild instead of
            // being silently overwritten by the set() below.
            await t.get(ref);

            const snap = await t.get(
                db
                    .collection("users")
                    .doc(userId)
                    .collection("assets-upload-content")
                    .orderBy(fire.FieldPath.documentId())
                    .limit(MAX_UPLOADS + 1)
            );

            const docs = snap.docs.slice(0, MAX_UPLOADS);
            const entries: Record<string, any> = {};
            for (const doc of docs) {
                entries[doc.id] = doc.data();
            }

            const now = Date.now();
            t.set(ref, {
                v: now,
                rebuiltAt: now,
                complete: true,
                // The library exceeds the cap — the index mirrors the same
                // first-MAX_UPLOADS window the direct query serves.
                partial: snap.docs.length > MAX_UPLOADS,
                entries,
            });

            return Object.values(entries);
        });
    } catch (err) {
        // Oversized library (index doc over the 1MiB cap) or contention.
        // Drop any partial doc so a skeleton never masquerades as an index,
        // and let the caller fall back to the direct subcollection query.
        console.warn("upload-index rebuild failed", userId, err?.message);
        uploadIndexRef(userId)
            .delete()
            .catch(() => {});
        return null;
    }
}
