import { WalletConnection } from "@dapp/connect";

import { authServices } from "../../../components/context/AuthV2Context/utils/helpers";

type AuthProviderTypes = keyof typeof authServices;

interface Account {
    uid: string;
    createdAt: string;
    cproviders: string[];
    [x: string]:
        | {
              providerId?: "password" | "google" | "twitter";
              email?: string;
              displayName?: string;
              photoURL?: string;
              isMainProvider: boolean;
          }
        | {
              providerId: string; // wallet id
              walletId: string;
              type: "web3";
              chainType: string;
              originalWalletId: string;
              isLegacyAccount: boolean;
              isMainProvider: boolean;
          };
}

type AuthenticationHandlerParamsReturn = Promise<
    { success: true; account: any } | { success: false; message: string }
>;

interface GoogleAuthParams {
    type: "google";
}

interface TwitterAuthParams {
    type: "twitter";
}

interface PasswordlessAuthParams {
    type: "passwordless";
}

interface PasswordAuthParams {
    type: "password";
    isRegister: boolean;
    email: string;
    password: string;
}

interface Web3AuthParams {
    type: "web3";
    walletId: string;
    connection: WalletConnection;
    providerId?: string;
    linkAccount?: string;
}

export type ProvidersParams =
    | PasswordlessAuthParams
    | GoogleAuthParams
    | TwitterAuthParams
    | PasswordAuthParams
    | Web3AuthParams;

export type AuthenticationHandlerParams = ProvidersParams & {
    skipRedirectToAccount?: boolean;
    islinking?: boolean;
};
