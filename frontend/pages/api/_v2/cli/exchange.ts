import { z } from "zod";
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
 */
export const exchange = proc({
    auth: false,
    cors: true,

    schema: z.object({
        code: z.string().min(1),
    }),

    async handler({ code }) {
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
