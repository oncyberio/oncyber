import { GALLERY_SCRIPTS_RETIRED, hasLegacyGalleryScriptWrite } from "@utils/legacyGalleryScripts";
import { firestore } from "firebase-admin";
import { searchSpaces } from "@utils/firestore/spaceSearch";
import { DEFAULT_FILTERS } from "@features/landing-carousel/data";
import { auth } from "../../utils/middlewares/authMiddleware";
import { db, fire } from "../../utils/firebaseAdmin";
import { Experience, KitBashData, PortalData } from "../../@types/experience";
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import uniqBy from "lodash/uniqBy";
import scaleData from "@utils/metadata/scaleData.json";
import { formatExhibit, formatUpdate } from "@utils/metadata/formatExhibit";
import { deepClone } from "@utils/js";
import { getSlug, oldToNew, pathToSlug } from "@utils/saveToDb";
import { getStylekitByRoom } from "./stylekit";
import {
    getUserProfileByWalletId,
    getUserProfilesByWalletIds,
} from "@utils/firestore/userProfiles";
import { writesProtectedExhibitField } from "@utils/firestore/exhibitWrites";
import { readStaffPickIds } from "@utils/staffPicks";
import {
    stripExhibitSecrets,
    stripSecretsFromJson,
} from "@utils/worldPassword/publicGating";
import { writesWorldPassword } from "@utils/worldPassword/server";

function formatExhibitData(it: Experience) {
    if (it.portals == null) {
        it.portals = {};
    }
    if (it.artworks == null) {
        it.artworks = {};
    }
    it.createdAt =
        (it?.createdAt as any)?.toDate?.()?.toISOString?.() ||
        new Date()?.toISOString?.();
}

export async function getExhibitsByIds(ids): Promise<Experience[]> {
    // Batch fetch for portal-preview neighbors (GET_EXHIBITS_BY_IDS). The client
    // only uses each neighbor's doc-level metadata here — id, owner, info (hero
    // image / room / customLink) and gating fields — to draw the portal preview
    // and run the gating check. The heavy `portals` + `kitbash` subcollections
    // are ONLY needed when you actually enter that space in 3D, which does its
    // own full fetch on demand (getPortalExhibit -> FETCH_SINGLE_EXHIBIT). So we
    // read the exhibit docs only and deliberately skip BOTH subcollections here —
    // this was spending the entire /exhibits/*/kitbash + /portals read volume on
    // previews that never render that geometry.
    const list = (ids || []).filter(Boolean);
    if (!list.length) return [];

    const docs = await db.getAll(
        ...list.map((id: string) => db.collection("exhibits").doc(id))
    );

    const exhibits = docs
        .filter((doc: any) => doc.exists)
        .map((doc: any) =>
            stripExhibitSecrets({ ...doc.data(), id: doc.id } as Experience)
        );

    exhibits.forEach(formatExhibitData);

    return exhibits;
}

// The doc fields a portal preview draws from: the hero images and title
// (info), the owner card, and the password prompt (gating). Everything else,
// above all the artworks map that makes up most of an exhibit's bytes, is
// fetched with the full exhibit when the visitor opens the portal.
export const EXHIBIT_PREVIEW_FIELDS = [
    "owner",
    "info",
    "gating",
    "runtime",
    "version",
    "createdAt",
    "lastUpdatedAt",
    "lastContentUpdatedAt",
];

// Previews are public doc fields and may be a minute old; a CDN serves
// repeat visits of a hub without reaching Firestore.
export const EXHIBIT_PREVIEWS_CACHE_CONTROL =
    "public, s-maxage=60, stale-while-revalidate=300";

const MAX_PREVIEW_IDS = 100;

/** `?ids=a,b,c` to a list of exhibit doc ids (no paths, no duplicates). */
export function parseExhibitPreviewIds(value: unknown): string[] {
    const raw = Array.isArray(value) ? value.join(",") : String(value || "");
    const ids = raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id.length <= 128 && !id.includes("/"));
    return Array.from(new Set(ids)).slice(0, MAX_PREVIEW_IDS);
}

export async function getExhibitPreviewsByIds(
    ids: string[]
): Promise<Experience[]> {
    if (!ids?.length) return [];

    const docs = await db.getAll(
        ...ids.map((id: string) => db.collection("exhibits").doc(id)),
        { fieldMask: EXHIBIT_PREVIEW_FIELDS }
    );

    // Public and CDN-cached: the password prompt needs `gating`, never the
    // password.
    const exhibits = docs
        .filter((doc: any) => doc.exists)
        .map((doc: any) =>
            stripExhibitSecrets({ ...doc.data(), id: doc.id } as Experience)
        );

    exhibits.forEach(formatExhibitData);

    return exhibits;
}

// Some community exhibits accumulated thousands of portals (6529om has 3000+),
// so every fetch reads the whole `portals` subcollection — thousands of
// Firestore reads per visit, plus thousands of portal meshes on the client.
// Cap how many portals we load for those exhibits, keyed by custom link or
// exhibit id. Which portals survive the cap is arbitrary (Firestore default
// doc-id order) — good enough until we curate/limit portals properly.
const MAX_PORTALS_PER_EXHIBIT: Record<string, number> = {
    "6529om": 50,
};

// Hard ceiling applied to every portals fetch, so no exhibit (curated cap or
// not) can trigger an unbounded subcollection scan. One exhibit alone read
// 3,255 portal docs in a single call; this bounds the Firestore query itself.
const DEFAULT_MAX_PORTALS = 100;

function getPortalLimit(exhibit: Experience): number | undefined {
    return (
        MAX_PORTALS_PER_EXHIBIT[exhibit.info?.customLink] ??
        MAX_PORTALS_PER_EXHIBIT[exhibit.id]
    );
}

export const getExhibitPortals = async (
    id: string,
    limit?: number
): Promise<{ [key: string]: PortalData }> => {
    const query: firestore.Query = db
        .collection("exhibits")
        .doc(id)
        .collection("portals")
        .limit(limit || DEFAULT_MAX_PORTALS);

    const snapshot = await query.get();

    const portals: { [key: string]: PortalData } = {};

    snapshot.forEach((doc: any) => {
        portals[doc.id] = {
            id: doc.id,
            ...doc.data(),
        };
    });

    return portals;
};

export const getExhibitKitbash = async (
    id: string
): Promise<Record<string, KitBashData>> => {
    const snapshot = await db
        .collection("exhibits")
        .doc(id)
        .collection("kitbash")
        .get();

    const kitbash: Record<string, KitBashData> = {};

    snapshot.forEach((doc: any) => {
        kitbash[doc.id] = {
            id: doc.id,
            ...doc.data(),
        };
    });

    return kitbash;
};

