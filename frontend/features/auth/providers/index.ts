import { WalletConnection } from "@dapp/connect";

import AccountsApi from "@api/accounts/_api";

import { getAuth, unlink } from "firebase/auth";

// The app alone: @utils/firebase also starts Firestore and the Database.
import { firebaseApp } from "@utils/firebaseApp";

import {
    password_link,
    password_signIn,
    passwordless_link,
    passwordless_signIn,
} from "./password";

import { web3_signIn } from "./web3";

import { google_link, google_signIn } from "./google";

import { twitter_link, twitter_signIn } from "./twitter";

import { Account, AuthenticationHandlerParams } from "../@types";

import { describeSignInError, signInError } from "../signInErrors";

export const auth = getAuth(firebaseApp);
// auth.setPersistence({ type: "LOCAL" });

export const authServices = {
    password: {
        providerId: "password",
        signIn: password_signIn,
        link: password_link,
    },
    web3: {
        providerId: null, // no providerId for web3 because it is a custom provider
        signIn: web3_signIn,
        link: web3_signIn,
    },
    google: {
        providerId: "google.com",
        signIn: google_signIn,
        link: google_link,
    },
    twitter: {
        providerId: "twitter.com",
        signIn: twitter_signIn,
        link: twitter_link,
    },
    passwordless: {
        providerId: "passwordless",
        signIn: passwordless_signIn,
        link: passwordless_link,
    },
};

/**
 * Always throws, as before: whatever a sign-in provider threw comes back as
 * an `Error` whose message is the sentence for that case and whose `code`
 * names the row in `../signInErrors`. The wording lives there, not here.
 */
export function handleFirebaseAuthErrors(error) {
    console.error(error);

    throw signInError(describeSignInError(error));
}

// export async function signOut() {
//     removeLocalUser(auth.currentUser.uid);

//     await AccountsApi.logout({});

//     auth.signOut();
// }

// export async function authHandleUnlink({ providerId, type }) {
//     if (type !== "web3") {
//         try {
//             await unlink(auth.currentUser, providerId);
//         } catch (error) {
//             handleFirebaseAuthErrors(error);
//         }
//     }

//     const account = await AccountsApi.unlink({
//         providerId: type === "web3" ? providerId : type,
//     });

//     return {
//         success: true,
//         account: account.account,
//     };
// }

function saveLocalUser({ uid, account }) {
    localStorage.setItem("account-" + uid, JSON.stringify(account));
}

function getLocalUser(uid) {
    try {
        const account = JSON.parse(localStorage.getItem("account-" + uid));

        return account;
    } catch (err) {
        return null;
    }
}

function removeLocalUser(uid) {
    localStorage.removeItem("account-" + uid);
}
