import assert from "assert";
import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { runInNewContext } from "vm";
import ts from "typescript";
import { createSharedWorld, SharedWorld } from "../src/world/shared";
import { WorldGateway } from "../src/world/gateway";
import { profile } from "../src/rooms/crowd/protocol";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = () => new Promise((resolve) => setImmediate(resolve));
// Execute the actual source module with fake worker channels. No load generators,
// real CPU workers or HTTP/3 listeners are launched by these fault tests.
function sourceModule(file: string, mocks: Record<string, any>, globals: Record<string, any> = {}) {
    const filename = resolve(process.cwd(), "src/world", file);
    const localRequire = createRequire(filename);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const module = { exports: {} as any };
    runInNewContext(code, { module, exports: module.exports, require: (name: string) => (Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : localRequire(name)), __filename: filename, __dirname: dirname(filename), Buffer, URL, Date, Promise, Set, Map, Int32Array, Float64Array, SharedArrayBuffer, Atomics, setTimeout, clearTimeout, setInterval, clearInterval, process, console, ...globals }, { filename });
    return module.exports;
}
function workerHarness() {
    const port = new EventEmitter() as any;
    const sent: any[] = [];
    port.postMessage = (message: any) => sent.push(message);
    const intervals: Array<() => void> = [];
    let now = 1000;
    const gatewayCalls: any[] = [];
    let endpoint: any;
    class FakeGateway {
        start() {}
        stop() {}
        reserve() {}
        revoke() {}
        member() {}
        remove() {}
        deliver() {}
        stats() {
            return {};
        }
        resetSamples() {}
        async accept(_token: string, peer: any) {
            endpoint = peer;
            return "1";
        }
        disconnect(id: string) {
            gatewayCalls.push({ kind: "disconnect", id });
        }
        receiveDatagram(id: string, bytes: Uint8Array) {
            gatewayCalls.push({ kind: "datagram", id, bytes });
        }
        receiveControl(id: string, type: string, data: any) {
            gatewayCalls.push({ kind: "control", id, type, data });
        }
    }
    class FakeWsServer extends EventEmitter {
        clients = new Set();
        close() {}
        handleUpgrade() {}
    }
    const http = new EventEmitter() as any;
    http.listen = (_port: number, _host: string, callback: () => void) => callback();
    http.close = () => {};
    sourceModule(
        "worker.ts",
        {
            worker_threads: { parentPort: port, workerData: { owner: 0, origins: [], wsPort: 1, bind: "127.0.0.1" } },
            http: { createServer: () => http },
            ws: { Server: FakeWsServer },
            "./gateway": { WorldGateway: FakeGateway },
        },
        {
            Date: class extends Date {
                static now() {
                    return now;
                }
            },
            setInterval: (callback: () => void) => {
                intervals.push(callback);
                return 1;
            },
            clearInterval: () => {},
            process: { ...process, exit: () => {} },
        }
    );
    port.emit("message", { type: "proxy-accept", token: "test-ticket", id: "1", request: 1, maxDatagramSize: 1000 });
    return {
        port,
        sent,
        gatewayCalls,
        endpoint: () => endpoint,
        advance: (ms: number) => {
            now += ms;
        },
        flush: () => intervals[0](),
    };
}