export const updatePortals = async (
    exhibitId: string,
    exhibit: Experience,
    payload,
    transaction,
    { lastUpdatedAt, lastContentUpdatedAt }
) => {
    //

    const exhibitRef = db.collection("exhibits").doc(exhibitId);

    const portalref = exhibitRef.collection("portals").doc(payload.portalId);

    let exhibitUpdateArgs = [];

    // delete portal stored in old portals field
    if (exhibit.portals?.[payload.portalId]) {
        exhibitUpdateArgs.push(
            new firestore.FieldPath("portals", payload.portalId),
            firestore.FieldValue.delete()
        );
    }

    // if this is a replace, delete artwork
    if (
        payload.FIRESTORE_UPDATE_PORTAL &&
        exhibit.artworks?.[payload.portalId]
    ) {
        exhibitUpdateArgs.push(
            new firestore.FieldPath("artworks", payload.portalId),
            firestore.FieldValue.delete()
        );
    }

    let now = Date.now();

    exhibitUpdateArgs.push(lastUpdatedAt, now, lastContentUpdatedAt, now);

    transaction.update(exhibitRef, ...exhibitUpdateArgs);

    if (payload.FIRESTORE_UPDATE_PORTAL) {
        let { update, portalId } = payload;

        if (!portalId || !update)
            return { success: false, error: "Invalid portal data" };

        transaction.set(portalref, update);

        return { success: true };
    } else if (payload.FIRESTORE_DELETE_PORTAL) {
        transaction.delete(portalref);

        return { success: true };
    }

    return { success: true };
};

export async function fetchExhibitSubCollections(exhibit: Experience) {
    //
    let promises = [];

    const portalLimit = getPortalLimit(exhibit);

    if (exhibit.storageVersion === 2) {
        promises.push(
            getExhibitPortals(exhibit.id, portalLimit).then((portals) => {
                exhibit.portals = {
                    ...exhibit.portals,
                    ...portals,
                };
            })
        );
    }

    // Only read the kitbash subcollection when the exhibit actually has one.
    // The flag is set on every kitbash write (see hasKitbash in the update/create
    // paths and the FIRESTORE_RESET_KITBASH branch, which already trusts it), so
    // skipping the fetch here avoids an empty-result Firestore read — billed as 1
    // read — on the large majority of exhibits that carry no kitbash.
    if (exhibit.hasKitbash) {
        promises.push(
            getExhibitKitbash(exhibit.id).then((kitbash) => {
                exhibit.kitbash = {
                    ...kitbash,
                };
            })
        );
    }

    await Promise.all(promises);

    // Also enforce the cap for portals stored in the exhibit doc itself
    // (legacy storage), and for the merged legacy + subcollection result
    if (
        portalLimit &&
        exhibit.portals &&
        Object.keys(exhibit.portals).length > portalLimit
    ) {
        exhibit.portals = Object.fromEntries(
            Object.entries(exhibit.portals).slice(0, portalLimit)
        );
    }
}

// ---------------------------------------------------------------------------
// Server-side exhibit-view cache
// ---------------------------------------------------------------------------
//
// The public space view (SSR getServerSideProps in /[slug] and /spaces/[id], the
// FETCH_SINGLE_EXHIBIT HTTP path, and the client gl loader) reads the full
// exhibit doc PLUS its whole `portals` and `kitbash` subcollections on every
// visit — the bulk of the /exhibits read ops + the entire /exhibits/{id}/kitbash
// read volume. Those reads are identical for every viewer between edits.
//
// This in-process cache serves doc + subcollections from memory, validated by a
// cheap projected version read each call, so a popular space re-reads Firestore
// at most once per edit per warm instance instead of once per view. We key on
// `lastUpdatedAt` — bumped transactionally by EVERY writer (content, editors,
// gating, kitbash, portals via _v2/exhibit/*, AND the asset-optimization cloud
// function's updateAssetInTrans) — so even permission-sensitive callers
// (checkGating/isMod, which also go through getExhibitById) never see stale
// editors/gating. Version-keying is the correctness mechanism; the TTL is only
// a safety net against a hypothetical writer that forgets the version bump, so
// it can be long — at 5min it was refilling doc+portals+kitbash (~14 reads) per
// exhibit per instance all day for nothing.
const EXHIBIT_VERSION_FIELDS = ["lastUpdatedAt", "lastContentUpdatedAt"];
const EXHIBIT_VIEW_CACHE_MAX = 300;
const EXHIBIT_VIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const exhibitViewCache = new Map<
    string,
    { v: number; ts: number; exhibit: Experience }
>();

function exhibitVersion(data: any): number {
    return (
        (data?.lastUpdatedAt as number) ||
        (data?.lastContentUpdatedAt as number) ||
        0
    );
}

function readExhibitCache(id: string, v: number): Experience | null {
    const hit = exhibitViewCache.get(id);
    if (!hit) return null;

    const fresh =
        v !== 0 &&
        hit.v === v &&
        Date.now() - hit.ts < EXHIBIT_VIEW_CACHE_TTL_MS;

    if (!fresh) {
        exhibitViewCache.delete(id);
        return null;
    }

    // Refresh LRU recency.
    exhibitViewCache.delete(id);
    exhibitViewCache.set(id, hit);

    try {
        return deepClone(hit.exhibit);
    } catch (err) {
        // Non-cloneable payload — drop it and fall back to a fresh read.
        exhibitViewCache.delete(id);
        return null;
    }
}

function writeExhibitCache(id: string, v: number, exhibit: Experience): void {
    if (!v) return; // unversioned doc — can't invalidate reliably, don't cache.

    let clone: Experience;
    try {
        clone = deepClone(exhibit);
    } catch (err) {
        return; // skip caching rather than risk sharing a mutable reference.
    }

    exhibitViewCache.set(id, { v, ts: Date.now(), exhibit: clone });

    if (exhibitViewCache.size > EXHIBIT_VIEW_CACHE_MAX) {
        // Evict the least-recently-used entry (Map preserves insertion order).
        const oldest = exhibitViewCache.keys().next().value;
        if (oldest !== undefined) exhibitViewCache.delete(oldest);
    }
}

// Cross-instance backstop for the in-process cache above. In-process caches die
// on every serverless cold start, so on a traffic spike many cold instances each
// re-read the exhibit doc + the whole portals + kitbash subcollections. This lets
// a cold instance serve the entire view from a single cache-doc read. Same
// version-keying (lastUpdatedAt) and TTL backstop as the in-process cache, so
// edits invalidate it immediately and it's never staler than the in-process one.
const SHARED_EXHIBIT_CACHE_MAX_BYTES = 900_000; // headroom under Firestore's 1MB doc cap

function sharedExhibitCacheRef(id: string) {
    return db.collection("caches").doc(`exhibit-view-${id}`);
}

async function readSharedExhibitCache(
    id: string,
    v: number
): Promise<Experience | null> {
    if (!v) return null;
    try {
        const data = (await sharedExhibitCacheRef(id).get()).data();
        if (
            data &&
            data.v === v &&
            Date.now() - data.ts < EXHIBIT_VIEW_CACHE_TTL_MS
        ) {
            return data.exhibit as Experience;
        }
    } catch (err) {
        // ignore — fall back to the live read
    }
    return null;
}

