import assert from "node:assert/strict";
import test from "node:test";
import {
    createSavedData,
    pageSavedTransport,
    storageSavedTransport,
} from "../src/saved.ts";

const declared = {
    settings: { scope: "visitor", stateVersion: 2, maxBytes: 64 },
    tally: { scope: "game", stateVersion: 1, maxBytes: 64 },
};
function memory(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => void values.set(k, v),
        removeItem: (k) => void values.delete(k),
    };
}
const entry = (stateVersion, value, revision = 1) =>
    JSON.stringify({ stateVersion, value, revision });
const migrate = {
    // 0: the raw string games kept before declarations. 1: { level } became { difficulty }.
    settings(old, from) {
        if (from === 0) old = JSON.parse(old);
        if (from > 2) return undefined;
        return { difficulty: old.difficulty ?? old.level ?? "pro" };
    },
};

test("a saved value comes back after a reload, at its version", async () => {
    const storage = memory();
    const first = createSavedData({
        declared,
        transport: storageSavedTransport(storage, "ace"),
    });
    assert.deepEqual(await first.get("settings"), {
        value: null,
        revision: 0,
        outcome: "empty",
    });
    assert.deepEqual(await first.set("settings", { difficulty: "ace" }), {
        ok: true,
        revision: 1,
    });
    const reloaded = createSavedData({
        declared,
        transport: storageSavedTransport(storage, "ace"),
    });
    assert.deepEqual(await reloaded.get("settings"), {
        value: { difficulty: "ace" },
        revision: 1,
        outcome: "current",
    });
    assert.equal(
        JSON.parse(storage.values.get("ace:saved:settings")).stateVersion,
        2
    );
});

test("an old save is migrated and kept at the new version", async () => {
    for (const [old, from] of [
        ['{"level":"rookie"}', 0],
        [{ level: "rookie" }, 1],
    ]) {
        const storage = memory({ "ace:saved:settings": entry(from, old, 3) });
        const outcomes = [];
        const saved = createSavedData({
            declared,
            migrate,
            transport: storageSavedTransport(storage, "ace"),
            report: (...args) => outcomes.push(args),
        });
        assert.deepEqual(await saved.get("settings"), {
            value: { difficulty: "rookie" },
            revision: 4,
            outcome: "migrated",
        });
        assert.deepEqual(JSON.parse(storage.values.get("ace:saved:settings")), {
            stateVersion: 2,
            value: { difficulty: "rookie" },
            revision: 4,
        });
        assert.deepEqual(outcomes, [["settings", "migrated", from]]);
    }
});

test("a save nothing can migrate resets on purpose and never throws", async () => {
    const cases = [
        [entry(0, "not json {"), migrate], // the hook throws
        [entry(9, { future: true }), migrate], // the hook declines a newer save
        [entry(1, { level: "pro" }), undefined], // no hook at all
        [entry(1, { level: "pro" }), { settings: () => ({ big: 1n }) }], // returns something unsaveable
    ];
    for (const [stored, hooks] of cases) {
        const storage = memory({ "ace:saved:settings": stored });
        const saved = createSavedData({
            declared,
            migrate: hooks,
            transport: storageSavedTransport(storage, "ace"),
        });
        const read = await saved.get("settings");
        assert.equal(read.value, null);
        assert.equal(read.outcome, "reset");
        // The old save is left alone until the game saves again.
        assert.equal(storage.values.get("ace:saved:settings"), stored);
    }
    const corrupt = createSavedData({
        declared,
        transport: storageSavedTransport(
            memory({ "ace:saved:settings": "{" }),
            "ace"
        ),
    });
    assert.equal((await corrupt.get("settings")).outcome, "empty");
});

test("refuses undeclared keys, non-JSON and oversized values before sending", async () => {
    let sent = 0;
    const saved = createSavedData({
        declared,
        transport: async () => (sent++, { ok: true, entry: null }),
    });
    assert.deepEqual(await saved.set("token", 1), {
        ok: false,
        reason: "undeclared",
    });
    assert.deepEqual(await saved.set("settings", "x".repeat(80)), {
        ok: false,
        reason: "too-large",
    });
    assert.deepEqual(await saved.set("settings", { n: 1n }), {
        ok: false,
        reason: "invalid",
    });
    assert.deepEqual(await saved.set("tally", 1), {
        ok: false,
        reason: "revision-required",
    });
    assert.equal((await saved.get("token")).outcome, "unavailable");
    assert.equal(sent, 0);
});

test("update retries when another writer got there first", async () => {
    const storage = memory();
    const transport = storageSavedTransport(storage, "ace");
    const ada = createSavedData({ declared, transport });
    let raced = false;
    // Bob reads, then Ada writes before Bob's write lands.
    const bob = createSavedData({
        declared,
        transport: async (request) => {
            if (request.op === "set" && !raced) {
                raced = true;
                await ada.update("tally", (n) => (n ?? 0) + 10);
            }
            return transport(request);
        },
    });
    const result = await bob.update("tally", (n) => (n ?? 0) + 1);
    assert.deepEqual(result, { ok: true, revision: 2, value: 11 });
    assert.deepEqual(await ada.set("tally", 0, { ifRevision: 1 }), {
        ok: false,
        reason: "conflict",
        current: { value: 11, revision: 2, outcome: "current" },
    });
});

test("an unreachable store is an answer, not an exception", async () => {
    const saved = createSavedData({
        declared,
        transport: async () => {
            throw new Error("offline");
        },
    });
    assert.deepEqual(await saved.get("settings"), {
        value: null,
        revision: 0,
        outcome: "unavailable",
        reason: "unavailable",
    });
    assert.deepEqual(await saved.set("settings", {}), {
        ok: false,
        reason: "unavailable",
    });
    assert.deepEqual(await saved.update("tally", () => 1), {
        ok: false,
        reason: "unavailable",
    });
});

test("page transport matches replies to requests and times out", async () => {
    const posted = [];
    let deliver;
    const transport = pageSavedTransport({
        prefix: "ace:",
        post: (m) => posted.push(m),
        listen: (l) => ((deliver = l), () => {}),
        timeoutMs: 20,
    });
    const a = transport({ op: "get", key: "settings" });
    const b = transport({
        op: "set",
        key: "settings",
        stateVersion: 2,
        value: 1,
    });
    assert.deepEqual(posted[1], {
        type: "ace:saved",
        request: 2,
        op: "set",
        key: "settings",
        stateVersion: 2,
        value: 1,
    });
    deliver({
        type: "ace:saved-result",
        request: 2,
        ok: true,
        entry: { stateVersion: 2, value: 1, revision: 1 },
    });
    deliver({ type: "ace:saved-result", request: 99, ok: true });
    deliver({ type: "garden:saved-result", request: 1, ok: true });
    assert.deepEqual(await b, {
        ok: true,
        entry: { stateVersion: 2, value: 1, revision: 1 },
    });
    assert.deepEqual(await a, { ok: false, reason: "unavailable" });
    transport.dispose();
});
