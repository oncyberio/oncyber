#!/usr/bin/env node
// Moderate genuine HTTP/3 load against an already-running loopback test server.
// One native client process; this does not establish 10,000-session QUIC capacity.
const { writeFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const { encodeControl, createControlDecoder, encodeMovement, decodeSnapshot } = require("../protocol/lobby-v2.js");
const { encodeInputs, input } = require("../protocol/movement.js");
const args = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((v) => v.startsWith("--"))
        .map((v) => v.slice(2).split("="))
);
const endpoint = new URL(args.endpoint || "http://127.0.0.1:2575");
const count = Number(args.clients || 100),
    seconds = Number(args.duration || 10),
    concurrency = Number(args.concurrency || 4);
if (!["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || endpoint.protocol !== "http:" || endpoint.username || endpoint.password) throw new Error("QUIC load target must be loopback HTTP");
if (!Number.isInteger(count) || count < 2 || count > 256 || !Number.isFinite(seconds) || seconds < 1 || seconds > 60 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error("Use 2–256 clients, 1–60 seconds, 1–16 admission concurrency");
const nativeImport = new Function("s", "return import(s)");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (items, q) => {
    const sorted = [...items].sort((a, b) => a - b);
    return sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))].toFixed(3) : null;
};
function bounded(promise, label, ms = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}
async function request(path, body) {
    const response = await fetch(new URL(path, endpoint), { ...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error || path}`);
    return result;
}
(async () => {
    const clients = [],
        rtts = [],
        gaps = [];
    let running = true,
        measuring = false,
        moveTimer,
        sentBytes = 0,
        receivedBytes = 0,
        sentMovement = 0,
        receivedFrames = 0,
        skippedMovement = 0;
    const errors = [];
    let disconnects = 0;
    const { WebTransport, quicheLoaded } = await nativeImport("@fails-components/webtransport");
    await quicheLoaded;
    try {
        const health = await request("/lobby/health");
        assert.equal(health.lobbyProtocol, 2);
        assert(health.webTransport);
        let next = 0;
        await Promise.all(
            Array.from({ length: Math.min(concurrency, count) }, async () => {
                while (running && next < count) {
                    const index = next++;
                    const seat = await request("/join", { lobbyProtocol: 2, username: `QUIC load ${index}` });
                    if (!running) return;
                    const url = new URL(seat.webTransportUrl);
                    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Refusing public QUIC endpoint returned by loopback admission");
                    url.searchParams.set("ticket", seat.token);
                    const transport = new WebTransport(url.href, { requireUnreliable: true, serverCertificateHashes: seat.certificateHashes.map((hash) => ({ ...hash, value: Uint8Array.from(hash.value) })) });
                    let welcomeResolve;
                    const welcome = new Promise((resolve) => {
                        welcomeResolve = resolve;
                    });
                    const client = { transport, seat, readers: [], origin: null, sequence: 0, history: [], simulatedAt: performance.now(), pending: new Map(), seen: new Set(), peers: new Set(), writing: false, lastFrame: 0, connected: true, frames: 0, acknowledgements: 0 };
                    clients.push(client);
                    transport.closed.then(
                        () => {
                            if (running) {
                                client.connected = false;
                                disconnects++;
                            }
                        },
                        (error) => {
                            if (running) {
                                client.connected = false;
                                disconnects++;
                                errors.push(String(error.message).slice(0, 160));
                            }
                        }
                    );
                    await bounded(transport.ready, "QUIC admission");
                    assert.equal(transport.reliability, "supports-unreliable");
                    const stream = await bounded(transport.createBidirectionalStream(), "Control stream");
                    client.writer = stream.writable.getWriter();
                    client.datagramWriter = transport.datagrams.createWritable().getWriter();
                    const decoder = createControlDecoder((message) => {
                        if (message.type === "lobby-welcome") {
                            client.origin = message.data.position;
                            welcomeResolve();
                        }
                        if (message.type === "lobby-roster") {
                            for (const peer of message.data.enter || []) client.peers.add(peer.sessionId);
                            for (const id of message.data.leave || []) client.peers.delete(id);
                        }
                        if (message.type === "lobby-ack") {
                            client.acknowledgements++;
                            const at = client.pending.get(message.data.seq);
                            if (measuring && at !== undefined && rtts.length < 50000) rtts.push(performance.now() - at);
                            for (const seq of client.pending.keys()) if (seq <= message.data.seq) client.pending.delete(seq);
                        }
                    });
                    const controlReader = stream.readable.getReader();
                    client.readers.push(
                        (async () => {
                            while (running) {
                                const result = await controlReader.read();
                                if (result.done) break;
                                if (measuring) receivedBytes += result.value.byteLength;
                                decoder.push(result.value);
                            }
                        })().catch((error) => {
                            if (running) errors.push(String(error.message).slice(0, 160));
                        })
                    );
                    const datagramReader = transport.datagrams.readable.getReader();
                    client.readers.push(
                        (async () => {
                            while (running) {
                                const result = await datagramReader.read();
                                if (result.done) break;
                                const frame = decodeSnapshot(result.value);
                                if (!frame) continue;
                                client.frames++;
                                for (const pose of frame.poses) client.seen.add(pose[0]);
                                if (measuring) {
                                    receivedBytes += result.value.byteLength;
                                    receivedFrames++;
                                    if (frame.chunk === 0) {
                                        const now = performance.now();
                                        if (client.lastFrame && gaps.length < 50000) gaps.push(now - client.lastFrame);
                                        client.lastFrame = now;
                                    }
                                }
                            }
                        })().catch((error) => {
                            if (running) errors.push(String(error.message).slice(0, 160));
                        })
                    );
                    await bounded(client.writer.write(encodeControl("lobby-ready", args.input === "1" ? { movement: "input-v1", motion: "velocity-v1" } : {})), "Ready control");
                    await bounded(welcome, "World welcome");
                }
            })
        );
        for (const client of clients) client.simulatedAt = performance.now();
        // Keep every connection active throughout the measured interval; one
        // pending datagram write per client bounds the generator too.
        moveTimer = setInterval(() => {
            const now = performance.now(),
                phase = now / 1000;
            for (const client of clients) {
                if (!client.origin || !client.connected) continue;
                if (client.writing) {
                    if (measuring) skippedMovement++;
                    continue;
                }
                const [x, y, z] = client.origin;
                let bytes;
                if (args.input === "1") {
                    const steps = Math.min(6, Math.floor((now - client.simulatedAt) / (1000 / 60)));
                    if (!steps) continue;
                    for (let n = 0; n < steps; n++) {
                        client.simulatedAt += 1000 / 60;
                        client.history.push({ ...input({ strafe: 0, forward: -1, yaw: phase + Number(client.seat.sessionId), running: false, jump: false, animation: -1 }), sequence: ++client.sequence });
                        client.pending.set(client.sequence, now);
                    }
                    client.history = client.history.slice(-12);
                    bytes = encodeInputs(client.history);
                } else {
                    const sequence = ++client.sequence;
                    bytes = encodeMovement({ sequence, x: x + Math.sin(phase + Number(client.seat.sessionId)) * 0.3, y, z: z + Math.cos(phase + Number(client.seat.sessionId)) * 0.3, yaw: phase % (Math.PI * 2), animation: -1, floor: true });
                    client.pending.set(sequence, now);
                }
                while (client.pending.size > 128) client.pending.delete(client.pending.keys().next().value);
                client.writing = true;
                client.datagramWriter
                    .write(bytes)
                    .then(
                        () => {
                            if (measuring) {
                                sentMovement++;
                                sentBytes += bytes.byteLength;
                            }
                        },
                        (error) => {
                            if (running) errors.push(String(error.message).slice(0, 160));
                        }
                    )
                    .finally(() => {
                        client.writing = false;
                    });
            }
        }, 50);
        await pause(2000);
        const before = await request("/lobby/metrics/reset", {});
        for (const client of clients) client.lastFrame = 0;
        measuring = true;
        const started = performance.now();
        await pause(seconds * 1000);
        const after = await request("/lobby/metrics");
        const elapsed = (performance.now() - started) / 1000;
        measuring = false;
        const assignments = new Map(clients.map((client) => [Number(client.seat.sessionId), client.seat.wsUrl]));
        const crossWorker = clients.some((client) => [...client.seen].some((id) => assignments.has(id) && assignments.get(id) !== client.seat.wsUrl));
        assert(
            clients.every((client) => client.frames > 0 && client.acknowledgements > 0),
            "Every client must receive snapshots and movement acks"
        );
        assert.equal(disconnects, 0);
        assert.equal(errors.length, 0);
        assert(crossWorker);
        const result = { at: new Date().toISOString(), transport: "HTTP/3 QUIC", movement: args.input === "1" ? "input-v1/velocity-v1" : "pose-v1", reliability: "supports-unreliable", scenario: "Dense one shared world; one native Node generator process; loopback; no audio", requested: count, connected: clients.length, stillOpen: clients.filter((client) => client.connected).length, seconds: elapsed, disconnects, errors, sameWorld: new Set(clients.map((client) => client.seat.roomId)).size === 1, crossWorkerVisibility: crossWorker, sentMovement, receivedSnapshotFrames: receivedFrames, skippedMovement, applicationSentBytesPerSecond: sentBytes / elapsed, applicationReceivedBytesPerSecond: receivedBytes / elapsed, acknowledgementRttMs: { p50: percentile(rtts, 0.5), p95: percentile(rtts, 0.95) }, snapshotGapMs: { p50: percentile(gaps, 0.5), p95: percentile(gaps, 0.95) }, server: after, serverCounterDelta: { ingressBytes: after.proxy.ingressBytes - before.proxy.ingressBytes, egressBytes: after.proxy.egressBytes - before.proxy.egressBytes, staleProxyDatagrams: after.proxy.staleDatagrams - before.proxy.staleDatagrams }, limits: ["100-client scale by default, not 10,000 tested WebTransport sessions.", "Server and generator share one machine; no WAN, browser rendering, or voice media load.", "Application payload counters exclude QUIC encryption, framing, acknowledgements, and UDP overhead."] };
        if (args.output) writeFileSync(args.output, JSON.stringify(result, null, 2) + "\n");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        if (args.output) writeFileSync(args.output, JSON.stringify({ at: new Date().toISOString(), transport: "HTTP/3 QUIC", requested: count, connected: clients.filter((client) => client.origin).length, stillOpen: clients.filter((client) => client.connected).length, disconnects, errors, failure: error.message }, null, 2) + "\n");
        throw error;
    } finally {
        running = false;
        measuring = false;
        clearInterval(moveTimer);
        for (const client of clients) client.transport.close();
        await bounded(Promise.all(clients.flatMap((client) => client.readers)), "Client cleanup", 3000).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
