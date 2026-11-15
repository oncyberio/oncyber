#!/usr/bin/env node
// The saved-data stage of `pnpm games:check`, and the declarations sync.
//
//   node scripts/games/saved-data.mjs sync     write frontend/features/games/savedData.declared.json
//   node scripts/games/saved-data.mjs check <id>   run only this stage on the current build
//
// A game declares its saved keys in game.json (`saved`); see
// docs/games/saved-data.md. The stage proves, in the real sandboxed frame
// and against the page's own store rules (frontend/features/games/savedData.ts):
//
//   round trip   each key's `sample` is saved through the game, the game is
//                reloaded, and the sample comes back
//   limits       an oversized value and a blind or stale write to a shared
//                key are refused
//   old saves    the game boots with each key's listed `old` saves, with a
//                save from version 0 it cannot parse, and with a save from
//                a future version, and reports "migrated" or "reset"
//
// The page (and the server) only know a game's keys through the synced
// file, so the stage also fails when game.json and that file disagree.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import {
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { GAME_MESSAGE_PREFIX } from "../../games/runtime/src/contract.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DECLARED = join(root, "frontend/features/games/savedData.declared.json");
const CHECK_PARTY = "check-party-0123456789";
const LEGACY_KEYS = ["save", "settings", "muted"];

