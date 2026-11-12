import { z } from "zod";

import cookie from "cookie";

import { proc, NoApi } from "@utils/rpc/server";

import jwt from "jsonwebtoken";

import {
    getNonce,
    validateSig,
    verifyEth,
    verifySolana,
    verifyTezos,
} from "./utils/utils";

import { cookieSettings } from "@utils/cookieSettings";

import { isSignedInAs } from "@utils/auth/accountOwnership";

import createAccount from "./utils/createAccount";

import { fetchUserByAccountId, fetchUserByWalletId } from "../user/utils";

import { linkAccounts } from "./utils/link";

// refactor link account to user

export const authValidatorSchama = z.object({
    sig: z.object({
        type: z.string(),
        sig: z.any().optional(),
        publicKey: z.string().optional(),
    }),
    owner: z.string(),
    // zod "web3" or "web2"
    type: z.union([z.literal("web2"), z.literal("web3")]),
    linkAccount: z.string().optional(),
    providerId: z.string(),
    userMetadata: z
        .object({
            photoURL: z.string().optional(),
            displayName: z.string().optional(),
            email: z.string().optional(),
            twitterHandle: z.string().optional(),
        })
        .optional(),
    source: z.union([z.literal("current"), z.literal("target")]).optional(),
});

export const authenticate = proc({
    cors: true,

    schema: authValidatorSchama,

    async handler({ sig, owner, type, linkAccount, providerId, userMetadata }) {
        try {
            const isValid = await validateSig({ sig, owner, req: this.req });

            // Same data as before

            // Determine if it is the same address as 'owner'
            if (isValid) {
                // If the signature matches the owner supplied, create a
                // JSON web token for the owner that expires in 24 hours.

                // this is where linking should happen...

                if (linkAccount) {
                    // Only the signed-in owner of an account may link into it.
                    // merge.ts asks for the same proof (isSignedInAs).
                    if (!isSignedInAs(this.userId, linkAccount)) {
                        return {
                            success: false,
                            message: "Sign in to the account you are linking to.",
                        };
                    }

                    const resp = await linkAccounts({
                        accountToLink: owner,
                        chainType: sig.type,
                        accountId: linkAccount,
                        type,
                        providerId,
                        userMetadata,
                        token: this.token,
                    });

                    console.log("[LINK ACCOUNTS]", resp);

                    if (!resp.success) {
                        return {
                            success: false,
                            message: resp.message,
                            type: resp.type,
                            account: resp.account,
                        };
                    }

                    return {
                        success: true,
                        user: resp.account,
                    };
                }

                const { accountId, isNew } = await createAccount({
                    accountId: owner,
                    providerId,
                    type,
                    userMetadata,
                });

                // search should happen in both linked accounts first then in users
                const user = await fetchUserByAccountId(accountId, true);

                let token;

                if (sig.type !== "niftygateway") {
                    // if nitfy then skip this
                    token = jwt.sign(
                        { user: accountId },
                        process.env.SECRET_JWT_KEY,
                        {
                            expiresIn: "30d",
                        }
                    );

                    this.res.setHeader(
                        "Set-Cookie",
                        cookie.serialize(
                            accountId.toLowerCase(),
                            token,
                            cookieSettings
                        )
                    );
                } else {
                    token = sig.sig;
                }

                return { success: true, token: token, user, isNew };
            } else {
                // If the signature doesn’t match, error out

                // res.cookie("testing", JSON.stringify(token), {
                //     secure: process.env.NODE_ENV !== "development",
                //     httpOnly: true,
                //     expires: dayjs().add(30, "days").toDate(),
                // })

                // res.setHeader(
                //     'Set-Cookie',
                //     cookie.serialize('token', token, cookieSettings)
                // )

                return {
                    success: false,
                    message: "Signature did not match.",
                };
            }
        } catch (err) {
            console.error("[AUTHENTICATE ERROR]", err?.message);

            let msg =
                typeof err === "string"
                    ? err
                    : err?.message || JSON.stringify(err);

            return {
                success: false,
                message: "Failed to authenticate. " + msg,
                type: err?.cause || "generic",
            };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
