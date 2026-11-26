/**
 * The registry of games published from outside the repository
 * (docs/games/publishing.md), on the server: Firestore for the records, the
 * local releases folder for mode `site`, and the storage bucket for mode
 * `storage` (publishedGamesStorage.ts). The rules are in publishedGames.ts;
 * this file reads, stores and verifies.
 *
 *   publishedGames/<id>     one record per game (the contract's shape)
 *   gameUploads/<uploadId>  an upload between `begin` and `finish`
 *   gamePublishers/<owner>  an account's games and today's counts
 *
 * On disk (mode `site`), under the local releases folder:
 *
 *   .uploads/<uploadId>/files/<path>   files as they arrive, each verified
 *   .uploads/<uploadId>/thumbnail.jpg  the optional card picture
 *   <id>/<release>/                    the release, moved here whole by
 *                                      `finish`, read-only, with its
 *                                      oncyber-release.json
 *
 * `.uploads` is not a game id, so the releases route never serves it.
 */
import { createHash, randomBytes } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import {
    chmod,
    mkdir,
    readdir,
    readFile,
    rename,
    rm,
    stat,
    writeFile,
} from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import type { Readable } from "stream";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { db } from "@utils/firebaseAdmin";
import type { GameEntry } from "./catalog";
import type { GameFrame } from "./gameRelease";
import { localReleasesDir } from "./gameReleaseServer";
import { GAME_SLUG, gamePath } from "./gameSlug";
import { gameLinkRef } from "./gameSlugServer";
import {
    pinnedReleaseBase,
    pinnedUploadsConfig,
    verifyPinnedRelease,
    type PinnedUploads,
} from "./pinnedUploads";
import {
    clearStaged,
    installStoredRelease,
    signStorageUploads,
    storageReleaseStored,
    storageUploadsConfig,
    type StorageUploads,
} from "./publishedGamesStorage";
import {
    PUBLISH_MAX_BYTES,
    PUBLISH_THUMBNAIL,
    PUBLISH_THUMBNAIL_MAX,
    PUBLISH_UPLOAD_TTL_MS,
    PublishRefused,
    RELEASE_MANIFEST,
    UPLOAD_ID,
    mayPublish,
    planBegin,
    planLink,
    planPublish,
    planUnpublish,
    publishIdProblem,
    publishedGameLive,
    publishedGameSummary,
    publisherAt,
    publishingEnabled,
    readPublishedGame,
    recordSlug,
    registeredGameEntry,
    registeredGameFrame,
    releaseFilesProblem,
    releaseIdOf,
    releaseManifestText,
    servedRelease,
    type PublishBegin,
    type PublishFile,
    type PublishedEntry,
    type PublishedGame,
    type PublishedRelease,
} from "./publishedGames";

const GAMES = "publishedGames";
const UPLOADS = "gameUploads";
const PUBLISHERS = "gamePublishers";
const STAGING = ".uploads";

export type UploadMode = "site" | "storage" | "pinata";

/** An upload between `begin` and `finish`. */
export interface PendingUpload {
    id: string;
    owner: string;
    game: string;
    release: string;
    files: PublishFile[];
    entry: PublishedEntry;
    checkedAt: string;
    mode: UploadMode;
    createdAt: number;
    expiresAt: number;
}

const refuse = (message: string): never => {
    throw new PublishRefused(message);
};
/** A record from a snapshot; one that cannot be read is nobody's to take. */
function recordOf(
    doc: { exists: boolean; data(): unknown },
    id: string
): PublishedGame | null {
    if (!doc.exists) return null;
    return (
        readPublishedGame(doc.data()) ??
        refuse(`${id} cannot be published to; choose another id.`)
    );
}
/** Plain data: no `undefined` reaches Firestore. */
const plainData = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Throws unless this account may publish here (`GAMES_PUBLISHING`). */
export function assertMayPublish(account: string | undefined) {
    if (!publishingEnabled()) throw new Error("Not found");
    if (!account) throw new Error("Unauthorized");
    if (!mayPublish(account))
        refuse("This account may not publish games on this site.");
}

