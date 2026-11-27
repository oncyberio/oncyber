/**
 * Upload mode `storage` (docs/games/publishing.md), between the registry
 * (publishedGamesServer.ts) and the bucket (releaseBucket.ts): the upload
 * addresses `begin` hands out, and what `finish` does before a release is
 * registered.
 *
 * A creator's command can write only to `games-staging/<uploadId>/`, one
 * object per address. `finish` reads each staged file once, checks its size
 * and SHA-256, and copies that very version to `games/<game>/<release>/`,
 * where nothing but this server writes and nothing is ever replaced. So an
 * address that outlives `finish`, or an upload racing it, can change
 * nothing a visitor is served.
 */
import { createHash } from "crypto";
import {
    PUBLISH_THUMBNAIL,
    PUBLISH_THUMBNAIL_MAX,
    PublishRefused,
    RELEASE_MANIFEST,
    releaseManifestText,
    type PublishFile,
} from "./publishedGames";
import {
    isMissing,
    releaseBucket,
    releaseBucketConfig,
    releaseObject,
    releasePrefix,
    stagedObject,
    stagedPrefix,
    type ReleaseBucket,
} from "./releaseBucket";

export interface StorageUploads {
    bucket: ReleaseBucket;
    /** Uploads go to the bucket even where a local releases folder exists. */
    forced: boolean;
}

/** This server's bucket for uploads, or null when it has none. */
export function storageUploadsConfig(
    env: Record<string, string | undefined> = process.env
): StorageUploads | null {
    const config = releaseBucketConfig(env);
    const bucket = config ? releaseBucket(env) : null;
    return config && bucket ? { bucket, forced: config.forced } : null;
}

const refuse = (message: string): never => {
    throw new PublishRefused(message);
};

/** Runs `work` over `items`, a few at a time, until `enough()` says stop. */
async function each<T>(
    items: ReadonlyArray<T>,
    concurrency: number,
    work: (item: T) => Promise<void>,
    enough: () => boolean = () => false
) {
    let next = 0;
    const worker = async () => {
        while (next < items.length && !enough()) await work(items[next++]);
    };
    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, worker)
    );
}

export class ObjectTooLong extends Error {}

/**
 * An object's text, or null when there is none. One longer than `limit`
 * bytes is not read to its end: `ObjectTooLong`.
 */
export async function readObjectText(
    bucket: ReleaseBucket,
    object: string,
    limit: number
): Promise<string | null> {
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    const body = bucket.read(object);
    try {
        for await (const chunk of body) {
            bytes += chunk.length;
            if (bytes > limit) throw new ObjectTooLong(object);
            text += decoder.decode(chunk, { stream: true });
        }
    } catch (error) {
        body.destroy();
        if (isMissing(error)) return null;
        throw error;
    }
    return text + decoder.decode();
}

// ---------------------------------------------------------------------------
// begin

/** A release's manifest is its file list: a few hundred lines at most. */
const MANIFEST_LIMIT = 1024 * 1024;

async function manifestOf(
    bucket: ReleaseBucket,
    game: string,
    release: string
) {
    const at = releaseObject(game, release, RELEASE_MANIFEST);
    if (!at) return null;
    return readObjectText(bucket, at, MANIFEST_LIMIT).catch((error) => {
        // Something else is there: not this release.
        if (error instanceof ObjectTooLong) return "";
        throw error;
    });
}

/**
 * True when this exact release is already in the bucket. The manifest is
 * the last thing `finish` writes, so one that is there, and lists these
 * files, means the release is whole.
 */
export async function storageReleaseStored(
    bucket: ReleaseBucket,
    game: string,
    release: string,
    files: ReadonlyArray<PublishFile>
): Promise<boolean> {
    return (
        (await manifestOf(bucket, game, release)) ===
        releaseManifestText(game, release, files)
    );
}

