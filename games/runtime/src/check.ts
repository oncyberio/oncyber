import { runScenario, type Json, type RuntimeSession, type Scenario } from "./index.ts";

/**
 * In-frame half of `pnpm games:check`. A game host calls `runCheck` when its
 * page was opened with `?check`: it plays the game's scenario through the
 * lifecycle, measures frames, and posts one report to the parent page. The
 * check script (scripts/games/check.mjs) adds what only the outside can see:
 * console errors, a screenshot and the bundle's size.
 */
export interface CheckStage {
    stage: "boot" | "scenario" | "lifecycle" | "frames";
    status: "passed" | "failed";
    ms: number;
    error?: string;
}
export interface CheckReport {
    version: 1;
    status: "passed" | "failed";
    backend: string;
    bootMs: number;
    stages: CheckStage[];
    frames: { count: number; medianMs: number; p95Ms: number; worstMs: number };
    inspect: Json;
}
export const CHECK_MESSAGE = "oncyber:check-report";

/** Frame timings over `count` real animation frames. */
export async function sampleFrames(count: number, frame: () => Promise<number>) {
    const gaps: number[] = [];
    let last = await frame();
    for (let i = 0; i < count; i++) {
        const now = await frame();
        gaps.push(now - last);
        last = now;
    }
    gaps.sort((a, b) => a - b);
    const at = (q: number) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))] : 0);
    const round = (v: number) => Math.round(v * 10) / 10;
    return { count: gaps.length, medianMs: round(at(0.5)), p95Ms: round(at(0.95)), worstMs: round(gaps[gaps.length - 1] ?? 0) };
}

const message = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 500);

/**
 * `session` must be entered. `frame` resolves on the next animation frame
 * with its timestamp; the host keeps ticking the session as usual while
 * frames are sampled, and must not tick it while the scenario runs (the
 * scenario ticks it itself at a fixed 1/60 s).
 */
export async function runCheck(options: {
    session: RuntimeSession;
    scenario: Scenario;
    backend: string;
    bootMs: number;
    frame: () => Promise<number>;
    pauseHostClock(paused: boolean): void;
    frames?: number;
}): Promise<CheckReport> {
    const { session, scenario, frame } = options;
    const stages: CheckStage[] = [{ stage: "boot", status: session.phase === "entered" ? "passed" : "failed", ms: Math.round(options.bootMs) }];
    let frames = { count: 0, medianMs: 0, p95Ms: 0, worstMs: 0 };
    const timed = async (stage: CheckStage["stage"], run: () => Promise<void>) => {
        const start = performance.now();
        try {
            await run();
            stages.push({ stage, status: "passed", ms: Math.round(performance.now() - start) });
        } catch (error) {
            stages.push({ stage, status: "failed", ms: Math.round(performance.now() - start), error: message(error) });
        }
    };
    if (stages[0].status === "passed") {
        options.pauseHostClock(true);
        // runScenario also suspends, checks that suspended games don't
        // advance, restores and checks the game plays again.
        await timed("scenario", () => runScenario(session, scenario, () => frame().then(() => undefined)));
        if (stages[1].status === "passed") stages.push({ stage: "lifecycle", status: "passed", ms: 0 });
        options.pauseHostClock(false);
        await timed("frames", async () => {
            frames = await sampleFrames(options.frames ?? 180, frame);
            if (session.phase !== "entered") throw new Error(`RUNTIME_${session.phase.toUpperCase()}`);
        });
    }
    let inspect: Json = null;
    try { inspect = session.inspect(); } catch (error) { inspect = { error: message(error) }; }
    return {
        version: 1,
        status: stages.every(s => s.status === "passed") ? "passed" : "failed",
        backend: options.backend,
        bootMs: Math.round(options.bootMs),
        stages,
        frames,
        inspect,
    };
}

/** Sends the report to the page that opened the game with `?check`. */
export function postCheckReport(report: CheckReport) {
    if (window.parent !== window) window.parent.postMessage({ type: CHECK_MESSAGE, report }, "*");
    (window as any).__checkReport = report;
}
