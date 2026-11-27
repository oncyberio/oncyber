/**
 * Saved data for games: the rules every side shares.
 *
 * A game declares named keys in its game.json (`saved`), each with a scope,
 * a size limit and a `stateVersion`. Three scopes:
 *
 *   visitor  one value per person
 *   party    one value per party, for the trip
 *   game     one value shared by everyone who plays the game
 *
 * A saved value is plain JSON stored with the `stateVersion` it was written
 * at and a `revision` the store bumps on every write. Shared scopes are
 * written compare-and-set: the writer names the revision it read, and a
 * write that lost the race gets the current entry back instead of replacing
 * it. See docs/games/saved-data.md.
 *
 * This file has no imports on purpose: the page, the RPC procedures and
 * `pnpm games:check` (plain Node) all load it.
 */
export type SavedJson =
    | null
    | string
    | number
    | boolean
    | SavedJson[]
    | { [key: string]: SavedJson };

export const SAVED_SCOPES = ["visitor", "party", "game"] as const;
export type SavedScope = (typeof SAVED_SCOPES)[number];

/** Largest `maxBytes` a key may declare, per scope. */
export const SAVED_MAX_BYTES: Record<SavedScope, number> = {
    visitor: 256 * 1024,
    party: 64 * 1024,
    game: 64 * 1024,
};
export const SAVED_MAX_KEYS = 16;
export const SAVED_MAX_DEPTH = 16;
export const SAVED_MAX_VERSION = 1_000_000;
const KEY = /^[a-z][a-z0-9-]{0,31}$/;
const GAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** A party's trip id, as the lobby issues it (gameParty.ts). */
const PARTY = /^[A-Za-z0-9_-]{16,80}$/;

export interface SavedKeyDeclaration {
    scope: SavedScope;
    /** The shape the game writes today. Bump it when the shape changes. */
    stateVersion: number;
    /** Limit on the value's JSON, in UTF-8 bytes. */
    maxBytes: number;
}
export type SavedDeclarations = Record<string, SavedKeyDeclaration>;

export interface SavedEntry {
    stateVersion: number;
    value: SavedJson;
    /** 1 on the first write, then one more on each write. */
    revision: number;
}

export type SavedFailure =
    | "undeclared" // the key is not in game.json
    | "invalid" // not plain JSON, or a malformed request
    | "too-large" // over the key's maxBytes
    | "revision-required" // a shared key written without ifRevision
    | "conflict" // someone else wrote first; `entry` is theirs
    | "stale-version" // an older game build writing over a newer save
    | "no-party" // a party key, but the visitor came alone
    | "sign-in-required" // guests can't write shared keys
    | "rate-limited"
    | "unavailable"; // the store could not be reached

export type SavedResult =
    | { ok: true; entry: SavedEntry | null }
    | { ok: false; reason: SavedFailure; entry?: SavedEntry | null };

export type SavedRequest =
    | { op: "get"; key: string }
    | {
          op: "set";
          key: string;
          stateVersion: number;
          value: SavedJson;
          /** The revision this write replaces; 0 means "nothing saved yet". */
          ifRevision?: number;
      }
    | { op: "remove"; key: string; ifRevision?: number };

const isInteger = (value: unknown, min: number, max: number): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max;

export const isSavedGameId = (value: unknown): value is string =>
    typeof value === "string" && GAME.test(value);
export const isSavedPartyId = (value: unknown): value is string =>
    typeof value === "string" && PARTY.test(value);

/**
 * The `saved` block of a game.json, checked. Extra fields (`sample`, `old`,
 * used by the check) are ignored here. Problems are sentences for the author.
 */
