/**
 * World access proof: a short-lived signed statement, issued by the server
 * after a visitor entered a world's password, that the multiplayer room join
 * (multiplayer/src/identity/worldAccess.ts) and gated content reads accept
 * instead of a password.
 *
 *   wa1.<base64url JSON { x: exhibitId, r: password revision, e: expiry s }>.<base64url HMAC-SHA256>
 *
 * The revision binds the proof to the password it was issued for: a new
 * password makes every older proof invalid. The key is WORLD_ACCESS_SECRET,
 * or, when that is not set, a key derived from SECRET_JWT_KEY (which the
 * multiplayer server already has). Without either nothing is issued and
 * nothing verifies. Server only.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const WORLD_ACCESS_PROOF_PREFIX = "wa1";

/** How long a room join accepts a proof. */
export const WORLD_ACCESS_PROOF_TTL_S = 60 * 60;

/**
 * How long after expiry the gating check still takes a proof in place of
 * the password, to issue a fresh one: a visitor who stays in a world for
 * hours can rejoin its room without typing the password again. The room
 * join itself never accepts an expired proof.
 */
export const WORLD_ACCESS_RENEWAL_GRACE_S = 24 * 60 * 60;

const MAX_PROOF_LENGTH = 1024;

const DERIVATION_LABEL = "oncyber world access proof v1";

export function worldAccessKey(
    env: Record<string, string | undefined> = process.env
): Buffer | null {
    if (env.WORLD_ACCESS_SECRET) return Buffer.from(env.WORLD_ACCESS_SECRET);
    if (env.SECRET_JWT_KEY)
        return createHmac("sha256", env.SECRET_JWT_KEY)
            .update(DERIVATION_LABEL)
            .digest();
    return null;
}

const b64url = (value: Buffer) =>
    value
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

const fromB64url = (value: string) =>
    Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const sign = (key: Buffer, body: string) =>
    b64url(createHmac("sha256", key).update(body).digest());

export interface WorldAccessClaims {
    exhibitId: string;
    rev: string;
    expiresAt: number; // ms
}

export function signWorldAccessProof(
    { exhibitId, rev }: { exhibitId: string; rev: string },
    { now = Date.now(), key = worldAccessKey() } = {}
): string | null {
    if (!key || !exhibitId || !rev) return null;
    const payload = b64url(
        Buffer.from(
            JSON.stringify({
                x: exhibitId,
                r: rev,
                e: Math.floor(now / 1000) + WORLD_ACCESS_PROOF_TTL_S,
            })
        )
    );
    const body = `${WORLD_ACCESS_PROOF_PREFIX}.${payload}`;
    return `${body}.${sign(key, body)}`;
}

/**
 * The proof's claims when it is genuine and not expired (or expired less
 * than `graceMs` ago); otherwise null.
 */
export function readWorldAccessProof(
    proof: unknown,
    { now = Date.now(), key = worldAccessKey(), graceMs = 0 } = {}
): WorldAccessClaims | null {
    if (!key || typeof proof !== "string" || proof.length > MAX_PROOF_LENGTH)
        return null;
    const parts = proof.split(".");
    if (parts.length !== 3 || parts[0] !== WORLD_ACCESS_PROOF_PREFIX)
        return null;
    const expected = Buffer.from(sign(key, `${parts[0]}.${parts[1]}`));
    const actual = Buffer.from(parts[2]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        return null;
    try {
        const claims = JSON.parse(fromB64url(parts[1]).toString("utf8"));
        if (
            typeof claims?.x !== "string" ||
            typeof claims?.r !== "string" ||
            typeof claims?.e !== "number" ||
            claims.e * 1000 + graceMs <= now
        )
            return null;
        return {
            exhibitId: claims.x,
            rev: claims.r,
            expiresAt: claims.e * 1000,
        };
    } catch {
        return null;
    }
}

/** Is this a genuine, unexpired proof for this world's current password? */
export function provesWorldAccess(
    proof: unknown,
    world: { exhibitId: string; rev: string | null },
    options: { now?: number; key?: Buffer | null; graceMs?: number } = {}
) {
    const claims = readWorldAccessProof(proof, options);
    return (
        !!claims &&
        !!world.rev &&
        claims.exhibitId === world.exhibitId &&
        claims.rev === world.rev
    );
}