describe("Shared-world transport fault handling", () => {
    it("closes and releases admission if the reliable welcome cannot be queued", async () => {
        const gateway = new WorldGateway({ owner: 0, shared: createSharedWorld(2), epoch: 1, roomId: "test", region: "local", post() {} });
        const closed: any[] = [];
        const endpoint = {
            sendControl: (type: string) => type !== "lobby-welcome",
            sendDatagram: () => true,
            bufferedAmount: () => 0,
            close: (code: number, reason: string) => {
                closed.push({ code, reason });
                gateway.disconnect("1");
            },
        };
        gateway.reserve({ id: 1, slot: 0, owner: 0, token: "fixture-token", expires: Date.now() + 10000, profile: profile("1", { username: "Fixture" }) });
        await gateway.accept("fixture-token", endpoint);
        gateway.receiveControl("1", "lobby-ready", {});
        assert.equal(closed.length, 1);
        assert.equal(gateway.sessions.size, 0);
    });
    it("allows one IPC output batch in flight and preserves queued age and negotiated MTU", async () => {
        const h = workerHarness();
        await tick();
        assert.equal(h.endpoint().maxDatagramSize(), 1000);
        h.endpoint().sendDatagram(new Uint8Array([1]));
        h.flush();
        h.endpoint().sendDatagram(new Uint8Array([2]));
        h.advance(200);
        h.flush();
        assert.equal(h.sent.filter((message) => message.type === "proxy-output").length, 1);
        h.port.emit("message", { type: "proxy-buffer", batch: [] });
        h.flush();
        const batches = h.sent.filter((message) => message.type === "proxy-output");
        assert.equal(batches.length, 2);
        assert.equal(batches[1].batch[0].queuedAt, 1000);
        assert.deepEqual(Array.from(batches[1].batch[0].bytes), [2]);
    });
    it("closes out of band and releases the session even when the IPC data queue is full", async () => {
        const h = workerHarness();
        await tick();
        let accepted = 0;
        while (h.endpoint().sendDatagram(new Uint8Array(1200))) accepted++;
        assert(accepted > 0 && accepted < 8192);
        h.endpoint().close(4008, "Full queue");
        assert(h.sent.some((message) => message.type === "proxy-end" && message.id === "1"));
        assert(h.gatewayCalls.some((call) => call.kind === "disconnect" && call.id === "1"));
        assert.equal(h.endpoint().sendControl("lobby-welcome", {}), false);
    });
    it("drops stale incoming datagrams, closes stale reliable controls, and acknowledges the batch", async () => {
        const h = workerHarness();
        await tick();
        h.advance(6000);
        h.port.emit("message", {
            type: "proxy-input",
            batch: [
                { id: "1", kind: "datagram", bytes: new Uint8Array([1]), queuedAt: 1000 },
                { id: "1", kind: "control", type: "chat-channel", data: {}, queuedAt: 1000 },
            ],
        });
        assert.equal(h.gatewayCalls.filter((call) => call.kind === "datagram" || call.kind === "control").length, 0);
        assert(h.gatewayCalls.some((call) => call.kind === "disconnect"));
        assert(h.sent.some((message) => message.type === "proxy-end"));
        assert(h.sent.some((message) => message.type === "proxy-input-ack"));
    });
});

async function serverHarness(webtransport = false) {
    const workers: any[] = [];
    let transport: any;
    class FakeWorker extends EventEmitter {
        reservations: any[] = [];
        revocations: any[] = [];
        messages: any[] = [];
        constructor(_path: string, options: any) {
            super();
            workers.push(this);
            queueMicrotask(() => this.emit("message", { type: "listening", owner: options.workerData.owner }));
        }
        postMessage(message: any) {
            this.messages.push(message);
            if (message.type === "proxy-accept") queueMicrotask(() => this.emit("message", { type: "proxy-accepted", request: message.request, id: message.id }));
            if (message.type === "reserve") this.reservations.push(message.reservation);
            if (message.type === "revoke") this.revocations.push(message);
            if (message.type === "stop") queueMicrotask(() => this.emit("exit", 0));
            if (message.type === "stats") queueMicrotask(() => this.emit("message", { type: "stats", request: message.request, stats: {} }));
        }
        async terminate() {
            this.emit("exit", 0);
            return 0;
        }
    }
    const routes = new Map<string, (...args: any[]) => any>();
    const app = {
        disable() {},
        use() {},
        get() {},
        post(path: string, handler: (...args: any[]) => any) {
            routes.set(path, handler);
        },
    };
    const express = Object.assign(() => app, { json: () => () => {} });
    const http = new EventEmitter() as any;
    http.listen = (_port: number, _host: string, callback: () => void) => callback();
    http.closeAllConnections = () => {};
    http.close = (callback: () => void) => callback();
    const { createWorldServer } = sourceModule(
        "server.ts",
        {
            worker_threads: { Worker: FakeWorker },
            http: { createServer: () => http },
            express,
            cors: () => () => {},
            "./shared": { createSharedWorld, SharedWorld },
            "../rooms/crowd/protocol": { profile },
            fs: { readFileSync: () => "test PEM fixture" },
            "../transport/webtransport": {
                createWebTransportGateway: async (options: any) => {
                    transport = options;
                    return { close: async () => {}, stats: () => ({}) };
                },
            },
        },
        { console: { ...console, error: () => {} } }
    );
    const workerFailures: any[] = [];
    const world = await createWorldServer({ port: 2660, workers: 1, capacity: 4, testMode: true, webtransport, certPath: "fixture-cert", keyPath: "fixture-key", onWorkerFailure: (owner: number, code: number) => workerFailures.push({ owner, code }) });
    const join = (body: any = {}) =>
        new Promise<{ status: number; ticket: any }>((resolve, reject) => {
            let status = 200;
            const response = {
                status(code: number) {
                    status = code;
                    return response;
                },
                setHeader() {},
                json(ticket: any) {
                    resolve({ status, ticket });
                    return response;
                },
            };
            Promise.resolve(routes.get("/join")!({ body: { lobbyProtocol: 2, ...body }, socket: { remoteAddress: "127.0.0.1" } }, response)).catch(reject);
        });
    return { world, workers, join, transport, workerFailures };
}

