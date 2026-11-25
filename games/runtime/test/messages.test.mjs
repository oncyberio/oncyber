// games/runtime/messages.json is the one list of what a game and its page
// say to each other. This test holds the game's side to it: every kind the
// runtime sends or hears is listed, every listed kind is still handled by
// the file the list names, and its page of the docs still describes it.
// The page's side is held by frontend/features/games/gameMessages.test.ts.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { CONTRACT_VERSION, GAME_MESSAGE_PREFIX } from "../src/contract.ts";
import { KEY_MESSAGES } from "../src/keys.ts";
import { SAFE_AREA_KIND } from "../src/safe-area.ts";

const repo = new URL("../../../", import.meta.url);
const src = new URL("games/runtime/src/", repo);
const read = (path) => readFileSync(new URL(path, repo), "utf8");
const list = JSON.parse(read("games/runtime/messages.json"));
const kinds = Object.entries(list.kinds);
/** `kind` written as a message kind: quoted, or after a prefix or its colon. */
export const mentions = (text, kind) =>
    new RegExp(`(["\`:}])${kind}(?![a-z-])`).test(text);

test("the list is for this contract and every entry is well formed", () => {
    assert.equal(list.contract, CONTRACT_VERSION);
    assert.equal(list.prefix, GAME_MESSAGE_PREFIX);
    assert.ok(kinds.length > 30);
    for (const [kind, entry] of kinds) {
        assert.match(kind, /^[a-z][a-z-]{0,31}$/, kind);
        assert.ok(["game", "page", "both"].includes(entry.from), kind);
        assert.ok(entry.sdk === null || typeof entry.sdk === "string", kind);
        assert.ok(entry.page === null || typeof entry.page === "string", kind);
        // A kind neither side handles is not a message.
        assert.ok(entry.sdk || entry.page, `${kind} has no side`);
        // The site's page handles everything but what only the check asks.
        assert.equal(entry.page === null, entry.check === true, kind);
        if (entry.sdk === null) assert.ok(entry.note, `${kind}: say why`);
    }
});

test("every listed kind is handled by the runtime file the list names", () => {
    for (const [kind, { sdk }] of kinds) {
        if (!sdk) continue;
        assert.ok(existsSync(new URL(sdk, src)), `${sdk} (for ${kind})`);
        assert.ok(
            mentions(readFileSync(new URL(sdk, src), "utf8"), kind),
            `games/runtime/src/${sdk} no longer handles "${kind}"`
        );
    }
});

test("every listed kind is described on its page of the docs", () => {
    for (const [kind, { doc }] of kinds) {
        assert.ok(existsSync(new URL(doc, repo)), `${doc} (for ${kind})`);
        assert.ok(
            read(doc).includes(`\`${kind}\``),
            `${doc} does not mention \`${kind}\``
        );
    }
});

test("the runtime sends and hears no kind the list leaves out", () => {
    // How the runtime's files spell a kind where one is sent or matched.
    const spellings = [
        /\bpost\("([a-z][a-z-]*)"/g,
        /\bkind === "([a-z][a-z-]*)"/g,
        /\$\{(?:options\.)?prefix\}([a-z][a-z-]*)/g,
        /\$\{GAME_MESSAGE_PREFIX\}([a-z][a-z-]*)/g,
        /\$\{gameId\}:([a-z][a-z-]*)/g,
    ];
    // `kind ===` on something that is not a message: a touch control's
    // kind (devices.ts) and a result's player kind (results.ts).
    const notMessages = new Set(["button", "stick", "self:results.ts"]);
    const used = new Map();
    for (const file of readdirSync(src).filter((f) => f.endsWith(".ts"))) {
        const text = readFileSync(new URL(file, src), "utf8");
        for (const spelling of spellings)
            for (const [, kind] of text.matchAll(spelling))
                if (
                    !notMessages.has(kind) &&
                    !notMessages.has(`${kind}:${file}`)
                )
                    used.set(kind, file);
    }
    for (const kind of [...Object.values(KEY_MESSAGES), SAFE_AREA_KIND])
        used.set(kind, "its table of kinds");
    assert.ok(used.size > 25, `only ${used.size} kinds found`);
    for (const [kind, file] of used)
        assert.ok(
            Object.hasOwn(list.kinds, kind),
            `${file} uses "${kind}", which games/runtime/messages.json does not list`
        );
});
