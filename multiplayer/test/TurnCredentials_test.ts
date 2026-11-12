import assert from "assert";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve } from "path";
import { runInNewContext } from "vm";
import ts from "typescript";
import { createTurnCredentials } from "../src/utils/turnCredentials";

const secret = "test-only-turn-secret";
const now = 1800000000123;
function verify(value: { username: string; credential: string }, ttl: number) {
    assert.match(value.username, /^\d+:[a-f0-9]{32}$/);
    assert.equal(Number(value.username.split(":")[0]), Math.floor(now / 1000) + ttl);
    assert.equal(value.credential, createHmac("sha1", secret).update(value.username).digest("base64"));
}

// Register the actual HTTP handlers without starting either server or booting
// Firebase/room infrastructure. The credential helper remains the real module.
function issuer(file: string, env: Record<string, string>) {
    let route: Function;
    const noop = () => {};
    const app = {
        get: (path: string, ...handlers: Function[]) => { if (path === "/turnCredentials") route = handlers[handlers.length - 1]; },
        post: noop, use: noop, set: noop, disable: noop,
    };
    const express = Object.assign(() => app, { json: () => noop });
    const mocks: Record<string, any> = {
        express, dotenv: { config: noop }, cors: () => noop,
        "express-rate-limit": () => noop, "express-basic-auth": () => noop,
        http: { createServer: () => ({}) },
        colyseus: { Server: class { listen() { return Promise.resolve(); } }, LocalPresence: class {} },
        "@colyseus/ws-transport": { WebSocketTransport: class {} },
        "@colyseus/monitor": { monitor: () => noop },
        "async-mutex": { Mutex: class {} },
    };
    const filename = resolve(__dirname, "../src", file);
    const localRequire = createRequire(filename);
    const module = { exports: {} as any };
    const code = ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    runInNewContext(code, {
        module, exports: module.exports, process: { env }, console: { log: noop, error: noop },
        require: (name: string) => {
            if (name.endsWith("/crowd/join")) return { registerCrowdRoom: noop };
            if (name === "./groupCohort" || name.endsWith("/utils/Logs")) return {};
            return Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : localRequire(name);
        },
    }, { filename });
    if (module.exports.initializeExpress) module.exports.initializeExpress(app);
    return () => {
        let status = 200, body: any;
        const headers: Record<string, string> = {};
        const response = {
            status: (value: number) => { status = value; return response; },
            setHeader: (key: string, value: string) => { headers[key.toLowerCase()] = value; },
            json: (value: any) => { body = value; return response; },
        };
        route!({}, response);
        return { status, headers, body };
    };
}

describe("per-issuance TURN credentials", () => {
    it("assigns independent relay usernames and valid HMACs to same-second requests", () => {
        const values = Array.from({ length: 256 }, () => createTurnCredentials(secret, 3600, now));
        for (const value of values) verify(value, 3600);
        assert.equal(new Set(values.map((value) => value.username)).size, values.length);
        assert.equal(new Set(values.map((value) => value.credential)).size, values.length);
    });
    for (const file of ["express/index.ts", "lobby-server.ts"]) {
        it(`${file} issues fresh noncached credentials and preserves TTL/URLs`, () => {
            const env = { TURN_SECRET: secret, TURN_HOST: "turn.example.test", TURN_TTL: "600" };
            const request = issuer(file, env), oldNow = Date.now;
            Date.now = () => now;
            try {
                const a = request(), b = request();
                for (const result of [a, b]) {
                    assert.equal(result.status, 200);
                    assert.equal(result.headers["cache-control"], "no-store");
                    assert.equal(result.body.success, true);
                    assert.equal(result.body.ttl, 600);
                    assert.equal(JSON.stringify(result.body.urls), JSON.stringify(["turn:turn.example.test:3478?transport=udp", "turn:turn.example.test:3478?transport=tcp"]));
                    verify(result.body, 600);
                }
                assert.notEqual(a.body.username, b.body.username);
                assert.notEqual(a.body.credential, b.body.credential);
                env.TURN_TTL = "9999";
                verify(request().body, 3600);
                env.TURN_SECRET = "";
                assert.equal(request().status, 404);
                env.TURN_SECRET = secret;
                env.TURN_HOST = "";
                assert.equal(request().status, 404);
            } finally { Date.now = oldNow; }
        });
    }
});
