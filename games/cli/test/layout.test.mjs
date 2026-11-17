// The check tool's layout: the repository's by default, a game's own folder
// when the command says so.
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
    gameOut,
    gameReports,
    gameSource,
    standalone,
} from "../../../scripts/games/layout.mjs";

test("in the repository: games/<id>, built into the site's static folder", () => {
    const root = "/repo";
    assert.equal(standalone({}), false);
    assert.equal(gameSource(root, "ace", {}), join(root, "games/ace"));
    assert.equal(
        gameOut(root, "ace", {}),
        join(root, "frontend/public/games/ace")
    );
    assert.equal(
        gameReports(root, "ace", {}),
        join(root, "frontend/public/games/ace")
    );
});

test("outside it: the game's own folder, ./dist and ./.oncyber", () => {
    const env = { ONCYBER_GAME_DIR: "/work/sky-run" };
    assert.equal(standalone(env), true);
    assert.equal(gameSource("/repo", "sky-run", env), resolve("/work/sky-run"));
    assert.equal(
        gameOut("/repo", "sky-run", env),
        resolve("/work/sky-run/dist")
    );
    assert.equal(
        gameReports("/repo", "sky-run", env),
        resolve("/work/sky-run/.oncyber")
    );
    assert.equal(
        gameOut("/repo", "sky-run", { ...env, ONCYBER_GAME_OUT: "/work/out" }),
        resolve("/work/out")
    );
});
