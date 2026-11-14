import type { FieldHealth } from "./gameHealthSummary";

const muted = { margin: "6px 0", color: "#a8acaf" };

/**
 * Field health on /dev/games: what real visits (or, without PostHog access,
 * this development server's visits) reported for each release of a game.
 */
export default function GameFieldHealth({
    health,
    current,
    pause,
}: {
    health: (FieldHealth & { error?: string }) | null | undefined;
    /** The published release id, to mark its row. */
    current: string | null;
    pause: { paused: boolean; releases: string[] } | null | undefined;
}) {
    const from =
        health?.source === "posthog"
            ? "real visits, last 7 days"
            : "visits on this development server";
    return (
        <div
            data-field-health
            style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid #ffffff18",
            }}
        >
            {(pause?.paused || !!pause?.releases.length) && (
                <p style={{ margin: "6px 0", color: "#ffd23f" }}>
                    Paused by <code>GAMES_DISABLED</code>:{" "}
                    {pause.paused
                        ? "every release"
                        : `release ${pause.releases.join(", ")}`}
                </p>
            )}
            <p style={muted}>Field health ({from})</p>
            {health?.error && (
                <p style={{ margin: "6px 0", color: "#ffa59d" }}>
                    Couldn’t read PostHog: {health.error}
                </p>
            )}
            {!health?.releases.length && (
                <p style={muted}>Nothing reported yet.</p>
            )}
            {health?.releases.map((row) => (
                <div key={row.release} style={{ margin: "10px 0" }}>
                    <p style={{ margin: "4px 0" }}>
                        <code>{row.release}</code>
                        {row.release === current ? " (published)" : ""} ·{" "}
                        {row.visits} visit{row.visits === 1 ? "" : "s"}
                        {Object.keys(row.devices).length > 0 &&
                            ` (${Object.entries(row.devices)
                                .map(([device, count]) => `${count} ${device}`)
                                .join(", ")})`}
                        {row.loadFailures > 0 && (
                            <span style={{ color: "#ffa59d" }}>
                                {" "}
                                · {row.loadFailures} failed to load
                            </span>
                        )}
                    </p>
                    <p style={muted}>
                        {row.firstFrameMs
                            ? `first frame median ${row.firstFrameMs.median} ms, p95 ${row.firstFrameMs.p95} ms`
                            : "no first frame yet"}
                        {row.frameMs &&
                            ` · frame time median ${row.frameMs.median} ms, p95 ${row.frameMs.p95} ms over ${row.frameMs.windows} × 20 s`}
                    </p>
                    {row.failures.map((failure, i) => (
                        <p
                            key={i}
                            style={{ margin: "4px 0", color: "#ffa59d" }}
                        >
                            {failure.count}× {failure.kind}:{" "}
                            <code>{failure.message}</code>
                            {failure.where && ` (${failure.where})`}
                        </p>
                    ))}
                </div>
            ))}
        </div>
    );
}
