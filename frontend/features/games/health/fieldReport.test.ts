/** @jest-environment node */
jest.mock("../publish/publishedGamesServer", () => ({
    publishedGame: jest.fn(),
}));
jest.mock("./gameHealthSummary", () => ({ readFieldHealth: jest.fn() }));

import { fieldReport, type FieldReportDeps } from "./fieldReport";

const slow = {
    release: "r2",
    visits: 100,
    devices: { phone: 100 },
    firstFrameMs: { median: 2000, p95: 4000 },
    frameMs: { median: 45, p95: 80, windows: 30 },
    byDevice: {
        phone: {
            visits: 100,
            firstFrameMs: { median: 2000, p95: 4000 },
            frameMs: { median: 45, p95: 80, windows: 30 },
        },
    },
    loadFailures: 0,
    failures: [] as any[],
};
const fine = { ...slow, release: "r1", frameMs: null, byDevice: {} };

const deps = (patch: Partial<FieldReportDeps> = {}): FieldReportDeps => ({
    game: (async (id: unknown) =>
        id === "sky-run"
            ? ({ id, owner: "0xMaker", current: "r2" } as any)
            : null) as any,
    admin: ((account: string) => account === "0xadmin") as any,
    read: (async (games: string[]) =>
        Object.fromEntries(
            games.map((game) => [
                game,
                { source: "posthog", releases: [fine, slow] },
            ])
        )) as any,
    ...patch,
});

describe("a game's field health, for its maker", () => {
    test("the account that published it gets the numbers and what they ask for", async () => {
        const report = await fieldReport("0xmaker", "sky-run", deps());
        expect(report).toMatchObject({
            id: "sky-run",
            source: "posthog",
            current: "r2",
        });
        // The release on show leads, whatever order they were read in.
        expect(report.releases.map((one) => one.release)).toEqual(["r2", "r1"]);
        expect(report.releases[0].findings[0]).toMatchObject({
            code: "FIELD_FRAMES_SLOW",
            device: "phone",
        });
        expect(report.budgets.frameMedianMs).toBeGreaterThan(30);
    });

    test("nobody else's game, and not a game that is not theirs to ask about", async () => {
        await expect(fieldReport("0xother", "sky-run", deps())).rejects.toThrow(
            /another account's game/
        );
        await expect(fieldReport("0xmaker", "ace", deps())).rejects.toThrow(
            /not a game this account has published/
        );
    });

    test("a site admin may read any game's, the ones in the repository too", async () => {
        const read = jest.fn(deps().read);
        const report = await fieldReport("0xadmin", "ace", deps({ read }));
        expect(read).toHaveBeenCalledWith(["ace"]);
        expect(report.current).toBe(null);
        expect(report.releases).toHaveLength(2);
        expect((await fieldReport("0xadmin", "sky-run", deps())).current).toBe(
            "r2"
        );
    });

    test("says where the numbers are from, and when the real ones could not be read", async () => {
        const report = await fieldReport(
            "0xmaker",
            "sky-run",
            deps({
                read: (async () => ({
                    "sky-run": {
                        source: "local",
                        releases: [],
                        error: "PostHog answered 401",
                    },
                })) as any,
            })
        );
        expect(report).toMatchObject({
            source: "local",
            error: "PostHog answered 401",
            releases: [],
        });
    });
});
