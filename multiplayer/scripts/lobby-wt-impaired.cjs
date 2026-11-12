#!/usr/bin/env node
// Real loopback QUIC under actual UDP loss, delay and reordering. This is a
// transport resilience check, not a WAN capacity or browser performance result.
require("ts-node/register");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const { ensureLobbyCertificate } = require("./lobby-cert.cjs");
const { createWebTransportGateway } = require("../src/transport/webtransport.ts");
const { createQuicImpairmentProxy } = require("../loadtest/quic-impairment.cjs");
const { encodeControl, createControlDecoder, encodeMovement, decodeMovement } = require("../protocol/lobby-v2.js");
const nativeImport = new Function("s", "return import(s)");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function bounded(promise, ms = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("HTTP/3 impairment check timed out")), ms);
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
const percentile = (items, fraction) => {
    const sorted = [...items].sort((a, b) => a - b);
    return +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]?.toFixed(2);
};
(async () => {
    const cert = ensureLobbyCertificate();
    const { WebTransport, quicheLoaded } = await nativeImport("@fails-components/webtransport");
    await quicheLoaded;
    let endpoint;
    let highestServerSequence = 0;
    const server = await createWebTransportGateway({
        host: "127.0.0.1",
        port: 0,
        cert: readFileSync(cert.certPath, "utf8"),
        key: readFileSync(cert.keyPath, "utf8"),
        origins: ["http://localhost:13000"],
        allowOriginlessLoopbackClients: true,
        gateway: {
            accept: async (ticket, peer) => {
                if (ticket !== "impaired-ticket-0123456789") return null;
                endpoint = peer;
                peer.sendControl("welcome", { id: 1 });
                return "impaired";
            },
            receiveControl: (_id, type, data) => endpoint.sendControl(type, data),
            receiveDatagram: (_id, bytes) => {
                const move = decodeMovement(bytes);
                if (!move || move.sequence <= highestServerSequence) return;
                highestServerSequence = move.sequence;
                endpoint.sendDatagram(bytes);
            },
            disconnect: () => {},
        },
    });
    let proxy;
    let client;
    let running = true;
    try {
        proxy = await createQuicImpairmentProxy({ targetPort: server.address().port, seed: 41, delayMs: 50, jitterMs: 20, loss: 0.02, reorder: 0.1 });
        const started = performance.now();
        client = new WebTransport(`https://127.0.0.1:${proxy.address().port}/lobby-v2?ticket=impaired-ticket-0123456789`, { requireUnreliable: true, serverCertificateHashes: cert.serverCertificateHashes.map((h) => ({ ...h, value: Uint8Array.from(h.value) })) });
        client.closed.catch(() => {});
        await bounded(client.ready);
        assert.equal(client.reliability, "supports-unreliable");
        const handshakeMs = performance.now() - started;
        const stream = await client.createBidirectionalStream();
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        const controls = [];
        const decoder = createControlDecoder((message) => controls.push(message));
        const readingControls = (async () => {
            while (running) {
                const result = await reader.read();
                if (result.done) break;
                decoder.push(result.value);
            }
        })().catch((error) => {
            if (running) throw error;
        });
        const datagramWriter = client.datagrams.createWritable().getWriter();
        const datagramReader = client.datagrams.readable.getReader();
        const sendTimes = new Map();
        const rtts = [];
        const gaps = [];
        let lastArrival;
        let highestSequence = 0;
        let reorderedMovement = 0;
        let received = 0;
        const readingDatagrams = (async () => {
            while (running) {
                const result = await datagramReader.read();
                if (result.done) break;
                const move = decodeMovement(result.value);
                if (!move) continue;
                received++;
                if (move.sequence <= highestSequence) {
                    reorderedMovement++;
                    continue;
                }
                highestSequence = move.sequence;
                const now = performance.now();
                rtts.push(now - sendTimes.get(move.sequence));
                if (lastArrival) gaps.push(now - lastArrival);
                lastArrival = now;
            }
        })().catch((error) => {
            if (running) throw error;
        });
        const sent = 200;
        const measurementStarted = performance.now();
        for (let sequence = 1; sequence <= sent; sequence++) {
            const deadline = measurementStarted + (sequence - 1) * 50;
            if (performance.now() < deadline) await pause(deadline - performance.now());
            sendTimes.set(sequence, performance.now());
            await datagramWriter.write(encodeMovement({ sequence, x: sequence * 0.01, y: 0, z: 0, yaw: 0, animation: 1, floor: true }));
            if (sequence % 10 === 1) await writer.write(encodeControl("chat", { sequence, text: "Reliable control through QUIC loss" }));
        }
        await writer.write(encodeControl("done", { sent }));
        const waitStarted = performance.now();
        while (!controls.some((message) => message.type === "done") && performance.now() - waitStarted < 5000) await pause(20);
        await pause(300);
        assert.equal(controls.filter((message) => message.type === "chat").length, 20);
        assert(controls.some((message) => message.type === "done"));
        assert(highestSequence >= sent - 4, "Latest movement must stay fresh despite packet loss");
        assert(rtts.length >= sent * 0.6, "A useful fraction of unreliable updates must arrive");
        assert(proxy.stats().packetsLost > 0, "Test must actually drop UDP packets");
        assert.equal(proxy.stats().packetsOverflowed, 0);
        console.log(JSON.stringify({ kind: "HTTP/3 QUIC transport impairment", reliability: client.reliability, handshakeMs: +handshakeMs.toFixed(2), durationMs: +(performance.now() - measurementStarted).toFixed(2), sentMovement: sent, receivedMovement: received, latestSequence: highestSequence, reorderedMovement, reliableControlsSent: 21, reliableControlsReceived: controls.filter((message) => message.type !== "welcome").length, movementRttMs: { p50: percentile(rtts, 0.5), p95: percentile(rtts, 0.95) }, movementGapMs: { p50: percentile(gaps, 0.5), p95: percentile(gaps, 0.95) }, proxy: proxy.stats(), transport: server.stats(), limits: ["One Node client and echo server on loopback, not a capacity test.", "Delay, loss and reordering apply to actual UDP QUIC packets in both directions.", "The seed fixes the impairment PRNG, not event-loop or QUIC packetization timing.", "No WebSocket performance comparison and no voice media."] }, null, 2));
        running = false;
        client.close();
        await bounded(Promise.all([readingControls, readingDatagrams]), 3000).catch(() => {});
    } finally {
        running = false;
        if (client) client.close();
        if (proxy) await proxy.close();
        await server.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
