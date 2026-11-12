/* Exact-field optimistic transaction: preserve concurrent edits and all placements. */
const fs = require("node:fs"),
    crypto = require("node:crypto"),
    { isDeepStrictEqual: equal } = require("node:util");
const root = require("node:path").resolve(__dirname, "../.."),
    dir =
        process.env.GALLERY_MEDIA_DIR ||
        require("node:path").join(
            require("node:os").tmpdir(),
            "oncyber-museum-media"
        );
const before = JSON.parse(fs.readFileSync(dir + "/before.json"));
const rows = JSON.parse(fs.readFileSync(dir + "/prepared-report.json"));
const extra = JSON.parse(fs.readFileSync(dir + "/extras.json"));
const published = JSON.parse(fs.readFileSync(dir + "/published.json"));
if (
    rows.length !== 142 ||
    rows.some((r) => !r.images) ||
    extra.length !== 2 ||
    extra.some((r) => !r.verified)
)
    throw Error("Incomplete preparation");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
function media(f) {
    const p = published[f.file],
        bytes = fs.readFileSync(dir + "/prepared/" + f.file);
    if (!p || p.hash !== sha(bytes))
        throw Error("Unverified upload: " + f.file);
    return { url: p.url, width: f.width, height: f.height, bytes: p.bytes };
}
const patches = [];
function patch(id, field, after) {
    const old = before.artworks[id].data[field];
    if (!equal(old ?? null, after))
        patches.push({ id, field, before: old ?? null, after });
}
for (const r of rows) {
    const d = before.artworks[r.id].data,
        images = r.images.map(media),
        animation = r.animation ? media(r.animation) : null;
    const manifest = {
        version: 1,
        identity: r.identity,
        sourceHash: r.sourceHash,
        originalMime: r.originalMime,
        images,
        ...(animation ? { animation } : {}),
    };
    patch(r.id, "media_variants", manifest);
    patch(r.id, "dcompressed_image_url", images.at(-1).url);
    patch(r.id, "compressed_image_url", images[0].url);
    patch(r.id, "image_preview_url", images[0].url);
    patch(r.id, "image_url", images.at(-1).url);
    if (!d.image_original_url && d.image_url)
        patch(r.id, "image_original_url", d.image_url);
    if (animation) {
        patch(r.id, "dcompressed_animation_url", animation.url);
        patch(r.id, "animation_url", animation.url);
        patch(r.id, "mime_type", "video/mp4");
        patch(r.id, "cover_mime_type", "image/webp");
        if (!d.animation_original_url)
            patch(r.id, "animation_original_url", d.animation_url || r.source);
    } else if (!d.mime_type.startsWith("panorama"))
        patch(r.id, "mime_type", "image/webp");
}
for (const r of extra) {
    if (r.mime === "text/html") {
        const images = r.images.map(media);
        patch(r.id, "animation_url", r.source);
        patch(r.id, "dcompressed_animation_url", r.source);
        patch(r.id, "dcompressed_image_url", images.at(-1).url);
        patch(r.id, "image_url", images.at(-1).url);
        patch(r.id, "image_preview_url", images[0].url);
        patch(r.id, "cover_mime_type", "image/webp");
        if (!before.artworks[r.id].data.animation_original_url)
            patch(
                r.id,
                "animation_original_url",
                before.artworks[r.id].data.animation_url
            );
    }
}
fs.writeFileSync(dir + "/repair-plan.json", JSON.stringify(patches, null, 2), {
    mode: 0o600,
});
console.log(
    JSON.stringify({
        artworks: new Set(patches.map((p) => p.id)).size,
        fields: patches.length,
        placementsBefore: Object.keys(before.artworks).length,
        images: rows.length,
        html: 1,
        verifiedModel: 1,
        apply: process.argv.includes("--apply"),
    })
);
if (!process.argv.includes("--apply")) process.exit(0);
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
    console.error(
        "Transaction deadline exceeded; inspect gallery state before retrying"
    );
    process.exit(1);
}, 60000);
(async () => {
    const db = app.firestore(),
        ref = db.collection("exhibits").doc("hlc4dbyphjkHl9xH68fe");
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw Error("Gallery missing");
        const fresh = snap.data();
        const args = [];
        for (const p of patches) {
            const d = fresh.artworks?.[p.id]?.data,
                old = before.artworks[p.id].data;
            if (
                !d ||
                d.contract_address !== old.contract_address ||
                String(d.token_id) !== String(old.token_id)
            )
                throw Error("Artwork identity changed: " + p.id);
            if (equal(d[p.field] ?? null, p.after)) continue;
            if (!equal(d[p.field] ?? null, p.before))
                throw Error("Concurrent media edit: " + p.id + " " + p.field);
            args.push(
                new admin.firestore.FieldPath(
                    "artworks",
                    p.id,
                    "data",
                    p.field
                ),
                p.after
            );
        }
        if (!fs.existsSync(dir + "/immediately-before-apply.json"))
            fs.writeFileSync(
                dir + "/immediately-before-apply.json",
                JSON.stringify(fresh, null, 2),
                { mode: 0o600 }
            );
        if (args.length) tx.update(ref, ...args);
        // Exhibit views validate this version before reusing their shared cache.
        if (args.length || !fs.existsSync(dir + "/cache-version.json")) {
            const version = Math.max(
                Date.now(),
                Number(fresh.lastUpdatedAt || 0) + 1
            );
            tx.update(ref, { lastUpdatedAt: version });
        }
        return args.length / 2;
    });
    const after = (await ref.get()).data();
    for (const p of patches)
        if (!equal(after.artworks[p.id].data[p.field], p.after))
            throw Error("Read-back mismatch");
    fs.writeFileSync(
        dir + "/cache-version.json",
        JSON.stringify({ lastUpdatedAt: after.lastUpdatedAt }),
        { mode: 0o600 }
    );
    fs.writeFileSync(dir + "/after.json", JSON.stringify(after, null, 2), {
        mode: 0o600,
    });
    console.log(
        "Applied and verified",
        result,
        "fields;",
        Object.keys(after.artworks).length,
        "placements; no deletions"
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
