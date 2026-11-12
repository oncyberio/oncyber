import { db, fire } from "@utils/firebaseAdmin";
import type { firestore } from "firebase-admin";
import {
    assertDestinationStatusMove,
    NEW_DESTINATION,
} from "./destinationStatus";
import type { DestinationStatusActor } from "./destinationStatus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DestinationTag =
    | "featured"
    | "curated"
    | "factory"
    | "free"
    | "collectibles"
    | "uploaded"
    | "andfriends"
    | "factory-polygon"
    | "active";

// The moves between these, and who may make them: ./destinationStatus.
export type DestinationStatus =
    | "tested"
    | "submitted"
    | "rejected"
    | "verified"
    // Written by the mint dialog when a drop was created on chain but could
    // not be saved here; the team resolves it.
    | "failed"
    | "active";

export interface DestinationAuthor {
    username?: string;
    id: string;
    email?: string;
    userId: string;
    name?: string;
    twitter?: string;
}

export interface DestinationPaths {
    low?: string;
    mid?: string;
    high?: string;
}

/**
 * Firestore document shape for the `destinations` collection.
 * Mirrors the MongoDB Destination model with an explicit `userId` field
 * at the top level for efficient user-scoped queries.
 */
export interface DestinationDoc {
    // Identity
    slug: string;
    name: string;
    description: string;
    status: DestinationStatus;
    tag: DestinationTag[];

    // Owner — top-level userId for indexed queries
    userId: string;
    author: DestinationAuthor;

    // 3D Model Paths
    path?: string;
    path_low?: string;
    path_mid?: string;
    original_path?: string;
    paths?: DestinationPaths;
    spline?: string;
    animation_url?: string;

    // Room Parameters
    params?: Record<string, any>;

    // Media
    image?: string;
    thumbnail?: string;
    openSeaUrl?: string;

    // Hashes
    destHash?: string;
    animationHash?: string;
    thumbHash?: string;
    ipfsHashMetadata?: string;

    // NFT / Contract
    contractName?: string;
    contract_address?: string;
    token_id?: string;
    nonFungible?: boolean;
    quantity?: number;
    preMinted?: boolean;
    personalMinted?: boolean;
    price?: string;
    max_number_of_tokens?: number;
    numberOfEditions?: number;
    distributionType?: string;
    collectionName?: string;
    isClaimActive?: boolean;
    whitelist_url?: string;
    shareCyber?: number;
    startTime?: string;
    endTime?: string;
    nbElements?: number;

    // Timestamps
    created_at: firestore.Timestamp;
    updated_at: firestore.Timestamp;
}

// ---------------------------------------------------------------------------
// Collection reference
// ---------------------------------------------------------------------------

const COLLECTION = "new-destinations";

export function destinationsRef() {
    return db.collection(COLLECTION);
}

// ---------------------------------------------------------------------------
// Active-catalog cache version
// ---------------------------------------------------------------------------
//
// The active catalog (status == "active") is served through a long-CDN-cached
// endpoint keyed by this version. Bumping it on any change to the active set
// makes the CDN serve a fresh copy immediately, so the expensive full query
// only re-runs on publish, not on every page view. See
// /api/destinations/active and /api/destinations/active-version.

const VERSION_DOC = db.collection("caches").doc("active-destinations-meta");

// Materialized snapshot of the active catalog. The active query returns
// ~hundreds of docs and is reached by every CDN origin-fill / SWR revalidation
// (each landing on a cold serverless instance where the in-memory cache below
// is empty), so it kept costing ~N reads per fill. We denormalize the catalog
// into a handful of chunk docs on every active-set write; reads then cost
// ceil(N / CHUNK) doc reads instead of an N-doc query. Chunked to stay well
// under Firestore's 1 MB/doc limit.
const SNAPSHOT_CHUNKS = db
    .collection("caches")
    .doc("active-destinations-snapshot")
    .collection("chunks");
// Pack chunks by serialized size instead of a fixed doc count: reads bill per
// chunk DOC, so fewer, fuller chunks are strictly cheaper. 750KB leaves
// headroom under Firestore's 1MiB doc cap (JSON length is a close-enough proxy
// for Firestore's serialized size here).
const ACTIVE_CATALOG_CHUNK_MAX_BYTES = 750_000;

