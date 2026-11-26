import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream } from "fs";
import { readFile, stat } from "fs/promises";
import { extname, resolve, sep } from "path";
import { pipeline } from "stream/promises";
import { findGame, gamesPreviewEnabled } from "@features/games/catalog";
import {
    gameKillSwitch,
    killSwitchForRelease,
} from "@features/games/health/gameDisabled";
import type { HostedRelease } from "@features/games/publish/gameRelease";
import {
    committedPinnedRelease,
    localReleasesDir,
} from "@features/games/publish/gameReleaseServer";
import { gatewayGet } from "@features/games/publish/pinnedGateway";
import { publishingEnabled } from "@features/games/publish/publishedGames";
import {
    NETWORK_FILE,
    releaseContentSecurityPolicy,
} from "@features/games/publish/networkPolicy";

/**
 * Serves releases: the files of /api/games/releases/<game>/<release>/<path>.
 * Releases are public, never change, and are fetched in CORS mode by the
 * game's opaque-origin frame. Two sources, in this order:
 *
 * 1. The local releases folder (see localReleasesDir), where it is on, and
 *    only for files inside it.
 * 2. A release the committed pointer (features/games/publish/releases.json) stores
 *    on IPFS through Pinata: the file is fetched from that entry's gateway
 *    folder and passed on. This route is what sits in front of the gateway,
 *    because a gateway cannot send a release's own policy. Where to fetch
 *    is decided by the committed file alone; the request only picks a game,
 *    a release it lists and a path inside it. Any listed release is served,
 *    so a rollback needs nothing new here.
 *
 * A game that is not in the catalog is one published from outside the
 * repository (docs/games/publishing.md), and the registry decides for it:
 * its files are served, from the local folder, from this server's storage
 * bucket or from the gateway folder its record names, only while the game
 * is published, the release is one its record lists, and the kill switch
 * does not name it. The registry is asked through a short cache
 * (publishedGamesServer.ts).
 *
 * A release in the bucket (upload mode `storage`) is read by this server
 * and passed on, like one behind a gateway: the bucket is private, and no
 * request is ever sent to it or given an address in it.
 *
 * Games are hidden at launch, and so are their releases: where game pages
 * do not answer (`gamesPreviewEnabled`), this route answers 404 for every
 * game, catalogued or registered, before it looks at anything.
 *
 * Either way it sends what every host of releases must (docs/games/releases.md):
 * `Access-Control-Allow-Origin: *`, and the game's own
 * Content-Security-Policy, built from the `network.json` the release
 * carries exactly as next.config.js builds it for a committed build
 * (docs/games/trust.md), with a sandbox added.
 */
const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".glb": "model/gltf-binary",
    ".vrm": "model/gltf-binary",
    ".ktx2": "image/ktx2",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".woff2": "font/woff2",
};
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const RELEASE_ID = /^[0-9a-f]{16}$/;

export const config = { api: { responseLimit: false } };

/** The headers of every file of a release, whatever it is read from. */
function releaseHeaders(res: NextApiResponse, path: string, policy: string) {
    res.setHeader(
        "Content-Type",
        TYPES[extname(path).toLowerCase()] ?? "application/octet-stream"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", policy);
}

/** A failure is never cached: only a release's files are immutable. */
function refuse(res: NextApiResponse, status: number) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).end();
}

const NETWORK_FILE_LIMIT = 65536;
/**
 * The policy of each pinned release this server has served, by game and
 * release. A release never changes, so neither does its policy; the keys
 * are releases the committed pointer lists, so the map stays small.
 */
const pinnedPolicies = new Map<string, Promise<string>>();

/**
 * The policy for a pinned release, from the network.json it carries. As
 * for a local release, one with no network.json (the gateway answers 404)
 * or a malformed one reaches only its own files. Anything else (the
 * gateway failing, redirecting or timing out) rejects, and is asked again
 * next time: a file is not sent under a policy that was never read.
 */
function pinnedPolicy(game: string, pinned: HostedRelease): Promise<string> {
    const key = `${game}/${pinned.release}`;
    let policy = pinnedPolicies.get(key);
    if (!policy) {
        policy = readPinnedPolicy(pinned);
        pinnedPolicies.set(key, policy);
        policy.catch(() => pinnedPolicies.delete(key));
    }
    return policy;
}

