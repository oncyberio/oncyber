/**
 * What a visitor reads when signing in does not finish.
 *
 * Every way of signing in (a wallet prompt, a Google or Twitter window, an
 * email link) ends up here. A failure is matched to a row of `SIGN_IN_ERRORS`
 * by its code, never by its message text where a code exists, so the same
 * thing is always said the same way. See docs/feedback.md for where the
 * sentence is shown.
 *
 * To add a case: give the error a `code` where it is thrown (or use the code
 * the provider already sends) and add a row for it.
 */

export interface SignInFailure {
    /** The row that matched: a Firebase code or one of the codes below. */
    code: string;
    /** One plain sentence: what happened and, for a failure, what to do. */
    message: string;
    /**
     * The visitor closed or refused a request. That is their choice, so it is
     * said quietly and never as an error.
     */
    cancelled: boolean;
    /** Running the same action again can succeed. */
    canRetry: boolean;
}

interface Row {
    message: string;
    cancelled?: true;
    retry?: true;
}

const CLOSED_WINDOW: Row = {
    message: "You closed the sign-in window.",
    cancelled: true,
};
const LINK_USED: Row = {
    message: "This link was already used. Ask for a new one.",
};
const SESSION_EXPIRED: Row = {
    message: "Your session has expired. Sign in again.",
    retry: true,
};

/** Used when nothing more specific is known. */
export const SIGN_IN_FAILED = "sign-in/failed";

export const SIGN_IN_ERRORS: Record<string, Row> = {
    // The visitor closed or refused a request.
    "wallet/request-rejected": {
        message: "You closed the wallet request.",
        cancelled: true,
    },
    "wallet/signature-rejected": {
        message: "You closed the signature request.",
        cancelled: true,
    },
    "auth/popup-closed-by-user": CLOSED_WINDOW,
    "auth/cancelled-popup-request": CLOSED_WINDOW,
    "auth/user-cancelled": {
        message: "You cancelled the sign-in.",
        cancelled: true,
    },

    // Wallets.
    "wallet/not-installed": {
        message:
            "That wallet isn’t installed in this browser. Install it, or choose another way to sign in.",
    },
    "wallet/request-pending": {
        message:
            "Your wallet already has a request open. Open your wallet to finish it.",
        retry: true,
    },
    "wallet/timeout": {
        message: "Your wallet didn’t answer in time. Try again.",
        retry: true,
    },
    "wallet/cannot-sign": {
        message:
            "This wallet can’t sign messages, so it can’t sign you in. Choose another wallet.",
    },
    "wallet/connect-failed": {
        message:
            "Couldn’t connect to your wallet. Try again, or choose another way to sign in.",
        retry: true,
    },
    "wallet/signature-failed": {
        message: "Your wallet couldn’t sign the message. Try again.",
        retry: true,
    },
    "sign-in/unavailable": {
        message:
            "Couldn’t start signing you in. Check your connection and try again.",
        retry: true,
    },

    // Email links. Opening the same link again cannot work, so no retry.
    "auth/invalid-action-code": LINK_USED,
    "email-link/used": LINK_USED,
    "auth/expired-action-code": {
        message: "This link has expired. Ask for a new one.",
    },
    "email-link/other-device": {
        message:
            "Open the link on the device and browser where you asked for it.",
    },
    "auth/invalid-email": {
        message:
            "This link was sent to a different email address. Ask for a new one.",
    },

    // Google, Twitter and the account behind them.
    "auth/popup-blocked": {
        message:
            "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.",
        retry: true,
    },
    "auth/network-request-failed": {
        message: "Couldn’t connect. Check your connection and try again.",
        retry: true,
    },
    "auth/too-many-requests": {
        message: "Too many attempts. Try again in a few minutes.",
    },
    "auth/user-disabled": {
        message:
            "This account has been disabled. Contact us on Discord for help.",
    },
    "auth/account-exists-with-different-credential": {
        message:
            "This email already signs in another way. Use the way you signed up with.",
    },
    "auth/credential-already-in-use": {
        message: "This account is already linked to another account.",
    },
    "auth/email-already-in-use": {
        message: "This email is already in use.",
    },
    "auth/wrong-password": { message: "Wrong password." },
    "auth/invalid-user-token": SESSION_EXPIRED,
    "auth/requires-recent-login": SESSION_EXPIRED,
    "auth/user-token-expired": SESSION_EXPIRED,
    "auth/no-such-provider": {
        message: "That sign-in method isn’t linked, or was already unlinked.",
    },
    "auth/user-not-found": { message: "We couldn’t find that account." },
    "auth/operation-not-allowed": {
        message:
            "That sign-in method isn’t available right now. Choose another one.",
    },

    // Anything else.
    [SIGN_IN_FAILED]: {
        message:
            "Couldn’t sign you in. Try again, or choose another way to sign in.",
        retry: true,
    },
};

