#!/usr/bin/env node
// Which checks does a built game pass? The project's own measure.
//
//   node scripts/games/score.mjs [id ...]     the named games (default: all in games/)
//   node scripts/games/score.mjs --briefs     the twelve fixed briefs in games/briefs.json
//   ... --json                                machine-readable
//
// Reads the last `pnpm games:check <id>` report
// (frontend/public/games/<id>/check.json); it does not run the check.
// A check is one stage of the lifecycle run, one process check, or the
// bundle scan. A game with no report, or one not built, passes none.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Every check in a report, as `{ id, status, messages }`. */
export function checksOf(report) {
    if (!report) return [];
    const checks = [];
    const scanCodes = ["BUNDLE_LARGE", "ASSET_MISSING", "ENTRY_MISSING"];
    const scan = (report.findings ?? []).filter((f) =>
        scanCodes.includes(f.code)
    );
    checks.push({
        id: "bundle",
        status: scan.length ? "failed" : "passed",
        messages: scan.map((f) => `${f.code}: ${f.message}`),
    });
    const stages = report.run?.stages ?? [];
    for (const stage of stages)
        checks.push({
            id: stage.stage,
            status: stage.status,
            messages: stage.error ? [stage.error] : [],
        });
    // A boot-only game never ran these; they count against it.
    for (const stage of ["boot", "scenario", "lifecycle", "frames"])
        if (!stages.some((s) => s.stage === stage))
            checks.push({
                id: stage,
                status: "skipped",
                messages: ["not run: the game is not on the lifecycle"],
            });
    // Any stage that reports `checks` joins the measure, the process stage first.
    for (const [name, value] of Object.entries(report))
        if (value && typeof value === "object" && Array.isArray(value.checks))
            for (const check of value.checks)
                checks.push({
                    id: name === "process" ? check.id : `${name}.${check.id}`,
                    status: check.status,
                    messages: (check.findings ?? []).map(
                        (f) => `${f.code}: ${f.message}`
                    ),
                });
    return checks;
}

export function scoreGame(root, id) {
    const path = join(root, "frontend/public/games", id, "check.json");
    const built = existsSync(join(root, "games", id, "game.json"));
    let report = null;
    try {
        report = JSON.parse(readFileSync(path, "utf8"));
    } catch {
        /* no report */
    }
    const checks = checksOf(report);
    return {
        game: id,
        built,
        checkedAt: report?.checkedAt ?? null,
        status: report?.status ?? (built ? "unchecked" : "not built"),
        passed: checks.filter((c) => c.status === "passed").length,
        total: checks.length,
        checks,
    };
}

export function scoreAll(root, ids) {
    const games = ids.map((id) => scoreGame(root, id));
    // A game with no report is held to as many checks as the fullest report.
    const full = Math.max(0, ...games.map((g) => g.total));
    const passed = games.reduce((sum, g) => sum + g.passed, 0);
    const total = games.reduce((sum, g) => sum + (g.total || full), 0);
    return {
        version: 1,
        games,
        passed,
        total,
        score: total ? Math.round((passed / total) * 1000) / 10 : 0,
    };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = process.argv.slice(2);
    const json = args.includes("--json");
    const briefs = args.includes("--briefs");
    let ids = args.filter((a) => !a.startsWith("--"));
    if (briefs)
        ids = JSON.parse(
            readFileSync(join(repo, "games/briefs.json"), "utf8")
        ).briefs.map((b) => b.id);
    else if (!ids.length)
        ids = readdirSync(join(repo, "games"), { withFileTypes: true })
            .filter(
                (e) =>
                    e.isDirectory() &&
                    existsSync(join(repo, "games", e.name, "game.json"))
            )
            .map((e) => e.name)
            .sort();
    const result = scoreAll(repo, ids);
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
        for (const game of result.games) {
            console.log(
                `${game.game}: ${
                    game.total
                        ? `${game.passed}/${game.total} checks pass`
                        : game.status
                }${
                    game.checkedAt
                        ? ` (checked ${game.checkedAt.slice(0, 10)})`
                        : ""
                }`
            );
            for (const check of game.checks) {
                console.log(
                    `  ${
                        check.status === "passed"
                            ? "pass"
                            : check.status === "skipped"
                            ? "skip"
                            : "FAIL"
                    }  ${check.id}`
                );
                for (const message of check.messages)
                    console.log(`        ${message}`);
            }
        }
        console.log(
            `score: ${result.passed}/${result.total} (${result.score}%)${
                briefs ? " across the twelve briefs" : ""
            }`
        );
    }
}
