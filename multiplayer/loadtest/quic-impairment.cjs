#!/usr/bin/env node
// Loopback-only UDP impairment proxy. This perturbs real QUIC packets without
// changing OS networking or dropping bytes from a reliable TCP connection.
const dgram = require("node:dgram");
const loopback = (host) => host === "127.0.0.1" || host === "localhost";
function random(seed) {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 4294967296;
    };
}
function heapPush(heap, item) {
    let i = heap.length;
    heap.push(item);
    while (i) {
        const p = (i - 1) >> 1;
        if (heap[p].due <= item.due) break;
        heap[i] = heap[p];
        i = p;
    }
    heap[i] = item;
}
function heapPop(heap) {
    const first = heap[0];
    const last = heap.pop();
    if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
            let c = i * 2 + 1;
            if (c + 1 < heap.length && heap[c + 1].due < heap[c].due) c++;
            if (heap[c].due >= last.due) break;
            heap[i] = heap[c];
            i = c;
        }
        heap[i] = last;
    }
    return first;
}
async function createQuicImpairmentProxy(options) {
    const { targetPort, targetHost = "127.0.0.1", listenPort = 0, listenHost = "127.0.0.1", delayMs = 50, jitterMs = 20, loss = 0.02, reorder = 0.1, seed = 27, maxPeers = 64, maxQueuedPackets = 4096, maxQueuedBytes = 8 * 1024 * 1024 } = options;
    if (!loopback(targetHost) || !loopback(listenHost)) throw new Error("QUIC impairment proxy is loopback-only");
    if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535 || !Number.isInteger(listenPort) || listenPort < 0 || listenPort > 65535) throw new Error("Invalid UDP port");
    if (![delayMs, jitterMs, loss, reorder].every(Number.isFinite) || delayMs < 0 || delayMs > 2000 || jitterMs < 0 || jitterMs > 1000 || loss < 0 || loss > 0.5 || reorder < 0 || reorder > 1) throw new Error("Invalid impairment settings");
    const rng = random(seed);
    const front = dgram.createSocket("udp4");
    const peers = new Map();
    const queue = [];
    let queuedBytes = 0;
    let timer;
    let closed = false;
    const stats = { packetsReceived: 0, packetsForwarded: 0, packetsLost: 0, packetsReordered: 0, packetsOverflowed: 0, packetErrors: 0, bytesForwarded: 0, maxQueuedPackets: 0, maxQueuedBytes: 0, peers: 0 };
    const arm = () => {
        if (timer || !queue.length || closed) return;
        timer = setTimeout(flush, Math.max(0, queue[0].due - performance.now()));
    };
    const flush = () => {
        timer = undefined;
        const now = performance.now();
        while (queue.length && queue[0].due <= now) {
            const packet = heapPop(queue);
            queuedBytes -= packet.bytes.length;
            if (!packet.peer.active) continue;
            packet.socket.send(packet.bytes, packet.port, packet.host, (error) => {
                if (error) stats.packetErrors++;
                else {
                    stats.packetsForwarded++;
                    stats.bytesForwarded += packet.bytes.length;
                }
            });
        }
        arm();
    };
    function schedule(bytes, peer, socket, port, host) {
        if (closed) return;
        stats.packetsReceived++;
        peer.last = performance.now();
        if (rng() < loss) {
            stats.packetsLost++;
            return;
        }
        if (queue.length >= maxQueuedPackets || queuedBytes + bytes.length > maxQueuedBytes) {
            stats.packetsOverflowed++;
            return;
        }
        let delay = Math.max(0, delayMs + (rng() * 2 - 1) * jitterMs);
        if (rng() < reorder) {
            delay += Math.max(20, jitterMs * 2);
            stats.packetsReordered++;
        }
        const packet = { due: performance.now() + delay, bytes, peer, socket, port, host };
        const earlier = !queue.length || packet.due < queue[0].due;
        heapPush(queue, packet);
        queuedBytes += bytes.length;
        stats.maxQueuedPackets = Math.max(stats.maxQueuedPackets, queue.length);
        stats.maxQueuedBytes = Math.max(stats.maxQueuedBytes, queuedBytes);
        if (earlier && timer) {
            clearTimeout(timer);
            timer = undefined;
        }
        arm();
    }
    front.on("error", () => stats.packetErrors++);
    front.on("message", (bytes, rinfo) => {
        if (!loopback(rinfo.address)) return;
        const key = `${rinfo.address}:${rinfo.port}`;
        let peer = peers.get(key);
        if (!peer) {
            if (peers.size >= maxPeers) {
                stats.packetsOverflowed++;
                return;
            }
            const upstream = dgram.createSocket("udp4");
            peer = { active: true, last: performance.now(), upstream };
            const thisPeer = peer;
            upstream.on("error", () => stats.packetErrors++);
            upstream.on("message", (reply, source) => {
                if (source.address === "127.0.0.1" && source.port === targetPort) schedule(reply, thisPeer, front, rinfo.port, rinfo.address);
            });
            peers.set(key, peer);
            stats.peers = peers.size;
        }
        schedule(bytes, peer, peer.upstream, targetPort, targetHost);
    });
    await new Promise((resolve, reject) => {
        front.once("error", reject);
        front.bind(listenPort, listenHost, () => {
            front.off("error", reject);
            resolve();
        });
    });
    const reap = setInterval(() => {
        for (const [key, peer] of peers)
            if (performance.now() - peer.last > 30000) {
                peer.active = false;
                peer.upstream.close();
                peers.delete(key);
            }
        stats.peers = peers.size;
    }, 5000);
    reap.unref();
    return {
        address: () => front.address(),
        stats: () => ({ ...stats, queuedPackets: queue.length, queuedBytes, settings: { delayMs, jitterMs, loss, reorder, seed } }),
        close: async () => {
            if (closed) return;
            closed = true;
            clearTimeout(timer);
            clearInterval(reap);
            queue.length = 0;
            queuedBytes = 0;
            for (const peer of peers.values()) {
                peer.active = false;
                try {
                    peer.upstream.close();
                } catch {}
            }
            peers.clear();
            stats.peers = 0;
            await new Promise((resolve) => front.close(resolve));
        },
    };
}
module.exports = { createQuicImpairmentProxy };
if (require.main === module) {
    createQuicImpairmentProxy({ targetPort: Number(process.argv[2]), listenPort: Number(process.argv[3] || 2690) })
        .then((proxy) => {
            console.log(JSON.stringify({ address: proxy.address(), settings: proxy.stats().settings }));
            const stop = async () => {
                console.log(JSON.stringify(proxy.stats()));
                await proxy.close();
            };
            process.once("SIGINT", stop);
            process.once("SIGTERM", stop);
        })
        .catch((error) => {
            console.error(error.message);
            process.exitCode = 1;
        });
}