function writeSharedExhibitCache(
    id: string,
    v: number,
    exhibit: Experience
): void {
    if (!v) return;
    let plain: Experience;
    try {
        // JSON round-trip drops undefined (which Firestore set() rejects) and
        // doubles as a rough byte check. Oversized exhibits skip the shared
        // cache and keep doing the live read.
        const json = JSON.stringify(exhibit);
        if (!json || json.length > SHARED_EXHIBIT_CACHE_MAX_BYTES) {
            // Surface the offenders: these exhibits re-read doc+portals+kitbash
            // live on every cold instance because they never hit the shared tier.
            console.warn(
                "exhibit-view cache skip (oversized)",
                id,
                json?.length
            );
            return;
        }
        plain = JSON.parse(json);
    } catch (err) {
        return;
    }
    sharedExhibitCacheRef(id)
        .set({ v, ts: Date.now(), exhibit: plain })
        .catch(() => {});
}

async function loadExhibitView(id: string, v: number): Promise<Experience> {
    // Cold-instance fast path: one cache-doc read instead of the exhibit doc +
    // portals + kitbash. Warm the in-process cache so subsequent calls on this
    // instance skip Firestore entirely.
    // Entries written before passwords were hashed can still hold one.
    const shared = stripExhibitSecrets(await readSharedExhibitCache(id, v));
    if (shared) {
        writeExhibitCache(id, v, shared);
        return shared;
    }

    const doc = await db.collection("exhibits").doc(id).get();

    if (!doc.exists) return null;

    // The view is cached and handed to clients: no world password in it.
    const exhibit = stripExhibitSecrets({
        ...doc.data(),
        id: doc.id,
    } as Experience);

    await fetchExhibitSubCollections(exhibit);

    formatExhibitData(exhibit);

    // Resolve the owner's display name once per cache FILL instead of once per
    // pageview: the SSR path (`ssr.getUser`) only ever needed this one field,
    // and it was the top `users WHERE walletId ==` read driver. Embedding it in
    // the cached payload makes owner resolution free on every cache hit (the
    // shared cache-doc read already happens for the exhibit itself). `null`
    // means "resolved, no profile"; older cache entries without the field fall
    // back to the live lookup in ssr.getUser.
    try {
        const owner = exhibit.owner
            ? await getUserProfileByWalletId(exhibit.owner)
            : null;
        exhibit.ownerName = owner?.username || null;
    } catch (err) {
        exhibit.ownerName = null;
    }

    writeExhibitCache(id, v, exhibit);
    writeSharedExhibitCache(id, v, exhibit);

    return exhibit;
}

export const getExhibitById = async (id: string): Promise<Experience> => {
    // Tiny projected read for the version (a few bytes vs the ~72 KB doc).
    const [versionSnap] = await db.getAll(db.collection("exhibits").doc(id), {
        fieldMask: EXHIBIT_VERSION_FIELDS,
    });

    if (!versionSnap.exists) return null;

    const v = exhibitVersion(versionSnap.data());

    const cached = stripExhibitSecrets(readExhibitCache(id, v));
    if (cached) return cached;

    return loadExhibitView(id, v);
};

export const getExhibitByCustomLink = async (
    customLink
): Promise<Experience> => {
    //
    if (customLink?.startsWith("s@")) {
        return getExhibitById(customLink.slice(2));
    }

    // Resolve customLink -> id + version in one tiny projected read.
    const versionQuery = await db
        .collection("exhibits")
        .where("info.customLink", "==", customLink)
        .select(...EXHIBIT_VERSION_FIELDS)
        .limit(1)
        .get();

    if (versionQuery.empty) {
        return null;
    }

    const id = versionQuery.docs[0].id;
    const v = exhibitVersion(versionQuery.docs[0].data());

    const cached = stripExhibitSecrets(readExhibitCache(id, v));
    if (cached) return cached;

    return loadExhibitView(id, v);
};

const getRadUserExhibits = async (walletId: string, lastVisible: string) => {
    let exhibits = [];
    let snapshot;

    if (lastVisible !== undefined) {
        const last = await db.collection("exhibits").doc(lastVisible).get();
        snapshot = await exhibitsListRef()
            .where("owner", "==", walletId)
            .startAfter(last)
            .limit(50)
            .get();
    } else {
        snapshot = await exhibitsListRef()
            .where("owner", "==", walletId)
            .limit(30)
            .get();
    }

    snapshot.forEach((doc) => {
        exhibits.push({ id: doc.id, ...doc.data() });
    });

    return exhibits;
};

/** Compatibility for existing Studio metadata search callers. */
const searchExhibit = async (searchInput: string, page = 0): Promise<any[]> => {
    const filters = { ...DEFAULT_FILTERS, q: String(searchInput || "").slice(0, 300) };
    if (filters.q.trim().length < 2) return [];
    if (!Number.isInteger(page) || page < 0 || page > 10) return [];
    let result = await searchSpaces(filters);
    for (let i = 0; i < page; i++) {
        if (!result.hasMore) return [];
        result = await searchSpaces(filters, result.cursor);
    }
    return result.exhibits.map(exhibit => ({ ...exhibit, editors: [] }));
};

/**
 * Get Most visited exhibits.
 *
 * @function
 * @param {Array<string> | null} destination
 * @param {string} lastVisible
 * @returns {Array}
 */
// The most-visited leaderboard's first page (no cursor) is global — it ignores
// `destination` and is identical for every viewer (explore/landing/404 page) —
// and visit counts move slowly, so re-reading 30 docs per view is pure waste.
// Cache that page's materialized docs for a few minutes and replay them through
// a snapshot-like `forEach`, so callers downstream stay unchanged. Paginated
// pages (with a cursor) vary per request and aren't cached.
const MOST_VISITED_TTL_MS = 30 * 60 * 1000;
let mostVisitedCache: { ts: number; docs: { id: string; data: any }[] } | null =
    null;
// Cross-instance cache. The in-process cache above is per-serverless-instance
// and dies on cold start, so the 30-doc query still re-ran constantly. This
// shared doc collapses it to a single ~1-doc read per view, with the live
// 30-doc query running at most once per TTL across the whole fleet.
const MOST_VISITED_CACHE_DOC = db
    .collection("caches")
    .doc("exhibits-most-visited");

function snapshotLike(docs: { id: string; data: any }[]) {
    return {
        forEach(cb: (d: { id: string; data: () => any }) => void) {
            docs.forEach((d) => cb({ id: d.id, data: () => d.data }));
        },
    };
}