/**
 * One address per listed file, and one for the card picture: each names
 * its own object under this upload's staging folder, holds the upload to
 * the listed size (and MD5, when the command sent one), and expires with
 * the upload.
 */
export async function signStorageUploads(
    bucket: ReleaseBucket,
    upload: { id: string; expiresAt: number },
    files: ReadonlyArray<PublishFile & { md5?: string }>
) {
    const wanted = [
        ...files.map((file) => ({
            path: file.path,
            bytes: file.bytes,
            exact: true,
            md5: file.md5
                ? Buffer.from(file.md5, "hex").toString("base64")
                : undefined,
        })),
        {
            path: PUBLISH_THUMBNAIL,
            bytes: PUBLISH_THUMBNAIL_MAX,
            exact: false,
            md5: undefined,
        },
    ];
    const signed: Array<{
        path: string;
        url: string;
        headers: Record<string, string>;
    }> = new Array(wanted.length);
    await each(
        wanted.map((file, at) => ({ file, at })),
        16,
        async ({ file, at }) => {
            const object = stagedObject(upload.id, file.path);
            if (!object) return refuse(`${file.path} cannot be stored.`);
            const { url, headers } = await bucket.signUpload({
                object,
                bytes: file.bytes,
                exact: file.exact,
                md5: file.md5,
                expiresAt: upload.expiresAt,
            });
            signed[at] = { path: file.path, url, headers };
        }
    );
    return signed;
}

// ---------------------------------------------------------------------------
// finish

/** The size and SHA-256 of one version of an object, read once. */
async function hashObject(
    bucket: ReleaseBucket,
    object: string,
    generation: string,
    limit: number
) {
    const hash = createHash("sha256");
    const head: number[] = [];
    let bytes = 0;
    const body = bucket.read(object, generation);
    try {
        for await (const chunk of body) {
            bytes += chunk.length;
            // Never read more than the file was said to hold.
            if (bytes > limit) break;
            for (let at = 0; head.length < 3 && at < chunk.length; at++)
                head.push(chunk[at]);
            hash.update(chunk);
        }
    } finally {
        body.destroy();
    }
    return { bytes, sha256: hash.digest("hex"), head };
}

/**
 * Every listed file as it is staged: its size, that nothing was said of
 * its encoding, and its SHA-256, from reading it. Returns the version of
 * each that was read, so the copy is of those bytes and no later ones. A
 * staged file that is not the listed one is removed, so it can be sent
 * again.
 */
async function verifyStaged(
    bucket: ReleaseBucket,
    upload: { id: string; files: ReadonlyArray<PublishFile> }
) {
    const verified = new Map<string, { generation: string; md5: string }>();
    const problems: string[] = [];
    await each(
        upload.files,
        6,
        async (file) => {
            const object = stagedObject(upload.id, file.path);
            const found = object ? await bucket.stat(object) : null;
            if (!object || !found)
                return void problems.push(`${file.path} was not uploaded`);
            let problem: string | null = null;
            if (found.encoding)
                problem = `${file.path} was sent with a Content-Encoding`;
            else if (found.bytes !== file.bytes)
                problem = `${file.path} has the wrong size`;
            else {
                const read = await hashObject(
                    bucket,
                    object,
                    found.generation,
                    file.bytes
                );
                if (read.bytes !== file.bytes || read.sha256 !== file.sha256)
                    problem = `${file.path} has the wrong contents`;
            }
            if (problem) {
                problems.push(problem);
                await bucket.remove(object).catch(() => {});
            } else
                verified.set(file.path, {
                    generation: found.generation,
                    md5: found.md5 ?? "",
                });
        },
        () => problems.length >= 5
    );
    if (problems.length)
        refuse(`The upload is not complete: ${problems.join("; ")}.`);
    return verified;
}