// ---------------------------------------------------------------------------
// Records, read for pages and the releases route

const CACHE_MS = 10_000;
const CACHE_MAX = 500;
const LOOKUP_TIMEOUT_MS = 5000;
const cache = new Map<string, { at: number; record: PublishedGame | null }>();

const linkCache = new Map<string, { at: number; game: string | null }>();

/** For tests, and after this server changes a record. */
export function forgetPublishedGames(id?: string) {
    if (id) cache.delete(id);
    else cache.clear();
    // Which game a link leads to may have changed with it.
    linkCache.clear();
}

/**
 * A game's record, or null: asked of Firestore at most once in ten seconds
 * per id on this server, so the releases route does not read the store for
 * every file. An unpublish made on another server instance is seen here
 * within that time. A store that cannot be reached reads as "no such game".
 */
export async function publishedGame(
    id: unknown,
    now = Date.now()
): Promise<PublishedGame | null> {
    if (typeof id !== "string" || publishIdProblem(id)) return null;
    if (!publishingEnabled()) return null;
    const cached = cache.get(id);
    if (cached && now - cached.at < CACHE_MS) return cached.record;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const record = await Promise.race([
        db
            .collection(GAMES)
            .doc(id)
            .get()
            .then((doc) => (doc.exists ? readPublishedGame(doc.data()) : null)),
        new Promise<null>((done) => {
            timer = setTimeout(() => done(null), LOOKUP_TIMEOUT_MS);
        }),
    ])
        .catch(() => null)
        .finally(() => clearTimeout(timer));
    const found = record?.id === id ? record : null;
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(id, { at: now, record: found });
    return found;
}

/** What /games/<id> shows for a registered game, or null: no such page. */
export async function loadRegisteredGame(
    id: unknown
): Promise<{ game: GameEntry; frame: GameFrame } | null> {
    const record = await publishedGame(id);
    if (!record || !publishedGameLive(record)) return null;
    return {
        game: registeredGameEntry(record),
        frame: registeredGameFrame(record),
    };
}

/**
 * What /<slug> shows when a published game holds that slug, or null. The
 * claim is read at most once in ten seconds per slug on this server, as a
 * record is, and counts only while the game's own record says the same
 * slug: a claim with no record behind it leads nowhere.
 */
export async function loadRegisteredGameBySlug(
    slug: unknown,
    now = Date.now()
): Promise<{ game: GameEntry; frame: GameFrame } | null> {
    if (typeof slug !== "string" || !GAME_SLUG.test(slug)) return null;
    if (!publishingEnabled()) return null;
    let cached = linkCache.get(slug);
    if (!cached || now - cached.at >= CACHE_MS) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const game = await Promise.race([
            gameLinkRef(slug)
                .get()
                .then((doc) => {
                    const id = doc.exists ? doc.data()?.game : null;
                    return typeof id === "string" ? id : null;
                }),
            new Promise<null>((done) => {
                timer = setTimeout(() => done(null), LOOKUP_TIMEOUT_MS);
            }),
        ])
            .catch(() => null)
            .finally(() => clearTimeout(timer));
        if (linkCache.size >= CACHE_MAX) linkCache.clear();
        cached = { at: now, game };
        linkCache.set(slug, cached);
    }
    if (!cached.game) return null;
    const record = await publishedGame(cached.game, now);
    if (!record || recordSlug(record) !== slug) return null;
    return loadRegisteredGame(cached.game);
}

/** Where the releases route reads one release of a registered game, or null. */
export async function registeredRelease(id: string, release: string) {
    return servedRelease(await publishedGame(id), release);
}

// ---------------------------------------------------------------------------
// The local releases folder

const releaseDir = (root: string, game: string, release: string) =>
    join(root, game, release);
const stagingDir = (root: string, upload: string) =>
    join(root, STAGING, upload);

async function hashFile(
    path: string
): Promise<{ bytes: number; sha256: string }> {
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(path)) {
        bytes += chunk.length;
        hash.update(chunk);
    }
    return { bytes, sha256: hash.digest("hex") };
}

