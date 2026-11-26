/**
 * A space's world script from the terminal: the `script` commands of
 * world-cli.mjs (docs/world-scripts.md).
 *
 * A world script is saved with its space, and there are two ways to make
 * one. In the browser, an editor asks for it in the sidebar. Here, a person
 * or a coding agent writes it in a file and pushes it. Both go through the
 * same checked procedure (`worldScripts.save`): the same rules about who
 * may, the same limits, the same refusal to write over a change made
 * somewhere else.
 *
 *   node scripts/world-cli.mjs script reference
 *   node scripts/world-cli.mjs script pull <exhibitId> [file]
 *   node scripts/world-cli.mjs script check <file>
 *   node scripts/world-cli.mjs script push <exhibitId> [file] [--name "..."]
 *   node scripts/world-cli.mjs script clear <exhibitId>
 *
 * `file` defaults to `./<exhibitId>.world-script.js`: the script's source,
 * exactly as it is saved. Beside it `pull` and `push` keep
 * `<file>.base.json`, which records the save the file builds on; `push`
 * sends it, and the server refuses a push that builds on an older save
 * than the space now has (pull again and carry your change over).
 *
 * `check` reads the file as the sandbox will (the same names handed to it,
 * the same strictness) and stops on what cannot run: it is too long, it
 * does not parse, it reaches for something a script is not given. It does
 * not run the script: open the space to see it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import vm from "node:vm";

export const DEFAULT_NAME = "World script";
const SCRIPT_ID = "script";

export const scriptFile = (exhibitId) => `${exhibitId}.world-script.js`;
export const basePath = (file) => `${file}.base.json`;

/** A first line `// name: Lanterns on the road` names the script. */
export function readName(source) {
    const named = /^\s*\/\/\s*name:\s*(.+)$/im.exec(source.split("\n", 1)[0]);
    return named ? named[1].trim().slice(0, 40) : "";
}

