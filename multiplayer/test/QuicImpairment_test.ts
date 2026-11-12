import assert from "assert";
import dgram from "dgram";
import { createQuicImpairmentProxy } from "../loadtest/quic-impairment.cjs";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const bind = (socket: dgram.Socket) => new Promise<number>((resolve) => socket.bind(0, "127.0.0.1", () => resolve(socket.address().port)));
const close = (socket: dgram.Socket) => new Promise<void>((resolve) => socket.close(resolve));

describe("Loopback QUIC impairment proxy", () => {
    it("rejects public targets/listeners and unbounded delay configuration", async () => {
        await assert.rejects(createQuicImpairmentProxy({ targetHost: "example.com", targetPort: 443 }), /loopback-only/);
        await assert.rejects(createQuicImpairmentProxy({ listenHost: "0.0.0.0", targetPort: 443 }), /loopback-only/);
        await assert.rejects(createQuicImpairmentProxy({ targetPort: 443, delayMs: 1000000 }), /settings/);
    });
    it("routes independent clients back to their own UDP source ports", async () => {
        const server = dgram.createSocket("udp4");
        const port = await bind(server);
        server.on("message", (bytes, info) => server.send(bytes, info.port, info.address));
        const proxy = await createQuicImpairmentProxy({ targetPort: port, delayMs: 2, jitterMs: 0, loss: 0, reorder: 0 });
        const clients = [dgram.createSocket("udp4"), dgram.createSocket("udp4")];
        try {
            const replies = await Promise.all(
                clients.map(async (client, index) => {
                    await bind(client);
                    const reply = new Promise<string>((resolve) => client.once("message", (bytes) => resolve(bytes.toString())));
                    client.send(Buffer.from(`client-${index}`), proxy.address().port, "127.0.0.1");
                    return reply;
                })
            );
            assert.deepEqual(replies, ["client-0", "client-1"]);
            assert.equal(proxy.stats().peers, 2);
            assert.equal(proxy.stats().packetErrors, 0);
        } finally {
            await Promise.all(clients.map(close));
            await proxy.close();
            await close(server);
        }
    });
    it("caps pending UDP packet memory instead of accumulating under delay", async () => {
        const server = dgram.createSocket("udp4");
        const port = await bind(server);
        const client = dgram.createSocket("udp4");
        await bind(client);
        const proxy = await createQuicImpairmentProxy({ targetPort: port, delayMs: 150, jitterMs: 0, loss: 0, reorder: 0, maxQueuedPackets: 4, maxQueuedBytes: 400 });
        try {
            for (let i = 0; i < 40; i++) client.send(Buffer.alloc(100), proxy.address().port, "127.0.0.1");
            await pause(50);
            assert(proxy.stats().packetsOverflowed > 0);
            assert(proxy.stats().maxQueuedPackets <= 4);
            assert(proxy.stats().maxQueuedBytes <= 400);
            await proxy.close();
            assert.equal(proxy.stats().queuedBytes, 0);
            assert.equal(proxy.stats().peers, 0);
        } finally {
            await proxy.close();
            await close(client);
            await close(server);
        }
    });
});