// The page's rules: TypeScript with no imports, which Node 22.18+ loads as
// is. Loaded from a .mts copy so Node need not guess the module type.
let loaded;
function rules() {
    return (loaded ??= (async () => {
        const dir = mkdtempSync(join(tmpdir(), "oncyber-saved-"));
        try {
            const copy = join(dir, "savedData.mts");
            writeFileSync(
                copy,
                readFileSync(join(root, "frontend/features/games/savedData.ts"))
            );
            return await import(pathToFileURL(copy).href);
        } catch (error) {
            throw new Error(
                `cannot load the saved-data rules (needs Node 22.18 or newer): ${error.message}`
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    })());
}

const strip = (declared) =>
    Object.fromEntries(
        Object.entries(declared).map(([key, d]) => [
            key,
            {
                scope: d.scope,
                stateVersion: d.stateVersion,
                maxBytes: d.maxBytes,
            },
        ])
    );

/** What the synced file should hold: every game's declared keys. */
async function allDeclared() {
    const { readSavedDeclarations } = await rules();
    const all = {};
    for (const entry of readdirSync(join(root, "games"), {
        withFileTypes: true,
    }).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = join(root, "games", entry.name, "game.json");
        if (!entry.isDirectory() || !existsSync(file)) continue;
        const { declared } = readSavedDeclarations(
            JSON.parse(readFileSync(file, "utf8")).saved
        );
        if (Object.keys(declared).length) all[entry.name] = strip(declared);
    }
    return all;
}

/** Findings any reading of game.json can tell, before the game runs. */
export async function savedStaticFindings({ id, manifest }) {
    const { readSavedDeclarations, encodeSavedValue } = await rules();
    const findings = [];
    const add = (message) =>
        findings.push({ code: "SAVED_DECLARATION", message });
    const { declared, problems } = readSavedDeclarations(manifest.saved);
    problems.forEach(add);
    for (const [key, d] of Object.entries(declared)) {
        const raw = manifest.saved[key];
        if (!("sample" in raw))
            add(`key "${key}": add a "sample", a value the game really saves`);
        else {
            const sample = encodeSavedValue(raw.sample, d.maxBytes);
            if (sample.reason === "invalid" || raw.sample === null)
                add(`key "${key}": the sample must be plain JSON and not null`);
            if (sample.reason === "too-large")
                add(
                    `key "${key}": the sample is larger than maxBytes (${d.maxBytes})`
                );
        }
        const old = raw.old ?? [];
        if (!Array.isArray(old))
            add(
                `key "${key}": "old" must be a list of { stateVersion, value }`
            );
        else {
            for (const save of old) {
                if (
                    !Number.isInteger(save?.stateVersion) ||
                    save.stateVersion < 0 ||
                    save.stateVersion >= d.stateVersion
                )
                    add(
                        `key "${key}": an old save's stateVersion must be below ${d.stateVersion}`
                    );
                if (
                    save?.expect !== undefined &&
                    !["migrated", "reset"].includes(save.expect)
                )
                    add(
                        `key "${key}": an old save's "expect" is "migrated" or "reset"`
                    );
            }
            // Each version the key has had needs a save to test against.
            if (
                d.stateVersion > 1 &&
                !old.some((save) => save?.stateVersion === d.stateVersion - 1)
            )
                add(
                    `key "${key}": stateVersion is ${
                        d.stateVersion
                    }; list an "old" save from version ${
                        d.stateVersion - 1
                    } so its migration is tested`
                );
        }
    }
    const synced = existsSync(DECLARED)
        ? JSON.parse(readFileSync(DECLARED, "utf8"))
        : {};
    if (!isDeepStrictEqual(synced[id] ?? {}, strip(declared)))
        findings.push({
            code: "SAVED_NOT_SYNCED",
            message:
                "game.json `saved` differs from what the page knows; run `node scripts/games/saved-data.mjs sync` and commit the file",
        });
    return findings;
}

/**
 * For the main check harness: the game is a first-time visitor there, so
 * every read finds nothing and every write is accepted. Injected as source.
 */
export const savedFreshVisitor = `function savedFreshVisitor(event, frame) {
    const type = event.data && event.data.type;
    if (typeof type !== "string" || !type.endsWith(":saved")) return;
    const { op, request, stateVersion, value, ifRevision } = event.data;
    const entry = op === "set" ? { stateVersion, value, revision: (ifRevision || 0) + 1 } : null;
    frame.contentWindow.postMessage({ type: type + "-result", request, ok: true, entry }, "*");
}`;

const TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".glb": "model/gltf-binary",
    ".vrm": "model/gltf-binary",
};

// The same sandbox as the site. Saved requests go to Node (window.__saved),
// where the page's real store rules run over an in-memory storage. The
// game is answered in the form it greeted in (`oncyber:game:<kind>` from a
// contract game, `<id>:<kind>` from a build before it), and a contract
// game gets its visit: a direct one. `?check=saved` tells the game's host
// that nobody plays the scenario on this visit.
const harness = (
    id
) => `<!doctype html><meta charset="utf-8"><title>saved-data check</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="game" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer" src="/games/${id}/index.html?check=saved"></iframe>
<script>
const frame = document.getElementById("game");
const CONTRACT = ${JSON.stringify(GAME_MESSAGE_PREFIX)};
const OLDER = ${JSON.stringify(id)} + ":";
let prefix = null;
const send = (message) => frame.contentWindow.postMessage(message, "*");
const probes = new Map();
window.__outcomes = [];
addEventListener("message", async (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (typeof data.type !== "string") return;
    const spoke = data.type.startsWith(CONTRACT) ? CONTRACT : data.type.startsWith(OLDER) ? OLDER : null;
    if (!spoke) return;
    const type = data.type.slice(spoke.length);
    if (type === "hello") {
        prefix = spoke;
        send({ type: prefix + "identity", name: "Check", pfp: "", avatarUrl: "", storage: {} });
        if (prefix === CONTRACT) send({ type: prefix + "enter", arrival: { from: "direct", view: null }, trip: null });
    }
    else if (type === "ready") { window.__ready = true; send({ type: spoke + "entered" }); }
    else if (type === "error") window.__gameError = String(data.message || "error");
    else if (type === "saved") send({ type: spoke + "saved-result", request: data.request, ...(await window.__saved(data)) });
    else if (type === "saved-outcome") window.__outcomes.push({ key: data.key, outcome: data.outcome, from: data.from });
    else if (type === "saved-probe-result") probes.get(data.probe)?.(data.result);
});
let nextProbe = 1;
window.__probe = (probe) => new Promise((resolve) => {
    const id = nextProbe++;
    probes.set(id, resolve);
    setTimeout(() => resolve({ timeout: true }), 8000);
    send({ type: (prefix ?? OLDER) + "saved-probe", probe: id, ...probe });
});
</script>`;

function serve(id, out) {
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness(id));
        }
        const prefix = `/games/${id}/`;
        const path = resolve(
            out,
            `.${decodeURIComponent(url.pathname.slice(prefix.length - 1))}`
        );
        if (
            !url.pathname.startsWith(prefix) ||
            !path.startsWith(out + sep) ||
            !existsSync(path) ||
            statSync(path).isDirectory()
        ) {
            res.writeHead(404);
            return res.end();
        }
        res.writeHead(200, {
            "content-type": TYPES[extname(path)] ?? "application/octet-stream",
            "access-control-allow-origin": "*",
        });
        res.end(readFileSync(path));
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}

