/** @jest-environment jsdom */
import { passwordless_signIn, sendSignInLink } from "./index";
import {
    isSignInWithEmailLink,
    sendSignInLinkToEmail,
    signInWithEmailLink,
} from "firebase/auth";
import { auth } from "..";
import { describeSignInError } from "../../signInErrors";

jest.mock("..", () => ({ auth: { name: "existing-firebase-auth" } }));
jest.mock("firebase/auth", () => ({
    sendSignInLinkToEmail: jest.fn(),
    isSignInWithEmailLink: jest.fn(),
    signInWithEmailLink: jest.fn(),
}));
const send = sendSignInLinkToEmail as jest.Mock;
const isLink = isSignInWithEmailLink as jest.Mock;
const signIn = signInWithEmailLink as jest.Mock;
beforeEach(() => {
    send.mockReset();
    isLink.mockReset().mockReturnValue(true);
    signIn.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    window.localStorage.clear();
    window.history.replaceState({}, "", "/?lobby=1");
});
afterEach(() => jest.restoreAllMocks());

test("Firebase sends the trimmed address and returns to the lobby in the same browser", async () => {
    send.mockResolvedValue(undefined);
    await expect(
        sendSignInLink(" visitor+test@example.technology ")
    ).resolves.toEqual({ success: true });
    expect(send).toHaveBeenCalledWith(auth, "visitor+test@example.technology", {
        url: "http://localhost/?lobby=1",
        handleCodeInApp: true,
    });
    expect(localStorage.getItem("emailForSignIn")).toBe(
        "visitor+test@example.technology"
    );
});

test("failed delivery does not claim success or replace the saved sign-in address", async () => {
    localStorage.setItem("emailForSignIn", "previous@example.com");
    send.mockRejectedValue({ code: "auth/quota-exceeded" });
    const result = await sendSignInLink("visitor@example.com");
    expect(result.success).toBe(false);
    expect(result.message).toContain("temporarily unavailable");
    expect(localStorage.getItem("emailForSignIn")).toBe("previous@example.com");
});

test.each([
    "auth/network-request-failed",
    "auth/operation-not-allowed",
    "auth/unauthorized-continue-uri",
    "auth/too-many-requests",
])("%s remains a recoverable error", async (code) => {
    send.mockRejectedValue({ code });
    expect(await sendSignInLink("visitor@example.com")).toMatchObject({
        success: false,
        message: expect.any(String),
    });
    expect(localStorage.getItem("emailForSignIn")).toBeNull();
});

test("linking preserves its intent but removes stale one-time credentials", async () => {
    send.mockResolvedValue(undefined);
    window.history.replaceState(
        {},
        "",
        "/account?lobby=1&mode=signIn&oobCode=used&apiKey=old&lang=en"
    );
    await sendSignInLink("visitor@example.com", true);
    const next = new URL(send.mock.calls[0][2].url);
    expect(next.searchParams.get("link")).toBe("true");
    expect(next.searchParams.get("lobby")).toBe("1");
    expect(next.searchParams.has("oobCode")).toBe(false);
    expect(next.searchParams.has("apiKey")).toBe(false);
});

test("invalid input never requests email delivery", async () => {
    expect((await sendSignInLink("bad address")).success).toBe(false);
    expect(send).not.toHaveBeenCalled();
});

test.each([
    ["auth/network-request-failed", true],
    ["auth/something-new", true],
    ["auth/too-many-requests", false],
    ["auth/quota-exceeded", false],
    ["auth/operation-not-allowed", false],
])("%s: sending again can help = %s", async (code, retry) => {
    send.mockRejectedValue({ code });
    expect((await sendSignInLink("visitor@example.com")).retry).toBe(retry);
});

test("an address that is not valid is the visitor's to correct, not to retry", async () => {
    expect((await sendSignInLink("bad address")).retry).toBeUndefined();
});

describe("opening the emailed link", () => {
    const link = "/?lobby=1&mode=signIn&oobCode=code-1&apiKey=key";
    const open = (href = link) => window.history.replaceState({}, "", href);
    /** What the visitor reads when opening the link fails. */
    const failure = async () => {
        const error = await passwordless_signIn().then(
            () => null,
            (thrown) => thrown
        );
        return error && describeSignInError(error);
    };

    test("in the browser that asked for it: signs in with the stored address and cleans up", async () => {
        localStorage.setItem("emailForSignIn", "visitor@example.com");
        signIn.mockResolvedValue({ user: { uid: "u1" } });
        open(link + "&link=true");
        const credentials = await passwordless_signIn();
        expect(signIn).toHaveBeenCalledWith(
            auth,
            "visitor@example.com",
            "http://localhost" + link
        );
        expect(credentials.providerId).toBe("email");
        expect(localStorage.getItem("emailForSignIn")).toBeNull();
        // The one-time code does not stay in the address bar.
        expect(window.location.search).toBe("");
    });

    test("on another device or browser: says where to open it", async () => {
        open();
        expect(await failure()).toMatchObject({
            code: "email-link/other-device",
            message:
                "Open the link on the device and browser where you asked for it.",
            canRetry: false,
        });
        expect(signIn).not.toHaveBeenCalled();
        // Opening it there again still says the same thing.
        open();
        expect((await failure()).code).toBe("email-link/other-device");
    });

    test("a second time in the same browser: says it was already used", async () => {
        localStorage.setItem("emailForSignIn", "visitor@example.com");
        signIn.mockResolvedValue({ user: { uid: "u1" } });
        open();
        await passwordless_signIn();
        open();
        expect(await failure()).toMatchObject({
            code: "email-link/used",
            message: "This link was already used. Ask for a new one.",
        });
        expect(signIn).toHaveBeenCalledTimes(1);
        // A different link opened here was not used here.
        open(link.replace("code-1", "code-2"));
        expect((await failure()).code).toBe("email-link/other-device");
    });

    test.each([
        [
            "auth/invalid-action-code",
            "This link was already used. Ask for a new one.",
        ],
        [
            "auth/expired-action-code",
            "This link has expired. Ask for a new one.",
        ],
        [
            "auth/invalid-email",
            "This link was sent to a different email address. Ask for a new one.",
        ],
    ])(
        "Firebase refuses with %s: its own case is named",
        async (code, message) => {
            localStorage.setItem("emailForSignIn", "visitor@example.com");
            signIn.mockRejectedValue({ code });
            open();
            expect(await failure()).toMatchObject({ code, message });
            // Opening it again asks Firebase again; it is not mistaken for a
            // link from another device.
            open();
            expect((await failure()).code).toBe(code);
        }
    );

    test("a link that failed for lack of a connection works when opened again", async () => {
        localStorage.setItem("emailForSignIn", "visitor@example.com");
        signIn
            .mockRejectedValueOnce({ code: "auth/network-request-failed" })
            .mockResolvedValueOnce({ user: { uid: "u1" } });
        open();
        expect(await failure()).toMatchObject({
            code: "auth/network-request-failed",
            canRetry: true,
        });
        expect(localStorage.getItem("emailForSignIn")).toBe(
            "visitor@example.com"
        );
        open();
        expect((await passwordless_signIn()).providerId).toBe("email");
        expect(localStorage.getItem("emailForSignIn")).toBeNull();
    });

    test("a page that is not a sign-in link does nothing", async () => {
        isLink.mockReturnValue(false);
        localStorage.setItem("emailForSignIn", "visitor@example.com");
        expect(await passwordless_signIn()).toBeUndefined();
        expect(localStorage.getItem("emailForSignIn")).toBe(
            "visitor@example.com"
        );
    });
});
