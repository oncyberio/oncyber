import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
    createSavedData,
    storageSavedTransport,
} from "../../runtime/src/saved.ts";
import { MIGRATE, readFormat, readSettings, readTally } from "../src/saved.js";

const declared = JSON.parse(
    readFileSync(new URL("../game.json", import.meta.url))
).saved;
function store(initial = {}) {
    const values = new Map(Object.entries(initial));
    const storage = {
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => void values.set(k, v),
        removeItem: (k) => void values.delete(k),
    };
    return createSavedData({
        declared,
        migrate: MIGRATE,
        transport: storageSavedTransport(storage, "ace"),
    });
}
const old = (value) => JSON.stringify({ stateVersion: 0, value, revision: 1 });

test("settings and sound saved before declarations are migrated", async () => {
    const saved = store({
        "ace:saved:settings": old('{"difficulty":"rookie","games":3}'),
        "ace:saved:muted": old("1"),
    });
    assert.deepEqual(await saved.get("settings"), {
        value: { difficulty: "rookie", games: 3 },
        revision: 2,
        outcome: "migrated",
    });
    assert.deepEqual(await saved.get("muted"), {
        value: true,
        revision: 2,
        outcome: "migrated",
    });
});

test("a broken or future save resets to defaults", async () => {
    const saved = store({
        "ace:saved:settings": old("{oops"),
        "ace:saved:muted": JSON.stringify({
            stateVersion: 7,
            value: { on: 1 },
            revision: 1,
        }),
    });
    const settings = await saved.get("settings");
    assert.equal(settings.outcome, "reset");
    assert.deepEqual(readSettings(settings.value), {
        difficulty: "pro",
        games: 2,
    });
    assert.equal((await saved.get("muted")).outcome, "reset");
});

test("every declared sample fits its key and reads back", async () => {
    const saved = store();
    for (const [key, d] of Object.entries(declared)) {
        const write = await saved.update(key, () => d.sample);
        assert.equal(write.ok, true, key);
        assert.deepEqual((await saved.get(key)).value, d.sample);
    }
});

test("shared values are read defensively", () => {
    assert.equal(readTally({ matches: 4 }), 4);
    assert.equal(readTally({ matches: -1 }), 0);
    assert.equal(readTally("lots"), 0);
    assert.equal(readFormat({ format: "singles" }), "singles");
    assert.equal(readFormat({ format: 3 }), null);
    assert.deepEqual(readSettings({ difficulty: "toString", games: 9 }), {
        difficulty: "pro",
        games: 2,
    });
});
