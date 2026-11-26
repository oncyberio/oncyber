import { readFileSync } from "fs";
import { join } from "path";
import {
    APP_PATHS,
    GAME_SLUGS,
    PAGE_REDIRECTS,
    isReservedLink,
} from "@utils/reservedLinks";
import { GAMES, type GameEntry } from "./catalog";
import {
    GAME_SLUG,
    catalogGameBySlug,
    gamePath,
    gameSlugProblem,
} from "./gameSlug";

const game = (id: string, slug?: string) =>
    ({ id, title: id, ...(slug ? { slug } : {}) } as GameEntry);
const catalog = {
    sky: game("sky", "sky-run"),
    maze: game("maze"),
};

test("a slug is 3 to 40 lowercase letters and digits in words joined by single dashes", () => {
    for (const slug of [
        "sky",
        "sky-run",
        "3d-maze",
        "a1-b2-c3",
        "a".repeat(40),
    ])
        expect([slug, gameSlugProblem(slug)]).toEqual([slug, null]);
    for (const slug of [
        "ab",
        "a".repeat(41),
        "Sky-Run",
        "sky--run",
        "-sky",
        "sky-",
        "sky_run",
        "sky run",
        "sky/run",
        "sky.run",
        // A profile is always /@name: no slug can spell one.
        "@ada",
        "",
        null,
        7,
    ])
        expect([slug, !!gameSlugProblem(slug)]).toEqual([slug, true]);
});

test("the site's own addresses are no game's to take", () => {
    for (const name of [...APP_PATHS, ...Object.keys(PAGE_REDIRECTS)].filter(
        (name) => GAME_SLUG.test(name)
    ))
        expect([name, gameSlugProblem(name)]).toEqual([
            name,
            `/${name} is taken; choose another link.`,
        ]);
});

test("a game's address is its slug when it has one, else /games/<id>", () => {
    expect(gamePath(catalog.sky)).toBe("/sky-run");
    expect(gamePath(catalog.maze)).toBe("/games/maze");
    expect(gamePath({ id: "maze", slug: null })).toBe("/games/maze");
    // What is not a slug is never an address.
    expect(gamePath({ id: "maze", slug: "../admin" })).toBe("/games/maze");
});

test("a catalogued game is found by its slug, in lower case only", () => {
    expect(catalogGameBySlug("sky-run", catalog)).toBe(catalog.sky);
    for (const name of ["sky", "maze", "Sky-Run", "sky-run/", "", null, 7])
        expect([name, catalogGameBySlug(name, catalog)]).toEqual([name, null]);
});

describe("the catalog's own slugs", () => {
    const slugs = Object.values(GAMES).flatMap((entry) =>
        entry.slug ? [[entry.slug, entry.id]] : []
    );

    test("each is a slug, none is a page of the site, and no two games share one", () => {
        const site = new Set([...APP_PATHS, ...Object.keys(PAGE_REDIRECTS)]);
        const seen = new Map<string, string>();
        for (const [slug, id] of slugs) {
            expect([id, slug, GAME_SLUG.test(slug)]).toEqual([id, slug, true]);
            expect([id, slug, site.has(slug)]).toEqual([id, slug, false]);
            expect([id, slug, seen.get(slug) ?? id]).toEqual([id, slug, id]);
            seen.set(slug, id);
        }
    });

    test("the site reserves exactly those, so no space can take one", () => {
        // catalog.slugs.json is written with the catalog (pnpm games:catalog).
        expect(GAME_SLUGS).toEqual(Object.fromEntries(slugs));
        expect(
            JSON.parse(
                readFileSync(join(__dirname, "catalog.slugs.json"), "utf8")
            )
        ).toEqual(GAME_SLUGS);
        for (const [slug] of slugs) expect(isReservedLink(slug)).toBe(true);
    });
});
