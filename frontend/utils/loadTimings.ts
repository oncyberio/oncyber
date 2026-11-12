/**
 * Load timings from real visits, sent to PostHog (the app's only analytics).
 *
 * A load (opening a world, a lobby trip, the lobby itself) starts a timeline,
 * marks named stages as it goes, and ends once. In development every timeline
 * is logged to the console; in production a sampled share of timelines is
 * sent as one PostHog event, `load timings`, with each stage's milliseconds
 * since the timeline started. Nothing is sent per stage, and a timeline that
 * never ends sends nothing.
 *
 *     const load = startLoadTimeline("world");
 *     load.mark("engine-ready");
 *     load.mark("scene-assets-start");
 *     load.end("idle-ready", { quality: "low" });
 *
 * Stage names are short kebab-case strings and stay stable over time, because
 * dashboards compare them across releases. The world load's names are the
 * ones Scene3D has always used for its development marks.
 */
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

export type LoadTimelineKind = "world" | "lobby" | "lobby-trip";

/** Share of timelines sent in production. 0.05 is one visit in twenty. */
export const LOAD_TIMINGS_SAMPLE_RATE = 0.05;

/** Never send more than this many stages, whatever a caller does. */
const MAX_STAGES = 40;

export interface LoadTimeline {
    readonly kind: LoadTimelineKind;
    /** Records a stage once; later marks of the same name are ignored. */
    mark(stage: string): void;
    /** Records the final stage and sends the timeline (if sampled). Once. */
    end(stage: string, details?: Record<string, unknown>): void;
    /** Abandons the timeline (navigation away, cancel): nothing is sent. */
    cancel(): void;
    /** The stages so far, in milliseconds since the timeline started. */
    readonly stages: Readonly<Record<string, number>>;
}

const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

const isDevelopment = () => process.env.NODE_ENV === "development";

export function startLoadTimeline(
    kind: LoadTimelineKind,
    {
        sampleRate = LOAD_TIMINGS_SAMPLE_RATE,
        random = Math.random,
        send = sendTimeline,
    }: {
        sampleRate?: number;
        random?: () => number;
        send?: (event: LoadTimingsEvent) => void;
    } = {}
): LoadTimeline {
    const started = now();
    const stages: Record<string, number> = {};
    let finished = false;
    // Decided once at the start, so a timeline is either complete or absent.
    const sampled = isDevelopment() || random() < sampleRate;

    const record = (stage: string) => {
        if (finished || !stage || stage in stages) return;
        if (Object.keys(stages).length >= MAX_STAGES) return;
        stages[stage] = Math.round(now() - started);
    };

    return {
        kind,
        stages,
        mark: record,
        end(stage, details = {}) {
            record(stage);
            if (finished) return;
            finished = true;
            if (!sampled) return;
            const event: LoadTimingsEvent = {
                kind,
                total: stages[stage] ?? Math.round(now() - started),
                stages: { ...stages },
                ...details,
            };
            if (isDevelopment()) {
                console.info(`[load timings] ${kind}`, event);
                return;
            }
            try {
                send(event);
            } catch {
                // Analytics must never break a load.
            }
        },
        cancel() {
            finished = true;
        },
    };
}

export type LoadTimingsEvent = {
    kind: LoadTimelineKind;
    total: number;
    stages: Record<string, number>;
    [detail: string]: unknown;
};

function sendTimeline(event: LoadTimingsEvent) {
    void amplitude_logAnalyticsEvent("load_timings", event).catch(() => {});
}
