// Has a language model write a play action (how a person moves for a
// moment: a hit, a throw, a dodge) from a description, and adds it to
// frontend/features/play-zone/actions.json.
//
//   PLAY_AUTHOR_URL=<chat completions address> PLAY_AUTHOR_MODEL=<model> \
//   PLAY_AUTHOR_KEY=<key> node scripts/play-action.mjs "volleyball spike" [more ...]
//
// The model returns data in the action format; readPlayAction clamps it, so
// nothing it writes can do more than move a body. Look at the result on
// /dev/play-action before using it: a model is good at where the limbs go
// and weaker at timing.
//
// --note "..." adds guidance to every description, e.g. after watching a result.
// --print shows the actions without saving them.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { readPlayAction } = require("../multiplayer/protocol/play-action.js");
const { ACTION_BRIEF } = require("../multiplayer/protocol/play-brief.js");
const LIBRARY = join(
    dirname(fileURLToPath(import.meta.url)),
    "../frontend/features/play-zone/actions.json"
);

export async function writeAction(description, { url, model, key, note = "" }) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: ACTION_BRIEF },
                {
                    role: "user",
                    content: `Write this action: ${description}${
                        note ? `\n\nAlso: ${note}` : ""
                    }`,
                },
            ],
        }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.choices?.length)
        throw new Error(
            `The model did not answer (${response.status}): ${JSON.stringify(
                body?.error || body
            ).slice(0, 200)}`
        );
    const text = String(body.choices[0].message?.content || "");
    let raw;
    try {
        // Some models wrap JSON in a fence however they are asked.
        raw = JSON.parse(
            text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
        );
    } catch {
        throw new Error(`Not JSON: ${text.slice(0, 200)}`);
    }
    const action = readPlayAction(raw);
    if (!action)
        throw new Error(`No moment places anything: ${text.slice(0, 200)}`);
    return { action, servedBy: body.model, cost: body.usage?.cost ?? null };
}

async function main() {
    const args = process.argv.slice(2);
    const flag = (name) => {
        const at = args.indexOf(name);
        return at < 0 ? null : args.splice(at, 2)[1] ?? "";
    };
    const note = flag("--note") || "";
    const print =
        args.includes("--print") &&
        args.splice(args.indexOf("--print"), 1).length > 0;
    const {
        PLAY_AUTHOR_URL: url,
        PLAY_AUTHOR_MODEL: model,
        PLAY_AUTHOR_KEY: key,
    } = process.env;
    if (!url || !model || !key || !args.length) {
        console.error(
            'Set PLAY_AUTHOR_URL, PLAY_AUTHOR_MODEL and PLAY_AUTHOR_KEY, then: node scripts/play-action.mjs "volleyball spike"'
        );
        process.exit(1);
    }
    const library = JSON.parse(readFileSync(LIBRARY, "utf8"));
    for (const description of args) {
        const started = Date.now();
        try {
            const { action, servedBy, cost } = await writeAction(description, {
                url,
                model,
                key,
                note,
            });
            library[action.name] = { description, ...action };
            console.log(
                `${action.name}: ${action.moments.length} moments over ${
                    action.seconds
                } s, contact ${action.contact ?? "none"} (${servedBy}, ${
                    Date.now() - started
                } ms${cost === null ? "" : `, $${cost}`})`
            );
            if (print) console.log(JSON.stringify(action, null, 2));
        } catch (error) {
            console.error(`${description}: ${error.message}`);
            process.exitCode = 1;
        }
    }
    if (!print)
        writeFileSync(
            LIBRARY,
            JSON.stringify(
                Object.fromEntries(
                    Object.entries(library).sort(([a], [b]) =>
                        a.localeCompare(b)
                    )
                ),
                null,
                4
            ) + "\n"
        );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
