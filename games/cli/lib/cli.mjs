// The `oncyber` command. docs/games/publishing.md is the contract for the
// commands that talk to the site.
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { COMMANDS, HELP, UsageError, parseArgs } from "./args.mjs";
import {
    baseUrl,
    credentialsPath,
    forgetCredentials,
    login,
    sessionToken,
} from "./auth.mjs";
import { OUTSIDE_NOTE, readTopic, topics } from "./docs.mjs";
import { PACKAGE } from "./paths.mjs";
import { readProject } from "./project.mjs";
import { linkGame, listGames, publishGame, unpublishGame } from "./publish.mjs";
import { PLAYWRIGHT_MISSING, hasPlaywright, npmRun, runCheck } from "./run.mjs";
import { SiteError, createSite } from "./site.mjs";
import { createStarter } from "./starter.mjs";

const version = () =>
    JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")).version;

const site = (env) =>
    createSite({ baseUrl: baseUrl(env), token: sessionToken({ env }) });

function requireLogin(env) {
    const connection = site(env);
    if (!connection.token)
        throw new SiteError(
            `not signed in to ${connection.baseUrl}. Run \`oncyber login\`, or set ONCYBER_SESSION_TOKEN`,
            { code: "NOT_SIGNED_IN" }
        );
    return connection;
}

async function check(project, flags) {
    if (!hasPlaywright(project)) {
        console.error(`oncyber: ${PLAYWRIGHT_MISSING}`);
        return 1;
    }
    return runCheck(
        project,
        ["video", "headed", "thumbnail"]
            .filter((name) => flags[name])
            .map((name) => `--${name}`)
    );
}

const commands = {
    async new({ args: [id], flags }, { cwd }) {
        const target = resolve(cwd, id);
        const { files } = createStarter({
            target,
            id,
            name: typeof flags.name === "string" ? flags.name : id,
        });
        const at = relative(cwd, target) || ".";
        console.log(`${at}/ created: the starter game, ${files.length} files. It passes \`oncyber check\` as it is. Next:
  cd ${at} && npm install
  oncyber docs          how a game fits Oncyber, and the helper for each thing
  oncyber dev           the game alone, on a local port
  Rewrite BRIEF.md for your game, then change src/world.js (the world),
  src/round.js (the rules) and src/match.js (the party's match).
  oncyber check         done is this exiting 0
  oncyber login && oncyber publish`);
    },
    dev: ({ rest }, { cwd }) => npmRun(readProject(cwd), "dev", rest),
    build: (_, { cwd }) => npmRun(readProject(cwd), "build"),
    check: ({ flags }, { cwd }) => check(readProject(cwd), flags),
    async login(_, { env }) {
        const connection = createSite({ baseUrl: baseUrl(env) });
        const { userId, path } = await login({
            site: connection.baseUrl,
            rpc: (service, method, input) =>
                connection.rpc(service, method, input, { auth: false }),
        });
        console.log(
            `Signed in to ${connection.baseUrl} as ${userId}. Saved to ${path}`
        );
    },
    logout() {
        console.log(
            forgetCredentials()
                ? `Removed ${credentialsPath()}`
                : "No saved login."
        );
    },
    async publish({ flags }, { cwd, env }) {
        const project = readProject(cwd);
        // Before the minutes of building and checking, not after.
        const connection = requireLogin(env);
        const built = await npmRun(project, "build");
        if (built !== 0) {
            console.error("oncyber: the build failed; nothing published");
            return 1;
        }
        // The card's picture is taken again from this build.
        const checked = await check(project, { ...flags, thumbnail: true });
        if (checked !== 0) {
            console.error(
                "oncyber: the check failed (its findings are above, and in .oncyber/check.json); nothing published"
            );
            return 1;
        }
        const published = await publishGame({
            project,
            site: connection,
            log: console.log,
        });
        console.log(
            `${project.id}: published release ${published.release} (${
                published.status ?? "unlisted"
            })`
        );
        console.log(published.link);
    },
    async games({ flags }, { env }) {
        const connection = requireLogin(env);
        const games = (await listGames(connection)) ?? [];
        if (flags.json) return void console.log(JSON.stringify(games, null, 2));
        if (!games.length)
            return void console.log(
                `No games published on ${connection.baseUrl} by this account.`
            );
        for (const game of games)
            console.log(
                [
                    game.id,
                    game.title,
                    game.status,
                    game.release,
                    game.publishedAt,
                    new URL(
                        game.url ?? `/games/${game.id}`,
                        `${connection.baseUrl}/`
                    ).href,
                ]
                    .filter((value) => value !== undefined && value !== null)
                    .join("  ")
            );
    },
    async unpublish({ args: [id] }, { env }) {
        const connection = requireLogin(env);
        await unpublishGame(connection, id);
        console.log(
            `${id}: unpublished. Its page no longer loads; the id stays yours.`
        );
    },
    async link({ args: [id, slug], flags }, { env }) {
        // One or the other: a slug to set, or --clear to give it up.
        if (Boolean(flags.clear) === (slug !== undefined))
            throw new UsageError(`usage: oncyber ${COMMANDS.link.usage}`);
        const connection = requireLogin(env);
        const linked = await linkGame(connection, id, slug ?? null);
        const address = new URL(
            linked?.url ?? `/games/${id}`,
            `${connection.baseUrl}/`
        ).href;
        console.log(
            linked?.slug
                ? `${id}: its address is now ${address} (/games/${id} still opens it).`
                : `${id}: its link is given up. Its address is ${address}.`
        );
    },
    docs({ args: [topic], flags }) {
        if (flags.list) {
            for (const [name, file] of Object.entries(topics()))
                console.log(`${name.padEnd(22)}${file}`);
            return;
        }
        process.stdout.write(OUTSIDE_NOTE + readTopic(topic).text);
    },
};

/**
 * Run the command. Resolves with the exit code.
 *
 * @param {string[]} argv the arguments after `oncyber`
 */
export async function main(
    argv,
    { cwd = process.cwd(), env = process.env } = {}
) {
    let parsed;
    try {
        parsed = parseArgs(argv);
    } catch (error) {
        if (!(error instanceof UsageError)) throw error;
        console.error(`oncyber: ${error.message}\n\n${HELP}`);
        return 2;
    }
    if (parsed.command === "help") return void console.log(HELP);
    if (parsed.command === "version") return void console.log(version());
    return (await commands[parsed.command](parsed, { cwd, env })) ?? 0;
}
