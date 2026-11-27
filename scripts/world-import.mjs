// `pnpm world spaces` and `pnpm world import`: a signed-in account's real
// spaces, listed, and one of them copied into the local stack to debug.
//
//   spaces [--json]            the account's spaces on the site it is signed in to
//   import <link | id | url>   a copy of one in the stack `pnpm dev:local` runs
//
// The site is the one the terminal signed in to (world-cli.mjs); the copy
// is written by local-dev/import.mjs, to the local emulator only.

/** "https://oncyber.io/spaces/abc?x" -> { id: "abc" }; "mine" -> { link: "mine" }. */
export function spaceRef(input) {
    const text = String(input ?? "").trim();
    if (!text) return null;
    let path = text;
    try {
        if (/^https?:\/\//i.test(text)) path = new URL(text).pathname;
    } catch {
        return null;
    }
    const parts = path.split(/[?#]/)[0].split("/").filter(Boolean);
    if (!parts.length) return null;
    if (parts.length >= 2 && parts.at(-2) === "spaces")
        return { id: parts.at(-1) };
    const last = decodeURIComponent(parts.at(-1));
    // Firestore's own ids: twenty letters and digits. Anything else is a link.
    return /^[A-Za-z0-9]{20}$/.test(last)
        ? { id: last, maybeLink: true }
        : { link: last };
}

const short = (text, width) =>
    text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);

/** The account's spaces as lines: name, where it is, its id. */
export function spaceLines({ spaces, currentId }, site) {
    if (!spaces.length) return [`No spaces on ${site} for this account.`];
    const sorted = [...spaces].sort((a, b) => b.visits - a.visits);
    const lines = [
        `${spaces.length} space${spaces.length === 1 ? "" : "s"} on ${site}:`,
    ];
    for (const space of sorted) {
        const link = space.info?.customLink;
        lines.push(
            `  ${short(space.info?.headline || "(no name)", 30)} ${short(
                link ? `/${link}` : `/spaces/${space.id}`,
                34
            )} ${space.id}  ${space.visits} visit${
                space.visits === 1 ? "" : "s"
            }` +
                (space.runtime ? `  runs ${space.runtime}` : "") +
                (space.invited ? "  shared with you" : "") +
                (space.id === currentId ? "  current" : "")
        );
    }
    lines.push("Copy one into the local stack: pnpm world import <link or id>");
    return lines;
}

/**
 * @param {string[]} args
 * @param {(method: string, params: object) => Promise<any>} rpc  the site's `exhibit` service
 * @param {{ site: string, log?: (line: string) => void }} options
 */
export async function spacesCommand(args, rpc, { site, log = console.log }) {
    const mine = await rpc("listMine", {});
    if (args.includes("--json")) return void log(JSON.stringify(mine, null, 2));
    for (const line of spaceLines(mine, site)) log(line);
}

/**
 * @param {string[]} args
 * @param {(method: string, params: object) => Promise<any>} rpc  the site's `exhibit` service
 * @param {{ site: string, log?: (line: string) => void,
 *   local?: { localCopy: Function, writeLocalCopy: Function, describeCopy: Function } }} options
 */
export async function importCommand(
    args,
    rpc,
    { site, log = console.log, local }
) {
    const ref = spaceRef(args.find((arg) => !arg.startsWith("--")));
    if (!ref)
        throw new Error(
            "Usage: world import <link | id | url>   (pnpm world spaces lists yours)"
        );
    let exported;
    try {
        exported = await rpc(
            "exportSpace",
            ref.id ? { id: ref.id } : { link: ref.link }
        );
    } catch (error) {
        // Twenty letters and digits can also be someone's link.
        if (!ref.maybeLink) throw error;
        exported = await rpc("exportSpace", { link: ref.id });
    }
    const { localCopy, writeLocalCopy, describeCopy } =
        local ?? (await import("../local-dev/import.mjs"));
    const copy = localCopy(exported);
    log(`Read "${copy.about.name}" from ${site}.`);
    const written = await writeLocalCopy(copy);
    for (const line of describeCopy(copy, written)) log(line);
}
