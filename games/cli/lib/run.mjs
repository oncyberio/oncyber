// Running a game's own scripts and the check tool.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGE, sdk } from "./paths.mjs";

/** Run a command with the terminal attached. Resolves with its exit code. */
export function run(command, args, options = {}) {
    return new Promise((done, fail) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: process.platform === "win32",
            ...options,
        });
        child.on("error", fail);
        child.on("exit", (code, signal) => done(code ?? (signal ? 1 : 0)));
    });
}

/** `npm run <script>` in the game's folder. */
export function npmRun(project, script, rest = []) {
    if (!project.scripts[script])
        throw new Error(
            `package.json has no "${script}" script. A game made with \`oncyber new\` has one`
        );
    if (!existsSync(join(project.dir, "node_modules")))
        throw new Error(
            "the game's packages are not installed: run npm install"
        );
    return run(
        "npm",
        ["run", script, ...(rest.length ? ["--", ...rest] : [])],
        {
            cwd: project.dir,
        }
    );
}

/** The node_modules folder Playwright can be required from, or null. */
export function findPlaywright(project) {
    for (const from of [
        join(project.dir, "package.json"),
        join(PACKAGE, "package.json"),
    ]) {
        try {
            const entry = createRequire(from).resolve("playwright");
            const at = entry.lastIndexOf(
                `${join("node_modules", "playwright")}`
            );
            return at < 0
                ? dirname(entry)
                : join(entry.slice(0, at), "node_modules");
        } catch {
            // Not there: try the next place, then NODE_PATH and the globals.
        }
    }
    return null;
}

export const PLAYWRIGHT_MISSING = `the check runs the game in a real browser and needs Playwright with Chromium, which is not installed. In the game's folder:

  npm install --save-dev playwright
  npx playwright install chromium

PW_CHANNEL=chrome uses an installed Chrome instead of the downloaded Chromium.`;

/**
 * Run the check tool (the same scripts/games/games.mjs the repository's
 * `pnpm games:check` runs) on the game where it is. Resolves with the exit
 * code: 0 passed, 1 failed.
 */
export function runCheck(project, flags = []) {
    const modules = findPlaywright(project);
    return run(
        process.execPath,
        [sdk("scripts/games/games.mjs"), "check", project.id, ...flags],
        {
            cwd: project.dir,
            shell: false,
            env: {
                ...process.env,
                ONCYBER_GAME_DIR: project.dir,
                ONCYBER_GAME_OUT: project.out,
                // The SDK's TypeScript source loads from an installed
                // package (register.mjs), in the check tool and in the
                // Node processes its stages start.
                NODE_OPTIONS: [
                    process.env.NODE_OPTIONS,
                    `--import=${
                        pathToFileURL(join(PACKAGE, "lib/register.mjs")).href
                    }`,
                ]
                    .filter(Boolean)
                    .join(" "),
                // The check's stages require("playwright") from the package.
                ...(modules
                    ? {
                          NODE_PATH: [modules, process.env.NODE_PATH]
                              .filter(Boolean)
                              .join(delimiter),
                      }
                    : {}),
            },
        }
    );
}

/** True when require("playwright") will work in the check tool. */
export function hasPlaywright(project) {
    if (findPlaywright(project)) return true;
    try {
        createRequire(sdk("scripts/games/games.mjs")).resolve("playwright");
        return true;
    } catch {
        return false;
    }
}
