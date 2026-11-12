// The repository targets older Node declarations; these are Node 22 test APIs.
const { ReadableStream, WritableStream } = require("node:stream/web");
import { WorldLobbyTransport, WorldLobbyTicket } from "./WorldLobbyTransport";
import {
    decodeMovement,
    encodeControl,
    encodeSnapshots,
} from "../../../multiplayer/protocol/lobby-v2.js";

const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
};
const ticket: WorldLobbyTicket = {
    lobbyProtocol: 2,
    roomId: "shared",
    region: "local",
    sessionId: "42",
    token: "first-ticket",
    wsUrl: "ws://127.0.0.1:2581/lobby",
};
class FakeSocket {
    static OPEN = 1;
    static instances: FakeSocket[] = [];
    readyState = 0;
    bufferedAmount = 0;
    binaryType = "";
    onopen: () => void;
    onclose: () => void;
    onerror: () => void;
    onmessage: (message: { data: string | ArrayBuffer }) => void;
    sent: Array<string | Uint8Array> = [];
    close = jest.fn(() => {
        this.readyState = 3;
    });
    constructor(readonly url: string) {
        FakeSocket.instances.push(this);
    }
    open() {
        this.readyState = 1;
        this.onopen?.();
    }
    deliver(type: string, data: any) {
        this.onmessage?.({ data: JSON.stringify({ type, data }) });
    }
    send(value: string | Uint8Array) {
        this.sent.push(value);
        if (typeof value === "string" && JSON.parse(value).type === "session")
            this.deliver("session-accepted", { sessionId: "42" });
    }
}
function readable() {
    let controller: any;
    const cancel = jest.fn();
    const stream = new ReadableStream({
        cancel,
        start(value) {
            controller = value;
        },
    });
    return {
        stream,
        cancel,
        enqueue: (bytes: Uint8Array) => controller.enqueue(bytes),
        close: () => controller.close(),
    };
}
class FakeTransport {
    static instances: FakeTransport[] = [];
    static ready = () => Promise.resolve();
    static admitted = true;
    ready: Promise<unknown>;
    closed = new Promise(() => {});
    control = readable();
    incoming = readable();
    controlWrites: Uint8Array[] = [];
    datagramWrites: Uint8Array[] = [];
    datagrams = {
        readable: this.incoming.stream,
        writable: new WritableStream({
            write: (bytes) => {
                this.datagramWrites.push(bytes);
            },
        }),
        incomingMaxAge: 0,
        outgoingMaxAge: 0,
    };
    close = jest.fn();
    constructor(readonly url: string, readonly options: any) {
        this.ready = FakeTransport.ready();
        FakeTransport.instances.push(this);
        if (FakeTransport.admitted)
            this.control.enqueue(
                encodeControl("session-accepted", { sessionId: "42" })
            );
    }
    async createBidirectionalStream() {
        return {
            readable: this.control.stream,
            writable: new WritableStream({
                write: (bytes) => {
                    this.controlWrites.push(bytes);
                },
            }),
        };
    }
}
const connect = (extra: Partial<WorldLobbyTicket> = {}, opts: any = {}) =>
    WorldLobbyTransport.connect(
        { ...ticket, ...extra },
        {
            signal: new AbortController().signal,
            renewTicket: jest.fn(),
            ...opts,
        }
    );
const connections: WorldLobbyTransport[] = [];
beforeEach(() => {
    (globalThis as any).WebSocket = FakeSocket;
    delete (globalThis as any).WebTransport;
    FakeSocket.instances = [];
    FakeTransport.instances = [];
    FakeTransport.ready = () => Promise.resolve();
    FakeTransport.admitted = true;
});
afterEach(async () => {
    for (const connection of connections.splice(0)) await connection.leave();
    jest.useRealTimers();
});

test("unsupported WebTransport uses one original ticket over native WebSocket", async () => {
    const renewTicket = jest.fn();
    const pending = connect(
        { webTransportUrl: "https://localhost:4443/lobby" },
        { renewTicket }
    );
    const socket = FakeSocket.instances[0];
    socket.open();
    const connection = await pending;
    connections.push(connection);
    expect(connection.diagnostics()).toMatchObject({
        transport: "websocket",
        fallbackReason: expect.stringContaining("not supported"),
    });
    expect(renewTicket).not.toHaveBeenCalled();
    expect(socket.sent[0]).toBe(
        JSON.stringify({ type: "session", data: { token: "first-ticket" } })
    );
    connection.send("lobby-move", [1, 2, 0, 4, 0.5, -1, true]);
    expect(decodeMovement(socket.sent[1] as Uint8Array)).toMatchObject({
        sequence: 1,
        x: 2,
        z: 4,
    });
    socket.bufferedAmount = 300_000;
    connection.send("lobby-move", [2, 3, 0, 4, 0.5, -1, true]);
    expect(socket.sent).toHaveLength(2);
    expect(connection.diagnostics().droppedMovement).toBe(1);
});

