/** @jest-environment node */
// The page at /<name> (pages/[slug].tsx): a space's link, a profile, and now
// a game's slug. This pins that spaces and profiles resolve exactly as they
// did, and what a game's slug adds. Kept here, not under pages/, where every
// file is built as a route.

// The page's server half is under test; its components are not.
jest.mock("next/dynamic", () => () => () => null);
jest.mock("../../pages/spaces/[id]", () => () => null);
jest.mock("./GameRoute", () => () => null);
// The sign-in wrapper is not this page's: the handler is called directly.
jest.mock("@utils/serverside/BasicServerSideProps", () => ({
    BasicServerSideProps: (handler: unknown) => handler,
}));
jest.mock("@utils/authServerSideProps", () => ({}));
jest.mock("../../utils/saveToDb", () => ({}));
jest.mock("@utils/analytics", () => ({}));
jest.mock("@features/worlds/worldFrame", () => ({
    spaceFrameRole: () => "page",
}));
const mockSpaces: Record<string, { id: string }> = {};
const mockFetchExhibit = jest.fn(async (slug: string) =>
    mockSpaces[slug]
        ? { experience: { ...mockSpaces[slug], editors: ["0xowner"] } }
        : { experience: null }
);
jest.mock("../../utils/ssr", () => ({
    fetchExhibitData: (slug: string) => mockFetchExhibit(slug),
    prefetchSlugPageData: jest.fn(),
}));
jest.mock("@utils/checkGatingRules", () => ({
    checkGating: async () => ({ type: "success" }),
}));
const mockProfiles: Record<string, { username: string }> = {};
jest.mock("@api/accounts/user/utils", () => ({
    fetchUserByUsername: async (name: string) => mockProfiles[name] ?? null,
    fetchUserByWalletId: async () => null,
}));
jest.mock("@utils/serverside/notFoundLanding", () => ({
    notFoundLanding: async (res: { statusCode: number }) => {
        res.statusCode = 404;
        return { notFound: true, cards: [] };
    },
}));
// The catalog, with one game that has a slug and one that has none.
jest.mock("./catalog.generated", () => ({
    GAMES: {
        sky: { id: "sky", title: "Sky Run", slug: "sky-run", devices: [] },
        maze: { id: "maze", title: "Maze", devices: [] },
    },
}));
jest.mock("./gameReleaseServer", () => ({
    loadGameFrame: async (id: string) => ({
        src: `/game-builds/${id}/index.html`,
        release: null,
        source: "committed",
    }),
}));
// The registry: one published game holds the slug `yard-game`.
const mockRegistered = jest.fn(async (slug: string) =>
    slug === "yard-game"
        ? {
              game: { id: "yard", title: "Yard", slug, registered: true },
              frame: {
                  src: "/api/games/releases/yard/abc/index.html",
                  release: "abc",
                  source: "hosted",
              },
          }
        : null
);
jest.mock("./publishedGamesServer", () => ({
    loadRegisteredGame: async () => null,
    loadRegisteredGameBySlug: (slug: string) => mockRegistered(slug),
}));

import { searchUrl } from "@utils/siteUrl";
import { getServerSideProps } from "../../pages/[slug]";

const env = process.env as Record<string, string | undefined>;
const before = env.GAMES_PREVIEW;
beforeEach(() => {
    for (const key of Object.keys(mockSpaces)) delete mockSpaces[key];
    for (const key of Object.keys(mockProfiles)) delete mockProfiles[key];
    mockFetchExhibit.mockClear();
    mockRegistered.mockClear();
    env.GAMES_PREVIEW = "1";
});
afterAll(() => {
    if (before === undefined) delete env.GAMES_PREVIEW;
    else env.GAMES_PREVIEW = before;
});

/** The page's props for /<slug>, as its handler answers a signed-out visit. */
async function at(slug: string, search = "") {
    const res = { statusCode: 200 };
    const query = Object.fromEntries(new URLSearchParams(search));
    const props: any = await (getServerSideProps as any)(
        {
            params: { slug },
            query: { slug, ...query },
            req: { headers: {} },
            res,
            resolvedUrl: `/${slug}${search ? `?${search}` : ""}`,
        },
        null,
        null,
        undefined
    );
    return { props, status: res.statusCode };
}

