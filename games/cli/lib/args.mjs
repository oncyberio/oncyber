// The command line: `oncyber <command> [arguments] [--flags]`.

/** Each command: its arguments, and the flags it takes (true = with a value). */
export const COMMANDS = {
    new: {
        usage: 'new <id> [--name "Name"]',
        min: 1,
        max: 1,
        flags: { name: true },
    },
    dev: { usage: "dev [-- <vite arguments>]", max: 0, rest: true, flags: {} },
    build: { usage: "build", max: 0, flags: {} },
    check: {
        usage: "check [--video] [--headed]",
        max: 0,
        flags: { video: false, headed: false, thumbnail: false },
    },
    login: { usage: "login", max: 0, flags: {} },
    logout: { usage: "logout", max: 0, flags: {} },
    publish: {
        usage: "publish [--video] [--headed]",
        max: 0,
        flags: { video: false, headed: false },
    },
    games: { usage: "games [--json]", max: 0, flags: { json: false } },
    unpublish: { usage: "unpublish <id>", min: 1, max: 1, flags: {} },
    link: {
        usage: "link <id> <slug> | link <id> --clear",
        min: 1,
        max: 2,
        flags: { clear: false },
    },
    docs: { usage: "docs [topic] [--list]", max: 1, flags: { list: false } },
};

export class UsageError extends Error {}

/**
 * @param {string[]} argv the arguments after `oncyber`
 * @returns {{ command: string, args: string[], flags: Record<string, string | true>, rest: string[] }}
 *   `rest` is everything after a bare `--`. `command` is "help" or
 *   "version" for those flags, wherever they are.
 */
export function parseArgs(argv) {
    const split = argv.indexOf("--");
    const own = split < 0 ? argv : argv.slice(0, split);
    const rest = split < 0 ? [] : argv.slice(split + 1);
    if (own.includes("--version") || own[0] === "-v")
        return { command: "version", args: [], flags: {}, rest };
    if (
        !own.length ||
        own.includes("--help") ||
        own.includes("-h") ||
        own[0] === "help"
    )
        return { command: "help", args: [], flags: {}, rest };
    const [command, ...words] = own;
    const spec = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : null;
    if (!spec) throw new UsageError(`unknown command: ${command}`);
    const args = [];
    const flags = {};
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word.startsWith("--")) {
            args.push(word);
            continue;
        }
        const [name, inline] = word.slice(2).split(/=(.*)/s);
        if (!Object.hasOwn(spec.flags, name))
            throw new UsageError(`oncyber ${command} has no --${name}`);
        if (!spec.flags[name]) {
            if (inline !== undefined)
                throw new UsageError(`--${name} takes no value`);
            flags[name] = true;
            continue;
        }
        const value = inline ?? words[++i];
        if (
            value === undefined ||
            (inline === undefined && value.startsWith("--"))
        )
            throw new UsageError(`--${name} needs a value`);
        flags[name] = value;
    }
    if (args.length < (spec.min ?? 0) || args.length > spec.max)
        throw new UsageError(`usage: oncyber ${spec.usage}`);
    if (rest.length && !spec.rest)
        throw new UsageError(`usage: oncyber ${spec.usage}`);
    return { command, args, flags, rest };
}

export const HELP = `oncyber: build a game for Oncyber

  oncyber new <id> [--name "Name"]   a working starter game in ./<id>
  oncyber dev                        in a game folder: the game alone, on a local port
  oncyber build                      build the game to ./dist
  oncyber check [--video]            the checks a published game is held to
  oncyber login                      sign in with the browser; saves a token
  oncyber publish                    build, check, upload; prints the game's link
  oncyber games                      what this account has published
  oncyber unpublish <id>             take a game down
  oncyber link <id> <slug>           give a published game the address /<slug>
  oncyber link <id> --clear          give that address up; /games/<id> stays
  oncyber docs [topic]               the guide to building a game, or one page (--list)
  oncyber logout                     forget the saved token

Environment:
  ONCYBER_BASE_URL        the site (default https://oncyber.io)
  ONCYBER_SESSION_TOKEN   a session token, used in place of a saved login
  GAMES_CHECK_TIMEOUT_S   how long the check waits for the game (default 180;
                          set 600 or more on a machine with no GPU)
  PW_CHANNEL=chrome       check in the installed Chrome instead of Chromium
`;