const getMostVisitedExhibits = async (
    destination: Array<string> | null,
    lastVisible: string
) => {
    if (lastVisible !== undefined) {
        const last = await db.collection("exhibits").doc(lastVisible).get();
        return exhibitsListRef()
            .orderBy("number_of_visits", "desc")
            .startAfter(last)
            .limit(50)
            .get();
    }

    if (
        mostVisitedCache &&
        Date.now() - mostVisitedCache.ts < MOST_VISITED_TTL_MS
    ) {
        return snapshotLike(mostVisitedCache.docs);
    }

    // Cross-instance cache (1 doc read). Survives cold starts, unlike the
    // in-process cache above. On a hit, the 30-doc query is skipped entirely.
    try {
        const cached = (await MOST_VISITED_CACHE_DOC.get()).data();
        if (cached?.docs && Date.now() - cached.ts < MOST_VISITED_TTL_MS) {
            mostVisitedCache = { ts: cached.ts, docs: cached.docs };
            return snapshotLike(cached.docs);
        }
    } catch (e) {
        // fall through to the live query
    }

    const snapshot = await exhibitsListRef()
        .orderBy("number_of_visits", "desc")
        .limit(30)
        .get();

    mostVisitedCache = {
        ts: Date.now(),
        docs: snapshot.docs.map((d) => ({ id: d.id, data: d.data() })),
    };

    // Publish to the shared cache for other instances (best effort).
    MOST_VISITED_CACHE_DOC.set(mostVisitedCache).catch(() => {});

    return snapshotLike(mostVisitedCache.docs);
};

/**
 * Get Today Most visited exhibits.
 *
 * @function
 * @param {Array<string> | null} destination
 * @param {string} lastVisible
 * @returns {Array}
 */
const getTodayMostVisitedExhibits = async (
    destination: Array<string> | null,
    lastVisible: string,
    today_num_of_visits: Record<string, any>
) => {
    let exhibitIds;
    if (lastVisible !== undefined) {
        const last = await db.collection("exhibits").doc(lastVisible).get();
        exhibitIds = await db
            .collection("analytics_days")
            .doc(new Date().toDateString())
            .collection("exhibits")
            .orderBy("number_of_visits", "desc")
            .startAfter(last)
            .limit(55)
            .get();
    } else {
        exhibitIds = await db
            .collection("analytics_days")
            .doc(new Date().toDateString())
            .collection("exhibits")
            .orderBy("number_of_visits", "desc")
            .limit(55)
            .get();
    }
    const analyticsDocs = exhibitIds?.docs || [];

    analyticsDocs.forEach((doc) => {
        today_num_of_visits[doc.id] = doc.data().number_of_visits;
    });

    if (analyticsDocs.length === 0) return [];

    const refs = analyticsDocs.map((doc) =>
        db.collection("exhibits").doc(doc.id)
    );

    // Batch the per-exhibit reads into one round trip and project to the card
    // fields, so `artworks` is never shipped for these list rows.
    return db.getAll(...refs, { fieldMask: EXHIBIT_LIST_FIELDS });
};

const getSpotlightExhibit = async () => {
    let exhibit;
    const snapshot = await db
        .collection("exhibits")
        .where("spotlight", "==", true)
        .limit(1)
        .get();

    snapshot.forEach((doc) => {
        exhibit = {
            id: doc.id,
            ...doc.data(),
        };
    });
    return exhibit;
};

// Fields the list/card UI actually reads. Listing them with `.select()` keeps
// Firestore from shipping the heavy per-exhibit `artworks` map (~72 KB/doc) and
// the legacy top-level `portals` field on list scans — neither is read in a list
// context. Read ops are unchanged (still 1/doc); this targets the read *bytes*.
const EXHIBIT_LIST_FIELDS = [
    "visibility",
    "isPublic",
    "published",
    "mock",
    "deleted",
    "info",
    "owner",
    "editors",
    "likes",
    "number_of_visits",
    "createdAt",
    "spotlight",
    "tags",
    "chains",
    "collections",
    "storageVersion",
    "artistSearch.names",
    "artistSearch.curatorNames",
    "artistSearch.addresses",
];

// Base query for exhibit *lists*, projected to the card fields above.
// Note: pagination cursors (`.doc(lastVisible).get()`) must stay full reads so
// the snapshot still carries the orderBy fields used by `.startAfter()`.
const exhibitsListRef = () =>
    db.collection("exhibits").select(...EXHIBIT_LIST_FIELDS);

const getExhibits = async (isActive, lastVisible, destination, walletId?) => {
    let snapshot;
    let exhibits = [];
    let snapshot1: any = [];
    let today_num_of_visits = {};

    if (isActive == "oncybercurated") {
        //
        const query = exhibitsListRef();

        if (lastVisible) {
            const last = await db.collection("exhibits").doc(lastVisible).get();
            snapshot = await query
                .where("info.room", "in", ["temple", "genesis", "void"])
                .startAfter(last)
                .limit(30)
                .get();
        } else {
            snapshot = await query
                .where("info.room", "in", ["temple", "genesis", "void"])
                .limit(30)
                .get();
        }
    }
    if (isActive == "oncyberlabs") {
        //
        const query = exhibitsListRef();

        if (lastVisible) {
            const last = await db.collection("exhibits").doc(lastVisible).get();
            snapshot = await query
                .where("info.room", "in", [
                    "brute",
                    "coal",
                    "chalk",
                    "altitude",
                    "rtfktspacepod",
                ])
                .startAfter(last)
                .limit(30)
                .get();
        } else {
            snapshot = await query
                .where("info.room", "in", [
                    "brute",
                    "coal",
                    "chalk",
                    "altitude",
                    "rtfktspacepod",
                ])
                .limit(30)
                .get();
        }
    } else if (isActive == "hot") {
        if (lastVisible) {
            const last = await db.collection("exhibits").doc(lastVisible).get();
            snapshot = await exhibitsListRef()
                .orderBy("likes", "desc")
                .startAfter(last)
                .limit(30)
                .get();
        } else {
            snapshot = await exhibitsListRef()
                .orderBy("likes", "desc")
                .limit(30)
                .get();
        }
    } else if (isActive === "today-most-visited") {
        const todaymostVisitedExhibits = await getTodayMostVisitedExhibits(
            destination,
            lastVisible,
            today_num_of_visits
        );
        snapshot = todaymostVisitedExhibits;
    } else if (isActive === "most-visited") {
        console.log("most-visited");
        const mostVisitedExhibits = await getMostVisitedExhibits(
            destination,
            lastVisible
        );
        snapshot = mostVisitedExhibits;
    } else if (isActive == "staff") {
        // Ordered list curated from the space info sidebar (newest pick first).
        const ids = await readStaffPickIds();
        const docs = ids.length
            ? await db.getAll(
                  ...ids.map((id) => db.collection("exhibits").doc(id)),
                  { fieldMask: EXHIBIT_LIST_FIELDS }
              )
            : [];
        snapshot = docs.filter((doc) => doc.exists);
    } else if (isActive == "genesis") {
        const query = exhibitsListRef();
        snapshot = await query.where("info.room", "==", "genesis").get();
        snapshot1 = await query
            .where("info.room", "==", "/models/Genesis/artgallery_GLTF.gltf")
            .get();
    } else if (isActive == "temple") {
        const query = exhibitsListRef();
        snapshot = await query.where("info.room", "==", "temple").get();
        snapshot1 = await query
            .where("info.room", "==", "/models/WolfgangTemple/temple_GLTF.gltf")
            .get();
    } else if (isActive == "void") {
        const query = exhibitsListRef();
        snapshot = await query.where("info.room", "==", "void").get();
    } else if (isActive == "apes") {
        if (lastVisible) {
            const last = await db.collection("exhibits").doc(lastVisible).get();
            snapshot = await exhibitsListRef()
                .where("info.room", "==", "/models/Apes/club.gltf")
                .startAfter(last)
                .limit(30)
                .get();
        } else {
            snapshot = await exhibitsListRef()
                .where("info.room", "==", "/models/Apes/club.gltf")
                .limit(30)
                .get();
        }
    } else if (isActive == "search") {
        snapshot = await exhibitsListRef()
            .where("editors", "contains" as any, walletId)
            .get();
    } else if (lastVisible) {
        const last = await db.collection("exhibits").doc(lastVisible).get();
        snapshot = await exhibitsListRef()
            // .where("info.headline", ">=", "")
            // .where("info.heroImg", "!=", false)
            // .where("info.curator", ">=", "")
            .orderBy("createdAt", "desc")
            .startAfter(last)
            .limit(50)
            .get();
    } else {
        snapshot = await exhibitsListRef()
            // .where("info.headline", ">=", "")
            // .where("info.heroImg", "!=", false)
            // .where("info.curator", ">=", "")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();
    }

    snapshot.forEach((doc) => {
        const payload = {
            id: doc.id,
            ...doc?.data(),
        };
        if (today_num_of_visits[doc?.id]) {
            payload.today_num_of_visits = today_num_of_visits[doc?.id];
        }
        exhibits.push(payload);
    });

    if (isActive == "today-most-visited") {
        exhibits = exhibits?.sort(
            (a, b) =>
                (b?.today_num_of_visits || 0) - (a?.today_num_of_visits || 0)
        );
    } else if (isActive == "temple" || isActive == "genesis") {
        snapshot1.forEach((doc) => {
            const payload = {
                id: doc.id,
                ...doc.data(),
            };
            if (today_num_of_visits[doc.id]) {
                payload.today_num_of_visits = today_num_of_visits[doc.id];
            }
            exhibits.push(payload);
        });
        exhibits = exhibits?.sort(
            (a, b) => (b?.number_of_visits || 0) - (a?.number_of_visits || 0)
        );
    }

    exhibits.map((exhibit, i) => {
        exhibits[i].artworks = [];
    });

    await addOwnerNames(exhibits);

    return exhibits;
};