export function readSavedDeclarations(raw: unknown): {
    declared: SavedDeclarations;
    problems: string[];
} {
    const declared: SavedDeclarations = Object.create(null);
    const problems: string[] = [];
    if (raw === undefined || raw === null) return { declared, problems };
    if (typeof raw !== "object" || Array.isArray(raw)) {
        problems.push("`saved` must be an object of key declarations");
        return { declared, problems };
    }
    const entries = Object.entries(raw as Record<string, any>);
    if (entries.length > SAVED_MAX_KEYS)
        problems.push(`at most ${SAVED_MAX_KEYS} saved keys`);
    for (const [key, value] of entries.slice(0, SAVED_MAX_KEYS)) {
        if (!KEY.test(key)) {
            problems.push(
                `key "${key}": names are lowercase letters, digits and dashes, 32 at most`
            );
            continue;
        }
        const scope = value?.scope;
        if (!SAVED_SCOPES.includes(scope)) {
            problems.push(`key "${key}": scope must be visitor, party or game`);
            continue;
        }
        if (!isInteger(value.stateVersion, 1, SAVED_MAX_VERSION)) {
            problems.push(
                `key "${key}": stateVersion must be a whole number from 1`
            );
            continue;
        }
        const limit = SAVED_MAX_BYTES[scope as SavedScope];
        if (!isInteger(value.maxBytes, 1, limit)) {
            problems.push(
                `key "${key}": maxBytes must be 1 to ${limit} for the ${scope} scope`
            );
            continue;
        }
        declared[key] = {
            scope,
            stateVersion: value.stateVersion,
            maxBytes: value.maxBytes,
        };
    }
    return { declared, problems };
}

/** UTF-8 bytes of a string, without TextEncoder (Jest's jsdom lacks it). */
function utf8Length(text: string) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 0x80) bytes += 1;
        else if (code < 0x800) bytes += 2;
        else if (code >= 0xd800 && code < 0xdc00) {
            bytes += 4;
            i++;
        } else bytes += 3;
    }
    return bytes;
}

function isPlain(value: unknown, depth: number): boolean {
    if (value === null || typeof value === "boolean") return true;
    if (typeof value === "string") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value !== "object" || depth >= SAVED_MAX_DEPTH) return false;
    if (Array.isArray(value))
        return value.every((item) => isPlain(item, depth + 1));
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.entries(value as object).every(
        ([key, item]) =>
            key !== "__proto__" &&
            key !== "constructor" &&
            key !== "prototype" &&
            isPlain(item, depth + 1)
    );
}

/** The value's JSON when it is plain data within the limit, or why not. */
export function encodeSavedValue(
    value: unknown,
    maxBytes: number
): { json: string } | { reason: "invalid" | "too-large" } {
    if (!isPlain(value, 0)) return { reason: "invalid" };
    let json: string;
    try {
        json = JSON.stringify(value);
    } catch {
        return { reason: "invalid" };
    }
    if (json.length > maxBytes || utf8Length(json) > maxBytes)
        return { reason: "too-large" };
    return { json };
}

/** A request from a game, checked against what the game declared. */
export function readSavedRequest(
    declared: SavedDeclarations,
    raw: any
):
    | { request: SavedRequest; declaration: SavedKeyDeclaration }
    | { reason: SavedFailure } {
    const key = raw?.key;
    if (typeof key !== "string" || !KEY.test(key)) return { reason: "invalid" };
    const declaration = Object.hasOwn(declared, key) ? declared[key] : null;
    if (!declaration) return { reason: "undeclared" };
    const op = raw.op;
    if (op === "get") return { request: { op, key }, declaration };
    if (op !== "set" && op !== "remove") return { reason: "invalid" };
    const conditional = raw.ifRevision !== undefined && raw.ifRevision !== null;
    if (conditional && !isInteger(raw.ifRevision, 0, Number.MAX_SAFE_INTEGER))
        return { reason: "invalid" };
    // Shared values are never overwritten blind.
    if (!conditional && declaration.scope !== "visitor")
        return { reason: "revision-required" };
    const ifRevision = conditional ? (raw.ifRevision as number) : undefined;
    if (op === "remove")
        return { request: { op, key, ifRevision }, declaration };
    if (!isInteger(raw.stateVersion, 1, SAVED_MAX_VERSION))
        return { reason: "invalid" };
    const encoded = encodeSavedValue(raw.value, declaration.maxBytes);
    if ("reason" in encoded) return { reason: encoded.reason };
    return {
        request: {
            op,
            key,
            stateVersion: raw.stateVersion,
            // Through JSON, so what is stored is exactly what was measured.
            value: JSON.parse(encoded.json),
            ifRevision,
        },
        declaration,
    };
}

