jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(async () => {}),
}));
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import {
    createGameHealth,
    gameDevice,
    sendGameHealth,
    type GameHealthEvent,
} from "./gameHealth";
import {
    fetchPosthogGameHealth,
    readFieldHealth,
    readGameHealthEvent,
    summarizeGameHealth,
} from "./gameHealthSummary";

function visit(options: { random?: number; release?: string | null } = {}) {
    const sent: GameHealthEvent[] = [];
    let clock = 0;
    const health = createGameHealth({
        game: "ace",
        device: "desktop",
        send: (event) => sent.push(event),
        now: () => clock,
        random: () => options.random ?? 0,
    });
    if (options.release !== null) health.setRelease(options.release ?? "r1");
    return { health, sent, at: (ms: number) => (clock = ms) };
}
const base = { game: "ace", release: "r1", device: "desktop" };

describe("game health, per visit", () => {
    it("records the time to the first frame once", () => {
        const { health, sent, at } = visit();
        at(1840);
        health.ready();
        at(5000);
        health.ready();
        expect(sent).toEqual([{ ...base, kind: "first-frame", ms: 1840 }]);
    });

    it("records a game that throws after ready", () => {
        const { health, sent, at } = visit();
        health.report({ kind: "error", message: "early", where: "a.js:1" });
        at(900);
        health.ready();
        health.report({
            kind: "error",
            message: "TypeError: ball is undefined",
            where: "index-abc.js:120",
            // Anything else the frame adds is not forwarded.
            save: '{"coins":4}',
            name: "Rayan",
        });
        expect(sent).toEqual([
            {
                ...base,
                kind: "error",
                message: "early",
                where: "a.js:1",
                afterReady: false,
            },
            { ...base, kind: "first-frame", ms: 900 },
            {
                ...base,
                kind: "error",
                message: "TypeError: ball is undefined",
                where: "index-abc.js:120",
                afterReady: true,
            },
        ]);
    });

    it("records failed lifecycle stages, and only stages it knows", () => {
        const { health, sent } = visit();
        health.report({
            kind: "stage",
            stage: "prepare",
            message: "RUNTIME_TIMEOUT",
        });
        health.report({
            kind: "stage",
            stage: "prepare",
            message: "RUNTIME_TIMEOUT",
        });
        health.report({ kind: "stage", stage: "<script>", message: "x" });
        health.report({ kind: "stage", stage: "update" });
        expect(sent).toEqual([
            {
                ...base,
                kind: "stage-failed",
                stage: "prepare",
                message: "RUNTIME_TIMEOUT",
                where: "",
            },
        ]);
    });

    it("cuts messages to size and stops after ten failures", () => {
        const { health, sent } = visit();
        health.report({ kind: "error", message: "x".repeat(5000) });
        expect((sent[0] as any).message).toHaveLength(200);
        for (let i = 0; i < 40; i++)
            health.report({ kind: "error", message: `e${i}` });
        expect(sent).toHaveLength(10);
    });

    it("sends frame times for sampled visits, after loading, with sane numbers", () => {
        const window = {
            kind: "frames",
            count: 1200,
            medianMs: 16.7,
            p95Ms: 21.4,
        };
        const sampled = visit({ random: 0.1 });
        sampled.health.report(window);
        sampled.at(1000);
        sampled.health.ready();
        sampled.at(15000);
        sampled.health.report(window);
        expect(sampled.sent.filter((e) => e.kind === "frames")).toEqual([]);
        sampled.at(21000);
        sampled.health.report(window);
        sampled.health.report({ ...window, medianMs: NaN });
        sampled.health.report({ ...window, medianMs: 30, p95Ms: 10 });
        sampled.health.report({ ...window, count: 0 });
        expect(sampled.sent.filter((e) => e.kind === "frames")).toEqual([
            {
                ...base,
                kind: "frames",
                medianMs: 16.7,
                p95Ms: 21.4,
                frames: 1200,
            },
        ]);
        for (let i = 0; i < 100; i++) sampled.health.report(window);
        expect(sampled.sent.filter((e) => e.kind === "frames")).toHaveLength(
            30
        );

        const skipped = visit({ random: 0.9 });
        skipped.health.ready();
        skipped.at(60000);
        skipped.health.report(window);
        skipped.health.report({ kind: "error", message: "still sent" });
        expect(skipped.sent.map((e) => e.kind)).toEqual([
            "first-frame",
            "error",
        ]);
    });

    it("holds events until the release is known, and reports load failures once", () => {
        const { health, sent, at } = visit({ release: null });
        health.loadFailed("error");
        health.loadFailed("timeout");
        expect(sent).toEqual([]);
        health.setRelease(null);
        expect(sent).toEqual([
            {
                ...base,
                release: "unknown",
                kind: "load-failed",
                reason: "error",
            },
        ]);
        at(10);
        health.ready();
        health.loadFailed("timeout");
        health.dispose();
        health.report({ kind: "error", message: "late" });
        expect(sent).toHaveLength(2);
    });

    it("names the device type", () => {
        expect(
            gameDevice({
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
            })
        ).toBe("phone");
        expect(
            gameDevice({
                userAgent:
                    "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari",
            })
        ).toBe("phone");
        expect(
            gameDevice({
                userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X710) Safari",
            })
        ).toBe("tablet");
        expect(
            gameDevice({
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                maxTouchPoints: 5,
            })
        ).toBe("tablet");
        expect(
            gameDevice({
                userAgent:
                    "Mozilla/5.0 (X11; Linux x86_64; Quest 3) OculusBrowser/33",
            })
        ).toBe("headset");
        expect(
            gameDevice({
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                maxTouchPoints: 0,
            })
        ).toBe("desktop");
    });
});