/** The card picture, when one was staged and is a JPEG of a fair size. */
async function installThumbnail(
    bucket: ReleaseBucket,
    upload: { id: string; game: string; release: string }
): Promise<boolean> {
    const kept = releaseObject(upload.game, upload.release, PUBLISH_THUMBNAIL);
    const staged = stagedObject(upload.id, PUBLISH_THUMBNAIL);
    if (!kept || !staged) return false;
    if (await bucket.stat(kept)) return true;
    const found = await bucket.stat(staged);
    if (
        !found ||
        found.encoding ||
        found.bytes < 3 ||
        found.bytes > PUBLISH_THUMBNAIL_MAX
    )
        return false;
    const { bytes, head } = await hashObject(
        bucket,
        staged,
        found.generation,
        PUBLISH_THUMBNAIL_MAX
    );
    // A JPEG, by its first bytes; the route names its type, not the file.
    if (
        bytes !== found.bytes ||
        !(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)
    )
        return false;
    await bucket.copy(staged, found.generation, kept);
    return true;
}

/**
 * Puts a fully uploaded release at `games/<game>/<release>/`, or finds it
 * there already. Returns whether this call put it there (and how to take
 * that away again if the registration then fails) and whether a card
 * picture is stored with it.
 */
export async function installStoredRelease(
    bucket: ReleaseBucket,
    upload: {
        id: string;
        game: string;
        release: string;
        files: ReadonlyArray<PublishFile>;
    }
) {
    const { game, release, files } = upload;
    const prefix = releasePrefix(game, release);
    const manifestAt = releaseObject(game, release, RELEASE_MANIFEST);
    if (!prefix || !manifestAt) return refuse("No such release.");
    const expected = releaseManifestText(game, release, files);
    const different = () =>
        refuse(
            `Release ${release} is already stored with different contents; a release never changes.`
        );
    const created: string[] = [];
    const undo = async () => {
        await Promise.all(
            created
                .splice(0)
                .map((object) => bucket.remove(object).catch(() => {}))
        );
    };
    const present = await manifestOf(bucket, game, release);
    let installed = false;
    if (present !== null) {
        // A release never changes: what is there must be these files.
        if (present !== expected) different();
        const held = new Map(
            (await bucket.list(prefix)).map((found) => [
                found.object,
                found.bytes,
            ])
        );
        const problems = files
            .filter((file) => held.get(`${prefix}${file.path}`) !== file.bytes)
            .slice(0, 5)
            .map((file) => `${file.path} is missing from the stored release`);
        if (problems.length)
            refuse(`The upload is not complete: ${problems.join("; ")}.`);
    } else {
        const verified = await verifyStaged(bucket, upload);
        try {
            await each(files, 6, async (file) => {
                const from = stagedObject(upload.id, file.path);
                const to = releaseObject(game, release, file.path);
                const staged = verified.get(file.path);
                if (!from || !to || !staged) return different();
                if (await bucket.copy(from, staged.generation, to))
                    return void created.push(to);
                // Left by a finish that stopped part way: these bytes, or
                // the release is not this one.
                const there = await bucket.stat(to);
                if (
                    !there ||
                    there.bytes !== file.bytes ||
                    (there.md5 && staged.md5 && there.md5 !== staged.md5)
                )
                    different();
            });
            // Last, so a manifest means a whole release.
            if (await bucket.create(manifestAt, Buffer.from(expected)))
                created.push(manifestAt);
            else if ((await manifestOf(bucket, game, release)) !== expected)
                different();
        } catch (error) {
            await undo();
            throw error;
        }
        installed = true;
    }
    // A picture that cannot be kept does not stop a game being published.
    const thumbnail = await installThumbnail(bucket, upload).catch(() => false);
    return { installed, thumbnail, undo };
}

/** What an upload staged, removed: after `finish`, or once it is past due. */
export async function clearStaged(bucket: ReleaseBucket, uploadId: string) {
    const prefix = stagedPrefix(uploadId);
    if (prefix) await bucket.removeAll(prefix).catch(() => {});
}
