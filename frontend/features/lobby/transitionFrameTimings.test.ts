import {
    TransitionFrameTimings,
    TRANSITION_SAMPLE_LIMIT,
} from "./transitionFrameTimings";
import { TRAVEL_DISSOLVE_AT_MS, WORLD_DISSOLVE_MS } from "./worldTravelTiming";

const departure = {
    phase: "isolate" as const,
    startedAt: 100,
    reducedMotion: false,
};

test("records the first blocked frame and loading CPU work without a warmup exclusion", () => {
    const timing = new TransitionFrameTimings();
    timing.record(departure, 220, 45);
    expect(timing.stats()).toMatchObject({
        frames: 1,
        initialDelayMs: 120,
        recentIntervalP95Ms: 120,
        phases: {
            camera: {
                frames: 1,
                maxIntervalMs: 120,
                maxCpuMs: 45,
                framesOver20Ms: 1,
                framesOver50Ms: 1,
            },
        },
    });
    timing.record(departure, 236, 3);
    expect(timing.stats().phases.camera.frames).toBe(2);
});

test("separates camera, attack, dimming, black and reveal frames", () => {
    const timing = new TransitionFrameTimings();
    const dimAt = departure.startedAt + TRAVEL_DISSOLVE_AT_MS;
    timing.record(departure, 116, 1);
    timing.record({ ...departure, phase: "charge" }, 700, 2);
    timing.record({ ...departure, phase: "charge" }, dimAt, 3);
    timing.record(
        { ...departure, phase: "charge" },
        dimAt + WORLD_DISSOLVE_MS,
        4
    );
    timing.record({ ...departure, phase: "reveal" }, 5400, 5);
    expect(Object.keys(timing.stats().phases)).toEqual([
        "camera",
        "attack",
        "dimming",
        "black",
        "reveal",
    ]);
});

test("excludes hidden time while preserving earlier frames, including hiding before first paint", () => {
    const timing = new TransitionFrameTimings();
    timing.record(departure, 116, 1);
    timing.pause();
    timing.record(departure, 10_000, 2);
    expect(timing.stats()).toMatchObject({
        frames: 2,
        recentIntervalP95Ms: 16,
        phases: { black: { maxIntervalMs: 0, framesOver50Ms: 0 } },
    });
    timing.pause();
    timing.record({ ...departure, startedAt: 11_000 }, 20_000, 2);
    expect(timing.stats().initialDelayMs).toBeUndefined();
    expect(timing.stats().recentIntervalP95Ms).toBeUndefined();
    timing.record({ ...departure, startedAt: 11_000 }, 20_016, 2);
    expect(timing.stats().recentIntervalP95Ms).toBe(16);
});

test("retains lifetime phase maxima and counts with bounded percentile samples", () => {
    const timing = new TransitionFrameTimings();
    timing.record(departure, 220, 80);
    for (let index = 1; index <= TRANSITION_SAMPLE_LIMIT + 10; index++)
        timing.record(departure, 220 + index * 16, 2);
    const stats = timing.stats();
    expect(stats.frames).toBe(TRANSITION_SAMPLE_LIMIT + 11);
    expect(stats.recentFrames).toBe(TRANSITION_SAMPLE_LIMIT);
    expect(stats.recentIntervalP95Ms).toBe(16);
    expect(stats.phases.camera.maxIntervalMs).toBe(120);
    expect(stats.phases.camera.maxCpuMs).toBe(80);
});

test("finishes at cancellation or handoff, preserves evidence and starts a new return", () => {
    const timing = new TransitionFrameTimings();
    timing.record(departure, 116, 1);
    expect(timing.record(undefined, 140, 2)).toBe(true);
    expect(timing.stats()).toMatchObject({ frames: 1, finished: true });
    expect(timing.record(undefined, 156, 2)).toBe(false);
    timing.record({ ...departure, phase: "return", startedAt: 5000 }, 5032, 4);
    expect(timing.stats()).toMatchObject({
        frames: 1,
        finished: false,
        initialDelayMs: 32,
        phases: { return: { frames: 1, maxIntervalMs: 32 } },
    });
    expect(timing.stats().phases.camera).toBeUndefined();
});