/** Where in signing in the error was thrown, when the caller knows. */
export type SignInStage = "connect" | "signature" | "sign-in";

/** The row used when an error carries nothing we recognise. */
const FALLBACK: Record<SignInStage, string> = {
    connect: "wallet/connect-failed",
    signature: "wallet/signature-failed",
    "sign-in": SIGN_IN_FAILED,
};

/** Beacon (Tezos) puts its error type in front: `[ABORTED_ERROR]:…`. */
function beaconErrorType(error: any): string {
    const match = /^\[([A-Z_]+)\]:/.exec(String(error?.message || ""));
    return match ? match[1] : "";
}

/**
 * True when the visitor closed or refused a wallet request. Wallets report
 * this with EIP-1193 code 4001; the others are the equivalents the wallet
 * libraries in use here send.
 */
export function isRequestRejected(error: any): boolean {
    const code = error?.code ?? error?.error?.code ?? error?.cause?.code;
    if (code == 4001 || code === "ACTION_REJECTED") return true;
    if (
        error?.name === "UserRejectedRequestError" ||
        error?.name === "WalletWindowClosedError"
    )
        return true;
    if (beaconErrorType(error) === "ABORTED_ERROR") return true;
    // No code on these two: our own WalletConnect marker, and wallets that
    // only send the standard sentence.
    return (
        error?.message === "DENIED" ||
        !!error?.message?.includes?.("User rejected the request")
    );
}

/** The row of `SIGN_IN_ERRORS` an error belongs to. */
export function signInErrorCode(
    error: any,
    stage: SignInStage = "sign-in"
): string {
    const code = error?.code;
    if (typeof code === "string" && SIGN_IN_ERRORS[code]) return code;
    if (isRequestRejected(error))
        return stage === "signature"
            ? "wallet/signature-rejected"
            : "wallet/request-rejected";
    // EIP-1193: a request of this kind is already waiting in the wallet.
    if (code === -32002) return "wallet/request-pending";
    if (error?.name === "WalletNotReadyError") return "wallet/not-installed";
    return FALLBACK[stage] || SIGN_IN_FAILED;
}

function failure(code: string, detail = ""): SignInFailure {
    const row = SIGN_IN_ERRORS[code] || SIGN_IN_ERRORS[SIGN_IN_FAILED];
    return {
        code,
        message: detail ? `${row.message} (${detail})` : row.message,
        cancelled: !!row.cancelled,
        canRetry: !!row.retry,
    };
}

/** The provider's own code or first line, kept so support can tell cases apart. */
function detailOf(error: any): string {
    const raw =
        typeof error === "string"
            ? error
            : (typeof error?.code === "string" && error.code) ||
              error?.message ||
              "";
    const line = String(raw).split("\n")[0].trim();
    return line.length > 120 ? line.slice(0, 119) + "…" : line;
}

/**
 * Turns anything thrown while signing in into what the visitor reads.
 * An error that was already described (see `signInError`) is returned as is.
 */
export function describeSignInError(
    error: any,
    stage: SignInStage = "sign-in"
): SignInFailure {
    if (error?.signInFailure) return error.signInFailure;
    const code = signInErrorCode(error, stage);
    const recognised =
        code !== FALLBACK[stage] || (error && error.code === code);
    return failure(code, recognised ? "" : detailOf(error));
}

/** An `Error` to throw that keeps its description on the way up. */
export function signInError(described: SignInFailure): Error {
    return Object.assign(new Error(described.message), {
        code: described.code,
        signInFailure: described,
    });
}

/** An `Error` for one row of the table, thrown where the case is detected. */
export function signInErrorFor(code: string, message?: string): Error {
    return Object.assign(
        new Error(message || SIGN_IN_ERRORS[code]?.message || code),
        { code }
    );
}

/**
 * What the visitor reads for a sign-in that came back unsuccessful: either
 * one described above, or a refusal from our own API, whose message is kept
 * because it says more than we can (which account is already linked, …).
 */
export function describeSignInResponse(response: {
    message?: string;
    type?: string;
    code?: string;
    cancelled?: boolean;
    canRetry?: boolean;
}): SignInFailure {
    if (response?.code && SIGN_IN_ERRORS[response.code])
        return {
            code: response.code,
            message: response.message || SIGN_IN_ERRORS[response.code].message,
            cancelled:
                response.cancelled ?? !!SIGN_IN_ERRORS[response.code].cancelled,
            canRetry:
                response.canRetry ?? !!SIGN_IN_ERRORS[response.code].retry,
        };
    const type = response?.type || "";
    return {
        code: type || SIGN_IN_FAILED,
        message: response?.message || SIGN_IN_ERRORS[SIGN_IN_FAILED].message,
        cancelled: false,
        // Linking refusals need a decision (merge, another account), not a retry.
        canRetry: !type.startsWith("link:"),
    };
}