// What a script might reach for out of habit and is not given: it runs in
// a sandbox with no page, no network and no modules.
const NOT_GIVEN = [
    [/\b(document|window|globalThis|localStorage)\b/, "the page"],
    [/\b(fetch|XMLHttpRequest|WebSocket)\b/, "the network"],
    [/^\s*import\s|\brequire\s*\(/m, "modules"],
    [/\bTHREE\b/, "three.js"],
    [
        /\bMath\.random\s*\(/,
        "Math.random (use random(), which repeats on a rewind)",
    ],
];

/**
 * What stops this source from running as a world script, and what will
 * probably not do what was meant. `names` and `maxSourceBytes` are the
 * server's own (`worldScripts.reference`).
 */
export function checkSource(source, { names, maxSourceBytes }) {
    const problems = [];
    const warnings = [];
    const bytes = Buffer.byteLength(source, "utf8");
    if (!source.trim()) problems.push("The file is empty.");
    if (bytes > maxSourceBytes)
        problems.push(
            `The script is ${bytes} bytes; a script may be ${maxSourceBytes}.`
        );
    try {
        // As the sandbox wraps it (features/world-scripts/sdk.ts): a strict
        // function handed the script's names. Compiled, never called.
        new vm.Script(
            `(function (${names.join(", ")}) {\n"use strict";\n${source}\n});`,
            { filename: "world-script.js", lineOffset: -2 }
        );
    } catch (error) {
        const line = /world-script\.js:(\d+)/.exec(String(error.stack))?.[1];
        problems.push(
            `It does not parse${line ? ` (line ${line})` : ""}: ${
                error.message
            }`
        );
    }
    // Comments and strings may name anything: look at the code alone.
    const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
    for (const [pattern, what] of NOT_GIVEN)
        if (pattern.test(code))
            warnings.push(`It uses ${what}, which a script is not given.`);
    return { ok: problems.length === 0, problems, warnings, bytes };
}

/** What `worldScripts.save` is sent for this file. */
export function saveRequest(exhibitId, source, base, { name, id } = {}) {
    return {
        experienceId: exhibitId,
        scripts: [
            {
                id: id || SCRIPT_ID,
                name: (name || readName(source) || DEFAULT_NAME).slice(0, 40),
                source,
                enabled: true,
            },
        ],
        base,
    };
}

const STARTER = `// name: ${DEFAULT_NAME}
// Runs once when the space starts. \`node scripts/world-cli.mjs script reference\`
// prints everything a script may use.
ui.toast("Hello from a world script", 4);
`;

/**
 * Runs a `script` command. `rpc(method, params)` calls a procedure of the
 * `worldScripts` service as the signed-in account; `io` is where it reads,
 * writes and prints, so the commands can be tested without a server.
 */
export async function scriptCommand(args, rpc, io = {}) {
    const say = io.log || console.log;
    const read = io.readFile || ((path) => readFile(path, "utf-8"));
    const write =
        io.writeFile || ((path, text) => writeFile(path, text, "utf-8"));
    const exists = io.exists || existsSync;
    const baseUrl = io.baseUrl || "";
    const flags = {};
    const rest = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--name") flags.name = args[++i];
        else rest.push(args[i]);
    }
    const [command, first, second] = rest;
    // A refusal is the server's own sentence: say it and stop.
    const ask = async (method, params) => {
        const answer = await rpc(method, params);
        if (!answer?.ok) throw new Error(answer?.error || `${method} failed.`);
        return answer;
    };
    const checked = async (file) => {
        const source = await read(file);
        const rules = await ask("reference", {});
        const result = checkSource(source, rules);
        for (const warning of result.warnings) say(`warning: ${warning}`);
        if (!result.ok)
            throw new Error(
                [
                    `${file} cannot run as a world script:`,
                    ...result.problems,
                ].join("\n  ")
            );
        return { source, bytes: result.bytes, max: rules.maxSourceBytes };
    };

    if (command === "reference") {
        say((await ask("reference", {})).reference);
        return;
    }
    if (command === "check") {
        if (!first) throw new Error("Usage: script check <file>");
        const { bytes, max } = await checked(first);
        say(`${first} parses as a world script (${bytes} of ${max} bytes).`);
        say("Not run: push it and open the space to see it.");
        return;
    }
    if (!first)
        throw new Error(
            "Usage: script <reference|pull|check|push|clear> [exhibitId] [file]"
        );
    const exhibitId = first;
    const file = second || scriptFile(exhibitId);

    if (command === "pull") {
        const saved = await ask("get", { experienceId: exhibitId });
        const script = saved.scripts[0];
        await write(file, script ? script.source : STARTER);
        await write(
            basePath(file),
            JSON.stringify(
                {
                    savedAt: saved.savedAt,
                    id: script?.id || SCRIPT_ID,
                    name: script?.name || "",
                },
                null,
                2
            ) + "\n"
        );
        say(
            script
                ? `Pulled "${script.name}" from ${exhibitId} -> ${file}`
                : `${exhibitId} has no script yet: wrote a starter to ${file}`
        );
        return;
    }
    if (command === "push") {
        const { source } = await checked(file);
        // No record of a pull: this is a first script, built on nothing.
        const base = exists(basePath(file))
            ? JSON.parse(await read(basePath(file)))
            : { savedAt: 0 };
        const request = saveRequest(exhibitId, source, base.savedAt, {
            name: flags.name || readName(source) || base.name,
            id: base.id,
        });
        const answer = await rpc("save", request);
        if (!answer?.ok)
            throw new Error(
                answer?.conflict
                    ? `${exhibitId}'s script was changed somewhere else since this file was pulled. ` +
                      "Pull it into another file, carry your change over, and push that."
                    : answer?.error || "save failed."
            );
        const stored = answer.scripts[0];
        await write(
            basePath(file),
            JSON.stringify(
                { savedAt: stored.updatedAt, id: stored.id, name: stored.name },
                null,
                2
            ) + "\n"
        );
        say(`Saved "${stored.name}" to ${exhibitId}.`);
        if (baseUrl) say(`See it: ${baseUrl}/spaces/${exhibitId}`);
        return;
    }
    if (command === "clear") {
        const answer = await rpc("save", {
            experienceId: exhibitId,
            scripts: [],
        });
        if (!answer?.ok) throw new Error(answer?.error || "clear failed.");
        say(`${exhibitId} has no script now.`);
        return;
    }
    throw new Error(`Unknown script command: ${command}`);
}
