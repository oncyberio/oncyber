/** Dedicated v1 lobby service. Does not bootstrap Firebase or the legacy arena. */
import dotenv from "dotenv";
dotenv.config({ path: process.env.NODE_ENV === "production" ? "arena.env" : "development.env" });

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer, Server as HttpServer } from "http";
import { createTurnCredentials } from "./utils/turnCredentials";
import { Server, LocalPresence } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { registerCrowdRoom, joinCrowd, crowdJoinLimiter, lobbyHealth } from "./rooms/crowd/join";

const origins = new Set(
    (process.env.LOBBY_ORIGINS || "https://oncyber.io,https://www.oncyber.io")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
);
const permittedOrigin = (origin?: string) => !origin || origins.has(origin);
const app = express();
app.disable("x-powered-by");
// Only enable this for a known ingress hop. The loopback default bind keeps
// clients from bypassing a local proxy and forging its forwarded address.
const trustProxy = process.env.LOBBY_TRUST_PROXY;
if (trustProxy) app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
app.use((req, res, next) => {
    if (!permittedOrigin(req.headers.origin)) return res.status(403).json({ success: false, message: "Origin not allowed" });
    next();
});
app.use(cors({ origin: (origin, callback) => callback(null, permittedOrigin(origin)), methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"], maxAge: 600 }));
app.use(express.json({ limit: "16kb" }));
app.get("/lobby/health", lobbyHealth);
app.post("/join", crowdJoinLimiter, joinCrowd);
app.get("/turnCredentials", rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }), (_req, res) => {
    const secret = process.env.TURN_SECRET,
        host = process.env.TURN_HOST;
    if (!secret || !host) return res.status(404).json({ success: false });
    const requestedTtl = Number(process.env.TURN_TTL);
    const ttl = Math.max(60, Math.min(3600, Number.isFinite(requestedTtl) && requestedTtl > 0 ? requestedTtl : 3600));
    const { username, credential } = createTurnCredentials(secret, ttl);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`], username, credential, ttl });
});
app.use((_req, res) => res.status(404).json({ success: false }));

class DedicatedLobbyServer extends Server {
    // v0.14 otherwise intercepts /matchmake before Express/CORS/rate limiting.
    // Reservations must use our validated, region-scoped /join handler.
    protected attachMatchMakingRoutes(_server: HttpServer) {}
}
const server = new DedicatedLobbyServer({
    presence: new LocalPresence(),
    transport: new WebSocketTransport({ server: createServer(app), maxPayload: 32768, verifyClient: (info: { origin: string }) => permittedOrigin(info.origin) }),
});
registerCrowdRoom(server);
const bind = process.env.LOBBY_BIND || "127.0.0.1";
const requestedPort = Number(process.env.LOBBY_PORT || 2568);
if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) throw new Error("LOBBY_PORT must be an integer from 1 to 65535.");
// Colyseus installs SIGINT/SIGTERM graceful room shutdown by default.
server
    .listen(requestedPort, bind)
    .then(() => {
        console.log(`Dedicated lobby listening at http://${bind}:${requestedPort}`);
    })
    .catch((error) => {
        console.error("Dedicated lobby could not listen:", error);
        process.exitCode = 1;
        void server.gracefullyShutdown(true, error);
    });
