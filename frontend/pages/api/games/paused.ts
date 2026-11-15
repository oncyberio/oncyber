import type { NextApiRequest, NextApiResponse } from "next";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import { gamePause } from "@features/games/gameDisabled";

/**
 * The kill switch for one game (`GAMES_DISABLED`, docs/games/field-health.md):
 * `{ paused, releases }`, the same answer /games/<id> gets in its page
 * props. The lobby asks before it prepares a game in a hidden frame
 * (features/games/gamePrepare.ts), so a paused game loads nowhere.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();
    const id = typeof req.query.game === "string" ? req.query.game : "";
    // Games are hidden at launch, and so is what is known about them.
    if (!gamesPreviewEnabled() || !findGame(id)) return res.status(404).end();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(gamePause(id));
}
