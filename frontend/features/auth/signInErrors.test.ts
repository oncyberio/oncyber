import {
    describeSignInError,
    describeSignInResponse,
    isRequestRejected,
    SIGN_IN_ERRORS,
    SIGN_IN_FAILED,
    signInError,
    signInErrorCode,
    signInErrorFor,
} from "./signInErrors";

const GENERAL =
    "Couldn’t sign you in. Try again, or choose another way to sign in.";

describe("what the visitor reads, by what was thrown", () => {
    // [what happened, the error as the provider throws it, stage, sentence,
    //  cancelled, Retry offered]
    test.each([
        [
            "MetaMask: the connection request was closed",
            { code: 4001, message: "User rejected the request." },
            "connect",
            "You closed the wallet request.",
            true,
            false,
        ],
        [
            "MetaMask: the signature request was closed",
            {
                code: 4001,
                message:
                    "MetaMask Message Signature: User denied message signature.",
            },
            "signature",
            "You closed the signature request.",
            true,
            false,
        ],
        [
            "WalletConnect: the QR window was closed",
            { name: "UserRejectedRequestError", message: "Rejected" },
            "connect",
            "You closed the wallet request.",
            true,
            false,
        ],
        [
            "WalletConnect: no account came back",
            new Error("DENIED"),
            "connect",
            "You closed the wallet request.",
            true,
            false,
        ],
        [
            "Tezos: the Beacon window was closed",
            { message: "[ABORTED_ERROR]:The action was aborted by the user." },
            "signature",
            "You closed the signature request.",
            true,
            false,
        ],
        [
            "Solana: the wallet refused, code on the inner error",
            { name: "WalletSignMessageError", error: { code: 4001 } },
            "signature",
            "You closed the signature request.",
            true,
            false,
        ],
        [
            "ethers: the request was refused",
            { code: "ACTION_REJECTED" },
            "sign-in",
            "You closed the wallet request.",
            true,
            false,
        ],
        [
            "Google or Twitter: the window was closed",
            { code: "auth/popup-closed-by-user" },
            "sign-in",
            "You closed the sign-in window.",
            true,
            false,
        ],
        [
            "a second window replaced the first",
            { code: "auth/cancelled-popup-request" },
            "sign-in",
            "You closed the sign-in window.",
            true,
            false,
        ],
        [
            "the wallet is not installed",
            { code: "wallet/not-installed", message: "Metamask is not…" },
            "connect",
            "That wallet isn’t installed in this browser. Install it, or choose another way to sign in.",
            false,
            false,
        ],
        [
            "the wallet already shows a request",
            { code: -32002, message: "Request already pending" },
            "connect",
            "Your wallet already has a request open. Open your wallet to finish it.",
            false,
            true,
        ],
        [
            "WalletConnect timed out",
            { code: "wallet/timeout" },
            "connect",
            "Your wallet didn’t answer in time. Try again.",
            false,
            true,
        ],
        [
            "the wallet cannot sign messages",
            { code: "wallet/cannot-sign" },
            "signature",
            "This wallet can’t sign messages, so it can’t sign you in. Choose another wallet.",
            false,
            false,
        ],
        [
            "the sign-in could not be started",
            { code: "sign-in/unavailable" },
            "sign-in",
            "Couldn’t start signing you in. Check your connection and try again.",
            false,
            true,
        ],
        [
            "email link: already used",
            { code: "auth/invalid-action-code" },
            "sign-in",
            "This link was already used. Ask for a new one.",
            false,
            false,
        ],
        [
            "email link: opened again in the same browser",
            { code: "email-link/used" },
            "sign-in",
            "This link was already used. Ask for a new one.",
            false,
            false,
        ],
        [
            "email link: really expired",
            { code: "auth/expired-action-code" },
            "sign-in",
            "This link has expired. Ask for a new one.",
            false,
            false,
        ],
        [
            "email link: opened on another device or browser",
            { code: "email-link/other-device" },
            "sign-in",
            "Open the link on the device and browser where you asked for it.",
            false,
            false,
        ],
        [
            "email link: asked for with another address",
            { code: "auth/invalid-email" },
            "sign-in",
            "This link was sent to a different email address. Ask for a new one.",
            false,
            false,
        ],
        [
            "the browser blocked the window",
            { code: "auth/popup-blocked" },
            "sign-in",
            "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.",
            false,
            true,
        ],
        [
            "no connection",
            { code: "auth/network-request-failed" },
            "sign-in",
            "Couldn’t connect. Check your connection and try again.",
            false,
            true,
        ],
        [
            "too many attempts",
            { code: "auth/too-many-requests" },
            "sign-in",
            "Too many attempts. Try again in a few minutes.",
            false,
            false,
        ],
        [
            "the account is disabled",
            { code: "auth/user-disabled" },
            "sign-in",
            "This account has been disabled. Contact us on Discord for help.",
            false,
            false,
        ],
        [
            "the email belongs to another sign-in method",
            { code: "auth/account-exists-with-different-credential" },
            "sign-in",
            "This email already signs in another way. Use the way you signed up with.",
            false,
            false,
        ],
        [
            "the session ran out",
            { code: "auth/user-token-expired" },
            "sign-in",
            "Your session has expired. Sign in again.",
            false,
            true,
        ],
    ])("%s", (_name, error, stage, message, cancelled, canRetry) => {
        const described = describeSignInError(error, stage as any);
        expect(described.message).toBe(message);
        expect(described.cancelled).toBe(cancelled);
        expect(described.canRetry).toBe(canRetry);
        expect(SIGN_IN_ERRORS[described.code]).toBeDefined();
    });

    test("every code the old handler knew still has its own sentence", () => {
        for (const code of [
            "auth/credential-already-in-use",
            "auth/invalid-user-token",
            "auth/network-request-failed",
            "auth/email-already-in-use",
            "auth/wrong-password",
            "auth/requires-recent-login",
            "auth/user-token-expired",
            "auth/no-such-provider",
            "auth/user-not-found",
            "auth/user-disabled",
            "auth/too-many-requests",
            "auth/popup-closed-by-user",
        ]) {
            expect(describeSignInError({ code }).code).toBe(code);
            expect(describeSignInError({ code }).message).not.toBe(GENERAL);
        }
    });

    test("no sentence is the bare “Something went wrong”, asks to “please wait” or shouts", () => {
        for (const [code, row] of Object.entries(SIGN_IN_ERRORS)) {
            expect(row.message).not.toMatch(/something went wrong/i);
            expect(row.message).not.toMatch(/please/i);
            expect(row.message).toMatch(/^[A-Z].*\.$/);
            // A cancellation is never offered a Retry: it was a choice.
            if (row.cancelled)
                expect([code, row.retry]).toEqual([code, undefined]);
        }
    });
});

