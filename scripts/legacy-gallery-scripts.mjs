#!/usr/bin/env node
/** Retired gallery scripts: inventory by default, reviewed per-field purge only. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile, open } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const digest = (text) => createHash("sha256").update(text).digest("hex");
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const stable = (value) => JSON.stringify(value, (_key, item) => record(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);

export function describeScripts(id, data) {
    if (!record(data.games)) return null;
    const fields = [];
    let scriptCount = 0;
    let codeBytes = 0;
    for (const [gameId, game] of Object.entries(data.games)) {
        if (!record(game) || !Object.hasOwn(game, "scripts")) continue;
        fields.push(["games", gameId, "scripts"]);
        for (const script of Object.values(record(game.scripts) ? game.scripts : {})) {
            scriptCount++;
            const code = typeof script === "string" ? script : script?.code;
            if (typeof code === "string") codeBytes += Buffer.byteLength(code);
        }
    }
    if (fields.length === 0) return null;
    fields.sort((a, b) => a[1].localeCompare(b[1]));
    return { id, fields, sha256: digest(stable(data.games)), scriptCount, codeBytes };
}

export async function inventoryScripts(db, projectId, documentIdField, now = new Date()) {
    const entries = [];
    let scanned = 0;
    let after;
    for (;;) {
        let query = db.collection("exhibits").orderBy(documentIdField).select("games").limit(200);
        if (after) query = query.startAfter(after);
        const snapshot = await query.get();
        for (const doc of snapshot.docs) {
            scanned++;
            const entry = describeScripts(doc.id, doc.data());
            if (entry) entries.push(entry);
        }
        if (snapshot.docs.length < 200) break;
        after = snapshot.docs[snapshot.docs.length - 1];
    }
    return { schemaVersion: 1, projectId, collection: "exhibits", createdAt: now.toISOString(), scanned, entries };
}

export function validateInventory(inventory, projectId) {
    if (inventory?.schemaVersion !== 1 || inventory.collection !== "exhibits" ||
        inventory.projectId !== projectId || !Array.isArray(inventory.entries)) {
        throw new Error("Inventory project or schema does not match");
    }
    const ids = new Set();
    for (const item of inventory.entries) {
        if (typeof item.id !== "string" || !item.id || item.id.includes("/") || ids.has(item.id) ||
            !/^[a-f0-9]{64}$/.test(item.sha256) || !Array.isArray(item.fields) || !item.fields.length ||
            item.fields.some((field) => !Array.isArray(field) || field.length !== 3 ||
                field[0] !== "games" || typeof field[1] !== "string" || !field[1] || field[2] !== "scripts")) {
            throw new Error("Inventory has an invalid or duplicate target");
        }
        ids.add(item.id);
    }
    return inventory;
}

function assertUnchanged(item, doc) {
    const current = doc.exists && describeScripts(item.id, doc.data());
    if (!current || current.sha256 !== item.sha256 || stable(current.fields) !== stable(item.fields)) {
        throw new Error(`Gallery ${item.id} changed since review; generate a new inventory`);
    }
}

export async function purgeScripts(db, inventory, options = {}) {
    const { apply = false, backup, fieldPath, deleteValue } = options;
    validateInventory(inventory, options.projectId);
    if (apply && (!backup || !fieldPath || !deleteValue)) throw new Error("Purge requires a durable backup and field helpers");
    // Read all targets before the first mutation so a stale review fails early.
    for (const item of inventory.entries) {
        assertUnchanged(item, await db.collection("exhibits").doc(item.id).get());
    }
    if (!apply) return { dryRun: true, galleries: inventory.entries.length, fields: inventory.entries.reduce((n, e) => n + e.fields.length, 0) };
    let purged = 0;
    for (const item of inventory.entries) {
        await db.runTransaction(async (transaction) => {
            const ref = db.collection("exhibits").doc(item.id);
            const doc = await transaction.get(ref);
            assertUnchanged(item, doc);
            // Persist before commit. Firestore retries may append identical backups.
            await backup({ id: item.id, projectId: inventory.projectId, games: doc.data().games, sha256: item.sha256 });
            transaction.update(ref, ...item.fields.flatMap((field) => [fieldPath(...field), deleteValue()]));
        });
        purged++;
    }
    return { dryRun: false, purged };
}

const usage = `Inventory (no writes to Firestore):
  node scripts/legacy-gallery-scripts.mjs --project PROJECT --output inventory.json
Review the inventory, then check it against current data:
  node scripts/legacy-gallery-scripts.mjs --project PROJECT --inventory inventory.json
Purge only the reviewed fields, with a private local backup:
  node scripts/legacy-gallery-scripts.mjs --project PROJECT --inventory inventory.json --apply --review-sha256 HASH --backup backup.jsonl
Uses Application Default Credentials; does not load application secrets or choose a default project.`;

async function main(args) {
    if (!args.length || args.includes("--help")) { console.log(usage); return; }
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const name = args[i];
        if (name === "--apply") { options.apply = true; continue; }
        if (!["--project", "--output", "--inventory", "--review-sha256", "--backup"].includes(name) || !args[i + 1] || args[i + 1].startsWith("--")) {
            throw new Error(`Invalid option: ${name}`);
        }
        if (Object.hasOwn(options, name)) throw new Error(`Duplicate option: ${name}`);
        options[name] = args[++i];
    }
    const projectId = options["--project"];
    if (!projectId || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId)) throw new Error("An explicit --project is required");
    if (!options["--inventory"] && (!options["--output"] || options.apply)) throw new Error("Inventory needs --output; purge needs --inventory");
    let inventory;
    if (options["--inventory"]) {
        const content = await readFile(options["--inventory"], "utf8");
        inventory = validateInventory(JSON.parse(content), projectId);
        if (options.apply && (options["--review-sha256"] !== digest(content) || !options["--backup"])) {
            throw new Error("Purge requires the exact reviewed inventory SHA-256 and a new --backup file");
        }
    }
    const require = createRequire(new URL("../frontend/package.json", import.meta.url));
    const admin = require("firebase-admin");
    const app = admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() }, "legacy-gallery-script-cleanup");
    const db = app.firestore();
    try {
        if (!inventory) {
            inventory = await inventoryScripts(db, projectId, admin.firestore.FieldPath.documentId());
            const content = JSON.stringify(inventory, null, 2) + "\n";
            await writeFile(options["--output"], content, { flag: "wx", mode: 0o600 });
            console.log(JSON.stringify({ dryRun: true, scanned: inventory.scanned, galleries: inventory.entries.length, inventory: options["--output"], reviewSha256: digest(content) }));
        } else {
            let backup;
            if (options.apply) backup = await open(options["--backup"], "wx", 0o600);
            try {
                console.log(JSON.stringify(await purgeScripts(db, inventory, {
                    projectId, apply: options.apply,
                    backup: backup ? async (entry) => { await backup.writeFile(JSON.stringify(entry) + "\n"); await backup.sync(); } : undefined,
                    fieldPath: (...parts) => new admin.firestore.FieldPath(...parts),
                    deleteValue: () => admin.firestore.FieldValue.delete(),
                })));
            } finally { await backup?.close(); }
        }
    } finally { await app.delete(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
