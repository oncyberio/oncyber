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
const {
    ACTION_LIMITS,
    ACTION_REST,
    readPlayAction,
} = require("../multiplayer/protocol/play-action.js");
const LIBRARY = join(
    dirname(fileURLToPath(import.meta.url)),
    "../frontend/features/play-zone/actions.json"
);

export const BRIEF = `You write short body movements for a 3D character as data. A solver places the whole body from a few "moments"; you choose where the hands, feet and hips are at each one.

SPACE. The character's own space, in metres, for a body 1.8 m tall: x is to the character's RIGHT, y is UP from the floor, z is the way the character FACES.

THE BODY. Standing still: hips at [0, 0.95, 0]. Shoulders at height 1.45, 0.2 to each side. Head at 1.67. Right hand hangs at ${JSON.stringify(
    ACTION_REST.rightHand
)}, left at ${JSON.stringify(
    ACTION_REST.leftHand
)}. Feet on the floor at ${JSON.stringify(
    ACTION_REST.rightFoot
)} and ${JSON.stringify(ACTION_REST.leftFoot)}.
An arm reaches 0.62 from its shoulder. A leg reaches 0.89 from its hip joint (0.1 to each side of the hips). A place out of reach is cut short at full stretch, so keep hands within reach of where the shoulders will be. Lowering the hips bends the knees. Raising a foot's y lifts it off the floor.
"lean" bends the torso forward in degrees (negative is backward, ${
    ACTION_LIMITS.lean[0]
} to ${
    ACTION_LIMITS.lean[1]
}). "twist" turns the torso to the character's LEFT in degrees (negative is to the right, ${
    ACTION_LIMITS.twist[0]
} to ${
    ACTION_LIMITS.twist[1]
}); a right-handed swing winds up with a negative twist and ends with a positive one.

FORMAT. Reply with one JSON object and nothing else:
{
  "name": "short-name",
  "seconds": 0.2 to 3,
  "moments": [
    { "at": 0 to 1, "ease": "in" | "out" | "in-out" | "linear",
      "rightHand": [x, y, z] or "target", "leftHand": [x, y, z] or "target",
      "rightFoot": [x, y, z], "leftFoot": [x, y, z],
      "hips": [x, y, z], "lean": degrees, "twist": degrees }
  ]
}
"at" is when, as a share of the whole action. Use 3 to 7 moments, in order. A moment only needs the parts that matter then; a part left out carries on smoothly to its next mention. The action starts and ends standing still by itself: do not add moments at 0 or 1 for that.
"ease" is how the body ARRIVES at that moment: "out" arrives fast and settles (a wind-up, a follow-through), "in" starts slow and arrives at speed (the strike itself), "in-out" is gentle.
If the action hits or catches something, the hand that touches it must be "target" at exactly one moment: the solver sends it to wherever the thing really is. The thing is usually in front of the character between chest and overhead height.

WHAT MAKES IT LOOK ALIVE.
- Anticipation: before the main move, go the other way first (hand back before a throw, hips down before a jump). Give it a third to a half of the time.
- The strike is the fastest part and short: 10 to 20 percent of the time, eased "in".
- Follow through: the limb carries on past the contact, and the torso with it, eased "out".
- The whole body takes part: bend the knees, shift the hips towards the move, lean and twist the torso, let the other arm balance. A limb moving alone looks robotic.
- Keep a foot on the floor unless the action is a jump or a kick. For a jump, raise the hips and both feet together.
- Be bold with the positions. Small moves read as nothing at a distance.`;

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
                { role: "system", content: BRIEF },
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
