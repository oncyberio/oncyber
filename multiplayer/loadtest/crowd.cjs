/* Real local WebSockets only. Run a separate `npm run lobby:dev` process first. */
const { performance } = require("node:perf_hooks");
// Force the installed ws transport, so actual wire bytes are measurable on Node22 as well.
const WebSocket = require("ws"),
    sockets = new Set();
global.WebSocket = class LocalLoadSocket extends WebSocket {
    constructor(url, protocols) {
        super(url, protocols, { handshakeTimeout: 15000 });
        sockets.add(this);
        this.once("close", () => sockets.delete(this));
    }
};
const { Client } = require("colyseus.js");
const options = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
const endpoint = new URL(options.endpoint || "http://127.0.0.1:2568");
if (!["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || !["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("Load tests are restricted to loopback hosts");
const population = Math.max(2, Math.min(2048, Number(options.clients) || 64));
const duration = Math.max(3, Math.min(120, Number(options.seconds) || 10));
const warmup = Math.max(1, Math.min(60, Number(options.warmup) || 3));
const scenario = options.scenario || "dense";
if (!["dense", "spread"].includes(scenario)) throw new Error("scenario must be dense or spread");
const jitter = Math.max(0, Math.min(300, Number(options.jitter) || 0));
const clients = [],
    failures = [],
    acks = [],
    snapshotGaps = [];
let moveTimer;
let receivedBytes = 0,
    sentBytes = 0,
    maxAOI = 0,
    maxVoice = 0,
    snapshots = 0,
    corrections = 0,
    running = true;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function json(path, init) {
    const r = await fetch(new URL(path, endpoint), { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}
async function connect(index) {
    const reservation = await json("/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 1, label: "local-loadtest", userId: `load-${index}`, username: `Local ${index}` }) });
    let seatTimer;
    const room = await Promise.race([
        new Client(endpoint.href.replace(/^http/, "ws").replace(/\/$/, "")).consumeSeatReservation(reservation.reservation),
        new Promise((_, reject) => {
            seatTimer = setTimeout(() => reject(new Error("Seat handshake timeout")), 20000);
        }),
    ]).finally(() => clearTimeout(seatTimer));
    const entry = { room, index, seq: 0, pose: [0, 0, 0, 0], ready: false, visible: new Set(), pending: new Map(), lastSnapshot: 0, accumulated: 0, nextSend: 0 };
    clients.push(entry);
    const ws = room.connection.transport.ws,
        originalSend = ws.send;
    ws.send = function (data, ...args) {
        sentBytes += data.byteLength || data.length || 0;
        return originalSend.call(this, data, ...args);
    };
    ws.on("message", (data) => {
        receivedBytes += data.byteLength || data.length || 0;
    });
    room.onMessage("*", (type, msg) => {
        const now = performance.now();
        if (type === "lobby-welcome") {
            entry.pose = msg.position;
            entry.ready = true;
            room.send("rtc-ready", {});
        }
        if (type === "lobby-roster") {
            for (const id of msg.leave) entry.visible.delete(id);
            for (const p of msg.enter) entry.visible.add(p.sessionId);
            maxAOI = Math.max(maxAOI, entry.visible.size);
        }
        if (type === "lobby-voice") maxVoice = Math.max(maxVoice, msg.peers.length);
        if (type === "lobby-snapshot") {
            snapshots++;
            if (entry.lastSnapshot) snapshotGaps.push(now - entry.lastSnapshot);
            entry.lastSnapshot = now;
        }
        if (type === "lobby-ack") {
            const sent = entry.pending.get(msg.seq);
            if (sent !== undefined) acks.push(now - sent);
            for (const seq of entry.pending.keys()) if (seq <= msg.seq) entry.pending.delete(seq);
            if (msg.corrected) {
                corrections++;
                entry.pose = msg.position;
            }
        }
    });
    room.onError((code, message) => failures.push({ index, code, message }));
    room.onLeave((code) => {
        if (running) failures.push({ index, close: code });
    });
}

const percentile = (values, q) => {
    const ordered = values.slice().sort((a, b) => a - b);
    return +(ordered[Math.floor(ordered.length * q)] || 0).toFixed(3);
};
(async () => {
    const health = await json("/lobby/health");
    if (health.lobbyProtocol !== 1) throw new Error("Not a local crowd protocol server");
    // Bound concurrent HTTP joins rather than creating an unbounded request burst.
    let cursor = 0;
    await Promise.all(
        Array.from({ length: Math.min(24, population) }, async () => {
            while (running && cursor < population) {
                const i = cursor++;
                await connect(i);
            }
        })
    );
    for (const c of clients) c.room.send("lobby-ready", {});
    const readyDeadline = performance.now() + 15000;
    while (clients.some((c) => !c.ready)) {
        if (performance.now() > readyDeadline) throw new Error("Welcome timeout");
        await sleep(20);
    }
    const started = performance.now();
    let previous = started;
    moveTimer = setInterval(() => {
        const now = performance.now(),
            elapsed = (now - started) / 1000,
            dt = Math.min(0.15, (now - previous) / 1000);
        previous = now;
        for (const c of clients) {
            if (!c.ready) continue;
            c.accumulated += dt;
            if (now < c.nextSend) continue;
            const motionDt = c.accumulated;
            c.accumulated = 0;
            c.nextSend = now + 50 + ((c.index * 37 + c.seq * 19) % (jitter + 1));
            const angle = scenario === "spread" ? c.index * 2.399963 : elapsed * 0.5 + c.index * 2.399963;
            const speed = scenario === "spread" ? 4 : 1.5;
            c.pose[0] = Math.max(-150, Math.min(150, c.pose[0] + Math.cos(angle) * speed * motionDt));
            c.pose[2] = Math.max(-150, Math.min(150, c.pose[2] + Math.sin(angle) * speed * motionDt));
            c.pose[3] = angle;
            const seq = ++c.seq;
            c.pending.set(seq, now);
            if (c.pending.size > 256) c.pending.delete(c.pending.keys().next().value);
            c.room.send("lobby-move", [seq, ...c.pose, -1, true]);
        }
    }, 10);
    await sleep(warmup * 1000);
    await json("/lobby-metrics/reset", { method: "POST" });
    const before = await json("/lobby-metrics"),
        bytesBefore = { receivedBytes, sentBytes },
        sampleStart = performance.now();
    acks.length = 0;
    snapshotGaps.length = 0;
    snapshots = 0;
    corrections = 0;
    await sleep(duration * 1000);
    const after = await json("/lobby-metrics"),
        seconds = (performance.now() - sampleStart) / 1000;
    clearInterval(moveTimer);
    running = false;
    const total = (report, key) => report.rooms.reduce((sum, room) => sum + room[key], 0);
    const report = { localOnly: true, scenario, clients: population, seconds: +seconds.toFixed(2), warmup, jitterMs: jitter, connected: clients.filter((c) => c.ready).length, roomCount: after.rooms.length, populations: after.rooms.map((r) => r.population), maxAOI, maxVoice, serverVoiceMax: Math.max(0, ...after.rooms.map((r) => r.voiceMax)), snapshots, corrections, failures, serverEventLoopMs: after.eventLoopMs, serverTickMs: after.rooms.map((r) => r.tickMs), serverStageMs: after.rooms.map((r) => r.stageMs), ackRTTMs: { p50: percentile(acks, 0.5), p95: percentile(acks, 0.95) }, snapshotGapMs: { p50: percentile(snapshotGaps, 0.5), p95: percentile(snapshotGaps, 0.95) }, wireBytesPerSecond: { serverOutbound: Math.round((total(after, "sentBytes") - total(before, "sentBytes")) / seconds), serverInbound: Math.round((total(after, "receivedBytes") - total(before, "receivedBytes")) / seconds), clientsReceived: Math.round((receivedBytes - bytesBefore.receivedBytes) / seconds), clientsSent: Math.round((sentBytes - bytesBefore.sentBytes) / seconds) }, droppedSnapshots: total(after, "droppedSnapshots") - total(before, "droppedSnapshots") };
    console.log(JSON.stringify(report, null, 2));
    await Promise.race([Promise.all(clients.map((c) => c.room.leave())), sleep(3000)]);
    for (const socket of sockets) socket.terminate();
    if (failures.length || maxAOI > 128 || maxVoice > 8 || (report.serverVoiceMax > 0 && maxVoice === 0) || report.populations.some((n) => n > 512 && !process.env.LOBBY_MAX_CLIENTS)) process.exitCode = 1;
})().catch(async (error) => {
    clearInterval(moveTimer);
    running = false;
    console.error(error);
    for (const socket of sockets) socket.terminate();
    process.exitCode = 1;
});
