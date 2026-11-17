import { WalletConnection } from "@dapp/connect";

import { Signature, signEthereum, signSolana, tezosLoginPayload } from "./sign";

import AccountsApi from "@api/accounts/_api";

import { isAutographUser } from "@utils/autographAssets";

import cookie from "cookie";

import { signInWithCustomToken } from "firebase/auth";

import { auth } from "..";

import { signInErrorCode, signInErrorFor } from "../../signInErrors";

export type AuthResponse =
    | { success: true; payload: any; isAlreadyConnected?: boolean }
    // `code` names the row in ../../signInErrors the visitor is shown.
    | { success: false; message: string; code?: string };

export async function signInOrLinkWeb3({
    walletId,
    connection,
    linkAccount = "",
}: {
    walletId: string;
    connection: WalletConnection;
    linkAccount?: string;
}): Promise<AuthResponse> {
    let sig: Signature;

    let nonce: string;

    // Which step failed decides what the visitor is told.
    let stage: "nonce" | "signature" = "nonce";

    try {
        if (
            connection.type === "ethereum" ||
            connection.type === "solana" ||
            connection.type === "tezos"
        ) {
            // TODO: !MOVE TO V2 API!
            const result = await fetch("/api/user/nonce").then((res) =>
                res.json()
            );

            if (result.success) {
                nonce = result.nonce;
            } else {
                return {
                    success: false,
                    message: "Failed to retreive nonce",
                    code: "sign-in/unavailable",
                };
            }
        }

        stage = "signature";

        if (connection.type == "ethereum") {
            sig = await signEthereum(walletId, nonce, connection);
        } else if (connection.type === "solana") {
            sig = await signSolana(walletId, nonce, connection.wallet);
        } else if (connection.type === "tezos") {
            if (!connection.signPayload)
                throw signInErrorFor(
                    "wallet/cannot-sign",
                    "This Tezos wallet cannot sign in"
                );
            sig = {
                type: "tezos",
                publicKey: connection.publicKey,
                sig: await connection.signPayload(tezosLoginPayload(nonce)),
            };
        } else {
            throw signInErrorFor(
                "wallet/cannot-sign",
                "Can't authenticate to " + connection.type
            );
        }

        return {
            success: true,
            payload: {
                connection: connection,
                sig,
                accountId: walletId,
            },
        };
    } catch (err) {
        // The wallet's own error says whether the visitor closed the
        // signature request or signing really failed; keep that.
        return {
            success: false,
            message: "Failed to sign in to web3",
            code:
                stage === "nonce"
                    ? "sign-in/unavailable"
                    : signInErrorCode(err, "signature"),
        };
    }
}

export async function web3_signIn({
    walletId,
    connection,
    linkAccount = "",
}: {
    walletId: string;
    connection: WalletConnection;
    linkAccount?: string;
}) {
    if (!walletId || !connection)
        throw new Error("Missing parameters to sign in web3.");

    const response = await signInOrLinkWeb3({
        walletId,
        connection,
        linkAccount,
    });

    // only sign in when we are not linking an account
    if (response.success) {
        return { ...response, providerId: connection.type };
    }

    const failed: { message?: string; code?: string } = response as any;

    throw Object.assign(
        new Error(
            failed.message ||
                "Something went wrong authenticating web3, please try again later."
        ),
        failed.code ? { code: failed.code } : {}
    );
}
