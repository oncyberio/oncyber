import { readFile } from "fs/promises";
import { join, resolve } from "path";
import committedPointers from "./releases.json";
import {
    pinnedRelease,
    resolveGameFrame,
    type GameFrame,
    type HostedRelease,
} from "./gameRelease";

/**
 * The local releases folder this server reads and serves, or null. On by
 * default on the development server (`.games-releases/` at the repository
 * root, where `pnpm games:publish` puts releases with no keys set); anywhere
 * else only when GAMES_RELEASES_DIR names a folder.
 */
export function localReleasesDir(
    env: Record<string, string | undefined> = process.env,
    cwd = process.cwd()
): string | null {
    if (env.GAMES_RELEASES_DIR)
        return resolve(cwd, "..", env.GAMES_RELEASES_DIR);
    return env.NODE_ENV === "development"
        ? resolve(cwd, "..", ".games-releases")
        : null;
}

/**
 * The gateway folder of a release the committed pointer stores on IPFS, or
 * null. Only the committed file is asked: what this server fetches for the
 * releases route is decided in review, never by a request or a local file.
 */
export function committedPinnedRelease(
    id: string,
    release: string
): HostedRelease | null {
    return pinnedRelease(committedPointers, id, release);
}

async function readLocalPointers(): Promise<unknown> {
    const dir = localReleasesDir();
    if (!dir) return null;
    try {
        return JSON.parse(await readFile(join(dir, "pointers.json"), "utf8"));
    } catch {
        return null;
    }
}

/**
 * The frame a game's page loads: a local release when this server has one,
 * then the committed pointer (releases.json), then the committed build.
 */
export async function loadGameFrame(
    id: string,
    { draft = false } = {}
): Promise<GameFrame> {
    const development = process.env.NODE_ENV === "development";
    return resolveGameFrame(
        id,
        [await readLocalPointers(), committedPointers],
        { development, draft }
    );
}
