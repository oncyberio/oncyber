const { indexGallery, createOpenSea, firestoreCache } = require("../../cloud-functions/artist-index/indexer");
const { isPublicGallery, artworkInputs, hash } = require("../../cloud-functions/artist-index/core");
const { assertDocumentFits, isDocumentSizeError } = require("../../cloud-functions/artist-index/document-size");
const { repairArtwork, mediaFingerprint } = require("./media.cjs");
const { runConfig } = require("./config.cjs");

class BatchLimit extends Error {
    constructor(reason) { super(`Local batch limit reached: ${reason}`); this.code = "BATCH_LIMIT"; }
}
function limitsFrom(values = {}) {
    const defaults = { galleries: 2, artworks: 10, requests: 30, seconds: 300, scans: 100 };
    for (const key of Object.keys(defaults)) {
        const value = Number(values[`max-${key}`] ?? defaults[key]);
        if (!Number.isSafeInteger(value) || value < 1) throw Error(`--max-${key} must be a positive integer`);
        defaults[key] = value;
    }
    return defaults;
}
async function runLocalBatch({ db, bucket, ids, values, apiKey, limits = limitsFrom(values),
    report = () => {}, now = Date.now, index = indexGallery, repair = repairArtwork,
    providerFactory = createOpenSea, stopped = () => false }) {
    const started = now(), deadline = started + limits.seconds * 1000;
    const counters = { scanned: 0, galleries: 0, completed: 0, artworks: 0, repaired: 0, reusedCDN: 0, resumed: 0, skipped: 0, errors: 0, unresolved: 0, blocked: 0 };
    function check() {
        if (stopped()) throw new BatchLimit("interrupted");
        if (now() >= deadline) throw new BatchLimit("runtime");
    }
    const run = db.collection("galleryMaintenanceRuns").doc(values.run);
    const saved = (await run.get()).data();
    if (!saved) throw Error("Local resume requires an existing cloud run checkpoint");
    const config = runConfig(values, ids, saved.taskCount);
    if (saved.configHash !== config.configHash) throw Error("Run configuration differs from its saved checkpoint");
    const taskIndex = Number(values["task-index"] ?? 0);
    if (!Number.isSafeInteger(taskIndex) || taskIndex < 0 || taskIndex >= saved.taskCount) throw Error("Invalid --task-index");
    let selected = ids.filter((_, i) => i % saved.taskCount === taskIndex);
    if (values.after) {
        const offset = selected.indexOf(values.after);
        if (offset < 0) throw Error("--after gallery is not in this task partition");
        selected = selected.slice(offset + 1);
    }
    if (values["retry-gallery"]) {
        if (!selected.includes(values["retry-gallery"])) throw Error("Retry gallery is not in this task partition/selection");
        selected = [values["retry-gallery"]];
    }
    let requests = 0, checkpointReads = 0;
    function checkpointRead() {
        check();
        if (checkpointReads >= limits.scans) throw new BatchLimit("checkpoint reads");
        checkpointReads++;
    }
    const providerCache = firestoreCache(db, !!values.apply);
    const provider = providerFactory({ apiKey, cache: {
        get: key => { check(); return providerCache.get(key); },
        set: (key, value) => { check(); return providerCache.set(key, value); },
    },
        intervalMs: 2000, deadline,
        beforeRequest: () => {
            check();
            if (requests >= limits.requests) throw new BatchLimit("provider requests");
            requests++;
        },
    });
    let lastScanned, status = "complete", limitReason;
    const emit = async (entry) => report({ run: values.run, taskIndex, ...entry });
    await emit({ status: "started", apply: !!values.apply, limits, retryGallery: values["retry-gallery"] });
    try {
        for (const id of selected) {
            check();
            if (counters.scanned >= limits.scans) throw new BatchLimit("checkpoint scans");
            if (counters.galleries >= limits.galleries) throw new BatchLimit("galleries");
            counters.scanned++; lastScanned = id;
            checkpointRead();
            const done = run.collection("galleries").doc(id), previous = (await done.get()).data();
            if (previous?.status === "complete") { counters.resumed++; continue; }
            if (previous?.status === "blocked-document-size" || (previous?.status === "needs-review" && values["retry-gallery"] !== id)) {
                counters.skipped++; await emit({ gallery: id, status: previous.status }); continue;
            }
            const ref = db.collection("exhibits").doc(id), gallery = (await ref.get()).data();
            if (!isPublicGallery(gallery)) { counters.skipped++; continue; }
            counters.galleries++;
            await emit({ gallery: id, status: "processing" });
            let galleryErrors = 0;
            try {
                assertDocumentFits(gallery, ref.path);
                const indexed = await index({ db, ref, provider, apply: !!values.apply, storedOnly: !!values["stored-only"] });
                if (indexed.status === "changed-during-indexing") throw Error("Gallery changed during indexing");
                check();
                if (!values["artists-only"]) {
                    for (const record of artworkInputs(gallery)) {
                        check();
                        const item = gallery.artworks[record.id];
                        const fingerprint = mediaFingerprint(item.data || {});
                        const recordRef = done.collection("artworks").doc(hash(record.id));
                        // Existing embedded cache is the cheapest source of truth.
                        if (item.data?.mediaCache?.version === 1 && item.data.mediaCache.sourceHash === fingerprint && !item.data.mediaCache.animationUnavailable) continue;
                        if (counters.artworks >= limits.artworks) throw new BatchLimit("artworks");
                        checkpointRead();
                        const prior = (await recordRef.get()).data();
                        if (prior?.sourceHash === fingerprint && ["repaired", "unchanged", "audited-original", "audited-cdn", "hidden-or-custom", "not-media"].includes(prior.status)) continue;
                        if (prior?.sourceHash === fingerprint && ["unresolved", "partial-preview", "error", "changed-during-repair"].includes(prior.status) && values["retry-gallery"] !== id) {
                            galleryErrors++; counters.unresolved++; continue;
                        }
                        counters.artworks++;
                        try {
                            const result = await repair({ db, ref, artworkId: record.id, provider, bucket, runId: values.run, apply: !!values.apply, gallery });
                            const failed = ["unresolved", "changed-during-repair", "partial-preview"].includes(result.status);
                            if (failed) { galleryErrors++; counters.unresolved++; }
                            if (result.status === "repaired") counters.repaired++;
                            if (result.status === "audited-cdn") counters.reusedCDN++;
                            if (values.apply) await recordRef.set(JSON.parse(JSON.stringify({ ...result, artworkId: record.id, sourceHash: fingerprint, at: now() })));
                            await emit({ gallery: id, artwork: record.id, status: result.status });
                        } catch (error) {
                            if (error.code === "BATCH_LIMIT" || isDocumentSizeError(error)) throw error;
                            if ([401, 403, 429].includes(error.status)) throw error;
                            galleryErrors++; counters.errors++;
                            if (values.apply) await recordRef.set({ artworkId: record.id, sourceHash: fingerprint, status: "error", error: error.message.slice(0, 500), at: now() });
                            await emit({ gallery: id, artwork: record.id, status: "error", error: error.message });
                        }
                    }
                }
                if (values.apply) await done.set({ status: galleryErrors ? "needs-review" : "complete", errors: galleryErrors, at: now() }, { merge: true });
                if (!galleryErrors) counters.completed++;
                await emit({ gallery: id, status: galleryErrors ? "needs-review" : "complete" });
            } catch (error) {
                if (error.code === "BATCH_LIMIT" || /time budget reached/.test(error.message)) {
                    if (values.apply) await done.set({ status: "partial", reason: "batch-limit", at: now() }, { merge: true });
                    if (error.code === "BATCH_LIMIT") throw error;
                    throw new BatchLimit("runtime");
                }
                if (isDocumentSizeError(error)) {
                    counters.blocked++;
                    if (values.apply) await done.set({ status: "blocked-document-size", reason: error.message.slice(0, 500), at: now() }, { merge: true });
                    await emit({ gallery: id, status: "blocked-document-size" });
                    continue;
                }
                counters.errors++;
                // Stop on unexpected/provider errors: don't walk the whole batch in a failure loop.
                if (values.apply) await done.set({ status: "needs-review", reason: error.message.slice(0, 500), at: now() }, { merge: true });
                throw error;
            }
        }
    } catch (error) {
        if (error.code !== "BATCH_LIMIT") throw error;
        status = "bounded-stop"; limitReason = error.message;
    }
    const summary = { status, limitReason, ...counters, requests, checkpointReads, lastScanned, elapsedSeconds: Math.round((now() - started) / 1000) };
    await emit(summary);
    return summary;
}
module.exports = { runLocalBatch, limitsFrom, BatchLimit };
