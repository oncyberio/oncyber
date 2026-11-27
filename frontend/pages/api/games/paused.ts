import type { NextApiRequest, NextApiResponse } from "next";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import {
    gameKillSwitch,
    killSwitchForRelease,
} from "@features/games/health/gameDisabled";
import { loadGameFrame } from "@features/games/publish/gameReleaseServer";

/**
 * The kill switch for one game (`GAMES_DISABLED`, docs/games/field-health.md):
 * `{ paused, releases, frame }`, the same answer /games/<id> gets in its
 * page props: whether the game may load, and the frame its pointer names
 * (docs/games/releases.md). The lobby asks before it prepares a game in a
 * hidden frame (features/games/loading/gamePrepare.ts), so a paused game loads
 * nowhere and a prepared one is the release the page will show.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") return res.status(405).end();
    const id = typeof req.query.game === "string" ? req.query.game : "";
    // Games are hidden at launch, and so is what is known about them.
    if (!gamesPreviewEnabled() || !findGame(id)) return res.status(404).end();
    res.setHeader("Cache-Control", "no-store");
    const frame = await loadGameFrame(id);
    return res.status(200).json({
        ...killSwitchForRelease(gameKillSwitch(id), frame.release),
        frame,
    });
}
