import {
    EmailAuthProvider,
    linkWithCredential,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithCustomToken,
    User,
    unlink,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
} from "firebase/auth";

import { auth } from "..";

import { SIGN_IN_ERRORS, signInErrorFor } from "../../signInErrors";

export async function password_signIn({
    email,
    password,
    isRegister,
}: {
    email: string;
    password: string;
    isRegister: boolean;
}) {
    const credentials = isRegister
        ? await passwordRegister_signIn({ email, password })
        : await passwordSignIn_signIn({ email, password });

    return {
        ...credentials,
        providerId: "email",
    };
}

export async function password_link({
    email,
    password,
    isRegister,
}: {
    email: string;
    password: string;
    isRegister: boolean;
}) {
    return isRegister
        ? await passwordRegister_link({ email, password })
        : await passwordSignIn_link({ email, password });
}

export async function passwordRegister_signIn({ email, password }) {
    if (!email || !password) throw new Error("Email and password required");

    return await createUserWithEmailAndPassword(auth, email, password);
}

export async function passwordRegister_link({ email, password }) {
    if (!email || !password) throw new Error("Email and password required");

    const credential = EmailAuthProvider.credential(email, password);

    return await linkWithCredential(auth.currentUser, credential);
}

export async function passwordSignIn_signIn({ email, password }) {
    if (!email || !password) throw new Error("Email and password required");

    return await signInWithEmailAndPassword(auth, email, password);
}

export async function passwordSignIn_link({ email, password }) {
    if (!email || !password) throw new Error("Email and password required");

    const credential = EmailAuthProvider.credential(email, password);

    return await linkWithCredential(auth.currentUser, credential);
}

/**
 * `retry` is set on a failure that sending again can fix (no connection, an
 * unknown hiccup). It is left out when the visitor has to change something
 * first: the address, the sign-in method, or wait.
 */
export async function sendSignInLink(
    email: string,
    isLink = false
): Promise<{ success: boolean; message?: string; retry?: boolean }> {
    const address = email.trim();
    if (!isEmail(address)) {
        return { success: false, message: "Enter a valid email address." };
    }

    const url = new URL(window.location.href);
    // A retry must not carry a previous one-time code back into the next link.
    ["apiKey", "oobCode", "mode", "lang"].forEach((key) =>
        url.searchParams.delete(key)
    );
    if (isLink) url.searchParams.set("link", "true");
    else url.searchParams.delete("link");

    try {
        await sendSignInLinkToEmail(auth, address, {
            url: url.href,
            handleCodeInApp: true,
        });
        window.localStorage.setItem("emailForSignIn", address);
        return { success: true };
    } catch (error) {
        const messages: Record<string, string> = {
            "auth/invalid-email": "Enter a valid email address.",
            "auth/network-request-failed":
                SIGN_IN_ERRORS["auth/network-request-failed"].message,
            "auth/too-many-requests":
                SIGN_IN_ERRORS["auth/too-many-requests"].message,
            "auth/quota-exceeded":
                "Email sign-in is temporarily unavailable. Please try again later or use another sign-in method.",
            "auth/operation-not-allowed":
                "Email sign-in is not enabled yet. Please use another sign-in method.",
            "auth/unauthorized-continue-uri":
                "Email sign-in isn’t available on this site yet. Please use another sign-in method.",
            "auth/unauthorized-domain":
                "Email sign-in isn’t available on this site yet. Please use another sign-in method.",
        };
        return {
            success: false,
            message:
                messages[error?.code] ||
                "Couldn’t send your sign-in link. Please try again.",
            retry:
                error?.code === "auth/network-request-failed" ||
                !messages[error?.code],
        };
    }
}

/**
 * The code of the last email link that signed in from this browser, so
 * opening the same link a second time can be told apart from opening a link
 * that was asked for somewhere else.
 */
const USED_LINK_KEY = "emailLinkUsed";

function wasUsedHere(code: string) {
    try {
        return !!code && window.localStorage.getItem(USED_LINK_KEY) === code;
    } catch {
        return false;
    }
}

function rememberUsedHere(code: string) {
    try {
        if (code) window.localStorage.setItem(USED_LINK_KEY, code);
    } catch {
        // Only the wording of a later failure depends on this.
    }
}

export async function passwordless_signIn() {
    try {
        const url = new URL(window.location.href);

        url.searchParams.delete("link");

        if (isSignInWithEmailLink(auth, url.href)) {
            let email = window.localStorage.getItem("emailForSignIn");

            const linkCode = url.searchParams.get("oobCode");

            if (!email) {
                // The address is kept by the browser that asked for the link
                // and dropped once the link has signed in there. So either
                // this link already signed in here, or it was asked for on
                // another device or browser.
                throw signInErrorFor(
                    wasUsedHere(linkCode)
                        ? "email-link/used"
                        : "email-link/other-device",
                    "Link expired. Please retry."
                );
            }

            const credentials = await signInWithEmailLink(
                auth,
                email,
                url.href
            );

            // Dropped only now, as Firebase's own example does: a link that
            // failed (no connection, expired) can be opened again and is then
            // answered by Firebase, which knows why, instead of looking like
            // a link from another device.
            window.localStorage.removeItem("emailForSignIn");

            rememberUsedHere(linkCode);

            credentials.providerId = "email";

            return credentials;
        }
    } catch (err) {
        console.log("[ PASSWORDLESS SIGNIN ERROR ]", err);
        throw err;
    } finally {
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    }
}

export async function passwordless_link() {
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem("emailForSignIn");

        if (!email) {
            email = window.prompt("Please provide your email for confirmation");
        }

        window.localStorage.removeItem("emailForSignIn");

        return await signInWithEmailLink(auth, email, window.location.href);
    }
}

function isEmail(string) {
    // Regular expression to match email addresses
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(string);
}