test("failed QUIC admission revokes the old ticket before WebSocket fallback", async () => {
    (globalThis as any).WebTransport = FakeTransport;
    FakeTransport.ready = () => Promise.reject(new Error("QUIC blocked"));
    const renewTicket = jest.fn(async () => ({
        ...ticket,
        token: "replacement-ticket",
    }));
    const pending = connect(
        { webTransportUrl: "https://localhost:4443/lobby" },
        { renewTicket }
    );
    await flush();
    expect(FakeTransport.instances[0].close).toHaveBeenCalledTimes(1);
    expect(renewTicket).toHaveBeenCalledWith(
        expect.objectContaining({ token: "first-ticket" })
    );
    FakeSocket.instances[0].open();
    const connection = await pending;
    connections.push(connection);
    expect(FakeSocket.instances[0].sent[0]).toContain("replacement-ticket");
    expect(connection.diagnostics()).toMatchObject({
        transport: "websocket",
        fallbackReason: expect.stringContaining("handshake"),
    });
});

test("a stalled application handshake has a deadline and cleans up before fallback", async () => {
    jest.useFakeTimers();
    (globalThis as any).WebTransport = FakeTransport;
    FakeTransport.admitted = false;
    const renewTicket = jest.fn(async () => ticket);
    const pending = connect(
        { webTransportUrl: "https://localhost:4443/lobby" },
        { renewTicket, handshakeTimeoutMs: 20 }
    );
    await flush();
    jest.advanceTimersByTime(21);
    await flush();
    expect(renewTicket).toHaveBeenCalledTimes(1);
    expect(FakeTransport.instances[0].close).toHaveBeenCalledTimes(1);
    FakeSocket.instances[0].open();
    const connection = await pending;
    connections.push(connection);
    expect(connection.transport).toBe("websocket");
});

test("abort during a stalled handshake closes the session without creating a fallback", async () => {
    (globalThis as any).WebTransport = FakeTransport;
    FakeTransport.ready = () => new Promise(() => {});
    const abort = new AbortController();
    const renewTicket = jest.fn();
    const pending = connect(
        { webTransportUrl: "https://localhost:4443/lobby" },
        { signal: abort.signal, renewTicket }
    );
    const rejected = expect(pending).rejects.toThrow("cancelled");
    abort.abort();
    await rejected;
    expect(FakeTransport.instances[0].close).toHaveBeenCalledTimes(1);
    expect(renewTicket).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(0);
});

test("WebTransport keeps reliable fragmented control and replaceable binary motion separate", async () => {
    (globalThis as any).WebTransport = FakeTransport;
    const connection = await connect({
        webTransportUrl: "https://localhost:4443/lobby",
    });
    connections.push(connection);
    const session = FakeTransport.instances[0];
    expect(session.url).toContain("ticket=first-ticket");
    expect(session.datagrams.outgoingMaxAge).toBe(150);
    const received = jest.fn();
    connection.onMessage("lobby-roster", received);
    const control = encodeControl("lobby-roster", {
        enter: [{ username: "été" }],
        leave: [],
    });
    session.control.enqueue(control.subarray(0, 13));
    session.control.enqueue(control.subarray(13));
    const snapshot = jest.fn();
    connection.onMessage("lobby-snapshot-v2", snapshot);
    const [chunk] = encodeSnapshots({
        epoch: 5,
        tick: 2,
        serverTime: 50,
        poses: [[7, 2, 1, 0, 4, 0, -1, true]],
    });
    session.incoming.enqueue(chunk);
    session.incoming.enqueue(Uint8Array.from([0, 1]));
    connection.send("lobby-ping", { id: 1 });
    connection.send("lobby-move", [1, 1, 0, 2, 0, -1, true]);
    await flush();
    expect(received).toHaveBeenCalledWith({
        enter: [{ username: "été" }],
        leave: [],
    });
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(snapshot).toHaveBeenCalledWith(
        expect.objectContaining({ epoch: 5, tick: 2 })
    );
    expect(
        JSON.parse(new TextDecoder().decode(session.controlWrites[0]))
    ).toMatchObject({ type: "lobby-ping" });
    expect(decodeMovement(session.datagramWrites[0])).toMatchObject({
        sequence: 1,
        z: 2,
    });
});

