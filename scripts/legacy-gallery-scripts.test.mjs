import test from "node:test";
import assert from "node:assert/strict";
import { describeScripts, inventoryScripts, purgeScripts, validateInventory } from "./legacy-gallery-scripts.mjs";

function database(seed) {
    const docs = new Map(Object.entries(structuredClone(seed)));
    const writes = [];
    const events = [];
    const ref = (id) => ({ id, get: async () => ({ id, exists: docs.has(id), data: () => structuredClone(docs.get(id)) }) });
    return { docs, writes, events, collection(name) {
        assert.equal(name, "exhibits");
        return { doc: ref, orderBy: () => ({ select: () => ({ limit: () => ({ get: async () => ({ docs: await Promise.all([...docs.keys()].map(id => ref(id).get())) }) }) }) }) };
    }, async runTransaction(callback) {
        return callback({ get: (r) => r.get(), update(r, ...args) {
            events.push("write");
            writes.push(args);
            for (let i = 0; i < args.length; i += 2) {
                const [scope, gameId, field] = args[i];
                delete docs.get(r.id)[scope][gameId][field];
            }
        } });
    } };
}
const fixture = { gallery: { info: { title: "A gallery" }, games: { default: { name: "old", scripts: { main: { code: "DO_NOT_EXECUTE" }, a: "old format" } } }, runtime: { release: "keep" }, artworks: { a: {} } }, clean: { artworks: { a: {} } } };

test("inventory is code-free and dry-run does not change gallery or runtime content", async () => {
    const db = database(fixture);
    const report = await inventoryScripts(db, "project-a", "__name__");
    assert.equal(report.scanned, 2);
    assert.equal(report.entries.length, 1);
    assert.equal(report.entries[0].scriptCount, 2);
    assert.ok(!JSON.stringify(report).includes("DO_NOT_EXECUTE"));
    assert.equal((await purgeScripts(db, report, { projectId: "project-a" })).dryRun, true);
    assert.equal(db.writes.length, 0);
    assert.deepEqual(db.docs.get("gallery"), fixture.gallery);
});

test("apply backs up before commit and removes only reviewed script fields", async () => {
    const db = database(fixture);
    const report = await inventoryScripts(db, "project-a", "__name__");
    const backups = [];
    assert.deepEqual(await purgeScripts(db, report, { projectId: "project-a", apply: true,
        backup: async (entry) => { db.events.push("backup"); backups.push(entry); },
        fieldPath: (...parts) => parts, deleteValue: () => "DELETE",
    }), { dryRun: false, purged: 1 });
    assert.deepEqual(db.events, ["backup", "write"]);
    assert.deepEqual(backups[0].games, fixture.gallery.games);
    assert.deepEqual(db.docs.get("gallery"), { ...fixture.gallery, games: { default: { name: "old" } } });
    assert.deepEqual(db.docs.get("clean"), fixture.clean);
});

test("wrong project, broadened fields, changed code and backup failures cannot mutate data", async () => {
    const db = database(fixture);
    const report = await inventoryScripts(db, "project-a", "__name__");
    assert.throws(() => validateInventory(report, "project-b"), /project/);
    const broadened = structuredClone(report);
    broadened.entries[0].fields = [["runtime", "default", "scripts"]];
    assert.throws(() => validateInventory(broadened, "project-a"), /invalid/);
    await assert.rejects(purgeScripts(db, report, { projectId: "project-a", apply: true }), /backup/);
    await assert.rejects(purgeScripts(db, report, { projectId: "project-a", apply: true,
        backup: async () => { throw new Error("disk failed"); }, fieldPath: (...p) => p, deleteValue: () => "DELETE" }), /disk failed/);
    db.docs.get("gallery").games.default.scripts.main.code = "changed";
    await assert.rejects(purgeScripts(db, report, { projectId: "project-a" }), /changed since review/);
    assert.equal(db.writes.length, 0);
    assert.notEqual(describeScripts("gallery", db.docs.get("gallery")).sha256, report.entries[0].sha256);
});