async function readPinnedPolicy(pinned: HostedRelease): Promise<string> {
    const { status, body } = await gatewayGet(
        new URL(NETWORK_FILE, pinned.base)
    );
    if (status === 404) {
        body.destroy();
        return releaseContentSecurityPolicy(null);
    }
    if (status !== 200) {
        body.destroy();
        throw new Error(`gateway answered ${status}`);
    }
    body.setEncoding("utf8");
    let text = "";
    for await (const chunk of body) {
        text += chunk;
        if (text.length > NETWORK_FILE_LIMIT) {
            body.destroy();
            return releaseContentSecurityPolicy(null);
        }
    }
    let published = null;
    try {
        published = JSON.parse(text);
    } catch {
        // Malformed: its own files only.
    }
    return releaseContentSecurityPolicy(published);
}

/** For tests: forget the policies read so far. */
export function forgetPinnedPolicies() {
    pinnedPolicies.clear();
}

/**
 * One file of a release stored on IPFS: one the committed pointer lists,
 * or one a registered game's record lists (`pinned`).
 */
async function servePinned(
    req: NextApiRequest,
    res: NextApiResponse,
    game: string,
    release: string,
    rest: string[],
    pinned: HostedRelease | null = committedPinnedRelease(game, release)
) {
    // A path names a file inside the release's folder and nothing else.
    if (
        !pinned ||
        rest.join("/").length > 1024 ||
        // eslint-disable-next-line no-control-regex
        rest.some((part) => /[\\/\u0000-\u001f\u007f]/.test(part))
    )
        return res.status(404).end();
    const url = new URL(rest.map(encodeURIComponent).join("/"), pinned.base);
    if (!url.href.startsWith(pinned.base) || url.search || url.hash)
        return res.status(404).end();
    let upstream: Awaited<ReturnType<typeof gatewayGet>>;
    let policy: string;
    try {
        policy = await pinnedPolicy(game, pinned);
        upstream = await gatewayGet(url);
    } catch {
        return refuse(res, 502);
    }
    const { status, headers, body } = upstream;
    // Only the file itself is passed on: no redirect is followed, and what
    // the gateway says about a failure stays here.
    const encoding = headers["content-encoding"];
    if (status !== 200 || (encoding && encoding !== "identity")) {
        body.destroy();
        return refuse(res, status === 404 ? 404 : 502);
    }
    // The type is this route's, by extension; the gateway's is not used.
    releaseHeaders(res, rest[rest.length - 1], policy);
    const length = headers["content-length"];
    if (typeof length === "string" && /^[0-9]+$/.test(length))
        res.setHeader("Content-Length", length);
    if (req.method === "HEAD") {
        body.destroy();
        return res.status(200).end();
    }
    res.status(200);
    // A gateway that stops part way ends the response short of its length.
    await pipeline(body, res).catch(() => res.destroy());
}

/**
 * The policy of each release in the bucket this server has served. A
 * release never changes, so neither does its policy; the keys are releases
 * the registry lists, and the map is emptied when it grows large.
 */
const storedPolicies = new Map<string, Promise<string>>();
const STORED_POLICIES_MAX = 500;

/** For tests: forget the policies read so far. */
export function forgetStoredPolicies() {
    storedPolicies.clear();
}

/**
 * One file of a registered game's release kept in this server's bucket
 * (features/games/publish/releaseBucket.ts). The object's name is made from the
 * game and release the registry answered for and a path held to the rule
 * for a release's paths; the storage code loads only for such a request.
 */
