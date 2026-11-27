import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
    challengeOf,
    loginLink,
    newLogin,
    pendingLogin,
    PENDING_LOGIN_MS,
} from "./world-login.mjs";

test("a sign-in keeps a secret and sends only its digest", () => {
    const first = newLogin();
    const second = newLogin();
    assert.notEqual(first.verifier, second.verifier);
    assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(
        first.challenge,
        createHash("sha256").update(first.verifier).digest("base64url")
    );
    assert.equal(challengeOf(first.verifier), first.challenge);
    const link = loginLink("https://example.test", first.challenge);
    assert.equal(
        link,
        `https://example.test/cli-auth?challenge=${first.challenge}`
    );
    assert.ok(!link.includes(first.verifier));
});

test("a code is taken only for the sign-in started here, for this site, lately", () => {
    const login = newLogin(1000);
    const saved = { ...login, baseUrl: "https://example.test" };
    assert.deepEqual(pendingLogin(saved, "https://example.test", 2000), {
        verifier: login.verifier,
    });
    assert.match(
        pendingLogin(null, "https://example.test").error,
        /No sign-in was started/
    );
    assert.match(
        pendingLogin(saved, "https://other.test", 2000).error,
        /was for https:\/\/example\.test/
    );
    assert.match(
        pendingLogin(saved, "https://example.test", 1000 + PENDING_LOGIN_MS + 1)
            .error,
        /too old/
    );
});
