const { indexGallery, shouldIndexChange } = require("./indexer");
const { isDocumentSizeError } = require("./document-size");

// Event handlers must not spend minutes waiting for external enrichment.
// New/edited artwork gets saved-credit search immediately; provider enrichment
// is explicitly run locally. Current enriched indexes remain intact.
async function handleArtistEvent(event, { db, logger, index = indexGallery }) {
    if (!event.data || !shouldIndexChange(event.data.before.data(), event.data.after.data())) return;
    try {
        const result = await index({ db, ref: event.data.after.ref, apply: true, storedOnly: true });
        if (result.status === "changed-during-indexing") {
            throw new Error("Gallery changed during saved-credit indexing; retry latest state");
        }
        logger.info("Gallery saved artist credits indexed", {
            exhibitId: event.params.exhibitId,
            status: result.status,
            enrichment: result.index?.enriched ? "existing" : "local-batch-required",
        });
        return result;
    } catch (error) {
        if (!isDocumentSizeError(error)) throw error;
        // A permanent document-size failure cannot improve through event retries.
        logger.warn("Gallery index skipped: document needs size review", {
            exhibitId: event.params.exhibitId,
            reason: "document-size-limit",
        });
        return { status: "document-size-limit" };
    }
}
module.exports = { handleArtistEvent };
