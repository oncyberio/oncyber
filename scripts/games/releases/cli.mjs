#!/usr/bin/env node
// Hosted releases of games, beside `pnpm games:publish` (which stores one).
//
//   pnpm games:release list [<id>]             what each game's page loads, and its stored releases
//   pnpm games:release point <id> [<rel>]      switch the game's page to its newest (or named) stored
//                                              release: the one way a game becomes hosted
//   pnpm games:release rollback <id> [<rel>]   point back to the previous (or named) release
//   pnpm games:release verify <id> [<rel>]     read a stored release back and compare every hash
//   pnpm games:release upload <id>             store the committed build as-is (no rebuild), if it
//                                              still matches its release.json
//   pnpm games:release unpoint <id>            stop using hosted releases; the page uses the committed build
//
// The games are the ones in the generated catalog (docs/games/listing.md).
// Backend and pointer file come from the environment; see publish.mjs.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_PATH } from "../listing.mjs";
import {
    currentRelease,
    point,
    readPointers,
    rollback,
    unpoint,
    writePointers,
} from "./pointer.mjs";
import {
    assertReleaseHost,
    publishRelease,
    releaseTarget,
} from "./publish.mjs";
import {
    GAME_ID,
    RELEASE_ID,
    listBuild,
    releaseId,
    verifyRelease,
} from "./storage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const [command, id, release] = process.argv.slice(2);
const fail = (message) => {
    console.error(`games:release: ${message}`);
    process.exit(1);
};
/** The ids in the generated catalog: the list of games. */
function catalogGames() {
    const path = join(root, CATALOG_PATH);
    if (!existsSync(path)) return [];
    return [
        ...readFileSync(path, "utf8").matchAll(/^ {8}id: "([a-z0-9-]+)",$/gm),
    ].map((match) => match[1]);
}
if (
    !["list", "point", "rollback", "verify", "upload", "unpoint"].includes(
        command
    ) ||
    (id && !GAME_ID.test(id)) ||
    (!id && command !== "list") ||
    (release && !RELEASE_ID.test(release))
) {
    console.error(
        "usage: games:release list [<id>] | point <id> [<release>] | rollback <id> [<release>] | verify <id> [<release>] | upload <id> | unpoint <id>"
    );
    process.exit(2);
}

try {
    const { storage, pointers: file } = releaseTarget();
    const pointers = readPointers(file);
    const where = relative(root, file);
    // Only a game in the catalog has a page that follows a pointer.
    if (["point", "upload"].includes(command) && !catalogGames().includes(id))
        fail(
            `${id} is not in the catalog (${CATALOG_PATH}); run pnpm games:catalog`
        );
    if (command === "list") {
        const games = id
            ? [id]
            : [...new Set([...catalogGames(), ...Object.keys(pointers.games)])];
        for (const game of games) {
            const entry = pointers.games[game];
            if (!entry?.releases.length) {
                console.log(
                    `${game}: no stored release in ${where}; the page uses the committed build`
                );
                continue;
            }
            console.log(
                `${game}:` +
                    (entry.current
                        ? ""
                        : ` the page uses the committed build; switch with games:release point ${game}`)
            );
            for (const r of entry.releases)
                console.log(
                    `  ${r.release === entry.current ? "*" : " "} ${
                        r.release
                    }  ${r.publishedAt}  ${r.backend}  ${r.files} files, ${(
                        r.bytes / 1048576
                    ).toFixed(1)} MiB  ${r.base}`
                );
        }
    } else if (command === "rollback" || command === "point") {
        const before = currentRelease(pointers, id);
        const next =
            command === "point"
                ? point(pointers, id, release)
                : rollback(pointers, id, release);
        const target = currentRelease(next, id);
        // A stored release must still be whole, on a host that sends what
        // a release needs, before a page is sent to it.
        if (command === "point") {
            const { problems } = await verifyRelease(storage, {
                game: id,
                ...target,
            });
            if (problems.length)
                fail(
                    `${id} ${target.release} does not verify: ${problems
                        .map((p) => `${p.path} (${p.problem})`)
                        .join("; ")}`
                );
        }
        await assertReleaseHost(storage, { game: id, ...target });
        writePointers(file, next);
        console.log(
            `${id}: ${before?.release ?? "the committed build"} -> ${
                target.release
            } in ${where}` +
                (storage.name === "local"
                    ? ""
                    : ". Commit that file to ship it.")
        );
    } else if (command === "unpoint") {
        writePointers(file, unpoint(pointers, id));
        console.log(
            `${id}: not pointed at a release in ${where}; the page uses the committed build`
        );
    } else if (command === "verify") {
        const entry = release
            ? pointers.games[id]?.releases.find((r) => r.release === release)
            : currentRelease(pointers, id);
        if (!entry)
            fail(`${id} has no ${release ?? "current"} release in ${where}`);
        const { files, problems } = await verifyRelease(storage, {
            game: id,
            ...entry,
        });
        for (const p of problems) console.log(`  ${p.path}: ${p.problem}`);
        console.log(
            `${id} ${entry.release}: ${
                problems.length
                    ? `${problems.length} problem(s)`
                    : `${files} files match their hashes`
            } (${entry.base})`
        );
        process.exit(problems.length ? 1 : 0);
    } else if (command === "upload") {
        const dir = join(root, "frontend/public/games", id);
        if (!existsSync(join(dir, "release.json")))
            fail(
                `frontend/public/games/${id}/release.json not found; run pnpm games:publish ${id}`
            );
        const published = JSON.parse(
            readFileSync(join(dir, "release.json"), "utf8")
        );
        const files = listBuild(dir);
        // Only what passed its check is uploaded: the folder must still be
        // the release its release.json describes.
        if (releaseId(files) !== published.release)
            fail(
                `frontend/public/games/${id} no longer matches release ${published.release}; run pnpm games:publish ${id}`
            );
        const { entry, previous, pointed } = await publishRelease({
            game: id,
            dir,
            files,
            storage,
            pointers: file,
        });
        console.log(
            `${id}: release ${entry.release} stored (${storage.name}) at ${entry.base}` +
                (pointed
                    ? previous && previous.release !== entry.release
                        ? `; the page now loads it, was ${previous.release}`
                        : "; the page loads it"
                    : `; the page still uses the committed build (switch with games:release point ${id})`)
        );
    }
} catch (error) {
    fail(error.message ?? String(error));
}
