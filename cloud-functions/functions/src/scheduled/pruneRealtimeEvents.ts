import { logger, pubsub } from "firebase-functions";
import { realtimeDB } from "../utils/db";

// Asset-optimization completion notifications and live editor actions are
// pushed to /exhibits/{exhibitId} in the Realtime Database. They are only useful
// for a few seconds (each carries a ~10s validity timestamp the client enforces)
// but nothing deletes them, so the tree grows without bound. This scheduled job
// removes events older than the threshold. The retention is generous (vs the
// ~10s the events are actually consumed within) purely as a safety margin.
const PRUNE_THRESHOLD_MS = 60 * 60 * 1000;

export const pruneRealtimeEvents = pubsub
    .schedule("every 6 hours")
    .onRun(async () => {
        const exhibitsRef = realtimeDB.ref("/exhibits");
        const cutoff = Date.now() - PRUNE_THRESHOLD_MS;
        const snapshot = await exhibitsRef.get();

        if (!snapshot.exists()) {
            logger.info("[prune] /exhibits is empty, nothing to do");
            return null;
        }

        const exhibits = snapshot.val() as Record<
            string,
            Record<string, { timestamp?: number }> | null
        >;
        const updates: Record<string, null> = {};
        let deletedEvents = 0;
        let touchedExhibits = 0;

        for (const [exhibitId, events] of Object.entries(exhibits)) {
            if (!events) continue;
            let touched = false;
            for (const [eventKey, event] of Object.entries(events)) {
                const ts = event?.timestamp ?? 0;
                if (ts < cutoff) {
                    // Setting a child path to null in a multi-location update
                    // deletes it; emptied exhibit nodes disappear on their own.
                    updates[`${exhibitId}/${eventKey}`] = null;
                    deletedEvents++;
                    touched = true;
                }
            }
            if (touched) touchedExhibits++;
        }

        if (deletedEvents === 0) {
            logger.info("[prune] nothing older than threshold");
            return null;
        }

        await exhibitsRef.update(updates);
        logger.info(
            `[prune] deleted ${deletedEvents} events across ${touchedExhibits} exhibits`
        );
        return null;
    });
