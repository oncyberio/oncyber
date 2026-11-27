import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
    GAME_FILE_MATCHER,
    gamesPreviewEnabled,
    hiddenGameFile,
    isGameFile,
} from "./gamesPreview";
import { findGame, gamesPreviewEnabled as fromCatalog } from "./catalog";
import { GAME_BUILDS_PATH, committedFrame } from "./publish/gameRelease";
import {
    GAME_BUILDS_DIR,
    GAME_BUILDS_PATH as headersPath,
    gameNetworkHeaders,
} from "./publish/networkPolicy";

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

test("a hidden game's files do not answer: the bundle, its reports, its folder", () => {
    for (const path of [
        "/game-builds/ace/index.html",
        "/game-builds/ace/check.json",
        "/game-builds/ace/release.json",
        "/game-builds/ace/assets/index-DEde1qxS.js",
        "/game-builds/padel/avatars/square-catalogue.vrm",
        "/game-builds/lantern-tag/licenses/three-MIT.txt",
        // A folder's address: a host answers it with the index file inside.
        "/game-builds/ace",
        "/game-builds/ace/",
        "/game-builds/ace/assets",
        "/game-builds",
        "/GAME-BUILDS/ace/index.html",
        "/game-builds/ace/%69ndex.html",
        "/game-builds/not-a-game/anything",
        committedFrame("ace").src,
    ]) {
        expect([path, hiddenGameFile(path, hidden)]).toEqual([path, true]);
        expect([path, hiddenGameFile(path, preview)]).toEqual([path, false]);
        expect([path, hiddenGameFile(path, development)]).toEqual([
            path,
            false,
        ]);
    }
});

test("a game's page, the guide and other addresses are not files of a build", () => {
    // The page decides for itself (pages/games/[game].tsx), and no build is
    // kept where it could be served in the page's place; the guide for
    // building a game is public.
    for (const path of [
        "/games/ace",
        "/games/ace/",
        "/games/ace/index.html",
        "/games/llms.txt",
        "/games",
        "/",
        "/api/games/paused",
        "/game-builds-of-mine",
        "/docs/game-builds/ace/index.html",
    ])
        expect([path, hiddenGameFile(path, hidden)]).toEqual([path, false]);
});

test("the builds have one address: the frame's, the headers' and the gate's", () => {
    expect(GAME_BUILDS_PATH).toBe("/game-builds");
    expect(headersPath).toBe(GAME_BUILDS_PATH);
    expect(GAME_BUILDS_DIR).toBe(`public${GAME_BUILDS_PATH}`);
    expect(GAME_FILE_MATCHER).toBe(`${GAME_BUILDS_PATH}/:path*`);
    expect(committedFrame("ace").src).toBe("/game-builds/ace/index.html");
    // The builds really are there, and none is left where a host would
    // serve it at a game's own address, /games/<id>.
    const publicDir = join(__dirname, "../../public");
    expect(existsSync(join(publicDir, "game-builds/ace/index.html"))).toBe(
        true
    );
    expect(existsSync(join(publicDir, "games"))).toBe(false);
    // Every file of a build gets the policy, the folder's address included.
    const rules = gameNetworkHeaders(join(publicDir, "game-builds"), {
        existsSync,
        readdirSync,
        readFileSync,
    });
    expect(rules.map((rule) => rule.source)).toEqual(
        expect.arrayContaining([
            "/game-builds/:id/:path*",
            "/game-builds/ace/:path*",
        ])
    );
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
    expect(isGameFile("/game-builds/ace/index.html")).toBe(true);
    expect(isGameFile("/games/ace")).toBe(false);
});

test("finds only catalogued games", () => {
    expect(findGame("garden")?.title).toBe("Bloom Garden");
    expect(findGame("constructor")).toBeNull();
    expect(findGame(undefined)).toBeNull();
});
