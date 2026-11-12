const {
    VERSION,
    isPublicGallery,
    artworkInputs,
    sourceHash,
    buildIndex,
    defaultRegistry,
} = require("./core");
const { createOpenSea } = require("./opensea");
const { assertDocumentFits } = require("./document-size");
function firestoreCache(db, apply) {
    const memory = new Map();
    return {
        async get(key) {
            if (memory.has(key)) return memory.get(key);
            const doc = await db
                .collection("artworkArtistCache")
                .doc(key)
                .get();
            return doc.exists ? doc.data() : null;
        },
        async set(key, value) {
            memory.set(key, value);
            if (memory.size > 1000) memory.delete(memory.keys().next().value);
            if (apply)
                await db.collection("artworkArtistCache").doc(key).set(value);
        },
    };
}
async function indexGallery({
    db,
    ref,
    provider,
    registry = defaultRegistry,
    apply = false,
    force = false,
    storedOnly = false,
    now = Date.now,
}) {
    // Read current state, not an event snapshot: triggers can arrive out of order.
    const snapshot = await ref.get();
    if (!snapshot.exists) return { status: "deleted" };
    const gallery = snapshot.data();
    const fingerprint = sourceHash(gallery, registry);
    if (
        !force &&
        gallery.artistSearch?.version === VERSION &&
        gallery.artistSearch.sourceHash === fingerprint &&
        (storedOnly || gallery.artistSearch.enriched === true)
    )
        return { status: "unchanged", index: gallery.artistSearch };
    async function write(index) {
        return db.runTransaction(async (transaction) => {
            const latest = await transaction.get(ref);
            if (
                !latest.exists ||
                sourceHash(latest.data(), registry) !== fingerprint
            )
                return false;
            // A fast saved-metadata pass must not replace concurrent enrichment.
            const current = latest.data().artistSearch;
            if (
                !index.enriched &&
                current?.enriched === true &&
                current.sourceHash === fingerprint
            )
                return false;
            assertDocumentFits({ ...latest.data(), artistSearch: index }, ref.path);
            transaction.update(ref, { artistSearch: index });
            return true;
        });
    }
    // Remove stale attribution even if enrichment later fails or is rate limited.
    // Pending indexes are retried; they never satisfy the enriched skip check.
    if (
        apply &&
        !storedOnly &&
        gallery.artistSearch?.sourceHash !== fingerprint
    ) {
        const provisional = {
            ...buildIndex(gallery, new Map(), registry).index,
            enriched: false,
            indexedAt: now(),
        };
        if (!(await write(provisional)))
            return { status: "changed-during-indexing" };
    }
    if (apply) assertDocumentFits(gallery, ref.path);
    const resolved = new Map();
    if (isPublicGallery(gallery) && !storedOnly) {
        for (const input of artworkInputs(gallery)) {
            resolved.set(input.id, await provider.resolve(input));
        }
    }
    const result = buildIndex(gallery, resolved, registry);
    result.index.enriched = !storedOnly;
    result.index.indexedAt = now();
    if (apply) {
        // Never overwrite artwork edits made while provider requests were in flight.
        const written = await write(result.index);
        if (!written) return { status: "changed-during-indexing" };
    }
    return { status: apply ? "indexed" : "preview", ...result };
}
function shouldIndexChange(before, after) {
    if (!after) return false;
    // Ignore our own index write, analytics, transformations, cover changes, etc.
    return !before || sourceHash(before) !== sourceHash(after);
}
module.exports = {
    firestoreCache,
    indexGallery,
    shouldIndexChange,
    createOpenSea,
};
