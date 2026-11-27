/**
 * Field health as /dev/games shows it: `game health` events (gameHealth.ts)
 * rolled up per game and release. Two sources:
 *
 *   - PostHog, when `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` are
 *     set on this machine: real visits from the last seven days.
 *   - Otherwise, the visits made on this development server since it
 *     started (kept in memory by /api/dev/game-health).
 *
 * Server-side only.
 */
import type { GameHealthEvent } from "./gameHealth";

export interface ReleaseHealth {
    release: string;
    /** Visits that drew a first frame. */
    visits: number;
    devices: Record<string, number>;
    firstFrameMs: { median: number; p95: number } | null;
    /** Over 20 s windows: the median of medians and the median of p95s. */
    frameMs: { median: number; p95: number; windows: number } | null;
    /**
     * The same numbers for each kind of device that visited: a game that
     * runs well on a desktop and badly on a phone looks fine on average.
     */
    byDevice: Record<string, DeviceHealth>;
    loadFailures: number;
    /** Most frequent first. */
    failures: Array<{
        kind: string;
        message: string;
        where: string;
        count: number;
    }>;
}
export interface DeviceHealth {
    visits: number;
    firstFrameMs: { median: number; p95: number } | null;
    frameMs: { median: number; p95: number; windows: number } | null;
}
export interface FieldHealth {
    source: "posthog" | "local";
    releases: ReleaseHealth[];
}

const KINDS = ["first-frame", "frames", "error", "stage-failed", "load-failed"];
const short = (value: unknown, max: number) =>
    typeof value === "string" ? value.slice(0, max) : "";
const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null;

/** An event as it may be stored: known fields only, bounded. Null if it isn't one. */
export function readGameHealthEvent(value: any): GameHealthEvent | null {
    if (
        !value ||
        typeof value !== "object" ||
        !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.game) ||
        !KINDS.includes(value.kind)
    )
        return null;
    return {
        game: value.game,
        release: short(value.release, 64) || "unknown",
        device: short(value.device, 16) || "desktop",
        kind: value.kind,
        ...(value.kind === "first-frame" && { ms: number(value.ms) ?? 0 }),
        ...(value.kind === "frames" && {
            medianMs: number(value.medianMs) ?? 0,
            p95Ms: number(value.p95Ms) ?? 0,
            frames: number(value.frames) ?? 0,
        }),
        ...(value.kind === "error" && {
            message: short(value.message, 200),
            where: short(value.where, 100),
            afterReady: value.afterReady === true,
        }),
        ...(value.kind === "stage-failed" && {
            stage: short(value.stage, 16),
            message: short(value.message, 200),
            where: short(value.where, 100),
        }),
        ...(value.kind === "load-failed" && {
            reason: value.reason === "timeout" ? "timeout" : "error",
        }),
    } as GameHealthEvent;
}

function quantile(values: number[], q: number) {
    const sorted = [...values].sort((a, b) => a - b);
    // Tenths: frame times differ by less than a millisecond.
    return (
        Math.round(
            sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] *
                10
        ) / 10
    );
}

