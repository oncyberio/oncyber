const fs = require("node:fs");
const root = require("node:path").resolve(__dirname, "../..");
require(root + "/node_modules/@next/env").loadEnvConfig(
    root + "/frontend",
    true,
    { info() {}, error() {} }
);
const admin = require(root + "/node_modules/firebase-admin");
const app = admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
            /\\n/g,
            "\n"
        ),
    }),
});
const deadline = setTimeout(() => {
    console.error("Snapshot timed out");
    process.exit(1);
}, 25000);
(async () => {
    const snap = await app
        .firestore()
        .collection("exhibits")
        .doc("hlc4dbyphjkHl9xH68fe")
        .get();
    if (!snap.exists) throw Error("Gallery missing");
    const g = snap.data(),
        dir =
            process.env.GALLERY_MEDIA_DIR ||
            require("node:path").join(
                require("node:os").tmpdir(),
                "oncyber-museum-media"
            );
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const path = dir + "/before.json";
    if (!fs.existsSync(path))
        fs.writeFileSync(path, JSON.stringify(g, null, 2), { mode: 0o600 });
    const arts = Object.values(g.artworks || {});
    console.log(
        JSON.stringify(
            {
                title: g.info?.headline,
                count: arts.length,
                mime: arts.reduce(
                    (r, a) => (
                        (r[a.data.mime_type] = (r[a.data.mime_type] || 0) + 1),
                        r
                    ),
                    {}
                ),
                sample: arts
                    .slice(0, 3)
                    .map((a) => ({
                        name: a.data.name,
                        keys: Object.keys(a.data),
                        image: a.data.image_url,
                        compressed: a.data.dcompressed_image_url,
                        animation: a.data.animation_url,
                    })),
            },
            null,
            2
        )
    );
})()
    .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        clearTimeout(deadline);
        await app.delete();
    });