async function serveStored(
    req: NextApiRequest,
    res: NextApiResponse,
    game: string,
    release: string,
    rest: string[]
) {
    const [
        { isMissing, releaseBucket, releaseObject },
        { ObjectTooLong, readObjectText },
    ] = await Promise.all([
        import("@features/games/publish/releaseBucket"),
        import("@features/games/publish/publishedGamesStorage"),
    ]);
    const bucket = releaseBucket();
    const object = releaseObject(game, release, rest.join("/"));
    const declared = releaseObject(game, release, NETWORK_FILE);
    if (!bucket || !object || !declared) return refuse(res, 404);
    const key = `${game}/${release}`;
    let policy = storedPolicies.get(key);
    if (!policy) {
        // As for a local release: one with no network.json, a malformed
        // one or one too long to be one reaches only its own files. A
        // bucket that fails rejects, and is asked again next time.
        policy = readObjectText(bucket, declared, NETWORK_FILE_LIMIT)
            .then((text) => (text === null ? null : JSON.parse(text)))
            .catch((error) => {
                if (
                    isMissing(error) ||
                    error instanceof SyntaxError ||
                    error instanceof ObjectTooLong
                )
                    return null;
                throw error;
            })
            .then(releaseContentSecurityPolicy);
        if (storedPolicies.size >= STORED_POLICIES_MAX) storedPolicies.clear();
        storedPolicies.set(key, policy);
        policy.catch(() => storedPolicies.delete(key));
    }
    let found: Awaited<ReturnType<typeof bucket.stat>>;
    let sent: string;
    try {
        sent = await policy;
        found = await bucket.stat(object);
    } catch {
        // What the bucket said of a failure stays here.
        return refuse(res, 502);
    }
    if (!found || found.encoding) return refuse(res, 404);
    // The type is this route's, by extension; the bucket's is not used.
    releaseHeaders(res, rest[rest.length - 1], sent);
    res.setHeader("Content-Length", found.bytes);
    if (req.method === "HEAD") return res.status(200).end();
    res.status(200);
    // The version that was measured. A bucket that stops part way ends the
    // response short of its length.
    await pipeline(bucket.read(object, found.generation), res).catch(() =>
        res.destroy()
    );
}

/**
 * Where a registered game's release is read from, or null: not published,
 * not listed, stopped by `GAMES_DISABLED`, or publishing is off here. The
 * registry (and with it Firestore) is loaded only for such a request.
 */
async function registeredReleaseOf(game: string, release: string) {
    if (!publishingEnabled()) return null;
    if (killSwitchForRelease(gameKillSwitch(game), release).paused) return null;
    const { registeredRelease } = await import(
        "@features/games/publish/publishedGamesServer"
    );
    return registeredRelease(game, release).catch(() => null);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (!gamesPreviewEnabled()) return refuse(res, 404);
    const root = localReleasesDir();
    const parts = ([] as string[]).concat(req.query.path ?? []);
    const [game, release, ...rest] = parts;
    if (
        (req.method !== "GET" && req.method !== "HEAD") ||
        !GAME_ID.test(game ?? "") ||
        !RELEASE_ID.test(release ?? "") ||
        !rest.length ||
        rest.some((part) => !part || part === "." || part === "..")
    )
        return res.status(404).end();
    // A game outside the catalog is served only as its registry record
    // says: published, this release listed, and not stopped.
    let registered: Awaited<ReturnType<typeof registeredReleaseOf>> = null;
    if (!findGame(game)) {
        registered = await registeredReleaseOf(game, release);
        if (!registered) return refuse(res, 404);
    }
    if (registered?.backend === "pinata")
        return servePinned(req, res, game, release, rest, registered.pinned);
    // The local folder first, where it is on; production has none.
    const folder = root ? resolve(root, game, release) : null;
    const file = folder ? resolve(folder, ...rest) : null;
    const found =
        file && file.startsWith(folder + sep)
            ? await stat(file).catch(() => null)
            : null;
    if (!found?.isFile()) {
        if (registered?.backend === "storage")
            return serveStored(req, res, game, release, rest);
        return registered
            ? refuse(res, 404)
            : servePinned(req, res, game, release, rest);
    }
    res.setHeader("Content-Length", found.size);
    // The game reaches its own files and the hosts its release declared,
    // nothing else; opened directly, it still runs without this site's
    // origin. A release never changes, so neither does its policy.
    const published = await readFile(resolve(folder, NETWORK_FILE), "utf8")
        .then(JSON.parse)
        .catch(() => null);
    releaseHeaders(res, file, releaseContentSecurityPolicy(published));
    if (req.method === "HEAD") return res.status(200).end();
    res.status(200);
    createReadStream(file).pipe(res);
}
