// The contract stage of `pnpm games:check` (docs/games/contract.md).
//
// Before the game runs: a game listed in the catalog must be on the
// lifecycle (a `runtime` block in game.json), have a scenario.json whose
// actions it declared, and declare `arrival` and `party`.
// While it runs: the check page speaks the one message prefix and stages
// the visit the scenario asks for (a lobby arrival, a party).
// After: enter() must have received that visit.
//
// games.mjs calls these; nothing here launches a browser.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
    CONTRACT_VERSION,
    GAME_MESSAGE_PREFIX,
} from "../../games/runtime/src/contract.ts";
import { validateGameJson } from "../../games/runtime/src/manifest.ts";

const KINDS =
    "hello|ready|identity|party|arrival|arrival-ready|entered|dispose|storage|pose|peers|self|net|exit|error";

/** A game the site offers: it has an entry in the catalog. */
export function isListed(root, id) {
    const catalog = join(root, "frontend/features/games/catalog.ts");
    return (
        existsSync(catalog) &&
        new RegExp(`\\bid:\\s*["']${id}["']`).test(
            readFileSync(catalog, "utf8")
        )
    );
}

function sourceFiles(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return entry.name === "node_modules" ? [] : sourceFiles(path);
        return /\.(js|ts|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)
            ? [path]
            : [];
    });
}

/** The visit the check stages: the scenario's `enter`, else what game.json implies. */
export function plannedVisit(manifest, scenario) {
    const arrival =
        scenario?.enter?.arrival ??
        (manifest?.arrival?.walkable ? "lobby" : "direct");
    return {
        arrival: arrival === "lobby" ? "lobby" : "direct",
        party: Number.isInteger(scenario?.enter?.party)
            ? scenario.enter.party
            : 0,
    };
}

/**
 * What can be told before the game runs. `findings` fail the check;
 * `warnings` are printed and recorded.
 */
export function contractFindings({
    root,
    id,
    manifest,
    listed = isListed(root, id),
}) {
    const source = join(root, "games", id);
    const findings = [],
        warnings = [];
    const add = (code, message) => findings.push({ code, message });
    findings.push(...validateGameJson(manifest, { requireContract: listed }));
    let scenario = null;
    const scenarioPath = join(source, "scenario.json");
    if (existsSync(scenarioPath)) {
        try {
            scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
        } catch (error) {
            add(
                "SCENARIO_INVALID",
                `scenario.json is not JSON: ${error.message}`
            );
        }
    }
    if (listed && !manifest?.runtime)
        add(
            "CONTRACT_NO_LIFECYCLE",
            `games/${id}/game.json has no "runtime" block: a listed game runs through the lifecycle (docs/games/contract.md)`
        );
    if (listed && !existsSync(scenarioPath))
        add(
            "CONTRACT_NO_SCENARIO",
            `games/${id}/scenario.json is missing: a listed game proves it works with a scenario`
        );
    if (scenario) {
        const steps = Array.isArray(scenario.steps) ? scenario.steps : [];
        if (scenario.version !== 1 || steps.length < 1 || steps.length > 128)
            add(
                "SCENARIO_INVALID",
                "scenario.json needs version 1 and 1 to 128 steps"
            );
        if (
            !steps.some(
                (step) => step?.type === "assert" || step?.type === "waitUntil"
            )
        )
            add(
                "SCENARIO_INVALID",
                "scenario.json asserts nothing: add an assert or waitUntil step on an inspect() key"
            );
        const declared = new Set(Object.keys(manifest?.runtime?.input ?? {}));
        for (const action of new Set(
            steps
                .filter((step) => step?.type === "action")
                .map((step) => step.action)
        ))
            if (!declared.has(action))
                add(
                    "SCENARIO_ACTION_UNDECLARED",
                    `scenario.json uses "${action}", which runtime.input doesn't declare`
                );
        const enter = scenario.enter;
        if (enter !== undefined) {
            const sizes = manifest?.party?.sizes;
            if (
                !enter ||
                typeof enter !== "object" ||
                (enter.arrival !== undefined &&
                    !["lobby", "direct"].includes(enter.arrival))
            )
                add(
                    "SCENARIO_ENTER_INVALID",
                    'scenario.enter.arrival must be "lobby" or "direct"'
                );
            else if (
                enter.party !== undefined &&
                !(
                    Number.isInteger(enter.party) &&
                    enter.party >= 2 &&
                    enter.party <= 8
                )
            )
                add(
                    "SCENARIO_ENTER_INVALID",
                    "scenario.enter.party must be a party size from 2 to 8"
                );
            else if (
                enter.party !== undefined &&
                Array.isArray(sizes) &&
                (enter.party < sizes[0] || enter.party > sizes[1])
            )
                add(
                    "SCENARIO_ENTER_INVALID",
                    `scenario.enter.party is ${enter.party}, outside game.json's party.sizes [${sizes}]`
                );
        }
    }
    // A game's own message prefix still works, but it is the old form.
    const own = new RegExp(`["'\`]${id}:(?:(?:${KINDS})\\b)?["'\`]`);
    const speaksOwn = sourceFiles(join(source, "src")).filter((path) =>
        own.test(readFileSync(path, "utf8"))
    );
    if (speaksOwn.length)
        warnings.push({
            code: "CONTRACT_LEGACY_PREFIX",
            message: `${speaksOwn
                .map((path) => path.slice(source.length + 1))
                .join(
                    ", "
                )} still says "${id}:<kind>"; use connectPage() from @oncyber/game-runtime/page`,
        });
    return {
        listed,
        lifecycle: Boolean(manifest?.runtime) && Boolean(scenario),
        scenario,
        visit: plannedVisit(manifest, scenario),
        findings,
        warnings,
    };
}

