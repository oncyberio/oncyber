import { test } from "node:test";
import assert from "node:assert/strict";
import {
    basePath,
    checkSource,
    readName,
    saveRequest,
    scriptCommand,
    scriptFile,
} from "./world-script.mjs";

const rules = {
    names: [
        "world",
        "input",
        "ui",
        "sound",
        "keep",
        "wait",
        "every",
        "random",
        "distance",
        "console",
    ],
    maxSourceBytes: 200,
};

test("a script that parses with the names it is handed passes", () => {
    const result = checkSource(
        'const n = keep("n", { hits: 0 });\nworld.onUpdate((dt) => { n.hits += dt; });',
        rules
    );
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
});

test("what cannot run is a problem, with its line", () => {
    const broken = checkSource(
        "ui.toast('hi', 2);\nworld.add({ id: 'a', ;",
        rules
    );
    assert.equal(broken.ok, false);
    assert.match(broken.problems[0], /does not parse \(line 2\)/);
    assert.equal(checkSource("   \n", rules).ok, false);
    const long = checkSource(`ui.toast("${"x".repeat(300)}", 1);`, rules);
    assert.match(long.problems[0], /bytes; a script may be 200/);
    // The sandbox runs a script as a strict function: no await at the top.
    assert.equal(checkSource("await wait(1);", rules).ok, false);
});

