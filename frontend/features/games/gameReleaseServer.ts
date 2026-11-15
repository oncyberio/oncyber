import { readFile } from "fs/promises";
import { join, resolve } from "path";
import committedPointers from "./releases.json";
import { resolveGameFrame, type GameFrame } from "./gameRelease";

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
