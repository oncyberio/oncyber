/** Verifies an Oncyber session JWT (HS256, signed with SECRET_JWT_KEY). */
import { createHmac, timingSafeEqual } from "crypto";

const b64url = (value: Buffer) => value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (part: string) => JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));

/** The account the token was issued to, or undefined when it does not verify. */
export function verifyOncyberToken(token: unknown, secret = process.env.SECRET_JWT_KEY, now = Date.now()): string | undefined {
    if (!secret || typeof token !== "string" || token.length > 4096) return undefined;
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    try {
        if (decode(parts[0]).alg !== "HS256") return undefined;
        const expected = Buffer.from(b64url(createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest()));
        const actual = Buffer.from(parts[2]);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
        const claims = decode(parts[1]);
        if (typeof claims.exp === "number" && claims.exp * 1000 <= now) return undefined;
        return typeof claims.user === "string" ? claims.user : undefined;
    } catch {
        return undefined;
    }
}

/** True only when `token` proves the caller is `userId`. */
export function provesUser(userId: unknown, token: unknown) {
    const verified = verifyOncyberToken(token);
    return typeof userId === "string" && !!verified && verified.toLowerCase() === userId.toLowerCase();
}
