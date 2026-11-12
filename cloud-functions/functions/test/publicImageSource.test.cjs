const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const ts = require("typescript");

function loadTypeScript(relative, mocks = {}) {
    const filename = path.resolve(__dirname, "../src", relative);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = mod.require.bind(mod);
    mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : originalRequire(name);
    mod._compile(compiled, filename);
    return mod.exports;
}

function fixture(steps = [], dnsRecords = [{ address: "93.184.216.34", family: 4 }]) {
    const state = { requests: [], lookups: [], connected: 0, destroyed: 0, responses: [] };
    const dns = { lookup(host, options, callback) {
        state.lookups.push({ host, options });
        if (dnsRecords === null) return;
        process.nextTick(() => callback(null, typeof dnsRecords === "function" ? dnsRecords(host) : dnsRecords));
    } };
    const https = { request(url, options, receive) {
        const request = new EventEmitter();
        request.destroyed = false;
        request.destroy = () => { if (!request.destroyed) state.destroyed++; request.destroyed = true; };
        const index = state.requests.length;
        state.requests.push({ url: url.toString(), options });
        request.end = () => process.nextTick(() => {
            options.lookup(url.hostname, { all: true }, (error, addresses) => {
                if (request.destroyed) return;
                if (error) { request.emit("error", error); return; }
                state.connected++;
                const step = steps[index] || {};
                if (step.noResponse) return;
                const response = new PassThrough();
                response.statusCode = step.status || 200;
                response.headers = step.headers || {};
                state.responses.push(response);
                receive(response);
                if (step.stream) step.stream(response);
                else if (!response.destroyed) response.end(step.body || Buffer.from("image"));
            });
        });
        return request;
    } };
    return { state, ...loadTypeScript("utils/publicImageSource.ts", { dns, https }) };
}

test("rejects private, special-use, encoded and IPv6 transition destinations", async () => {
    const f = fixture();
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "172.16.0.1", "192.168.0.1", "192.0.2.1", "192.88.99.1", "198.18.0.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "::127.0.0.1", "fc00::1", "fe80::1", "64:ff9b::a00:1", "64:ff9b:1::1", "2001:db8::1", "2002:7f00:1::", "3fff::1"]) {
        assert.equal(f.isPublicAddress(address), false, address);
    }
    for (const address of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"]) assert.equal(f.isPublicAddress(address), true);
    for (const url of ["https://127.1/image", "https://2130706433/image", "https://0x7f000001/image", "https://[::ffff:127.0.0.1]/", "http://example.com/a", "file:///etc/passwd", "https://user:password@example.com/a", "ftp://example.com/a"]) {
        await assert.rejects(f.readPublicImageSource(url), /public|Invalid|HTTPS/);
    }
    assert.equal(f.state.requests.length, 0);
});

test("checks every DNS result in the socket lookup and refuses mixed DNS answers", async () => {
    for (const records of [[], [{ address: "127.0.0.1", family: 4 }], [{ address: "93.184.216.34", family: 4 }, { address: "fe80::1", family: 6 }]]) {
        const f = fixture([], records);
        await assert.rejects(f.readPublicImageSource("https://images.example/a"), /not public/);
        assert.equal(f.state.connected, 0);
        assert.equal(f.state.lookups.length, 1);
        assert.equal(f.state.lookups[0].options.all, true);
    }
});

test("downloads public images without credential headers or socket reuse", async () => {
    const f = fixture([{ body: Buffer.from("abc") }]);
    assert.equal((await f.readPublicImageSource("https://images.example/a")).toString(), "abc");
    assert.equal(f.state.requests[0].options.agent, false);
    assert.deepEqual(f.state.requests[0].options.headers, { accept: "image/*", "accept-encoding": "identity" });
});