test("certificate pinning is restricted to an explicitly trusted localhost endpoint", async () => {
    (globalThis as any).WebTransport = FakeTransport;
    const certificateHashes = [
        { algorithm: "sha-256", value: Array(32).fill(1) },
    ];
    const local = await connect(
        { webTransportUrl: "https://localhost:4443/lobby", certificateHashes },
        { allowLocalCertificateHashes: true }
    );
    connections.push(local);
    expect(
        FakeTransport.instances[0].options.serverCertificateHashes[0].value
    ).toEqual(Uint8Array.from(Array(32).fill(1)));
    const renewTicket = jest.fn(async () => ticket);
    const pending = connect(
        {
            webTransportUrl: "https://world.example.com/lobby",
            certificateHashes,
        },
        { allowLocalCertificateHashes: true, renewTicket }
    );
    await flush();
    expect(FakeTransport.instances).toHaveLength(1);
    FakeSocket.instances[0].open();
    connections.push(await pending);
    expect(renewTicket).toHaveBeenCalledTimes(1);
});

test("malformed or oversized reliable input closes cleanly and emits one disconnect", async () => {
    (globalThis as any).WebTransport = FakeTransport;
    const connection = await connect({
        webTransportUrl: "https://localhost:4443/lobby",
    });
    connections.push(connection);
    const leave = jest.fn();
    connection.onLeave(leave);
    FakeTransport.instances[0].control.enqueue(
        new Uint8Array(256 * 1024 + 1).fill(65)
    );
    await flush();
    expect(leave).toHaveBeenCalledTimes(1);
    expect(FakeTransport.instances[0].close).toHaveBeenCalledTimes(1);
});

test("leave cancels reads and handlers, late WebSocket events cannot reconnect", async () => {
    const pending = connect();
    const socket = FakeSocket.instances[0];
    socket.open();
    const connection = await pending;
    const message = jest.fn();
    connection.onMessage("lobby-roster", message);
    await connection.leave();
    socket.deliver("lobby-roster", { enter: [] });
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(message).not.toHaveBeenCalled();
    expect(socket.onclose).toBeNull();
});

test("modern datagram writers retain only the newest unsent position and tolerate one expired packet", async () => {
    let release: () => void;
    const ready = new Promise<void>((resolve) => {
        release = resolve;
    });
    const writes: Uint8Array[] = [];
    const writer = {
        ready,
        write: jest.fn(async (bytes: Uint8Array) => {
            writes.push(bytes);
            if (writes.length === 1) throw new Error("Datagram expired");
        }),
        abort: jest.fn(async () => {}),
        releaseLock: jest.fn(),
    };
    const createWritable = jest.fn(() => ({ getWriter: () => writer }));
    class ModernTransport extends FakeTransport {
        reliability = "supports-unreliable";
        constructor(url: string, options: any) {
            super(url, options);
            (this.datagrams as any).createWritable = createWritable;
            (this.datagrams as any).maxDatagramSize = 1200;
        }
    }
    (globalThis as any).WebTransport = ModernTransport;
    const connection = await connect({
        webTransportUrl: "https://localhost:4443/lobby",
    });
    connections.push(connection);
    const leave = jest.fn();
    connection.onLeave(leave);
    for (let sequence = 1; sequence <= 100; sequence++)
        connection.send("lobby-move", [sequence, sequence, 0, 0, 0, -1, true]);
    expect(writes).toHaveLength(0);
    release();
    await flush();
    expect(writes).toHaveLength(1);
    expect(decodeMovement(writes[0]).sequence).toBe(100);
    connection.send("lobby-move", [101, 101, 0, 0, 0, -1, true]);
    await flush();
    expect(decodeMovement(writes[1]).sequence).toBe(101);
    expect(leave).not.toHaveBeenCalled();
    expect(createWritable).toHaveBeenCalledTimes(1);
    expect(FakeTransport.instances[0].options.requireUnreliable).toBe(true);
    expect(connection.diagnostics()).toMatchObject({
        droppedMovement: 100,
        sentDatagrams: 1,
    });
});

