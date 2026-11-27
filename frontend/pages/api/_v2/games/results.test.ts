/** @jest-environment node */
import fixtures from "../../../../../games/runtime/test/results.fixtures.json";

// The procedures run against the real store code; only Firestore underneath
// is replaced, by this in-memory one.
const mockDocs = new Map<string, Record<string, any>>();
const mockDoc = (path: string) => ({
    path,
    collection: (name: string) => mockCollection(`${path}/${name}`),
});
const mockCollection = (path: string) => ({
    doc: (id: string) => mockDoc(`${path}/${id}`),
    orderBy: (field: string) => ({
        limit: (count: number) => ({
            get: async () => ({
                docs: [...mockDocs.entries()]
                    .filter(([key]) => key.startsWith(`${path}/`))
                    .sort(([, a], [, b]) => b[field] - a[field])
                    .slice(0, count)
                    .map(([, data]) => ({ data: () => data })),
            }),
        }),
    }),
});
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (path: string) => mockCollection(path),
        runTransaction: async (run: (tx: any) => Promise<unknown>) =>
            run({
                get: async (ref: { path: string }) => ({
                    exists: mockDocs.has(ref.path),
                    data: () => mockDocs.get(ref.path),
                }),
                set: (ref: { path: string }, data: Record<string, any>) =>
                    void mockDocs.set(ref.path, data),
            }),
    },
}));

import GamesService from "./index";
import { recordGameResult } from "@utils/firestore/gameResults";

const valid = fixtures.valid;
const env = process.env as Record<string, string | undefined>;
const previous = env.GAMES_PREVIEW;
beforeEach(() => {
    mockDocs.clear();
    env.GAMES_PREVIEW = "1";
});
afterAll(() => {
    env.GAMES_PREVIEW = previous;
});

const report = (userId: string | undefined, input: unknown) =>
    (GamesService as any).reportResult.call({ userId }, input);
const opts = (name: string) => (GamesService as any)[name]._RPC_OPTS;

test("reporting needs a session; the leaderboard is public", () => {
    expect(opts("reportResult").auth).toBe(true);
    expect(opts("leaderboard").auth).toBeUndefined();
    expect((GamesService as any).auth).toBe(false);
});

test("the schema refuses what the page refuses", () => {
    const schema = opts("reportResult").schema;
    expect(schema.safeParse({ game: "ace", result: valid }).success).toBe(true);
    for (const { patch } of fixtures.invalid)
        expect([
            patch,
            schema.safeParse({ game: "ace", result: { ...valid, ...patch } })
                .success,
        ]).toEqual([patch, false]);
});

test("a result is stored under the reporting account, unverified, once", async () => {
    const first = await report("user-a", { game: "ace", result: valid });
    expect(first).toEqual({
        recorded: true,
        outcome: "win",
        standing: { name: "Ada", played: 1, wins: 1, verified: false },
    });
    expect(
        mockDocs.get(`gameResults/ace/matches/user-a_${valid.match}`)
    ).toMatchObject({
        game: "ace",
        reporter: "user-a",
        match: valid.match,
        winner: 0,
        outcome: "win",
        verified: false,
        source: "browser",
    });
    // The same match again changes nothing.
    const again = await report("user-a", { game: "ace", result: valid });
    expect(again).toMatchObject({ recorded: false, reason: "duplicate" });
    expect(mockDocs.get("gameResults/ace/standings/user-a")).toMatchObject({
        userId: "user-a",
        played: 1,
        wins: 1,
        verified: false,
    });
    // Another account reporting the same match writes only its own rows.
    await report("user-b", { game: "ace", result: { ...valid, winner: 1 } });
    expect(mockDocs.get("gameResults/ace/standings/user-b")).toMatchObject({
        played: 1,
        wins: 0,
    });
    expect(mockDocs.get("gameResults/ace/standings/user-a")).toMatchObject({
        played: 1,
        wins: 1,
    });
    expect([...mockDocs.keys()].sort()).toEqual([
        `gameResults/ace/matches/user-a_${valid.match}`,
        `gameResults/ace/matches/user-b_${valid.match}`,
        "gameResults/ace/standings/user-a",
        "gameResults/ace/standings/user-b",
    ]);
});

