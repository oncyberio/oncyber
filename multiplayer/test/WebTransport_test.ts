import assert from "assert";
import { ReadableStream, WritableStream } from "stream/web";
import { attachWebTransportSession, validateWebTransportRequest, createWebTransportGateway } from "../src/transport/webtransport";
import { encodeControl } from "../protocol/lobby-v2";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture({ admission, stalled = false, datagramWrite }: { admission?: Promise<string | null>; stalled?: boolean; datagramWrite?: () => Promise<void> } = {}) {
    let closeResolve: () => void;
    let bidi: any;
    let uni: any;
    let datagram: any;
    let control: any;
    const controls: any[] = [];
    const received: Uint8Array[] = [];
    const sent: Uint8Array[] = [];
    const disconnects: string[] = [];
    const closes: any[] = [];
    const stream = {
        readable: new ReadableStream({
            start(c) {
                control = c;
            },
        }),
        writable: new WritableStream({
            write(bytes: Uint8Array) {
                controls.push(bytes);
                if (stalled) return new Promise(() => {});
            },
        }),
    };
    const session = {
        ready: Promise.resolve(),
        closed: new Promise<void>((resolve) => {
            closeResolve = resolve;
        }),
        incomingBidirectionalStreams: new ReadableStream({
            start(c) {
                bidi = c;
            },
        }),
        incomingUnidirectionalStreams: new ReadableStream({
            start(c) {
                uni = c;
            },
        }),
        datagrams: {
            maxDatagramSize: 1200,
            readable: new ReadableStream({
                start(c) {
                    datagram = c;
                },
            }),
            createWritable: () =>
                new WritableStream({
                    write(bytes: Uint8Array) {
                        sent.push(bytes);
                        if (datagramWrite) return datagramWrite();
                        if (stalled) return new Promise(() => {});
                    },
                }),
        },
        close(info: unknown) {
            closes.push(info);
            closeResolve();
        },
    };
    const counters = { accepted: 0, rejected: 0, active: 0, datagramsSent: 0, datagramsReceived: 0, datagramsDropped: 0, controlBytesSent: 0, protocolErrors: 0 };
    const endpoint = attachWebTransportSession(
        session,
        "valid-ticket-0123456",
        {
            accept: () => admission || Promise.resolve("player"),
            receiveControl: (_id, type, data) => receivedControls.push({ type, data }),
            receiveDatagram: (_id, bytes) => received.push(bytes),
            disconnect: (id) => disconnects.push(id),
        },
        counters
    );
    const receivedControls: any[] = [];
    return { counters, endpoint, session, bidi, uni, datagram, control, stream, controls, received, receivedControls, sent, disconnects, closes };
}

