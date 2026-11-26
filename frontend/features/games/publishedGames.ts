/**
 * Games published from outside the repository (docs/games/publishing.md):
 * the rules of the registry, with no I/O. A signed-in creator's `oncyber`
 * command uploads a built game; the site stores it as a release and keeps
 * one record per game in the `publishedGames` collection. This file decides
 * who may publish, what an upload may contain, and how a record moves
 * between its states (docs/state-machines.md). Firestore and the disk are in
 * publishedGamesServer.ts.
 */
import { createHash } from "crypto";
import { z } from "zod";
import {
    GAMES,
    gamesPreviewEnabled,
    type GameDevice,
    type GameEntry,
} from "./catalog";
import {
    LOCAL_RELEASES_PATH,
    pinnedGatewayBase,
    type GameFrame,
    type HostedRelease,
} from "./gameRelease";
import { GAME_SLUG, gamePath, gameSlugProblem } from "./gameSlug";

/** Limits of one release and of one account (docs/games/publishing.md). */
export const PUBLISH_MAX_BYTES = 30 * 1024 * 1024;
export const PUBLISH_MAX_FILES = 400;
export const PUBLISH_MAX_PATH = 200;
export const PUBLISH_MAX_GAMES = 10;
export const PUBLISH_MAX_RELEASES_PER_DAY = 20;
/** Uploads begun per day: a few tries for every release that may land. */
export const PUBLISH_MAX_UPLOADS_PER_DAY = 60;
/** Releases a record keeps listed, newest last, like a pointer file. */
export const PUBLISH_KEEP_RELEASES = 20;
export const PUBLISH_UPLOAD_TTL_MS = 30 * 60 * 1000;
export const PUBLISH_THUMBNAIL = "thumbnail.jpg";
export const PUBLISH_THUMBNAIL_MAX = 512 * 1024;
/** The file list storage writes into every release (storage.mjs). */
export const RELEASE_MANIFEST = "oncyber-release.json";
/**
 * What the check writes beside a build that is not part of a release:
 * `RELEASE_REPORTS` in scripts/games/releases/storage.mjs.
 */
export const RELEASE_REPORTS = ["check.json", "release.json", "thumbnail.jpg"];