describe("sending game health", () => {
    const env = process.env as Record<string, string | undefined>;
    const before = { ...process.env };
    afterEach(() => {
        env.NODE_ENV = before.NODE_ENV;
        env.NEXT_PUBLIC_POSTHOG_KEY = before.NEXT_PUBLIC_POSTHOG_KEY;
        jest.clearAllMocks();
    });
    const event = { ...base, kind: "first-frame", ms: 5 } as GameHealthEvent;

    it("sends nothing when no analytics key is configured", () => {
        env.NODE_ENV = "production";
        delete env.NEXT_PUBLIC_POSTHOG_KEY;
        sendGameHealth(event);
        expect(amplitude_logAnalyticsEvent).not.toHaveBeenCalled();
    });

    it("sends through the app's analytics when there is a key", () => {
        env.NODE_ENV = "production";
        env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
        sendGameHealth(event);
        expect(amplitude_logAnalyticsEvent).toHaveBeenCalledWith(
            "game_health",
            event
        );
    });
});

describe("field health on /dev/games", () => {
    const events = [
        { ...base, kind: "first-frame", ms: 1000 },
        { ...base, kind: "first-frame", ms: 3000, device: "phone" },
        { ...base, kind: "frames", medianMs: 16, p95Ms: 20, frames: 1200 },
        { ...base, kind: "frames", medianMs: 33, p95Ms: 60, frames: 600 },
        { ...base, kind: "frames", medianMs: 17, p95Ms: 24, frames: 1100 },
        {
            ...base,
            kind: "error",
            message: "boom",
            where: "a.js:1",
            afterReady: true,
        },
        {
            ...base,
            kind: "error",
            message: "boom",
            where: "a.js:1",
            afterReady: true,
        },
        {
            ...base,
            kind: "stage-failed",
            stage: "update",
            message: "nan",
            where: "",
        },
        { ...base, kind: "load-failed", reason: "timeout" },
        { ...base, release: "r2", kind: "first-frame", ms: 700 },
        { ...base, game: "garden", kind: "first-frame", ms: 1 },
    ] as GameHealthEvent[];

    it("rolls events up per release", () => {
        expect(summarizeGameHealth(events, "ace")).toEqual([
            {
                release: "r2",
                visits: 1,
                devices: { desktop: 1 },
                firstFrameMs: { median: 700, p95: 700 },
                frameMs: null,
                loadFailures: 0,
                failures: [],
            },
            {
                release: "r1",
                visits: 2,
                devices: { desktop: 1, phone: 1 },
                firstFrameMs: { median: 3000, p95: 3000 },
                frameMs: { median: 17, p95: 24, windows: 3 },
                loadFailures: 1,
                failures: [
                    {
                        kind: "error",
                        message: "boom",
                        where: "a.js:1",
                        count: 2,
                    },
                    {
                        kind: "update failed",
                        message: "nan",
                        where: "",
                        count: 1,
                    },
                ],
            },
        ]);
    });

    it("stores only known, bounded fields", () => {
        expect(
            readGameHealthEvent({
                ...base,
                kind: "error",
                message: "m".repeat(999),
                where: "a.js:1",
                afterReady: "yes",
                userId: "u1",
            })
        ).toEqual({
            ...base,
            kind: "error",
            message: "m".repeat(200),
            where: "a.js:1",
            afterReady: false,
        });
        expect(readGameHealthEvent({ ...base, kind: "pageview" })).toBeNull();
        expect(
            readGameHealthEvent({ ...base, game: "../x", kind: "error" })
        ).toBeNull();
    });

    it("reads PostHog only when a personal key and project are set", async () => {
        const fetcher = jest.fn(async () => ({
            ok: true,
            json: async () => ({
                results: [
                    [
                        "ace",
                        "r1",
                        "phone",
                        "first-frame",
                        "1200",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                    ],
                    [
                        "ace",
                        "r1",
                        "phone",
                        "error",
                        null,
                        null,
                        null,
                        null,
                        "boom",
                        "a.js:2",
                        "true",
                        null,
                        null,
                    ],
                    [
                        "ace",
                        "r1",
                        "phone",
                        "nonsense",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                    ],
                ],
            }),
        })) as any;
        expect(await fetchPosthogGameHealth({}, fetcher)).toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
        const env = {
            POSTHOG_PERSONAL_API_KEY: "phx_test",
            POSTHOG_PROJECT_ID: "42",
        };
        const health = await readFieldHealth(["ace"], env, fetcher);
        expect(fetcher.mock.calls[0][0]).toBe(
            "https://us.posthog.com/api/projects/42/query/"
        );
        expect(fetcher.mock.calls[0][1].headers.authorization).toBe(
            "Bearer phx_test"
        );
        expect(health.ace.source).toBe("posthog");
        expect(health.ace.releases[0]).toMatchObject({
            release: "r1",
            visits: 1,
            devices: { phone: 1 },
            firstFrameMs: { median: 1200, p95: 1200 },
            failures: [
                { kind: "error", message: "boom", where: "a.js:2", count: 1 },
            ],
        });
    });

    it("falls back to local visits and says why when PostHog fails", async () => {
        const failing = (async () => ({ ok: false, status: 401 })) as any;
        const health = await readFieldHealth(
            ["ace"],
            { POSTHOG_PERSONAL_API_KEY: "phx_bad", POSTHOG_PROJECT_ID: "42" },
            failing
        );
        expect(health.ace).toEqual({
            source: "local",
            releases: [],
            error: "PostHog answered 401",
        });
    });
});
