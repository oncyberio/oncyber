#!/usr/bin/env node
// Which checks does a built game pass? The project's own measure.
//
//   node scripts/games/score.mjs [id ...]     the named games (default: all in games/)
//   node scripts/games/score.mjs --briefs     the twelve fixed briefs in games/briefs.json
//   ... --json                                machine-readable
//
// Reads the last `pnpm games:check <id>` report
// (frontend/public/game-builds/<id>/check.json); it does not run the check.
// A check is the bundle scan, the contract, one stage of the lifecycle run,
// one of the stages the areas add (sound, loading, departure, results,
// social, keys, safe area, devices, locomotion, avatars, party, saved
// data) or one process check, in the order docs/games/good-game.md lists
// under "Done". A stage a report does not have is not counted. A game with
// no report, or one not built, passes none.
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
    const owned = (test) =>
        (report.findings ?? [])
            .filter((f) => test(f.code))
            .map((f) => `${f.code}: ${f.message}`);
    // The one contract: read before the game runs, and again from enter().
    if (report.contract) {
        const messages = owned(
            (code) =>
                code.startsWith("CONTRACT_") || code.startsWith("SCENARIO_")
        );
        checks.push({
            id: "contract",
            status: messages.length ? "failed" : "passed",
            messages,
        });
    }
    const stages = report.run?.stages ?? [];
    const ran = (name) => stages.find((s) => s.stage === name);
    const stage = (name) => {
        const found = ran(name);
        if (found)
            checks.push({
                id: found.stage,
                status: found.status,
                messages: found.error ? [found.error] : [],
            });
        return found;
    };
    // A boot-only game never ran these; they count against it.
    for (const name of ["boot", "scenario", "lifecycle", "frames"])
        if (!stage(name))
            checks.push({
                id: name,
                status: "skipped",
                messages: ["not run: the game is not on the lifecycle"],
            });
    // A stage with a block of its own in the report: its status, and the
    // findings whose codes are its own.
    const block = (id, value, test) => {
        if (!value || typeof value.status !== "string") return;
        checks.push({
            id,
            status: value.status,
            messages: value.status === "passed" ? [] : owned(test),
        });
    };
    const starts =
        (...prefixes) =>
        (code) =>
            prefixes.some((prefix) => code.startsWith(prefix));
    stage("sound");
    block(
        "loading",
        report.loading,
        starts(
            "PROGRESS_",
            "FIRST_FRAME_",
            "READY_",
            "RESIZE_",
            "PAUS",
            "RESUME_",
            "MATCH_",
            "LOADING_"
        )
    );
    stage("departure");
    stage("results");
    block("social", report.social, starts("STAGE_SOCIAL", "SOCIAL_"));
    block("keys", report.keys, starts("KEYS_", "RAW_"));
    block("safe-area", report.safeArea, starts("SAFE_AREA_"));
    if (report.devices) {
        const messages = owned(
            starts(
                "PHONE_",
                "NO_DEVICE_",
                "NO_TOUCH_",
                "NO_GAMEPAD_",
                "CONTROL_",
                "TOUCH_",
                "PROFILE_"
            )
        );
        checks.push({
            id: "devices",
            status: messages.length ? "failed" : "passed",
            messages,
        });
    }
    block("locomotion", report.locomotion, starts("STAGE_LOCOMOTION"));
    block("avatars", report.avatars, starts("AVATAR_"));
    block(
        "party",
        report.party,
        (code) => code.startsWith("PARTY_") && code !== "PARTY_UNDECLARED"
    );
    block("saved", report.saved, starts("SAVED_"));
    // Any other stage of the lifecycle run.
    for (const other of stages)
        if (!checks.some((c) => c.id === other.stage))
            checks.push({
                id: other.stage,
                status: other.status,
                messages: other.error ? [other.error] : [],
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
    const path = join(root, "frontend/public/game-builds", id, "check.json");
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