/** Run the live active-set query (status == "active", ordered newest first). */
async function queryActiveDestinations() {
    const snap = await destinationsRef()
        .where("status", "==", "active")
        .orderBy("created_at", "desc")
        .get();
    return snap.docs.map(docToDestination);
}

/**
 * Rebuild the materialized active-catalog snapshot. Runs the live query once
 * and writes it into ordered chunk docs, deleting any chunks left over from a
 * previously-larger catalog. Best effort — the caller swallows errors.
 */
async function rebuildActiveCatalogSnapshot(
    docs?: (DestinationDoc & { _id: string })[]
): Promise<void> {
    const active = docs ?? (await queryActiveDestinations());

    // Greedy size packing: start a new chunk only when adding the next doc
    // would push the current one past the byte budget. A single doc larger
    // than the budget still gets its own chunk (same failure mode as before
    // if it exceeds the hard 1MiB cap: the batch throws, caller falls back).
    const chunks: (DestinationDoc & { _id: string })[][] = [];
    let current: (DestinationDoc & { _id: string })[] = [];
    let currentBytes = 0;
    for (const dest of active) {
        let size = 0;
        try {
            size = JSON.stringify(dest)?.length ?? 0;
        } catch (err) {
            // Non-serializable doc — skip it rather than sink the snapshot.
            continue;
        }
        if (
            current.length &&
            currentBytes + size > ACTIVE_CATALOG_CHUNK_MAX_BYTES
        ) {
            chunks.push(current);
            current = [];
            currentBytes = 0;
        }
        current.push(dest);
        currentBytes += size;
    }
    if (current.length) chunks.push(current);
    const newChunkCount = chunks.length;

    const batch = db.batch();
    chunks.forEach((slice, i) => {
        batch.set(SNAPSHOT_CHUNKS.doc(String(i)), { i, destinations: slice });
    });

    // Drop stale chunks beyond the new count (catalog shrank).
    const existing = await SNAPSHOT_CHUNKS.get();
    existing.docs.forEach((doc) => {
        if (Number(doc.id) >= newChunkCount) batch.delete(doc.ref);
    });

    await batch.commit();
}

/**
 * Read the materialized active-catalog snapshot. Returns null when no snapshot
 * exists yet (first deploy / failed build) so the caller can fall back to the
 * live query.
 */
async function readActiveCatalogSnapshot(): Promise<
    (DestinationDoc & { _id: string })[] | null
> {
    try {
        const chunkSnap = await SNAPSHOT_CHUNKS.orderBy("i").get();
        if (chunkSnap.empty) return null;

        const docs: (DestinationDoc & { _id: string })[] = [];
        for (const chunk of chunkSnap.docs) {
            const arr = chunk.data()?.destinations;
            if (Array.isArray(arr)) docs.push(...arr);
        }
        return docs;
    } catch (err) {
        console.error("Failed to read active catalog snapshot", err);
        return null;
    }
}

/** Bump the active-catalog cache version. Never throws (best effort). */
export async function bumpActiveCatalogVersion(): Promise<void> {
    // Drop the in-process active-set cache so this instance reflects the change
    // immediately (cross-instance staleness is bounded by ACTIVE_SET_TTL_MS).
    invalidateActiveDestinationsCache();
    try {
        await VERSION_DOC.set({ v: Date.now() }, { merge: true });
    } catch (err) {
        console.error("Failed to bump active catalog version", err);
    }
    // Rebuild the materialized snapshot so subsequent reads cost a few chunk
    // docs instead of the full active query. Runs only on active-set writes
    // (publish / unpublish / etc.), which are rare. Best effort.
    try {
        await rebuildActiveCatalogSnapshot();
    } catch (err) {
        console.error("Failed to rebuild active catalog snapshot", err);
    }
}

