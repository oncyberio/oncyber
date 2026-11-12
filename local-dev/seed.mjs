#!/usr/bin/env node
// Loads local-dev/fixtures/ into the running Firebase emulators.
// `pnpm dev:local` runs this on a fresh emulator; run it by hand with
// `node local-dev/seed.mjs` (the emulators must be up).

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// firebase-admin is a frontend dependency; resolve it from there.
const require = createRequire(join(HERE, "../frontend/package.json"));
const admin = require("firebase-admin");

export const PROJECT_ID = "demo-oncyber";
// The one account you can sign in with (email and password, in the emulator
// only). It owns some of the fixture spaces, so the studio has work to edit.
export const DEMO_LOGIN = {
    uid: "demo-user-1",
    email: "demo@example.com",
    password: "oncyber-demo",
};

const readJson = async (name) =>
    JSON.parse(await readFile(join(HERE, "fixtures", name), "utf8"));

// The public API returns Firestore timestamps as {_seconds, _nanoseconds}.
function revive(value) {
    if (Array.isArray(value)) return value.map(revive);
    if (!value || typeof value !== "object") return value;
    const keys = Object.keys(value);
    if (
        keys.length === 2 &&
        typeof value._seconds === "number" &&
        typeof value._nanoseconds === "number"
    ) {
        return new admin.firestore.Timestamp(
            value._seconds,
            value._nanoseconds
        );
    }
    return Object.fromEntries(keys.map((k) => [k, revive(value[k])]));
}

function app() {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
        throw new Error(
            "FIRESTORE_EMULATOR_HOST is not set: refusing to seed anything but the local emulator."
        );
    }
    return admin.apps.length
        ? admin.app()
        : admin.initializeApp({ projectId: PROJECT_ID });
}

/** True when the emulator already holds data (a saved run). */
export async function isSeeded() {
    const db = app().firestore();
    const snap = await db.collection("exhibits").limit(1).get();
    return !snap.empty;
}

export async function seed() {
    const db = app().firestore();
    const [exhibits, users, curation, destinations] = await Promise.all([
        readJson("exhibits.json"),
        readJson("users.json"),
        readJson("curation.json"),
        readJson("destinations.json"),
    ]);
    const now = Date.now();

    let batch = db.batch();
    let pending = 0;
    const flush = async (force = false) => {
        if (pending && (force || pending >= 400)) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    };
    const put = async (ref, data) => {
        batch.set(ref, data);
        pending++;
        await flush();
    };

    for (const { id, doc } of exhibits) {
        await put(db.collection("exhibits").doc(id), {
            ...revive(doc),
            lastUpdatedAt: now,
        });
    }
    for (const user of users) {
        await put(db.collection("users").doc(user.id), {
            ...user.doc,
            id: user.id,
        });
        for (const exhibitId of user.exhibits) {
            await put(
                db
                    .collection("users")
                    .doc(user.id)
                    .collection("exhibits")
                    .doc(exhibitId),
                { id: exhibitId, invited: false }
            );
        }
    }
    // Templates live in "new-destinations" (utils/firestore/destinations.ts).
    for (const { id, doc } of destinations) {
        await put(db.collection("new-destinations").doc(id), revive(doc));
    }
    await put(db.collection("curation").doc("staff-picks"), {
        ids: curation.staffPicks || [],
        updatedAt: now,
        updatedBy: "local-dev",
    });
    await flush(true);

    const auth = app().auth();
    await auth.deleteUser(DEMO_LOGIN.uid).catch(() => {});
    await auth.createUser({
        uid: DEMO_LOGIN.uid,
        email: DEMO_LOGIN.email,
        password: DEMO_LOGIN.password,
        emailVerified: true,
        displayName: "Demo Curator",
    });

    return {
        exhibits: exhibits.length,
        destinations: destinations.length,
        users: users.length,
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
    process.env.FIREBASE_DATABASE_EMULATOR_HOST ||= "127.0.0.1:9000";
    seed()
        .then((n) => {
            console.log(
                `seeded ${n.exhibits} spaces, ${n.destinations} templates, ${n.users} demo users`
            );
            process.exit(0);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