test("reaching for what a script is not given is a warning, in code only", () => {
    const result = checkSource(
        '// document and fetch are named here in a comment\nui.toast("window", 1);\nfetch("/x"); const r = Math.random();',
        { ...rules, maxSourceBytes: 4000 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 2);
    assert.match(result.warnings.join(" "), /the network/);
    assert.match(result.warnings.join(" "), /random\(\)/);
});

test("a script is named by its first line, a flag, or what it was called", () => {
    assert.equal(
        readName("// name: Lanterns on the road\nui.clear();"),
        "Lanterns on the road"
    );
    assert.equal(readName("ui.clear();\n// name: not the first line"), "");
    assert.equal(
        saveRequest("abc", "// name: Lanterns\n", 5).scripts[0].name,
        "Lanterns"
    );
    assert.equal(
        saveRequest("abc", "ui.clear();", 5).scripts[0].name,
        "World script"
    );
    assert.deepEqual(
        saveRequest("abc", "ui.clear();", 5, { name: "Mine", id: "s9" }),
        {
            experienceId: "abc",
            scripts: [
                {
                    id: "s9",
                    name: "Mine",
                    source: "ui.clear();",
                    enabled: true,
                },
            ],
            base: 5,
        }
    );
});

/** A server holding one space, and files in memory. */
function world(saved = null) {
    const files = new Map();
    const said = [];
    const calls = [];
    let space = saved; // { id, name, source, updatedAt } or null
    const rpc = async (method, params) => {
        calls.push([method, params]);
        if (method === "reference")
            return {
                ok: true,
                reference: "The script body runs once at start.",
                ...rules,
                maxSourceBytes: 4000,
            };
        if (method === "get")
            return {
                ok: true,
                scripts: space
                    ? [
                          {
                              id: space.id,
                              name: space.name,
                              source: space.source,
                              enabled: true,
                          },
                      ]
                    : [],
                style: null,
                savedAt: space?.updatedAt || 0,
            };
        if (method === "save") {
            if (!params.scripts.length) {
                space = null;
                return { ok: true, scripts: [], style: null };
            }
            if (params.base != null && params.base !== (space?.updatedAt || 0))
                return {
                    ok: false,
                    conflict: true,
                    error: "This space's script was changed somewhere else.",
                };
            space = {
                ...params.scripts[0],
                updatedAt: (space?.updatedAt || 100) + 1,
            };
            return { ok: true, scripts: [space], style: null };
        }
        return { ok: false, error: "unknown" };
    };
    const io = {
        log: (line) => said.push(line),
        readFile: async (path) => {
            if (!files.has(path)) throw new Error(`no ${path}`);
            return files.get(path);
        },
        writeFile: async (path, text) => void files.set(path, text),
        exists: (path) => files.has(path),
        baseUrl: "https://site.example",
    };
    return {
        files,
        said,
        calls,
        rpc,
        io,
        space: () => space,
        change: (next) => (space = next),
        run: (...args) => scriptCommand(args, rpc, io),
    };
}

test("pull, edit, push: the file is what is saved, built on what was pulled", async () => {
    const w = world({
        id: "s1",
        name: "Coins",
        source: "ui.clear();",
        updatedAt: 7,
    });
    await w.run("pull", "abc");
    const file = scriptFile("abc");
    assert.equal(w.files.get(file), "ui.clear();");
    assert.deepEqual(JSON.parse(w.files.get(basePath(file))), {
        savedAt: 7,
        id: "s1",
        name: "Coins",
    });

    w.files.set(file, 'ui.toast("two", 2);');
    await w.run("push", "abc");
    assert.deepEqual(w.calls.at(-1), [
        "save",
        {
            experienceId: "abc",
            scripts: [
                {
                    id: "s1",
                    name: "Coins",
                    source: 'ui.toast("two", 2);',
                    enabled: true,
                },
            ],
            base: 7,
        },
    ]);
    // The next push builds on this one.
    assert.equal(JSON.parse(w.files.get(basePath(file))).savedAt, 8);
    assert.match(
        w.said.join("\n"),
        /See it: https:\/\/site\.example\/spaces\/abc/
    );
});

test("a space with no script gets a starter, and a first push builds on nothing", async () => {
    const w = world();
    await w.run("pull", "abc", "mine.js");
    assert.match(w.files.get("mine.js"), /^\/\/ name: World script/);
    const fresh = world();
    fresh.files.set("new.js", "// name: Lanterns\nui.clear();");
    await fresh.run("push", "abc", "new.js");
    assert.equal(fresh.space().name, "Lanterns");
    assert.equal(fresh.calls.at(-1)[1].base, 0);
});

test("a push that builds on an older save is refused, and says what to do", async () => {
    const w = world({
        id: "s1",
        name: "Coins",
        source: "ui.clear();",
        updatedAt: 7,
    });
    await w.run("pull", "abc");
    // Somebody saves from the sidebar meanwhile.
    w.change({
        id: "s1",
        name: "Coins",
        source: "ui.banner('x', 1);",
        updatedAt: 9,
    });
    await assert.rejects(
        w.run("push", "abc"),
        /changed somewhere else since this file was pulled/
    );
    assert.equal(w.space().source, "ui.banner('x', 1);");
});

test("a file that cannot run is never sent", async () => {
    const w = world();
    w.files.set("bad.js", "world.add({ ;");
    await assert.rejects(
        w.run("push", "abc", "bad.js"),
        /cannot run as a world script/
    );
    assert.equal(
        w.calls.some(([method]) => method === "save"),
        false
    );
    await assert.rejects(w.run("check", "bad.js"), /does not parse/);
});

test("check passes a good file without saving; reference prints; clear empties", async () => {
    const w = world({
        id: "s1",
        name: "Coins",
        source: "ui.clear();",
        updatedAt: 7,
    });
    w.files.set("ok.js", "ui.clear();");
    await w.run("check", "ok.js");
    assert.match(w.said.join("\n"), /parses as a world script/);
    await w.run("reference");
    assert.match(w.said.at(-1), /^The script body runs once/);
    await w.run("clear", "abc");
    assert.equal(w.space(), null);
    await assert.rejects(w.run("bogus", "abc"), /Unknown script command/);
});

test("access: a site admin reads the list, adds someone and takes them out", async () => {
    const listed = new Map();
    const said = [];
    const rpc = async (method, params) => {
        if (method === "people")
            return {
                ok: true,
                people: [...listed.values()],
                fromSettings: ["0xabc"],
            };
        if (method === "grant") {
            if (params.who === "nobody")
                return { ok: false, error: 'No account goes by "nobody".' };
            const person = {
                accountId: "acc-1",
                username: params.who,
                addedBy: "admin",
                addedAt: 1,
            };
            listed.set(person.accountId, person);
            return { ok: true, person };
        }
        if (method === "revoke")
            return {
                ok: true,
                removed: listed.delete("acc-1"),
                still: params.who === "boss" ? "a site admin" : "",
            };
        throw new Error(method);
    };
    const io = { log: (line) => said.push(line) };
    await scriptCommand(["access", "add", "alice"], rpc, io);
    assert.match(said.pop(), /alice is in early access now/);
    await scriptCommand(["access"], rpc, io);
    assert.ok(
        said.some((line) => /alice\s+\(acc-1\)\s+added by admin/.test(line))
    );
    assert.ok(
        said.some((line) =>
            /0xabc\s+\(from this deployment's settings\)/.test(line)
        )
    );
    await scriptCommand(["access", "remove", "alice"], rpc, io);
    assert.match(said.pop(), /alice is out of early access/);
    await scriptCommand(["access", "remove", "boss"], rpc, io);
    assert.match(said.pop(), /still use world scripts: they are a site admin/);
    assert.match(said.pop(), /boss was not on the list/);
    // The server's own refusal is what is said.
    await assert.rejects(
        scriptCommand(["access", "add", "nobody"], rpc, io),
        /No account goes by "nobody"/
    );
    await assert.rejects(
        scriptCommand(["access", "add"], rpc, io),
        /Usage: script access/
    );
});
