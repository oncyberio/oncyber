#!/usr/bin/env node
// Two real QUIC clients in the shared world, with reliable welcome/ack and
// cross-worker unreliable snapshots. Only targets a loopback test-mode server.
const assert = require("node:assert/strict");
const { encodeControl, createControlDecoder, encodeMovement, decodeSnapshot } = require("../protocol/lobby-v2.js");
const nativeImport = new Function("s", "return import(s)");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
    const start = performance.now();
    while (!check()) {
        if (performance.now() - start > 7000) throw new Error(`${label} timed out`);
        await pause(10);
    }
}
function bounded(promise, ms = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("World WebTransport timeout")), ms);
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
(async () => {
    const base = new URL(process.argv[2] || "http://127.0.0.1:2575");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) throw new Error("Smoke target must be loopback");
    const { WebTransport, quicheLoaded } = await nativeImport("@fails-components/webtransport");
    await quicheLoaded;
    const clients = [];
    let running = true;
    try {
        for (let index = 0; index < 2; index++) {
            const response = await fetch(new URL("/join", base), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lobbyProtocol: 2, username: `QUIC smoke ${index}` }) });
            const seat = await response.json();
            assert(response.ok, JSON.stringify(seat));
            const address = new URL(seat.webTransportUrl);
            address.searchParams.set("ticket", seat.token);
            const transport = new WebTransport(address.toString(), { requireUnreliable: true, serverCertificateHashes: seat.certificateHashes.map((h) => ({ ...h, value: Uint8Array.from(h.value) })) });
            transport.closed.catch(() => {});
            const client = { transport, seat, controls: [], snapshots: [], readers: [] };
            clients.push(client);
            await bounded(transport.ready);
            const stream = await bounded(transport.createBidirectionalStream());
            client.writer = stream.writable.getWriter();
            client.datagramWriter = transport.datagrams.createWritable().getWriter();
            const controlReader = stream.readable.getReader();
            const decoder = createControlDecoder((message) => client.controls.push(message));
            client.readers.push(
                (async () => {
                    while (running) {
                        const result = await controlReader.read();
                        if (result.done) break;
                        decoder.push(result.value);
                    }
                })().catch((error) => {
                    if (running) client.error = error.message;
                })
            );
            const datagramReader = transport.datagrams.readable.getReader();
            client.readers.push(
                (async () => {
                    while (running) {
                        const result = await datagramReader.read();
                        if (result.done) break;
                        const snapshot = decodeSnapshot(result.value);
                        if (snapshot) client.snapshots.push(snapshot);
                    }
                })().catch((error) => {
                    if (running) client.error = error.message;
                })
            );
            await bounded(client.writer.write(encodeControl("lobby-ready", {})));
            await until(() => client.controls.some((message) => message.type === "lobby-welcome"), `Client ${index} welcome`);
        }
        for (const client of clients) {
            await client.writer.write(encodeControl("lobby-interest", { peers: clients.filter((other) => other !== client).map((other) => other.seat.sessionId) }));
            const welcome = client.controls.find((message) => message.type === "lobby-welcome").data;
            await client.datagramWriter.write(encodeMovement({ sequence: 1, x: welcome.position[0] + 0.1, y: welcome.position[1], z: welcome.position[2], yaw: welcome.position[3], animation: 1, floor: true }));
        }
        await until(() => clients.every((client) => client.controls.some((message) => message.type === "lobby-ack" && message.data.seq === 1)), "Movement acks");
        await until(() => clients.every((client, index) => client.snapshots.some((frame) => frame.poses.some((pose) => pose[0] === Number(clients[1 - index].seat.sessionId)))), "Cross-worker snapshots");
        console.log(JSON.stringify({ kind: "Shared world HTTP/3 integration", clients: clients.map((client) => ({ sessionId: client.seat.sessionId, websocketWorkerUrl: client.seat.wsUrl, transport: client.transport.reliability, controls: client.controls.map((message) => message.type), snapshotFrames: client.snapshots.length, remoteIds: [...new Set(client.snapshots.flatMap((frame) => frame.poses.map((pose) => pose[0])))], error: client.error || null })), sameWorld: clients[0].seat.roomId === clients[1].seat.roomId, differentWorkers: clients[0].seat.wsUrl !== clients[1].seat.wsUrl }, null, 2));
    } catch (error) {
        console.error(
            JSON.stringify(
                clients.map((client) => ({ sessionId: client.seat.sessionId, worker: client.seat.wsUrl, controls: client.controls.map((message) => ({ type: message.type, data: message.data })), snapshots: client.snapshots, error: client.error })),
                null,
                2
            )
        );
        throw error;
    } finally {
        running = false;
        for (const client of clients) client.transport.close();
        await bounded(Promise.all(clients.flatMap((client) => client.readers)), 3000).catch(() => {});
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
