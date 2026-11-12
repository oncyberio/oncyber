import { encodeInputs } from "../../../multiplayer/protocol/movement";
import {
    createControlDecoder,
    decodeSnapshot,
    encodeControl,
    encodeMovement,
} from "../../../multiplayer/protocol/lobby-v2.js";

export type WorldLobbyTicket = {
    lobbyProtocol: 2;
    roomId: string;
    region: string;
    sessionId: string;
    token: string;
    wsUrl: string;
    webTransportUrl?: string;
    certificateHashes?: Array<{ algorithm: string; value: number[] | string }>;
};
type MessageHandler = (data: any) => void;
type StreamReader = {
    read(): Promise<{ done: boolean; value?: Uint8Array }>;
    cancel(): Promise<unknown>;
    releaseLock(): void;
};
type StreamWriter = {
    write(value: Uint8Array): Promise<unknown>;
    abort(): Promise<unknown>;
    releaseLock(): void;
    desiredSize?: number | null;
    ready?: Promise<unknown>;
};
type WebTransportSession = {
    ready: Promise<unknown>;
    reliability?: string;
    closed: Promise<unknown>;
    close(): void;
    datagrams: {
        readable: { getReader(): StreamReader };
        writable: { getWriter(): StreamWriter };
        createWritable?: () => { getWriter(): StreamWriter };
        maxDatagramSize?: number;
        incomingMaxAge?: number;
        outgoingMaxAge?: number;
    };
    createBidirectionalStream(): Promise<{
        readable: { getReader(): StreamReader };
        writable: { getWriter(): StreamWriter };
    }>;
};
type TransportOptions = {
    signal: AbortSignal;
    /** Replacing a ticket must also revoke its active session server-side. */
    renewTicket: (previous: WorldLobbyTicket) => Promise<WorldLobbyTicket>;
    allowLocalCertificateHashes?: boolean;
    handshakeTimeoutMs?: number;
};
const MAX_CONTROL_BYTES = 256 * 1024;
const MAX_RELIABLE_QUEUE_BYTES = 256 * 1024;
const MAX_SOCKET_BUFFER_BYTES = 256 * 1024;
const localHost = (hostname: string) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname);

function signal(ended?: () => boolean) {
    const handlers = new Set<(...args: any[]) => void>();
    const subscribe = (handler: (...args: any[]) => void) => {
        handlers.add(handler);
        if (ended?.())
            void Promise.resolve().then(() => {
                if (handlers.has(handler)) handler();
            });
        return () => handlers.delete(handler);
    };
    subscribe.remove = (handler: (...args: any[]) => void) =>
        handlers.delete(handler);
    subscribe.emit = (...args: any[]) => {
        for (const handler of handlers) handler(...args);
    };
    return subscribe;
}

/** Native v2 transport with the small room surface used by chat and voice.
 * Reliable control is bounded; motion is replaceable and never queues behind old motion. */
export class WorldLobbyTransport {
    readonly onLeave = signal(() => this.closed);
    readonly onError = signal();
    readonly sessionId: string;
    readonly roomId: string;
    readonly region: string;
    readonly transport: "webtransport" | "websocket";
    readonly fallbackReason?: string;
    private handlers = new Map<string, Set<MessageHandler>>();
    private socket: WebSocket | null = null;
    private session: WebTransportSession | null = null;
    private readers: StreamReader[] = [];
    private controlWriter: StreamWriter | null = null;
    private datagramWriter: StreamWriter | null = null;
    private pendingMove: Uint8Array | null = null;
    private writingMove = false;
    private reliableChain = Promise.resolve();
    private reliableBytes = 0;
    private closed = false;
    private accepted = false;
    private lastError = "";
    private accept: () => void;
    private reject: (error: Error) => void;
    private unbindAbort: () => void = () => {};
    private counters = {
        sentBytes: 0,
        receivedBytes: 0,
        sentDatagrams: 0,
        receivedDatagrams: 0,
        droppedMovement: 0,
        sentControls: 0,
        queuedControls: 0,
    };

