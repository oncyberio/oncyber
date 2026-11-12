import { randomBytes } from "crypto";
import { encodeControl, createControlDecoder } from "../../protocol/lobby-v2";

export interface GatewayEndpoint {
    sendControl(type: string, data: unknown): boolean;
    sendDatagram(bytes: Uint8Array): boolean;
    bufferedAmount(): number;
    maxDatagramSize?(): number;
    close(code?: number, reason?: string): void;
}
export interface SessionGateway {
    accept(token: string, endpoint: GatewayEndpoint): Promise<string | null>;
    receiveControl(id: string, type: string, data: any): void;
    receiveDatagram(id: string, bytes: Uint8Array): void;
    disconnect(id: string): void;
}
export interface WebTransportGatewayOptions {
    host: string;
    port: number;
    cert: string;
    key: string;
    origins: ReadonlySet<string> | string[];
    gateway: SessionGateway;
    path?: string;
    maxConnections?: number;
    // Only for the Node test/load client, which cannot send Origin. Never enabled
    // on a public listener; real browser requests always require the allowlist.
    allowOriginlessLoopbackClients?: boolean;
}
export interface TransportStats {
    accepted: number;
    rejected: number;
    active: number;
    datagramsSent: number;
    datagramsReceived: number;
    datagramsDropped: number;
    controlBytesSent: number;
    protocolErrors: number;
}
const MAX_FRAME_BYTES = 16 * 1024;
const MAX_CONTROL_BACKLOG = 256 * 1024;
const MAX_DATAGRAM = 1200;
const MAX_DATAGRAM_BACKLOG = MAX_DATAGRAM * 16;
const HANDSHAKE_MS = 5000;
const WRITE_TIMEOUT_MS = 5000;
const MAX_DATAGRAM_AGE_MS = 150;
const loopback = (host: string) => ["127.0.0.1", "::1", "localhost"].includes(host);
const nativeImport = new Function("specifier", "return import(specifier)") as (name: string) => Promise<any>;

function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Transport deadline exceeded")), ms);
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
function stats(): TransportStats {
    return { accepted: 0, rejected: 0, active: 0, datagramsSent: 0, datagramsReceived: 0, datagramsDropped: 0, controlBytesSent: 0, protocolErrors: 0 };
}