/**
 * Give each feed exhibit its owner's username (`ownerName`, null when the
 * wallet has no profile) so cards can read "World by creator". Uses the
 * cached, batched profile lookup; a failed lookup leaves the names out.
 */
async function addOwnerNames(exhibits: any[]): Promise<void> {
    const owners = exhibits
        .map((exhibit) => exhibit?.owner)
        .filter((owner) => typeof owner === "string" && owner);
    if (!owners.length) return;
    try {
        const profiles = await getUserProfilesByWalletIds(owners);
        const names = new Map(
            profiles.map((user) => [
                (user?.walletId || "").toLowerCase(),
                user?.username || null,
            ])
        );
        for (const exhibit of exhibits) {
            if (typeof exhibit?.owner !== "string") continue;
            exhibit.ownerName = names.get(exhibit.owner.toLowerCase()) || null;
        }
    } catch (err) {
        // Cards fall back to the curator or the shortened owner address.
    }
}

const getUserExhibits = async (userId) => {
    const exhibits = [];

    const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("exhibits")
        .get();

    // The subcollection lists both owned and shared (editor) exhibit ids, so we
    // can't collapse it into an `owner ==` query. But the per-exhibit reads that
    // followed were N sequential round trips; batch them into one getAll.
    const subDocs = snapshot.docs;
    if (!subDocs.length) return exhibits;

    const exhibitDocs = await db.getAll(
        ...subDocs.map((doc) => db.collection("exhibits").doc(doc.id))
    );

    exhibitDocs.forEach((exhibitDoc, i) => {
        if (!exhibitDoc.exists) return;

        const { artworks, ...data } = exhibitDoc.data();

        const total_artworks = Object.values(artworks || {}).length;

        const exhibit = {
            ...subDocs[i].data(),
            id: exhibitDoc.id,
            ...data,
            total_artworks,
        } as any;

        formatExhibitData(exhibit);

        exhibits.push(exhibit);
    });

    return exhibits;
};

const getSavedExhibits = async (userId) => {
    const exhibits = [];
    const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("favorites")
        .get();

    const subDocs = snapshot.docs;
    if (!subDocs.length) return exhibits;

    // Batch the per-favorite exhibit reads into one round trip.
    const exhibitDocs = await db.getAll(
        ...subDocs.map((doc) => db.collection("exhibits").doc(doc.id))
    );

    exhibitDocs.forEach((exhibitDoc, i) => {
        exhibits.push({
            ...subDocs[i].data(),
            id: exhibitDoc.id,
            ...exhibitDoc.data(),
        });
    });

    return exhibits;
};

function isPrimitive(v: any) {
    let type = typeof v;
    return (
        v == null ||
        type === "string" ||
        type === "number" ||
        type === "boolean" ||
        Array.isArray(v)
    );
}

function deconstructUpdates(object: object, currentPath = [], args = []) {
    for (let key in object) {
        let path = currentPath.concat(key);
        let value = object[key];
        if (value == null) {
            args.push(new firestore.FieldPath(...path), null);
        } else if (value.FIRESTORE_SET_Field) {
            args.push(new firestore.FieldPath(...path), value.value);
        } else if (value.FIRESTORE_DELETE_Field) {
            args.push(
                new firestore.FieldPath(...path),
                firestore.FieldValue.delete()
            );
        } else if (isPrimitive(value)) {
            args.push(new firestore.FieldPath(...path), value);
        } else {
            deconstructUpdates(value, path, args);
        }
    }
    return args;
}

const isEditor = (userId) => (exhibit, payload) => {
    let result = exhibit.editors?.some(
        (id) => id.toLowerCase() == userId?.toLowerCase()
    );

    // You can't update room, but we always send room with payloads
    // if (payload.info.room) {
    //     return {
    //         success: false,
    //         error: "Get out of here",
    //     };
    // }

    return result
        ? { success: true }
        : {
              success: false,
              error: "Get out of here",
          };
};