    private constructor(
        ticket: WorldLobbyTicket,
        transport: "webtransport" | "websocket",
        fallbackReason?: string
    ) {
        this.sessionId = ticket.sessionId;
        this.roomId = ticket.roomId;
        this.region = ticket.region;
        this.transport = transport;
        this.fallbackReason = fallbackReason;
    }

    static async connect(ticket: WorldLobbyTicket, options: TransportOptions) {
        if (options.signal.aborted)
            throw new Error("Lobby connection cancelled.");
        let fallbackReason: string;
        if (
            ticket.webTransportUrl &&
            typeof (globalThis as any).WebTransport === "function"
        ) {
            const preferred = new WorldLobbyTransport(ticket, "webtransport");
            try {
                await preferred.open(ticket, options);
                if (preferred.closed)
                    throw new Error(
                        preferred.lastError ||
                            "Lobby transport closed during admission."
                    );
                return preferred;
            } catch (error) {
                await preferred.leave();
                if (options.signal.aborted) throw error;
                const detail = String(
                    error?.message || error || "Unknown failure"
                )
                    .replace(/https?:\/\/\S+/g, "[WebTransport endpoint]")
                    .slice(0, 240);
                fallbackReason = `WebTransport handshake unavailable: ${detail}`;
                // The old admission may already have succeeded. A fresh token alone
                // would leave a ghost player; replacement explicitly revokes it.
                ticket = await options.renewTicket(ticket);
            }
        } else if (ticket.webTransportUrl) {
            fallbackReason = "WebTransport is not supported by this browser";
        }
        if (options.signal.aborted)
            throw new Error("Lobby connection cancelled.");
        const fallback = new WorldLobbyTransport(
            ticket,
            "websocket",
            fallbackReason
        );
        try {
            await fallback.open(ticket, options);
            if (fallback.closed)
                throw new Error(
                    fallback.lastError ||
                        "Lobby transport closed during admission."
                );
            return fallback;
        } catch (error) {
            await fallback.leave();
            throw error;
        }
    }

    private async open(ticket: WorldLobbyTicket, options: TransportOptions) {
        const admitted = new Promise<void>((resolve, reject) => {
            this.accept = resolve;
            this.reject = reject;
        });
        // Attach the rejection handler before starting asynchronous streams.
        const opening =
            this.transport === "webtransport"
                ? this.openWebTransport(ticket, options)
                : this.openWebSocket(ticket);
        const abort = () => this.fail(new Error("Lobby connection cancelled."));
        options.signal.addEventListener("abort", abort, { once: true });
        this.unbindAbort = () =>
            options.signal.removeEventListener("abort", abort);
        const timer = setTimeout(
            () => this.fail(new Error("Lobby transport handshake timed out.")),
            options.handshakeTimeoutMs ?? 2500
        );
        if (options.signal.aborted) abort();
        try {
            await Promise.all([opening, admitted]);
            if (this.closed)
                throw new Error(
                    this.lastError || "Lobby transport closed during admission."
                );
        } finally {
            clearTimeout(timer);
        }
    }