test("revalidates redirect hosts, rejects downgrade/private redirect and loops", async () => {
    for (const location of ["https://169.254.169.254/metadata", "https://[::1]/", "http://images.example/a", "https://user:pass@images.example/a"]) {
        const f = fixture([{ status: 302, headers: { location } }]);
        await assert.rejects(f.readPublicImageSource("https://images.example/a"), /public|HTTPS/);
        assert.equal(f.state.connected, 1);
    }
    const privateDns = fixture([{ status: 302, headers: { location: "https://rebind.example/a" } }], (host) => [{ address: host === "rebind.example" ? "10.0.0.1" : "93.184.216.34", family: 4 }]);
    await assert.rejects(privateDns.readPublicImageSource("https://images.example/a"), /not public/);
    assert.equal(privateDns.state.connected, 1);
    const loop = fixture([{ status: 302, headers: { location: "/again" } }, { status: 302, headers: { location: "/again" } }]);
    await assert.rejects(loop.readPublicImageSource("https://images.example/a", { maxRedirects: 1 }), /Too many/);
    const relative = fixture([{ status: 302, headers: { location: "/next" } }, { body: Buffer.from("ok") }]);
    assert.equal((await relative.readPublicImageSource("https://images.example/a")).toString(), "ok");
    assert.equal(relative.state.requests[1].url, "https://images.example/next");
});

test("same-host redirects resolve again and cannot rebind to a private address", async () => {
    let lookups = 0;
    const f = fixture([{ status: 302, headers: { location: "/second" } }], () => [{
        address: ++lookups === 1 ? "93.184.216.34" : "169.254.169.254", family: 4,
    }]);
    await assert.rejects(f.readPublicImageSource("https://images.example/first"), /not public/);
    assert.equal(lookups, 2);
    assert.equal(f.state.connected, 1);
});

test("caps declared and streamed body bytes and rejects encoded/error bodies", async () => {
    for (const step of [
        { headers: { "content-length": "100" } },
        { stream(response) { response.write(Buffer.alloc(3)); response.end(Buffer.alloc(3)); } },
    ]) {
        const f = fixture([step]);
        await assert.rejects(f.readPublicImageSource("https://images.example/a", { maxBytes: 5 }), /too large/);
        assert.equal(f.state.destroyed, 1);
    }
    const encoded = fixture([{ headers: { "content-encoding": "gzip" } }]);
    await assert.rejects(encoded.readPublicImageSource("https://images.example/a"), /Encoded/);
    const error = fixture([{ status: 404 }]);
    await assert.rejects(error.readPublicImageSource("https://images.example/a"), /download failed/);
});

test("absolute deadline covers stalled DNS and continuously active downloads", async () => {
    const dns = fixture([], null);
    await assert.rejects(dns.readPublicImageSource("https://images.example/a", { timeoutMs: 20 }), /timed out/);
    assert.equal(dns.state.destroyed, 1);
    const active = fixture([{ stream(response) {
        const interval = setInterval(() => response.write("x"), 2);
        response.on("close", () => clearInterval(interval));
    } }]);
    await assert.rejects(active.readPublicImageSource("https://images.example/a", { timeoutMs: 20 }), /timed out/);
    assert.equal(active.state.destroyed, 1);
});

test("preserves bounded raster screenshot data URLs without network requests", async () => {
    const f = fixture();
    assert.equal((await f.readPublicImageSource("data:image/jpeg;base64,YWJj")).toString(), "abc");
    for (const value of ["data:text/plain;base64,YWJj", "data:image/svg+xml;base64,YWJj", "data:image/png;base64,abc!", "data:image/png,abc"]) {
        await assert.rejects(f.readPublicImageSource(value), /Invalid/);
    }
    await assert.rejects(f.readPublicImageSource("data:image/png;base64,YWJj", { maxBytes: 2 }), /too large/);
    assert.equal(f.state.requests.length, 0);
});

test("Pinata receives validated bytes, and a blocked source is never pinned", async () => {
    let pinned = 0;
    let blocked = false;
    class Pinata {
        async pinFileToIPFS(stream) {
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            assert.equal(Buffer.concat(chunks).toString(), "safe");
            pinned++;
            return { IpfsHash: "verified" };
        }
    }
    const api = loadTypeScript("utils/ipfsUpload.ts", {
        "firebase-functions/logger": { info() {}, error() {} },
        "@pinata/sdk": Pinata,
        "./mimeUtils": { mimetoExt: { "image/jpeg": "jpg" } },
        "./publicImageSource": { async readPublicImageSource() {
            if (blocked) throw new Error("blocked");
            return Buffer.from("safe");
        } },
    });
    await api.uploadPinata("https://images.example/a", "test");
    assert.equal(pinned, 1);
    blocked = true;
    assert.equal(await api.uploadPinata("https://private.example/a", "test"), null);
    assert.equal(pinned, 1);
});
