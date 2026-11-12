#!/usr/bin/env node
/**
 * One-off: hash every world password still stored as plain text.
 *
 * Older exhibit documents keep a password-gated world's password in
 * `gating.password.password`, readable by any client. The web app now keeps
 * a salted scrypt hash in `exhibitSecrets/{exhibitId}` and only
 * `{ message, rev }` in the exhibit; it migrates a document when it is next
 * saved or checked. This script migrates the rest at once, in the same
 * format (frontend/utils/worldPassword/server.ts), and deletes each migrated
 * exhibit's shared view cache (`caches/exhibit-view-{id}`), which may hold a
 * copy of the plain value.
 *
 *   npm install
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node migrate.js           # dry run: counts only
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node migrate.js --apply   # writes
 *
 * Or set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and
 * FIREBASE_ADMIN_PRIVATE_KEY as for the frontend. It prints exhibit ids and
 * counts, never a password. Safe to run again: migrated documents no longer
 * match.
 */
const crypto = require("crypto");

// Loaded on run only, so the hash format can be tested without it
// (frontend/utils/worldPassword/server.test.ts).
let admin;

const APPLY = process.argv.includes("--apply");
const PAGE = 200;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function init() {
    admin = require("firebase-admin");
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    admin.initializeApp(
        projectId && clientEmail && privateKey
            ? {
                  credential: admin.credential.cert({
                      projectId,
                      clientEmail,
                      privateKey: privateKey.replace(/\\n/g, "\n"),
                  }),
              }
            : undefined
    );
    return admin.firestore();
}

const b64url = (value) =>
    value
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

function hash(plain) {
    const salt = crypto.randomBytes(16);
    const { N, r, p, keylen } = SCRYPT;
    return new Promise((resolve, reject) =>
        crypto.scrypt(
            plain,
            salt,
            keylen,
            { N, r, p, maxmem: 256 * N * r },
            (err, key) =>
                err
                    ? reject(err)
                    : resolve(
                          [
                              "scrypt",
                              N,
                              r,
                              p,
                              salt.toString("base64"),
                              key.toString("base64"),
                          ].join("$")
                      )
        )
    );
}

const isPlain = (gate) =>
    typeof gate?.password === "string" && gate.password.length > 0;

async function migrate(db, id) {
    const ref = db.collection("exhibits").doc(id);
    return db.runTransaction(async (transaction) => {
        const [doc] = await transaction.getAll(ref, { fieldMask: ["gating"] });
        const gate = doc.exists ? doc.data()?.gating?.password : null;
        if (!isPlain(gate)) return false;
        const rev = b64url(crypto.randomBytes(12));
        const now = Date.now();
        transaction.set(db.collection("exhibitSecrets").doc(id), {
            password: { hash: await hash(gate.password), rev },
            updatedAt: now,
        });
        transaction.update(
            ref,
            new admin.firestore.FieldPath("gating", "password"),
            {
                message: typeof gate.message === "string" ? gate.message : "",
                rev,
            },
            new admin.firestore.FieldPath("lastUpdatedAt"),
            now
        );
        return true;
    });
}

async function main() {
    const db = init();
    let last = null;
    let found = 0;
    let migrated = 0;
    let failed = 0;
    for (;;) {
        // Non-empty strings only; ordered by the same field, as Firestore
        // requires for an inequality.
        let query = db
            .collection("exhibits")
            .where("gating.password.password", ">", "")
            .orderBy("gating.password.password")
            // The cursor below needs the ordered field; nothing is printed.
            .select("gating.password.password")
            .limit(PAGE);
        // The cursor holds the values read, so it stays valid while the
        // documents behind it are migrated.
        if (last) query = query.startAfter(last);
        const page = await query.get();
        if (page.empty) break;
        for (const doc of page.docs) {
            found++;
            if (!APPLY) continue;
            try {
                if (await migrate(db, doc.id)) {
                    migrated++;
                    await db
                        .collection("caches")
                        .doc(`exhibit-view-${doc.id}`)
                        .delete();
                    console.log("migrated", doc.id);
                }
            } catch (err) {
                failed++;
                console.error(
                    "failed",
                    doc.id,
                    err?.code || err?.message || "error"
                );
            }
        }
        last = page.docs[page.docs.length - 1];
        if (page.size < PAGE) break;
    }
    console.log(
        APPLY
            ? `found ${found}, migrated ${migrated}, failed ${failed}`
            : `dry run: ${found} exhibits hold a plain password. Run with --apply to migrate them.`
    );
    if (failed) process.exitCode = 1;
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err?.message || err);
        process.exit(1);
    });
}

module.exports = { hash };
