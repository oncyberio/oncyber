import { readFileSync } from "fs";
import { join } from "path";
import {
    GAME_FILE_MATCHER,
    gamesPreviewEnabled,
    hiddenGameFile,
    isGameFile,
} from "./gamesPreview";
import { findGame, gamesPreviewEnabled as fromCatalog } from "./catalog";

const hidden = { NODE_ENV: "production" };
const preview = { NODE_ENV: "production", GAMES_PREVIEW: "1" };
const development = { NODE_ENV: "development" };

test("games are on for the development server and where GAMES_PREVIEW=1", () => {
    expect(gamesPreviewEnabled(hidden)).toBe(false);
    expect(gamesPreviewEnabled(preview)).toBe(true);
    expect(gamesPreviewEnabled(development)).toBe(true);
    expect(gamesPreviewEnabled({ ...hidden, GAMES_PREVIEW: "true" })).toBe(
        false
    );
    // One function, whichever file it is imported from.
    expect(fromCatalog).toBe(gamesPreviewEnabled);
});

test("with nothing passed it reads the process's own variables", () => {
    const before = process.env.GAMES_PREVIEW;
    try {
        delete process.env.GAMES_PREVIEW;
        expect(gamesPreviewEnabled()).toBe(false);
        process.env.GAMES_PREVIEW = "1";
        expect(gamesPreviewEnabled()).toBe(true);
    } finally {
        if (before === undefined) delete process.env.GAMES_PREVIEW;
        else process.env.GAMES_PREVIEW = before;
    }
});

test("a hidden game's files do not answer: the bundle and its reports", () => {
    for (const path of [
        "/games/ace/index.html",
        "/games/ace/check.json",
        "/games/ace/release.json",
        "/games/ace/assets/index-DEde1qxS.js",
        "/games/padel/avatars/square-catalogue.vrm",
        "/games/lantern-tag/licenses/three-MIT.txt",
        "/games/ace/assets",
        "/GAMES/ace/index.html",
        "/games/ace/%69ndex.html",
        "/games/not-a-game/anything",
    ]) {
        expect([path, hiddenGameFile(path, hidden)]).toEqual([path, true]);
        expect([path, hiddenGameFile(path, preview)]).toEqual([path, false]);
        expect([path, hiddenGameFile(path, development)]).toEqual([
            path,
            false,
        ]);
    }
});

test("the game's page and the guide are not files of a build", () => {
    // The page decides for itself (pages/games/[game].tsx); the guide for
    // building a game is public.
    for (const path of [
        "/games/ace",
        "/games/ace/",
        "/games/llms.txt",
        "/games",
        "/",
        "/api/games/paused",
        "/docs/games/ace/index.html",
    ])
        expect([path, hiddenGameFile(path, hidden)]).toEqual([path, false]);
});

test("the middleware matches a game's files, and asks before any other rule", () => {
    const middleware = readFileSync(
        join(__dirname, "../../middleware.ts"),
        "utf8"
    );
    // Next reads the matcher from the source: the text must be there.
    expect(middleware).toContain(`"${GAME_FILE_MATCHER}"`);
    const asked = middleware.indexOf("isGameFile(path)");
    expect(asked).toBeGreaterThan(0);
    // Where games are on, a game's file is served untouched: the bot rules
    // and the world host's are for pages.
    for (const rule of ["CATALOG.test(path)", "NAMED_SCRAPER.test(ua)"])
        expect(middleware.indexOf(rule, asked)).toBeGreaterThan(asked);
    expect(isGameFile("/games/ace/index.html")).toBe(true);
    expect(isGameFile("/games/ace")).toBe(false);
});

test("finds only catalogued games", () => {
    expect(findGame("garden")?.title).toBe("Bloom Garden");
    expect(findGame("constructor")).toBeNull();
    expect(findGame(undefined)).toBeNull();
});
