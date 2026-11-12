import type { LobbyTravelPresentation } from "./sceneTypes";
import {
    TRAVEL_ISOLATE_MS,
    TRAVEL_DISSOLVE_AT_MS,
    WORLD_DISSOLVE_MS,
} from "./worldTravelTiming";

type Travel = Pick<
    LobbyTravelPresentation,
    "phase" | "startedAt" | "dissolveStartedAt" | "reducedMotion"
>;
type Phase = "camera" | "attack" | "dimming" | "black" | "reveal" | "return";
interface PhaseStats {
    frames: number;
    maxIntervalMs: number;
    maxCpuMs: number;
    framesOver20Ms: number;
    framesOver50Ms: number;
}
interface Sample {
    intervalMs?: number;
    cpuMs: number;
}
export const TRANSITION_SAMPLE_LIMIT = 600;
const round = (value: number) => Math.round(value * 10) / 10;
function phaseAt(travel: Travel, time: number): Phase {
    if (travel.phase === "return" || travel.phase === "reveal")
        return travel.phase;
    if (travel.reducedMotion) return "black";
    if (time - travel.startedAt < TRAVEL_ISOLATE_MS) return "camera";
    const dimAt =
        travel.dissolveStartedAt ?? travel.startedAt + TRAVEL_DISSOLVE_AT_MS;
    if (time < dimAt) return "attack";
    return time < dimAt + WORLD_DISSOLVE_MS ? "dimming" : "black";
}

/**
 * Source-canvas diagnostics, including loading and the click-to-first-frame gap.
 * Counts/maxima cover the whole transition; percentiles cover bounded recent
 * samples. These measure CPU submission and frame spacing, not GPU execution.
 */
export class TransitionFrameTimings {
    private startedAt: number;
    private lastFrame: number;
    private initialDelayMs: number;
    private skipInterval = false;
    private finished = true;
    private phase: Phase;
    private phases: Partial<Record<Phase, PhaseStats>> = {};
    private samples: Sample[] = [];
    private frames = 0;

    pause() {
        // Keep prior evidence but never count a hidden/inactive interval as jank.
        this.lastFrame = undefined;
        this.skipInterval = true;
    }
    finish() {
        const changed = !this.finished;
        this.finished = true;
        this.lastFrame = undefined;
        return changed;
    }
    record(travel: Travel | undefined, time: number, cpuMs: number) {
        if (!travel) {
            this.skipInterval = false;
            return this.finish();
        }
        const fresh = travel.startedAt !== this.startedAt;
        if (fresh) {
            this.startedAt = travel.startedAt;
            this.initialDelayMs = undefined;
            this.lastFrame = undefined;
            this.phases = {};
            this.samples = [];
            this.frames = 0;
        }
        const phase = phaseAt(travel, time);
        const changed = fresh || this.finished || phase !== this.phase;
        const intervalMs = this.skipInterval
            ? undefined
            : this.lastFrame !== undefined
            ? Math.max(0, time - this.lastFrame)
            : fresh
            ? Math.max(0, time - travel.startedAt)
            : undefined;
        if (fresh) this.initialDelayMs = intervalMs;
        this.skipInterval = false;
        this.finished = false;
        this.lastFrame = time;
        this.phase = phase;
        this.frames++;
        const stats = (this.phases[phase] ||= {
            frames: 0,
            maxIntervalMs: 0,
            maxCpuMs: 0,
            framesOver20Ms: 0,
            framesOver50Ms: 0,
        });
        stats.frames++;
        stats.maxCpuMs = Math.max(stats.maxCpuMs, cpuMs);
        if (intervalMs !== undefined) {
            stats.maxIntervalMs = Math.max(stats.maxIntervalMs, intervalMs);
            if (intervalMs > 20) stats.framesOver20Ms++;
            if (intervalMs > 50) stats.framesOver50Ms++;
        }
        this.samples.push({ intervalMs, cpuMs });
        if (this.samples.length > TRANSITION_SAMPLE_LIMIT) this.samples.shift();
        return changed;
    }
    stats() {
        if (this.startedAt === undefined) return undefined;
        const p95 = (values: number[]) => {
            values.sort((a, b) => a - b);
            return values.length
                ? round(values[Math.ceil(values.length * 0.95) - 1])
                : undefined;
        };
        return {
            startedAt: this.startedAt,
            finished: this.finished,
            phase: this.phase,
            frames: this.frames,
            initialDelayMs:
                this.initialDelayMs === undefined
                    ? undefined
                    : round(this.initialDelayMs),
            recentFrames: this.samples.length,
            recentIntervalP95Ms: p95(
                this.samples.flatMap(({ intervalMs }) =>
                    intervalMs === undefined ? [] : [intervalMs]
                )
            ),
            recentCpuP95Ms: p95(this.samples.map(({ cpuMs }) => cpuMs)),
            phases: Object.fromEntries(
                Object.entries(this.phases).map(([phase, stats]) => [
                    phase,
                    {
                        ...stats,
                        maxIntervalMs: round(stats.maxIntervalMs),
                        maxCpuMs: round(stats.maxCpuMs),
                    },
                ])
            ),
        };
    }
}
