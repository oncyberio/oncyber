// Publishing a checked build: the command's half of the contract in
// docs/games/publishing.md. The file list, the release id and the listing
// entry come from the same code the repository's `pnpm games:publish` and
// `pnpm games:catalog` use.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sdk } from "./paths.mjs";
import { SiteError } from "./site.mjs";

/** The contract's limits on a release. */
export const MAX_BYTES = 30 * 1024 * 1024;
export const MAX_FILES = 400;
export const MAX_MANIFEST_BYTES = 64 * 1024;
/** The card's picture: a JPEG beside the release, at most this large. */
export const MAX_THUMBNAIL_BYTES = 512 * 1024;

const load = (path) => import(pathToFileURL(sdk(path)).href);
const storage = () => load("scripts/games/releases/storage.mjs");
const listing = () => load("scripts/games/listing.mjs");

/**
 * What `begin` is sent for a build: every file of the release with its
 * size and SHA-256, the release id they give, and the listing entry.
 *
 * @param {{ id: string, out: string, manifest: object }} project
 */
export async function describeRelease({ id, out, manifest }) {
    if (!existsSync(join(out, "index.html")))
        throw new Error(
            "no build here: dist/index.html is missing. Run `oncyber build`"
        );
    const { RELEASE_MANIFEST, listBuild, releaseId } = await storage();
    const { catalogEntry, GENERATED_THUMBNAIL } = await listing();
    const files = listBuild(out);
    const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
    const folded = new Map();
    for (const { path } of files) {
        const problem =
            pathProblem(path) ??
            (path === RELEASE_MANIFEST
                ? "is a name kept for the release's file list"
                : folded.has(path.toLowerCase())
                ? `differs from ${folded.get(path.toLowerCase())} only by case`
                : null);
        if (problem)
            throw new Error(
                `dist/${path} ${problem}. Rename it and build again`
            );
        folded.set(path.toLowerCase(), path);
    }
    if (Buffer.byteLength(JSON.stringify(manifest)) > MAX_MANIFEST_BYTES)
        throw new Error("game.json is larger than 64 KiB");
    if (files.length > MAX_FILES)
        throw new Error(
            `the build has ${files.length} files; a release holds at most ${MAX_FILES}`
        );
    if (bytes > MAX_BYTES)
        throw new Error(
            `the build is ${(bytes / 1048576).toFixed(
                1
            )} MiB; a release holds at most 30 MiB`
        );
    let entry;
    try {
        entry = catalogEntry(id, manifest);
    } catch (error) {
        // catalogEntry names the file as the repository would.
        throw new Error(String(error.message).replace(`games/${id}/`, ""));
    }
    return {
        files,
        bytes,
        release: releaseId(files),
        entry,
        thumbnail: existsSync(join(out, GENERATED_THUMBNAIL))
            ? GENERATED_THUMBNAIL
            : null,
    };
}

/**
 * The check's own result for these files, as `begin` wants it. Throws when
 * the last check did not pass, or passed for a different build.
 */
export function readCheck({ reports }, release) {
    const path = join(reports, "check.json");
    if (!existsSync(path))
        throw new Error("the game has not been checked: run `oncyber check`");
    const report = JSON.parse(readFileSync(path, "utf8"));
    if (report.status !== "passed")
        throw new Error(
            "the last check failed: run `oncyber check` and fix its findings"
        );
    if (report.hosted?.release !== release)
        throw new Error(
            "the build changed after it was checked: run `oncyber check` again"
        );
    return { status: "passed", checkedAt: report.checkedAt, release };
}

/**
 * Why the site would not take a file at `path`, or null: the contract's
 * rule for a release's paths, said before anything is sent.
 */
export function pathProblem(path) {
    const names = path.split("/");
    if (path.length > 200) return "is longer than 200 characters";
    if (names.length > 13) return "is more than 12 folders deep";
    for (const name of names)
        if (
            !/^[A-Za-z0-9_][A-Za-z0-9._\-@+~]*$/.test(name) ||
            name.endsWith(".")
        )
            return `has a name the site does not take ("${name}"): names start with a letter, digit or _ and hold only letters, digits and . _ - @ + ~`;
    return null;
}

