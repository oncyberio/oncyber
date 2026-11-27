/**
 * What a link to the terminal sign-in page (pages/cli-auth.tsx) asks for.
 *
 * A terminal on this machine gives a `callback` on localhost and is handed
 * the single-use code by a redirect. A terminal somewhere else (a coding
 * agent in the cloud, a machine reached over SSH) cannot be redirected to,
 * so it gives a `challenge` instead and the page shows the code to carry
 * over by hand. That code is worth nothing without the secret the
 * challenge was made from, which never left that terminal
 * (pages/api/_v2/cli/exchange.ts).
 */
export type CliAuthRequest =
    | { kind: "callback"; callback: string; state: string }
    | { kind: "code"; challenge: string }
    | { kind: "invalid" };

/** A SHA-256 digest in base64url: what a challenge is. */
export const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

function isLoopbackCallback(raw: string): boolean {
    try {
        const url = new URL(raw);
        return (
            (url.protocol === "http:" || url.protocol === "https:") &&
            ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
        );
    } catch {
        return false;
    }
}

const one = (value: unknown) => (typeof value === "string" ? value : "");

export function readCliAuthRequest(
    query: Record<string, unknown>
): CliAuthRequest {
    const callback = one(query.callback);
    const challenge = one(query.challenge);
    // One or the other: a link that names both is not one we made.
    if (callback && challenge) return { kind: "invalid" };
    if (callback)
        return isLoopbackCallback(callback)
            ? { kind: "callback", callback, state: one(query.state) }
            : { kind: "invalid" };
    return CHALLENGE.test(challenge)
        ? { kind: "code", challenge }
        : { kind: "invalid" };
}
