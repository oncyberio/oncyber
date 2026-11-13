import { parentPort, workerData } from "worker_threads";
import { createServer } from "http";
import { Server as WebSocketServer } from "ws";
import { WorldGateway } from "./gateway";

const data = workerData,
    port = parentPort!;
const gateway = new WorldGateway({ ...data, post: (message: any) => port.postMessage(message) });
const origins = new Set<string>(data.origins);
const server = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
});
const websocket = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/lobby-v2" || (req.headers.origin && !origins.has(req.headers.origin))) {
        socket.destroy();
        return;
    }
    websocket.handleUpgrade(req, socket as any, head, (ws) => websocket.emit("connection", ws, req));
});
websocket.on("connection", (ws: any) => {
    let id: string | null = null,
        ended = false,
        authenticating = false,
        frames = 0,
        bytes = 0,
        windowAt = Date.now();
    const timeout = setTimeout(() => ws.close(4003, "Authentication timeout"), 5000);
    const endpoint = {
        sendControl(type: string, data: any) {
            if (ws.readyState !== 1) return false;
            ws.send(JSON.stringify({ type, data }));
            return true;
        },
        sendDatagram(data: Uint8Array) {
            if (ws.readyState !== 1) return false;
            ws.send(data, { binary: true });
            return true;
        },
        bufferedAmount: () => ws.bufferedAmount || 0,
        maxDatagramSize: () => 4096,
        close: (code = 1000, reason = "Closed") => {
            if (id) gateway.disconnect(id);
            ws.close(code, reason);
            const timer = setTimeout(() => ws.terminate(), 2000);
            timer.unref();
        },
    };
    ws.on("message", async (raw: Buffer, isBinary: boolean) => {
        try {
            isBinary = typeof isBinary === "boolean" ? isBinary : typeof raw !== "string";
            const now = Date.now();
            if (now - windowAt >= 1000) {
                frames = bytes = 0;
                windowAt = now;
            }
            frames++;
            bytes += Buffer.byteLength(raw);
            if (frames > 2048 || bytes > 65536) {
                ws.close(4008, "Ingress budget");
                return;
            }
            if (!id) {
                if (isBinary || authenticating) {
                    ws.close(4003, "Authenticate first");
                    return;
                }
                const message = JSON.parse(raw.toString());
                if (message.type !== "session" || typeof message.data?.token !== "string") {
                    ws.close(4003, "Missing ticket");
                    return;
                }
                authenticating = true;
                id = await gateway.accept(message.data.token, endpoint);
                clearTimeout(timeout);
                if (!id) {
                    ws.close(4003, "Invalid ticket");
                    return;
                }
                if (ended) gateway.disconnect(id);
                return;
            }
            if (isBinary) gateway.receiveDatagram(id, raw);
            else {
                const message = JSON.parse(raw.toString());
                if (typeof message.type !== "string" || message.type.length > 80) {
                    ws.close(4002, "Invalid control");
                    return;
                }
                gateway.receiveControl(id, message.type, message.data);
            }
        } catch {
            ws.close(4002, "Invalid message");
        }
    });
    ws.on("error", () => {});
    ws.on("close", () => {
        ended = true;
        clearTimeout(timeout);
        if (id) gateway.disconnect(id);
    });
});
const proxyEndpoints = new Map<string, { buffered: number; closed: boolean }>();
let outgoing: any[] = [],
    outgoingBytes = 0,
    outputInFlight = false;
const flush = setInterval(() => {
    if (outputInFlight || !outgoing.length) return;
    const batch = outgoing;
    outgoing = [];
    outgoingBytes = 0;
    outputInFlight = true;
    port.postMessage(
        { type: "proxy-output", batch },
        batch.filter((m) => m.kind === "datagram").map((m) => m.bytes.buffer)
    );
}, 5);
const queue = (message: any, size: number) => {
    if (outgoingBytes + size > 4 * 1024 * 1024 || outgoing.length >= 8192) return false;
    message.queuedAt = Date.now();
    outgoing.push(message);
    outgoingBytes += size;
    return true;
};

