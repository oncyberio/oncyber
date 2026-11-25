import assert from "node:assert/strict";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inAppPage, sameText, SOURCE, TARGET } from "../docs-sync.mjs";
import { contractFindings } from "../contract-check.mjs";
import { createGame } from "../new.mjs";
import {
    CHECKS,
    readGameFiles,
    runtimeModule,
    staticFindings,
} from "../process.mjs";
import { checksOf, scoreAll } from "../score.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path) => readFileSync(join(repo, path), "utf8");
const codes = (findings) => findings.map((f) => f.code).sort();

test("every check and every finding code has a line in the docs", () => {
    const doc = read(SOURCE);
    for (const check of CHECKS) {
        assert.ok(
            doc.includes(`\`${check.id}\``),
            `docs/games/good-game.md does not name the ${check.id} check`
        );
        for (const code of check.codes)
            assert.ok(
                doc.includes(`\`${code}\``),
                `docs/games/good-game.md does not name ${code}`
            );
    }
});

test("every finding code the helpers can raise belongs to a check", async () => {
    const owned = new Set(CHECKS.flatMap((check) => check.codes));
    for (const name of ["arrival", "bot", "brief"]) {
        const source = read(`games/runtime/src/${name}.ts`);
        for (const [, code] of source.matchAll(/code: "([A-Z_]+)"/g))
            assert.ok(owned.has(code), `${code} (${name}.ts) is not in CHECKS`);
    }
    for (const [, code] of read("scripts/games/process.mjs").matchAll(
        /add\("([A-Z_]+)"/g
    ))
        assert.ok(owned.has(code), `${code} is not in CHECKS`);
});

test("the in-app docs page is the repository page", () => {
    assert.ok(
        sameText(read(TARGET), inAppPage(read(SOURCE))),
        "run node scripts/games/docs-sync.mjs"
    );
    assert.match(
        inAppPage(
            "[a.md](a.md) and [the guide](../x.md) and [site](https://e.com)"
        ),
        /`docs\/games\/a\.md` and the guide \(`docs\/x\.md`\) and \[site\]\(https:\/\/e\.com\)/
    );
});

test("the agent rule about corrections is in AGENTS.md", () => {
    assert.match(read("AGENTS.md"), /a docs line, an\s+SDK helper and a check/);
});

test("the briefs are twelve, fixed in shape, with ids games:new accepts", () => {
    const { briefs } = JSON.parse(read("games/briefs.json"));
    assert.equal(briefs.length, 12);
    assert.equal(new Set(briefs.map((b) => b.id)).size, 12);
    for (const brief of briefs) {
        assert.match(brief.id, /^[a-z][a-z0-9-]{1,31}$/);
        assert.ok(brief.brief.length > 20 && !brief.brief.includes("\n"));
    }
});

test("Ace, Garden and Padel pass the checks that need no browser", async () => {
    for (const id of ["ace", "garden", "padel"]) {
        const manifest = JSON.parse(read(`games/${id}/game.json`));
        assert.deepEqual(
            await staticFindings({
                manifest,
                files: readGameFiles(join(repo, "games", id)),
            }),
            [],
            id
        );
    }
});

test("the template brief fails until it is filled in", async () => {
    const { briefFindings } = await runtimeModule("brief");
    assert.deepEqual(codes(briefFindings(read("games/BRIEF.md"))), [
        "BRIEF_INCOMPLETE",
    ]);
    assert.match(
        briefFindings(read("games/BRIEF.md"))[0].message,
        /Game, Players, Formats, Arrival, Devices, Kits, Sound and pausing, Leaving and results, Saved data, Inspect, Bot/
    );
});

function fakeRepo() {
    const root = mkdtempSync(join(tmpdir(), "oncyber-new-"));
    cpSync(join(repo, "games/lantern-tag"), join(root, "games/lantern-tag"), {
        recursive: true,
        filter: (path) => !/node_modules|\.check/.test(path),
    });
    cpSync(join(repo, "games/BRIEF.md"), join(root, "games/BRIEF.md"));
    mkdirSync(join(root, "frontend/features/games"), { recursive: true });
    cpSync(
        join(repo, "frontend/features/games/savedData.declared.json"),
        join(root, "frontend/features/games/savedData.declared.json")
    );
    // The catalog is generated from the manifests (docs/games/listing.md),
    // so a listed game is one with a manifest: Ace's stands in for it.
    mkdirSync(join(root, "games/ace"), { recursive: true });
    cpSync(
        join(repo, "games/ace/game.json"),
        join(root, "games/ace/game.json")
    );
    cpSync(
        join(repo, "frontend/features/games/catalog.generated.ts"),
        join(root, "frontend/features/games/catalog.generated.ts")
    );
    return root;
}

test("games:new creates a renamed game with a brief, manifest, bot and scenario, and it starts red", async () => {
    const root = fakeRepo();
    createGame({ root, id: "brief-sumo", name: "Sumo Ring" });
    const at = (file) => join(root, "games/brief-sumo", file);
    for (const file of [
        "BRIEF.md",
        "game.json",
        "bot.json",
        "scenario.json",
        "README.md",
        "src/game.js",
        "src/host.js",
        "vite.config.js",
    ])
        assert.ok(existsSync(at(file)), file);
    assert.match(readFileSync(at("BRIEF.md"), "utf8"), /^# Brief: Sumo Ring/);
    // The copy speaks the current contract: the runtime's page client and
    // the one prefix, never a prefix of its own (docs/games/contract.md).
    const host = readFileSync(at("src/host.js"), "utf8");
    assert.match(host, /connectPage\(/);
    assert.doesNotMatch(host, /brief-sumo:|PREFIX = "/);
    assert.deepEqual(
        contractFindings({
            root,
            id: "brief-sumo",
            manifest: JSON.parse(readFileSync(at("game.json"), "utf8")),
            source: join(root, "games/brief-sumo"),
            listed: true,
        }).warnings.map((warning) => warning.code),
        []
    );
    // Nothing in the copy still names the template, and what was built or
    // checked for the template did not come along.
    for (const file of [
        "src/host.js",
        "src/game.js",
        "index.html",
        "package.json",
        "package-lock.json",
        "vite.config.js",
        "game.json",
    ])
        assert.doesNotMatch(
            readFileSync(at(file), "utf8"),
            /lantern-tag|Lantern Tag/,
            file
        );
    assert.ok(!existsSync(at("build.json")));
    assert.match(
        readFileSync(at("vite.config.js"), "utf8"),
        /frontend\/public\/games\/brief-sumo"/
    );
    assert.match(readFileSync(at("index.html"), "utf8"), /Sumo Ring/);
    assert.equal(
        JSON.parse(readFileSync(at("package.json"), "utf8")).name,
        "@oncyber-games/brief-sumo"
    );
    const manifest = JSON.parse(readFileSync(at("game.json"), "utf8"));
    assert.equal(manifest.name, "Sumo Ring");
    assert.equal(manifest.format, "match");
    assert.ok(manifest.runtime.input.up);
    assert.deepEqual(manifest.page, {
        socialRoom: "oncyber-brief-sumo-social-v1",
    });
    // What every later area added to a manifest came with the copy.
    for (const field of ["avatars", "arrival", "party", "devices", "results"])
        assert.ok(manifest[field], field);
    assert.ok(manifest.runtime.entries.scenario);
    // The page knows a game's saved keys through one file: the copy
    // declares what the template does, which today is nothing.
    assert.equal(
        JSON.parse(
            readFileSync(
                join(root, "frontend/features/games/savedData.declared.json"),
                "utf8"
            )
        )["brief-sumo"],
        manifest.saved
    );
    assert.match(
        readFileSync(
            join(root, "frontend/features/games/catalog.generated.ts"),
            "utf8"
        ),
        /"brief-sumo": \{\n        "id": "brief-sumo",\n        "title": "Sumo Ring",\n        "tagline": "a new game",/
    );
    // Not done until the agent does the work: the brief, the bot and what
    // the party statement says. (The copy keeps the template's formats, so
    // it is valid under the contract and has a solo path from the start.)
    assert.deepEqual(
        codes(
            await staticFindings({
                manifest,
                files: readGameFiles(join(root, "games/brief-sumo")),
            })
        ),
        ["BOT_IDLE", "BOT_IDLE", "BRIEF_INCOMPLETE", "PARTY_UNDECLARED"]
    );
    assert.throws(
        () => createGame({ root, id: "brief-sumo" }),
        /already exists/
    );
    assert.throws(() => createGame({ root, id: "Bad Id" }), /lowercase/);
    // A listed game is never scaffolded over, and stays in the catalog.
    assert.throws(() => createGame({ root, id: "ace" }), /already exists/);
    assert.match(
        readFileSync(
            join(root, "frontend/features/games/catalog.generated.ts"),
            "utf8"
        ),
        /"id": "ace"/
    );
});

test("the score counts passed checks and holds unbuilt games to the same list", () => {
    const report = {
        status: "failed",
        checkedAt: "2026-11-14T00:00:00.000Z",
        findings: [{ code: "HANDOFF_FOV", message: "wrong lens" }],
        run: { stages: [{ stage: "boot", status: "passed" }] },
        process: {
            checks: [
                { id: "brief", status: "passed", findings: [] },
                {
                    id: "handoff",
                    status: "failed",
                    findings: [{ code: "HANDOFF_FOV", message: "wrong lens" }],
                },
            ],
        },
        other: { checks: [{ id: "keys", status: "passed" }] },
    };
    const checks = checksOf(report);
    assert.deepEqual(
        checks.map((c) => `${c.id}:${c.status}`),
        [
            "bundle:passed",
            "boot:passed",
            "scenario:skipped",
            "lifecycle:skipped",
            "frames:skipped",
            "brief:passed",
            "handoff:failed",
            "other.keys:passed",
        ]
    );
    const root = mkdtempSync(join(tmpdir(), "oncyber-score-"));
    mkdirSync(join(root, "games/a"), { recursive: true });
    mkdirSync(join(root, "frontend/public/games/a"), { recursive: true });
    writeFileSync(join(root, "games/a/game.json"), "{}");
    writeFileSync(
        join(root, "frontend/public/games/a/check.json"),
        JSON.stringify(report)
    );
    const result = scoreAll(root, ["a", "missing"]);
    assert.equal(result.games[0].passed, 4);
    assert.equal(result.games[1].status, "not built");
    assert.equal(result.total, 16);
    assert.equal(result.score, 25);
});

test("no game directory was left behind by these tests", () => {
    assert.ok(!readdirSync(join(repo, "games")).includes("brief-sumo"));
});
