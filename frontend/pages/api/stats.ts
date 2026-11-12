import { auth } from "../../utils/middlewares/authMiddleware";
import { db, fire } from "../../utils/firebaseAdmin";
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import { getExhibitById } from "./exhibit";
import { Experience } from "@uitypes/experience";

// FETCH_ANALYTICS scans the ENTIRE per-event subcollections (details_artwork,
// click_opensea, click_start_show), which grow unbounded — one doc is appended
// per interaction forever — so a single dashboard open on a popular exhibit
// costs one read per accumulated event. Cache the computed result in a
// cross-instance Firestore doc so repeat opens cost ~1 read instead, bounding
// the expensive scan to once per TTL window per exhibit. Stats are non-critical
// creator vanity numbers, so an hour of staleness is fine.
const ANALYTICS_TTL_MS = 60 * 60 * 1000;

// Safety valve: the per-event subcollections grow unbounded, so cap how many
// docs a single scan reads. Normal exhibits are far below this; only pathological
// ones (hundreds of thousands of events) are bounded — their per-token counts
// become an approximation from the first N events, which is fine for vanity
// stats and prevents a single dashboard open from reading the whole history.
const MAX_ANALYTICS_EVENTS_PER_TYPE = 5000;

async function getAnalytics(userId, eventType, exhibitId) {
    const analytics = [];

    const ref = db
        .collection("analytics")
        .doc(userId)
        .collection(eventType)
        .where("exhibitId", "==", exhibitId)
        .limit(MAX_ANALYTICS_EVENTS_PER_TYPE);

    const snapshot = await ref.get();

    snapshot.forEach((doc) => {
        analytics.push({
            ...doc.data(),
            id: doc.id,
        });
    });

    return analytics;
}

export default async (req, res) => {
    //
    await corsMiddleware(req, res);

    const { eventType, payload } = req.body;

    try {
        if (req.query.type === "FETCH_ANALYTICS") {
            //
            var userId = await auth(req);

            const { exhibitId } = req.body;

            const exhibitDoc = await db
                .collection("exhibits")
                .doc(exhibitId)
                .get();

            if (!exhibitDoc.exists) {
                //
                throw new Error("Can't find exhibit " + exhibitId);
            }

            const exhibit = exhibitDoc.data() as Experience;

            // TODO: Do we need to protect this route?
            if (
                !exhibit.editors.some(
                    (it) => it.toLowerCase() === userId.toLowerCase()
                )
            ) {
                //
                throw new Error("Forbidden");
            }

            // Serve from the cross-instance cache when fresh, skipping the
            // unbounded event scans below. (The exhibit doc was still read
            // above for the editor auth check.)
            const cacheRef = db
                .collection("caches")
                .doc(`analytics-${exhibitId}`);

            const cached = (await cacheRef.get()).data();

            if (cached && Date.now() - cached.ts < ANALYTICS_TTL_MS) {
                return res.status(200).json({
                    success: true,
                    analytics: cached.analytics,
                });
            }

            const ownerId = exhibit.owner;

            const [click_opensea, details_artwork, click_start_show] =
                await Promise.all([
                    getAnalytics(ownerId, "click_opensea", exhibitId),
                    getAnalytics(ownerId, "details_artwork", exhibitId),
                    getAnalytics(ownerId, "click_start_show", exhibitId),
                ]);

            // Diagnostic: surfaces which caller/exhibit drives the read spikes,
            // and flags any event type that hit the cap (i.e. an oversized
            // history worth migrating to incremental counters).
            console.log("[FETCH_ANALYTICS]", {
                userId,
                exhibitId,
                ownerId,
                counts: {
                    click_opensea: click_opensea.length,
                    details_artwork: details_artwork.length,
                    click_start_show: click_start_show.length,
                },
                capped:
                    details_artwork.length >= MAX_ANALYTICS_EVENTS_PER_TYPE ||
                    click_opensea.length >= MAX_ANALYTICS_EVENTS_PER_TYPE ||
                    click_start_show.length >= MAX_ANALYTICS_EVENTS_PER_TYPE,
            });

            const formatted_details_artwork = {};

            details_artwork.map((event) => {
                if (!formatted_details_artwork[event.token_id]) {
                    formatted_details_artwork[event.token_id] = 1;
                } else {
                    formatted_details_artwork[event.token_id] += 1;
                }
                // formatted_details_artwork[event.token_id] = typeof formatted_details_artwork?.[event.token_id] === "undefined"
                //     ? 0
                //     : formatted_details_artwork[event.token_id] + 1;
            });

            const formatted_click_opensea = {};
            click_opensea.map((event) => {
                if (!formatted_click_opensea[event.artworkTokenId]) {
                    formatted_click_opensea[event.artworkTokenId] = 1;
                } else {
                    formatted_click_opensea[event.artworkTokenId] += 1;
                }

                // formatted_click_opensea[event.artworkTokenId] = typeof formatted_click_opensea?.[event.artworkTokenId] === "undefined"
                //     ? 0
                //     : formatted_click_opensea[event.artworkTokenId] + 1;
            });

            const analytics = {
                click_opensea: formatted_click_opensea,
                details_artwork: formatted_details_artwork,
                click_start_show: Object.values(click_start_show).length,
            };

            // Best-effort write-back; a failed cache write just means the next
            // open recomputes.
            cacheRef.set({ ts: Date.now(), analytics }).catch(() => {});

            return res.status(200).json({
                success: true,
                analytics,
            });
        }

        if (eventType === "click_start_show") {
            const increment = fire.FieldValue.increment(1);

            await db.collection("exhibits").doc(payload.exhibitId).update({
                number_of_visits: increment,
            });

            const day_increment = fire.FieldValue.increment(1);

            try {
                await db
                    .collection("analytics_days")
                    .doc(new Date().toDateString())
                    .collection("exhibits")
                    .doc(payload.exhibitId)
                    .update({
                        number_of_visits: day_increment,
                    });
            } catch (err) {
                await db
                    .collection("analytics_days")
                    .doc(new Date().toDateString())
                    .collection("exhibits")
                    .doc(payload.exhibitId)
                    .set({
                        number_of_visits: day_increment,
                    });
            }
        }

        await db
            .collection("analytics")
            .doc(payload.ownerId)
            .collection(eventType)
            .add(payload);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.log("AN ERROR");
        console.error(err);
        return res.status(400).json({ success: false });
    }
};
