/**
 * Upload mode `storage` of publishing from outside the repository
 * (docs/games/publishing.md): releases kept in a Firebase Storage bucket
 * (Google Cloud Storage, through the Firebase Admin SDK the site already
 * uses). It is the mode for a host with no disk of its own.
 *
 * The bucket is private. Nothing in it is ever given a public address:
 *
 *   games-staging/<uploadId>/<path>   what a creator's command sends, each
 *                                     file through its own short-lived
 *                                     signed address that can only create
 *                                     that one object
 *   games/<game>/<release>/<path>     a registered release, written only by
 *                                     this server at `finish`, never changed
 *
 * Only this server reads either, and it serves a release through the
 * releases route with the route's own headers.
 *
 * `ReleaseBucket` is the whole of what the site asks of a store, so another
 * one (decentralised storage, later) is another implementation of it, and a
 * release, immutable and named by its hash, moves there as a copy.
 */
import type { Readable } from "stream";
import {
    PUBLISH_ID,
    PUBLISH_THUMBNAIL,
    RELEASE_ID,
    RELEASE_MANIFEST,
    UPLOAD_ID,
    releasePathProblem,
} from "./publishedGames";

export const STAGING_PREFIX = "games-staging";
export const RELEASES_PREFIX = "games";

/** What the store says of one object. */
export interface StoredObject {
    bytes: number;
    /** The object's version: reading and copying name it, so they are of one write. */
    generation: string;
    /** The store's own MD5 of the bytes (base64), when it has one. */
    md5: string | null;
    /** A `Content-Encoding` the uploader named; a release file has none. */
    encoding: string | null;
}

export interface SignedUpload {
    url: string;
    /** The headers the command must send, exactly. */
    headers: Record<string, string>;
}

export interface ReleaseBucket {
    /**
     * An address the command may `PUT` one object to, until `expiresAt`. It
     * names that object and no other, and cannot replace one that exists.
     * `bytes` is the exact size when `exact`, else the most it may hold.
     */
    signUpload(request: {
        object: string;
        bytes: number;
        exact: boolean;
        /** The MD5 of the bytes (base64), when the command sent one. */
        md5?: string;
        expiresAt: number;
    }): Promise<SignedUpload>;
    /** Null when there is no such object. */
    stat(object: string): Promise<StoredObject | null>;
    /** The bytes as stored. A missing object fails the stream (`isMissing`). */
    read(object: string, generation?: string): Readable;
    /**
     * Copies one version of an object to a name that must not exist yet.
     * False when it does: nothing was written.
     */
    copy(from: string, generation: string, to: string): Promise<boolean>;
    /** Writes an object that must not exist yet. False when it does. */
    create(object: string, bytes: Buffer): Promise<boolean>;
    list(prefix: string): Promise<Array<{ object: string; bytes: number }>>;
    remove(object: string): Promise<void>;
    /** Removes every object under a prefix that ends in `/`. */
    removeAll(prefix: string): Promise<void>;
}

/** True for the failure of reading an object that is not there. */
export const isMissing = (error: unknown) =>
    Number((error as { code?: unknown } | null)?.code) === 404;

// ---------------------------------------------------------------------------
// Names. Every part comes from this server's own records, and is checked
// again here, so a request never spells an object's name.

const names = (path: string) => path.split("/");

/** Where one file of an upload is staged, or null for a name it never has. */
export function stagedObject(uploadId: string, path: string): string | null {
    if (!UPLOAD_ID.test(uploadId)) return null;
    if (path !== PUBLISH_THUMBNAIL && releasePathProblem(path)) return null;
    return `${STAGING_PREFIX}/${uploadId}/${path}`;
}

export const stagedPrefix = (uploadId: string) =>
    UPLOAD_ID.test(uploadId) ? `${STAGING_PREFIX}/${uploadId}/` : null;

export const releasePrefix = (game: string, release: string) =>
    PUBLISH_ID.test(game) && RELEASE_ID.test(release)
        ? `${RELEASES_PREFIX}/${game}/${release}/`
        : null;

/**
 * Where one file of a registered release is, or null: a path of a release,
 * or one of the two files the site keeps beside them.
 */
export function releaseObject(
    game: string,
    release: string,
    path: string
): string | null {
    const prefix = releasePrefix(game, release);
    if (!prefix) return null;
    if (
        path !== PUBLISH_THUMBNAIL &&
        path !== RELEASE_MANIFEST &&
        releasePathProblem(path)
    )
        return null;
    // releasePathProblem leaves no empty name, no `.` and no `..`.
    return names(path).every(Boolean) ? `${prefix}${path}` : null;
}

// ---------------------------------------------------------------------------
// Configuration

const BUCKET_NAME = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;

export interface ReleaseBucketConfig {
    name: string;
    /** `GAMES_PUBLISHING_STORAGE=on`: uploads go here even beside a local folder. */
    forced: boolean;
    /** The Storage emulator is in use: nothing is signed (see below). */
    emulated: boolean;
}

/**
 * The bucket releases are kept in, or null. `GAMES_STORAGE_BUCKET` names
 * one of its own; without it, the Firebase project's bucket
 * (`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`). `GAMES_PUBLISHING_STORAGE=off`
 * means none; `on` makes it the place uploads go even where a local
 * releases folder exists (to try the mode on a development server).
 */
