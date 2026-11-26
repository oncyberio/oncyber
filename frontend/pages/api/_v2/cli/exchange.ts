import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { CODE_TTL_MS } from "./authorize";

/**
 * The CLI side of the exchange in authorize.ts's flow. Deliberately
 * `auth: false` — the whole point is that the CLI process has no session to
 * authenticate with yet; the single-use code standing in for one is what
 * this validates instead. Mints the same token shape a normal browser
 * sign-in does (`accounts/authenticate/index.ts`: `{user: accountId}`,
 * 30 days) — a CLI credential is not a lesser or differently-scoped one.
 *
 * A code that was carried over by hand is taken only with the secret it was
 * bound to (`verifier`, see authorize.ts).
 */
export const exchange = proc({
    auth: false,
    cors: true,

    schema: z.object({
        code: z.string().min(1).max(200),
        // The secret a code carried over by hand was bound to (authorize.ts).
        verifier: z.string().min(43).max(128).optional(),
    }),

    async handler({ code, verifier }) {
        const ref = db.collection("cliAuthCodes").doc(code);

        return db.runTransaction(async (transaction) => {
            const doc = await transaction.get(ref);

            if (!doc.exists) {
                throw new Error("Invalid or already-used code");
            }

            const data = doc.data();

            if (data.used) {
                throw new Error("Invalid or already-used code");
            }

            if (Date.now() - data.createdAt > CODE_TTL_MS) {
                throw new Error("Code expired — run the login command again");
            }

            // A code made for one terminal answers only that terminal. The
            // refusal says nothing the code's holder did not already know.
            if (data.challenge) {
                const given = crypto
                    .createHash("sha256")
                    .update(verifier || "")
                    .digest()
                    .toString("base64url");
                // The challenge is no secret (it was in the link): a plain
                // comparison gives nothing away.
                if (!verifier || given !== data.challenge)
                    throw new Error("Invalid or already-used code");
            }

            transaction.update(ref, { used: true });

            const token = jwt.sign(
                { user: data.userId },
                process.env.SECRET_JWT_KEY,
                { expiresIn: "30d" }
            );

            return { token, userId: data.userId };
        });
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
