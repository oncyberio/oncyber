import type { GameKillSwitch } from "./gameDisabled";
import type { FieldHealth } from "./gameHealthSummary";
import { gameChrome } from "../interface/gameChrome";

const muted = { margin: "6px 0", color: gameChrome.color.muted };

/**
 * Field health on /dev/games: what real visits (or, without PostHog access,
 * this development server's visits) reported for each release of a game.
 */
export default function GameFieldHealth({
    health,
    current,
    killSwitch,
}: {
    health: (FieldHealth & { error?: string }) | null | undefined;
    /** The published release id, to mark its row. */
    current: string | null;
    /** `GAMES_DISABLED` for this game (gameDisabled.ts). */
    killSwitch: GameKillSwitch | null | undefined;
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
                borderTop: `1px solid ${gameChrome.color.line}`,
            }}
        >
            {(killSwitch?.paused || !!killSwitch?.releases.length) && (
                <p style={{ margin: "6px 0", color: gameChrome.color.warning }}>
                    Paused by <code>GAMES_DISABLED</code>:{" "}
                    {killSwitch.paused
                        ? "every release"
                        : `release ${killSwitch.releases.join(", ")}`}
                </p>
            )}
            <p style={muted}>Field health ({from})</p>
            {health?.error && (
                <p style={{ margin: "6px 0", color: gameChrome.color.error }}>
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
                            <span style={{ color: gameChrome.color.error }}>
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
                            style={{
                                margin: "4px 0",
                                color: gameChrome.color.error,
                            }}
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
