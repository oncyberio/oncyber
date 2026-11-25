import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import list from "../../../games/runtime/messages.json";

// games/runtime/messages.json is the one list of what a game and its page
// say to each other. This test holds the page's side to it: every listed
// kind is still handled by the file the list names, and the page sends and
// hears no kind the list leaves out. The game's side is held by
// games/runtime/test/messages.test.mjs.
const here = __dirname;
const kinds = Object.entries(
    list.kinds as Record<
        string,
        { from: string; page: string | null; check?: boolean }
    >
);
/** `kind` written as a message kind: quoted, or after a prefix or its colon. */
const mentions = (text: string, kind: string) =>
    new RegExp(`(["\`:}])${kind}(?![a-z-])`).test(text);

test("every listed kind is handled by the page file the list names", () => {
    for (const [kind, { page, check }] of kinds) {
        // A kind only the check uses has no handler on the site's page.
        if (check) continue;
        expect(`${kind}: ${page && existsSync(join(here, page))}`).toBe(
            `${kind}: true`
        );
        expect(
            mentions(readFileSync(join(here, page), "utf8"), kind)
                ? kind
                : `${page} no longer handles "${kind}"`
        ).toBe(kind);
    }
});

test("the page sends and hears no kind the list leaves out", () => {
    // How the page's files spell a kind where one is sent or matched.
    const spellings = [
        /\bpost(?:Game\.current)?\("([a-z][a-z-]*)"/g,
        /\b(?:kind|type) [!=]== "([a-z][a-z-]*)"/g,
        /\$\{(?:game|GAME|options\.game)\}:([a-z][a-z-]*)/g,
        /\$\{(?:options\.)?prefix\}([a-z][a-z-]*)/g,
        /\$\{GAME_MESSAGE_PREFIX\}([a-z][a-z-]*)/g,
    ];
    const notMessages = new Set([
        // `typeof type !== "string"`.
        "string",
        // Between the page and the lobby around it, not the game.
        "lobby-identity",
        "identity-request",
        // The room's roster reaches the game inside `party`, not by itself.
        "roster",
        // What a `health` message carries, and what the page records of it.
        "frames",
        "stage",
        "stage-failed",
        "load-failed",
        // Who a result's player is.
        "cpu",
    ]);
    const used = new Map<string, string>();
    for (const file of readdirSync(here)) {
        if (!/\.tsx?$/.test(file) || /\.(test|jest)\./.test(file)) continue;
        const text = readFileSync(join(here, file), "utf8");
        for (const spelling of spellings)
            for (const [, kind] of text.matchAll(spelling))
                if (!notMessages.has(kind)) used.set(kind, file);
    }
    expect(used.size).toBeGreaterThan(25);
    const unlisted = [...used]
        .filter(([kind]) => !Object.hasOwn(list.kinds, kind))
        .map(
            ([kind, file]) =>
                `${file} uses "${kind}", which games/runtime/messages.json does not list`
        );
    expect(unlisted).toEqual([]);
});