/** Mode `site`: each file to the site, which checks its size and hash. */
async function uploadToSite({ site, upload, out, files, thumbnail, log }) {
    if (typeof upload.url !== "string" || !upload.url)
        throw new SiteError("the site gave no upload address", {
            code: "UPLOAD_ADDRESS",
        });
    const base = new URL(
        upload.url.endsWith("/") ? upload.url : `${upload.url}/`,
        `${site.baseUrl}/`
    );
    for (const file of files) {
        const bytes = readFileSync(join(out, file.path));
        // The path as it was listed: its names are plain (pathProblem).
        await site.put(new URL(file.path, base).href, bytes);
        log(`  sent ${file.path} (${file.bytes} bytes)`);
    }
    // The card's picture travels beside the release; it is not one of its
    // hashed files, so a site that does not take it has refused nothing.
    if (!thumbnail) return;
    const picture = readFileSync(join(out, thumbnail));
    if (picture.length > MAX_THUMBNAIL_BYTES)
        return void log(
            `  ${thumbnail} is larger than 512 KiB and was not sent; the game is published without a card picture`
        );
    try {
        await site.put(new URL(thumbnail, base).href, picture, {
            "Content-Type": "image/jpeg",
        });
        log(`  sent ${thumbnail}`);
    } catch (error) {
        if (error.code !== "UPLOAD_REFUSED") throw error;
        log(
            `  ${thumbnail} was not taken (${error.message}); the game is published without a card picture`
        );
    }
}

/**
 * Mode `pinata`: the site hands out a short-lived address in its own
 * storage account and the release would travel there as one CAR archive.
 * The contract calls that shape provisional and says the command may
 * refuse it; this version does, with nothing sent.
 */
function refusePinata() {
    throw new SiteError(
        "this site stores releases on Pinata, which this version of the command cannot upload to. Nothing was uploaded. Publish to a site that takes uploads itself (a development or self-hosted server)",
        { code: "UPLOAD_MODE" }
    );
}

/**
 * begin, upload, finish. Returns `finish`'s answer with the full link.
 *
 * @param {{ project: { id: string, out: string, reports: string, manifest: object },
 *   site: ReturnType<import("./site.mjs").createSite>, log?: (line: string) => void }} options
 */
export async function publishGame({ project, site, log = () => {} }) {
    const { id, out, manifest } = project;
    const described = await describeRelease(project);
    const { files, release, entry, thumbnail } = described;
    const check = readCheck(project, release);
    const begun = await site.rpc("gamePublish", "begin", {
        id,
        manifest,
        entry,
        files,
        check,
    });
    if (begun?.release !== release)
        throw new SiteError(
            `the site computed release ${begun?.release} for these files, the command ${release}; nothing was uploaded`,
            { code: "RELEASE_MISMATCH" }
        );
    if (typeof begun.uploadId !== "string" || !begun.uploadId)
        throw new SiteError("the site began no upload", { code: "REFUSED" });
    if (begun.stored)
        log(`release ${release} is already stored; nothing to upload`);
    else {
        const upload = begun.upload ?? {};
        log(
            `uploading release ${release}: ${files.length} files, ${described.bytes} bytes`
        );
        if (upload.mode === "site")
            await uploadToSite({ site, upload, out, files, thumbnail, log });
        else if (upload.mode === "pinata") refusePinata();
        else
            throw new SiteError(
                `the site asked for an upload this version of the command does not know (${upload.mode}). Nothing was uploaded`,
                { code: "UPLOAD_MODE" }
            );
    }
    const finished = await site.rpc("gamePublish", "finish", {
        uploadId: begun.uploadId,
    });
    return {
        ...finished,
        release: finished?.release ?? release,
        link: new URL(finished?.url ?? `/games/${id}`, `${site.baseUrl}/`).href,
        files: files.length,
        bytes: described.bytes,
    };
}

/** The account's games. */
export const listGames = (site) => site.rpc("gamePublish", "mine");

/** Take a game down. Only its owner can. */
export const unpublishGame = (site, id) =>
    site.rpc("gamePublish", "unpublish", { id });
