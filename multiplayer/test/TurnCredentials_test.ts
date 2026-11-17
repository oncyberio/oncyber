import assert from "assert";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve } from "path";
import { runInNewContext } from "vm";
import ts from "typescript";
import { createTurnCredentials } from "../src/utils/turnCredentials";
import { issueTurnCredentials } from "../src/utils/turnIssuer";

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
    return async () => {
        let status = 200, body: any;
        const headers: Record<string, string> = {};
        const response = {
            status: (value: number) => { status = value; return response; },
            setHeader: (key: string, value: string) => { headers[key.toLowerCase()] = value; },
            json: (value: any) => { body = value; return response; },
        };
        await route!({}, response);
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
        it(`${file} issues fresh noncached credentials and preserves TTL/URLs`, async () => {
            const env = { TURN_SECRET: secret, TURN_HOST: "turn.example.test", TURN_TTL: "600" };
            const request = issuer(file, env), oldNow = Date.now;
            Date.now = () => now;
            try {
                const a = await request(), b = await request();
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
                verify((await request()).body, 3600);
                env.TURN_SECRET = "";
                assert.equal((await request()).status, 404);
                env.TURN_SECRET = secret;
                env.TURN_HOST = "";
                assert.equal((await request()).status, 404);
            } finally { Date.now = oldNow; }
        });
    }
});

describe("Cloudflare TURN credentials", () => {
    const env = { CLOUDFLARE_TURN_KEY_ID: "key-id", CLOUDFLARE_TURN_API_TOKEN: "api-token", TURN_TTL: "600" };
    it("mints per-visitor credentials through the API and drops port 53", async () => {
        const calls: any[] = [];
        const fetchImpl = async (url: string, init: any) => {
            calls.push({ url, init });
            return { ok: true, json: async () => ({ iceServers: [
                { urls: ["stun:stun.cloudflare.com:3478"] },
                { urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:53?transport=udp", "turns:turn.cloudflare.com:5349?transport=tcp", "turns:turn.cloudflare.com:443?transport=tcp"], username: "u1", credential: "c1" },
            ] }) };
        };
        const { status, body } = await issueTurnCredentials(env, fetchImpl, 1_800_000_000_000);
        assert.equal(status, 200);
        assert.equal(calls[0].url, "https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers");
        assert.equal(calls[0].init.headers.Authorization, "Bearer api-token");
        assert.deepEqual(JSON.parse(calls[0].init.body), { ttl: 600 });
        assert.deepEqual(body.urls, ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:5349?transport=tcp", "turns:turn.cloudflare.com:443?transport=tcp"]);
        assert.equal(body.username, "u1");
        assert.equal(body.expiresAt, 1_800_000_600);
        assert.ok(!JSON.stringify(body).includes("api-token"));
    });
    it("reports a provider failure without leaking details", async () => {
        const failing = async () => ({ ok: false, json: async () => ({ error: "bad token api-token" }) });
        const { status, body } = await issueTurnCredentials(env, failing);
        assert.equal(status, 502);
        assert.deepEqual(body, { success: false });
    });
    it("prefers Cloudflare over coturn and falls back to 404 with neither", async () => {
        const ok = async () => ({ ok: true, json: async () => ({ iceServers: { urls: "turn:turn.cloudflare.com:3478", username: "u", credential: "c" } }) });
        assert.equal((await issueTurnCredentials({ ...env, TURN_SECRET: "s", TURN_HOST: "h" }, ok)).body.username, "u");
        assert.equal((await issueTurnCredentials({}, ok)).status, 404);
    });
});