/**
 * Decides one write against the entry currently stored. Pure, so the local
 * store and the server transaction apply the same rule.
 */
export function applySavedWrite(
    current: SavedEntry | null,
    request: Exclude<SavedRequest, { op: "get" }>
): { result: SavedResult; next?: SavedEntry | null } {
    if (
        request.ifRevision !== undefined &&
        request.ifRevision !== (current?.revision ?? 0)
    )
        return { result: { ok: false, reason: "conflict", entry: current } };
    if (request.op === "remove")
        return { result: { ok: true, entry: null }, next: null };
    // A tab still running an older build must not downgrade a newer save.
    if (current && current.stateVersion > request.stateVersion)
        return {
            result: { ok: false, reason: "stale-version", entry: current },
        };
    const next: SavedEntry = {
        stateVersion: request.stateVersion,
        value: request.value,
        revision: (current?.revision ?? 0) + 1,
    };
    return { result: { ok: true, entry: next }, next };
}

/** Where one value lives: a game, a scope, the scope's owner and a key. */
export interface SavedSlot {
    game: string;
    scope: SavedScope;
    /** The account or guest for `visitor`, the trip id for `party`, "" for `game`. */
    owner: string;
    key: string;
}

export interface SavedStore {
    read(slot: SavedSlot): Promise<SavedResult>;
    write(
        slot: SavedSlot,
        request: Exclude<SavedRequest, { op: "get" }>
    ): Promise<SavedResult>;
}

function readEntry(text: string | null | undefined): SavedEntry | null {
    if (typeof text !== "string") return null;
    try {
        const entry = JSON.parse(text);
        if (
            isInteger(entry?.stateVersion, 0, SAVED_MAX_VERSION) &&
            isInteger(entry?.revision, 1, Number.MAX_SAFE_INTEGER) &&
            isPlain(entry.value, 0)
        )
            return {
                stateVersion: entry.stateVersion,
                value: entry.value,
                revision: entry.revision,
            };
    } catch {
        /* not ours */
    }
    return null;
}

/**
 * The three keys games had before declarations, when the page kept a few
 * strings per game under `oncyber:game:<game>:<key>` (contract 2 and
 * before). That path is gone; what a visitor saved through it still reads.
 */
const LEGACY_KEYS = ["save", "settings", "muted"];

/**
 * A store in the page's own storage: what guests use, and what development
 * uses for every scope when no server is configured. Storage calls are
 * synchronous, so compare-and-set holds between tabs of one browser.
 *
 * A visitor key with nothing saved falls back to the value the game kept
 * under the same name before declarations existed. That value is handed
 * over as `stateVersion: 0` with the raw string, for the game to migrate.
 */
export function createLocalSavedStore(
    storage:
        | Pick<Storage, "getItem" | "setItem" | "removeItem">
        | undefined = globalThis.localStorage
): SavedStore {
    const name = (slot: SavedSlot) =>
        `oncyber:game:${slot.game}:saved:${slot.scope}:${slot.owner}:${slot.key}`;
    const current = (slot: SavedSlot) =>
        readEntry(storage?.getItem(name(slot)));
    return {
        async read(slot) {
            try {
                const entry = current(slot);
                if (entry) return { ok: true, entry };
                if (slot.scope !== "visitor" || !LEGACY_KEYS.includes(slot.key))
                    return { ok: true, entry: null };
                const legacy = storage?.getItem(
                    `oncyber:game:${slot.game}:${slot.key}`
                );
                return {
                    ok: true,
                    entry:
                        typeof legacy === "string" &&
                        legacy.length <= SAVED_MAX_BYTES.visitor
                            ? { stateVersion: 0, value: legacy, revision: 0 }
                            : null,
                };
            } catch {
                return { ok: false, reason: "unavailable" };
            }
        },
        async write(slot, request) {
            try {
                if (!storage) return { ok: false, reason: "unavailable" };
                const { result, next } = applySavedWrite(
                    current(slot),
                    request
                );
                if (next === null) storage.removeItem(name(slot));
                else if (next)
                    storage.setItem(name(slot), JSON.stringify(next));
                return result;
            } catch {
                return { ok: false, reason: "unavailable" };
            }
        },
    };
}
