/**
 * Room admission for password-gated worlds.
 *
 * A world's password is checked by the web API (pages/api/_v2/social/
 * checkGating), which gives the visitor a short-lived signed world access
 * proof. A join to a password-gated world's room must carry it as
 * `accessProof`; the room never sees a password.
 *
 *   wa1.<base64url JSON { x: exhibitId, r: password revision, e: expiry s }>.<base64url HMAC-SHA256>
 *
 * Same format and key as frontend/utils/worldPassword/proof.ts: the key is
 * WORLD_ACCESS_SECRET, or, when that is not set, derived from SECRET_JWT_KEY.
 * Without either, joins to password-gated worlds are refused (fail closed).
 *
 * Whether a world needs a password, and its current revision, come from the
 * web API's /world-access (cached briefly). A proof only counts for the
 * revision in force, so a new password shuts out holders of older proofs.
 */
import { createHmac, timingSafeEqual } from "crypto";
import fetch from "node-fetch";

const PREFIX = "wa1";
const MAX_PROOF_LENGTH = 1024;
const DERIVATION_LABEL = "oncyber world access proof v1";

export function worldAccessKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
    if (env.WORLD_ACCESS_SECRET) return Buffer.from(env.WORLD_ACCESS_SECRET);
    if (env.SECRET_JWT_KEY) return createHmac("sha256", env.SECRET_JWT_KEY).update(DERIVATION_LABEL).digest();
    return null;
}

const b64url = (value: Buffer) => value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (value: string) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export interface WorldAccessClaims {
    exhibitId: string;
    rev: string;
    expiresAt: number;
}

/** The proof's claims when it is genuine and unexpired; otherwise null. */
export function readWorldAccessProof(proof: unknown, key: Buffer | null = worldAccessKey(), now = Date.now()): WorldAccessClaims | null {
    if (!key || typeof proof !== "string" || proof.length > MAX_PROOF_LENGTH) return null;
    const parts = proof.split(".");
    if (parts.length !== 3 || parts[0] !== PREFIX) return null;
    const expected = Buffer.from(b64url(createHmac("sha256", key).update(`${parts[0]}.${parts[1]}`).digest()));
    const actual = Buffer.from(parts[2]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
        const claims = JSON.parse(fromB64url(parts[1]).toString("utf8"));
        if (typeof claims?.x !== "string" || typeof claims?.r !== "string" || typeof claims?.e !== "number" || claims.e * 1000 <= now) return null;
        return { exhibitId: claims.x, rev: claims.r, expiresAt: claims.e * 1000 };
    } catch {
        return null;
    }
}

/** What the web API says about a room label. */
export type WorldAccess = { exists: false } | { exists: true; id: string; password: boolean; rev: string | null };

export type WorldAccessLookup = (space: string) => Promise<WorldAccess | null>;

const API_URL = process.env.ONCYBER_API_URL || "https://oncyber.io/api";
const FETCH_TIMEOUT_MS = 5000;

/** null when the API could not answer (unreachable, challenged, not deployed). */
export const fetchWorldAccess: WorldAccessLookup = async (space) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const bypass = process.env.VERCEL_PROTECTION_BYPASS;
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;
    try {
        const response = await fetch(`${API_URL}/world-access?space=${encodeURIComponent(space)}`, { headers, timeout: FETCH_TIMEOUT_MS });
        if (!response.ok) return null;
        return parseWorldAccess(await response.json());
    } catch {
        return null;
    }
};

export function parseWorldAccess(body: any): WorldAccess | null {
    if (body?.exists === false) return { exists: false };
    if (body?.exists !== true || typeof body.id !== "string" || typeof body.password !== "boolean") return null;
    return { exists: true, id: body.id, password: body.password, rev: typeof body.rev === "string" ? body.rev : null };
}

// Fresh answers are reused briefly; the last answer for a label is kept
// (bounded) so an API outage still knows which worlds need a password.
const FRESH_MS = 15 * 1000;
const UNKNOWN_MS = 10 * 1000;
const CACHE_MAX = 2000;

type Cached = { ts: number; value: WorldAccess | null };

export type Admission = { ok: boolean; reason?: "password" | "no-secret" };

export function createWorldAdmission(lookup: WorldAccessLookup = fetchWorldAccess, clock = () => Date.now()) {
    const cache = new Map<string, Cached>();

    function remember(space: string, value: WorldAccess | null) {
        cache.delete(space);
        cache.set(space, { ts: clock(), value });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }

    async function current(space: string, force: boolean): Promise<{ value: WorldAccess | null; fresh: boolean }> {
        const hit = cache.get(space);
        const age = hit ? clock() - hit.ts : Infinity;
        if (!force && hit && age < (hit.value ? FRESH_MS : UNKNOWN_MS)) return { value: hit.value, fresh: false };
        const value = await lookup(space);
        if (value) {
            remember(space, value);
            return { value, fresh: true };
        }
        // The API did not answer: what it said last still holds.
        if (hit?.value) return { value: hit.value, fresh: false };
        remember(space, null);
        return { value: null, fresh: true };
    }

    function proves(access: WorldAccess, proof: unknown, key: Buffer | null) {
        if (!access.exists || !access.password) return true;
        const claims = readWorldAccessProof(proof, key, clock());
        return !!claims && !!access.rev && claims.exhibitId === access.id && claims.rev === access.rev;
    }

    /**
     * May this join enter the room for `space`? Unknown worlds (the API never
     * answered for this label) are admitted, as every join was before rooms
     * checked passwords: refusing them would close every room whenever the
     * API is unreachable. Known password-gated worlds need a valid proof.
     */
    async function admit(space: unknown, proof: unknown): Promise<Admission> {
        if (typeof space !== "string" || !space) return { ok: true };
        let { value, fresh } = await current(space, false);
        if (!value) return { ok: true };
        if (!value.exists || !value.password) return { ok: true };
        const key = worldAccessKey();
        if (!key) return { ok: false, reason: "no-secret" };
        if (proves(value, proof, key)) return { ok: true };
        // A proof for a password changed since the cached answer: ask again.
        if (!fresh && readWorldAccessProof(proof, key, clock())) {
            ({ value } = await current(space, true));
            if (value && proves(value, proof, key)) return { ok: true };
        }
        return { ok: false, reason: "password" };
    }

    return { admit, clear: () => cache.clear() };
}

let currentLookup: WorldAccessLookup = fetchWorldAccess;
let admission = createWorldAdmission(currentLookup);

export const admitToWorld = (space: unknown, proof: unknown) => admission.admit(space, proof);

/** Tests: answer lookups without the network. Returns the previous lookup. */
export function setWorldAccessLookup(lookup: WorldAccessLookup = fetchWorldAccess): WorldAccessLookup {
    const previous = currentLookup;
    currentLookup = lookup;
    admission = createWorldAdmission(lookup);
    return previous;
}