    private async openWebTransport(
        ticket: WorldLobbyTicket,
        options: TransportOptions
    ) {
        const url = new URL(ticket.webTransportUrl);
        if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.hash
        )
            throw new Error("Invalid WebTransport endpoint.");
        url.searchParams.set("ticket", ticket.token);
        const hashes = ticket.certificateHashes;
        const sessionOptions: Record<string, unknown> = {
            requireUnreliable: true,
            congestionControl: "low-latency",
        };
        if (hashes?.length) {
            if (
                !options.allowLocalCertificateHashes ||
                !localHost(url.hostname)
            )
                throw new Error(
                    "Certificate pins are restricted to trusted localhost development."
                );
            sessionOptions.serverCertificateHashes = hashes
                .slice(0, 2)
                .map((hash) => {
                    const values =
                        typeof hash.value === "string"
                            ? /^[0-9a-f]{64}$/i.test(hash.value)
                                ? hash.value
                                      .match(/../g)
                                      .map((byte) => parseInt(byte, 16))
                                : []
                            : hash.value;
                    if (
                        hash.algorithm !== "sha-256" ||
                        !Array.isArray(values) ||
                        values.length !== 32 ||
                        values.some(
                            (byte) =>
                                !Number.isInteger(byte) ||
                                byte < 0 ||
                                byte > 255
                        )
                    )
                        throw new Error("Invalid localhost certificate hash.");
                    return {
                        algorithm: "sha-256",
                        value: Uint8Array.from(values),
                    };
                });
        }
        const session: WebTransportSession = new (
            globalThis as any
        ).WebTransport(url.href, sessionOptions);
        this.session = session;
        void session.closed.then(
            (info: any) =>
                this.fail(
                    new Error(
                        `Lobby transport closed${
                            info?.closeCode !== undefined
                                ? ` (${info.closeCode})`
                                : ""
                        }${
                            info?.reason
                                ? `: ${String(info.reason).slice(0, 160)}`
                                : "."
                        }`
                    )
                ),
            (error: any) =>
                this.fail(
                    new Error(
                        `Lobby transport closed: ${String(
                            error?.message || "connection failed"
                        ).slice(0, 160)}`
                    )
                )
        );
        await session.ready;
        if (this.closed) return;
        if (
            session.reliability &&
            session.reliability !== "supports-unreliable"
        )
            throw new Error("WebTransport datagrams are unavailable.");
        if (
            typeof session.datagrams.maxDatagramSize === "number" &&
            session.datagrams.maxDatagramSize < 24
        )
            throw new Error("WebTransport datagram limit is too small.");
        const stream = await session.createBidirectionalStream();
        if (this.closed) {
            void stream.readable
                .getReader()
                .cancel()
                .catch(() => {});
            void stream.writable
                .getWriter()
                .abort()
                .catch(() => {});
            return;
        }
        this.controlWriter = stream.writable.getWriter();
        this.datagramWriter = (
            typeof session.datagrams.createWritable === "function"
                ? session.datagrams.createWritable()
                : session.datagrams.writable
        ).getWriter();
        // Old position packets should expire in the transport rather than add latency.
        session.datagrams.incomingMaxAge = 250;
        session.datagrams.outgoingMaxAge = 150;
        const decoder = createControlDecoder(
            (message) => this.deliverControl(message),
            { maxFrameBytes: MAX_CONTROL_BYTES }
        );
        void this.read(
            stream.readable.getReader(),
            (bytes) => decoder.push(bytes),
            () => decoder.finish()
        );
        void this.read(session.datagrams.readable.getReader(), (bytes) =>
            this.deliverBinary(bytes)
        );
    }

    private openWebSocket(ticket: WorldLobbyTicket) {
        const url = new URL(ticket.wsUrl);
        if (
            (url.protocol !== "wss:" &&
                !(url.protocol === "ws:" && localHost(url.hostname))) ||
            url.username ||
            url.password ||
            url.hash
        )
            throw new Error("Invalid WebSocket endpoint.");
        const socket = new WebSocket(url.href);
        socket.binaryType = "arraybuffer";
        this.socket = socket;
        socket.onopen = () => {
            if (!this.closed) this.send("session", { token: ticket.token });
        };
        socket.onerror = () => this.fail(new Error("Lobby WebSocket failed."));
        socket.onclose = () => this.fail(new Error("Lobby WebSocket closed."));
        socket.onmessage = (event) => {
            if (this.closed) return;
            try {
                if (typeof event.data === "string") {
                    if (
                        event.data.length > MAX_CONTROL_BYTES ||
                        new TextEncoder().encode(event.data).byteLength >
                            MAX_CONTROL_BYTES
                    )
                        throw new Error("Oversized lobby control.");
                    this.counters.receivedBytes += new TextEncoder().encode(
                        event.data
                    ).byteLength;
                    this.deliverControl(JSON.parse(event.data));
                } else if (event.data instanceof ArrayBuffer) {
                    this.deliverBinary(new Uint8Array(event.data));
                } else throw new Error("Invalid lobby packet.");
            } catch (error) {
                this.fail(error);
            }
        };
        return Promise.resolve();
    }

    private read(
        reader: StreamReader,
        consume: (bytes: Uint8Array) => void,
        finish?: () => void
    ) {
        this.readers.push(reader);
        let completed = false;
        const release = () => {
            if (completed) return;
            completed = true;
            const index = this.readers.indexOf(reader);
            if (index >= 0) this.readers.splice(index, 1);
            try {
                reader.releaseLock();
            } catch {}
        };
        const fail = (error: Error) => {
            try {
                this.fail(error);
            } finally {
                release();
            }
        };
        // This repository's older browser SWC transform miscompiles an async
        // while loop inside try/finally, releasing the reader after each chunk.
        // Each callback settles before the next read; no recursive promise chain
        // is retained for the lifetime of a busy multiplayer connection.
        const pump = () => {
            if (this.closed || completed) {
                release();
                return;
            }
            let pending: ReturnType<StreamReader["read"]>;
            try {
                pending = reader.read();
            } catch (error) {
                fail(error);
                return;
            }
            void pending.then(({ done, value }) => {
                if (this.closed) {
                    release();
                    return;
                }
                try {
                    if (done) {
                        finish?.();
                        fail(new Error("Lobby stream ended."));
                        return;
                    }
                    this.counters.receivedBytes += value.byteLength;
                    consume(value);
                    pump();
                } catch (error) {
                    fail(error);
                }
            }, fail);
        };
        pump();
    }

    private deliverControl(message: any) {
        if (
            !message ||
            typeof message.type !== "string" ||
            message.type.length > 64
        )
            throw new Error("Malformed lobby control.");
        if (message.type === "session-accepted") {
            if (String(message.data?.sessionId) !== this.sessionId)
                throw new Error("Mismatched lobby admission.");
            this.accepted = true;
            this.accept();
            return;
        }
        for (const handler of this.handlers.get(message.type) || [])
            handler(message.data);
    }
    private deliverBinary(bytes: Uint8Array) {
        if (bytes.byteLength > (this.transport === "websocket" ? 4096 : 1200))
            return;
        const snapshot = decodeSnapshot(bytes);
        if (!snapshot) return; // A corrupt or unknown datagram must not kill reliable control.
        this.counters.receivedDatagrams++;
        if (this.transport === "websocket")
            this.counters.receivedBytes += bytes.byteLength;
        for (const handler of this.handlers.get("lobby-snapshot-v2") || [])
            handler(snapshot);
    }
    onMessage(type: string, handler: MessageHandler) {
        const handlers = this.handlers.get(type) || new Set<MessageHandler>();
        this.handlers.set(type, handlers);
        handlers.add(handler);
        return () => handlers.delete(handler);
    }
    send(type: string, data: any) {
        if (this.closed) return;
        if (type === "lobby-move" || type === "lobby-input") {
            const [sequence, x, y, z, yaw, animation, floor] = data;
            const bytes =
                type === "lobby-input"
                    ? encodeInputs(data)
                    : encodeMovement({
                          sequence,
                          x,
                          y,
                          z,
                          yaw,
                          animation,
                          floor,
                      });
            if (this.transport === "websocket") {
                if (
                    this.socket?.readyState !== WebSocket.OPEN ||
                    this.socket.bufferedAmount > MAX_SOCKET_BUFFER_BYTES
                ) {
                    this.counters.droppedMovement++;
                    return;
                }
                this.socket.send(bytes);
                this.counters.sentBytes += bytes.byteLength;
                this.counters.sentDatagrams++;
            } else {
                if (this.pendingMove) this.counters.droppedMovement++;
                this.pendingMove = bytes;
                void this.flushMovement();
            }
            return;
        }
        let bytes: Uint8Array;
        try {
            bytes = encodeControl(type, data, {
                maxFrameBytes: MAX_CONTROL_BYTES,
            });
        } catch (error) {
            this.fail(error);
            return;
        }
        this.counters.queuedControls++;
        if (bytes.byteLength > MAX_CONTROL_BYTES) {
            this.fail(new Error("Oversized lobby control."));
            return;
        }
        if (this.transport === "websocket") {
            if (this.socket?.readyState !== WebSocket.OPEN) return;
            if (this.socket.bufferedAmount > MAX_SOCKET_BUFFER_BYTES) {
                this.fail(new Error("Lobby reliable traffic congested."));
                return;
            }
            this.socket.send(new TextDecoder().decode(bytes).trimEnd());
            this.counters.sentBytes += bytes.byteLength;
            this.counters.sentControls++;
        } else {
            this.reliableBytes += bytes.byteLength;
            if (this.reliableBytes > MAX_RELIABLE_QUEUE_BYTES) {
                this.fail(new Error("Lobby reliable traffic congested."));
                return;
            }
            this.reliableChain = this.reliableChain
                .then(async () => {
                    try {
                        if (!this.closed && this.controlWriter) {
                            await this.controlWriter.write(bytes);
                            this.counters.sentBytes += bytes.byteLength;
                            this.counters.sentControls++;
                        }
                    } finally {
                        this.reliableBytes -= bytes.byteLength;
                    }
                })
                .catch((error) => this.fail(error));
        }
    }
    private flushMovement() {
        if (
            this.writingMove ||
            !this.datagramWriter ||
            this.closed ||
            !this.pendingMove
        )
            return;
        this.writingMove = true;
        const writer = this.datagramWriter;
        // One write per callback turn also avoids the old SWC async-loop/finally
        // bug: writingMove cannot clear while a previous write is still active.
        void Promise.resolve(writer.ready)
            .then(() => {
                if (this.closed || !this.pendingMove) return;
                const bytes = this.pendingMove;
                this.pendingMove = null;
                // Expired unreliable writes are expected; connection-level failures
                // are detected by writer.ready, readers, and session.closed.
                return writer.write(bytes).then(
                    () => {
                        this.counters.sentBytes += bytes.byteLength;
                        this.counters.sentDatagrams++;
                    },
                    () => {
                        this.counters.droppedMovement++;
                    }
                );
            })
            .catch((error) => this.fail(error))
            .finally(() => {
                this.writingMove = false;
                if (!this.closed && this.pendingMove) this.flushMovement();
            });
    }

    diagnostics() {
        return {
            transport: this.transport,
            fallbackReason: this.fallbackReason,
            reliableQueuedBytes: this.reliableBytes,
            transportClosed: this.closed,
            transportAccepted: this.accepted,
            transportError: this.lastError || undefined,
            ...this.counters,
        };
    }
    private fail(error: Error) {
        if (this.closed) return;
        this.lastError = error?.message || String(error);
        if (!this.accepted) this.reject?.(error);
        this.onError.emit(error);
        void this.leave();
        this.onLeave.emit();
    }
    async leave(_consented?: boolean) {
        if (this.closed) return;
        this.closed = true;
        this.unbindAbort();
        this.pendingMove = null;
        // Closing the session owns stream shutdown. Resetting the reliable
        // stream first races the close capsule and looks like a protocol error
        // to the server even when the user deliberately leaves.
        const session = this.session;
        this.session = null;
        const readers = this.readers;
        const writers = [this.controlWriter, this.datagramWriter].filter(
            Boolean
        );
        this.readers = [];
        const release = () => {
            for (const stream of [...readers, ...writers]) {
                try {
                    stream.releaseLock();
                } catch {}
            }
        };
        if (session) {
            session.close();
            void session.closed.then(release, release);
        } else {
            for (const reader of readers) void reader.cancel().catch(() => {});
            for (const writer of writers)
                void writer
                    .abort()
                    .catch(() => {})
                    .finally(release);
        }
        if (this.socket) {
            this.socket.onopen =
                this.socket.onclose =
                this.socket.onerror =
                this.socket.onmessage =
                    null;
            this.socket.close();
            this.socket = null;
        }
        this.handlers.clear();
    }
}
