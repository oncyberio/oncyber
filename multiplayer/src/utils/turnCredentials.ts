import { createHmac, randomBytes } from "crypto";

/** Coturn REST credentials: expiry stays first; a per-issuance suffix prevents
 * unrelated visitors from sharing the same username and per-user relay quota. */
export function createTurnCredentials(secret: string, ttlSeconds: number, now = Date.now()) {
    const expiresAt = Math.floor(now / 1000) + Math.floor(ttlSeconds);
    const username = `${expiresAt}:${randomBytes(16).toString("hex")}`;
    return {
        username,
        credential: createHmac("sha1", secret).update(username).digest("base64"),
    };
}