// Exported for deterministic backpressure/framing tests. The server adapter is
// exclusively Http3Server: no reliable-only HTTP/2 WebTransport polyfill.
export function attachWebTransportSession(session: any, token: string, gateway: SessionGateway, counters: TransportStats = stats()) {
    let ended = false;
    let id: string | null = null;
    let writer: any;
    let datagramWriter: any;
    let controls: Uint8Array[] = [];
    let datagrams: Array<{ bytes: Uint8Array; queuedAt: number }> = [];
    let controlBytes = 0;
    let datagramBytes = 0;
    let controlBusy = false;
    let datagramBusy = false;
    let datagramWriteStarted = 0;
    let readyCounted = false;
    const readers: any[] = [];
    const handshake = setTimeout(() => close(4008, "Control stream timeout"), HANDSHAKE_MS);
    const finish = () => {
        if (ended) return;
        ended = true;
        clearTimeout(handshake);
        controls = [];
        datagrams = [];
        controlBytes = datagramBytes = 0;
        if (readyCounted) counters.active--;
        // Native HTTP/3 closes its receive controllers on session close. Calling
        // reader.cancel() here closes them twice in the current QUIC binding.
        if (id) gateway.disconnect(id);
    };
    const close = (code = 1000, reason = "Closed") => {
        if (ended) return;
        finish();
        try {
            session.close({ closeCode: code, reason: reason.slice(0, 120) });
        } catch {}
    };
    const fail = () => {
        if (ended) return;
        // Receive-stream rejection is queued before session.closed resolves in
        // the QUIC binding. A normal native close is not a protocol violation.
        if (session.state === "closed" || session.state === "failed") {
            finish();
            return;
        }
        counters.protocolErrors++;
        close(4002, "Invalid or stalled transport");
    };
    Promise.resolve(session.closed).then(finish, finish);
    async function flushControls() {
        if (controlBusy || !writer || ended) return;
        controlBusy = true;
        try {
            while (!ended && controls.length) {
                const bytes = controls.shift()!;
                await deadline(Promise.resolve(writer.write(bytes)), WRITE_TIMEOUT_MS);
                if (ended) break;
                controlBytes -= bytes.byteLength;
                counters.controlBytesSent += bytes.byteLength;
            }
        } catch {
            if (!ended) fail();
        } finally {
            controlBusy = false;
        }
    }
    async function flushDatagrams() {
        if (datagramBusy || !datagramWriter || ended) return;
        datagramBusy = true;
        try {
            while (!ended && datagrams.length) {
                const pending = datagrams.shift()!;
                const bytes = pending.bytes;
                if (Date.now() - pending.queuedAt > MAX_DATAGRAM_AGE_MS) {
                    datagramBytes -= bytes.byteLength;
                    counters.datagramsDropped++;
                    continue;
                }
                // One write at a time, with a small application queue. Never
                // accumulate old position updates in a reliable stream.
                datagramWriteStarted = Date.now();
                // QUIC datagram writes resolve immediately, even when native
                // congestion drops a packet. Avoid a timer for every avatar
                // snapshot; subsequent sends enforce a stalled writer deadline.
                await datagramWriter.write(bytes);
                if (ended) break;
                datagramBytes -= bytes.byteLength;
                counters.datagramsSent++;
            }
        } catch {
            if (!ended) fail();
        } finally {
            datagramBusy = false;
            datagramWriteStarted = 0;
        }
    }
    const endpoint: GatewayEndpoint = {
        sendControl(type, data) {
            if (ended) return false;
            let bytes: Uint8Array;
            try {
                bytes = encodeControl(type, data);
            } catch {
                fail();
                return false;
            }
            if (bytes.byteLength > MAX_FRAME_BYTES || controlBytes + bytes.byteLength > MAX_CONTROL_BACKLOG) {
                close(4009, "Reliable backlog exceeded");
                return false;
            }
            controls.push(bytes);
            controlBytes += bytes.byteLength;
            void flushControls();
            return true;
        },
        sendDatagram(bytes) {
            if (ended || !bytes.byteLength || bytes.byteLength > MAX_DATAGRAM) return false;
            if (datagramBusy && Date.now() - datagramWriteStarted > WRITE_TIMEOUT_MS) {
                close(4008, "Datagram writer stalled");
                return false;
            }
            const negotiatedMax = session.datagrams?.maxDatagramSize;
            if (negotiatedMax && bytes.byteLength > negotiatedMax) {
                counters.datagramsDropped++;
                return false;
            }
            // Discard the oldest unsent datagram when congested. Snapshot chunks
            // are independent; lost records refresh in subsequent snapshots.
            while (datagrams.length && datagramBytes + bytes.byteLength > MAX_DATAGRAM_BACKLOG) {
                datagramBytes -= datagrams.shift()!.bytes.byteLength;
                counters.datagramsDropped++;
            }
            if (datagramBytes + bytes.byteLength > MAX_DATAGRAM_BACKLOG) {
                counters.datagramsDropped++;
                return false;
            }
            datagrams.push({ bytes: bytes.slice(), queuedAt: Date.now() });
            datagramBytes += bytes.byteLength;
            void flushDatagrams();
            return true;
        },
        bufferedAmount: () => controlBytes + datagramBytes,
        maxDatagramSize: () => Math.min(MAX_DATAGRAM, session.datagrams?.maxDatagramSize || MAX_DATAGRAM),
        close,
    };
    let rateEpoch = Date.now();
    let incomingFrames = 0;
    let incomingBytes = 0;
    function resetIngressWindow() {
        const now = Date.now();
        if (now - rateEpoch >= 1000) {
            rateEpoch = now;
            incomingFrames = incomingBytes = 0;
        }
    }
    function admitFrame(size: number, control = false) {
        resetIngressWindow();
        incomingFrames++;
        incomingBytes += size;
        if (incomingFrames > 160 || incomingBytes > 64 * 1024 || (!control && size > MAX_DATAGRAM)) throw new Error("Ingress budget exceeded");
    }
    async function accept() {
        try {
            await deadline(Promise.resolve(session.ready), HANDSHAKE_MS);
            const admission = gateway.accept(token, endpoint).then((accepted) => {
                if (ended && accepted) {
                    gateway.disconnect(accepted);
                    return null;
                }
                return accepted;
            });
            const accepted = await deadline(admission, HANDSHAKE_MS);
            if (!accepted) {
                counters.rejected++;
                close(4003, "Invalid admission ticket");
                return;
            }
            id = accepted;
            // Admission may resolve after a timeout/disconnect. Release its seat.
            if (ended) {
                gateway.disconnect(id);
                return;
            }
            readyCounted = true;
            counters.accepted++;
            counters.active++;
            session.datagrams.outgoingMaxAge = MAX_DATAGRAM_AGE_MS;
            const writable = session.datagrams.createWritable ? session.datagrams.createWritable() : session.datagrams.writable;
            datagramWriter = writable.getWriter();
            void flushDatagrams();
            void readDatagrams();
            void rejectUniStreams();
            void readControlStream();
        } catch {
            fail();
        }
    }
    async function readDatagrams() {
        const reader = session.datagrams.readable.getReader();
        readers.push(reader);
        try {
            while (!ended) {
                const result = await reader.read();
                if (result.done) break;
                const bytes = result.value;
                if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new Error("Invalid datagram");
                admitFrame(bytes.byteLength);
                counters.datagramsReceived++;
                gateway.receiveDatagram(id!, bytes);
            }
        } catch {
            if (!ended) fail();
        }
    }
    async function rejectUniStreams() {
        const reader = session.incomingUnidirectionalStreams.getReader();
        readers.push(reader);
        try {
            const result = await reader.read();
            if (!result.done && !ended) fail();
        } catch {
            if (!ended) fail();
        }
    }
    async function readControlStream() {
        const streams = session.incomingBidirectionalStreams.getReader();
        readers.push(streams);
        try {
            const first = await streams.read();
            if (first.done || ended) {
                if (!ended) fail();
                return;
            }
            writer = first.value.writable.getWriter();
            clearTimeout(handshake);
            void flushControls();
            // Exactly one client-created reliable bidirectional control stream.
            void streams.read().then(
                (extra: any) => {
                    if (!extra.done && !ended) fail();
                },
                () => {
                    if (!ended) fail();
                }
            );
            const reader = first.value.readable.getReader();
            readers.push(reader);
            const decoder = createControlDecoder(
                ({ type, data }: any) => {
                    admitFrame(0, true);
                    gateway.receiveControl(id!, type, data);
                },
                { maxFrameBytes: MAX_FRAME_BYTES }
            );
            while (!ended) {
                const result = await reader.read();
                if (result.done) {
                    decoder.finish();
                    close(1000, "Control stream ended");
                    break;
                }
                // Byte budget is independent of chunk framing and UTF-8 splits.
                resetIngressWindow();
                incomingBytes += result.value.byteLength;
                if (incomingBytes > 64 * 1024) throw new Error("Control byte budget exceeded");
                decoder.push(result.value);
            }
        } catch {
            if (!ended) fail();
        }
    }
    void accept();
    return endpoint;
}

