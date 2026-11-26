/**
 * Signing a terminal in when no browser can reach it: `login --code` of
 * world-cli.mjs, for a coding agent in the cloud or a machine over SSH.
 *
 * The usual `login` waits for the browser to call back on localhost. Here
 * the terminal prints a link instead; the person opens it, approves, and
 * carries the code it shows back to the terminal. The link names a
 * challenge, the SHA-256 of a secret that stays on this machine, and the
 * server trades the code for a session only together with that secret
 * (frontend/pages/api/_v2/cli/exchange.ts). So the code can pass through a
 * chat or a clipboard: seen by anyone else, it is worth nothing.
 */
import { createHash, randomBytes } from "node:crypto";

export const challengeOf = (verifier) =>
    createHash("sha256").update(verifier).digest("base64url");

/** A new sign-in: the secret to keep and the challenge to send. */
export function newLogin(now = Date.now()) {
    const verifier = randomBytes(32).toString("base64url");
    return { verifier, challenge: challengeOf(verifier), startedAt: now };
}

export function loginLink(baseUrl, challenge) {
    const link = new URL("/cli-auth", baseUrl);
    link.searchParams.set("challenge", challenge);
    return link.toString();
}

/** As long as the server keeps a code, and a little for the person. */
export const PENDING_LOGIN_MS = 15 * 60 * 1000;

/**
 * The sign-in a code belongs to, or why there is none: it must have been
 * started here, for this deployment, not long ago.
 */
export function pendingLogin(saved, baseUrl, now = Date.now()) {
    if (!saved?.verifier)
        return {
            error: "No sign-in was started here. Run `login --code` first.",
        };
    if (saved.baseUrl !== baseUrl)
        return {
            error: `The sign-in started here was for ${saved.baseUrl}, not ${baseUrl}. Run \`login --code\` again.`,
        };
    if (now - saved.startedAt > PENDING_LOGIN_MS)
        return { error: "That sign-in is too old. Run `login --code` again." };
    return { verifier: saved.verifier };
}
