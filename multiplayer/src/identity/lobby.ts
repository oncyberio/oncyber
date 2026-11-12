/** Server-only attestation: account IDs and account credentials never enter lobby rosters. */
import { createHmac, timingSafeEqual } from "crypto";
const AUDIENCE = "oncyber:lobby:identity:v1";
const base64url = (value: Buffer) => value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const validLobbyPartyIdentity = (value: unknown): value is string =>
    typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
function configured(secret?: string): secret is string { return typeof secret === "string" && secret.length >= 32; }
export function lobbyPartyIdentity(uid: string, secret = process.env.LOBBY_IDENTITY_SECRET): string | undefined {
    if (!configured(secret) || typeof uid !== "string" || !uid || uid.length > 512) return undefined;
    return base64url(createHmac("sha256", secret).update(`${AUDIENCE}\0${uid}`).digest());
}
/** Lobby moderation role, decided by the account server and carried only in the signed proof. */
export type LobbyRole = "owner" | "admin";
const validRole = (value: unknown): value is LobbyRole => value === "owner" || value === "admin";
export function mintLobbyIdentity(uid: string, secret = process.env.LOBBY_IDENTITY_SECRET, now = Date.now(), role?: LobbyRole) {
    const subject = lobbyPartyIdentity(uid, secret);
    if (!subject) throw new Error("LOBBY_IDENTITY_NOT_CONFIGURED");
    const iat = Math.floor(now / 1000), expiresAt = iat + 120;
    const body = base64url(Buffer.from(JSON.stringify({ aud: AUDIENCE, sub: subject, iat, exp: expiresAt, ...(validRole(role) ? { role } : {}) })));
    return { token: `${body}.${base64url(createHmac("sha256", secret!).update(body).digest())}`, expiresAt };
}
export function verifyLobbyIdentity(token: unknown, secret = process.env.LOBBY_IDENTITY_SECRET, now = Date.now()): string | undefined {
    return verifyLobbyClaims(token, secret, now)?.sub;
}
export function verifyLobbyClaims(token: unknown, secret = process.env.LOBBY_IDENTITY_SECRET, now = Date.now()): { sub: string; role?: LobbyRole } | undefined {
    if (!configured(secret) || typeof token !== "string" || token.length > 2048) return undefined;
    const parts = token.split("."); if (parts.length !== 2) return undefined;
    const expected = Buffer.from(base64url(createHmac("sha256", secret).update(parts[0]).digest()));
    const actual = Buffer.from(parts[1]); if (actual.length !== expected.length || !timingSafeEqual(Uint8Array.from(actual), Uint8Array.from(expected))) return undefined;
    try {
        const claims = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")), seconds = Math.floor(now / 1000);
        if (claims.aud !== AUDIENCE || !validLobbyPartyIdentity(claims.sub) || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
            claims.iat > seconds + 5 || claims.exp <= seconds || claims.exp - claims.iat !== 120) return undefined;
        return { sub: claims.sub, ...(validRole(claims.role) ? { role: claims.role } : {}) };
    } catch { return undefined; }
}
