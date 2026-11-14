import {
    GithubAuthProvider,
    linkWithPopup,
    reauthenticateWithPopup,
    type UserCredential,
} from "firebase/auth";
import { auth } from "@features/auth/providers";

/**
 * Sign in with GitHub through Firebase Auth. GitHub is linked to the
 * visitor's Oncyber account (or re-confirmed if already linked), and the
 * GitHub access token Firebase returns is kept in this browser for
 * contributor mode. Firebase does not store that token.
 */
export async function signInWithGitHub(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in to Oncyber first.");
    const provider = new GithubAuthProvider();
    // Enough to fork the repository and open pull requests.
    provider.addScope("public_repo");
    let result: UserCredential;
    try {
        const linked = user.providerData.some(
            (info) => info.providerId === GithubAuthProvider.PROVIDER_ID
        );
        result = linked
            ? await reauthenticateWithPopup(user, provider)
            : await linkWithPopup(user, provider);
    } catch (error) {
        throw new Error(githubSignInMessage(error?.code) || error?.message);
    }
    const token = GithubAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new Error("GitHub didn't return a token. Try again.");
    return token;
}

export function githubSignInMessage(code?: string) {
    switch (code) {
        case "auth/operation-not-allowed":
            return "GitHub sign-in isn't turned on for this site yet. Use a token instead.";
        case "auth/credential-already-in-use":
        case "auth/account-exists-with-different-credential":
            return "That GitHub account is linked to another Oncyber account.";
        case "auth/popup-blocked":
            return "Allow pop-ups to sign in with GitHub.";
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request":
            return "Sign-in was closed.";
        case "auth/user-mismatch":
            return "That GitHub account belongs to another Oncyber account.";
        default:
            return "";
    }
}