describe("spaces and profiles resolve exactly as before", () => {
    test("a space's link opens the space, and no game is looked for", async () => {
        mockSpaces["frahm-gallery"] = { id: "space-1" };
        const { props, status } = await at("frahm-gallery");
        expect(props).toEqual({
            experience: { id: "space-1", editors: ["0xowner"] },
            gatingError: null,
            worldFrameRole: "page",
        });
        expect(status).toBe(200);
        expect(props.gameRoute).toBeUndefined();
        expect(props.lobbyWorld).toBeUndefined();
        expect(mockRegistered).not.toHaveBeenCalled();
    });

    test("a link typed with capitals still redirects to the space", async () => {
        mockSpaces["frahm-gallery"] = { id: "space-1" };
        expect((await at("Frahm-Gallery", "from=x")).props).toEqual({
            redirect: {
                destination: "/frahm-gallery?from=x",
                permanent: true,
            },
        });
        expect(mockRegistered).not.toHaveBeenCalled();
    });

    test("a name that is nothing is still the 404 landing", async () => {
        const { props, status } = await at("no-such-thing");
        expect(props).toMatchObject({ notFound: true, experience: null });
        expect(status).toBe(404);
        expect(props.gameRoute).toBeUndefined();
    });

    test("a profile is a profile, found or not, and never a game", async () => {
        mockProfiles["@ada"] = { username: "ada" };
        expect((await at("@ada")).props).toEqual({
            isProfile: true,
            profile: { username: "ada" },
        });
        expect((await at("@nobody")).props).toMatchObject({
            isProfile: true,
            profile: null,
            notFound: true,
        });
        expect(mockFetchExhibit).not.toHaveBeenCalled();
        expect(mockRegistered).not.toHaveBeenCalled();
    });

    test("a space that held a published game's name first keeps it", async () => {
        // Such a pair cannot be made any more (each claim looks at the
        // other); if one exists, the space's link is what it was.
        mockSpaces["yard-game"] = { id: "space-9" };
        expect((await at("yard-game")).props.experience.id).toBe("space-9");
        expect(mockRegistered).not.toHaveBeenCalled();
    });
});

describe("a game at its slug", () => {
    const skyRoute = {
        game: { id: "sky", title: "Sky Run", slug: "sky-run", devices: [] },
        killSwitch: { paused: false, releases: [] },
        frame: {
            src: "/game-builds/sky/index.html",
            release: null,
            source: "committed",
        },
        // The slug is the game's address; /games/sky says the same.
        canonical: searchUrl("/sky-run"),
    };

    test("one of the site's own games: its page, without asking for a space", async () => {
        const { props, status } = await at("sky-run");
        expect(props).toEqual({ gameRoute: skyRoute, lobbyWorld: true });
        expect(status).toBe(200);
        // A catalogued game's slug is a reserved name: no space holds it.
        expect(mockFetchExhibit).not.toHaveBeenCalled();
        expect(mockRegistered).not.toHaveBeenCalled();
    });

    test("the same props as the game's own page at /games/<id>", async () => {
        const own = await (
            await import("../../pages/games/[game]")
        ).getServerSideProps({ params: { game: "sky" }, query: {} } as any);
        expect(own).toEqual({ props: { ...skyRoute, lobbyWorld: true } });
        // A game with no slug says /games/<id>, and is at no /<name>.
        const maze: any = await (
            await import("../../pages/games/[game]")
        ).getServerSideProps({ params: { game: "maze" }, query: {} } as any);
        expect(maze.props.canonical).toBe(searchUrl("/games/maze"));
        expect((await at("maze")).props.notFound).toBe(true);
        // A game's id is not its slug.
        expect((await at("sky")).props.notFound).toBe(true);
    });

    test("a game published on the site: after no space has the name", async () => {
        const { props } = await at("yard-game");
        expect(props.lobbyWorld).toBe(true);
        expect(props.gameRoute).toMatchObject({
            game: { id: "yard", slug: "yard-game", registered: true },
            canonical: searchUrl("/yard-game"),
        });
        expect(mockFetchExhibit).toHaveBeenCalledWith("yard-game");
    });

    test("typed with capitals, it goes to the slug", async () => {
        for (const [typed, to] of [
            ["Sky-Run", "/sky-run"],
            ["YARD-GAME", "/yard-game"],
        ])
            expect((await at(typed, "join=p1")).props).toEqual({
                redirect: { destination: `${to}?join=p1`, permanent: true },
            });
    });

    test("while games are hidden a slug is no address at all", async () => {
        delete env.GAMES_PREVIEW;
        for (const slug of ["sky-run", "yard-game", "Sky-Run"]) {
            const { props, status } = await at(slug);
            expect([slug, props.notFound, status]).toEqual([slug, true, 404]);
            expect(props.gameRoute).toBeUndefined();
        }
        expect(mockRegistered).not.toHaveBeenCalled();
        // And the game's own page is not there either.
        expect(
            await (
                await import("../../pages/games/[game]")
            ).getServerSideProps({ params: { game: "sky" }, query: {} } as any)
        ).toEqual({ notFound: true });
    });
});
