/** Explicitly local-only, independent of Firebase/moderator APIs and the legacy arena bootstrap. */
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { monitorEventLoopDelay } from "perf_hooks";
import { Server, LocalPresence } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { registerCrowdRoom, joinCrowd, lobbyHealth } from "./rooms/crowd/join";
import { activeCrowdRooms } from "./rooms/crowd";
process.env.LOBBY_PROFILE_TICKS ??= "1";
const app = express();
app.use(cors());
app.use(express.json({ limit: "16kb" }));
// Local harness deliberately bypasses per-IP HTTP join limits: hundreds of clients share loopback.
app.post("/join", joinCrowd);
app.get("/lobby/health", lobbyHealth);
const delay = monitorEventLoopDelay({ resolution: 10 });
delay.enable();
app.get("/lobby-metrics", (_req, res) => res.json({ localOnly: true, uptimeSeconds: process.uptime(), eventLoopMs: { p50: delay.percentile(50) / 1e6, p95: delay.percentile(95) / 1e6, max: delay.max / 1e6 }, rooms: Array.from(activeCrowdRooms.values()).map((room) => room.metrics()) }));
app.post("/lobby-metrics/reset", (_req, res) => {
    delay.reset();
    for (const room of activeCrowdRooms.values()) room.resetMetrics();
    res.json({ localOnly: true });
});
const server = new Server({ presence: new LocalPresence(), transport: new WebSocketTransport({ server: createServer(app), maxPayload: 32768 }) });
registerCrowdRoom(server);
const port = Number(process.env.LOBBY_DEV_PORT) || 2568;
server.listen(port, "127.0.0.1").then(() => console.log(`Local lobby only: http://127.0.0.1:${port}`));
