import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { auth, db, fire } from "@utils/firebaseAdmin";
import { forceMergeAccount, unlinkAccount } from "./authenticate/utils/link";
import { authValidatorSchama } from "./authenticate";
import { validateSig } from "./authenticate/utils/utils";
import { isSignedInAs } from "@utils/auth/accountOwnership";
import { fetchUserByWalletId } from "./user/utils";
// import { setRefreshAndTokenCookie, AUTH_COOKIE } from "./utils/cookie";

export const merge = proc({
    cors: true,
    auth: true,
    schema: authValidatorSchama,
    async handler({
        sig,
        owner,
        type,
        linkAccount,
        providerId,
        userMetadata,
        source,
    }) {
        try {
            const uid = this.userId;

            // A merge rewrites `linkAccount` and deletes `owner`, so the
            // caller has to prove both: the session names the account being
            // merged INTO (the same proof linking asks for), and the
            // signature below proves control of the account being merged in.
            if (!isSignedInAs(uid, linkAccount)) {
                return {
                    success: false,
                    message: "Sign in to the account you are merging into.",
                };
            }

            const isValid = await validateSig({ sig, owner, req: this.req });

            if (!isValid)
                return { success: false, message: "Failed to merge accounts." };

            const response = await forceMergeAccount({
                signedInAccountId: uid,
                sourceMetadata:
                    type === "web2"
                        ? {
                              providerId,
                              type,
                              accountId: owner.toLowerCase(),
                              ...userMetadata,
                          }
                        : {
                              providerId,
                              type,
                              accountId: owner.toLowerCase(),
                              chainType: sig.type,
                              originalWalletId: owner,
                          },
                sourceAccountId: owner,
                destinationAccountId: linkAccount,
                source,
                token: this.token,
            });

            if (!response.success) {
                throw new Error("Failed to merge accounts.");
            }

            // fetch user by account id
            // const user = await fetchUserByWalletId(
            //     linkAccount.toLowerCase(),
            //     true
            // );

            return {
                success: true,
                // user,
            };
        } catch (err) {
            console.log("[ MERGE ERROR ]", err);

            const isLimitExceeded =
                err.message ===
                "3 INVALID_ARGUMENT: maximum 500 writes allowed per request";

            return {
                success: false,
                message: isLimitExceeded ? "LIMIT_EXCEEDED" : err.message,
            };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
