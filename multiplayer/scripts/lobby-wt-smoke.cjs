#!/usr/bin/env node
// Genuine local HTTP/3 transport smoke, independent of world simulation.
require("ts-node/register");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const { ensureLobbyCertificate } = require("./lobby-cert.cjs");
const { createWebTransportGateway } = require("../src/transport/webtransport.ts");
const { encodeControl, createControlDecoder, encodeMovement } = require("../protocol/lobby-v2.js");
const nativeImport = new Function("s", "return import(s)");
function bounded(promise) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            const t = setTimeout(() => reject(new Error("HTTP/3 smoke timeout")), 8000);
            t.unref();
        }),
    ]);
}
(async () => {
    const cert = ensureLobbyCertificate();
    const { WebTransport, quicheLoaded } = await nativeImport("@fails-components/webtransport");
    await quicheLoaded;
    let endpoint;
    let controls = 0;
    let datagrams = 0;
    const transport = await createWebTransportGateway({
        host: "127.0.0.1",
        port: 0,
        cert: readFileSync(cert.certPath, "utf8"),
        key: readFileSync(cert.keyPath, "utf8"),
        origins: ["http://localhost:13000"],
        allowOriginlessLoopbackClients: true,
        gateway: {
            accept: async (ticket, peer) => {
                if (ticket !== "smoke-ticket-0123456789") return null;
                endpoint = peer;
                peer.sendControl("welcome", { id: 1 });
                return "smoke";
            },
            receiveControl: (id, type, data) => {
                controls++;
                endpoint.sendControl(type, data);
            },
            receiveDatagram: (id, bytes) => {
                datagrams++;
                endpoint.sendDatagram(bytes);
            },
            disconnect: () => {},
        },
    });
    let client;
    try {
        client = new WebTransport(`https://127.0.0.1:${transport.address().port}/lobby-v2?ticket=smoke-ticket-0123456789`, { requireUnreliable: true, serverCertificateHashes: cert.serverCertificateHashes.map((h) => ({ ...h, value: Uint8Array.from(h.value) })) });
        client.closed.catch(() => {});
        await bounded(client.ready);
        assert.equal(client.reliability, "supports-unreliable");
        const stream = await bounded(client.createBidirectionalStream());
        const writer = stream.writable.getWriter();
        await bounded(writer.write(encodeControl("ping", { sequence: 5 })));
        const reader = stream.readable.getReader();
        const messages = [];
        const decoder = createControlDecoder((message) => messages.push(message));
        while (messages.length < 2) decoder.push((await bounded(reader.read())).value);
        assert.deepEqual(
            messages.map((m) => m.type),
            ["welcome", "ping"]
        );
        const datagramWriter = client.datagrams.createWritable().getWriter();
        const packet = encodeMovement({ sequence: 1, x: 2, y: 0, z: 3, yaw: 0, animation: 1, floor: true });
        const datagramReader = client.datagrams.readable.getReader();
        await bounded(datagramWriter.write(packet));
        const received = await bounded(datagramReader.read());
        assert.deepEqual(Array.from(received.value), Array.from(packet));
        assert.equal(controls, 1);
        assert.equal(datagrams, 1);
        console.log(JSON.stringify({ transport: "HTTP/3 QUIC", reliability: client.reliability, port: transport.address().port, maxDatagramSize: client.datagrams.maxDatagramSize, controlRoundTrip: true, datagramRoundTrip: true, datagramBytes: packet.byteLength, stats: transport.stats() }, null, 2));
    } finally {
        if (client) client.close();
        await transport.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
