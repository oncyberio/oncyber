import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sign-in nonces are issued by the server and carried in a cookie with an
 * HMAC and expiry, so a client cannot choose the message it is asked to sign.
 */
const TTL_MS = 120_000;

function mac(value: string) {
    const secret = process.env.SECRET_JWT_KEY;
    if (!secret) throw new Error("SECRET_JWT_KEY is not configured");
    return createHmac("sha256", secret).update(value).digest("hex");
}

export function sealNonce(nonce: string, now = Date.now()) {
    const body = `${nonce}|${now + TTL_MS}`;
    return `${body}|${mac(body)}`;
}

export function openNonce(sealed: string | undefined, now = Date.now()) {
    if (typeof sealed !== "string") return null;
    const at = sealed.lastIndexOf("|");
    const body = sealed.slice(0, at);
    const given = Buffer.from(sealed.slice(at + 1));
    const expected = Buffer.from(mac(body));
    if (at < 0 || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const split = body.lastIndexOf("|");
    const expires = Number(body.slice(split + 1));
    if (!Number.isFinite(expires) || expires < now) return null;
    return body.slice(0, split);
}

/** Micheline-packed string, as wallets sign it for a Tezos login. */
export function tezosLoginPayload(nonce: string) {
    const text = Buffer.from(`Tezos Signed Message: ${nonce}`, "utf8");
    const length = text.length.toString(16).padStart(8, "0");
    return `0501${length}${text.toString("hex")}`;
}