/**
 * Runs the stage on the build in `out`. Resolves with
 * `{ status, ms, keys, runs, findings }`; a game that declares nothing
 * passes without opening a browser.
 */
export async function runSavedDataStage({ id, manifest, out, launch }) {
    const started = Date.now();
    const { readSavedDeclarations, readSavedRequest, createLocalSavedStore } =
        await rules();
    const { declared } = readSavedDeclarations(manifest.saved);
    const keys = Object.keys(declared);
    const findings = [];
    const runs = [];
    const done = () => ({
        status: findings.length ? "failed" : "passed",
        ms: Date.now() - started,
        keys: keys.length,
        runs,
        findings,
    });
    if (!keys.length) return done();

    // The page's storage for this visit, and what the game asked of it.
    let values = new Map();
    let requests = [];
    const storage = {
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => void values.set(k, v),
        removeItem: (k) => void values.delete(k),
    };
    const store = createLocalSavedStore(storage);
    const slot = (key) => ({
        game: id,
        scope: declared[key].scope,
        key,
        owner: { visitor: "guest", party: CHECK_PARTY, game: "" }[
            declared[key].scope
        ],
    });
    const name = (key) =>
        `oncyber:game:${id}:saved:${declared[key].scope}:${
            slot(key).owner
        }:${key}`;
    const answer = async (raw) => {
        const read = readSavedRequest(declared, raw);
        const result =
            "reason" in read
                ? { ok: false, reason: read.reason }
                : read.request.op === "get"
                ? await store.read(slot(read.request.key))
                : await store.write(slot(read.request.key), read.request);
        requests.push({
            op: raw?.op,
            key: raw?.key,
            ok: result.ok,
            reason: result.reason,
        });
        return result;
    };
    const preload = (key, save) => {
        // A version 0 string under one of the old fixed names sits where the
        // page kept it then; anything else is an entry in today's format.
        if (
            save.stateVersion === 0 &&
            typeof save.value === "string" &&
            LEGACY_KEYS.includes(key) &&
            declared[key].scope === "visitor"
        )
            values.set(`oncyber:game:${id}:${key}`, save.value);
        else
            values.set(
                name(key),
                JSON.stringify({
                    stateVersion: save.stateVersion,
                    value: save.value,
                    revision: 1,
                })
            );
    };

    const server = await serve(id, out);
    const browser = await launch();
    const pageErrors = [];
    try {
        const page = await browser.newPage({
            viewport: { width: 480, height: 270 },
        });
        page.on("pageerror", (e) =>
            pageErrors.push(String(e.message).slice(0, 300))
        );
        await page.exposeFunction("__saved", answer);
        const url = `http://127.0.0.1:${server.address().port}/`;
        /** Loads the game over the current storage; false when it did not boot. */
        const boot = async (label) => {
            pageErrors.length = 0;
            requests = [];
            const start = Date.now();
            await page.goto(url);
            let state = {};
            while (
                Date.now() - start < 120_000 &&
                !state.ready &&
                !state.error
            ) {
                await page.waitForTimeout(250);
                state = await page.evaluate(() => ({
                    ready: window.__ready === true,
                    error: window.__gameError ?? null,
                }));
            }
            const run = {
                run: label,
                booted: Boolean(state.ready),
                ms: Date.now() - start,
            };
            runs.push(run);
            if (!state.ready)
                findings.push({
                    code: "SAVED_BOOT",
                    message: `${label}: the game did not boot (${
                        state.error ?? "no ready after 120 s"
                    })`,
                });
            return run;
        };
        const settle = async (label, run) => {
            if (pageErrors.length)
                findings.push({
                    code: "SAVED_PAGE_ERROR",
                    message: `${label}: ${pageErrors[0]}`,
                });
            // The game's own SDK refuses a key it never declared, and says so.
            const asked = [
                ...requests.filter((r) => r.reason === "undeclared"),
                ...(await outcomes()),
            ].map((r) => String(r.key).slice(0, 40));
            for (const key of new Set(asked.filter((k) => !keys.includes(k))))
                findings.push({
                    code: "SAVED_UNDECLARED",
                    message: `${label}: the game used "${key}", which game.json does not declare`,
                });
            run.requests = requests.length;
        };
        const probe = (request) =>
            page.evaluate((r) => window.__probe(r), request);
        // Keys are independent, so each key's probes run alongside the others'.
        const each = (list, run) => Promise.all(list.map(run));
        const outcomes = () => page.evaluate(() => window.__outcomes);

        // 1. Round trip: save each sample through the game, reload, read back.
        let run = await boot("first visit");
        if (run.booted) {
            await each(keys, async (key) => {
                const sample = manifest.saved[key].sample;
                const write = await probe({ op: "update", key, value: sample });
                const kept = values.get(name(key));
                if (!write?.ok || !kept) {
                    findings.push({
                        code: "SAVED_ROUND_TRIP",
                        message: `key "${key}": saving the sample failed (${
                            write?.timeout
                                ? "the game did not answer; does it use connectSavedData?"
                                : write?.reason ?? "nothing stored"
                        })`,
                    });
                    return;
                }
                if (
                    JSON.parse(kept).stateVersion !== declared[key].stateVersion
                )
                    findings.push({
                        code: "SAVED_ROUND_TRIP",
                        message: `key "${key}": saved at stateVersion ${
                            JSON.parse(kept).stateVersion
                        }, declared ${
                            declared[key].stateVersion
                        }; rebuild the game`,
                    });
                // Limits hold from inside the game too.
                const big = await probe({
                    op: "set",
                    key,
                    value: "x".repeat(declared[key].maxBytes + 1),
                    ifRevision: write.revision,
                });
                if (big?.ok !== false || big.reason !== "too-large")
                    findings.push({
                        code: "SAVED_LIMIT",
                        message: `key "${key}": a value over maxBytes was not refused`,
                    });
                if (declared[key].scope !== "visitor") {
                    const blind = await probe({
                        op: "set",
                        key,
                        value: sample,
                    });
                    const stale = await probe({
                        op: "set",
                        key,
                        value: sample,
                        ifRevision: 0,
                    });
                    if (
                        blind?.reason !== "revision-required" ||
                        stale?.reason !== "conflict"
                    )
                        findings.push({
                            code: "SAVED_COMPARE_AND_SET",
                            message: `key "${key}": a blind or stale write to a shared key was not refused`,
                        });
                }
            });
            await settle("first visit", run);
            run = await boot("reload");
            if (run.booted) {
                await each(keys, async (key) => {
                    const read = await probe({ op: "get", key });
                    const mine = requests.filter((r) => r.key === key);
                    // On a real visit a write before the first read
                    // replaces what the visitor had saved.
                    if (mine[0] && mine[0].op !== "get")
                        findings.push({
                            code: "SAVED_OVERWRITE",
                            message: `key "${key}": the game wrote it before reading it; read first, or a visitor's save is replaced on every boot`,
                        });
                    // A game that has saved since it booted (an autosave)
                    // holds its own newer state; it was handed the sample.
                    else if (mine.some((r) => r.op !== "get" && r.ok)) return;
                    else if (
                        read?.outcome !== "current" ||
                        !isDeepStrictEqual(
                            read.value,
                            manifest.saved[key].sample
                        )
                    )
                        findings.push({
                            code: "SAVED_ROUND_TRIP",
                            message: `key "${key}": after a reload the game read ${JSON.stringify(
                                read?.value ?? null
                            ).slice(0, 80)} (${
                                read?.outcome ?? "no answer"
                            }), not the sample it saved`,
                        });
                });
                await settle("reload", run);
            }
        }

        // 2. Old saves: listed ones, one unparseable, one from the future.
        const listed = Math.max(
            0,
            ...keys.map((key) => manifest.saved[key].old?.length ?? 0)
        );
        const cases = [
            ...Array.from({ length: listed }, (_, index) => ({
                label: `old saves (${index + 1} of ${listed})`,
                saves: Object.fromEntries(
                    keys
                        .filter((key) => manifest.saved[key].old?.[index])
                        .map((key) => [key, manifest.saved[key].old[index]])
                ),
                listed: true,
            })),
            {
                label: "unreadable version 0 saves",
                saves: Object.fromEntries(
                    keys.map((key) => [
                        key,
                        { stateVersion: 0, value: "\u0000{not a save" },
                    ])
                ),
            },
            {
                label: "saves from a future version",
                saves: Object.fromEntries(
                    keys.map((key) => [
                        key,
                        {
                            stateVersion: declared[key].stateVersion + 1000,
                            value: { from: "a newer build" },
                        },
                    ])
                ),
            },
        ];
        for (const { label, saves, listed } of cases) {
            values = new Map();
            for (const [key, save] of Object.entries(saves)) preload(key, save);
            run = await boot(label);
            if (!run.booted) continue;
            // Give boot-time reads a moment to report how they went.
            const wanted = listed ? Object.keys(saves) : [];
            let seen = [];
            for (let wait = 0; wait < 20; wait++) {
                seen = await outcomes();
                if (wanted.every((key) => seen.some((o) => o.key === key)))
                    break;
                await page.waitForTimeout(250);
            }
            // Keys the game reads later (not at boot) are read now.
            await each(
                Object.keys(saves).filter(
                    (key) => !seen.some((o) => o.key === key)
                ),
                (key) => probe({ op: "get", key })
            );
            seen = await outcomes();
            run.outcomes = Object.fromEntries(
                seen.map((o) => [o.key, o.outcome])
            );
            for (const [key, save] of Object.entries(saves)) {
                const outcome = seen.find((o) => o.key === key)?.outcome;
                if (!["migrated", "reset"].includes(outcome))
                    findings.push({
                        code: "SAVED_OLD_SAVE",
                        message: `${label}: key "${key}" came back "${
                            outcome ?? "unread"
                        }"; a save from version ${
                            save.stateVersion
                        } must be migrated or reset`,
                    });
                else if (save.expect && outcome !== save.expect)
                    findings.push({
                        code: "SAVED_OLD_SAVE",
                        message: `${label}: key "${key}" was ${outcome}, game.json expects ${save.expect}`,
                    });
            }
            await settle(label, run);
        }
    } finally {
        await browser.close();
        server.close();
    }
    return done();
}

