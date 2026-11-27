// Where a game's source, build and reports are.
//
// In this repository (the default): games/<id>/ is the source,
// frontend/public/game-builds/<id>/ the build, and the reports sit beside the
// build. The `oncyber` command (games/cli/) runs the same checks on a game
// that lives in a folder of its own, outside the repository, by setting:
//
//   ONCYBER_GAME_DIR   the game's folder (game.json, src/, BRIEF.md, ...)
//   ONCYBER_GAME_OUT   its build, default <game>/dist
//
// Reports (check.json) then go to <game>/.oncyber/, and the steps that only
// mean something in the repository are skipped: the generated catalog, the
// saved-data declarations the page reads, THIRD_PARTY_NOTICES.md.
import { join, relative, resolve } from "node:path";

/** True when the game is a folder of its own, not games/<id>/ here. */
export const standalone = (env = process.env) => Boolean(env.ONCYBER_GAME_DIR);

/** The game's source folder. */
export const gameSource = (root, id, env = process.env) =>
    standalone(env) ? resolve(env.ONCYBER_GAME_DIR) : join(root, "games", id);

/** The game's build: what a visitor's browser loads. */
export const gameOut = (root, id, env = process.env) =>
    standalone(env)
        ? resolve(env.ONCYBER_GAME_OUT || join(env.ONCYBER_GAME_DIR, "dist"))
        : join(root, "frontend/public/game-builds", id);

/** Where check.json is written. */
export const gameReports = (root, id, env = process.env) =>
    standalone(env)
        ? join(resolve(env.ONCYBER_GAME_DIR), ".oncyber")
        : gameOut(root, id, env);

/** A path as a person would type it: from the repository, or from here. */
export const shown = (root, path, env = process.env) =>
    (relative(standalone(env) ? process.cwd() : root, path) || ".")
        .split("\\")
        .join("/");