export function releaseBucketConfig(
    env: Record<string, string | undefined> = process.env
): ReleaseBucketConfig | null {
    const choice = (env.GAMES_PUBLISHING_STORAGE ?? "").trim().toLowerCase();
    if (choice === "off") return null;
    const name = (
        env.GAMES_STORAGE_BUCKET ||
        env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        ""
    )
        .trim()
        .replace(/^gs:\/\//, "")
        .replace(/\/+$/, "");
    if (!BUCKET_NAME.test(name)) return null;
    return {
        name,
        forced: choice === "on",
        emulated: !!(
            env.FIREBASE_STORAGE_EMULATOR_HOST || env.STORAGE_EMULATOR_HOST
        ),
    };
}

// ---------------------------------------------------------------------------
// Google Cloud Storage

const OCTETS = "application/octet-stream";
const status = (error: unknown) =>
    Number((error as { code?: unknown } | null)?.code);

/**
 * A `ReleaseBucket` over a Cloud Storage bucket handle (the Admin SDK's
 * `storage().bucket(name)`).
 *
 * Upload addresses are V4 signed `PUT` URLs. Each signs, besides the
 * object's name and the expiry, the headers the command must send:
 *
 *   Content-Type: application/octet-stream     the uploader names no type
 *   x-goog-content-length-range: <n>,<n>       exactly the listed size
 *   Content-MD5: <md5>                         the listed bytes, when the
 *                                              command sent their MD5
 *   x-goog-if-generation-match: 0              create only, never replace
 *
 * The Storage emulator implements neither signed URLs nor the XML API's
 * `PUT /<bucket>/<object>`, so with `emulated` the address is a resumable
 * upload session of the emulator instead: also one `PUT` of the bytes to
 * an address that names one object. The emulator enforces no size, hash or
 * precondition, so `copy` and `create` look before they write there;
 * `finish` verifies every file whichever way it arrived.
 */
export function gcsReleaseBucket(
    // The Admin SDK's bucket: typed loosely, so the site does not depend on
    // the storage library's own types.
    bucket: any,
    { emulated = false }: { emulated?: boolean } = {}
): ReleaseBucket {
    const exists = async (object: string) =>
        (await bucket.file(object).exists())[0] as boolean;
    return {
        async signUpload({ object, bytes, exact, md5, expiresAt }) {
            const file = bucket.file(object);
            if (emulated) {
                const [url] = await file.createResumableUpload({
                    metadata: { contentType: OCTETS },
                });
                return { url, headers: { "Content-Type": OCTETS } };
            }
            const range = `${exact ? bytes : 0},${bytes}`;
            const [url] = await file.getSignedUrl({
                version: "v4",
                action: "write",
                expires: expiresAt,
                contentType: OCTETS,
                ...(md5 ? { contentMd5: md5 } : {}),
                extensionHeaders: {
                    "x-goog-content-length-range": range,
                    "x-goog-if-generation-match": "0",
                },
            });
            return {
                url,
                headers: {
                    "Content-Type": OCTETS,
                    ...(md5 ? { "Content-MD5": md5 } : {}),
                    "x-goog-content-length-range": range,
                    "x-goog-if-generation-match": "0",
                },
            };
        },
        async stat(object) {
            try {
                const [found] = await bucket.file(object).getMetadata();
                return {
                    bytes: Number(found.size),
                    generation: String(found.generation),
                    md5: found.md5Hash ?? null,
                    encoding: found.contentEncoding || null,
                };
            } catch (error) {
                if (status(error) === 404) return null;
                throw error;
            }
        },
        read(object, generation) {
            return bucket
                .file(object, generation ? { generation } : undefined)
                .createReadStream({ decompress: false });
        },
        async copy(from, generation, to) {
            if (emulated && (await exists(to))) return false;
            try {
                await bucket.file(from, { generation }).copy(bucket.file(to), {
                    preconditionOpts: { ifGenerationMatch: 0 },
                    // The copy is described here, not by what the uploader
                    // said of the bytes. (`finish` has already refused a
                    // staged file that names an encoding.)
                    contentType: OCTETS,
                });
                return true;
            } catch (error) {
                if (status(error) === 412) return false;
                throw error;
            }
        },
        async create(object, bytes) {
            if (emulated && (await exists(object))) return false;
            try {
                await bucket.file(object).save(bytes, {
                    resumable: false,
                    contentType: OCTETS,
                    preconditionOpts: { ifGenerationMatch: 0 },
                });
                return true;
            } catch (error) {
                if (status(error) === 412) return false;
                throw error;
            }
        },
        async list(prefix) {
            const [files] = await bucket.getFiles({ prefix });
            return files.map((file: any) => ({
                object: String(file.name),
                bytes: Number(file.metadata?.size),
            }));
        },
        async remove(object) {
            await bucket.file(object).delete({ ignoreNotFound: true });
        },
        async removeAll(prefix) {
            if (!prefix.endsWith("/")) throw new Error("not a folder");
            await bucket.deleteFiles({ prefix, force: true });
        },
    };
}

let configured: { key: string; bucket: ReleaseBucket } | null = null;

/** This server's bucket for releases, or null when it has none. */
export function releaseBucket(
    env: Record<string, string | undefined> = process.env
): ReleaseBucket | null {
    const config = releaseBucketConfig(env);
    if (!config) return null;
    const key = `${config.name}|${config.emulated}`;
    if (configured?.key !== key) {
        // The Admin SDK is loaded only where a bucket is configured.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { storage } = require("@utils/firebaseAdmin");
        configured = {
            key,
            bucket: gcsReleaseBucket(storage().bucket(config.name), config),
        };
    }
    return configured.bucket;
}