describe("WebTransport gateway boundaries", () => {
    it("validates exact origin, endpoint and one bounded admission token", () => {
        const origins = new Set(["https://oncyber.io"]);
        const header = { ":path": "/lobby-v2?ticket=valid-ticket-0123456", origin: "https://oncyber.io" };
        const check = (h: any) => validateWebTransportRequest(h, "/lobby-v2", origins);
        assert.equal(check(header).status, 200);
        assert.equal(check({ ...header, origin: "https://oncyber.io.evil.test" }).status, 403);
        assert.equal(check({ ...header, origin: undefined }).status, 403);
        assert.equal(check({ ...header, ":path": "/other?ticket=valid-ticket-0123456" }).status, 404);
        assert.equal(check({ ...header, ":path": "/lobby-v2?ticket=short" }).status, 403);
        assert.equal(check({ ...header, ":path": header[":path"] + "&ticket=other-ticket-0123456" }).status, 403);
        assert.equal(check({ ...header, ":path": "x".repeat(2049) }).status, 400);
    });
    it("prohibits originless development clients on public listeners", async () => {
        await assert.rejects(createWebTransportGateway({ host: "0.0.0.0", port: 2599, cert: "", key: "", origins: ["https://oncyber.io"], allowOriginlessLoopbackClients: true, gateway: {} as any }), /loopback/);
    });
    it("handles fragmented reliable frames and independent movement datagrams", async () => {
        const f = fixture();
        await tick();
        f.bidi.enqueue(f.stream);
        await tick();
        const bytes = encodeControl("chat", { text: "world 🌎" });
        for (let i = 0; i < bytes.length; i += 3) f.control.enqueue(bytes.subarray(i, i + 3));
        f.datagram.enqueue(new Uint8Array([1, 2, 3]));
        await tick();
        assert.deepEqual(f.receivedControls, [{ type: "chat", data: { text: "world 🌎" } }]);
        assert.deepEqual(Array.from(f.received[0]), [1, 2, 3]);
        f.endpoint.close();
        await tick();
        assert.deepEqual(f.disconnects, ["player"]);
    });
    it("closes malformed reliable frames without delivering partial messages", async () => {
        const f = fixture();
        await tick();
        f.bidi.enqueue(f.stream);
        await tick();
        f.control.enqueue(new TextEncoder().encode("{bad json}\n"));
        await tick();
        assert.equal(f.closes.length, 1);
        assert.equal(f.receivedControls.length, 0);
    });
    it("rejects extra streams and oversized incoming datagrams", async () => {
        for (const kind of ["bidi", "uni", "datagram"]) {
            const f = fixture();
            await tick();
            f.bidi.enqueue(f.stream);
            await tick();
            if (kind === "bidi") f.bidi.enqueue(f.stream);
            else if (kind === "uni") f.uni.enqueue({});
            else f.datagram.enqueue(new Uint8Array(1201));
            await tick();
            assert.equal(f.closes.length, 1, kind);
        }
    });
    it("bounds reliable backlog before a peer even opens its control stream", async () => {
        const f = fixture();
        await tick();
        for (let i = 0; i < 100 && !f.closes.length; i++) f.endpoint.sendControl("profile", { text: "a".repeat(8000) });
        assert.equal(f.closes.length, 1);
        assert.equal(f.endpoint.bufferedAmount(), 0);
    });
    it("bounds stale datagrams and never accepts oversized outgoing packets", async () => {
        const f = fixture({ stalled: true });
        await tick();
        for (let i = 0; i < 100; i++) f.endpoint.sendDatagram(new Uint8Array(1200));
        assert(f.endpoint.bufferedAmount() <= 16 * 1200);
        assert.equal(f.endpoint.sendDatagram(new Uint8Array(1201)), false);
        assert.equal(f.endpoint.sendDatagram(new Uint8Array()), false);
        f.endpoint.close();
        await tick();
    });
    it("uses negotiated datagram limits and discards stale queued snapshots", async () => {
        let release: () => void;
        const f = fixture({
            datagramWrite: () =>
                new Promise((resolve) => {
                    release = resolve;
                }),
        });
        await tick();
        f.session.datagrams.maxDatagramSize = 900;
        assert.equal(f.endpoint.maxDatagramSize!(), 900);
        assert.equal(f.endpoint.sendDatagram(new Uint8Array(901)), false);
        assert.equal(f.endpoint.sendDatagram(new Uint8Array(900)), true);
        await tick();
        f.endpoint.sendDatagram(new Uint8Array(900));
        const realNow = Date.now;
        const advanced = realNow() + 151;
        try {
            Date.now = () => advanced;
            release!();
            await tick();
            assert.equal(f.sent.length, 1);
            assert.equal(f.endpoint.bufferedAmount(), 0);
        } finally {
            Date.now = realNow;
            f.endpoint.close();
        }
    });
    it("releases a seat exactly once if admission finishes after disconnect", async () => {
        let release: (value: string) => void;
        const f = fixture({
            admission: new Promise((resolve) => {
                release = resolve;
            }),
        });
        await tick();
        f.endpoint.close();
        release!("late-player");
        await tick();
        assert.deepEqual(f.disconnects, ["late-player"]);
    });
    it("does not count native normal-close stream rejection as protocol failure", async () => {
        const f = fixture();
        await tick();
        (f.session as any).state = "closed";
        f.datagram.error(new Error("Native session closed"));
        await tick();
        assert.equal(f.counters.protocolErrors, 0);
        assert.equal(f.counters.active, 0);
        assert.deepEqual(f.disconnects, ["player"]);
    });
    it("closes ingress floods before unbounded application work", async () => {
        const f = fixture();
        await tick();
        for (let i = 0; i < 200; i++) f.datagram.enqueue(new Uint8Array([1]));
        await tick();
        assert.equal(f.closes.length, 1);
        assert.equal(f.received.length, 160);
    });
});