port.on("message", (message: any) => {
    if (message.type === "reserve") gateway.reserve(message.reservation);
    else if (message.type === "revoke") {
        gateway.revoke(message.token);
        port.postMessage({ type: "revoked", token: message.token });
    } else if (message.type === "member") gateway.member(message.member);
    else if (message.type === "remove") gateway.remove(message.id);
    else if (message.type === "relay") gateway.deliver(message.from, message.to, message.event, message.data);
    else if (message.type === "group-deliver") gateway.deliverGroup(message.id, message.event, message.data);
    else if (message.type === "group-place") gateway.placeGroup(message.id, message.travelId, message.pose, message.peers, message.held);
    else if (message.type === "group-presence") gateway.groupPresence(message.id, message.active);
    else if (message.type === "stage") gateway.setStage(message.stage);
    else if (message.type === "stage-result") gateway.deliverStageResult(message.id, message.data);
    else if (message.type === "stage-kick") gateway.kick(message.id);
    else if (message.type === "summon") gateway.summon(message.from);
    else if (message.type === "proxy-accept") {
        const p = { buffered: 0, closed: false };
        proxyEndpoints.set(message.id, p);
        const endpoint = {
            sendControl: (type: string, data: any) => !p.closed && queue({ id: message.id, kind: "control", type, data }, Buffer.byteLength(JSON.stringify(data)) + 64),
            sendDatagram: (bytes: Uint8Array) => !p.closed && queue({ id: message.id, kind: "datagram", bytes }, bytes.byteLength),
            bufferedAmount: () => p.buffered,
            maxDatagramSize: () => message.maxDatagramSize || 1200,
            close: (code = 1000, reason = "Closed") => {
                if (p.closed) return;
                p.closed = true;
                gateway.disconnect(message.id);
                proxyEndpoints.delete(message.id);
                port.postMessage({ type: "proxy-end", id: message.id, code, reason });
            },
        };
        void gateway.accept(message.token, endpoint).then((id) => {
            port.postMessage({ type: "proxy-accepted", request: message.request, id });
            if (!id) proxyEndpoints.delete(message.id);
        });
    } else if (message.type === "proxy-input") {
        for (const item of message.batch) {
            if (item.kind === "datagram") {
                if (Date.now() - item.queuedAt <= 150) gateway.receiveDatagram(item.id, item.bytes);
            } else if (Date.now() - item.queuedAt <= 5000) gateway.receiveControl(item.id, item.type, item.data);
            else {
                gateway.disconnect(item.id);
                port.postMessage({ type: "proxy-end", id: item.id, code: 4008, reason: "Stale reliable control" });
            }
        }
        port.postMessage({ type: "proxy-input-ack" });
    } else if (message.type === "proxy-buffer") {
        outputInFlight = false;
        for (const item of message.batch) {
            const p = proxyEndpoints.get(item.id);
            if (p) p.buffered = item.bytes;
        }
    } else if (message.type === "proxy-close") {
        const p = proxyEndpoints.get(message.id);
        if (p) p.closed = true;
        proxyEndpoints.delete(message.id);
        gateway.disconnect(message.id);
    } else if (message.type === "reset-stats") {
        gateway.resetSamples();
        port.postMessage({ type: "stats", request: message.request, stats: gateway.stats() });
    } else if (message.type === "stats") port.postMessage({ type: "stats", request: message.request, stats: { ...gateway.stats(), proxyQueuedBytes: outgoingBytes } });
    else if (message.type === "stop") {
        clearInterval(flush);
        gateway.stop();
        for (const client of websocket.clients) client.terminate();
        websocket.close();
        server.close();
        process.exit(0);
    }
});
async function start() {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(data.wsPort, data.bind, resolve);
    });

    gateway.start();
    port.postMessage({ type: "listening", owner: data.owner });
}
start().catch((error) => {
    port.postMessage({ type: "fatal", message: error.message });
    process.exit(1);
});