test("results in quick succession are refused", async () => {
    const at = 1_000_000;
    await recordGameResult("user-a", "ace", valid as any, at);
    const soon = await recordGameResult(
        "user-a",
        "ace",
        { ...valid, match: "second-match" } as any,
        at + 2000
    );
    expect(soon).toMatchObject({ recorded: false, reason: "too-soon" });
    const later = await recordGameResult(
        "user-a",
        "ace",
        { ...valid, match: "second-match", winner: 1 } as any,
        at + 60000
    );
    expect(later).toMatchObject({
        recorded: true,
        outcome: "loss",
        standing: { played: 2, wins: 1 },
    });
});

test("unknown games, hidden games and missing sessions write nothing", async () => {
    await expect(
        report("user-a", { game: "nope", result: valid })
    ).rejects.toThrow("Unknown game");
    await expect(
        report(undefined, { game: "ace", result: valid })
    ).rejects.toThrow("Unauthorized");
    env.GAMES_PREVIEW = undefined;
    await expect(
        report("user-a", { game: "ace", result: valid })
    ).rejects.toThrow("Unknown game");
    await expect(
        (GamesService as any).leaderboard.call({}, { game: "ace" })
    ).rejects.toThrow("Unknown game");
    expect(mockDocs.size).toBe(0);
});

// A 1 v 1 as each of its two players' browsers reports it (room ids m1, m2).
const versus = (self: "m1" | "m2", match = "versus-one") => ({
    match,
    format: "singles",
    durationSeconds: 90,
    teams: [
        {
            score: 2,
            players: [
                {
                    id: "m1",
                    name: "Ada",
                    kind: self === "m1" ? "self" : "peer",
                },
            ],
        },
        {
            score: 1,
            players: [
                { id: "m2", name: "Bo", kind: self === "m2" ? "self" : "peer" },
            ],
        },
    ],
    winner: 0,
});

test("the leaderboard lists names and totals by wins, from agreed results only", async () => {
    // Solo results are kept, never ranked.
    await recordGameResult("user-a", "ace", valid as any, 1);
    await recordGameResult("user-c", "ace", valid as any, 1);
    const board = () =>
        (GamesService as any).leaderboard.call({}, { game: "ace" });
    expect(await board()).toEqual({ game: "ace", entries: [] });

    // A match both players' pages agreed on counts for both.
    const agreedBy = ["m1", "m2"];
    expect(
        await report("user-a", {
            game: "ace",
            result: versus("m1"),
            agreedBy,
        })
    ).toMatchObject({ recorded: true, outcome: "win" });
    await report("user-b", { game: "ace", result: versus("m2"), agreedBy });
    expect(
        mockDocs.get("gameResults/ace/matches/user-a_versus-one")
    ).toMatchObject({ trust: "party-agreed", verified: false });
    expect(mockDocs.get("gameResults/ace/standings/user-a")).toMatchObject({
        played: 2,
        wins: 2,
        rankedPlayed: 1,
        rankedWins: 1,
    });
    expect(await board()).toEqual({
        game: "ace",
        entries: [
            { name: "Ada", played: 1, wins: 1, verified: false },
            { name: "Bo", played: 1, wins: 0, verified: false },
        ],
    });
});

test("agreement is taken only for the people the result says played", async () => {
    const trustOf = async (user: string, input: Record<string, unknown>) => {
        await report(user, { game: "ace", ...input });
        const match = (input.result as { match: string }).match;
        return mockDocs.get(`gameResults/ace/matches/${user}_${match}`).trust;
    };
    // A solo match can't be agreed, whatever the page says.
    expect(
        await trustOf("user-a", { result: valid, agreedBy: ["self", "x"] })
    ).toBe("solo-unverified");
    // Not every player, or someone who didn't play.
    expect(
        await trustOf("user-b", { result: versus("m1"), agreedBy: ["m1"] })
    ).toBe("solo-unverified");
    expect(
        await trustOf("user-c", {
            result: versus("m1"),
            agreedBy: ["m1", "m2", "m3"],
        })
    ).toBe("solo-unverified");
    expect(await trustOf("user-d", { result: versus("m1") })).toBe(
        "solo-unverified"
    );
    expect(
        await trustOf("user-e", {
            result: versus("m1"),
            agreedBy: ["m2", "m1"],
        })
    ).toBe("party-agreed");
});