/** The `enter` message the check page sends for a planned visit. */
export function checkEnterMessage(id, visit) {
    const others = Array.from(
        { length: Math.max(0, visit.party - 1) },
        (_, index) => index + 2
    );
    return {
        arrival:
            visit.arrival === "lobby"
                ? {
                      from: "lobby",
                      view: {
                          cameraOffset: { x: 0, y: 2.3, z: -4.8 },
                          cameraTargetOffset: { x: 0, y: 1.25, z: 0 },
                          avatarRotation: 0,
                          avatarHeight: 1.75,
                          fov: 50,
                          cameraMode: "third-person",
                      },
                  }
                : { from: "direct", view: null },
        trip: visit.party
            ? {
                  id: "check-trip-0123456789",
                  room: `oncyber-${id}-party-check-trip-0123456789`,
                  size: visit.party,
                  self: "check-1",
                  members: others.map((n) => ({
                      id: `lobby-${n}`,
                      name: `Player ${n}`,
                      pfp: "",
                      avatarUrl: "",
                  })),
                  arrived: others.map((n) => ({
                      id: `check-${n}`,
                      name: `Player ${n}`,
                      pfp: "",
                      avatarUrl: "",
                  })),
              }
            : null,
    };
}

/**
 * Script for the check page, beside its identity stand-in: the page's half
 * of the contract for one visit. It records the form the game greeted in
 * (`window.__contract`) and, for a contract game, sends `enter` (with the
 * identity on a direct visit, after `ready` on a lobby trip) and `entered`
 * once the game is ready or has staged its arrival.
 */
export function harnessScript(id, visit) {
    return `
(() => {
    const PREFIX = ${JSON.stringify(
        GAME_MESSAGE_PREFIX
    )}, LEGACY = ${JSON.stringify(`${id}:`)};
    const enter = ${JSON.stringify(checkEnterMessage(id, visit))};
    const frame = document.getElementById("game");
    const send = (kind, data) => frame.contentWindow.postMessage({ type: PREFIX + kind, ...data }, "*");
    let sentEnter = false, revealed = false;
    const sendEnter = () => { if (!sentEnter) { sentEnter = true; send("enter", enter); } };
    const reveal = () => { if (!revealed) { revealed = true; send("entered", {}); } };
    addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const type = event.data && event.data.type;
        if (typeof type !== "string") return;
        if (type === LEGACY + "hello") window.__contract = window.__contract || { prefix: LEGACY, version: 1 };
        if (!type.startsWith(PREFIX)) return;
        const kind = type.slice(PREFIX.length);
        if (kind === "hello") {
            window.__contract = { prefix: PREFIX, version: event.data.contract || 0, arrival: event.data.arrival || null, party: event.data.party || null };
            if (enter.arrival.from === "direct") setTimeout(sendEnter);
        }
        if (kind === "ready") {
            sendEnter();
            if (enter.arrival.from === "direct") reveal();
            else setTimeout(reveal, 1500);
        }
        if (kind === "arrival-ready") reveal();
    });
})();`;
}

/** After the run: did the game greet in the one prefix, and did enter() get the visit? */
export function enterFindings({ id, contract, visit, report }) {
    const findings = [],
        warnings = [];
    if (!contract) return { findings, warnings };
    if (contract.prefix !== GAME_MESSAGE_PREFIX) {
        warnings.push({
            code: "CONTRACT_LEGACY_PREFIX",
            message: `the build greets with "${id}:hello"; rebuild it on connectPage() to speak "${GAME_MESSAGE_PREFIX}"`,
        });
        return { findings, warnings };
    }
    if (contract.version !== CONTRACT_VERSION)
        warnings.push({
            code: "CONTRACT_VERSION",
            message: `the build speaks contract ${contract.version}; the page speaks ${CONTRACT_VERSION}`,
        });
    const inspect = report?.inspect;
    if (!inspect || typeof inspect !== "object" || report.bootOnly)
        return { findings, warnings };
    if (inspect.hostArrival !== visit.arrival)
        findings.push({
            code: "CONTRACT_ENTER_ARRIVAL",
            message: `enter() got arrival "${
                inspect.hostArrival ?? ""
            }", the page sent "${
                visit.arrival
            }": pass the page's enter data to session.enter()`,
        });
    if ((inspect.hostParty ?? 0) !== visit.party)
        findings.push({
            code: "CONTRACT_ENTER_PARTY",
            message: `enter() got a party of ${
                inspect.hostParty ?? 0
            }, the page sent ${
                visit.party
            }: pass the page's trip to session.enter()`,
        });
    return { findings, warnings };
}
