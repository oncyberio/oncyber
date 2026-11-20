/**
 * Server half of saved data: what the RPC procedures in
 * pages/api/_v2/gameSaved do inside one transaction. Kept apart from
 * Firestore so the rules can be tested with a map.
 *
 * Who may do what:
 *   visitor  read and write: the signed-in account, its own values only
 *   party    read: anyone who knows the trip id; write: signed-in accounts
 *   game     read: anyone; write: signed-in accounts
 * Party membership cannot be proven here; the trip id is the secret, the
 * same way it names the party's room (gameParty.ts). Shared values are
 * therefore input from other players: games validate them like any other.
 */
import {
    applySavedWrite,
    isSavedGameId,
    isSavedPartyId,
    readSavedDeclarations,
    readSavedRequest,
    type SavedDeclarations,
    type SavedEntry,
    type SavedResult,
    type SavedScope,
} from "./savedData";
import declaredByGame from "./savedData.declared.json";

/** One stored value. `json` keeps the value exactly as it was measured. */
export interface SavedDoc {
    game: string;
    scope: SavedScope;
    owner: string;
    key: string;
    stateVersion: number;
    json: string;
    revision: number;
    updatedAt: number;
    updatedBy: string;
    /** Party values only: a Firestore TTL policy on this field removes them. */
    expiresAt?: Date;
}
export interface SavedQuotaDoc {
    windowStart: number;
    writes: number;
}
/** The reads and writes of one transaction. */
export interface SavedTransaction {
    getValue(id: string): Promise<SavedDoc | null>;
    setValue(id: string, doc: SavedDoc | null): void;
    getQuota(userId: string): Promise<SavedQuotaDoc | null>;
    setQuota(userId: string, doc: SavedQuotaDoc): void;
}

/** A party's values outlive its trip by a day at most. */
export const SAVED_PARTY_TTL_MS = 24 * 60 * 60 * 1000;
/** Writes one account may make across all games. */
export const SAVED_WRITES_PER_MINUTE = 60;

export function declaredSavedKeys(
    game: unknown,
    all: Record<string, unknown> = declaredByGame
): SavedDeclarations | null {
    if (!isSavedGameId(game) || !Object.hasOwn(all, game)) return null;
    return readSavedDeclarations(all[game]).declared;
}

export interface SavedCall {
    game: string;
    /** Trip id; required for party keys. */
    party?: string;
    request: unknown;
}

const docId = (game: string, scope: SavedScope, owner: string, key: string) =>
    [game, scope, encodeURIComponent(owner), key].join(":");

function entryOf(doc: SavedDoc | null, now: number): SavedEntry | null {
    if (!doc || (doc.expiresAt && doc.expiresAt.getTime() <= now)) return null;
    try {
        return {
            stateVersion: doc.stateVersion,
            value: JSON.parse(doc.json),
            revision: doc.revision,
        };
    } catch {
        return null;
    }
}

/**
 * Runs one request. `userId` is the signed-in account, or undefined for a
 * guest. Never throws for a bad request: the result says why it was refused.
 */
export async function runSavedCall(
    tx: SavedTransaction,
    call: SavedCall,
    userId: string | undefined,
    now = Date.now(),
    all?: Record<string, unknown>
): Promise<SavedResult> {
    const declared = declaredSavedKeys(call.game, all);
    if (!declared) return { ok: false, reason: "undeclared" };
    const read = readSavedRequest(declared, call.request);
    if ("reason" in read) return { ok: false, reason: read.reason };
    const { request, declaration } = read;
    const scope = declaration.scope;
    let owner = "";
    if (scope === "visitor") {
        if (!userId) return { ok: false, reason: "sign-in-required" };
        owner = userId;
    } else if (scope === "party") {
        if (!isSavedPartyId(call.party))
            return { ok: false, reason: "no-party" };
        owner = call.party;
    }
    const id = docId(call.game, scope, owner, request.key);
    if (request.op === "get")
        return { ok: true, entry: entryOf(await tx.getValue(id), now) };

    if (!userId) return { ok: false, reason: "sign-in-required" };
    // All reads before any write, as Firestore transactions require.
    const [stored, quota] = await Promise.all([
        tx.getValue(id),
        tx.getQuota(userId),
    ]);
    const windowOpen = quota && now - quota.windowStart < 60_000;
    if (windowOpen && quota.writes >= SAVED_WRITES_PER_MINUTE)
        return { ok: false, reason: "rate-limited" };
    const { result, next } = applySavedWrite(entryOf(stored, now), request);
    if (next === undefined) return result;
    tx.setQuota(userId, {
        windowStart: windowOpen ? quota.windowStart : now,
        writes: windowOpen ? quota.writes + 1 : 1,
    });
    tx.setValue(
        id,
        next && {
            game: call.game,
            scope,
            owner,
            key: request.key,
            stateVersion: next.stateVersion,
            json: JSON.stringify(next.value),
            revision: next.revision,
            updatedAt: now,
            updatedBy: userId,
            ...(scope === "party"
                ? { expiresAt: new Date(now + SAVED_PARTY_TTL_MS) }
                : {}),
        }
    );
    return result;
}
