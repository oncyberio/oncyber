// The game in the current folder.
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/** The id a game is published under (docs/games/publishing.md). */
export const PUBLISH_ID = /^[a-z0-9][a-z0-9-]{2,40}$/;

/** Why `id` cannot be published under, or null. */
export function idProblem(id) {
    if (typeof id !== "string" || !PUBLISH_ID.test(id))
        return "an id is 3 to 41 lowercase letters, digits or dashes, starting with a letter or digit";
    if (id.includes("--") || id.endsWith("-"))
        return "an id has single dashes and none at the end";
    // Those spell the rooms of a party.
    if (id.includes("-party-") || id.endsWith("-party"))
        return 'an id cannot contain "-party-" or end in "-party"';
    return null;
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/**
 * @param {string} [dir] the game's folder, default the current one
 * @returns {{ dir: string, id: string, out: string, reports: string, manifest: object }}
 */
export function readProject(dir = process.cwd()) {
    dir = resolve(dir);
    const manifestPath = join(dir, "game.json");
    if (!existsSync(manifestPath))
        throw new Error(
            "no game.json here. Run this in a game's folder, or make one with `oncyber new <id>`"
        );
    let manifest;
    try {
        manifest = readJson(manifestPath);
    } catch (error) {
        throw new Error(`game.json is not JSON: ${error.message}`);
    }
    const pkgPath = join(dir, "package.json");
    const pkg = existsSync(pkgPath) ? readJson(pkgPath) : {};
    const id = pkg.oncyber?.id ?? basename(dir);
    const problem = idProblem(id);
    if (problem)
        throw new Error(
            `"${id}" is not a game id: ${problem}. Set "oncyber": { "id": "<id>" } in package.json`
        );
    return {
        dir,
        id,
        out: join(dir, "dist"),
        reports: join(dir, ".oncyber"),
        manifest,
        scripts: pkg.scripts ?? {},
    };
}