export const updateExhibit = async (
    id,
    origPayload,
    userId,
    precondition = isEditor(userId)
) => {
    if ([origPayload, origPayload?.update].some(hasLegacyGalleryScriptWrite)) {
        return { success: false, error: GALLERY_SCRIPTS_RETIRED };
    }
    // Artist search is derived from artwork metadata by the server indexer.
    if (
        [origPayload, origPayload?.update].some(
            (value) =>
                value &&
                Object.keys(value).some(
                    (key) =>
                        key === "artistSearch" ||
                        key.startsWith("artistSearch.")
                )
        )
    )
        return {
            success: false,
            error: "Artist search fields are managed by the server",
        };
    // Editors may not make themselves owner or set the visit count, through
    // a path update either (the handler's own check sees only the top level).
    if (writesProtectedExhibitField(origPayload))
        return { success: false, error: "You can't update." };
    // A world password is hashed by the studio's update (_v2/exhibit/update);
    // this path would store it as typed.
    if (writesWorldPassword(origPayload))
        return {
            success: false,
            error: "Set the world password in the world's settings.",
        };
    return db.runTransaction(async (transaction) => {
        let payload = origPayload;

        const ref = db.collection("exhibits").doc(id);
        const doc = await transaction.get(ref);
        if (!doc.exists) return;

        const exhibit = doc.data() as Experience;

        const roomScale = scaleData[getSlug(exhibit.info.room)];

        let testExhibit = roomScale
            ? formatExhibit(deepClone(exhibit))
            : exhibit;

        let preResult = precondition(testExhibit, payload);

        if (!preResult.success) return preResult;

        let lastUpdatedAt = new firestore.FieldPath("lastUpdatedAt");

        let lastContentUpdatedAt = new firestore.FieldPath(
            "lastContentUpdatedAt"
        );

        let hasKitbash = new firestore.FieldPath("hasKitbash");

        if (roomScale) {
            payload = formatUpdate(payload, roomScale);
        }

        if (
            exhibit?.storageVersion === 2 &&
            (payload.FIRESTORE_UPDATE_PORTAL || payload.FIRESTORE_DELETE_PORTAL)
        ) {
            return updatePortals(id, exhibit, payload, transaction, {
                lastUpdatedAt,
                lastContentUpdatedAt,
            });
        }

        let now = Date.now();

        if (payload.FIRESTORE_ADD_ASSET) {
            // We should request the apis here and refetch
            let { asset, assetId } = payload;

            if (!asset || !asset.data || !assetId)
                return { success: false, error: "Invalid asset data" };

            if (exhibit.artworks[assetId]) {
                return {
                    success: false,
                    error: "race_error",
                };
            }

            let path = new firestore.FieldPath("artworks", assetId);

            transaction.update(
                ref,
                path,
                asset,
                lastUpdatedAt,
                now,
                lastContentUpdatedAt,
                now
            );
            return { success: true };
        } else if (payload.FIRESTORE_REPLACE_ASSET) {
            // We should request the apis here and refetch
            let { asset, assetId } = payload;

            if (!asset || !assetId)
                return { success: false, error: "Invalid asset data" };

            let path = new firestore.FieldPath("artworks", assetId);

            let args = [path, asset];

            // If we're replacing a portal/artwork, delete
            if (exhibit.portals?.[assetId]) {
                args.push(
                    new firestore.FieldPath("portals", assetId),
                    firestore.FieldValue.delete()
                );
            }
            if (exhibit.storageVersion === 2) {
                // If we have a `portals` subcollection just send a delete
                // if there's no portal in there, the operation won't fail if
                // the document doesn't exist
                transaction.delete(ref.collection("portals").doc(assetId));
            }

            args.push(lastUpdatedAt, now, lastContentUpdatedAt, now);

            // @ts-ignore
            transaction.update(ref, ...args);

            return { success: true };
        } else if (payload.FIRESTORE_UPDATE_ASSET) {
            // We shouldn't allow changing fields like owner, animation_url, etc..
            let { update, assetId } = payload;
            if (!assetId || !update)
                return { success: false, error: "Invalid asset data" };
            if (!exhibit.artworks[assetId]) {
                return {
                    success: false,
                    error: "Asset was deleted",
                };
            }
            let args = deconstructUpdates(payload.update, [
                "artworks",
                assetId,
            ]).concat([lastUpdatedAt, now, lastContentUpdatedAt, now]);

            // @ts-ignore
            transaction.update(ref, ...args);
            return { success: true };
        } else if (payload.FIRESTORE_DELETE_ASSET) {
            let { assetId } = payload;

            if (!assetId)
                return { success: false, error: "Invalid asset data" };
            if (!exhibit.artworks[assetId]) {
                return {
                    success: false,
                    error: "Asset was deleted",
                };
            }
            let path = new firestore.FieldPath("artworks", assetId);
            // @ts-ignore
            transaction.update(
                ref,
                path,
                firestore.FieldValue.delete(),
                lastUpdatedAt,
                now,
                lastContentUpdatedAt,
                now
            );
            return { success: true };
        } else if (payload.FIRESTORE_UPDATE_PORTAL) {
            //
            let { update, portalId } = payload;

            if (!portalId || !update)
                return { success: false, error: "Invalid portal data" };

            let args = deconstructUpdates(payload.update, [
                "portals",
                portalId,
            ]);

            // If this is replacing an artwork, delete artwork
            if (exhibit.artworks?.[portalId]) {
                args.push(
                    new firestore.FieldPath("artworks", portalId),
                    firestore.FieldValue.delete()
                );
            }

            args = args.concat([lastUpdatedAt, now, lastContentUpdatedAt, now]);

            // @ts-ignore
            transaction.update(ref, ...args);
            return { success: true };
        } else if (payload.FIRESTORE_DELETE_PORTAL) {
            let { portalId } = payload;

            if (!portalId)
                return { success: false, error: "Invalid portal data" };
            if (!exhibit.portals[portalId]) {
                return {
                    success: false,
                    error: "Portal was deleted",
                };
            }
            let path = new firestore.FieldPath("portals", portalId);
            // @ts-ignore
            transaction.update(
                ref,
                path,
                firestore.FieldValue.delete(),
                lastUpdatedAt,
                now,
                lastContentUpdatedAt,
                now
            );
            return { success: true };
        } else if (payload.FIRESTORE_RESET_KITBASH) {
            //
            let kitbashRef = ref.collection("kitbash");

            if (exhibit.hasKitbash) {
                //
                let allDocs = await kitbashRef.select().get();

                allDocs.forEach((doc) => {
                    const docRef = kitbashRef.doc(doc.id);
                    transaction.delete(docRef);
                });
            }

            const data: Record<string, KitBashData> = payload.data;

            Object.keys(data).forEach((type) => {
                const kd = data[type];
                transaction.set(kitbashRef.doc(type), kd);
            });

            transaction.update(
                ref,
                hasKitbash,
                true,
                lastUpdatedAt,
                now,
                lastContentUpdatedAt,
                now
            );

            return { success: true };
            //
        } else if (payload.FIRESTORE_UPDATE_KITBASH) {
            // We shouldn't allow changing fields like owner, animation_url, etc..
            let { update, id } = payload;

            if (!id || !update)
                return { success: false, error: "Invalid kitbash data" };

            // 1- update kitbash subcollection
            let kitbashRef = ref.collection("kitbash");
            let kitbashArgs = deconstructUpdates(payload.update);
            // @ts-ignore
            transaction.update(kitbashRef.doc(id), ...kitbashArgs);

            // 2- update lastUpdated fields in exhibit
            transaction.update(
                ref,
                hasKitbash,
                true,
                lastUpdatedAt,
                now,
                lastContentUpdatedAt,
                now
            );

            return { success: true };
        } else if (payload.FIRESTORE_DELETE_KITBASH) {
            //
            let { id } = payload;

            if (!id || !exhibit.kitbash)
                return { success: false, error: "Invalid asset data" };

            // Delete doc from kitbash subcollection
            let kitbashRef = ref.collection("kitbash");
            // @ts-ignore
            transaction.delete(kitbashRef.doc(id));

            // 2- update lastUpdated fields in exhibit
            let exhibitArgs = [lastUpdatedAt, now, lastContentUpdatedAt, now];
            // @ts-ignore
            transaction.update(ref, ...exhibitArgs);

            return { success: true };
        }

        //!
        if (payload.FIRESTORE_UPDATE_Field) {
            let args = deconstructUpdates(payload.update).concat(
                lastUpdatedAt,
                now
            );

            if (payload.update.artworks || payload.update.portals) {
                args.push(lastContentUpdatedAt, now);
            }
            // If there's no lastContentUpdatedAt field yet, add it
            else if (exhibit.lastContentUpdatedAt == null) {
                // if we're updating cHeroImg field set lastContentUpdatedAt to a value
                // just before lastUpdatedHeroImg to avoid infinite regeneration
                let timestamp = now;

                if (payload.update?.info?.lastUpdatedHeroImg != null) {
                    timestamp = payload.update.info.lastUpdatedHeroImg - 1;
                }
                args.push(lastContentUpdatedAt, timestamp);
            }

            console.log("[UPDATE EXHIBIT/path update]", args);
            // @ts-ignore
            transaction.update(ref, ...args);
        } else {
            console.log("[UPDATE EXHIBIT/set]", payload);

            let update = { ...payload, lastUpdatedAt: now };

            // If there's no "lastContentUpdatedAt" field yet, then at least we know
            // it's been before this time
            if (exhibit.lastContentUpdatedAt == null) {
                update.lastContentUpdatedAt = now;
            }

            transaction.update(ref, update);
        }

        return { success: true };
    });
};