/** The listed files that are missing from a folder or differ, at most a few. */
async function folderProblems(
    folder: string,
    files: ReadonlyArray<PublishFile>,
    { hashes = true } = {}
): Promise<string[]> {
    const problems: string[] = [];
    for (const file of files) {
        if (problems.length >= 5) break;
        const at = join(folder, file.path);
        const found = await stat(at).catch(() => null);
        if (!found?.isFile()) problems.push(`${file.path} was not uploaded`);
        else if (found.size !== file.bytes)
            problems.push(`${file.path} has the wrong size`);
        else if (hashes && (await hashFile(at)).sha256 !== file.sha256)
            problems.push(`${file.path} has the wrong contents`);
    }
    return problems;
}

/** True when this exact release is already in the local folder. */
async function releaseStored(
    root: string,
    game: string,
    release: string,
    files: ReadonlyArray<PublishFile>
): Promise<boolean> {
    const folder = releaseDir(root, game, release);
    const manifest = await readFile(
        join(folder, RELEASE_MANIFEST),
        "utf8"
    ).catch(() => null);
    if (manifest !== releaseManifestText(game, release, files)) return false;
    return !(await folderProblems(folder, files, { hashes: false })).length;
}

/** Uploads nobody finished: their folders go once they are well past due. */
async function sweepStaging(root: string, now: number) {
    const staging = join(root, STAGING);
    const names = await readdir(staging).catch(() => [] as string[]);
    for (const name of names.slice(0, 200)) {
        if (!UPLOAD_ID.test(name)) continue;
        const at = join(staging, name);
        const found = await stat(at).catch(() => null);
        if (found && now - found.mtimeMs > PUBLISH_UPLOAD_TTL_MS * 2)
            await rm(at, { recursive: true, force: true }).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// begin

/**
 * Where this server stores an upload, or a refusal that says why not. In
 * this order: the bucket when `GAMES_PUBLISHING_STORAGE=on` chose it; the
 * local releases folder, where there is one; the bucket, where one is
 * configured; Pinata, where a person switched that on.
 */
function uploadTarget(
    pinned: PinnedUploads | null,
    storage: StorageUploads | null
):
    | { mode: "site"; root: string }
    | { mode: "storage"; storage: StorageUploads }
    | { mode: "pinata"; pinned: PinnedUploads } {
    if (storage?.forced) return { mode: "storage", storage };
    const root = localReleasesDir();
    if (root) return { mode: "site", root };
    if (storage) return { mode: "storage", storage };
    if (pinned) return { mode: "pinata", pinned };
    return refuse(
        "Publishing is not available on this server: it has no releases folder (GAMES_RELEASES_DIR), no storage bucket, and uploads to its storage account are not switched on."
    );
}

/** A failure of the bucket, said without what the bucket said. */
function storageFailed(what: string, error: unknown): never {
    if (error instanceof PublishRefused) throw error;
    console.error(`[games] storage: ${what} failed`, error);
    return refuse(
        `This server's storage did not answer (${what}); try again in a moment.`
    );
}

export async function beginPublish(
    owner: string,
    input: PublishBegin,
    {
        now = new Date(),
        pinned = pinnedUploadsConfig(),
        storage = storageUploadsConfig(),
    }: {
        now?: Date;
        pinned?: PinnedUploads | null;
        storage?: StorageUploads | null;
    } = {}
) {
    const idProblem = publishIdProblem(input.id);
    if (idProblem) refuse(idProblem);
    const filesProblem = releaseFilesProblem(input.files);
    if (filesProblem)
        refuse(`This build cannot be published: ${filesProblem}.`);
    const release = releaseIdOf(input.files);
    if (input.check.release !== release)
        refuse(
            "The check result is for other files than these; run the check again and publish what it checked."
        );
    const target = uploadTarget(pinned, storage);
    const upload: PendingUpload = {
        id: randomBytes(18).toString("base64url"),
        owner,
        game: input.id,
        release,
        files: input.files.map(({ path, bytes, sha256 }) => ({
            path,
            bytes,
            sha256,
        })),
        entry: input.entry,
        checkedAt: input.check.checkedAt,
        mode: target.mode,
        createdAt: now.getTime(),
        expiresAt: now.getTime() + PUBLISH_UPLOAD_TTL_MS,
    };
    const gameRef = db.collection(GAMES).doc(input.id);
    const publisherRef = db.collection(PUBLISHERS).doc(owner);
    await db.runTransaction(async (transaction) => {
        const [game, publisher] = [
            await transaction.get(gameRef),
            await transaction.get(publisherRef),
        ];
        const next = planBegin({
            record: recordOf(game, input.id),
            publisher: publisherAt(publisher.data(), now),
            owner,
            id: input.id,
        });
        transaction.set(publisherRef, next);
        transaction.set(db.collection(UPLOADS).doc(upload.id), {
            ...plainData(upload),
            // For a Firestore TTL policy on this collection, if one is set.
            expireAt: new Date(upload.expiresAt),
        });
    });
    if (target.mode === "site") {
        await sweepStaging(target.root, now.getTime()).catch(() => {});
        return {
            uploadId: upload.id,
            release,
            stored: await releaseStored(
                target.root,
                input.id,
                release,
                upload.files
            ),
            upload: {
                mode: "site" as const,
                url: `/api/games/uploads/${upload.id}/`,
            },
        };
    }
    const expires = Math.floor(PUBLISH_UPLOAD_TTL_MS / 1000);
    if (target.mode === "storage") {
        const { bucket } = target.storage;
        const stored = await storageReleaseStored(
            bucket,
            input.id,
            release,
            upload.files
        ).catch((error) => storageFailed("begin", error));
        return {
            uploadId: upload.id,
            release,
            stored,
            upload: {
                mode: "storage" as const,
                expires,
                // Nothing to send for a release that is already stored.
                files: stored
                    ? []
                    : await signStorageUploads(
                          bucket,
                          upload,
                          input.files
                      ).catch((error) => storageFailed("begin", error)),
            },
        };
    }
    const url = await target.pinned.signer
        .sign({
            name: `game-${input.id}-${release}`,
            // The folder as one archive: its files and a little framing.
            maxBytes: PUBLISH_MAX_BYTES + 2 * 1024 * 1024,
            expiresSeconds: expires,
        })
        .catch((error) =>
            refuse(
                `This server's storage did not give an upload address (${
                    error?.message ?? error
                }).`
            )
        );
    return {
        uploadId: upload.id,
        release,
        stored: false,
        upload: { mode: "pinata" as const, url, expires, as: "car" as const },
    };
}

// ---------------------------------------------------------------------------
// Uploading, mode `site`

const uploads = new Map<string, { at: number; upload: PendingUpload | null }>();

async function readUpload(id: string): Promise<PendingUpload | null> {
    if (!UPLOAD_ID.test(id)) return null;
    const doc = await db.collection(UPLOADS).doc(id).get();
    const data = doc.exists ? (doc.data() as PendingUpload) : null;
    return data?.id === id && Array.isArray(data.files) ? data : null;
}

/** An upload, read from the store at most once in ten seconds per id here. */
async function pendingUpload(id: string, now: number) {
    const cached = uploads.get(id);
    if (cached && now - cached.at < CACHE_MS) return cached.upload;
    const upload = await readUpload(id);
    if (uploads.size >= CACHE_MAX) uploads.clear();
    uploads.set(id, { at: now, upload });
    return upload;
}

export function forgetPendingUploads() {
    uploads.clear();
}

export type UploadAnswer =
    | { status: 200; path: string; bytes: number; sha256: string }
    | { status: 403 | 404 | 409 | 410 | 413 | 422; error: string };

class TooLarge extends Error {}

/**
 * One file of an upload, from the request's body. Only a path `begin`
 * listed (or `thumbnail.jpg`) is taken, compared as a whole string, so the
 * request never names a place on disk. The body is streamed to a file
 * beside its place, cut off at the listed size, and kept only if its size
 * and SHA-256 are the listed ones.
 */
export async function acceptUploadedFile(options: {
    owner: string;
    uploadId: string;
    path: string;
    body: Readable;
    /** The request's Content-Length, when it sent one. */
    length?: number | null;
    now?: number;
}): Promise<UploadAnswer> {
    const { owner, uploadId, path, body, now = Date.now() } = options;
    const upload = await pendingUpload(uploadId, now);
    // Someone else's upload looks like no upload.
    if (!upload || upload.owner !== owner)
        return { status: 404, error: "No such upload." };
    if (now > upload.expiresAt)
        return { status: 410, error: "This upload expired; begin again." };
    const root = localReleasesDir();
    if (upload.mode !== "site" || !root)
        return { status: 409, error: "This upload does not go to the site." };
    const thumbnail = path === PUBLISH_THUMBNAIL;
    const listed = thumbnail
        ? null
        : upload.files.find((file) => file.path === path);
    if (!thumbnail && !listed)
        return { status: 404, error: "That file is not in this upload." };
    const limit = listed ? listed.bytes : PUBLISH_THUMBNAIL_MAX;
    const { length } = options;
    if (length != null && (listed ? length !== limit : length > limit))
        return {
            status: 413,
            error: `${path} is not the size that was listed.`,
        };

    const folder = stagingDir(root, upload.id);
    const target = thumbnail
        ? join(folder, PUBLISH_THUMBNAIL)
        : resolve(folder, "files", path);
    if (!target.startsWith(folder + sep))
        return { status: 404, error: "That file is not in this upload." };
    const temporary = join(folder, `.part-${randomBytes(8).toString("hex")}`);
    await mkdir(dirname(target), { recursive: true });
    const hash = createHash("sha256");
    let bytes = 0;
    // The first bytes, to tell a JPEG.
    const head: number[] = [];
    const measure = new Transform({
        transform(chunk: Uint8Array, _encoding, done) {
            bytes += chunk.length;
            if (bytes > limit) return done(new TooLarge());
            for (let at = 0; head.length < 3 && at < chunk.length; at++)
                head.push(chunk[at]);
            hash.update(chunk);
            done(null, chunk);
        },
    });
    const discard = () => rm(temporary, { force: true }).catch(() => {});
    try {
        await pipeline(
            body,
            measure,
            createWriteStream(temporary, { flags: "wx", mode: 0o600 })
        );
    } catch (error) {
        await discard();
        if (error instanceof TooLarge)
            return { status: 413, error: `${path} is larger than was listed.` };
        return { status: 422, error: `${path} did not arrive whole.` };
    }
    const sha256 = hash.digest("hex");
    const wrong = listed
        ? bytes !== listed.bytes || sha256 !== listed.sha256
        : // A JPEG, by its first bytes; the route names its type, not the file.
          !(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff);
    if (wrong) {
        await discard();
        return {
            status: 422,
            error: listed
                ? `${path} is not the file that was listed (size or SHA-256 differs).`
                : `${PUBLISH_THUMBNAIL} must be a JPEG.`,
        };
    }
    await chmod(temporary, 0o444);
    await rename(temporary, target);
    return { status: 200, path, bytes, sha256 };
}

// ---------------------------------------------------------------------------
// finish

/**
 * Moves a fully uploaded release into the releases folder, whole or not at
 * all. Returns whether this call put it there (so a failed registration can
 * take it away again) and whether a thumbnail is stored with it.
 */
async function installRelease(root: string, upload: PendingUpload) {
    const { game, release, files } = upload;
    const folder = releaseDir(root, game, release);
    const staged = stagingDir(root, upload.id);
    const picture = join(staged, PUBLISH_THUMBNAIL);
    const describe = (problems: string[]) =>
        refuse(`The upload is not complete: ${problems.join("; ")}.`);
    let installed = false;
    if (await stat(folder).catch(() => null)) {
        // A release never changes: what is there must be these bytes.
        if (!(await releaseStored(root, game, release, files)))
            refuse(
                `Release ${release} is already stored with different contents; a release never changes.`
            );
        const problems = await folderProblems(folder, files);
        if (problems.length) describe(problems);
    } else {
        const from = join(staged, "files");
        const problems = await folderProblems(from, files);
        if (problems.length) describe(problems);
        const manifest = join(from, RELEASE_MANIFEST);
        await writeFile(manifest, releaseManifestText(game, release, files));
        await chmod(manifest, 0o444);
        await mkdir(dirname(folder), { recursive: true });
        await rename(from, folder);
        installed = true;
    }
    const kept = join(folder, PUBLISH_THUMBNAIL);
    if (
        !(await stat(kept).catch(() => null)) &&
        (await stat(picture).catch(() => null))
    )
        await rename(picture, kept);
    const thumbnail = !!(await stat(kept).catch(() => null));
    return { folder, installed, thumbnail };
}

export async function finishPublish(
    owner: string,
    input: { uploadId: string; address?: string },
    {
        now = new Date(),
        pinned = pinnedUploadsConfig(),
        storage = storageUploadsConfig(),
        verify = verifyPinnedRelease,
    }: {
        now?: Date;
        pinned?: PinnedUploads | null;
        storage?: StorageUploads | null;
        verify?: typeof verifyPinnedRelease;
    } = {}
) {
    const upload = await readUpload(input.uploadId);
    if (!upload || upload.owner !== owner) refuse("No such upload.");
    if (now.getTime() > upload.expiresAt) {
        if (upload.mode === "storage" && storage)
            await clearStaged(storage.bucket, upload.id);
        refuse("This upload expired; begin again.");
    }
    const { game, release, files } = upload;
    const gameRef = db.collection(GAMES).doc(game);
    // Before anything is stored under the id: it is free, or this account's.
    const before = await gameRef.get();
    const existing = recordOf(before, game);
    if (existing && existing.owner !== owner)
        refuse(`${game} is another account's game; choose another id.`);

    const stored: PublishedRelease = {
        release,
        backend: "local",
        publishedAt: now.toISOString(),
        files: files.length,
        bytes: files.reduce((sum, file) => sum + file.bytes, 0),
        check: "self-reported",
    };
    let undo = async () => {};
    if (upload.mode === "site") {
        const root = localReleasesDir();
        if (!root)
            return refuse("This server has no releases folder any more.");
        const { folder, installed, thumbnail } = await installRelease(
            root,
            upload
        );
        if (thumbnail) stored.thumbnail = true;
        if (installed)
            undo = () =>
                rm(folder, { recursive: true, force: true }).catch(() => {});
    } else if (upload.mode === "storage") {
        if (!storage)
            return refuse("This server has no storage bucket any more.");
        const { bucket } = storage;
        // Before anything is copied: would this release be registered?
        planPublish({
            record: existing,
            publisher: publisherAt(
                (await db.collection(PUBLISHERS).doc(owner).get()).data(),
                now
            ),
            owner,
            id: game,
            entry: upload.entry,
            release: stored,
            now,
        });
        const kept = await installStoredRelease(bucket, upload).catch((error) =>
            storageFailed("finish", error)
        );
        stored.backend = "storage";
        if (kept.thumbnail) stored.thumbnail = true;
        if (kept.installed) undo = kept.undo;
    } else {
        if (!pinned)
            return refuse(
                "Uploads to this server's storage account are not switched on."
            );
        const base = pinnedReleaseBase(pinned.gateway, input.address);
        if (!base)
            return refuse(
                "finish needs the address (the IPFS CID) the storage gave the uploaded folder."
            );
        // Every file, read back through the gateway the site will serve from.
        const problems = await verify(base, files);
        if (problems.length)
            refuse(
                `The stored release is not the one that was checked: ${problems
                    .map(({ path, problem }) => `${path} (${problem})`)
                    .join("; ")}.`
            );
        stored.backend = "pinata";
        stored.address = input.address;
        stored.base = base;
    }

    const publisherRef = db.collection(PUBLISHERS).doc(owner);
    const uploadRef = db.collection(UPLOADS).doc(upload.id);
    let record: PublishedGame;
    try {
        record = await db.runTransaction(async (transaction) => {
            const [current, publisher, pending] = [
                await transaction.get(gameRef),
                await transaction.get(publisherRef),
                await transaction.get(uploadRef),
            ];
            // One finish per upload.
            if (!pending.exists) refuse("No such upload.");
            const next = planPublish({
                record: recordOf(current, game),
                publisher: publisherAt(publisher.data(), now),
                owner,
                id: game,
                entry: upload.entry,
                release: stored,
                now,
            });
            transaction.set(gameRef, plainData(next.record));
            transaction.set(publisherRef, next.publisher);
            transaction.delete(uploadRef);
            return next.record;
        });
    } catch (error) {
        await undo();
        throw error;
    }
    forgetPublishedGames(game);
    uploads.delete(upload.id);
    if (upload.mode === "site") {
        const root = localReleasesDir();
        if (root)
            await rm(stagingDir(root, upload.id), {
                recursive: true,
                force: true,
            }).catch(() => {});
    } else if (upload.mode === "storage" && storage)
        await clearStaged(storage.bucket, upload.id);
    return {
        id: game,
        release,
        // The game's address: its link when it has one.
        url: gamePath({ id: game, slug: recordSlug(record) }),
        status: record.status,
    };
}

// ---------------------------------------------------------------------------
// mine, unpublish

export async function minePublished(owner: string, now = new Date()) {
    const publisher = publisherAt(
        (await db.collection(PUBLISHERS).doc(owner).get()).data(),
        now
    );
    const records = await Promise.all(
        publisher.games.slice(0, 50).map(async (id) => {
            const doc = await db.collection(GAMES).doc(id).get();
            return doc.exists ? readPublishedGame(doc.data()) : null;
        })
    );
    return records
        .filter((record) => record?.owner === owner)
        .map(publishedGameSummary);
}

export async function unpublishGame(
    owner: string,
    id: string,
    now = new Date()
) {
    const ref = db.collection(GAMES).doc(id);
    const record = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref);
        const next = planUnpublish(
            doc.exists ? readPublishedGame(doc.data()) : null,
            owner,
            now
        );
        transaction.set(ref, plainData(next));
        return next;
    });
    forgetPublishedGames(id);
    return { id, status: record.status };
}

