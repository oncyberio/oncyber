#!/usr/bin/env node
const fs = require("node:fs");
const { parseArgs } = require("node:util");
const admin = require("firebase-admin");
const {
    indexGallery,
    createOpenSea,
    firestoreCache,
} = require("../../cloud-functions/artist-index/indexer");
const {
    isPublicGallery,
    artworkInputs,
    hash,
} = require("../../cloud-functions/artist-index/core");
const { repairArtwork } = require("./media.cjs");
const { readGallerySelection } = require("../gallery-selection.cjs");
const { runConfig, bindRun } = require("./config.cjs");

const { values } = parseArgs({
    options: {
        project: { type: "string" },
        manifest: { type: "string" },
        bucket: { type: "string" },
        run: { type: "string" },
        env: { type: "string" },
        apply: { type: "boolean", default: false },
        gallery: { type: "string" },
        artwork: { type: "string" },
        "asset-limit": { type: "string" },
        "artists-only": { type: "boolean", default: false },
        "stored-only": { type: "boolean", default: false },
    },
});
async function main() {
    if (
        !values.project ||
        !values.bucket ||
        !values.run ||
        !/^[a-zA-Z0-9_-]+$/.test(values.run)
    )
        throw Error("Explicit --project, --bucket and --run are required");
    if (values.env) require("dotenv").config({ path: values.env });
    const e = process.env;
    const app = admin.initializeApp({
        projectId: values.project,
        storageBucket: values.bucket,
        ...(e.FIREBASE_ADMIN_PRIVATE_KEY
            ? {
                  credential: admin.credential.cert({
                      projectId: e.FIREBASE_ADMIN_PROJECT_ID,
                      clientEmail: e.FIREBASE_ADMIN_CLIENT_EMAIL,
                      privateKey: e.FIREBASE_ADMIN_PRIVATE_KEY.replace(
                          /\\n/g,
                          "\n"
                      ),
                  }),
              }
            : {}),
    });
    if (
        e.FIREBASE_ADMIN_PROJECT_ID &&
        e.FIREBASE_ADMIN_PROJECT_ID !== values.project
    )
        throw Error("Service-account project mismatch");
    const db = app.firestore(),
        bucket = app.storage().bucket();
    const apiKey = values["stored-only"]
        ? ""
        : e.OPENSEA_API_KEY ||
          fs
              .readFileSync(
                  require("node:path").join(__dirname, "../../frontend/env.ts"),
                  "utf8"
              )
              .match(/\bOPENSEA_X_API_KEY\s*:\s*(['"])([^'"\r\n]+)\1/)?.[2];
    if (!apiKey && !values["stored-only"]) throw Error("OpenSea key required");
    const provider = createOpenSea({
        apiKey,
        cache: firestoreCache(db, values.apply),
        intervalMs: Number(e.OPENSEA_INTERVAL_MS || 1000),
    });
    const ids = values.gallery
        ? [values.gallery]
        : readGallerySelection(values.manifest, values.project);
    const taskIndex = Number(e.CLOUD_RUN_TASK_INDEX || 0),
        taskCount = Number(e.CLOUD_RUN_TASK_COUNT || 1);
    const config = runConfig(values, ids, taskCount);
    if (
        !Number.isSafeInteger(taskIndex) ||
        taskIndex < 0 ||
        taskIndex >= taskCount
    )
        throw Error("Invalid task index");
    const selected = ids.filter((_, i) => i % taskCount === taskIndex);
    const run = db.collection("galleryMaintenanceRuns").doc(values.run);
    const task = run.collection("tasks").doc(String(taskIndex));
    const counters = {
        selected: selected.length,
        galleries: 0,
        resumedGalleries: 0,
        indexed: 0,
        artistErrors: 0,
        repaired: 0,
        unchanged: 0,
        unresolved: 0,
        audited: 0,
        skipped: 0,
        errors: 0,
    };
    const pending = [];
    const attemptId = `${Date.now()}-${process.pid}`;
    let stopping = false,
        bound = false;
    process.on("SIGTERM", () => {
        stopping = true;
    });
    process.on("SIGINT", () => {
        stopping = true;
    });
    const report = async (data) => {
        const payload = {
            runId: values.run,
            taskIndex,
            attemptId,
            counterScope: "current-attempt",
            ...counters,
            ...provider.stats,
            updatedAt: Date.now(),
            ...data,
        };
        console.log(JSON.stringify(payload));
        if (values.apply) await task.set(payload, { merge: true });
    };
    try {
        if (values.apply) await bindRun(db, run, config);
        bound = true;
        await report({ status: "running" });
        for (const id of selected) {
            if (stopping) break;
            const done = run.collection("galleries").doc(id);
            if (
                values.apply &&
                (await done.get()).data()?.status === "complete"
            ) {
                counters.galleries++;
                counters.resumedGalleries++;
                continue;
            }
            const ref = db.collection("exhibits").doc(id);
            const snapshot = await ref.get(),
                gallery = snapshot.data();
            if (!isPublicGallery(gallery)) {
                counters.skipped++;
                if (values.apply)
                    await done.set({
                        status: "private-or-deleted",
                        at: Date.now(),
                    });
                continue;
            }
            await report({ status: "running", gallery: id, phase: "artists" });
            let galleryErrors = 0;
            try {
                const index = await indexGallery({
                    db,
                    ref,
                    provider,
                    apply: values.apply,
                    storedOnly: values["stored-only"],
                });
                if (index.status === "changed-during-indexing")
                    throw Error("Gallery changed during indexing");
                counters.indexed++;
                if (values.apply)
                    await done
                        .collection("reports")
                        .doc("artists")
                        .set({
                            status: index.status,
                            artworkCount: index.index?.artworkCount || 0,
                            unresolvedCount: index.index?.unresolvedCount || 0,
                            detailsAvailable:
                                !values["stored-only"] &&
                                Array.isArray(index.unresolved),
                            unresolved: values["stored-only"]
                                ? []
                                : index.unresolved || [],
                            at: Date.now(),
                        });
            } catch (error) {
                counters.artistErrors++;
                galleryErrors++;
                console.error(
                    JSON.stringify({
                        gallery: id,
                        phase: "artists",
                        error: error.message,
                    })
                );
                if ([401, 403].includes(error.status)) throw error;
            }
            const records = artworkInputs(gallery)
                .filter((r) => !values.artwork || r.id === values.artwork)
                .slice(0, config.assetLimit || Infinity);
            if (values.artwork && !records.length)
                throw Error("Selected artwork was not found");
            if (!values["artists-only"])
                await report({
                    status: "running",
                    gallery: id,
                    phase: "media",
                });
            if (!values["artists-only"])
                for (const record of records) {
                    if (stopping) break;
                    const recordRef = done
                        .collection("artworks")
                        .doc(hash(record.id));
                    try {
                        const result = await repairArtwork({
                            db,
                            ref,
                            artworkId: record.id,
                            provider,
                            bucket,
                            runId: values.run,
                            apply: values.apply,
                            gallery,
                        });
                        if (result.status === "repaired") counters.repaired++;
                        else if (result.status === "unchanged")
                            counters.unchanged++;
                        else if (result.status === "audited-original")
                            counters.audited++;
                        else if (
                            [
                                "unresolved",
                                "changed-during-repair",
                                "partial-preview",
                            ].includes(result.status)
                        ) {
                            counters.unresolved++;
                            galleryErrors++;
                        } else counters.skipped++;
                        if (values.apply)
                            await recordRef.set(
                                JSON.parse(
                                    JSON.stringify({
                                        artworkId: record.id,
                                        at: Date.now(),
                                        ...result,
                                    })
                                )
                            );
                        else
                            console.log(
                                JSON.stringify({
                                    gallery: id,
                                    artwork: record.id,
                                    ...result,
                                })
                            );
                    } catch (error) {
                        counters.errors++;
                        galleryErrors++;
                        if (values.apply)
                            await recordRef.set({
                                artworkId: record.id,
                                status: "error",
                                error: error.message.slice(0, 500),
                                at: Date.now(),
                            });
                        console.error(
                            JSON.stringify({
                                gallery: id,
                                artwork: record.id,
                                error: error.message.slice(0, 500),
                            })
                        );
                        if ([401, 403].includes(error.status)) throw error;
                    }
                    if (
                        (counters.repaired +
                            counters.unchanged +
                            counters.unresolved +
                            counters.audited +
                            counters.errors) %
                            10 ===
                        0
                    )
                        await report({ status: "running", gallery: id });
                }
            if (stopping) break;
            counters.galleries++;
            if (galleryErrors) pending.push(id);
            if (values.apply)
                await done.set({
                    status: galleryErrors ? "needs-review" : "complete",
                    errors: galleryErrors,
                    artworks: records.length,
                    at: Date.now(),
                });
            await report({ status: "running", gallery: id });
        }
        await report({
            status: stopping
                ? "interrupted"
                : pending.length
                ? "complete-with-unresolved"
                : "complete",
            pendingGalleries: pending,
        });
        if (stopping) process.exitCode = 130;
    } catch (error) {
        if (bound)
            await report({
                status: "failed",
                error: error.message.slice(0, 500),
            });
        throw error;
    } finally {
        await app.delete();
    }
}
main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
