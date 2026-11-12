import { AvatarTraceRecorder } from "./avatarFeedback";
import handler, { validFeedback } from "../../../pages/api/dev/lobby-feedback";
const actor = {
    id: "7",
    x: 1,
    y: 0,
    z: 2,
    rotation: 0,
    motion: { speed: 3.2, grounded: true },
};
const capture = {
    schemaVersion: 1,
    avatar: { id: "7" },
    notes: "Stops oddly",
    category: "Jerky movement",
    context: { seed: 42, simulationMs: 1000, profile: "regional" },
    frames: [{ ...actor, timeMs: 1000, simulationMs: 1000, dt: 1 / 60 }],
};
test("feedback keeps a bounded pre-click trace and isolates the selected avatar", () => {
    const trace = new AvatarTraceRecorder();
    for (let i = 0; i < 1000; i++)
        trace.record(
            {
                timeMs: (i * 1000) / 60,
                dt: 1 / 60,
                actors: [actor, { ...actor, id: "8", x: -1 }],
            },
            (i * 1000) / 60
        );
    const frames = trace.capture("7");
    expect(frames.length).toBeLessThanOrEqual(241);
    expect(frames.at(-1).timeMs - frames[0].timeMs).toBeLessThanOrEqual(4000);
    expect(frames.every((frame) => frame.x === 1)).toBe(true);
    expect(trace.capture("missing")).toEqual([]);
    frames[0].motion.speed = 900;
    expect(trace.capture("7")[0].motion.speed).toBe(3.2);
});
test("local report validation rejects nonfinite, oversized and empty traces", () => {
    expect(validFeedback(capture)).toBe(true);
    expect(validFeedback({ ...capture, frames: [] })).toBe(false);
    expect(
        validFeedback({
            ...capture,
            frames: Array(301).fill(capture.frames[0]),
        })
    ).toBe(false);
    expect(
        validFeedback({
            ...capture,
            frames: [{ ...capture.frames[0], x: NaN }],
        })
    ).toBe(false);
    expect(validFeedback({ ...capture, notes: "x".repeat(2001) })).toBe(false);
});
test("feedback endpoint refuses production and cross-origin requests before disk access", async () => {
    const old = process.env.NODE_ENV;
    const res: any = {
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
        json: jest.fn(),
    };
    try {
        (process.env as any).NODE_ENV = "production";
        await handler(
            {
                headers: { host: "localhost:13000" },
                method: "POST",
                body: capture,
            } as any,
            res
        );
        expect(res.status).toHaveBeenLastCalledWith(404);
        (process.env as any).NODE_ENV = "development";
        await handler(
            {
                headers: {
                    host: "localhost:13000",
                    origin: "https://elsewhere.invalid",
                },
                method: "POST",
                body: capture,
            } as any,
            res
        );
        expect(res.status).toHaveBeenLastCalledWith(403);
    } finally {
        (process.env as any).NODE_ENV = old;
    }
});