// ---------------------------------------------------------------------------
// A game's short address

/**
 * The owner gives their game a slug, changes it or (null) gives it up
 * (gameSlug.ts). One transaction: the record must be theirs, and nobody
 * else may hold the name, neither another game (the `gameLinks` document
 * of that name) nor a space (an exhibit whose `info.customLink` is that
 * name). A space claiming a link looks at `gameLinks` in its own
 * transaction, so of two claims for one name at the same moment one is
 * refused. The slug given up is free again at once.
 */
export async function setGameLink(
    owner: string,
    id: string,
    slug: string | null,
    now = new Date()
) {
    const ref = db.collection(GAMES).doc(id);
    const record = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref);
        const before = doc.exists ? readPublishedGame(doc.data()) : null;
        const next = planLink(before, owner, slug, now);
        const held = recordSlug(before);
        if (held === slug) return next;
        if (slug) {
            const claim = gameLinkRef(slug);
            const [claimed, spaces] = await Promise.all([
                transaction.get(claim),
                transaction.get(
                    db
                        .collection("exhibits")
                        .where("info.customLink", "==", slug)
                        .select()
                        .limit(1)
                ),
            ]);
            if (claimed.exists && claimed.data()?.game !== id)
                refuse(`/${slug} is another game's link; choose another.`);
            if (!spaces.empty)
                refuse(`/${slug} is a space's link; choose another.`);
            transaction.set(claim, {
                game: id,
                owner,
                claimedAt: now.toISOString(),
            });
        }
        if (held) transaction.delete(gameLinkRef(held));
        transaction.set(ref, plainData(next));
        return next;
    });
    forgetPublishedGames(id);
    const held = recordSlug(record);
    return { id, slug: held, url: gamePath({ id, slug: held }) };
}
