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
 *   node scripts/world-cli.mjs script push <exhibitId> [file] [--name "..."] [--rewind]
 *   node scripts/world-cli.mjs script clear <exhibitId>
 *   node scripts/world-cli.mjs script access [add|remove <who>]
 *
 * `file` defaults to `./<exhibitId>.world-script.js`: the script's source,
 * exactly as it is saved. Beside it `pull` and `push` keep
 * `<file>.base.json`, which records the save the file builds on; `push`
 * sends it, and the server refuses a push that builds on an older save
 * than the space now has (pull again and carry your change over).
 *
 * Spaces that are open pick a push up without reloading. How it lands in
 * them is the pusher's to say, who knows what they changed: by default it
 * is added to the running game (things with the same id stay where they
 * are, `keep()` values carry over, visitors stay where they stand), which
 * is right whenever the change can simply be added. `--rewind` starts the
 * round again, for new rules or a new game.
 *
 * A space's style is the look its script's things are drawn in (a painted
 * world paints them). It is kept in `<file>.style.json`: `pull` writes it
 * when the space has one, and `push` saves it with the script when the
 * file is there. Without a style, things are plain.
 *
 * `check` reads the file as the sandbox will (the same names handed to it,
 * the same strictness) and stops on what cannot run: it is too long, it
 * does not parse, it reaches for something a script is not given. It does
 * not run the script: open the space to see it.
 *
 * `access` is for Oncyber's site admins: who is in early access for world
 * scripts. With nothing after it, the list; `add` and `remove` take an
 * account id, a wallet or a username.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import vm from "node:vm";

export const DEFAULT_NAME = "World script";
const SCRIPT_ID = "script";

export const scriptFile = (exhibitId) => `${exhibitId}.world-script.js`;
export const basePath = (file) => `${file}.base.json`;
export const stylePath = (file) => `${file}.style.json`;

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
export function saveRequest(
    exhibitId,
    source,
    base,
    { name, id, style, landing } = {}
) {
    return {
        ...(style ? { style } : {}),
        ...(landing ? { landing } : {}),
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
        else if (args[i] === "--rewind") flags.rewind = true;
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
    if (command === "access") {
        const action = first || "list";
        if (action === "list") {
            const { people, fromSettings } = await ask("people", {});
            say("In early access for world scripts (site admins always are):");
            for (const person of people)
                say(
                    `  ${person.username || person.accountId}` +
                        (person.username ? `  (${person.accountId})` : "") +
                        `  added by ${person.addedBy}`
                );
            for (const name of fromSettings)
                say(`  ${name}  (from this deployment's settings)`);
            if (!people.length && !fromSettings.length) say("  nobody yet");
            return;
        }
        if (!["add", "remove"].includes(action) || !second)
            throw new Error("Usage: script access [add|remove <who>]");
        if (action === "add") {
            const { person } = await ask("grant", { who: second });
            say(
                `${person.username || person.accountId} is in early access now.`
            );
            return;
        }
        const { removed, still } = await ask("revoke", { who: second });
        say(
            removed
                ? `${second} is out of early access.`
                : `${second} was not on the list.`
        );
        if (still) say(`They can still use world scripts: they are ${still}.`);
        return;
    }
    if (!first)
        throw new Error(
            "Usage: script <reference|pull|check|push|clear|access> [exhibitId] [file]"
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
        if (saved.style)
            await write(
                stylePath(file),
                JSON.stringify(saved.style, null, 4) + "\n"
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
        let style;
        if (!exists(stylePath(file)))
            say(
                `warning: no ${stylePath(
                    file
                )}. Unless the space already has a style, ` +
                    "what the script makes is drawn plain, not in the world's look."
            );
        if (exists(stylePath(file))) {
            try {
                style = JSON.parse(await read(stylePath(file)));
            } catch {
                throw new Error(`${stylePath(file)} is not JSON.`);
            }
        }
        const request = saveRequest(exhibitId, source, base.savedAt, {
            name: flags.name || readName(source) || base.name,
            id: base.id,
            style,
            landing: flags.rewind ? "rewind" : "add",
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
        say(
            `Saved "${stored.name}" to ${exhibitId}` +
                (style ? ", with its style." : ".")
        );
        say(
            answer.announced === false
                ? "Spaces that are open were not told: they have it on their next load."
                : flags.rewind
                ? "Spaces that are open pick it up now: the round starts again."
                : "Spaces that are open pick it up now, added to the running game."
        );
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
