import { GROUP_RECONNECT_GRACE_MS, LobbyGroups } from "./groups";
import { verifyLobbyClaims } from "../identity/lobby";
import { StageAuthority } from "./stage";
import { Worker } from "worker_threads";
import { randomBytes } from "crypto";
import { createServer } from "http";
import { attachWorkerIngress, clientAddress } from "./ingress";
import { join } from "path";
import { readFileSync } from "fs";
import { availableParallelism } from "os";
import express from "express";
import cors from "cors";
import { createSharedWorld, SharedWorld, blankPose } from "./shared";
import { profile } from "../rooms/crowd/protocol";
import { Member, Reservation } from "./gateway";
import { createWebTransportGateway, GatewayEndpoint } from "../transport/webtransport";
export interface WorldOptions {
    port?: number;
    wsBase?: number;
    wtBase?: number;
    workers?: number;
    capacity?: number;
    detailThreshold?: number;
    bind?: string;
    wtBind?: string;
    singlePort?: boolean;
    trustFlyProxy?: boolean;
    adminPort?: number;
    acmeChallenges?: Map<string, string>;
    onWorkerFailure?: (owner: number, code: number) => void;
    webtransport?: boolean;
    testMode?: boolean;
    region?: string;
    origins?: string[];
    publicHost?: string;
    certPath?: string;
    keyPath?: string;
}
export async function createWorldServer(options: WorldOptions = {}) {
    const detailThreshold = options.detailThreshold || 4096;
    const bind = options.bind || "127.0.0.1",
        port = options.port || 2575,
        wsBase = options.wsBase || 2576,
        wtBase = options.wtBase || 2590,
        capacity = options.capacity || 10000,
        workerCount = options.workers || Math.min(8, Math.max(1, availableParallelism() - 2)),
        roomId = "oncyber-world-v2",
        region = options.region || "local",
        epoch = randomBytes(4).readUInt32LE(0);
    if (!Number.isSafeInteger(capacity) || capacity < 2 || capacity > 100000 || !Number.isSafeInteger(workerCount) || workerCount < 1 || workerCount > 32) throw new Error("Invalid world capacity or worker count");
    if (![port, wsBase, wtBase].every((n) => Number.isInteger(n) && n >= 1 && n <= 65535) || wsBase + workerCount - 1 > 65535 || !Number.isSafeInteger(detailThreshold) || detailThreshold < 1 || detailThreshold > 100000) throw new Error("Invalid world port or detail threshold");
    const loopback = ["127.0.0.1", "localhost", "::1"].includes(bind);
    if (options.testMode && !loopback) throw new Error("Test mode requires loopback bind");
    const origins = options.origins || ["http://localhost:13000", "http://127.0.0.1:13000", "https://oncyber.io", "https://www.oncyber.io"];
    const shared = createSharedWorld(capacity),
        state = new SharedWorld(shared),
        workers: Worker[] = [],
        loads = Array.from({ length: workerCount }, () => 0),
        live = new Set<number>(),
        free = Array.from({ length: capacity }, (_, i) => capacity - i - 1),
        seats = new Map<number, Reservation & { active: boolean; identity: string; verified: boolean; claim?: "owner" | "admin" }>(),
        tokens = new Map<string, number>(),
        // Seats released moments ago: a browser that reconnects naming one in replaceToken is the same traveller.
        departed = new Map<string, { identity: string; at: number }>();
    const pendingRevokes = new Map<string, { resolve: () => void; reject: (error: Error) => void; promise: Promise<void>; timer: NodeJS.Timeout }>();
    const proxySessions = new Map<string, { endpoint: GatewayEndpoint; owner: number }>(),
        pendingProxies = new Map<number, { resolve: (id: string | null) => void; timer: NodeJS.Timeout }>();
    let proxyRequest = 0,
        proxyInBytes = 0,
        proxyOutBytes = 0;
    const proxyInputs: any[][] = Array.from({ length: workerCount }, (): any[] => []),
        proxyInputBytes = Array.from({ length: workerCount }, () => 0),
        proxyInputInFlight = Array.from({ length: workerCount }, () => false);
    let staleProxyDatagrams = 0;
    let detailBudget = 128;
    const updateBudget = () => {
        if (metadata.size > detailThreshold) detailBudget = 64;
        else if (metadata.size < Math.max(1, detailThreshold - 1024)) detailBudget = 128;
        return detailBudget;
    };
    let nextId = 1,
        shuttingDown = false,
        metadataRevision = 0;
    const metadata = new Map<number, Member>();
    const groups = new LobbyGroups({
        member(id) {
            const member = metadata.get(Number(id));
            if (!member) return;
            let name = member.profile.username;
            try { name = decodeURIComponent(name); } catch { /* Keep bounded server profile. */ }
            return { id, name: name.slice(0, 40) || "Guest", avatar: member.profile.avatar, vrmUrl: member.profile.VRM, scale: member.profile.scale };
        },
        pose(id) {
            const member = metadata.get(Number(id));
            if (!member) return;
            const pose = blankPose(member.slot);
            if (state.read(member.slot, pose) && pose.id === member.id) return { x: pose.x, y: pose.y, z: pose.z, rotation: pose.yaw };
        },
        send(id, event, data) {
            const seat = seats.get(Number(id));
            if (seat?.active && live.has(seat.owner)) workers[seat.owner].postMessage({ type: "group-deliver", id, event, data });
        },
        place(id, travelId, pose, peers, held) {
            const seat = seats.get(Number(id));
            if (seat?.active && live.has(seat.owner)) workers[seat.owner].postMessage({ type: "group-place", id, travelId, pose, peers, held });
        },
        activeWorld(id, active) {
            const seat = seats.get(Number(id));
            if (seat?.active && live.has(seat.owner)) workers[seat.owner].postMessage({ type: "group-presence", id, active });
        },
        identity(id) {
            return seats.get(Number(id))?.identity;
        },
    });
    let tls: any, certificateHashes: any[] | undefined;
    if (options.webtransport) {
        if (options.certPath && options.keyPath) tls = { cert: readFileSync(options.certPath, "utf8"), key: readFileSync(options.keyPath, "utf8") };
        else {
            if (!loopback) throw new Error("Public WebTransport requires configured TLS certificate");
            const generated = require("../../scripts/lobby-cert.cjs").ensureLobbyCertificate();
            tls = { cert: readFileSync(generated.certPath, "utf8"), key: readFileSync(generated.keyPath, "utf8") };
            certificateHashes = generated.serverCertificateHashes;
        }
    }
    const broadcast = (message: any) => {
        for (const i of live) workers[i].postMessage(message);
    };
    const stage = new StageAuthority();
    let stageSent = -1;
    const publishStage = () => {
        if (stage.revision === stageSent) return;
        stageSent = stage.revision;
        broadcast({ type: "stage", stage: stage.snapshot() });
    };
    const release = (id: number) => {
        const seat = seats.get(id);
        if (!seat) return;
        groups.disconnect(String(id));
        seats.delete(id);
        tokens.delete(seat.token);
        departed.set(seat.token, { identity: seat.identity, at: Date.now() });
        loads[seat.owner]--;
        stage.leave(id);
        publishStage();
        state.remove(seat.slot, id);
        free.push(seat.slot);
        if (metadata.delete(id)) {
            metadataRevision++;
            updateBudget();
            broadcast({ type: "remove", id });
        }
    };
    const pendingStats = new Map<number, { resolve: (value: any) => void; results: any[]; expected: number; timer: NodeJS.Timeout }>();
    let statsId = 0;
    const ready: Promise<void>[] = [];
    for (let owner = 0; owner < workerCount; owner++) {
        const extension = __filename.endsWith(".ts") ? "ts" : "js";
        const worker = new Worker(join(__dirname, `worker.${extension}`), { workerData: { owner, detailThreshold, shared, epoch, roomId, region, bind, wsPort: wsBase + owner, wtPort: wtBase + owner, origins, allowOriginlessLoopbackClients: !!options.testMode }, execArgv: extension === "ts" ? ["-r", "ts-node/register/transpile-only"] : [] });
        workers.push(worker);
        ready.push(
            new Promise<void>((resolve, reject) => {
                let listening = false;
                worker.on("message", (message: any) => {
                    if (message.type === "listening") {
                        listening = true;
                        live.add(owner);
                        worker.postMessage({ type: "stage", stage: stage.snapshot() });
                        resolve();
                    } else if (message.type === "fatal") reject(new Error(message.message));
                    else if (message.type === "accepted") {
                        const seat = seats.get(message.id);
                        if (!seat || seat.token !== message.token) {
                            worker.postMessage({ type: "revoke", token: message.token });
                            return;
                        }
                        seat.active = true;
                        const member: Member = { id: seat.id, slot: seat.slot, owner, profile: seat.profile, revision: 1 };
                        metadata.set(seat.id, member);
                        updateBudget();
                        metadataRevision++;
                        broadcast({ type: "member", member });
                        stage.join(seat.id, seat.identity, seat.verified, seat.claim);
                        publishStage();
                    } else if (["group-ready", "group-action", "group-placed"].includes(message.type)) {
                        const seat = seats.get(message.actor);
                        if (!seat?.active || seat.owner !== owner) return;
                        const actor = String(seat.id);
                        if (message.type === "group-ready") groups.connect(actor);
                        else if (message.type === "group-action") groups.action(actor, message.data);
                        else groups.placed(actor, message.travelId);
                    } else if (message.type === "stage-action") {
                        const seat = seats.get(message.actor),
                            data = message.data;
                        if (!seat?.active || seat.owner !== owner || !data) return;
                        if (data.kind === "request") stage.request(seat.id, data.cancel === true);
                        else if (data.kind === "leave") stage.leaveStage(seat.id);
                        else if (data.kind === "admin") {
                            const outcome = stage.admin(seat.id, data.action, Number(data.sessionId));
                            worker.postMessage({ type: "stage-result", id: seat.id, data: { action: data.action, sessionId: data.sessionId, ok: outcome.ok, error: outcome.error || "" } });
                            const target = outcome.kick !== undefined ? seats.get(outcome.kick) : undefined;
                            if (target?.active && live.has(target.owner)) workers[target.owner].postMessage({ type: "stage-kick", id: target.id });
                        }
                        publishStage();
                    } else if (message.type === "left") release(message.id);
                    else if (message.type === "revoked") {
                        const id = tokens.get(message.token);
                        if (id) release(id);
                        const pending = pendingRevokes.get(message.token);
                        if (pending) {
                            clearTimeout(pending.timer);
                            pendingRevokes.delete(message.token);
                            pending.resolve();
                        }
                    } else if (message.type === "proxy-accepted") {
                        const pending = pendingProxies.get(message.request);
                        if (pending) {
                            clearTimeout(pending.timer);
                            pendingProxies.delete(message.request);
                            pending.resolve(message.id);
                        }
                    } else if (message.type === "proxy-end") {
                        const session = proxySessions.get(message.id);
                        if (session?.owner === owner) session.endpoint.close(message.code, message.reason);
                    } else if (message.type === "proxy-input-ack") {
                        proxyInputInFlight[owner] = false;
                    } else if (message.type === "proxy-output") {
                        const buffers = new Map<string, number>();
                        for (const item of message.batch) {
                            const session = proxySessions.get(item.id);
                            if (!session || session.owner !== owner) continue;
                            if (item.kind === "control") {
                                if (Date.now() - item.queuedAt > 5000) {
                                    session.endpoint.close(4008, "Stale reliable control");
                                    continue;
                                }
                                proxyOutBytes += Buffer.byteLength(JSON.stringify(item.data)) + 64;
                                if (!session.endpoint.sendControl(item.type, item.data)) session.endpoint.close(4008, "Control backlog");
                            } else if (item.kind === "datagram") {
                                if (Date.now() - item.queuedAt <= 150) {
                                    proxyOutBytes += item.bytes.byteLength;
                                    session.endpoint.sendDatagram(item.bytes);
                                } else staleProxyDatagrams++;
                            } else if (item.kind === "close") session.endpoint.close(item.code, item.reason);
                            buffers.set(item.id, session.endpoint.bufferedAmount());
                        }
                        worker.postMessage({ type: "proxy-buffer", batch: Array.from(buffers, ([id, bytes]) => ({ id, bytes })) });
                    } else if (message.type === "profile") {
                        const seat = seats.get(message.member?.id);
                        if (seat?.active && seat.owner === owner) {
                            metadata.set(seat.id, message.member);
                            metadataRevision++;
                            broadcast({ type: "member", member: message.member });
                            groups.profileChanged(String(seat.id));
                        }
                    } else if (message.type === "relay") {
                        const from = seats.get(message.from);
                        if (from?.owner !== owner) return;
                        for (const target of Array.isArray(message.to) ? message.to.slice(0, 128) : []) {
                            const to = seats.get(target);
                            if (to?.active && live.has(to.owner)) workers[to.owner].postMessage({ type: "relay", from: message.from, to: target, event: message.event, data: message.data });
                        }
                    } else if (message.type === "stats") {
                        const pending = pendingStats.get(message.request);
                        if (!pending) return;
                        pending.results.push({ ...message.stats, transport: message.transport });
                        if (pending.results.length >= pending.expected) {
                            clearTimeout(pending.timer);
                            pendingStats.delete(message.request);
                            pending.resolve(pending.results);
                        }
                    }
                });
                worker.on("error", (error) => {
                    if (!listening) reject(error);
                });
                worker.on("exit", (code) => {
                    live.delete(owner);
                    for (const [id, session] of proxySessions)
                        if (session.owner === owner) {
                            session.endpoint.close(1001, "World worker unavailable");
                            proxySessions.delete(id);
                        }
                    for (const seat of Array.from(seats.values()))
                        if (seat.owner === owner) {
                            state.reclaimAfterWriterExit(seat.slot);
                            release(seat.id);
                        }
                    if (!listening) reject(new Error(`World worker ${owner} exited ${code}`));
                    if (!shuttingDown) {
                        console.error(`World worker ${owner} exited ${code}; its sessions were released.`);
                        options.onWorkerFailure?.(owner, code);
                    }
                });
            })
        );
    }
    try {
        await Promise.all(ready);
    } catch (error) {
        shuttingDown = true;
        await Promise.all(workers.map((w) => w.terminate()));
        throw error;
    }
    async function revoke(token: string) {
        const existing = pendingRevokes.get(token);
        if (existing) return existing.promise;
        const id = tokens.get(token);
        if (!id) return;
        const seat = seats.get(id)!;
        let resolve!: () => void, reject!: (error: Error) => void;
        const promise = new Promise<void>((done, fail) => {
            resolve = done;
            reject = fail;
        });
        const timer = setTimeout(() => {
            pendingRevokes.delete(token);
            reject(new Error("Session revocation timed out"));
        }, 2000);
        pendingRevokes.set(token, { resolve, reject, timer, promise });
        workers[seat.owner].postMessage({ type: "revoke", token });
        return promise;
    }
    const proxyFlush = setInterval(() => {
        for (const owner of live) {
            const batch = proxyInputs[owner];
            if (proxyInputInFlight[owner] || !batch.length) continue;
            proxyInputs[owner] = [];
            proxyInputBytes[owner] = 0;
            proxyInputInFlight[owner] = true;
            workers[owner].postMessage(
                { type: "proxy-input", batch },
                batch.filter((item) => item.kind === "datagram").map((item) => item.bytes.buffer)
            );
        }
    }, 5);
    const transportGateway = {
        async accept(token: string, endpoint: GatewayEndpoint) {
            const actor = tokens.get(token),
                seat = actor && seats.get(actor);
            if (!seat || !live.has(seat.owner) || seat.expires < Date.now() || seat.active || proxySessions.has(String(actor))) return null;
            const id = String(actor),
                request = ++proxyRequest;
            proxySessions.set(id, { endpoint, owner: seat.owner });
            const result = await new Promise<string | null>((resolve) => {
                const timer = setTimeout(() => {
                    pendingProxies.delete(request);
                    proxySessions.delete(id);
                    workers[seat.owner].postMessage({ type: "proxy-close", id });
                    resolve(null);
                }, 3000);
                pendingProxies.set(request, { resolve, timer });
                workers[seat.owner].postMessage({ type: "proxy-accept", token, id, request, maxDatagramSize: endpoint.maxDatagramSize?.() || 1200 });
            });
            if (!result) proxySessions.delete(id);
            return result;
        },
        receiveControl(id: string, type: string, data: any) {
            const s = proxySessions.get(id);
            if (!s) return;
            const queue = proxyInputs[s.owner];
            const size = Buffer.byteLength(JSON.stringify(data)) + 64;
            if (queue.length >= 8192 || proxyInputBytes[s.owner] + size > 4 * 1024 * 1024) {
                s.endpoint.close(4008, "Ingress backlog");
                return;
            }
            proxyInBytes += size;
            proxyInputBytes[s.owner] += size;
            queue.push({ id, kind: "control", type, data, queuedAt: Date.now() });
        },
        receiveDatagram(id: string, bytes: Uint8Array) {
            const s = proxySessions.get(id);
            if (!s) return;
            const queue = proxyInputs[s.owner];
            if (queue.length >= 8192 || proxyInputBytes[s.owner] + bytes.byteLength > 4 * 1024 * 1024) return;
            proxyInBytes += bytes.byteLength;
            proxyInputBytes[s.owner] += bytes.byteLength;
            queue.push({ id, kind: "datagram", bytes: bytes.slice(), queuedAt: Date.now() });
        },
        disconnect(id: string) {
            const s = proxySessions.get(id);
            if (!s) return;
            proxySessions.delete(id);
            workers[s.owner].postMessage({ type: "proxy-close", id });
        },
    };
    let webtransport: any;
    try {
        if (tls) webtransport = await createWebTransportGateway({ gateway: transportGateway, host: options.wtBind || bind, port: wtBase, cert: tls.cert, key: tls.key, origins, maxConnections: capacity, allowOriginlessLoopbackClients: !!options.testMode });
    } catch (error) {
        clearInterval(proxyFlush);
        shuttingDown = true;
        await Promise.all(workers.map((w) => w.terminate()));
        throw error;
    }
    const app = express();
    app.disable("x-powered-by");
    if (options.acmeChallenges) app.get("/.well-known/acme-challenge/:token", (req, res) => {
        const value = options.acmeChallenges!.get(req.params.token);
        res.setHeader("Cache-Control", "no-store");
        if (!value) { res.status(404).end(); return; }
        res.type("text/plain").send(value);
    });
    app.use((req, res, next) => {
        if (req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({ error: "Origin not allowed" });
        next();
    });
    app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
    app.use(express.json({ limit: "16kb" }));
    const ipRates = new Map<string, { count: number; at: number }>();
    app.get("/lobby/health", (_req, res) => res.status(!shuttingDown && live.size === workerCount ? 200 : 503).json({ lobbyProtocol: 2, roomId, region, worldCapacity: capacity, population: metadata.size, networkBudget: updateBudget(), maxVisible: 128, highDensityVisible: 64, highDensityEnter: detailThreshold, highDensityLeave: Math.max(1, detailThreshold - 1024), workers: live.size, webTransport: !!tls }));
    app.post("/join", async (req, res) => {
        if (shuttingDown || !live.size) return res.status(503).json({ error: "World unavailable" });
        if (req.body?.lobbyProtocol !== 2) return res.status(400).json({ error: "Expected lobbyProtocol:2" });
        if (req.body.region && req.body.region !== region) return res.status(400).json({ error: "Unsupported region" });
        const now = Date.now(),
            ip = clientAddress(req, !!options.trustFlyProxy);
        if (!options.testMode) {
            let bucket = ipRates.get(ip);
            if (!bucket || now - bucket.at > 60000) {
                bucket = { count: 0, at: now };
                ipRates.set(ip, bucket);
            }
            if (++bucket.count > 120) return res.status(429).json({ error: "Join rate exceeded" });
        }
        const replace = req.body.replaceToken;
        if (typeof replace === "string") {
            try {
                await revoke(replace);
            } catch {
                return res.status(503).json({ error: "Previous session still closing; retry" });
            }
        }
        if (shuttingDown || !live.size) return res.status(503).json({ error: "World unavailable" });
        if (!free.length) return res.status(503).json({ error: "World capacity reached" });
        // An admin removed this traveller recently: their account, or the seat they reconnect from.
        if (stage.banned(verifyLobbyClaims(req.body.lobbyIdentityToken)?.sub) || (typeof replace === "string" && stage.banned(departed.get(replace)?.identity))) return res.status(403).json({ error: "Removed by an admin" });
        const owner = Array.from(live).sort((a, b) => loads[a] - loads[b] || a - b)[0],
            id = nextId++;
        if (id > 0x7fffffff) return res.status(503).json({ error: "World identity rollover requires restart" });
        const slot = free.pop()!,
            token = randomBytes(32).toString("hex"),
            claims = verifyLobbyClaims(req.body.lobbyIdentityToken),
            partyIdentity = claims?.sub,
            // The same traveller as the seat this one replaces, else the same verified account, else nobody but this seat.
            identity = (typeof replace === "string" && departed.get(replace)?.identity) || partyIdentity || token,
            role = stage.roleFor(identity, !!partyIdentity, claims?.role),
            base = profile(String(id), { ...req.body, userId: `guest:${id}` }, partyIdentity),
            reservation: Reservation = { id, slot, owner, token, expires: Date.now() + 15000, profile: role ? { ...base, role } : base };
        seats.set(id, { ...reservation, active: false, identity, verified: !!partyIdentity, claim: claims?.role });
        tokens.set(token, id);
        loads[owner]++;
        workers[owner].postMessage({ type: "reserve", reservation });
        const advertisedHost = options.publicHost || bind,
            host = advertisedHost.includes(":") && !advertisedHost.startsWith("[") ? `[${advertisedHost}]` : advertisedHost,
            scheme = options.publicHost ? "wss" : "ws";
        res.setHeader("Cache-Control", "no-store");
        return res.json({ lobbyProtocol: 2, roomId, region, sessionId: String(id), token, wsUrl: options.singlePort ? `${scheme}://${host}${options.publicHost ? "" : `:${port}`}/lobby-v2/${owner}` : `${scheme}://${host}:${wsBase + owner}/lobby-v2`, ...(tls ? { webTransportUrl: `https://${host}:${wtBase}/lobby-v2`, certificateHashes } : {}), expiresAt: reservation.expires });
    });
    async function metrics(reset = false) {
        const request = ++statsId,
            results: any[] = await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    const p = pendingStats.get(request);
                    pendingStats.delete(request);
                    resolve(p?.results || []);
                }, 2000);
                pendingStats.set(request, { resolve, results: [], expected: live.size, timer });
                for (const i of live) workers[i].postMessage({ type: reset ? "reset-stats" : "stats", request });
                if (!live.size) {
                    clearTimeout(timer);
                    pendingStats.delete(request);
                    resolve([]);
                }
            });
        return { lobbyProtocol: 2, roomId, region, epoch, population: metadata.size, reservations: seats.size - metadata.size, capacity, workers: results, workerCount: live.size, metadataRevision, networkBudget: updateBudget(), webtransport: webtransport?.stats(), proxy: { sessions: proxySessions.size, ingressBytes: proxyInBytes, egressBytes: proxyOutBytes, staleDatagrams: staleProxyDatagrams, pendingBytes: proxyInputBytes.reduce((a, b) => a + b, 0), inFlightBatches: proxyInputInFlight.filter(Boolean).length }, memory: process.memoryUsage() };
    }
    if (loopback) app.get("/lobby/metrics", async (_req, res) => res.json(await metrics()));
    if (loopback && options.testMode) app.post("/lobby/metrics/reset", async (_req, res) => res.json(await metrics(true)));
    const server = createServer(app);
    const closeIngress = options.singlePort ? attachWorkerIngress(server, { wsBase, workerCount, origins, available: (owner) => !shuttingDown && live.has(owner), maxConnections: capacity + 64, workerHost: bind === "::1" ? "::1" : "127.0.0.1" }) : () => {};
    // Operational statistics stay on the machine; access through Fly SSH only.
    const admin = options.adminPort ? createServer(async (req, res) => {
        if (req.method !== "GET" || req.url !== "/lobby/metrics") { res.writeHead(404).end(); return; }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(await metrics()));
    }) : undefined;
    try {
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, bind, resolve);
        });
        if (admin) await new Promise<void>((resolve, reject) => { admin.once("error", reject); admin.listen(options.adminPort, "127.0.0.1", resolve); });
    } catch (error) {
        shuttingDown = true;
        clearInterval(proxyFlush);
        closeIngress();
        server.close();
        admin?.close();
        await webtransport?.close();
        await Promise.all(workers.map((w) => w.terminate()));
        throw error;
    }
    const cleanup = setInterval(() => {
        const now = Date.now();
        groups.tick();
        for (const seat of Array.from(seats.values()))
            if (!seat.active && seat.expires < now) {
                if (!pendingRevokes.has(seat.token)) void revoke(seat.token).catch(() => {});
            }
        for (const [ip, bucket] of ipRates) if (now - bucket.at > 60000) ipRates.delete(ip);
        for (const [token, seat] of departed) {
            if (now - seat.at <= GROUP_RECONNECT_GRACE_MS) break;
            departed.delete(token);
        }
    }, 1000);
    async function close() {
        if (shuttingDown) return;
        shuttingDown = true;
        clearInterval(cleanup);
        clearInterval(proxyFlush);
        await webtransport?.close();
        for (const pending of pendingRevokes.values()) {
            clearTimeout(pending.timer);
            pending.resolve();
        }
        pendingRevokes.clear();
        closeIngress();
        admin?.closeAllConnections?.();
        if (admin) await new Promise<void>((resolve) => admin.close(() => resolve()));
        server.closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        for (const w of workers) w.postMessage({ type: "stop" });
        await Promise.all(
            workers.map(
                (w) =>
                    new Promise<void>((resolve) => {
                        const timer = setTimeout(() => void w.terminate().then(() => resolve()), 3000);
                        w.once("exit", () => {
                            clearTimeout(timer);
                            resolve();
                        });
                    })
            )
        );
        for (const pending of pendingStats.values()) {
            clearTimeout(pending.timer);
            pending.resolve(pending.results);
        }
        pendingStats.clear();
    }
    async function replaceWebTransportCertificate(value: { cert: string; key: string }) {
        if (shuttingDown) throw new Error("World is closing");
        if (tls?.cert === value.cert && tls?.key === value.key && webtransport) return;
        // The pinned native QUIC binding cannot reload its proof source. Rotate
        // only the QUIC listener; clients reconnect and WS/world state stays live.
        tls = undefined;
        certificateHashes = undefined;
        await webtransport?.close();
        webtransport = undefined;
        if (shuttingDown) return;
        const next = await createWebTransportGateway({ gateway: transportGateway, host: options.wtBind || bind, port: wtBase, cert: value.cert, key: value.key, origins, maxConnections: capacity });
        if (shuttingDown) { await next.close(); return; }
        webtransport = next;
        tls = value;
    }
    return { close, metrics, replaceWebTransportCertificate, address: { bind, port, wsBase, wtBase, workerCount, capacity }, certificateHashes };
}
