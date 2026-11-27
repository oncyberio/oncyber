// The results stage of `pnpm games:check` (docs/games/results.md).
//
// Rule: every finished match reports exactly one result. The check page
// records each `result` the game posts (`oncyber:game:result`, or
// `<id>:result` from an older build) and answers in the same form. This
// stage audits them with the runtime's own validator: every result valid,
// no match reported twice. When game.json says the check run plays a match
// to the end, it also waits for that match and requires exactly one result.
//
// game.json:
//   "results": { "match": "autoplay&games=1", "timeoutSeconds": 120 }
//       `match` is added to the game's URL (after `?check=results`, on a
//       visit of its own: straight in, alone) so its own bot plays one
//       match to the end.
//   "results": { "scenario": true }
//       the game's scenario.json plays a match to the end.
//   "results": true
//       the game reports results, but the check run finishes no match.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const source = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../games/runtime/src/results.ts"
);

/** The runtime's validator; TypeScript source, stripped when this Node doesn't load .ts itself. */
async function loadRuntime() {
    try {
        return await import(pathToFileURL(source).href);
    } catch (error) {
        const { stripTypeScriptTypes } = await import("node:module");
        if (!stripTypeScriptTypes) throw error;
        const code = stripTypeScriptTypes(readFileSync(source, "utf8"));
        return import(
            `data:text/javascript;base64,${Buffer.from(code).toString(
                "base64"
            )}`
        );
    }
}

/** What the manifest asks of the check run. */
export function resultsPlan(manifest) {
    const declared = manifest?.results;
    if (!declared)
        return { declared: false, expectOne: false, query: "", timeoutMs: 0 };
    const options = typeof declared === "object" ? declared : {};
    const match =
        typeof options.match === "string"
            ? options.match.replace(/^[?&]+/, "")
            : "";
    if (match && !/^[A-Za-z0-9_.~=&%-]{1,200}$/.test(match))
        throw new Error("game.json results.match must be a plain query string");
    const seconds = Number(options.timeoutSeconds) || 120;
    return {
        declared: true,
        expectOne: Boolean(match) || options.scenario === true,
        query: match ? `&${match}` : "",
        timeoutMs: Math.max(5, Math.min(600, seconds)) * 1000,
    };
}

/** Runs inside the check page's message listener: keep what the game reports. */
export const resultsHarness = `
    if (typeof type === "string" && type.endsWith(":result")) {
        (window.__results = window.__results || []).push(event.data.result);
        // Answer as the page does, so a game waiting on the status moves on.
        frame.contentWindow.postMessage({ type: type + "-status", match: event.data.result && event.data.result.match, status: "unrecorded", reason: "CHECK" }, "*");
    }`;

/**
 * `posted` is what the scenario's visit sent (none is right: it finishes
 * no match unless game.json says `scenario: true`). `page` is the check
 * page of the match visit, open at `/results`, when `plan.query` names
 * one; null otherwise. Returns the stage, findings for check.json and the
 * results.
 */
export async function resultsStage(page, plan, posted = []) {
    const started = Date.now();
    const read = () =>
        page.evaluate(() => ({
            sent: window.__results ?? [],
            error: window.__gameError ?? null,
        }));
    let played = { sent: [], error: null };
    if (page && plan.query) {
        // The game's bot is playing: wait for the match to end, then a
        // moment more for a result that should not have been sent.
        // Software rendering (no GPU) can need longer: GAMES_CHECK_TIMEOUT_S.
        const timeoutMs = Math.max(
            plan.timeoutMs,
            (Number(process.env.GAMES_CHECK_TIMEOUT_S) || 0) * 1000
        );
        played = await read();
        while (
            !played.sent.length &&
            !played.error &&
            Date.now() - started < timeoutMs
        ) {
            await page.waitForTimeout(500);
            played = await read();
        }
        if (played.sent.length) await page.waitForTimeout(2500);
        played = await read();
        if (!played.sent.length)
            played.note = played.error
                ? ` (the game failed: ${played.error})`
                : ` (waited ${Math.round(timeoutMs / 1000)} s)`;
    }
    const sent = [...posted, ...played.sent];
    const { auditResults } = await loadRuntime();
    const audit = auditResults(sent, plan.expectOne);
    if (played.note && audit.findings.length)
        audit.findings[audit.findings.length - 1] += played.note;
    return {
        stage: {
            stage: "results",
            status: audit.ok ? "passed" : "failed",
            ms: Date.now() - started,
            ...(audit.ok ? {} : { error: audit.findings.join("; ") }),
        },
        findings: audit.findings.map((message) => ({
            code: "RESULTS",
            message,
        })),
        results: audit.results,
        ran: plan.declared || sent.length > 0,
    };
}
