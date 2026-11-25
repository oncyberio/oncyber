// The field-health stage of `pnpm games:check` (docs/games/field-health.md).
//
// It proves two things about a build, in the check's browser:
//
//   1. A game that throws after it is ready is recorded. The check asks the
//      game for an uncaught error (only a page opened with ?check can), in
//      the prefix the game greeted in, and waits for the game's `health`
//      report of it to reach the page.
//   2. A disabled game does not load. The page's own decision
//      (frontend/features/games/gameDisabled.ts) is run for this game and this
//      build's release id: listed in GAMES_DISABLED it must pause, by id and
//      by release, and it must play when only something else is listed.
//
// A game that has its own page and reports nothing sets `"health": "none"`
// in game.json; stage 1 is skipped for it and the check says so.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROBE = "ONCYBER_HEALTH_PROBE";

/** Added to the check page: keeps what the game reports about its health. */
export const healthHarness = `<script>
window.__health = [];
addEventListener("message", (event) => {
    if (event.source !== document.getElementById("game").contentWindow) return;
    const type = event.data && event.data.type;
    if (typeof type === "string" && type.endsWith(":health")) window.__health.push(event.data);
});
</script>`;

/** The id `games:publish` gives this set of files. */
export const releaseId = (files) =>
    createHash("sha256")
        .update(files.map((f) => `${f.path}:${f.sha256}`).join("\n"))
        .digest("hex")
        .slice(0, 16);

/** Runs the page's pause decision (TypeScript) for a few GAMES_DISABLED values. */
export function pauseDecisions(id, release) {
    const module = pathToFileURL(
        resolve(root, "frontend/features/games/gameDisabled.ts")
    ).href;
    const cases = {
        byGame: id,
        byRelease: `${id}@${release}`,
        otherRelease: `${id}@not-this-release`,
        otherGame: `not-${id}`,
        unset: "",
    };
    const code = `
        import { gameKillSwitch, killSwitchForRelease, resolveKillSwitch } from ${JSON.stringify(
            module
        )};
        const out = {};
        for (const [name, value] of Object.entries(${JSON.stringify(cases)})) {
            let read = false;
            const decision = await resolveKillSwitch(gameKillSwitch(${JSON.stringify(
                id
            )}, { GAMES_DISABLED: value }),
                async () => { read = true; return ${JSON.stringify(
                    release
                )}; });
            // The same release loaded from a hosted address: its id comes
            // from the game's pointer, so nothing is left to read.
            let hostedRead = false;
            const hosted = await resolveKillSwitch(
                killSwitchForRelease(gameKillSwitch(${JSON.stringify(
                    id
                )}, { GAMES_DISABLED: value }), ${JSON.stringify(release)}),
                async () => { hostedRead = true; return null; });
            out[name] = { decision, read, hosted, hostedRead };
        }
        console.log(JSON.stringify(out));`;
    return JSON.parse(
        execFileSync(
            process.execPath,
            [
                "--experimental-strip-types",
                "--no-warnings",
                "--input-type=module",
                "-e",
                code,
            ],
            { encoding: "utf8" }
        )
    );
}

/**
 * `page` is the check page with the game in its frame, after the game said
 * ready (or reported). Returns findings (each one fails the check) and a
 * summary for check.json.
 */
export async function checkHealth(
    page,
    { id, manifest, files, ready, prefix = `${id}:` }
) {
    const findings = [];
    const summary = {
        reporting: manifest.health !== "none",
        errorRecorded: null,
        paused: null,
    };

    if (summary.reporting && ready) {
        await page.evaluate(
            (type) =>
                document
                    .getElementById("game")
                    .contentWindow.postMessage({ type }, "*"),
            `${prefix || `${id}:`}health-probe`
        );
        const recorded = () =>
            page.evaluate(
                (probe) =>
                    window.__health.some(
                        (m) => m.kind === "error" && m.message === probe
                    ),
                PROBE
            );
        const deadline = Date.now() + 5000;
        summary.errorRecorded = await recorded();
        while (!summary.errorRecorded && Date.now() < deadline) {
            await page.waitForTimeout(100);
            summary.errorRecorded = await recorded();
        }
        if (!summary.errorRecorded)
            findings.push({
                code: "HEALTH_ERROR_NOT_RECORDED",
                message:
                    "an error thrown after ready did not reach the page; call reportHealth() from games/runtime/src/health.ts before the game loads (docs/games/field-health.md)",
            });
    }

    try {
        const d = pauseDecisions(id, releaseId(files));
        const expected = {
            byGame: "paused",
            byRelease: "paused",
            otherRelease: "play",
            otherGame: "play",
            unset: "play",
        };
        const wrong = Object.keys(expected).filter(
            (name) => d[name]?.decision !== expected[name]
        );
        // Pausing a whole game must not wait on reading its release.
        if (d.byGame?.read) wrong.push("byGame read the release");
        // A hosted release (docs/games/releases.md) stops the same way,
        // decided from the pointer's id alone.
        for (const name of Object.keys(expected)) {
            if (d[name]?.hosted !== expected[name])
                wrong.push(`${name} (hosted release)`);
            if (d[name]?.hostedRead)
                wrong.push(`${name} (hosted release) read release.json`);
        }
        summary.paused = wrong.length === 0;
        if (wrong.length)
            findings.push({
                code: "PAUSE_NOT_HONOURED",
                message: `GAMES_DISABLED decided wrongly for: ${wrong.join(
                    ", "
                )}`,
            });
    } catch (error) {
        summary.paused = false;
        findings.push({
            code: "PAUSE_CHECK_FAILED",
            message: String(error?.message ?? error)
                .split("\n")[0]
                .slice(0, 300),
        });
    }
    return { findings, summary };
}
