// `oncyber health`: a published game's field health, as lines for a person
// or an agent to read (docs/games/field-health.md, "Reading it back").

const fps = (ms) => Math.round(1000 / ms);

/** Findings that are about the numbers themselves, not something to fix. */
const NOTES = new Set(["FIELD_NO_VISITS", "FIELD_FEW_VISITS"]);

/** Whether the release visitors get now has something to fix. */
export function needsWork(report) {
    const onShow =
        report.releases.find((one) => one.release === report.current) ??
        report.releases[0];
    return !!onShow?.findings.some((found) => !NOTES.has(found.code));
}

function releaseLines(release, report) {
    const lines = [];
    const devices = Object.entries(release.devices)
        .sort((a, b) => b[1] - a[1])
        .map(([device, count]) => `${device} ${count}`)
        .join(", ");
    lines.push(
        `release ${release.release}${
            release.release === report.current ? " (on show)" : ""
        }: ${release.visits} visit${release.visits === 1 ? "" : "s"}${
            devices ? ` (${devices})` : ""
        }`
    );
    for (const [device, seen] of Object.entries(release.byDevice)) {
        const parts = [];
        if (seen.firstFrameMs)
            parts.push(
                `first frame ${seen.firstFrameMs.median} ms usual, ${seen.firstFrameMs.p95} ms slowest`
            );
        if (seen.frameMs)
            parts.push(
                `frames ${seen.frameMs.median} ms usual (${fps(
                    seen.frameMs.median
                )} fps), ${seen.frameMs.p95} ms slow`
            );
        if (parts.length) lines.push(`  ${device}: ${parts.join("; ")}`);
    }
    if (release.loadFailures)
        lines.push(`  never reached a first frame: ${release.loadFailures}`);
    if (!release.findings.length)
        lines.push("  within its budgets: nothing to fix");
    for (const found of release.findings)
        lines.push(`  ${found.code}: ${found.text}`);
    return lines;
}

/** The report as lines: the release on show in full, older ones after it. */
export function healthLines(report, site) {
    const lines = [
        `${report.id} on ${site}: field health, from ${
            report.source === "posthog"
                ? "real visits of the last seven days"
                : "this development server's own visits"
        }`,
        `budgets: first frame ${report.budgets.firstFrameP95Ms} ms for the slowest visits; a usual frame ${report.budgets.frameMedianMs} ms (30 fps); slow frames ${report.budgets.frameP95Ms} ms`,
    ];
    if (report.error) lines.push(`note: ${report.error}`);
    if (!report.releases.length)
        lines.push(
            "No visits have reported yet. Look again once people have played."
        );
    for (const release of report.releases)
        lines.push("", ...releaseLines(release, report));
    return lines;
}
