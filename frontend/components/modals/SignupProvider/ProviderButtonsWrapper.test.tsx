/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ProviderButtonsWrapper } from "./ProviderButtonsWrapper";
import { UserContext } from "@components/context/UserContext";
import { sendSignInLink } from "@features/auth/providers/password";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("./useProviderButtons", () => ({
    useProviderButtons: (onConnect) => {
        const [error, setError] = require("react").useState("");
        return { error, setError, isConnecting: {}, onConnectClick: onConnect };
    },
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@api/accounts/_api", () => ({}), { virtual: true });
jest.mock("@features/auth/providers/password", () => ({
    sendSignInLink: jest.fn(),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let state: any;
function Probe(props: any) {
    state = props;
    return null;
}
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    (sendSignInLink as jest.Mock).mockReset();
    act(() =>
        root.render(
            <ProviderButtonsWrapper>
                <Probe />
            </ProviderButtonsWrapper>
        )
    );
    act(() => state.setEmail("visitor@example.com"));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("pending is distinct from success and duplicate sends are blocked", async () => {
    let finish: Function;
    (sendSignInLink as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    let pending: Promise<void>;
    act(() => {
        pending = state.handleSendEmailLink();
        state.handleSendEmailLink();
    });
    expect(state.sendingEmailLink).toBe(true);
    expect(state.emailSuccess).toBe(false);
    expect(sendSignInLink).toHaveBeenCalledTimes(1);
    await act(async () => {
        finish({ success: true });
        await pending;
    });
    expect(state.emailSuccess).toBe(true);
    expect(state.sendingEmailLink).toBe(false);
    expect(state.email).toBe("visitor@example.com");
    act(() => state.resetEmailLink());
    expect(state.emailSuccess).toBe(false);
    expect(state.email).toBe("visitor@example.com");
});

test("provider rejection returns to the editable form and retry can succeed", async () => {
    (sendSignInLink as jest.Mock)
        .mockResolvedValueOnce({ success: false, message: "Email unavailable" })
        .mockResolvedValueOnce({ success: true });
    await act(async () => state.handleSendEmailLink());
    expect(state.emailSuccess).toBe(false);
    expect(state.sendingEmailLink).toBe(false);
    expect(state.error).toBe("Email unavailable");
    await act(async () => state.handleSendEmailLink());
    expect(state.emailSuccess).toBe(true);
    expect(state.error).toBe("");
});

test("unexpected exceptions also release pending state without confirming delivery", async () => {
    (sendSignInLink as jest.Mock).mockRejectedValue(new Error("unexpected"));
    await act(async () => state.handleSendEmailLink());
    expect(state.emailSuccess).toBe(false);
    expect(state.sendingEmailLink).toBe(false);
    expect(state.error).toContain("Couldn’t send");
});


test.each(["google", "wallet"])("%s login updates the active session without navigation", async (method) => {
    const dispatch = jest.fn();
    const user = { id: "visitor", username: "visitor", exhibit: { id: "space" } };
    const authHandler = jest.fn().mockResolvedValue({
        success: true, accountId: user.id, token: "test-token", user,
    });
    const authCallback = jest.fn();
    act(() => root.render(
        <UserContext.Provider value={{ authHandler, dispatch } as any}>
            <ProviderButtonsWrapper authCallback={authCallback}>
                <Probe />
            </ProviderButtonsWrapper>
        </UserContext.Provider>
    ));
    await act(async () => {
        if (method === "wallet") {
            await state.onConnectClick({ type: "ethereum", walletId: "0x123" });
        } else {
            await state.authWeb2AfterConnect("google");
        }
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
            authenticated: true, user: { id: "visitor" }, token: "test-token",
            userData: { id: "visitor", username: "visitor" },
        }),
    }));
    expect(authCallback).toHaveBeenCalledTimes(1);
    expect(state.web2Loading).toBe("");
});

describe("a sign-in that does not finish", () => {
    const NO_CONNECTION = {
        success: false,
        message: "Couldn’t connect. Check your connection and try again.",
        type: "",
        code: "auth/network-request-failed",
        cancelled: false,
        canRetry: true,
    };
    const signedIn = {
        success: true,
        accountId: "visitor",
        token: "test-token",
        user: { id: "visitor" },
    };
    function renderWith(authHandler: jest.Mock, props: any = {}) {
        act(() =>
            root.render(
                <UserContext.Provider
                    value={{ authHandler, dispatch: jest.fn() } as any}
                >
                    <ProviderButtonsWrapper {...props}>
                        <Probe />
                    </ProviderButtonsWrapper>
                </UserContext.Provider>
            )
        );
    }

    test("the failure is kept with the button that was used, and Retry runs that sign-in again", async () => {
        const authHandler = jest
            .fn()
            .mockResolvedValueOnce(NO_CONNECTION)
            .mockResolvedValueOnce(signedIn);
        renderWith(authHandler);
        await act(async () => state.authWeb2AfterConnect("google"));
        expect(state.error).toBe(NO_CONNECTION.message);
        expect(state.signInFailure).toEqual({
            code: "auth/network-request-failed",
            message: NO_CONNECTION.message,
            cancelled: false,
            canRetry: true,
            source: "google",
        });

        await act(async () => state.retrySignIn());
        expect(authHandler).toHaveBeenCalledTimes(2);
        expect(authHandler.mock.calls[1][0]).toMatchObject({ type: "google" });
        expect(state.signInFailure).toBeNull();
        expect(state.error).toBe("");
        expect(state.retrySignIn).toBeUndefined();
    });

    test("closing the wallet’s signature request is said quietly: no error, no Retry", async () => {
        const authHandler = jest.fn().mockResolvedValue({
            success: false,
            message: "You closed the signature request.",
            type: "",
            code: "wallet/signature-rejected",
            cancelled: true,
            canRetry: false,
        });
        renderWith(authHandler);
        await act(async () =>
            state.onConnectClick({
                type: "ethereum",
                walletId: "0x123",
                provider: "metamask",
            })
        );
        expect(state.error).toBe("");
        expect(state.signInFailure).toMatchObject({
            message: "You closed the signature request.",
            cancelled: true,
            source: "metamask",
        });
        expect(state.retrySignIn).toBeUndefined();
    });

    test("a refusal from our API keeps its own words, and a linking refusal still opens the merge step", async () => {
        const refusal = {
            success: false,
            message: "Account 0xabc is already linked to another user",
            type: "link:account-exists",
            authPayload: { owner: "0xabc" },
            mergePayload: { owner: "0xdef" },
        };
        const onError = jest.fn();
        renderWith(jest.fn().mockResolvedValue(refusal), {
            onError,
            isLink: true,
        });
        await act(async () => state.authWeb2AfterConnect("twitter"));
        expect(state.error).toBe(refusal.message);
        expect(state.signInFailure).toMatchObject({
            code: "link:account-exists",
            source: "twitter",
        });
        // Merging is a decision, not something to retry.
        expect(state.retrySignIn).toBeUndefined();
        expect(onError).toHaveBeenCalledWith({
            message: refusal.message,
            type: "link:account-exists",
        });
        expect(state.mergeAccount).toEqual({ owner: "0xabc" });
        expect(state.mergePayload).toEqual({ owner: "0xdef" });
    });

    test("a failure the page was loaded with is shown with the buttons, never as a browser alert", () => {
        const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
        jest.useFakeTimers();
        renderWith(jest.fn(), { errorMessage: "Your invite has expired." });
        act(() => {
            jest.runAllTimers();
        });
        jest.useRealTimers();
        expect(alert).not.toHaveBeenCalled();
        expect(state.error).toBe("Your invite has expired.");
        expect(state.signInFailure).toMatchObject({
            source: "",
            canRetry: false,
        });
        alert.mockRestore();
    });

    test("screens that set the plain error text still can, and clearing it clears the failure", async () => {
        renderWith(jest.fn().mockResolvedValue(NO_CONNECTION));
        act(() => state.setError("Failed to link account"));
        expect(state.error).toBe("Failed to link account");
        expect(state.signInFailure).toMatchObject({
            source: "",
            canRetry: false,
        });
        await act(async () => state.authWeb2AfterConnect("google"));
        expect(state.signInFailure.source).toBe("google");
        act(() => state.setError(""));
        expect(state.signInFailure).toBeNull();
    });

    test("going to the email step leaves the last failure behind", async () => {
        renderWith(jest.fn().mockResolvedValue(NO_CONNECTION));
        await act(async () => state.authWeb2AfterConnect("google"));
        expect(state.signInFailure).not.toBeNull();
        act(() => state.setShowEmailInput(true));
        expect(state.isEmailInputShowing).toBe(true);
        expect(state.signInFailure).toBeNull();
    });

    test("a link that could not be sent is retried with the address the field shows now", async () => {
        (sendSignInLink as jest.Mock)
            .mockResolvedValueOnce({
                success: false,
                message:
                    "Couldn’t connect. Check your connection and try again.",
                retry: true,
            })
            .mockResolvedValueOnce({ success: true });
        renderWith(jest.fn());
        act(() => state.setEmail("first@example.com"));
        await act(async () => state.handleSendEmailLink());
        expect(state.signInFailure).toMatchObject({
            source: "email",
            canRetry: true,
            cancelled: false,
        });
        act(() => state.setEmail("second@example.com"));
        await act(async () => state.retrySignIn());
        expect((sendSignInLink as jest.Mock).mock.calls[1][0]).toBe(
            "second@example.com"
        );
        expect(state.emailSuccess).toBe(true);
        expect(state.signInFailure).toBeNull();
    });

    test("an address that is not valid is explained without a Retry", async () => {
        (sendSignInLink as jest.Mock).mockResolvedValue({
            success: false,
            message: "Enter a valid email address.",
        });
        renderWith(jest.fn());
        await act(async () => state.handleSendEmailLink());
        expect(state.error).toBe("Enter a valid email address.");
        expect(state.signInFailure.source).toBe("email");
        expect(state.retrySignIn).toBeUndefined();
    });
});