describe("Shared-world admission fault handling", function () {
    this.timeout(8000);
    it("bounds coordinator IPC in flight and expires worker snapshots using their original enqueue time", async () => {
        const h = await serverHarness(true);
        const datagrams: Uint8Array[] = [];
        const closes: any[] = [];
        try {
            const ticket = (await h.join()).ticket;
            const id = await h.transport.gateway.accept(ticket.token, {
                sendControl: () => true,
                sendDatagram: (bytes: Uint8Array) => {
                    datagrams.push(bytes);
                    return true;
                },
                maxDatagramSize: () => 900,
                bufferedAmount: () => 0,
                close: (...args: any[]) => closes.push(args),
            });
            assert(id);
            assert.equal(h.workers[0].messages.find((message: any) => message.type === "proxy-accept").maxDatagramSize, 900);
            h.transport.gateway.receiveDatagram(id, new Uint8Array([1]));
            while (!h.workers[0].messages.some((message: any) => message.type === "proxy-input")) await pause(5);
            h.transport.gateway.receiveControl(id, "lobby-ready", {});
            await pause(20);
            assert.equal(h.workers[0].messages.filter((message: any) => message.type === "proxy-input").length, 1);
            h.workers[0].emit("message", { type: "proxy-input-ack" });
            while (h.workers[0].messages.filter((message: any) => message.type === "proxy-input").length < 2) await pause(5);
            const now = Date.now();
            h.workers[0].emit("message", {
                type: "proxy-output",
                batch: [
                    { id, kind: "datagram", bytes: new Uint8Array([1]), queuedAt: now - 151 },
                    { id, kind: "datagram", bytes: new Uint8Array([2]), queuedAt: now },
                    { id, kind: "control", type: "lobby-welcome", data: {}, queuedAt: now - 5001 },
                ],
            });
            assert.equal(datagrams.length, 1);
            assert.deepEqual(Array.from(datagrams[0]), [2]);
            assert.equal(closes.length, 1);
            assert(h.workers[0].messages.some((message: any) => message.type === "proxy-buffer"));
        } finally {
            await h.world.close();
        }
    });
    it("rejects every concurrent replacement when the shared revocation times out", async () => {
        const h = await serverHarness();
        try {
            const first = await h.join();
            const ticket = h.workers[0].reservations[0];
            h.workers[0].emit("message", { type: "accepted", id: ticket.id, token: ticket.token });
            const replacements = await Promise.all([h.join({ replaceToken: first.ticket.token }), h.join({ replaceToken: first.ticket.token })]);
            assert.deepEqual(
                replacements.map((response) => response.status),
                [503, 503]
            );
            assert.equal(h.workers[0].revocations.length, 1);
            assert.equal(h.workers[0].reservations.length, 1);
        } finally {
            await h.world.close();
        }
    });
    it("rechecks availability before admitting after the last worker exits during revocation", async () => {
        const h = await serverHarness();
        try {
            const first = await h.join();
            const replacement = h.join({ replaceToken: first.ticket.token });
            while (!h.workers[0].revocations.length) await pause(5);
            // Both events arrive before the waiting join continuation runs.
            h.workers[0].emit("message", { type: "revoked", token: first.ticket.token });
            h.workers[0].emit("exit", 1);
            assert.deepEqual(h.workerFailures, [{ owner: 0, code: 1 }]);
            assert.equal((await replacement).status, 503);
            assert.equal(h.workers[0].reservations.length, 1);
        } finally {
            await h.world.close();
        }
    });
});
