// Publishing a checked build as a hosted release: store it, read it back and
// compare every hash, and only then record it in the game's pointer.
//
// Storing a release does not switch a game to it. The page of a game keeps
// loading its committed build until a person runs `pnpm games:release point
// <id>`; from then on each publish moves the pointer to the new release.
// The pointer never moves to a host that does not send what a release
// needs (releaseHostProblems).
//
// Settings (environment):
//   GAMES_RELEASES_BACKEND   "local" (default) or "pinata"
//   GAMES_RELEASES_DIR       local backend folder, default .games-releases/
//   PINATA_JWT_KEY           pinata backend: the upload key (server-only)
//   GAMES_RELEASES_GATEWAY   pinata backend: gateway origin the page loads from
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    currentRelease,
    pointTo,
    readPointers,
    writePointers,
} from "./pointer.mjs";
import {
    localFolderStorage,
    pinataStorage,
    releaseId,
    verifyRelease,
} from "./storage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { NETWORK_FILE, releaseContentSecurityPolicy } = createRequire(
    import.meta.url
)(join(root, "frontend/features/games/networkPolicy.js"));
/** The pointer file production reads. Committed; a few lines per game. */
export const COMMITTED_POINTERS = join(
    root,
    "frontend/features/games/releases.json"
);

/** The storage and pointer file the environment selects. */
export function releaseTarget(env = process.env) {
    const backend = env.GAMES_RELEASES_BACKEND || "local";
    if (backend === "local") {
        const dir = resolve(root, env.GAMES_RELEASES_DIR || ".games-releases");
        // Local releases have a local pointer: a development publish never
        // touches the file production reads.
        return {
            storage: localFolderStorage({ root: dir }),
            pointers: join(dir, "pointers.json"),
        };
    }
    if (backend === "pinata")
        return {
            storage: pinataStorage({
                jwt: env.PINATA_JWT_KEY,
                gateway: env.GAMES_RELEASES_GATEWAY,
            }),
            pointers: env.GAMES_RELEASES_POINTERS
                ? resolve(root, env.GAMES_RELEASES_POINTERS)
                : COMMITTED_POINTERS,
        };
    throw new Error(
        `GAMES_RELEASES_BACKEND must be local or pinata, not ${backend}`
    );
}

/**
 * What a host of releases must send with every file, checked on a stored
 * release's index.html (docs/games/releases.md):
 *
 *   Access-Control-Allow-Origin: *   the frame's origin is opaque, so its
 *                                    files are fetched in CORS mode
 *   Content-Security-Policy          the game's policy, from the network.json
 *                                    the release carries, plus a sandbox:
 *                                    exactly releaseContentSecurityPolicy()
 *
 * Returns the problems found. A backend with no `headers` (the local folder)
 * is served by this repository's own code, which sends both.
 */
export async function releaseHostProblems(storage, entry) {
    if (typeof storage.headers !== "function") return [];
    let published = null;
    try {
        published = JSON.parse(
            (await storage.read(entry, NETWORK_FILE)).toString("utf8")
        );
    } catch {
        // No declaration in the release: its own files only.
    }
    const policy = releaseContentSecurityPolicy(published);
    let headers;
    try {
        headers = await storage.headers(entry, "index.html");
    } catch (error) {
        return [String(error.message ?? error)];
    }
    const problems = [];
    if (headers.get("access-control-allow-origin") !== "*")
        problems.push("it does not send Access-Control-Allow-Origin: *");
    // Several policies arrive joined by commas; the release's must be one.
    const sent = (headers.get("content-security-policy") ?? "")
        .split(",")
        .map((value) => value.trim());
    if (!sent.includes(policy))
        problems.push(
            `it does not send the release's Content-Security-Policy (${policy})`
        );
    return problems;
}

/** Throws unless the release's host sends what a release needs. */
export async function assertReleaseHost(storage, entry) {
    const problems = await releaseHostProblems(storage, entry);
    if (problems.length)
        throw new Error(
            `${entry.game} cannot be pointed at ${entry.base}: ${problems.join(
                "; "
            )}. See "What a host must send" in docs/games/releases.md`
        );
}

/**
 * Store `files` from `dir` as a release and record it in the pointer file.
 * Throws, leaving the pointer file alone, when the stored copy does not
 * verify.
 *
 * `point` says whether the game's page then loads it: "hosted" (the
 * default) only when the game already loads a hosted release, so a publish
 * never switches a game away from its committed build; `true` always (the
 * check's throwaway backend); `false` never.
 */
export async function publishRelease({
    game,
    dir,
    files,
    storage,
    pointers,
    point = "hosted",
    now = new Date(),
}) {
    const release = releaseId(files);
    const stored = await storage.put({ game, release, dir, files });
    const entry = {
        release,
        base: stored.base,
        backend: storage.name,
        address: stored.address,
        publishedAt: now.toISOString(),
        files: files.length,
        bytes: files.reduce((sum, f) => sum + f.bytes, 0),
    };
    const verified = await verifyRelease(storage, { game, ...entry }, files);
    if (verified.problems.length)
        throw new Error(
            `stored release ${release} does not match the checked build: ` +
                verified.problems
                    .map((p) => `${p.path} (${p.problem})`)
                    .join("; ")
        );
    const before = readPointers(pointers);
    const previous = currentRelease(before, game);
    const move = point === true || (point === "hosted" && Boolean(previous));
    const hostProblems = move
        ? await releaseHostProblems(storage, { game, ...entry })
        : [];
    const pointed = move && !hostProblems.length;
    writePointers(pointers, pointTo(before, game, entry, { point: pointed }));
    if (hostProblems.length)
        throw new Error(
            `release ${release} is stored, but the pointer was left where it was: at ${
                entry.base
            } ${hostProblems.join(
                "; "
            )}. See "What a host must send" in docs/games/releases.md`
        );
    return { entry, previous, pointed, existed: Boolean(stored.existed) };
}
