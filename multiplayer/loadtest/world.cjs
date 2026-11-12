#!/usr/bin/env node
const { fork } = require("node:child_process"),
    { performance } = require("node:perf_hooks"),
    { writeFileSync } = require("node:fs"),
    WebSocket = require("ws"),
    { encodeMovement } = require("../protocol/lobby-v2.js");
const { encodeInputs, input } = require("../protocol/movement.js");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("="))),
    endpoint = args.endpoint || "http://127.0.0.1:2575";
if (!["127.0.0.1", "localhost", "::1"].includes(new URL(endpoint).hostname)) throw Error("Only loopback load targets allowed");
const wait = (ms) => new Promise((r) => setTimeout(r, ms)),
    pct = (a, p) => {
        a.sort((a, b) => a - b);
        return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0;
    };
async function req(path, body) {
    const r = await fetch(endpoint + path, { method: body ? "POST" : "GET", body: body && JSON.stringify(body), headers: body ? { "Content-Type": "application/json" } : undefined, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error(`HTTP ${r.status} ${await r.text()}`);
    return r.json();
}
if (args.child) {
    const count = +args.clients,
        clients = [],
        rtt = [],
        gaps = [],
        pairs = [],
        roomIds = new Set(),
        closeReasons = {},
        errors = {};
    let errorEvents = 0,
        received = 0,
        sent = 0,
        failures = 0,
        closed = 0,
        welcomes = 0,
        aoiMax = 0,
        populationMax = 0,
        crossWorker = false,
        measuring = false,
        moveTimer;
    const recordError = (error, stage) => {
        const key = stage + ":" + String(error?.code || error?.cause?.code || "unknown") + ":" + String(error?.message || error).slice(0, 160);
        errors[key] = (errors[key] || 0) + 1;
    };
    const sample = (a, v) => {
        if (!measuring) return;
        if (a.length < 12000) a.push(v);
        else a[Math.floor(Math.random() * a.length)] = v;
    };
    async function connect(i) {
        const t = await req("/join", { lobbyProtocol: 2, username: "Load test" });
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(t.wsUrl, { perMessageDeflate: false }),
                c = { ws, wsUrl: t.wsUrl, id: +t.sessionId, seq: 0, origin: null, pending: new Map(), history: [], simulatedAt: performance.now(), roster: new Set(), last: 0 };
            clients.push(c);
            let done = false;
            const timer = setTimeout(() => {
                if (!done) {
                    done = true;
                    ws.terminate();
                    reject(Error("Join timed out"));
                }
            }, 20000);
            ws.on("open", () => ws.send(JSON.stringify({ type: "session", data: { token: t.token } })));
            ws.on("message", (raw, binary) => {
                binary = typeof binary === "boolean" ? binary : typeof raw !== "string";
                if (measuring) received += Buffer.byteLength(raw);
                if (binary) {
                    if (raw.readUInt16LE(18) === 0) {
                        if (c.last) sample(gaps, performance.now() - c.last);
                        c.last = performance.now();
                    }
                    return;
                }
                let m;
                try {
                    m = JSON.parse(raw);
                } catch {
                    return;
                }
                if (m.type === "session-accepted") ws.send(JSON.stringify({ type: "lobby-ready", data: args.input === "1" ? { movement: "input-v1", motion: "velocity-v1" } : {} }));
                if (m.type === "lobby-welcome") {
                    c.origin = m.data.position;
                    c.simulatedAt = performance.now();
                    roomIds.add(m.data.roomId);
                    welcomes++;
                    if (!done) {
                        done = true;
                        clearTimeout(timer);
                        resolve();
                    }
                }
                if (m.type === "lobby-roster") {
                    for (const p of m.data.enter || []) {
                        c.roster.add(p.sessionId);
                        if (pairs.length < 64) pairs.push([c.id, +p.sessionId]);
                    }
                    for (const id of m.data.leave || []) c.roster.delete(id);
                    aoiMax = Math.max(aoiMax, c.roster.size);
                    populationMax = Math.max(populationMax, m.data.population || 0);
                }
                if (m.type === "lobby-ack") {
                    const at = c.pending.get(m.data.seq);
                    if (at) sample(rtt, performance.now() - at);
                    for (const seq of c.pending.keys()) if (seq <= m.data.seq) c.pending.delete(seq);
                }
            });
            ws.on("error", (e) => {
                errorEvents++;
                recordError(e, "websocket");
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    reject(e);
                }
            });
            ws.on("close", (code, reason) => {
                const label = String(code) + ":" + String(reason);
                closeReasons[label] = (closeReasons[label] || 0) + 1;
                closed++;
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    reject(Error("Closed during join"));
                }
            });
        });
    }
    (async () => {
        let bucket = 0;
        moveTimer = setInterval(() => {
            const now = performance.now(),
                phase = now / 1000;
            for (let i = bucket; i < clients.length; i += 5) {
                const c = clients[i];
                if (!c.origin || c.ws.readyState !== 1) continue;
                const [x, y, z] = c.origin;
                let packet;
                if (args.input === "1") {
                    const steps = Math.min(6, Math.floor((now - c.simulatedAt) / (1000 / 60)));
                    if (!steps) continue;
                    for (let n = 0; n < steps; n++) {
                        c.simulatedAt += 1000 / 60;
                        c.history.push({ ...input({ strafe: 0, forward: -1, yaw: phase + c.id, running: false, jump: false, animation: -1 }), sequence: ++c.seq });
                        c.pending.set(c.seq, now);
                    }
                    c.history = c.history.slice(-12);
                    packet = encodeInputs(c.history);
                } else {
                    const sequence = ++c.seq;
                    packet = encodeMovement({ sequence, x: x + Math.sin(phase + c.id) * 0.3, y, z: z + Math.cos(phase + c.id) * 0.3, yaw: phase % 6.28, animation: -1, floor: true });
                    c.pending.set(sequence, now);
                }
                while (c.pending.size > 32) c.pending.delete(c.pending.keys().next().value);
                c.ws.send(packet);
                if (measuring) sent += packet.byteLength;
            }
            bucket = (bucket + 1) % 5;
        }, 10);
        let next = 0;
        await Promise.all(
            Array.from({ length: Math.min(Number(args.joinConcurrency || 4), count) }, async () => {
                while (next < count) {
                    try {
                        await connect(next++);
                    } catch (error) {
                        failures++;
                        recordError(error, "join");
                    }
                    await wait(Number(args.joinDelay || 50));
                }
            })
        );
        process.send({ type: "ready", connected: welcomes });
    })();
    process.on("message", async (m) => {
        if (m.type === "measure") {
            measuring = true;
            rtt.length = gaps.length = 0;
            received = sent = 0;
        }
        if (m.type === "stop") {
            measuring = false;
            clearInterval(moveTimer);
            process.send({ type: "result", result: { connected: welcomes, closeReasons, errors, errorEvents, failures, disconnects: closed, received, sent, aoiMax, aoiAtEnd: Math.max(0, ...clients.map((c) => c.roster.size)), populationMax, crossWorker, rtt, gaps, pairs, roomIds: Array.from(roomIds), assignments: clients.map((c) => [c.id, c.wsUrl]), stillOpen: clients.filter((c) => c.ws.readyState === 1).length } });
            for (const c of clients) c.ws.close();
            await wait(300);
            for (const c of clients) c.ws.terminate();
            process.exit(0);
        }
    });
} else {
    (async () => {
        const count = +(args.clients || 1000),
            processes = +(args.processes || 8),
            duration = +(args.duration || 10),
            children = [],
            ready = [],
            results = [],
            startupTimers = [],
            started = performance.now();
        let stopping = false;
        const cleanup = () => {
            if (stopping) return;
            stopping = true;
            for (const timer of startupTimers) clearTimeout(timer);
            for (const c of children) c.kill("SIGTERM");
        };
        process.once("SIGINT", () => {
            cleanup();
            process.exit(130);
        });
        process.once("SIGTERM", () => {
            cleanup();
            process.exit(143);
        });
        try {
            await req("/lobby/health");
            for (let i = 0; i < processes; i++) {
                const n = Math.floor(count / processes) + (i < count % processes ? 1 : 0);
                if (!n) continue;
                const child = fork(__filename, ["--child=1", `--clients=${n}`, `--input=${args.input || "0"}`, `--endpoint=${endpoint}`, `--joinConcurrency=${args.joinConcurrency || 4}`, `--joinDelay=${args.joinDelay || 50}`], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
                children.push(child);
                ready.push(
                    new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(Error("Generator startup timeout")), 240000);
                        startupTimers.push(timer);
                        child.on("message", (m) => {
                            if (m.type === "ready") {
                                clearTimeout(timer);
                                resolve(m.connected);
                            }
                            if (m.type === "result") results.push(m.result);
                        });
                        child.on("error", reject);
                        child.on("exit", (code) => {
                            if (code && !stopping) reject(Error(`Generator exited ${code}`));
                        });
                    })
                );
            }
            const connected = (await Promise.all(ready)).reduce((a, b) => a + b, 0);
            await wait(2000);
            const before = await req("/lobby/metrics/reset", {});
            for (const c of children) c.send({ type: "measure" });
            const at = performance.now();
            await wait(duration * 1000);
            const after = await req("/lobby/metrics"),
                elapsed = (performance.now() - at) / 1000;
            for (const c of children) c.send({ type: "stop" });
            const deadline = Date.now() + 10000;
            while (results.length < children.length && Date.now() < deadline) await wait(50);
            if (results.length !== children.length) throw Error("Missing generator result");
            const sum = (k) => results.reduce((n, r) => n + (r[k] || 0), 0),
                rtt = results.flatMap((r) => r.rtt),
                gaps = results.flatMap((r) => r.gaps),
                counters = (k) => after.workers.reduce((n, w) => n + w[k], 0) - before.workers.reduce((n, w) => n + w[k], 0);
            const assignments = new Map(results.flatMap((r) => r.assignments)),
                cross = results.flatMap((r) => r.pairs).filter(([a, b]) => assignments.has(a) && assignments.has(b) && assignments.get(a) !== assignments.get(b));
            const result = { at: new Date().toISOString(), transport: "websocket", movement: args.input === "1" ? "input-v1/velocity-v1" : "pose-v1", scenario: "Dense one shared world; moving guests; no audio media; loopback", requested: count, connected, processes, seconds: elapsed, totalSeconds: (performance.now() - started) / 1000, closeReasons: results.map((r) => r.closeReasons), errors: results.map((r) => r.errors), errorEvents: sum("errorEvents"), failures: sum("failures"), disconnects: sum("disconnects"), population: after.population, roomId: after.roomId, stillOpen: sum("stillOpen"), sharedRoomIds: Array.from(new Set(results.flatMap((r) => r.roomIds))), crossWorkerVisibility: cross.length > 0, crossWorkerPairs: cross.slice(0, 8).map(([a, b]) => ({ viewer: a, viewerGateway: assignments.get(a), peer: b, peerGateway: assignments.get(b) })), aoiMax: Math.max(...results.map((r) => r.aoiMax)), aoiAtEnd: Math.max(...results.map((r) => r.aoiAtEnd)), receivedBytesPerSecond: sum("received") / elapsed, sentBytesPerSecond: sum("sent") / elapsed, ackRttMs: { p50: pct(rtt, 0.5), p95: pct(rtt, 0.95), p99: pct(rtt, 0.99) }, snapshotGapMs: { p50: pct(gaps, 0.5), p95: pct(gaps, 0.95), p99: pct(gaps, 0.99) }, server: after, serverCountersDelta: { droppedSnapshots: counters("droppedSnapshots"), corrections: counters("corrections") } };
            if (args.output) writeFileSync(args.output, JSON.stringify(result, null, 2) + "\n");
            process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } catch (error) {
            const server = await req("/lobby/metrics").catch(() => null);
            for (const child of children) if (child.connected) child.send({ type: "stop" });
            const partialDeadline = Date.now() + 5000;
            while (results.length < children.length && Date.now() < partialDeadline) await wait(50);
            const failure = { at: new Date().toISOString(), requested: count, transport: "websocket", qualified: false, error: error.message, server, partialClients: results.map(({ connected, stillOpen, failures, errorEvents, errors, closeReasons }) => ({ connected, stillOpen, failures, errorEvents, errors, closeReasons })) };
            if (args.output) writeFileSync(args.output, JSON.stringify(failure, null, 2) + "\n");
            throw error;
        } finally {
            cleanup();
        }
    })().catch((e) => {
        console.error(e);
        process.exitCode = 1;
    });
}
