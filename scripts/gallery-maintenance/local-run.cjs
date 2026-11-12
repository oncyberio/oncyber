#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { spawnSync } = require("node:child_process");
const admin = require("firebase-admin");
const { runLocalBatch, limitsFrom } = require("./local-batch.cjs");
const { readGallerySelection } = require("../gallery-selection.cjs");
const { values } = parseArgs({ options: {
    project: { type: "string" }, bucket: { type: "string" }, run: { type: "string" },
    manifest: { type: "string" }, env: { type: "string" }, report: { type: "string" },
    "task-index": { type: "string", default: "0" }, after: { type: "string" },
    "retry-gallery": { type: "string" },
    apply: { type: "boolean", default: false },
    "artists-only": { type: "boolean", default: false }, "stored-only": { type: "boolean", default: false },
    ...Object.fromEntries(["galleries", "artworks", "requests", "seconds", "scans"].map(k => [`max-${k}`, { type: "string" }])),
} });
async function main() {
    if (process.env.CLOUD_RUN_JOB || process.env.K_SERVICE) throw Error("Bounded batch runner is local-only");
    for (const key of ["project", "bucket", "run", "manifest", "report"]) if (!values[key]) throw Error(`Explicit --${key} is required`);
    if (!/^[\w-]+$/.test(values.run)) throw Error("Invalid run ID");
    const limits = limitsFrom(values);
    // Require cloud workers to be stopped before reusing their gallery checkpoints.
    const check = spawnSync("gcloud", ["run", "jobs", "executions", "list", "--project=" + values.project,
        "--region=us-central1", "--format=json(metadata.name,status.completionTime)", "--limit=100"], { encoding: "utf8" });
    if (check.status !== 0) throw Error("Cannot verify cloud backfills are stopped: " + check.stderr);
    if (JSON.parse(check.stdout).some(e => e.metadata.name.startsWith("gallery-") && !e.status?.completionTime)) {
        throw Error("A cloud gallery execution is still active; stop it before local resume");
    }
    if (values.env) require("dotenv").config({ path: values.env });
    const e = process.env;
    if (e.FIREBASE_ADMIN_PROJECT_ID && e.FIREBASE_ADMIN_PROJECT_ID !== values.project) throw Error("Service-account project mismatch");
    const app = admin.initializeApp({ projectId: values.project, storageBucket: values.bucket,
        ...(e.FIREBASE_ADMIN_PRIVATE_KEY ? { credential: admin.credential.cert({
            projectId: e.FIREBASE_ADMIN_PROJECT_ID, clientEmail: e.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: e.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }) } : {}),
    });
    const lockPath = path.join(require("node:os").tmpdir(), `oncyber-gallery-local-${values.project}.lock`);
    let lock;
    try { lock = fs.openSync(lockPath, "wx", 0o600); fs.writeSync(lock, String(process.pid)); }
    catch { await app.delete(); throw Error(`Local batch lock exists: ${lockPath}. Check its PID before removing a stale lock.`); }
    let stop = false;
    process.on("SIGTERM", () => { stop = true; });
    process.on("SIGINT", () => { stop = true; });
    try {
        const apiKey = values["stored-only"] ? "" : e.OPENSEA_API_KEY || fs.readFileSync(path.join(__dirname, "../../frontend/env.ts"), "utf8")
            .match(/\bOPENSEA_X_API_KEY\s*:\s*(['"])([^'"\r\n]+)\1/)?.[2];
        if (!apiKey && !values["stored-only"]) throw Error("OpenSea key required");
        await runLocalBatch({ db: app.firestore(), bucket: app.storage().bucket(),
            ids: readGallerySelection(values.manifest, values.project), values, apiKey, limits,
            stopped: () => stop,
            report: (entry) => { const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
                fs.appendFileSync(values.report, line + "\n", { mode: 0o600 }); console.log(line); },
        });
    } finally {
        try { await app.delete(); } finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