export const PUBLISH_ID = /^[a-z0-9][a-z0-9-]{2,40}$/;
export const RELEASE_ID = /^[0-9a-f]{16}$/;
export const UPLOAD_ID = /^[A-Za-z0-9_-]{20,40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MD5 = /^[0-9a-f]{32}$/;
/** One folder or file name: no dot files, no spaces, nothing a shell reads. */
const PATH_PART = /^[A-Za-z0-9_][A-Za-z0-9._@+~-]*$/;
const TAG = /^[a-z0-9][a-z0-9-]{1,23}$/;
const DEVICES = ["desktop", "phone", "gamepad"] as const;

/** A request the registry refuses; the message is for the creator. */
export class PublishRefused extends Error {}
const refuse = (message: string): never => {
    throw new PublishRefused(message);
};

// ---------------------------------------------------------------------------
// Who may publish

export type PublishingGate =
    | { mode: "off" }
    | { mode: "open" }
    | { mode: "accounts"; accounts: string[] };

/**
 * `GAMES_PUBLISHING`: unset is off (open on the development server), `open`
 * is any signed-in account, anything else is a list of account ids. Where
 * game pages are hidden (`gamesPreviewEnabled`), so is publishing.
 */
export function publishingGate(
    env: Record<string, string | undefined> = process.env
): PublishingGate {
    if (!gamesPreviewEnabled(env)) return { mode: "off" };
    const value = (env.GAMES_PUBLISHING ?? "").trim();
    if (!value)
        return env.NODE_ENV === "development"
            ? { mode: "open" }
            : { mode: "off" };
    if (value.toLowerCase() === "open") return { mode: "open" };
    if (value.toLowerCase() === "off") return { mode: "off" };
    const accounts = value.split(/[\s,]+/).filter(Boolean);
    return accounts.length ? { mode: "accounts", accounts } : { mode: "off" };
}

export function publishingEnabled(
    env: Record<string, string | undefined> = process.env
): boolean {
    return publishingGate(env).mode !== "off";
}

export function mayPublish(
    account: unknown,
    env: Record<string, string | undefined> = process.env
): boolean {
    if (typeof account !== "string" || !account) return false;
    const gate = publishingGate(env);
    if (gate.mode === "open") return true;
    return gate.mode === "accounts" && gate.accounts.includes(account);
}

// ---------------------------------------------------------------------------
// Ids and rooms

/** The one room a registered game's visitors share, for chat and voice. */
export const registeredSocialRoom = (id: string) => `oncyber-${id}-social-v1`;

/**
 * Why an id cannot be registered, or null. A registered game never takes a
 * catalogued game's id, and its rooms (`oncyber-<id>-social-v1`, and a
 * party's `oncyber-<id>-party-<party>`) never name a room another game
 * uses: an id holding `-party-` could spell another game's party room.
 */
export function publishIdProblem(
    id: unknown,
    catalog: Record<string, GameEntry> = GAMES
): string | null {
    if (typeof id !== "string" || !PUBLISH_ID.test(id))
        return "A game id is 3 to 41 lowercase letters, digits and dashes, starting with a letter or digit.";
    if (id.endsWith("-") || id.includes("--"))
        return "A game id has single dashes between its words and none at the end.";
    if (Object.hasOwn(catalog, id))
        return `${id} is a game in Oncyber's own catalog; choose another id.`;
    if (id.includes("-party-") || id.endsWith("-party"))
        return 'A game id cannot contain "-party-" or end in "-party": those name party rooms.';
    const room = registeredSocialRoom(id);
    const taken = Object.values(catalog).some(
        (game) =>
            game.room === room ||
            game.socialRoom === room ||
            id.startsWith(`${game.id}-party-`)
    );
    return taken ? `${id} would share a room with another game.` : null;
}

// ---------------------------------------------------------------------------
// Files and the release id

export interface PublishFile {
    path: string;
    bytes: number;
    sha256: string;
}

/**
 * The release id: the first 16 hex digits of the SHA-256 of every
 * `path:sha256` line, sorted by path. The same rule as `releaseId` in
 * scripts/games/releases/storage.mjs; the test pins it to a committed
 * game's `release.json`.
 */
export function releaseIdOf(
    files: ReadonlyArray<Pick<PublishFile, "path" | "sha256">>
): string {
    const lines = [...files]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .map((file) => `${file.path}:${file.sha256}`);
    return createHash("sha256")
        .update(lines.join("\n"))
        .digest("hex")
        .slice(0, 16);
}

/** A release's `oncyber-release.json`, byte for byte as storage.mjs writes it. */
export function releaseManifestText(
    game: string,
    release: string,
    files: ReadonlyArray<PublishFile>
): string {
    const list = files.map(({ path, bytes, sha256 }) => ({
        path,
        bytes,
        sha256,
    }));
    return (
        JSON.stringify({ version: 1, game, release, files: list }, null, 2) +
        "\n"
    );
}

/** Why a path cannot be a file of a release, or null. */
export function releasePathProblem(path: unknown): string | null {
    if (typeof path !== "string" || !path) return "a path is missing";
    if (path.length > PUBLISH_MAX_PATH)
        return `${path.slice(
            0,
            40
        )}… is longer than ${PUBLISH_MAX_PATH} characters`;
    const parts = path.split("/");
    if (parts.length > 12) return `${path} is nested too deeply`;
    for (const part of parts)
        if (!PATH_PART.test(part) || part.endsWith("."))
            return `${path} is not a plain relative path (letters, digits and . _ - @ + ~, no spaces, no dot files, no "..")`;
    if (path === RELEASE_MANIFEST)
        return `${RELEASE_MANIFEST} is reserved for the release's file list`;
    if (RELEASE_REPORTS.includes(path))
        return `${path} is a report beside the build, not a file of the release`;
    return null;
}

/**
 * Why a file list cannot be a release, or null: every path plain and used
 * once (whatever its case, so the release stores on any disk), no path
 * both a file and a folder, an `index.html`, and the size limits.
 */
export function releaseFilesProblem(files: ReadonlyArray<PublishFile>) {
    if (!files.length) return "a release needs files";
    if (files.length > PUBLISH_MAX_FILES)
        return `a release has at most ${PUBLISH_MAX_FILES} files`;
    const seen = new Set<string>();
    const folders = new Set<string>();
    let bytes = 0;
    for (const file of files) {
        const problem = releasePathProblem(file.path);
        if (problem) return problem;
        if (!Number.isInteger(file.bytes) || file.bytes < 0)
            return `${file.path} has no size`;
        if (!SHA256.test(file.sha256)) return `${file.path} has no SHA-256`;
        const key = file.path.toLowerCase();
        if (seen.has(key)) return `${file.path} is listed twice`;
        seen.add(key);
        const parts = key.split("/");
        for (let depth = 1; depth < parts.length; depth++)
            folders.add(parts.slice(0, depth).join("/"));
        bytes += file.bytes;
    }
    for (const path of seen)
        if (folders.has(path)) return `${path} is both a file and a folder`;
    if (!files.some((file) => file.path === "index.html"))
        return "a release needs index.html";
    if (bytes > PUBLISH_MAX_BYTES)
        return `a release is at most ${PUBLISH_MAX_BYTES / 1024 / 1024} MiB`;
    return null;
}

// ---------------------------------------------------------------------------
// What the command sends

// eslint-disable-next-line no-control-regex
const PLAIN = /^[^<>\u0000-\u001f\u007f]*$/;
const plain = (min: number, max: number) =>
    z
        .string()
        .trim()
        .min(min)
        .max(max)
        .regex(PLAIN, "plain text: no markup or control characters");

/**
 * The listing the site keeps: the fields `pnpm games:catalog` builds from a
 * manifest, held to the listing rules (scripts/games/listing.mjs). Anything
 * else the command sends (rooms, the relay, `controlsStyle`, a
 * thumbnail address) is dropped: the site sets those itself.
 */
export const publishEntrySchema = z
    .object({
        title: plain(1, 60),
        tagline: plain(1, 60),
        description: plain(30, 200).refine(
            (text) => !/https?:\/\//i.test(text),
            "plain text: no links"
        ),
        players: z
            .object({
                min: z.number().int().min(1).max(500),
                max: z.number().int().min(1).max(500),
            })
            .refine((players) => players.min <= players.max, "min above max"),
        partySizes: z.array(z.number().int().min(2).max(8)).max(7).default([]),
        devices: z.array(z.enum(DEVICES)).min(1).max(DEVICES.length),
        tags: z.array(z.string().regex(TAG)).min(1).max(6),
        crowdLabel: plain(0, 40).default(""),
    })
    .transform((entry): PublishedEntry => {
        const unique = <T>(list: T[]) => [...new Set(list)];
        return {
            title: entry.title,
            tagline: entry.tagline,
            description: entry.description,
            players: { min: entry.players.min, max: entry.players.max },
            partySizes: unique(entry.partySizes)
                .filter((size) => size <= entry.players.max)
                .sort((a, b) => a - b),
            devices: DEVICES.filter((device) => entry.devices.includes(device)),
            tags: unique(entry.tags),
            crowdLabel: entry.crowdLabel,
        };
    });

export const publishBeginSchema = z.object({
    id: z.string().regex(PUBLISH_ID),
    // The game's game.json: bounded, and not kept. The site reads nothing
    // from it today; the listing is `entry`.
    manifest: z
        .record(z.string(), z.unknown())
        .refine(
            (manifest) => JSON.stringify(manifest).length <= 64 * 1024,
            "game.json is at most 64 KiB"
        ),
    entry: publishEntrySchema,
    files: z
        .array(
            z.object({
                path: z.string().min(1).max(PUBLISH_MAX_PATH),
                bytes: z.number().int().min(0).max(PUBLISH_MAX_BYTES),
                sha256: z.string().regex(SHA256),
                // Optional, and used by upload mode `storage` alone: the
                // store checks each upload against it as it arrives. The
                // SHA-256 is what a release is verified by.
                md5: z.string().regex(MD5).optional(),
            })
        )
        .min(1)
        .max(PUBLISH_MAX_FILES),
    check: z.object({
        status: z.literal("passed"),
        checkedAt: z
            .string()
            .max(40)
            .refine((date) => !Number.isNaN(Date.parse(date)), "not a date"),
        release: z.string().regex(RELEASE_ID),
    }),
});
export type PublishBegin = z.infer<typeof publishBeginSchema>;

// ---------------------------------------------------------------------------
// The record

export type PublishedStatus = "unlisted" | "listed" | "unpublished";

export interface PublishedEntry {
    title: string;
    tagline: string;
    description: string;
    players: { min: number; max: number };
    partySizes: number[];
    devices: GameDevice[];
    tags: string[];
    crowdLabel: string;
}

export interface PublishedRelease {
    release: string;
    /**
     * Where the release is kept: the local releases folder, this server's
     * storage bucket (under `games/<id>/<release>/`, a place made from the
     * record's own id and release, never stored), or IPFS.
     */
    backend: "local" | "storage" | "pinata";
    /** The IPFS CID and its gateway folder, for `pinata`. */
    address?: string;
    base?: string;
    publishedAt: string;
    files: number;
    bytes: number;
    /** The creator's own check: the site has not run it. */
    check: "self-reported";
    /** A `thumbnail.jpg` is stored beside the release's files. */
    thumbnail?: boolean;
}

export interface PublishedGame {
    id: string;
    owner: string;
    status: PublishedStatus;
    entry: PublishedEntry;
    current: string;
    releases: PublishedRelease[];
    /**
     * The game's short address, /<slug>, when its owner claimed one
     * (`planLink`, gameSlug.ts). The game is at /games/<id> either way.
     */
    slug?: string;
    createdAt: string;
    updatedAt: string;
}

/** What one account has used: its games, and today's releases and uploads. */
export interface Publisher {
    games: string[];
    /** The UTC day the counts below are for. */
    day: string;
    releases: number;
    uploads: number;
}

const dayOf = (now: Date) => now.toISOString().slice(0, 10);

/** An account's use as of `now`: yesterday's counts are gone. */
export function publisherAt(publisher: unknown, now: Date): Publisher {
    const stored = (publisher ?? {}) as Partial<Publisher>;
    const today = dayOf(now);
    const same = stored.day === today;
    const count = (value: unknown) =>
        same && Number.isInteger(value) && (value as number) > 0
            ? (value as number)
            : 0;
    return {
        games: Array.isArray(stored.games)
            ? stored.games.filter((id) => typeof id === "string")
            : [],
        day: today,
        releases: count(stored.releases),
        uploads: count(stored.uploads),
    };
}

/** A record read from the store, or null when it is not one. */
export function readPublishedGame(value: unknown): PublishedGame | null {
    const record = value as PublishedGame | null;
    if (
        !record ||
        typeof record !== "object" ||
        typeof record.id !== "string" ||
        !PUBLISH_ID.test(record.id) ||
        typeof record.owner !== "string" ||
        !record.owner ||
        !["unlisted", "listed", "unpublished"].includes(record.status) ||
        !record.entry ||
        typeof record.entry !== "object" ||
        typeof record.current !== "string" ||
        !Array.isArray(record.releases)
    )
        return null;
    return record;
}

/**
 * The moves of a record (docs/state-machines.md):
 *
 *     (none)       --publish-->    unlisted
 *     unlisted     --publish-->    unlisted      (a new current release)
 *     unpublished  --publish-->    unlisted
 *     listed       --publish-->    listed
 *     unlisted | listed --unpublish--> unpublished
 *
 * Only the owner moves it, and nothing here sets `listed`: a person at
 * Oncyber does. Each function returns what to store, or throws
 * `PublishRefused`.
 */
function assertOwner(record: PublishedGame | null, owner: string, id: string) {
    if (record && record.owner !== owner)
        refuse(`${id} is another account's game; choose another id.`);
}

/** Before an upload starts: may this account publish to this id today? */
export function planBegin(options: {
    record: PublishedGame | null;
    publisher: Publisher;
    owner: string;
    id: string;
}): Publisher {
    const { record, publisher, owner, id } = options;
    const problem = publishIdProblem(id);
    if (problem) refuse(problem);
    assertOwner(record, owner, id);
    if (!record && publisher.games.length >= PUBLISH_MAX_GAMES)
        refuse(`An account holds at most ${PUBLISH_MAX_GAMES} games.`);
    if (publisher.releases >= PUBLISH_MAX_RELEASES_PER_DAY)
        refuse(
            `An account publishes at most ${PUBLISH_MAX_RELEASES_PER_DAY} releases a day; try again tomorrow.`
        );
    if (publisher.uploads >= PUBLISH_MAX_UPLOADS_PER_DAY)
        refuse("Too many uploads started today; try again tomorrow.");
    return { ...publisher, uploads: publisher.uploads + 1 };
}

/** A verified release becomes the game's current one. */
export function planPublish(options: {
    record: PublishedGame | null;
    publisher: Publisher;
    owner: string;
    id: string;
    entry: PublishedEntry;
    release: PublishedRelease;
    now: Date;
}): { record: PublishedGame; publisher: Publisher } {
    const { record, publisher, owner, id, entry, release, now } = options;
    const problem = publishIdProblem(id);
    if (problem) refuse(problem);
    assertOwner(record, owner, id);
    if (!record && publisher.games.length >= PUBLISH_MAX_GAMES)
        refuse(`An account holds at most ${PUBLISH_MAX_GAMES} games.`);
    const listed = record?.releases.find(
        (stored) => stored.release === release.release
    );
    // Moving back to a release already listed stores nothing new.
    if (!listed && publisher.releases >= PUBLISH_MAX_RELEASES_PER_DAY)
        refuse(
            `An account publishes at most ${PUBLISH_MAX_RELEASES_PER_DAY} releases a day; try again tomorrow.`
        );
    const at = now.toISOString();
    const releases = [
        ...(record?.releases ?? []).filter(
            (stored) => stored.release !== release.release
        ),
        // A release never changes: one already listed keeps its entry.
        listed ?? release,
    ].slice(-PUBLISH_KEEP_RELEASES);
    return {
        record: {
            id,
            owner,
            status: record?.status === "listed" ? "listed" : "unlisted",
            entry,
            current: release.release,
            releases,
            // A new release keeps the game's link.
            ...(recordSlug(record) ? { slug: recordSlug(record) } : {}),
            createdAt: record?.createdAt ?? at,
            updatedAt: at,
        },
        publisher: {
            ...publisher,
            games: publisher.games.includes(id)
                ? publisher.games
                : [...publisher.games, id],
            releases: publisher.releases + (listed ? 0 : 1),
        },
    };
}

/** The owner takes the game down; the id stays theirs. */
export function planUnpublish(
    record: PublishedGame | null,
    owner: string,
    now: Date
): PublishedGame {
    if (!record || record.owner !== owner)
        return refuse("That is not a game of this account.");
    if (record.status === "unpublished") return record;
    return { ...record, status: "unpublished", updatedAt: now.toISOString() };
}

/** The slug a record holds, or null: one that is not a slug is none. */
export function recordSlug(record: PublishedGame | null): string | null {
    return typeof record?.slug === "string" && GAME_SLUG.test(record.slug)
        ? record.slug
        : null;
}

/**
 * The owner gives the game a short address, changes it or (null) takes it
 * away. This decides only what the record may hold: that nobody else holds
 * the name (a space, another game) is asked of the store, in the same
 * transaction (publishedGamesServer.ts, `setGameLink`).
 */
export function planLink(
    record: PublishedGame | null,
    owner: string,
    slug: string | null,
    now: Date
): PublishedGame {
    if (!record || record.owner !== owner)
        return refuse("That is not a game of this account.");
    if (slug !== null) {
        const problem = gameSlugProblem(slug);
        if (problem) refuse(problem);
    }
    if (recordSlug(record) === slug) return record;
    const { slug: _before, ...rest } = record;
    return {
        ...rest,
        ...(slug ? { slug } : {}),
        updatedAt: now.toISOString(),
    };
}

// ---------------------------------------------------------------------------
// What the site serves from a record

/** A game with a page: published, and its current release still listed. */
export function publishedGameLive(record: PublishedGame | null): boolean {
    return (
        !!record &&
        (record.status === "unlisted" || record.status === "listed") &&
        !publishIdProblem(record.id) &&
        record.releases.some((stored) => stored.release === record.current)
    );
}

/**
 * Where the releases route reads a listed release of a live game: the local
 * folder, this server's storage bucket, or the gateway folder of one on
 * IPFS (held to the same rule as a committed pointer entry,
 * `pinnedGatewayBase`). Null when the game is not live or does not list the
 * release.
 */
export function servedRelease(
    record: PublishedGame | null,
    release: string
):
    | { backend: "local" | "storage" }
    | { backend: "pinata"; pinned: HostedRelease }
    | null {
    if (!publishedGameLive(record) || !RELEASE_ID.test(release)) return null;
    const stored = record.releases.find((entry) => entry.release === release);
    if (!stored) return null;
    if (stored.backend === "local") return { backend: "local" };
    if (stored.backend === "storage") return { backend: "storage" };
    const base = pinnedGatewayBase(stored);
    return base ? { backend: "pinata", pinned: { release, base } } : null;
}

const releaseFolder = (id: string, release: string) =>
    `${LOCAL_RELEASES_PATH}/${id}/${release}/`;

/**
 * The page's entry for a registered game. The rooms are the site's, made
 * from the id here and never read from the record: no room of its own, no
 * relay outside a party, and one room for chat and voice.
 */
export function registeredGameEntry(record: PublishedGame): GameEntry {
    const { id, entry } = record;
    const current = record.releases.find(
        (stored) => stored.release === record.current
    );
    return {
        id,
        title: String(entry.title ?? id),
        tagline: String(entry.tagline ?? ""),
        description: String(entry.description ?? ""),
        thumbnail: current?.thumbnail
            ? `${releaseFolder(id, record.current)}${PUBLISH_THUMBNAIL}`
            : "",
        players: {
            min: Number(entry.players?.min) || 1,
            max: Number(entry.players?.max) || 1,
        },
        partySizes: Array.isArray(entry.partySizes) ? entry.partySizes : [],
        devices: DEVICES.filter((device) => entry.devices?.includes(device)),
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        room: null,
        relay: false,
        socialRoom: registeredSocialRoom(id),
        crowdLabel: String(entry.crowdLabel ?? ""),
        registered: true,
        ...(recordSlug(record) ? { slug: recordSlug(record) } : {}),
    };
}

/** The frame of a registered game: its current release, from this site's route. */
export function registeredGameFrame(record: PublishedGame): GameFrame {
    return {
        src: `${releaseFolder(record.id, record.current)}index.html`,
        release: record.current,
        source: "hosted",
    };
}

/** One row of `mine`. */
export function publishedGameSummary(record: PublishedGame) {
    const current = record.releases.find(
        (stored) => stored.release === record.current
    );
    return {
        id: record.id,
        title: String(record.entry?.title ?? record.id),
        status: record.status,
        release: record.current,
        publishedAt: current?.publishedAt ?? record.updatedAt,
        // The game's address: its link when it has one. /games/<id> always
        // answers too.
        url: gamePath({ id: record.id, slug: recordSlug(record) }),
        slug: recordSlug(record),
    };
}
