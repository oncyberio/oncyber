#!/usr/bin/env node
// Execute the actual browser transport after the installed Next/SWC ES5 transform.
// Babel/Jest alone misses Next 13's async-loop/try-finally miscompilation.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { createRequire } = require("node:module");
const { ReadableStream, WritableStream } = require("node:stream/web");
const { transform } = require("next/dist/build/swc");
const wire = require("../../multiplayer/protocol/lobby-v2.js");
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));
const sourcePath = resolve(
    __dirname,
    "../features/lobby/WorldLobbyTransport.ts"
);

function inputStream() {
    let controller;
    const readable = new ReadableStream({
        start(value) {
            controller = value;
        },
    });
    return { readable, enqueue: (bytes) => controller.enqueue(bytes) };
}
let active;
let releaseWrite;
class NativeStreamsSession {
    ready = Promise.resolve();
    closed = new Promise(() => {});
    reliability = "supports-unreliable";
    control = inputStream();
    input = inputStream();
    controls = [];
    movements = [];
    datagrams = {
        readable: this.input.readable,
        maxDatagramSize: 1200,
        createWritable: () =>
            new WritableStream({
                write: (bytes) => {
                    this.movements.push(wire.decodeMovement(bytes));
                    if (this.movements.length === 1)
                        return new Promise((resolve) => {
                            releaseWrite = resolve;
                        });
                },
            }),
    };
    constructor() {
        active = this;
        this.control.enqueue(
            wire.encodeControl("session-accepted", { sessionId: "42" })
        );
    }
    async createBidirectionalStream() {
        return {
            readable: this.control.readable,
            writable: new WritableStream({
                write: (bytes) =>
                    this.controls.push(
                        JSON.parse(new TextDecoder().decode(bytes))
                    ),
            }),
        };
    }
    close() {}
}

(async () => {
    const result = await transform(readFileSync(sourcePath, "utf8"), {
        filename: sourcePath,
        jsc: {
            parser: { syntax: "typescript" },
            target: "es5",
            externalHelpers: false,
        },
        module: { type: "commonjs" },
        minify: false,
        sourceMaps: false,
    });
    const compiled = { exports: {} };
    new Function("require", "module", "exports", result.code)(
        createRequire(sourcePath),
        compiled,
        compiled.exports
    );
    const { WorldLobbyTransport } = compiled.exports;
    const previous = globalThis.WebTransport;
    globalThis.WebTransport = NativeStreamsSession;
    let connection;
    try {
        connection = await WorldLobbyTransport.connect(
            {
                lobbyProtocol: 2,
                roomId: "test",
                region: "local",
                sessionId: "42",
                token: "test-ticket",
                wsUrl: "ws://127.0.0.1:2581/lobby-v2",
                webTransportUrl: "https://localhost:2590/lobby-v2",
            },
            {
                signal: new AbortController().signal,
                renewTicket: async () => {
                    throw Error("Compiled transport unexpectedly fell back");
                },
            }
        );
        const controls = [],
            snapshots = [];
        connection.onMessage("lobby-pong", (value) => controls.push(value));
        connection.onMessage("lobby-snapshot-v2", (value) =>
            snapshots.push(value)
        );
        for (let i = 1; i <= 8; i++) {
            active.control.enqueue(wire.encodeControl("lobby-pong", { id: i }));
            active.input.enqueue(
                wire.encodeSnapshots({
                    epoch: 1,
                    tick: i,
                    serverTime: 1000 + i,
                    poses: [[7, i, i, 0, 0, 0, -1, true]],
                })[0]
            );
        }
        connection.send("lobby-ready", {});
        await flush();
        assert.equal(connection.diagnostics().transportClosed, false);
        assert.equal(
            controls.length,
            8,
            "Reader must keep its lock after each message"
        );
        assert.equal(snapshots.length, 8, "Datagram reader must keep pumping");
        assert.equal(active.controls[0].type, "lobby-ready");
        connection.send("lobby-move", [1, 0, 0, 0, 0, -1, true]);
        await flush();
        for (let seq = 2; seq <= 10; seq++)
            connection.send("lobby-move", [seq, seq, 0, 0, 0, -1, true]);
        assert.equal(
            active.movements.length,
            1,
            "Only one write may be in flight"
        );
        releaseWrite();
        await flush();
        assert.deepEqual(
            active.movements.map((m) => m.sequence),
            [1, 10],
            "Queued movement must coalesce to newest pose"
        );
        assert.equal(connection.diagnostics().transportClosed, false);
        process.stdout.write(
            "PASS: Next/SWC-compiled transport reads repeated controls/datagrams and serializes coalesced movement.\n"
        );
    } finally {
        if (releaseWrite) releaseWrite();
        if (connection) await connection.leave();
        if (previous === undefined) delete globalThis.WebTransport;
        else globalThis.WebTransport = previous;
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