export const createExhibit = async (userId, room) => {
    // Add exhibit with default data
    room = oldToNew[room] || room;

    const stylekit = await getStylekitByRoom(room);

    const doc = {
        info: {
            room,
        },
        artworks: {},
        editors: [userId],
        createdAt: new Date(),
        owner: userId,
        number_of_visits: 0,
    } as any;

    if (stylekit?.kitbash) {
        doc.hasKitbash = true;
    }

    const batch = db.batch();

    const exhibitRef = db.collection("exhibits").doc();

    batch.create(exhibitRef, doc);

    batch.set(
        db
            .collection("users")
            .doc(userId)
            .collection("exhibits")
            .doc(exhibitRef.id),
        {
            id: exhibitRef.id,
        }
    );

    if (stylekit?.kitbash) {
        const kitbashRef = db
            .collection("exhibits")
            .doc(exhibitRef.id)
            .collection("kitbash");

        Object.keys(stylekit.kitbash).forEach((type) => {
            //
            const kd = stylekit.kitbash[type];
            kd.kit = kd.kit ?? room;
            batch.set(kitbashRef.doc(type), kd);
        });
    }

    await batch.commit();

    doc.id = exhibitRef.id;

    if (stylekit?.kitbash) {
        doc.kitbash = stylekit.kitbash;
    }

    return doc;
};

const getUserSavedExhibits = async (userId) => {
    const exhibits = [];
    const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("favorites")
        .get();

    const subDocs = snapshot.docs;
    if (!subDocs.length) return exhibits;

    // Batch the per-favorite exhibit reads into one round trip.
    const exhibitDocs = await db.getAll(
        ...subDocs.map((doc) => db.collection("exhibits").doc(doc.id))
    );

    exhibitDocs.forEach((exhibitDoc) => {
        const { artworks, ...data } = exhibitDoc.data() || {};

        const total_artworks = Object.values(artworks || {}).length;

        exhibits.push({
            id: exhibitDoc.id,
            ...data,
            total_artworks,
        });
    });

    return exhibits;
};

export const likeExhibit = async (exhibitId, userId) => {
    const doc = await db
        .collection("exhibits")
        .doc(exhibitId)
        .collection("likes")
        .doc(userId)
        .get();
    if (doc.exists) {
        return false;
    }

    // We increment the likes score in firebase
    // We add the exhibit to the user's local storage
    const increment = fire.FieldValue.increment(1);
    // check if there is likes

    await db.collection("exhibits").doc(exhibitId).update({
        likes: increment,
    });

    await db
        .collection("users")
        .doc(userId)
        .collection("likes")
        .doc(exhibitId)
        .set({
            exhibitId,
        });

    await db
        .collection("exhibits")
        .doc(exhibitId)
        .collection("likes")
        .doc(userId)
        .set({
            userId,
        });

    return true;
};

export const unlikeExhibit = async (exhibitId, userId) => {
    const doc = await db
        .collection("exhibits")
        .doc(exhibitId)
        .collection("likes")
        .doc(userId)
        .get();
    if (!doc.exists) {
        return false;
    }

    const decrement = fire.FieldValue.increment(-1);

    await db.collection("exhibits").doc(exhibitId).update({
        likes: decrement,
    });

    await db
        .collection("exhibits")
        .doc(exhibitId)
        .collection("likes")
        .doc(userId)
        .delete();

    await db
        .collection("users")
        .doc(userId)
        .collection("likes")
        .doc(exhibitId)
        .delete();

    return true;
};

export const toogleFavorite = async (exhibitId, userId) => {
    const doc = await db
        .collection("users")
        .doc(userId)
        .collection("favorites")
        .doc(exhibitId)
        .get();
    if (doc.exists) {
        await db
            .collection("users")
            .doc(userId)
            .collection("favorites")
            .doc(exhibitId)
            .delete();
        return false;
    } else {
        await db
            .collection("users")
            .doc(userId)
            .collection("favorites")
            .doc(exhibitId)
            .set({
                exhibitId,
            });
        return true;
    }
};

export const hasFavorited = async (exhibitId, userId) => {
    const doc = await db
        .collection("users")
        .doc(userId)
        .collection("favorites")
        .doc(exhibitId)
        .get();
    return doc.exists;
};

export const hasLiked = async (exhibitId, userId) => {
    const doc = await db
        .collection("exhibits")
        .doc(exhibitId)
        .collection("likes")
        .doc(userId)
        .get();
    return doc.exists;
};

const deleteExhibit = async (userId, exhibitId) => {
    // We get exhibit and check if it has a domain name associated it
    // if yes we delete that domain

    const doc = await db.collection("exhibits").doc(exhibitId).get();
    const exhibit = doc.data();

    if (exhibit.owner.toLowerCase() != userId.toLowerCase()) {
        return { success: false, error: "Get out of here" };
    }

    console.log("IS THE OWNER", exhibit.info);

    if (exhibit?.info?.customLink) {
        await db
            .collection("customLink")
            .doc(exhibit.info?.customLink)
            .delete();
    }

    await db
        .collection("users")
        .doc(userId)
        .collection("exhibits")
        .doc(exhibitId)
        .delete();

    await db.collection("exhibits").doc(exhibitId).delete();
};

