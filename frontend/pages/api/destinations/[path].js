import { corsMiddleware } from "../../../utils/middlewares/corsMiddleware";
import { getDestinationBySlug } from "@utils/firestore/destinations";

export default async (req, res) => {
    await corsMiddleware(req, res);

    try {
        const slug = req.query.path;

        if (!slug) {
            return res.json({ success: false });
        }

        const destination_data = await getDestinationBySlug(slug);

        if (!destination_data) return res.json({ success: false });

        var { params, ...destination } = destination_data;

        // slug -> destination is identical for every viewer and rarely changes,
        // so let the CDN serve one cached copy instead of hitting an SSR/API
        // Firestore read per view. stale-while-revalidate keeps it serving
        // instantly while a fresh copy is fetched in the background, so the 5min
        // TTL costs nothing in latency and edits still surface within ~minutes.
        res.setHeader(
            "Cache-Control",
            "public, s-maxage=300, stale-while-revalidate=600"
        );

        res.json({
            success: true,
            destination: { ...params, ...destination },
        });
    } catch (err) {
        res.json({ success: false });
    }
};
