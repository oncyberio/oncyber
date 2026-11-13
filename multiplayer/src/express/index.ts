import { NativeCohortError, readLobbyGroupCohort, selectNativeRoom } from "./groupCohort";
import { joinCrowd, crowdJoinLimiter, lobbyHealth } from "../rooms/crowd/join";
import { Response, Request } from "express";

import * as colyseus from "colyseus";

import { matchMaker } from "colyseus";

import { LOGS } from "../utils/Logs";

import basicAuth from "express-basic-auth";

import { monitor } from "@colyseus/monitor";

import { Mutex, MutexInterface, Semaphore, SemaphoreInterface, withTimeout } from "async-mutex";

import { issueTurnCredentials } from "../utils/turnIssuer";

const mutex = new Mutex();

export function initializeExpress(app: any) {
    app.get("/lobby/health", lobbyHealth);
    app.get("/", (req: Request, res: Response) => {
        res.send("Hello world from cyber!!");
    });

    // Short-lived TURN credentials (Cloudflare TURN, or coturn's shared
    // secret). When TURN isn't configured we 404 so the client fails open to
    // STUN-only. Unauthenticated, so the TTL stays at most an hour.
    app.get("/turnCredentials", async (req: Request, res: Response) => {
        const { status, body } = await issueTurnCredentials(process.env);
        res.setHeader("Cache-Control", "no-store");
        res.status(status).json(body);
    });

    app.get("/getRoom", async (req: Request, res: Response) => {
        try {
            const data = await colyseus.matchMaker.query({
                roomId: req.query.roomId as string,
            });

            res.json({ success: true, room: data[0] });
        } catch (err) {
            res.json({
                success: false,
            });
        }
    });

    app.get("/getRooms", async (req: Request, res: Response) => {
        try {
            const data = await colyseus.matchMaker.query();

            data.sort((a, b) => {
                return b.clients - a.clients;
            });

            res.json({ success: true, rooms: data.filter(room => !room.metadata?.lobbyGroupCohort) });
        } catch (err) {
            res.json({
                success: false,
            });
        }
    });

    app.post("/join", async (req: Request, res: Response) => {
        if (req.body?.lobbyProtocol === 1) {
            return crowdJoinLimiter(req, res, () => { void joinCrowd(req, res); });
        }
        try {
            await mutex.runExclusive(async () => {
                let { type } = req.query;

                if (!type) type = "cyber";

                try {
                    const rooms = await matchMaker.query({
                        name: type as string,
                    });

                    if (!req.body?.label || !req.body?.avatar || !req.body?.userId || !req.body?.position || !req.body?.currentSpace) {
                        return res.json({
                            success: false,
                            message: "failed to join room.",
                        });
                    }

                    const cohort = readLobbyGroupCohort(req.body.lobbyGroupCohort);
                    if (cohort && type !== "cyber") throw new NativeCohortError("Group travel is not supported by this room type.");
                    const room = selectNativeRoom(rooms, req.body.label, cohort);

                    let reservation = null;

                    if (room) {
                        LOGS.routeOnJoin({
                            userId: req.body.userId,
                            username: req.body.username,
                            roomType: type as string,
                        });

                        reservation = await matchMaker.joinById(room.roomId, req.body);
                    } else {
                        LOGS.routeOnCreate({
                            userId: req.body.userId,
                            username: req.body.username,
                            roomType: type as string,
                        });

                        reservation = await matchMaker.create(type as string, req.body);
                    }

                    res.json({
                        success: true,
                        reservation,
                        ...(cohort ? { lobbyGroupCohort: cohort } : {}),
                    });
                } catch (err) {
                    LOGS.routeFailedToJoin({
                        userId: req?.body?.userId,
                        username: req?.body?.username,
                        error: err as string,
                    });

                    console.log("errr", err, type, req.body);

                    res.json({
                        success: false,
                        message: err instanceof NativeCohortError ? err.message : "Failed to join room",
                    });
                }
            });
        } catch (err) {
            console.log("err", err);
            res.json({
                success: false,
                message: "Failed to join room",
            });
        }
    });

    const basicAuthMiddleware = basicAuth({
        users: {
            admin: process.env.MONITOR_PASSWORD,
        },
        challenge: true,
    });

    app.use(
        "/cyber-h",
        basicAuthMiddleware,
        monitor({
            columns: ["roomId", "name", "clients", "maxClients", { metadata: "spaceId" }, "locked", "elapsedTime"],
        })
    );
}