test.each(["reliable-only", "too-small"])(
    "%s WebTransport falls back before motion is sent",
    async (mode) => {
        class IncompatibleTransport extends FakeTransport {
            constructor(url: string, options: any) {
                super(url, options);
                if (mode === "reliable-only")
                    (this as any).reliability = "reliable-only";
                else (this.datagrams as any).maxDatagramSize = 23;
            }
        }
        (globalThis as any).WebTransport = IncompatibleTransport;
        const renewTicket = jest.fn(async () => ticket);
        const pending = connect(
            { webTransportUrl: "https://localhost:4443/lobby" },
            { renewTicket }
        );
        await flush();
        FakeSocket.instances[0].open();
        const connection = await pending;
        connections.push(connection);
        expect(connection.transport).toBe("websocket");
        expect(renewTicket).toHaveBeenCalledTimes(1);
        expect(FakeTransport.instances[0].close).toHaveBeenCalledTimes(1);
    }
);

test("a stream ending during admission falls back instead of returning an unusable connection", async () => {
    class ClosingSession extends FakeTransport {
        constructor(url: string, options: any) {
            super(url, options);
            this.control.close();
        }
    }
    (globalThis as any).WebTransport = ClosingSession;
    const renewTicket = jest.fn(async () => ticket);
    const pending = connect(
        { webTransportUrl: "https://localhost:4443/lobby" },
        { renewTicket }
    );
    await flush();
    expect(renewTicket).toHaveBeenCalledTimes(1);
    FakeSocket.instances[0].open();
    const connection = await pending;
    connections.push(connection);
    expect(connection.diagnostics()).toMatchObject({
        transport: "websocket",
        fallbackReason: expect.stringContaining("Lobby stream ended"),
    });
});

test("a disconnect just after connect is replayed to a late lifecycle subscriber", async () => {
    const pending = connect();
    const socket = FakeSocket.instances[0];
    socket.open();
    const connection = await pending;
    connections.push(connection);
    socket.onclose();
    const left = jest.fn();
    connection.onLeave(left);
    await flush();
    expect(left).toHaveBeenCalledTimes(1);
});

test("WebSocket carries one bounded 128-avatar snapshot while WebTransport requires small chunks", async () => {
    const frame = {
        epoch: 1,
        tick: 1,
        serverTime: 1000,
        poses: Array.from(
            { length: 128 },
            (_, i) =>
                [i + 1, 1, i, 0, 0, 0, -1, true] as [
                    number,
                    number,
                    number,
                    number,
                    number,
                    number,
                    number,
                    boolean
                ]
        ),
    };
    const [large] = encodeSnapshots(frame, 4096);
    expect(large.byteLength).toBeGreaterThan(1200);
    const pending = connect();
    const socket = FakeSocket.instances[0];
    socket.open();
    const ws = await pending;
    connections.push(ws);
    const received = jest.fn();
    ws.onMessage("lobby-snapshot-v2", received);
    socket.onmessage({ data: large.buffer as ArrayBuffer });
    expect(received.mock.calls[0][0].poses).toHaveLength(128);
    (globalThis as any).WebTransport = FakeTransport;
    const wt = await connect({
        webTransportUrl: "https://localhost:4443/lobby",
    });
    connections.push(wt);
    const small = jest.fn();
    wt.onMessage("lobby-snapshot-v2", small);
    FakeTransport.instances[0].incoming.enqueue(large);
    for (const bytes of encodeSnapshots(frame, 1200))
        FakeTransport.instances[0].incoming.enqueue(bytes);
    await flush();
    expect(small).toHaveBeenCalledTimes(3);
    expect(
        small.mock.calls.reduce(
            (count, [packet]) => count + packet.poses.length,
            0
        )
    ).toBe(128);
});

test("keeps the native opening-handshake error when falling back", async () => {
    class RejectedTransport extends FakeTransport {
        ready = new Promise(() => {});
        closed = Promise.reject(new Error("Opening handshake failed."));
    }
    (globalThis as any).WebTransport = RejectedTransport;
    const pending = connect(
        { webTransportUrl: "https://world.example.com/lobby" },
        { renewTicket: async () => ticket }
    );
    await flush();
    FakeSocket.instances[0].open();
    const connection = await pending;
    connections.push(connection);
    expect(connection.diagnostics().fallbackReason).toContain(
        "Opening handshake failed."
    );
});

test("deliberate QUIC leave closes the session without resetting its reliable stream", async () => {
    (globalThis as any).WebTransport = FakeTransport;
    const connection = await connect({
        webTransportUrl: "https://world.example.com/lobby",
    });
    const native = FakeTransport.instances[0];
    await connection.leave();
    await connection.leave();
    await flush();
    expect(native.close).toHaveBeenCalledTimes(1);
    expect(native.control.cancel).not.toHaveBeenCalled();
    expect(native.incoming.cancel).not.toHaveBeenCalled();
    expect(connection.diagnostics().transportClosed).toBe(true);
});