export default async (req, res) => {
    await corsMiddleware(req, res);

    // Several reads below return exhibit documents as Firestore stores them;
    // none may carry a world password to the client.
    stripSecretsFromJson(res);

    // We need to check first if user logged in and if he is an editor of the exhibit before he can update...

    try {
        if (req.body && typeof req.body === "string") {
            req.body = JSON.parse(req.body);
        }

        // List of important properties of exhibit doc
        // id,
        // info,
        // artworks,
        // portals,
        // createdAt,
        // number_of_visits, // This can't be changed by anyone
        // owner, // editors can't change owner
        // editors,

        if (
            req.query.type === "UPDATE_EXHIBIT" &&
            (typeof req.body?.payload?.number_of_visits !== "undefined" ||
                typeof req.body?.payload?.owner !== "undefined")
        ) {
            return res.status(400).json({
                success: false,
                message: "You can't update.",
            });
        }

        if (
            req.query.type === "UPDATE_EXHIBIT" ||
            req.query.type === "CREATE_EXHIBIT" ||
            req.query.type === "GET_USERS_EXHIBITS" ||
            req.query.type === "DELETE_EXHIBIT" ||
            req.query.type === "LIKE_EXHIBIT" ||
            req.query.type === "UNLIKE_EXHIBIT" ||
            req.query.type === "HAS_LIKED" ||
            req.query.type === "HAS_FAVORITED" ||
            req.query.type === "TOGGLE_FAVORITE"
        ) {
            var userId = await auth(req);
        } else if (
            req.query.type == "GET_PUBLIC_USER_EXHIBITS" ||
            req.query.type == "GET_PUBLIC_USER_SAVED_EXHIBITS"
        ) {
            userId = req.body.userId;
        }

        if (req.query.type === "FETCH_SINGLE_EXHIBIT" && req.query.id) {
            const exhibit = await getExhibitById(req.query.id);
            if (exhibit == null) throw new Error("Not found");
            return res
                .status(200)
                .json({ success: !!exhibit?.info?.room, exhibit });
        } else if (req.query.type === "GET_EXHIBIT_BY_CUSTOM_LINK") {
            const exhibit = await getExhibitByCustomLink(req.query.customLink);
            if (exhibit == null) throw new Error("Not found");
            return res.status(200).json({ success: true, exhibit });
        } else if (req.query.type === "FETCH_ALL_EXHIBITS") {
            const destination = req?.query?.destination;
            const exhibits = await getExhibits(
                req?.query?.isActive,
                req?.query?.lastVisible,
                destination ? destination.split(",") : null
            );
            return res.status(200).json({ success: true, exhibits });
        } else if (req.query.type === "GET_RAD_USER_EXHIBITS") {
            const exhibits = await getRadUserExhibits(
                req?.query?.walletId,
                req?.query?.lastVisible
            );
            return res.status(200).json({ success: true, exhibits });
        } else if (
            req.query.type === "UPDATE_EXHIBIT" &&
            req.query.id &&
            req.body.payload
        ) {
            const data = await updateExhibit(
                req.query.id,
                req.body.payload,
                userId
            );

            if (!data.success) {
                return res
                    .status(400)
                    .json({ success: false, message: data.error });
            }

            return res.status(200).json({ success: true });
        } else if (req.query.type === "CREATE_EXHIBIT" && userId) {
            const exhibit = await createExhibit(
                userId,
                req.body.room || "/models/CyberRoom/BB2.gltf"
            );

            return res.status(200).json({ success: true, exhibit });
        } else if (req.query.type === "DELETE_EXHIBIT") {
            await deleteExhibit(userId, req.body.exhibitId);
            return res.status(200).json({ success: true });
        } else if (
            req.query.type === "GET_USERS_EXHIBITS" ||
            req.query.type === "GET_PUBLIC_USER_EXHIBITS"
        ) {
            const exhibits = await getUserExhibits(userId);

            return res.status(200).json({ success: true, exhibits });
        } else if (req.query.type === "GET_PUBLIC_USER_SAVED_EXHIBITS") {
            const exhibits = await getSavedExhibits(userId);

            return res.status(200).json({ success: true, exhibits });
        } else if (req.query.type === "GET_SPOTLIGHT_EXHIBIT") {
            const exhibit = await getSpotlightExhibit();

            return res.status(200).json({ success: true, exhibit });
        } else if (req.query.type === "HAS_FAVORITED") {
            return res.status(200).json({
                success: true,
                hasFavorited: await hasFavorited(req.body.exhibitId, userId),
            });
        } else if (req.query.type === "USER_SAVED_EXHIBITS") {
            const exhibits = await getUserSavedExhibits(req.body.userId);
            return res.status(200).json({ success: true, exhibits });
        } else if (req.query.type === "TOGGLE_FAVORITE") {
            const hasFavorited = await toogleFavorite(
                req.body.exhibitId,
                userId
            );

            return res.status(200).json({
                success: true,
                hasFavorited,
            });
        } else if (req.query.type === "LIKE_EXHIBIT") {
            const success = await likeExhibit(req.body.exhibitId, userId);
            if (!success) {
                return res.status(400).json({
                    success: false,
                    message: "User already liked exhibit",
                });
            }
            return res.status(200).json({ success: true });
        } else if (req.query.type === "UNLIKE_EXHIBIT") {
            const success = await unlikeExhibit(req.body.exhibitId, userId);
            if (!success) {
                return res.status(400).json({
                    success: false,
                    message: "User already unliked exhibit",
                });
            }
            return res.status(200).json({ success: true });
        } else if (
            req.query.type === "GET_EXHIBITS_BY_IDS" &&
            req.method === "GET"
        ) {
            // Portal previews: one cacheable read for every portal in a world.
            const exhibits = await getExhibitPreviewsByIds(
                parseExhibitPreviewIds(req.query.ids)
            );
            res.setHeader("Cache-Control", EXHIBIT_PREVIEWS_CACHE_CONTROL);
            return res.status(200).json({ success: true, exhibits });
        } else if (req.query.type === "GET_EXHIBITS_BY_IDS") {
            return res.status(200).json({
                success: true,
                exhibits: await getExhibitsByIds(req.body.exhibitIds),
            });
        } else if (req.query.type === "SEARCH_EXHIBITS") {
            const currentPage = parseInt(req?.query?.page) || 0;
            return res.status(200).json({
                success: true,
                exhibits: await searchExhibit(req?.query?.search, currentPage),
            });
        } else if (req.query.type === "HAS_LIKED") {
            return res.status(200).json({
                success: true,
                hasLiked: await hasLiked(req.body.exhibitId, userId),
            });
        } else {
            return res
                .status(400)
                .json({ success: false, message: "Query not recognized." });
        }
    } catch (err) {
        console.error(err);
        return res
            .status(400)
            .json({ success: false, message: "Failed to execute operation." });
    }
};
