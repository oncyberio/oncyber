import crypto from "crypto";

/** HMAC proving an anonymous draft was issued by this server. */
export async function generateHash(string) {
    const secret = process.env.ANON_EDIT_SECRET;
    if (!secret) throw new Error("ANON_EDIT_SECRET is not configured");
    return crypto.createHmac("sha256", secret).update(string).digest("hex");
}