/** Current active-catalog version (0 if unset/unavailable). */
export async function getActiveCatalogVersion(): Promise<number> {
    try {
        const doc = await VERSION_DOC.get();
        return (doc.data()?.v as number) || 0;
    } catch (err) {
        console.error("Failed to read active catalog version", err);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Convert a Firestore document snapshot into a plain object with `_id`. */
function docToDestination(
    doc: firestore.DocumentSnapshot
): DestinationDoc & { _id: string } {
    return { _id: doc.id, ...(doc.data() as DestinationDoc) };
}

/** Get a single destination by its Firestore document ID. */
export async function getDestinationById(id: string) {
    const doc = await destinationsRef().doc(id).get();
    if (!doc.exists) return null;
    return docToDestination(doc);
}

// ---------------------------------------------------------------------------
// slug -> destination cache
// ---------------------------------------------------------------------------
//
// getDestinationBySlug runs `where(slug == ?).limit(1)` and is called on every
// public space/mint page view (SSR + the /api/destinations/[slug] endpoint + the
// getDestinationBySlug RPC). slug -> destination is the same for every viewer and
// changes rarely, so this in-process cache collapses repeated reads to at most
// one Firestore query per slug per TTL window per warm instance. Unlike the
// exhibit cache we don't version-validate per call: a slug query already returns
// a single doc, so a projected "version" read wouldn't cut the read count — the
// TTL is the staleness bound instead. Writers/editors pass `{ fresh: true }`.
//
// Found destinations get a long TTL (their metadata changes rarely, and the
// owner's own edit view bypasses the cache). Misses get a much shorter TTL so a
// brand-new slug visited right after creation isn't pinned as "not found".
const SLUG_CACHE_MAX = 500;
// Destination metadata changes rarely and editors bypass the cache with
// `{ fresh: true }`, so a long hit TTL collapses the per-pageview slug query to
// ~one read per slug per 30min per warm instance (down from every 5min).
const SLUG_HIT_TTL_MS = 30 * 60 * 1000;
const SLUG_MISS_TTL_MS = 20 * 1000;
type SlugDestination = DestinationDoc & { _id: string };
type SlugRequest = { promise: Promise<SlugDestination | null> };
type SlugCacheState = {
    entries: Map<string, { ts: number; dest: SlugDestination | null }>;
    pending: Map<string, SlugRequest>;
    generation: number;
};
// Next can evaluate this server-only module separately for different routes or
// reload it in development. Keep public metadata warm within this process.
// Authentication, exhibit versions and admission decisions never enter here.
const SLUG_CACHE_KEY = Symbol.for("oncyber.destination-slug-cache.v1");
const cacheGlobal = globalThis as unknown as Record<symbol, SlugCacheState>;
const slugState = (cacheGlobal[SLUG_CACHE_KEY] ||= {
    entries: new Map(),
    pending: new Map(),
    generation: 0,
});
const slugCache = slugState.entries;

export function invalidateDestinationSlugCache(slug?: string): void {
    // Old in-flight reads may finish for their original callers, but cannot
    // publish stale values after a write or an explicit fresh read.
    if (slug === undefined) {
        slugCache.clear();
        slugState.pending.clear();
    } else {
        slugCache.delete(slug);
        slugState.pending.delete(slug);
    }
    // Other module instances must not refill from an older local catalog.
    slugState.generation++;
}

function cacheSlug(slug: string, dest: SlugDestination | null) {
    slugCache.delete(slug);
    slugCache.set(slug, { ts: Date.now(), dest });
    if (slugCache.size > SLUG_CACHE_MAX) {
        const oldest = slugCache.keys().next().value;
        if (oldest !== undefined) slugCache.delete(oldest);
    }
}

/** Get a single destination by slug (unique field). */
export async function getDestinationBySlug(
    slug: string,
    { fresh = false }: { fresh?: boolean } = {}
) {
    if (!fresh) {
        const hit = slugCache.get(slug);
        const ttl = hit?.dest ? SLUG_HIT_TTL_MS : SLUG_MISS_TTL_MS;
        if (hit && Date.now() - hit.ts < ttl) {
            slugCache.delete(slug);
            slugCache.set(slug, hit);
            return hit.dest;
        }
        slugCache.delete(slug);

        // Reuse a catalog only when it is already warm. Loading hundreds of
        // destinations to resolve a single slug makes each cold page slower.
        const active = getWarmActiveDestinationBySlug(slug);
        if (active) {
            cacheSlug(slug, active);
            return active;
        }
        const pending = slugState.pending.get(slug);
        if (pending) return pending.promise;
    } else {
        invalidateDestinationSlugCache(slug);
    }

    const request: SlugRequest = { promise: null };
    // Bound coalescing state as well as completed results under many slugs.
    if (slugState.pending.size < SLUG_CACHE_MAX) {
        slugState.pending.set(slug, request);
    }
    request.promise = (async () => {
        try {
            const snap = await destinationsRef()
                .where("slug", "==", slug)
                .limit(1)
                .get();
            const dest = snap.empty ? null : docToDestination(snap.docs[0]);
            if (slugState.pending.get(slug) === request) cacheSlug(slug, dest);
            return dest;
        } finally {
            if (slugState.pending.get(slug) === request) {
                slugState.pending.delete(slug);
            }
        }
    })();
    return request.promise;
}

/** Check whether a slug already exists. */
export async function destinationExistsBySlug(slug: string): Promise<boolean> {
    const snap = await destinationsRef()
        .where("slug", "==", slug)
        .limit(1)
        .select()
        .get();

    return !snap.empty;
}

/** Get a single destination by token ID. */
export async function getDestinationByTokenId(tokenId: string) {
    const snap = await destinationsRef()
        .where("token_id", "==", tokenId)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return docToDestination(snap.docs[0]);
}

/** Get all destinations for a given user, ordered by creation date desc. */
export async function getDestinationsByUserId(
    userId: string,
    limit = 50,
    startAfterDoc?: firestore.DocumentSnapshot
) {
    let query = destinationsRef()
        .where("userId", "==", userId)
        .orderBy("created_at", "desc")
        .limit(limit);

    if (startAfterDoc) {
        query = query.startAfter(startAfterDoc);
    }

    const snap = await query.get();
    return snap.docs.map(docToDestination);
}

/** Get a user's destination by slug. */
export async function getUserDestinationBySlug(userId: string, slug: string) {
    const snap = await destinationsRef()
        .where("userId", "==", userId)
        .where("slug", "==", slug)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return docToDestination(snap.docs[0]);
}

/** Count destinations for a given user. */
export async function countDestinationsByUserId(
    userId: string
): Promise<number> {
    // count() aggregation bills 1 read per 1000 docs instead of 1 per doc
    const snap = await destinationsRef()
        .where("userId", "==", userId)
        .count()
        .get();

    return snap.data().count;
}

/**
 * Get all destinations matching a tag, with optional pagination.
 * Sorted by created_at descending.
 */
export async function getDestinationsByTag(
    tag: string,
    limit = 50,
    startAfterDoc?: firestore.DocumentSnapshot
) {
    let query = destinationsRef()
        .where("tag", "array-contains", tag)
        .orderBy("created_at", "desc")
        .limit(limit);

    if (startAfterDoc) {
        query = query.startAfter(startAfterDoc);
    }

    const snap = await query.get();
    return snap.docs.map(docToDestination);
}

/**
 * Fetch all destinations with pagination.
 * Sorted by created_at descending.
 */
export async function getAllDestinations(
    limit = 50,
    startAfterDoc?: firestore.DocumentSnapshot
) {
    let query = destinationsRef().orderBy("created_at", "desc").limit(limit);

    if (startAfterDoc) {
        query = query.startAfter(startAfterDoc);
    }

    const snap = await query.get();
    return snap.docs.map(docToDestination);
}

/**
 * Batch-fetch destinations by an array of slugs.
 * Firestore `in` queries support up to 30 items, so we chunk.
 */
export async function getDestinationsBySlugs(slugs: string[]) {
    if (slugs.length === 0) return [];

    const results: (DestinationDoc & { _id: string })[] = [];

    // Firestore `in` supports max 30 values per query
    const chunkSize = 30;
    for (let i = 0; i < slugs.length; i += chunkSize) {
        const chunk = slugs.slice(i, i + chunkSize);
        const snap = await destinationsRef().where("slug", "in", chunk).get();

        snap.docs.forEach((doc) => results.push(docToDestination(doc)));
    }

    return results;
}

/** Get upcoming destinations (active claims with future end times). */
export async function getUpcomingDestinations() {
    const now = new Date().toISOString();

    const snap = await destinationsRef()
        .where("isClaimActive", "==", true)
        .where("endTime", ">", now)
        .orderBy("endTime", "asc")
        .get();

    return snap.docs.map(docToDestination);
}

// The active set (status == "active", ~hundreds of docs) is read by BOTH
// getActiveDestinations (the CDN-cached catalog endpoint) and getCreatedSpaces
// (the per-user, POST-only "my spaces" RPC, which can't be CDN-cached). Both
// re-read the same global ~361-doc set, so this short-lived in-process cache
// collapses that read regardless of entry point. It's invalidated immediately on
// any active-set write (see bumpActiveCatalogVersion) for same-instance
// freshness; the TTL is the cross-instance backstop and is far tighter than the
// 1h CDN cache in front of getActiveDestinations. 30min means a publish or
// unpublish can lag up to 30min on OTHER warm instances (my-spaces list, slug
// resolution of already-active spaces) — accepted tradeoff, catalog writes are
// rare and brand-new slugs still resolve immediately via the direct-query
// fallback in getDestinationBySlug.
const ACTIVE_SET_TTL_MS = 30 * 60 * 1000;
let activeSetCache: {
    ts: number;
    generation: number;
    docs: (DestinationDoc & { _id: string })[];
} | null = null;

export function invalidateActiveDestinationsCache() {
    activeSetCache = null;
    invalidateDestinationSlugCache();
}

function getWarmActiveDestinationBySlug(slug: string) {
    if (
        !activeSetCache ||
        activeSetCache.generation !== slugState.generation ||
        Date.now() - activeSetCache.ts >= ACTIVE_SET_TTL_MS
    )
        return null;
    return activeSetCache.docs.find((dest) => dest.slug === slug) ?? null;
}

async function readActiveDestinations() {
    if (
        activeSetCache &&
        activeSetCache.generation === slugState.generation &&
        Date.now() - activeSetCache.ts < ACTIVE_SET_TTL_MS
    ) {
        return activeSetCache.docs;
    }

    // Prefer the materialized snapshot (a few chunk docs) over the full active
    // query (~hundreds of docs). The snapshot is rebuilt on every active-set
    // write, so it's as fresh as the in-memory cache it backs.
    const generation = slugState.generation;
    let docs = await readActiveCatalogSnapshot();

    if (!docs) {
        // No snapshot yet (first deploy, or a failed build) — fall back to the
        // live query and rebuild the snapshot for next time.
        docs = await queryActiveDestinations();
        rebuildActiveCatalogSnapshot(docs).catch((err) =>
            console.error("Failed to rebuild active catalog snapshot", err)
        );
    }

    activeSetCache = { ts: Date.now(), generation, docs };
    return docs;
}

/**
 * Get all active destinations — the marketplace catalog, identical for
 * every user. Reads one doc per active destination, so serve it through
 * the CDN-cached /api/destinations/active endpoint rather than calling
 * it per authenticated request.
 */
export async function getActiveDestinations() {
    return readActiveDestinations();
}

/**
 * Get destinations created by a user (their "spaces").
 * Returns all active destinations plus the user's own destinations
 * (regardless of status). Matches the server's getCreatedSpaces logic.
 *
 * @param isFuture - Optional filter on `params.isFuture`:
 *   - undefined: no filtering
 *   - "true": only destinations where params.isFuture === true
 *   - "false": only destinations where params.isFuture is false or missing
 */
export async function getCreatedSpaces(userId: string, isFuture?: string) {
    // Firestore doesn't support OR across different fields in a single query,
    // so we run two queries and deduplicate by document ID. The active half is
    // the same global ~361-doc set for every user, so it comes from the shared
    // active-set cache; only the per-user half is read fresh.
    const [active, userSnap] = await Promise.all([
        readActiveDestinations(),
        destinationsRef()
            .where("userId", "==", userId)
            .orderBy("created_at", "desc")
            .get(),
    ]);

    const seen = new Set<string>();
    const results: (DestinationDoc & { _id: string })[] = [];

    // Merge both result sets, deduplicating by document ID. The cached active
    // set is already mapped; the per-user snapshot still needs mapping.
    for (const dest of active) {
        if (!seen.has(dest._id)) {
            seen.add(dest._id);
            results.push(dest);
        }
    }
    for (const doc of userSnap.docs) {
        if (!seen.has(doc.id)) {
            seen.add(doc.id);
            results.push(docToDestination(doc));
        }
    }

    // Apply isFuture filtering (matches server logic)
    let filtered = results;
    if (isFuture === "true") {
        filtered = results.filter((d) => d.params?.isFuture === true);
    } else if (isFuture === "false") {
        filtered = results.filter(
            (d) => d.params?.isFuture === false || d.params?.isFuture == null
        );
    }

    // Sort by created_at descending (since we merged two sorted lists)
    filtered.sort((a, b) => {
        const aTime = a.created_at?.toMillis?.() ?? 0;
        const bTime = b.created_at?.toMillis?.() ?? 0;
        return bTime - aTime;
    });

    return filtered;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Who a status write is made for. Defaults to the owner, so a caller has to
 * say so explicitly to publish (`mint`) or to act as review; see
 * `./destinationStatus` for the moves each may make.
 */
type StatusWriteOptions = { actor?: DestinationStatusActor };

/**
 * Create a new destination document. Returns the new document ID.
 * Throws when `actor` may not create a destination with `data.status`
 * (an owner's destination starts as "tested").
 */
export async function createDestination(
    data: Omit<DestinationDoc, "created_at" | "updated_at">,
    { actor = "owner" }: StatusWriteOptions = {}
): Promise<string> {
    assertDestinationStatusMove(NEW_DESTINATION, data?.status, actor);

    const now = fire.Timestamp.now();
    const docRef = await destinationsRef().add({
        ...data,
        // Ensure userId is set from author for query indexing
        userId: data.userId || data.author?.userId,
        created_at: now,
        updated_at: now,
    });

    invalidateDestinationSlugCache(data.slug);

    // Drafts are created as "tested"; only invalidate if created active.
    if ((data as any)?.status === "active") {
        await bumpActiveCatalogVersion();
    }

    return docRef.id;
}

/**
 * Update an existing destination by document ID.
 * A write that carries a `status` is checked against the lifecycle for
 * `actor` first and throws, writing nothing, when the move is not legal.
 */
export async function updateDestination(
    id: string,
    data: Partial<DestinationDoc>,
    { actor = "owner" }: StatusWriteOptions = {}
) {
    const ref = destinationsRef().doc(id);

    // Read-before-write to know if this touches the active set (writes are
    // rare, so the extra read is negligible). Invalidate the catalog when the
    // doc is or becomes active — covers publish, unpublish, and edits to a
    // live space's catalog-visible fields.
    const before = await ref.get();
    const beforeStatus = before.data()?.status;

    // `undefined` writes no status (Firestore skips or refuses it).
    if (data?.status !== undefined) {
        assertDestinationStatusMove(beforeStatus, data.status, actor);
    }

    await ref.update({
        ...data,
        updated_at: fire.Timestamp.now(),
    });

    invalidateDestinationSlugCache(before.data()?.slug);
    if (data.slug && data.slug !== before.data()?.slug) {
        invalidateDestinationSlugCache(data.slug);
    }
    const afterStatus = (data as any)?.status ?? beforeStatus;
    if (beforeStatus === "active" || afterStatus === "active") {
        await bumpActiveCatalogVersion();
    }
}

/** Delete a destination by document ID. */
export async function deleteDestination(id: string) {
    const ref = destinationsRef().doc(id);
    const before = await ref.get();
    const wasActive = before.data()?.status === "active";

    await ref.delete();
    invalidateDestinationSlugCache(before.data()?.slug);

    if (wasActive) {
        await bumpActiveCatalogVersion();
    }
}

/**
 * Transfer all destinations from one user to another.
 * Used during account linking / wallet migration.
 */
export async function transferDestinations(
    fromUserId: string,
    toUserId: string
) {
    const snap = await destinationsRef()
        .where("userId", "==", fromUserId)
        .get();

    const batch = db.batch();
    const now = fire.Timestamp.now();

    snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
            userId: toUserId,
            "author.userId": toUserId,
            updated_at: now,
        });
    });

    await batch.commit();

    // Ownership of (possibly active) docs changed — refresh the catalog.
    if (snap.size > 0) {
        await bumpActiveCatalogVersion();
    }

    return snap.size;
}