/** One game's events, per release, newest release activity first. */
export function summarizeGameHealth(
    events: GameHealthEvent[],
    game: string
): ReleaseHealth[] {
    const releases = new Map<string, GameHealthEvent[]>();
    for (const event of events) {
        if (event.game !== game) continue;
        releases.set(event.release, [
            ...(releases.get(event.release) ?? []),
            event,
        ]);
    }
    return [...releases.entries()].reverse().map(([release, list]) => {
        const firsts: number[] = [];
        const medians: number[] = [];
        const p95s: number[] = [];
        const devices: Record<string, number> = {};
        const perDevice: Record<
            string,
            { firsts: number[]; medians: number[]; p95s: number[] }
        > = {};
        const of = (device: string) =>
            (perDevice[device] ??= { firsts: [], medians: [], p95s: [] });
        const failures = new Map<string, ReleaseHealth["failures"][number]>();
        let loadFailures = 0;
        for (const event of list) {
            if (event.kind === "first-frame") {
                firsts.push(event.ms);
                of(event.device).firsts.push(event.ms);
                devices[event.device] = (devices[event.device] ?? 0) + 1;
            } else if (event.kind === "frames") {
                medians.push(event.medianMs);
                p95s.push(event.p95Ms);
                of(event.device).medians.push(event.medianMs);
                of(event.device).p95s.push(event.p95Ms);
            } else if (event.kind === "load-failed") {
                loadFailures++;
            } else {
                const kind =
                    event.kind === "error"
                        ? event.afterReady
                            ? "error"
                            : "error while loading"
                        : `${event.stage} failed`;
                const key = `${kind}|${event.message}|${event.where}`;
                const entry = failures.get(key) ?? {
                    kind,
                    message: event.message,
                    where: event.where,
                    count: 0,
                };
                entry.count++;
                failures.set(key, entry);
            }
        }
        const first = (values: number[]) =>
            values.length
                ? { median: quantile(values, 0.5), p95: quantile(values, 0.95) }
                : null;
        const paced = (middles: number[], tails: number[]) =>
            middles.length
                ? {
                      median: quantile(middles, 0.5),
                      p95: quantile(tails, 0.5),
                      windows: middles.length,
                  }
                : null;
        return {
            release,
            visits: firsts.length,
            devices,
            firstFrameMs: first(firsts),
            frameMs: paced(medians, p95s),
            byDevice: Object.fromEntries(
                Object.entries(perDevice).map(([device, seen]) => [
                    device,
                    {
                        visits: seen.firsts.length,
                        firstFrameMs: first(seen.firsts),
                        frameMs: paced(seen.medians, seen.p95s),
                    },
                ])
            ),
            loadFailures,
            failures: [...failures.values()]
                .sort((a, b) => b.count - a.count)
                .slice(0, 8),
        };
    });
}

// The development server's own visits. On globalThis so it survives hot reloads.
const LOCAL_MAX = 2000;
const store = globalThis as { __gameHealthEvents?: GameHealthEvent[] };
export function recordLocalGameHealth(event: GameHealthEvent) {
    const events = (store.__gameHealthEvents ??= []);
    events.push(event);
    if (events.length > LOCAL_MAX) events.splice(0, events.length - LOCAL_MAX);
}

/** The last seven days of `game health` events from PostHog. */
export async function fetchPosthogGameHealth(
    env: Record<string, string | undefined> = process.env,
    fetcher: typeof fetch = fetch
): Promise<GameHealthEvent[] | null> {
    const key = env.POSTHOG_PERSONAL_API_KEY;
    const project = env.POSTHOG_PROJECT_ID;
    if (!key || !project || !/^\d+$/.test(project)) return null;
    const host = (env.POSTHOG_API_HOST || "https://us.posthog.com").replace(
        /\/+$/,
        ""
    );
    const fields = [
        "game",
        "release",
        "device",
        "kind",
        "ms",
        "medianMs",
        "p95Ms",
        "frames",
        "message",
        "where",
        "afterReady",
        "stage",
        "reason",
    ];
    const response = await fetcher(`${host}/api/projects/${project}/query/`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            query: {
                kind: "HogQLQuery",
                query: `select ${fields
                    .map((field) => `properties.${field}`)
                    .join(
                        ", "
                    )} from events where event = 'game health' and timestamp > now() - interval 7 day order by timestamp asc limit 20000`,
            },
        }),
        signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`PostHog answered ${response.status}`);
    const rows: unknown[][] = (await response.json())?.results ?? [];
    return rows.flatMap((row) => {
        const event = readGameHealthEvent(
            Object.fromEntries(
                fields.map((field, i) => {
                    const value = row[i];
                    // Property values may come back as strings.
                    return [
                        field,
                        typeof value === "string" &&
                        ["ms", "medianMs", "p95Ms", "frames"].includes(field)
                            ? Number(value)
                            : field === "afterReady"
                            ? value === true || value === "true"
                            : value,
                    ];
                })
            )
        );
        return event ? [event] : [];
    });
}

/** Field health for the games on /dev/games, by game id. */
export async function readFieldHealth(
    games: string[],
    env: Record<string, string | undefined> = process.env,
    fetcher: typeof fetch = fetch
): Promise<Record<string, FieldHealth & { error?: string }>> {
    let source: FieldHealth["source"] = "local";
    let events = store.__gameHealthEvents ?? [];
    let error: string | undefined;
    try {
        const remote = await fetchPosthogGameHealth(env, fetcher);
        if (remote) {
            source = "posthog";
            events = remote;
        }
    } catch (reason) {
        error = String((reason as Error)?.message ?? reason).slice(0, 200);
    }
    return Object.fromEntries(
        games.map((game) => [
            game,
            {
                source,
                releases: summarizeGameHealth(events, game),
                ...(error && { error }),
            },
        ])
    );
}
