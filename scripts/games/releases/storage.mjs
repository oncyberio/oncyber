// Where published game releases live. A release is a fixed set of files
// named by a hash of their contents; storage holds whole releases and never
// changes one. Two backends sit behind one small interface:
//
//   local   a folder on this machine (development, tests, self-hosting)
//   pinata  an IPFS directory pinned through Pinata, read through a gateway
//
// interface ReleaseStorage {
//     name: string;
//     // Store the release. Storing the same files again is a no-op; storing
//     // different files under an existing id is refused.
//     put({ game, release, dir, files }): Promise<{ base: string, address: string }>;
//     // One stored file's bytes, as a visitor would get them.
//     read({ game, release, base, address }, path): Promise<Buffer>;
//     // Optional, for a host this repository does not run: the response
//     // headers a visitor gets with one file, so publish.mjs can refuse to
//     // point a game at a host that does not send what a release needs.
//     headers?({ game, release, base, address }, path): Promise<Headers>;
// }
//
// `base` is the URL the game page loads `index.html` from (it ends in "/").
// `address` is the backend's own name for the release (a folder, an IPFS CID).
import { createHash } from "node:crypto";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { GENERATED_THUMBNAIL } from "../listing.mjs";

export const GAME_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const RELEASE_ID = /^[0-9a-f]{16}$/;
/** The file list stored inside every release, so anyone can verify it. */
export const RELEASE_MANIFEST = "oncyber-release.json";
/**
 * What the check writes beside a build that is not part of a release: it is
 * neither hashed into the release id nor stored.
 *
 *   check.json, release.json  reports about one check and one publish, with
 *                             dates in them; a stored release carries its
 *                             file list as oncyber-release.json instead
 *   thumbnail.jpg             the picture for the game's card (listing.mjs):
 *                             the site's, shown where no frame is loaded
 *
 * Everything else in the folder is the release, including two files the
 * check writes from game.json before it lists the build: network.json (the
 * hosts the game may reach, which the host's policy is built from) and
 * credits.json (what the page's Credits panel shows for this release).
 * games.mjs lists a build with this same set.
 */
export const RELEASE_REPORTS = new Set([
    "check.json",
    "release.json",
    GENERATED_THUMBNAIL,
]);

export const sha256 = (bytes) =>
    createHash("sha256").update(bytes).digest("hex");

/** The release id: a hash of every file's path and content hash. */
export function releaseId(files) {
    const lines = [...files]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .map((f) => `${f.path}:${f.sha256}`);
    return sha256(lines.join("\n")).slice(0, 16);
}

/** The files of a build folder, hashed. Same listing games.mjs makes. */
export function listBuild(dir) {
    const walk = (at) =>
        readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
            const path = join(at, entry.name);
            return entry.isDirectory() ? walk(path) : [path];
        });
    return walk(dir)
        .map((path) =>
            path
                .slice(dir.length + 1)
                .split(sep)
                .join("/")
        )
        .filter((path) => !RELEASE_REPORTS.has(path))
        .sort()
        .map((path) => {
            const bytes = readFileSync(join(dir, path));
            return { path, bytes: bytes.length, sha256: sha256(bytes) };
        });
}

/** Same bytes for the same files, so the same release pins to the same address. */
export function manifestBytes({ game, release, files }) {
    const list = files.map(({ path, bytes, sha256 }) => ({
        path,
        bytes,
        sha256,
    }));
    return Buffer.from(
        JSON.stringify({ version: 1, game, release, files: list }, null, 2) +
            "\n"
    );
}

function checkRelease({ game, release, files }) {
    if (!GAME_ID.test(game ?? "")) throw new Error(`bad game id ${game}`);
    if (!RELEASE_ID.test(release ?? ""))
        throw new Error(`bad release id ${release}`);
    if (!files?.length) throw new Error("a release needs files");
    if (releaseId(files) !== release)
        throw new Error(`release ${release} is not the hash of its files`);
    for (const { path } of files) {
        if (path === RELEASE_MANIFEST)
            throw new Error(
                `${RELEASE_MANIFEST} is reserved for the release's file list`
            );
        if (
            path.startsWith("/") ||
            path
                .split("/")
                .some((part) => !part || part === "." || part === "..")
        )
            throw new Error(`bad file path ${path}`);
    }
    if (!files.some((f) => f.path === "index.html"))
        throw new Error("a release needs index.html");
}

/**
 * A folder of releases: <root>/<game>/<release>/<files>. `url` is where that
 * folder is served; the development server serves it at /api/games/releases.
 */