export function validateWebTransportRequest(header: Record<string, unknown>, path: string, origins: ReadonlySet<string>, allowOriginless = false): { status: number; token?: string } {
    const raw = header[":path"];
    if (typeof raw !== "string" || raw.length > 2048 || !raw.startsWith("/")) return { status: 400 };
    let url: URL;
    try {
        url = new URL(raw, "https://localhost");
    } catch {
        return { status: 400 };
    }
    if (url.pathname !== path) return { status: 404 };
    if ((typeof header.origin !== "string" || !origins.has(header.origin)) && !(allowOriginless && header.origin == null)) return { status: 403 };
    const token = url.searchParams.get("ticket");
    if (!token || url.searchParams.getAll("ticket").length !== 1 || !/^[A-Za-z0-9_.~-]{16,512}$/.test(token)) return { status: 403 };
    return { status: 200, token };
}

export async function createWebTransportGateway(options: WebTransportGatewayOptions) {
    if (!options.origins || !Array.from(options.origins).length) throw new Error("WebTransport requires an explicit origin allowlist");
    if (options.allowOriginlessLoopbackClients && !loopback(options.host)) throw new Error("Originless test clients require a loopback listener");
    const { Http3Server } = await nativeImport("@fails-components/webtransport");
    // Native import, not transpiled require(): this dependency exports ESM only.
    await nativeImport("@fails-components/webtransport-transport-http3-quiche");
    const server = new Http3Server({ host: options.host, port: options.port, cert: options.cert, privKey: options.key, secret: randomBytes(32).toString("hex"), maxConnections: options.maxConnections || 4096, initialStreamFlowControlWindow: 65536, streamFlowControlWindowSizeLimit: 262144, initialSessionFlowControlWindow: 262144, sessionFlowControlWindowSizeLimit: 1048576 });
    const path = options.path || "/lobby-v2";
    const origins = new Set(options.origins);
    const counters = stats();
    const active = new Set<GatewayEndpoint>();
    let closed = false;
    const sessions = server.sessionStream(path).getReader();
    server.setRequestCallback(async ({ header }: any) => {
        const request = validateWebTransportRequest(header, path, origins, options.allowOriginlessLoopbackClients);
        if (request.status !== 200 || active.size >= (options.maxConnections || 4096)) {
            counters.rejected++;
            return { status: request.status === 200 ? 429 : request.status, path };
        }
        return { status: 200, path, userData: { token: request.token } };
    });
    async function consume() {
        while (!closed) {
            const item = await sessions.read();
            if (item.done) break;
            const session = item.value;
            const token = session.userData?.token || new URL(session.header[":path"], "https://localhost").searchParams.get("ticket");
            const endpoint = attachWebTransportSession(session, token, options.gateway, counters);
            active.add(endpoint);
            Promise.resolve(session.closed).then(
                () => active.delete(endpoint),
                () => active.delete(endpoint)
            );
        }
    }
    server.startServer();
    try {
        await deadline(server.ready, HANDSHAKE_MS);
    } catch (error) {
        try {
            server.stopServer();
        } catch {}
        throw error;
    }
    void consume().catch(() => {
        if (!closed) void stop();
    });
    async function stop() {
        if (closed) return;
        closed = true;
        for (const endpoint of active) endpoint.close(1001, "Server shutdown");
        active.clear();
        server.stopServer();
        await sessions.cancel().catch(() => {});
        await deadline(server.closed, 3000).catch(() => {});
    }
    return { address: () => server.address() as { host: string; port: number }, close: stop, stats: () => ({ ...counters }) };
}
