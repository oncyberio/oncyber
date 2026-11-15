import type { NextApiRequest, NextApiResponse } from "next";
import {
    readGameHealthEvent,
    recordLocalGameHealth,
} from "@features/games/gameHealthSummary";

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

/**
 * Development only: keeps this server's own `game health` events in memory
 * so /dev/games can show them. Deployed sites send them to analytics
 * instead (features/games/gameHealth.ts) and this route does not exist.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (process.env.NODE_ENV !== "development") return res.status(404).end();
    if (req.method !== "POST") return res.status(405).end();
    const event = readGameHealthEvent(req.body);
    if (!event) return res.status(400).end();
    recordLocalGameHealth(event);
    return res.status(204).end();
}