export function localFolderStorage({ root, url = "/api/games/releases" }) {
    root = resolve(root);
    const folder = (game, release) => join(root, game, release);
    return {
        name: "local",
        root,
        async put({ game, release, dir, files }) {
            checkRelease({ game, release, files });
            const target = folder(game, release);
            const result = {
                base: `${url.replace(/\/+$/, "")}/${game}/${release}/`,
                address: target,
            };
            if (existsSync(target)) {
                // A release never changes: the folder must already hold these bytes.
                for (const file of files) {
                    const at = join(target, file.path);
                    if (
                        !existsSync(at) ||
                        sha256(readFileSync(at)) !== file.sha256
                    )
                        throw new Error(
                            `release ${release} of ${game} is already stored with different contents (${file.path}); a release never changes`
                        );
                }
                return { ...result, existed: true };
            }
            // Written beside the target and renamed, so a release is whole or absent.
            const staging = `${target}.staging-${process.pid}`;
            rmSync(staging, { recursive: true, force: true });
            const write = (path, bytes) => {
                const at = join(staging, path);
                mkdirSync(dirname(at), { recursive: true });
                writeFileSync(at, bytes);
                chmodSync(at, 0o444);
            };
            for (const file of files) {
                const bytes = readFileSync(join(dir, file.path));
                if (sha256(bytes) !== file.sha256) {
                    rmSync(staging, { recursive: true, force: true });
                    throw new Error(
                        `${file.path} changed after it was checked; build and check again`
                    );
                }
                write(file.path, bytes);
            }
            write(RELEASE_MANIFEST, manifestBytes({ game, release, files }));
            renameSync(staging, target);
            return result;
        },
        async read({ game, release }, path) {
            const target = folder(game, release);
            const at = resolve(target, path);
            if (!at.startsWith(target + sep))
                throw new Error(`bad file path ${path}`);
            return readFileSync(at);
        },
    };
}

/**
 * IPFS through Pinata: the release is pinned as one directory, so its CID
 * names every byte in it and `<gateway>/ipfs/<cid>/` is its base URL.
 * `jwt` is PINATA_JWT_KEY (server-only). `gateway` must serve HTML and send
 * Access-Control-Allow-Origin: * and each release's Content-Security-Policy
 * (docs/games/releases.md); a game is never pointed at one that does not.
 */
export function pinataStorage({
    jwt,
    gateway,
    fetch = globalThis.fetch,
    api = "https://api.pinata.cloud",
}) {
    if (!jwt) throw new Error("PINATA_JWT_KEY is not set");
    if (!/^https:\/\/[^/]+/.test(gateway ?? ""))
        throw new Error(
            "GAMES_RELEASES_GATEWAY must be an https gateway origin, for example https://<name>.mypinata.cloud"
        );
    const origin = gateway.replace(/\/+$/, "").replace(/\/ipfs$/, "");
    return {
        name: "pinata",
        async put({ game, release, dir, files }) {
            checkRelease({ game, release, files });
            const form = new FormData();
            // Every part shares one top folder: Pinata pins that folder and
            // returns its CID.
            const folder = `${game}-${release}`;
            const add = (path, bytes) =>
                form.append("file", new Blob([bytes]), `${folder}/${path}`);
            for (const file of files) {
                const bytes = readFileSync(join(dir, file.path));
                if (sha256(bytes) !== file.sha256)
                    throw new Error(
                        `${file.path} changed after it was checked; build and check again`
                    );
                add(file.path, bytes);
            }
            add(RELEASE_MANIFEST, manifestBytes({ game, release, files }));
            form.append(
                "pinataMetadata",
                JSON.stringify({
                    name: `game-${folder}`,
                    keyvalues: { game, release },
                })
            );
            form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
            const response = await fetch(`${api}/pinning/pinFileToIPFS`, {
                method: "POST",
                headers: { Authorization: `Bearer ${jwt}` },
                body: form,
            });
            if (!response.ok)
                throw new Error(
                    `Pinata upload failed (${response.status}): ${(
                        await response.text()
                    ).slice(0, 300)}`
                );
            const cid = (await response.json()).IpfsHash;
            if (!/^[A-Za-z0-9]{46,}$/.test(cid ?? ""))
                throw new Error("Pinata upload returned no CID");
            return { base: `${origin}/ipfs/${cid}/`, address: cid };
        },
        async read({ base }, path) {
            const response = await fetch(new URL(path, base), {
                redirect: "follow",
            });
            if (!response.ok)
                throw new Error(`${path}: gateway answered ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        },
        async headers({ base }, path) {
            const response = await fetch(new URL(path, base), {
                redirect: "follow",
            });
            if (!response.ok)
                throw new Error(`${path}: gateway answered ${response.status}`);
            return response.headers;
        },
    };
}

/**
 * Read a stored release back and compare every byte with its file list.
 * Returns the problems found; an empty list means the release is intact.
 */
export async function verifyRelease(storage, entry, files) {
    const problems = [];
    let listed = files;
    try {
        const stored = JSON.parse(
            (await storage.read(entry, RELEASE_MANIFEST)).toString("utf8")
        );
        if (
            stored.release !== entry.release ||
            releaseId(stored.files) !== entry.release
        )
            problems.push({
                path: RELEASE_MANIFEST,
                problem: "file list does not hash to the release id",
            });
        listed ??= stored.files;
        if (
            files &&
            JSON.stringify(stored.files) !==
                JSON.stringify(
                    files.map(({ path, bytes, sha256 }) => ({
                        path,
                        bytes,
                        sha256,
                    }))
                )
        )
            problems.push({
                path: RELEASE_MANIFEST,
                problem: "file list differs from the checked build",
            });
    } catch (error) {
        problems.push({
            path: RELEASE_MANIFEST,
            problem: String(error.message ?? error),
        });
    }
    for (const file of listed ?? []) {
        try {
            const got = sha256(await storage.read(entry, file.path));
            if (got !== file.sha256)
                problems.push({
                    path: file.path,
                    problem: `sha256 ${got.slice(
                        0,
                        12
                    )}… is not ${file.sha256.slice(0, 12)}…`,
                });
        } catch (error) {
            problems.push({
                path: file.path,
                problem: String(error.message ?? error),
            });
        }
    }
    return { files: listed?.length ?? 0, problems };
}