describe("errors nobody mapped", () => {
    test("get the general sentence for the stage, with the provider’s own code or first line", () => {
        expect(describeSignInError({ code: "auth/internal-error" })).toEqual({
            code: SIGN_IN_FAILED,
            message: `${GENERAL} (auth/internal-error)`,
            cancelled: false,
            canRetry: true,
        });
        expect(
            describeSignInError(
                new Error("DApp interaction is disabled\nstack…"),
                "connect"
            )
        ).toMatchObject({
            code: "wallet/connect-failed",
            message:
                "Couldn’t connect to your wallet. Try again, or choose another way to sign in. (DApp interaction is disabled)",
            canRetry: true,
        });
        expect(
            describeSignInError(
                { code: -32603, message: "Internal" },
                "signature"
            )
        ).toMatchObject({
            code: "wallet/signature-failed",
            message:
                "Your wallet couldn’t sign the message. Try again. (Internal)",
        });
    });

    test("say only the general sentence when there is nothing to add", () => {
        for (const nothing of [undefined, null, {}, new Error("")])
            expect(describeSignInError(nothing).message).toBe(GENERAL);
    });

    test("a long provider message is cut, not dumped on the visitor", () => {
        const { message } = describeSignInError(new Error("x".repeat(400)));
        expect(message.length).toBeLessThan(GENERAL.length + 130);
        expect(message.endsWith("…)")).toBe(true);
    });
});

describe("carrying a failure up to where it is shown", () => {
    test("an error that was described keeps its sentence and code", () => {
        const first = describeSignInError({ code: "auth/internal-error" });
        const thrown: any = signInError(first);
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.message).toBe(first.message);
        expect(thrown.code).toBe(SIGN_IN_FAILED);
        // Described again (the outer catch): the same thing, detail included.
        expect(describeSignInError(thrown)).toBe(first);
    });

    test("an error made for a row is recognised by its code, whatever its text", () => {
        const thrown: any = signInErrorFor(
            "email-link/other-device",
            "Link expired. Please retry."
        );
        expect(thrown.message).toBe("Link expired. Please retry.");
        expect(describeSignInError(thrown).message).toBe(
            "Open the link on the device and browser where you asked for it."
        );
        expect(signInErrorCode(thrown)).toBe("email-link/other-device");
    });

    test("only a refusal counts as the visitor closing a request", () => {
        expect(isRequestRejected({ code: 4001 })).toBe(true);
        expect(isRequestRejected({ code: "4001" })).toBe(true);
        expect(isRequestRejected({ code: 4900 })).toBe(false);
        expect(isRequestRejected(new Error("Failed to fetch"))).toBe(false);
        expect(isRequestRejected(undefined)).toBe(false);
    });
});

describe("a sign-in that came back unsuccessful", () => {
    test("one that was described is shown as described", () => {
        expect(
            describeSignInResponse({
                success: false,
                message: "You closed the signature request.",
                type: "",
                code: "wallet/signature-rejected",
                cancelled: true,
                canRetry: false,
            } as any)
        ).toEqual({
            code: "wallet/signature-rejected",
            message: "You closed the signature request.",
            cancelled: true,
            canRetry: false,
        });
    });

    test("our API’s own refusal keeps its message; linking refusals offer no Retry", () => {
        expect(
            describeSignInResponse({ message: "Signature did not match." })
        ).toEqual({
            code: SIGN_IN_FAILED,
            message: "Signature did not match.",
            cancelled: false,
            canRetry: true,
        });
        expect(
            describeSignInResponse({
                message: "Account 0xabc already exists",
                type: "link:account-exists",
            })
        ).toEqual({
            code: "link:account-exists",
            message: "Account 0xabc already exists",
            cancelled: false,
            canRetry: false,
        });
    });

    test("nothing at all still says something useful", () => {
        expect(describeSignInResponse(null).message).toBe(GENERAL);
        expect(describeSignInResponse({}).message).toBe(GENERAL);
    });
});