// Run directly: sync, or this stage alone.
if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const [command, id] = process.argv.slice(2);
    if (command === "sync") {
        writeFileSync(
            DECLARED,
            JSON.stringify(await allDeclared(), null, 4) + "\n"
        );
        console.log("wrote frontend/features/games/savedData.declared.json");
    } else if (
        command === "check" &&
        /^[a-z0-9][a-z0-9-]{0,62}$/.test(id ?? "")
    ) {
        const manifest = JSON.parse(
            readFileSync(join(root, "games", id, "game.json"), "utf8")
        );
        const { chromium } = createRequire(import.meta.url)("playwright");
        const launch = () =>
            chromium.launch({
                channel: process.env.PW_CHANNEL || undefined,
                args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
            });
        const stage = await runSavedDataStage({
            id,
            manifest,
            out: join(root, "frontend/public/games", id),
            launch,
        });
        stage.findings.unshift(
            ...(await savedStaticFindings({ id, manifest }))
        );
        console.log(
            `${id}: saved data ${
                stage.findings.length ? "failed" : "passed"
            } · ${stage.keys} key(s) · ${stage.ms} ms`
        );
        for (const run of stage.runs)
            console.log(
                `  ${run.booted ? "ok " : "NO "} ${run.run} (${run.ms} ms)${
                    run.outcomes ? " " + JSON.stringify(run.outcomes) : ""
                }`
            );
        for (const finding of stage.findings)
            console.log(`  ${finding.code}: ${finding.message}`);
        process.exit(stage.findings.length ? 1 : 0);
    } else {
        console.error("usage: saved-data.mjs sync | check <id>");
        process.exit(2);
    }
}
