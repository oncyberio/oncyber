import { startLoadTimeline } from "./loadTimings";

jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(async () => {}),
}));

const env = process.env as Record<string, string>;
const originalEnv = env.NODE_ENV;
afterEach(() => {
    env.NODE_ENV = originalEnv;
});

describe("load timings in production", () => {
    beforeEach(() => {
        env.NODE_ENV = "production";
    });

    test("a sampled timeline sends one event with every stage, once", () => {
        const send = jest.fn();
        const load = startLoadTimeline("world", { random: () => 0, send });
        load.mark("engine-ready");
        load.mark("engine-ready");
        load.end("idle-ready", { quality: "mid" });
        load.end("idle-ready");
        expect(send).toHaveBeenCalledTimes(1);
        const event = send.mock.calls[0][0];
        expect(event).toMatchObject({ kind: "world", quality: "mid" });
        expect(Object.keys(event.stages)).toEqual([
            "engine-ready",
            "idle-ready",
        ]);
        expect(event.total).toBe(event.stages["idle-ready"]);
    });

    test("an unsampled, cancelled or unfinished timeline sends nothing", () => {
        const send = jest.fn();
        startLoadTimeline("world", { random: () => 0.99, send }).end("done");
        const cancelled = startLoadTimeline("lobby", { random: () => 0, send });
        cancelled.cancel();
        cancelled.end("done");
        startLoadTimeline("lobby-trip", { random: () => 0, send }).mark("x");
        expect(send).not.toHaveBeenCalled();
    });

    test("a failing analytics call never reaches the load", () => {
        const load = startLoadTimeline("world", {
            random: () => 0,
            send: () => {
                throw new Error("offline");
            },
        });
        expect(() => load.end("done")).not.toThrow();
    });
});

test("in development every timeline is logged and nothing is sent", () => {
    env.NODE_ENV = "development";
    const info = jest.spyOn(console, "info").mockImplementation(() => {});
    const send = jest.fn();
    startLoadTimeline("world", { random: () => 0.99, send }).end("done");
    expect(send).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();
});
