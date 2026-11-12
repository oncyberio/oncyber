import { z } from "zod";
import crypto from "crypto";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

/**
 * Wrangler-style CLI authorization: a local CLI process can't hold your
 * session cookie, so it opens a browser to a consent page instead. That
 * page (already authenticated, normal cookie session) calls this to mint a
 * short-lived, single-use code; the browser then redirects to the CLI's own
 * localhost callback carrying that code. The CLI exchanges it for a real
 * token via `exchange.ts` — a separate call, since the CLI process itself
 * is never authenticated the way this one is.
 *
 * No scoped permissions, deliberately (per the "no need for permissions,
 * just direct connect" call) — the exchanged token is a normal 30-day
 * session token for the account that authorized it, identical in shape and
 * privilege to what a browser sign-in mints (see `accounts/authenticate`).
 * Every CLI operation still goes through the exact same per-exhibit
 * editor/owner checks as a browser session would (`get.ts`, `update.ts`,
 * `snapshot.ts`) — least-privilege by reusing existing authorization, not by
 * a new scoping system.
 */

const CODE_TTL_MS = 5 * 60 * 1000;

export const authorize = proc({
    auth: true,
    cors: true,

    schema: z.object({}),

    async handler() {
        const code = crypto.randomBytes(24).toString("base64url");

        await db.collection("cliAuthCodes").doc(code).set({
            userId: this.userId,
            createdAt: Date.now(),
            used: false,
        });

        return { code };
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;

export { CODE_TTL_MS };
