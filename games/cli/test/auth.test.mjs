import assert from "node:assert/strict";
import {
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
    DEFAULT_BASE_URL,
    baseUrl,
    credentialsPath,
    forgetCredentials,
    login,
    readCredentials,
    saveCredentials,
    sessionToken,
} from "../lib/auth.mjs";
import { createSite } from "../lib/site.mjs";
import { createStandin } from "./standin.mjs";

const home = mkdtempSync(join(tmpdir(), "oncyber-home-"));
after(() => rmSync(home, { recursive: true, force: true }));
const path = credentialsPath(home);

test("the site is ONCYBER_BASE_URL, https://oncyber.io when unset", () => {
    assert.equal(baseUrl({}), "https://oncyber.io");
    assert.equal(DEFAULT_BASE_URL, "https://oncyber.io");
    assert.equal(
        baseUrl({ ONCYBER_BASE_URL: "http://localhost:13000/" }),
        "http://localhost:13000"
    );
    assert.throws(
        () => baseUrl({ ONCYBER_BASE_URL: "not a url" }),
        /not a URL/
    );
    assert.throws(
        () => baseUrl({ ONCYBER_BASE_URL: "ftp://x" }),
        /http or https/
    );
});

test("a login is saved to ~/.oncyber/credentials.json, readable by its owner only", () => {
    assert.equal(path, join(home, ".oncyber", "credentials.json"));
    // An older, wider file is narrowed too.
    saveCredentials(
        { token: "t0", userId: "u", baseUrl: "https://oncyber.io" },
        path
    );
    writeFileSync(path, "{}", { mode: 0o644 });
    saveCredentials(
        {
            token: "saved-token",
            userId: "account-1",
            baseUrl: "https://oncyber.io",
        },
        path
    );
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
        token: "saved-token",
        userId: "account-1",
        baseUrl: "https://oncyber.io",
    });
    assert.equal(readCredentials(path).token, "saved-token");
});

test("ONCYBER_SESSION_TOKEN stands in for a saved login; a saved one is for its own site", () => {
    assert.equal(
        sessionToken({ env: { ONCYBER_SESSION_TOKEN: "from-env" }, path }),
        "from-env"
    );
    assert.equal(sessionToken({ env: {}, path }), "saved-token");
    assert.equal(
        sessionToken({
            env: { ONCYBER_BASE_URL: "http://localhost:13000" },
            path,
        }),
        null
    );
    assert.equal(
        sessionToken({ env: {}, path: join(home, "none.json") }),
        null
    );
    assert.equal(forgetCredentials(path), true);
    assert.equal(forgetCredentials(path), false);
    assert.equal(sessionToken({ env: {}, path }), null);
});

test("login: the browser comes back with a code, the code is exchanged, the token saved", async () => {
    const standin = await createStandin();
    try {
        const connection = createSite({ baseUrl: standin.url });
        const rpc = (service, method, input) =>
            connection.rpc(service, method, input, { auth: false });
        const opened = [];
        // The browser's part: follow the page's redirect to the callback.
        const browser = (code, tamper) => async (url) => {
            opened.push(url);
            const auth = new URL(url);
            const back = new URL(auth.searchParams.get("callback"));
            back.searchParams.set(
                "state",
                tamper ?? auth.searchParams.get("state")
            );
            back.searchParams.set("code", code);
            await fetch(back).catch(() => {});
        };
        const done = await login({
            site: standin.url,
            rpc,
            log: () => {},
            open: browser("good-code"),
            path,
        });
        assert.equal(done.userId, "account-1");
        assert.equal(statSync(path).mode & 0o777, 0o600);
        assert.deepEqual(readCredentials(path), {
            token: "test-token",
            userId: "account-1",
            baseUrl: standin.url,
        });
        const auth = new URL(opened[0]);
        assert.equal(auth.origin + auth.pathname, `${standin.url}/cli-auth`);
        assert.match(auth.searchParams.get("state"), /^[0-9a-f]{32}$/);
        assert.match(
            auth.searchParams.get("callback"),
            /^http:\/\/localhost:\d+\/callback$/
        );
        // The saved login is for that site.
        assert.equal(
            sessionToken({ env: { ONCYBER_BASE_URL: standin.url }, path }),
            "test-token"
        );
        assert.equal(sessionToken({ env: {}, path }), null);

        forgetCredentials(path);
        await assert.rejects(
            login({
                site: standin.url,
                rpc,
                log: () => {},
                open: browser("good-code", "wrong-state"),
                path,
            }),
            /without a valid code/
        );
        await assert.rejects(
            login({
                site: standin.url,
                rpc,
                log: () => {},
                open: browser("used-code"),
                path,
            }),
            /Invalid or already-used code/
        );
        await assert.rejects(
            login({
                site: standin.url,
                rpc,
                log: () => {},
                open: () => {},
                path,
                timeoutMs: 50,
            }),
            /timed out/
        );
        assert.equal(readCredentials(path), null);
    } finally {
        await standin.close();
    }
});
