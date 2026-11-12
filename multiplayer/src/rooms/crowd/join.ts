import { Request, Response } from "express";
import { matchMaker, Server } from "colyseus";
import rateLimit from "express-rate-limit";
import { CrowdLobbyRoom } from ".";
import { configuredRegion, configuredLabel } from "./protocol";
export function registerCrowdRoom(server: Server) {
    server.define("crowd-lobby", CrowdLobbyRoom).filterBy(["label", "region"]);
}
export const crowdJoinLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
export async function joinCrowd(req: Request, res: Response) {
    try {
        if (req.body?.lobbyProtocol !== 1 || typeof req.body.userId !== "string" || !req.body.userId || req.body.userId.length > 128) return res.status(400).json({ success: false, message: "Invalid lobby request" });
        const region = configuredRegion(req.body.region);
        const options = { ...req.body, region, label: configuredLabel() };
        // Colyseus reservation-aware locking shards full rooms; no global legacy /join mutex.
        let reservation: any;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                reservation = await matchMaker.joinOrCreate("crowd-lobby", options);
                break;
            } catch (error) {
                if (attempt === 2) throw error;
            }
        }
        return res.json({ success: true, lobbyProtocol: 1, region, reservation });
    } catch (error) {
        return res.status(503).json({ success: false, message: "Lobby unavailable or unsupported region" });
    }
}

export function lobbyHealth(_req: Request, res: Response) {
    res.json({ lobbyProtocol: 1, region: configuredRegion() });
}
