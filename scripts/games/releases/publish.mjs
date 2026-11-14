// Publishing a checked build as a hosted release: store it, read it back and
// compare every hash, and only then move the game's pointer to it.
//
// Settings (environment):
//   GAMES_RELEASES_BACKEND   "local" (default) or "pinata"
//   GAMES_RELEASES_DIR       local backend folder, default .games-releases/
//   PINATA_JWT_KEY           pinata backend: the upload key (server-only)
//   GAMES_RELEASES_GATEWAY   pinata backend: gateway origin the page loads from
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
 * Store `files` from `dir` as a release and point the game at it.
 * Throws, leaving the pointer alone, when the stored copy does not verify.
 */
export async function publishRelease({
    game,
    dir,
    files,
    storage,
    pointers,
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
    writePointers(pointers, pointTo(before, game, entry));
    return { entry, previous, existed: Boolean(stored.existed) };
}
