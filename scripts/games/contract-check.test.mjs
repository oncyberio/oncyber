import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
    checkEnterMessage,
    contractFindings,
    enterFindings,
    harnessScript,
    isListed,
    plannedVisit,
} from "./contract-check.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const party = {
    sizes: [1, 4],
    formats: [{ id: "solo", label: "Solo", sizes: [1, 2, 3, 4] }],
};
const runtime = {
    profile: "portable-v1",
    version: "1",
    capabilities: [],
    assets: [],
    input: { jump: { keyboard: ["Space"] } },
};
const scenario = {
    version: 1,
    steps: [
        { type: "action", action: "jump" },
        { type: "wait", frames: 2 },
        { type: "assert", key: "booted", equals: true },
    ],
};

/** A throwaway repository with one game. */
function repoWith({ manifest, scenario: steps, source = "", listed = true }) {
    const root = mkdtempSync(join(tmpdir(), "games-contract-"));
    mkdirSync(join(root, "games/toy/src"), { recursive: true });
    mkdirSync(join(root, "frontend/features/games"), { recursive: true });
    writeFileSync(
        join(root, "frontend/features/games/catalog.ts"),
        listed
            ? `export const GAMES = { toy: { id: "toy" } };`
            : `export const GAMES = {};`
    );
    if (steps)
        writeFileSync(
            join(root, "games/toy/scenario.json"),
            JSON.stringify(steps)
        );
    writeFileSync(join(root, "games/toy/src/host.js"), source);
    return contractFindings({ root, id: "toy", manifest });
}
const codes = (result) => result.findings.map((f) => f.code);
const full = { name: "Toy", arrival: { walkable: false }, party, runtime };

test("a listed game on the lifecycle with a scenario passes", () => {
    const result = repoWith({ manifest: full, scenario });
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.lifecycle, true);
});

test("a listed game with no lifecycle or no scenario fails", () => {
    assert.deepEqual(
        codes(
            repoWith({
                manifest: { name: "Toy", arrival: { walkable: false }, party },
                scenario,
            })
        ),
        ["CONTRACT_NO_LIFECYCLE", "SCENARIO_ACTION_UNDECLARED"]
    );
    assert.deepEqual(codes(repoWith({ manifest: full })), [
        "CONTRACT_NO_SCENARIO",
    ]);
    assert.deepEqual(codes(repoWith({ manifest: { name: "Toy" } })), [
        "MANIFEST_INVALID",
        "MANIFEST_INVALID",
        "CONTRACT_NO_LIFECYCLE",
        "CONTRACT_NO_SCENARIO",
    ]);
});

test("a game the catalog doesn't list keeps the boot-only check", () => {
    const result = repoWith({ manifest: { name: "Toy" }, listed: false });
    assert.deepEqual(result.findings, []);
    assert.equal(result.lifecycle, false);
});

test("a scenario must assert something, use declared actions and a party the game takes", () => {
    assert.deepEqual(
        codes(
            repoWith({
                manifest: full,
                scenario: { version: 1, steps: [{ type: "wait", frames: 1 }] },
            })
        ),
        ["SCENARIO_INVALID"]
    );
    assert.deepEqual(
        codes(
            repoWith({
                manifest: full,
                scenario: {
                    ...scenario,
                    steps: [
                        ...scenario.steps,
                        { type: "action", action: "fly" },
                    ],
                },
            })
        ),
        ["SCENARIO_ACTION_UNDECLARED"]
    );
    assert.deepEqual(
        codes(
            repoWith({
                manifest: full,
                scenario: { ...scenario, enter: { party: 6 } },
            })
        ),
        ["SCENARIO_ENTER_INVALID"]
    );
    assert.deepEqual(
        codes(
            repoWith({
                manifest: full,
                scenario: { ...scenario, enter: { arrival: "portal" } },
            })
        ),
        ["SCENARIO_ENTER_INVALID"]
    );
});

test("a per-game message prefix in the source is a warning, not a failure", () => {
    const result = repoWith({
        manifest: full,
        scenario,
        source: `const PREFIX = "toy:"; post({ type: "toy:hello" });`,
    });
    assert.deepEqual(result.findings, []);
    assert.deepEqual(
        result.warnings.map((w) => w.code),
        ["CONTRACT_LEGACY_PREFIX"]
    );
});

test("the staged visit follows the scenario, else game.json", () => {
    assert.deepEqual(plannedVisit({ arrival: { walkable: true } }, null), {
        arrival: "lobby",
        party: 0,
    });
    assert.deepEqual(plannedVisit({ arrival: { walkable: false } }, {}), {
        arrival: "direct",
        party: 0,
    });
    assert.deepEqual(
        plannedVisit(
            { arrival: { walkable: true } },
            { enter: { arrival: "direct", party: 3 } }
        ),
        { arrival: "direct", party: 3 }
    );
    const enter = checkEnterMessage("toy", { arrival: "lobby", party: 3 });
    assert.equal(enter.arrival.view.fov, 50);
    assert.equal(enter.trip.members.length, 2);
    assert.equal(enter.trip.arrived.length, 2);
    assert.equal(
        checkEnterMessage("toy", { arrival: "direct", party: 0 }).trip,
        null
    );
    assert.doesNotThrow(
        () => new Function(harnessScript("toy", { arrival: "lobby", party: 3 }))
    );
});

test("after the run, enter() must have received the staged visit", () => {
    const visit = { arrival: "lobby", party: 4 };
    const greeted = { prefix: "oncyber:game:", version: 2 };
    const ok = enterFindings({
        id: "toy",
        contract: greeted,
        visit,
        report: { inspect: { hostArrival: "lobby", hostParty: 4 } },
    });
    assert.deepEqual(ok, { findings: [], warnings: [] });
    const lost = enterFindings({
        id: "toy",
        contract: greeted,
        visit,
        report: { inspect: { hostArrival: "", hostParty: 0 } },
    });
    assert.deepEqual(
        lost.findings.map((f) => f.code),
        ["CONTRACT_ENTER_ARRIVAL", "CONTRACT_ENTER_PARTY"]
    );
    const old = enterFindings({
        id: "toy",
        contract: { prefix: "toy:", version: 1 },
        visit,
        report: { inspect: {} },
    });
    assert.deepEqual(old.findings, []);
    assert.deepEqual(
        old.warnings.map((w) => w.code),
        ["CONTRACT_LEGACY_PREFIX"]
    );
    assert.deepEqual(
        enterFindings({ id: "toy", contract: null, visit, report: null }),
        { findings: [], warnings: [] }
    );
});

test("in this repository: Ace and Garden meet the contract, Padel doesn't yet", () => {
    const read = (id) =>
        contractFindings({
            root: repo,
            id,
            manifest: JSON.parse(
                readFileSync(join(repo, "games", id, "game.json"), "utf8")
            ),
        });
    for (const id of ["ace", "garden", "padel"])
        assert.equal(isListed(repo, id), true);
    assert.deepEqual(read("ace").findings, []);
    assert.deepEqual(read("ace").warnings, []);
    assert.deepEqual(read("ace").visit, { arrival: "lobby", party: 4 });
    assert.deepEqual(read("garden").findings, []);
    assert.ok(codes(read("padel")).includes("CONTRACT_NO_LIFECYCLE"));
    assert.ok(codes(read("padel")).includes("CONTRACT_NO_SCENARIO"));
});
