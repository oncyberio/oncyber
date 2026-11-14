// The results stage of `pnpm games:check` (docs/games/results.md).
//
// Rule: every finished match reports exactly one result. The check page
// records each `<id>:result` the game posts. This stage audits them with
// the runtime's own validator: every result valid, no match reported twice.
// When game.json says the check run plays a match to the end, it also waits
// for that match and requires exactly one result.
//
// game.json:
//   "results": { "match": "autoplay&games=1", "timeoutSeconds": 120 }
//       `match` is added to the game's URL so its own bot plays one match
//       to the end.
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
 * Call once the game is ready (and, for a lifecycle game, after its
 * scenario). Returns the stage, findings for check.json and the results.
 */
export async function resultsStage(page, plan) {
    const started = Date.now();
    const read = () => page.evaluate(() => window.__results ?? []);
    let sent = await read();
    if (plan.query) {
        // The game's bot is playing: wait for the match to end, then a
        // moment more for a result that should not have been sent.
        while (!sent.length && Date.now() - started < plan.timeoutMs) {
            await page.waitForTimeout(500);
            sent = await read();
        }
        if (sent.length) await page.waitForTimeout(2500);
        sent = await read();
    }
    const { auditResults } = await loadRuntime();
    const audit = auditResults(sent, plan.expectOne);
    if (plan.query && !sent.length)
        audit.findings[0] += ` (waited ${Math.round(plan.timeoutMs / 1000)} s)`;
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
