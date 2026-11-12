/** @jest-environment jsdom */
// The sheet with its real buttons: what a visitor sees when a sign-in does
// not finish, and where. Only the wallets, the account API and the page
// chrome are stand-ins.
import React from "react";
import { createRoot } from "react-dom/client";
import { UserContext } from "@components/context/UserContext";
import { sendSignInLink } from "@features/auth/providers/password";
import { connectors } from "../../../dApp/connect";
import ConnectWallet from "./index";

const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
    USER_LOGIN: "USER_LOGIN",
}));
jest.mock("../../../dApp/connect", () => ({
    connectors: { metamask: jest.fn(), wallet_connect: jest.fn() },
}));
jest.mock("@api/accounts/_api", () => ({}), { virtual: true });
jest.mock("@features/auth/providers/password", () => ({
    sendSignInLink: jest.fn(),
}));
jest.mock(
    "@components/modals/Modal",
    () =>
        ({ children }) =>
            children
);
jest.mock("@components/context/ThemeProvider", () => ({
    useCyberTheme: () => ({ isLightTheme: true }),
}));
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({ t: (key) => String(key) }),
}));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    IS_MOBILE: false,
}));
jest.mock("@components/Form", () => ({ Button: "button" }));
jest.mock("@ui/components/IconButton", () => ({ IconButton: () => null }));
jest.mock("@ui/components/IconImg", () => () => null);
jest.mock("@components/CloudinaryNextImage", () => ({
    CloudinaryNextImage: () => null,
}));
jest.mock(
    "@features/landing-carousel/components/CyberloopMark",
    () => () => null
);
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("next/router", () => ({ useRouter: () => ({ route: "/" }) }));

const metamask = connectors.metamask as unknown as jest.Mock;
const send = sendSignInLink as jest.Mock;
const authHandler = jest.fn();

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(window, "alert").mockImplementation(() => {});
    metamask.mockReset();
    send.mockReset();
    authHandler.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
        root.render(
            <UserContext.Provider
                value={{ authHandler, dispatch: jest.fn() } as any}
            >
                <ConnectWallet open toggle={() => {}} />
            </UserContext.Provider>
        )
    );
});
afterEach(() => {
    expect(window.alert).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const button = (label: string) =>
    [...container.querySelectorAll("button")].find(
        (candidate) => candidate.textContent.trim() === label
    );
const press = (label: string) => act(async () => button(label).click());
const alerts = () => [...container.querySelectorAll('[role="alert"]')];
const quiet = () => [...container.querySelectorAll('[role="status"]')];
/** The notice and the element just before it: the control it sits beside. */
const beside = (place: string) => {
    const notice = container.querySelector(`[data-beside="${place}"]`);
    return notice && { notice, control: notice.previousElementSibling };
};
const type = (value: string) =>
    act(() => {
        const field = container.querySelector("input");
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
        ).set.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
    });

const NO_CONNECTION = {
    success: false,
    message: "Couldn’t connect. Check your connection and try again.",
    type: "",
    code: "auth/network-request-failed",
    cancelled: false,
    canRetry: true,
};

test("a failed Google sign-in is said under the Google button, with a Retry that signs in again", async () => {
    authHandler.mockResolvedValueOnce(NO_CONNECTION).mockResolvedValueOnce({
        success: true,
        accountId: "visitor",
        token: "token",
        user: { id: "visitor" },
    });
    await press("Google");

    expect(alerts()).toHaveLength(1);
    const { notice, control } = beside("google");
    expect(control).toBe(button("Google"));
    expect(notice.querySelector('[role="alert"]').textContent).toBe(
        NO_CONNECTION.message + "Retry"
    );
    // On the sheet's light panel.
    expect(alerts()[0].getAttribute("data-surface")).toBe("light");

    await press("Retry");
    expect(authHandler).toHaveBeenCalledTimes(2);
    expect(authHandler.mock.calls[1][0]).toMatchObject({ type: "google" });
    expect(alerts()).toHaveLength(0);
});

test("closing the wallet’s request is said quietly under the wallets: no alert, no Retry", async () => {
    metamask.mockRejectedValue({ code: 4001, message: "User rejected" });
    await press("Metamask");

    expect(alerts()).toHaveLength(0);
    expect(quiet().map((note) => note.textContent)).toEqual([
        "You closed the wallet request.",
    ]);
    const { notice, control } = beside("wallet");
    expect(control.contains(button("Metamask"))).toBe(true);
    expect(notice.querySelector("button")).toBeNull();
    expect(authHandler).not.toHaveBeenCalled();
});

test("closing the signature request is named, and a wallet that is not installed is a real failure", async () => {
    metamask.mockResolvedValue({
        type: "ethereum",
        provider: "metamask",
        walletId: "0xABC",
    });
    authHandler.mockResolvedValue({
        success: false,
        message: "You closed the signature request.",
        type: "",
        code: "wallet/signature-rejected",
        cancelled: true,
        canRetry: false,
    });
    await press("Metamask");
    expect(authHandler.mock.calls[0][0]).toMatchObject({
        type: "web3",
        walletId: "0xabc",
    });
    expect(quiet()[0].textContent).toBe("You closed the signature request.");
    expect(alerts()).toHaveLength(0);

    // Trying again replaces the note with what happens next.
    metamask.mockRejectedValue(
        Object.assign(new Error("Metamask is not installed."), {
            code: "wallet/not-installed",
        })
    );
    await press("Metamask");
    expect(quiet()).toHaveLength(0);
    expect(beside("wallet").notice.textContent).toBe(
        "That wallet isn’t installed in this browser. Install it, or choose another way to sign in."
    );
});

test("the email step explains a bad address under the field and offers Retry only when sending can work", async () => {
    await press("Email");
    expect(container.textContent).toContain(
        "We’ll email you a link for a password-free sign in."
    );
    expect(button("Send sign-in link")).toBeTruthy();
    expect(button("Back")).toBeTruthy();

    send.mockResolvedValueOnce({
        success: false,
        message: "Enter a valid email address.",
    });
    await type("nobody");
    await press("Send sign-in link");
    const invalid = beside("email");
    expect(invalid.control).toBe(container.querySelector("input"));
    expect(invalid.notice.textContent).toBe("Enter a valid email address.");

    send.mockResolvedValueOnce({
        success: false,
        message: "Couldn’t connect. Check your connection and try again.",
        retry: true,
    }).mockResolvedValueOnce({ success: true });
    await type("visitor@example.com");
    await press("Send sign-in link");
    expect(beside("email").notice.textContent).toBe(
        "Couldn’t connect. Check your connection and try again.Retry"
    );

    await press("Retry");
    expect(send).toHaveBeenLastCalledWith("visitor@example.com", undefined);
    expect(alerts()).toHaveLength(0);
    expect(container.textContent).toContain("Check your inbox");
    expect(container.textContent).toContain(
        "We sent a sign-in link to visitor@example.com."
    );
});

test("a failure does not follow the visitor to another step", async () => {
    authHandler.mockResolvedValue(NO_CONNECTION);
    await press("Google");
    expect(alerts()).toHaveLength(1);
    await press("Email");
    expect(alerts()).toHaveLength(0);
    await press("Back");
    expect(alerts()).toHaveLength(0);
});
