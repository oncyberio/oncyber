import { IncomingMessage, Server } from "http";
import { connect, isIP, Socket } from "net";

// Fly overwrites this header. Trust it only behind the explicitly configured
// Fly proxy, on a private proxy connection; never trust X-Forwarded-For.
export function clientAddress(req: Pick<IncomingMessage, "socket" | "headers">, trustFly: boolean) {
    const peer = req.socket.remoteAddress || "unknown";
    if (!trustFly) return peer;
    const ip = peer.replace(/^::ffff:/, "");
    const privateProxy = /^fdaa:/i.test(peer) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);
    const forwarded = req.headers["fly-client-ip"];
    return trustFly && privateProxy && typeof forwarded === "string" && isIP(forwarded) ? forwarded : peer;
}

// Byte-stream forwarding preserves worker backpressure and avoids decoding or
// copying every avatar snapshot in the coordinator. Workers retain admission.
export function attachWorkerIngress(server: Server, options: { wsBase: number; workerCount: number; origins: string[]; available: (owner: number) => boolean; maxConnections: number; workerHost: string }) {
    const sockets = new Set<Socket>();
    server.on("upgrade", (req, socket: Socket, head) => {
        const match = /^\/lobby-v2\/(0|[1-9][0-9]?)$/.exec(req.url || "");
        const owner = match ? Number(match[1]) : -1;
        if (owner < 0 || owner >= options.workerCount || !options.available(owner) || sockets.size >= options.maxConnections || (req.headers.origin && !options.origins.includes(req.headers.origin)) || req.headers.upgrade?.toLowerCase() !== "websocket") {
            socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            return;
        }
        sockets.add(socket);
        socket.setNoDelay(true);
        socket.pause();
        const upstream = connect({ port: options.wsBase + owner, host: options.workerHost, noDelay: true });
        const deadline = setTimeout(() => { socket.destroy(); upstream.destroy(); }, 5000);
        const cleanup = () => { clearTimeout(deadline); sockets.delete(socket); socket.destroy(); upstream.destroy(); };
        socket.on("error", cleanup);
        upstream.on("error", cleanup);
        socket.on("close", cleanup);
        upstream.on("close", cleanup);
        upstream.once("connect", () => {
            clearTimeout(deadline);
            const headers = ["GET /lobby-v2 HTTP/1.1"];
            for (const name of ["host", "upgrade", "connection", "sec-websocket-key", "sec-websocket-version", "sec-websocket-protocol", "origin"]) {
                const value = req.headers[name];
                if (typeof value === "string") headers.push(`${name}: ${value}`);
            }
            upstream.write(headers.join("\r\n") + "\r\n\r\n");
            if (head.length) upstream.write(head);
            socket.pipe(upstream);
            upstream.pipe(socket);
            socket.resume();
        });
    });
    return () => { for (const socket of sockets) socket.destroy(); sockets.clear(); };
}
