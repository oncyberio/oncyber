#!/usr/bin/env node
// Hosted releases of games, beside `pnpm games:publish` (which uploads).
//
//   pnpm games:release list [<id>]             what each game points at, and its history
//   pnpm games:release rollback <id> [<rel>]   point back to the previous (or named) release
//   pnpm games:release verify <id> [<rel>]     read a stored release back and compare every hash
//   pnpm games:release upload <id>             store the committed build as-is (no rebuild), if it
//                                              still matches its release.json, and point at it
//   pnpm games:release unpoint <id>            stop using hosted releases; the page uses the committed build
//
// Backend and pointer file come from the environment; see publish.mjs.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    currentRelease,
    readPointers,
    rollback,
    unpoint,
    writePointers,
} from "./pointer.mjs";
import { publishRelease, releaseTarget } from "./publish.mjs";
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
if (
    !["list", "rollback", "verify", "upload", "unpoint"].includes(command) ||
    (id && !GAME_ID.test(id)) ||
    (!id && command !== "list") ||
    (release && !RELEASE_ID.test(release))
) {
    console.error(
        "usage: games:release list [<id>] | rollback <id> [<release>] | verify <id> [<release>] | upload <id> | unpoint <id>"
    );
    process.exit(2);
}

try {
    const { storage, pointers: file } = releaseTarget();
    const pointers = readPointers(file);
    const where = relative(root, file);
    if (command === "list") {
        const games = id ? [id] : Object.keys(pointers.games);
        if (!games.length)
            console.log(
                `no hosted releases in ${where}; pages use the committed builds`
            );
        for (const game of games) {
            const entry = pointers.games[game];
            if (!entry) {
                console.log(
                    `${game}: no hosted release; the page uses the committed build`
                );
                continue;
            }
            console.log(`${game}:`);
            for (const r of entry.releases)
                console.log(
                    `  ${r.release === entry.current ? "*" : " "} ${
                        r.release
                    }  ${r.publishedAt}  ${r.backend}  ${r.files} files, ${(
                        r.bytes / 1048576
                    ).toFixed(1)} MiB  ${r.base}`
                );
        }
    } else if (command === "rollback") {
        const before = currentRelease(pointers, id);
        const next = rollback(pointers, id, release);
        writePointers(file, next);
        console.log(
            `${id}: ${before?.release} -> ${
                currentRelease(next, id).release
            } in ${where}` +
                (storage.name === "local"
                    ? ""
                    : ". Commit that file to ship it.")
        );
    } else if (command === "unpoint") {
        writePointers(file, unpoint(pointers, id));
        console.log(
            `${id}: no hosted release in ${where}; the page uses the committed build`
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
        const { entry, previous } = await publishRelease({
            game: id,
            dir,
            files,
            storage,
            pointers: file,
        });
        console.log(
            `${id}: release ${entry.release} stored (${storage.name}) at ${entry.base}` +
                (previous && previous.release !== entry.release
                    ? `, was ${previous.release}`
                    : "")
        );
    }
} catch (error) {
    fail(error.message ?? String(error));
}
