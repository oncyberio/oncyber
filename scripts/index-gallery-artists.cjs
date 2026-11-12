#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");
const admin = require("firebase-admin");
const { readGallerySelection, remainingSelection } = require("./gallery-selection.cjs");
const {
    indexGallery,
    firestoreCache,
    createOpenSea,
} = require("../cloud-functions/artist-index/indexer");
const {
    VERSION,
    defaultRegistry,
    hash,
    normalizeArtist,
    validateRegistry,
} = require("../cloud-functions/artist-index/core");
const { values } = parseArgs({
    options: {
        project: { type: "string" },
        env: { type: "string" },
        apply: { type: "boolean", default: false },
        all: { type: "boolean", default: false },
        limit: { type: "string", default: "25" },
        "page-size": { type: "string", default: "20" },
        after: { type: "string" },
        gallery: { type: "string" },
        manifest: { type: "string" },
        checkpoint: { type: "string" },
        report: { type: "string" },
        registry: { type: "string" },
        force: { type: "boolean", default: false },
        "stored-only": { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", default: false },
    },
});
const HELP = `Index artists whose artworks are displayed in public Oncyber galleries.

node scripts/index-gallery-artists.cjs --project PROJECT --env frontend/.env.local [options]

Default: dry-run 25 galleries; reads Firestore/OpenSea, writes only the local report.
  --apply                 Write derived artistSearch fields and provider cache
  --all                   Scan all galleries (default --limit 25)
  --limit N               Maximum galleries this run (including skipped/private rows)
  --gallery ID            Process one gallery
  --manifest FILE         Process a frozen ranked selection (use --all for every selected ID)
  --page-size N           Bounded Firestore page size, 1–100 (default 20)
  --checkpoint FILE       Resume file, separate for dry-run/apply/project/config
  --report FILE           Append JSONL report (default /tmp/oncyber-artists-PROJECT-MODE.jsonl)
  --after ID              Initial Firestore document-ID cursor
  --registry FILE         Artist aliases and evidence-backed attribution overrides
  --force                 Rebuild galleries already indexed with this config
  --stored-only           Index saved creator metadata without OpenSea enrichment
  --dry-run               Explicit read-only mode (incompatible with --apply)

OpenSea: OPENSEA_API_KEY, falling back to the existing frontend/env.ts application key.
Firebase: ADC, or FIREBASE_ADMIN_* / DB_ADMIN_*.
An explicit project is always required. No NFT owners or collection owners are
inferred to be artists. Review unresolved entries before claiming full coverage.
`;
function atomicJSON(file, data) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n", {
        mode: 0o600,
    });
    fs.renameSync(file + ".tmp", file);
}
function getOpenSeaKey() {
    if (process.env.OPENSEA_API_KEY) return process.env.OPENSEA_API_KEY;
    // Reuse the existing application credential for local backfills. Do not
    // import the frontend config (which has browser/build-time dependencies),
    // copy its literal into this script, or print its value.
    const existingConfig = path.resolve(__dirname, "../frontend/env.ts");
    if (!fs.existsSync(existingConfig)) return "";
    return (
        fs
            .readFileSync(existingConfig, "utf8")
            .match(/\bOPENSEA_X_API_KEY\s*:\s*(['"])([^'"\r\n]+)\1/)?.[2] || ""
    );
}
async function main() {
    if (values.help) return console.log(HELP);
    if (!values.project)
        throw new Error("Specify --project explicitly; use --help for options");
    if (!/^[a-z][a-z\d-]{4,62}$/.test(values.project))
        throw new Error("Invalid project ID");
    if (values.apply && values["dry-run"])
        throw new Error("--apply and --dry-run cannot be combined");
    if (values.env)
        require("dotenv").config({ path: path.resolve(values.env) });
    const openSeaKey = values["stored-only"] ? "" : getOpenSeaKey();
    if (!values["stored-only"] && !openSeaKey)
        throw new Error(
            "Set OPENSEA_API_KEY (no existing application key was found), or use --stored-only to audit saved metadata"
        );
    const pageSize = Number(values["page-size"]),
        limit = values.all ? Infinity : Number(values.limit);
    if (
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100 ||
        (!values.all && (!Number.isInteger(limit) || limit < 1))
    )
        throw new Error("Invalid page size or limit");
    if ([values.gallery, values.after].some((id) => id && id.includes("/")))
        throw new Error("Gallery IDs must not contain slashes");
    if (values.gallery && (values.all || values.after || values.checkpoint))
        throw new Error(
            "--gallery cannot be combined with scan/cursor/checkpoint options"
        );
    if (values.manifest && (values.gallery || values.after))
        throw new Error("--manifest cannot be combined with --gallery or --after");
    const selection = values.manifest
        ? readGallerySelection(values.manifest, values.project)
        : null;
    const registry = values.registry
        ? JSON.parse(fs.readFileSync(values.registry, "utf8"))
        : defaultRegistry;
    validateRegistry(registry);
    const mode = values.apply ? "apply" : "dry-run";
    const config = hash({
        project: values.project,
        mode,
        storedOnly: !!values["stored-only"],
        registry,
        version: VERSION,
        force: !!values.force,
        ...(selection ? { selection } : {}),
    });
    const reportPath =
        values.report || `/tmp/oncyber-artists-${values.project}-${mode}.jsonl`;
    const checkpointPath = values.checkpoint;
    const checkpoint =
        checkpointPath && fs.existsSync(checkpointPath)
            ? JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
            : null;
    if (checkpoint && checkpoint.config !== config)
        throw new Error(
            "Checkpoint belongs to a different project, mode, or registry; choose a new file"
        );
    if (checkpoint && values.after)
        throw new Error("Use either an existing checkpoint or --after");
    let after = checkpoint?.lastId || values.after || "";
    const env = process.env;
    const prefix = env.FIREBASE_ADMIN_CLIENT_EMAIL
        ? "FIREBASE_ADMIN_"
        : "DB_ADMIN_";
    let credential;
    if (env[prefix + "CLIENT_EMAIL"] && env[prefix + "PRIVATE_KEY"]) {
        if (env[prefix + "PROJECT_ID"] !== values.project)
            throw new Error("Service-account project does not match --project");
        credential = admin.credential.cert({
            projectId: values.project,
            clientEmail: env[prefix + "CLIENT_EMAIL"],
            privateKey: env[prefix + "PRIVATE_KEY"].replace(/\\n/g, "\n"),
        });
    } else credential = admin.credential.applicationDefault();
    const app = admin.initializeApp({ projectId: values.project, credential });
    const db = app.firestore();
    const provider = createOpenSea({
        apiKey: openSeaKey,
        cache: firestoreCache(db, values.apply),
    });
    const summary = {
        mode,
        project: values.project,
        scanned: 0,
        indexed: 0,
        previewed: 0,
        deleted: 0,
        unchanged: 0,
        unresolvedArtworks: 0,
        truncatedGalleries: 0,
        priorityMatches: Object.fromEntries(
            registry.artists.map((artist) => [artist.name, 0])
        ),
    };
    fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
    let interrupted = false;
    const stop = () => {
        interrupted = true;
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    async function processGallery(ref) {
        let result;
        for (let retry = 0; retry < 3; retry++) {
            result = await indexGallery({
                db,
                ref,
                provider,
                registry,
                apply: values.apply,
                force: values.force,
                storedOnly: values["stored-only"],
            });
            if (result.status !== "changed-during-indexing") break;
        }
        if (result.status === "changed-during-indexing")
            throw new Error(
                `Gallery ${ref.id} kept changing; resume this checkpoint later`
            );
        fs.appendFileSync(
            reportPath,
            JSON.stringify({ galleryId: ref.id, ...result }) + "\n",
            { mode: 0o600 }
        );
        summary.scanned++;
        if (result.status === "unchanged") summary.unchanged++;
        else if (result.status === "preview") summary.previewed++;
        else if (result.status === "deleted") summary.deleted++;
        else summary.indexed++;
        summary.unresolvedArtworks += result.index?.unresolvedCount || 0;
        if (result.index?.truncated) summary.truncatedGalleries++;
        for (const artist of registry.artists)
            if (
                (result.index?.names || []).some((name) =>
                    [artist.name, ...artist.aliases].some(
                        (alias) =>
                            normalizeArtist(alias) === normalizeArtist(name)
                    )
                )
            )
                summary.priorityMatches[artist.name]++;
        after = ref.id;
        // Checkpoint advances only after a successful conditional write (or dry-run).
        if (checkpointPath)
            atomicJSON(checkpointPath, {
                config,
                project: values.project,
                mode,
                lastId: after,
                updatedAt: new Date().toISOString(),
            });
    }
    try {
        if (values.gallery)
            await processGallery(db.collection("exhibits").doc(values.gallery));
        else if (selection) {
            for (const id of remainingSelection(selection, after)) {
                if (interrupted || summary.scanned >= limit) break;
                await processGallery(db.collection("exhibits").doc(id));
                console.log(JSON.stringify({scanned: summary.scanned, selected: selection.length, lastId: after, ...provider.stats}));
            }
        } else
            while (!interrupted && summary.scanned < limit) {
                let query = db
                    .collection("exhibits")
                    .orderBy(admin.firestore.FieldPath.documentId())
                    .select()
                    .limit(Math.min(pageSize, limit - summary.scanned));
                if (after) query = query.startAfter(after);
                const batch = await query.get();
                if (batch.empty) break;
                for (const doc of batch.docs) {
                    if (interrupted) break;
                    await processGallery(doc.ref);
                }
                console.log(
                    JSON.stringify({
                        scanned: summary.scanned,
                        lastId: after,
                        ...provider.stats,
                    })
                );
                if (batch.size < pageSize) break;
            }
        console.log(
            JSON.stringify(
                {
                    ...summary,
                    ...provider.stats,
                    interrupted,
                    lastId: after,
                    report: reportPath,
                },
                null,
                2
            )
        );
        if (interrupted) process.exitCode = 130;
    } finally {
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", stop);
        await app.delete();
    }
}
if (require.main === module)
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
module.exports = { atomicJSON };
