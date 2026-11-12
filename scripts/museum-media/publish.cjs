/* Upload immutable derivatives, verifying bytes before any gallery write. */
const fs = require("node:fs"),
    crypto = require("node:crypto");
const root = require("node:path").resolve(__dirname, "../.."),
    dir =
        process.env.GALLERY_MEDIA_DIR ||
        require("node:path").join(
            require("node:os").tmpdir(),
            "oncyber-museum-media"
        );
const token =
    process.env.PINATA_JWT_KEY ||
    fs
        .readFileSync(
            root + "/cloud-functions/functions/src/utils/ipfsUpload.ts",
            "utf8"
        )
        .match(/PINATA_JWT_KEY\s*=\s*["']([^"']+)/)?.[1];
if (!token) throw Error("Pinata credential missing");
const report = JSON.parse(fs.readFileSync(dir + "/prepared-report.json"));
if (report.length !== 142 || report.some((r) => !r.images))
    throw Error("Incomplete media preparation");
const extra = fs.existsSync(dir + "/extras.json")
    ? JSON.parse(fs.readFileSync(dir + "/extras.json"))
    : [];
const files = [
    ...new Map(
        [...report, ...extra]
            .flatMap((r) => [
                ...(r.images || []),
                ...(r.animation ? [r.animation] : []),
            ])
            .map((f) => [f.file, f])
    ).values(),
];
const journalPath = dir + "/published.json",
    journal = fs.existsSync(journalPath)
        ? JSON.parse(fs.readFileSync(journalPath))
        : {};
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
let cursor = 0,
    done = 0;
async function worker() {
    while (cursor < files.length) {
        const f = files[cursor++],
            buffer = fs.readFileSync(dir + "/prepared/" + f.file),
            hash = sha(buffer);
        if (buffer.length !== f.bytes) throw Error("Prepared file changed");
        if (journal[f.file]?.hash === hash) {
            done++;
            continue;
        }
        let url;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (!url) {
                    const body = new FormData();
                    body.append(
                        "file",
                        new Blob([buffer], { type: f.mime }),
                        f.file
                    );
                    body.append(
                        "pinataMetadata",
                        JSON.stringify({
                            name: "museumofchecks-media-v1-" + f.file,
                        })
                    );
                    const response = await fetch(
                        "https://api.pinata.cloud/pinning/pinFileToIPFS",
                        {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                            body,
                            signal: AbortSignal.timeout(60000),
                        }
                    );
                    if (!response.ok)
                        throw Error("Pinata upload HTTP " + response.status);
                    const result = await response.json();
                    if (
                        !/^(Qm[a-zA-Z0-9]+|bafy[a-zA-Z0-9]+)$/.test(
                            result.IpfsHash || ""
                        )
                    )
                        throw Error("Invalid CID");
                    url = `https://cyber.mypinata.cloud/ipfs/${result.IpfsHash}?filename=${f.file}`;
                }
                const verify = await fetch(url, {
                    signal: AbortSignal.timeout(25000),
                });
                if (!verify.ok) throw Error("Gateway HTTP " + verify.status);
                const bytes = Buffer.from(await verify.arrayBuffer());
                if (sha(bytes) !== hash) throw Error("Gateway byte mismatch");
                journal[f.file] = {
                    url,
                    hash,
                    bytes: bytes.length,
                    mime: verify.headers.get("content-type"),
                    verifiedAt: new Date().toISOString(),
                };
                fs.writeFileSync(
                    journalPath,
                    JSON.stringify(journal, null, 2),
                    { mode: 0o600 }
                );
                break;
            } catch (error) {
                if (attempt === 2) throw error;
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
        done++;
        if (done % 20 === 0 || done === files.length)
            console.log("Uploaded and verified", done, "/", files.length);
    }
}
Promise.all([worker(), worker(), worker()])
    .then(() =>
        console.log("DONE", Object.keys(journal).length, "verified files")
    )
    .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
    });
